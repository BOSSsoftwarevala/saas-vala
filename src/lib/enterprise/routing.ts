// Enterprise Routing System
// This module provides solid routing foundation with enterprise features

import { Request, Response, NextFunction } from 'express';
import { RateLimiter } from './rateLimiting';
import { PermissionManager } from './permissions';
import { FeatureFlagManager } from './featureFlags';
import { ValidationManager } from './validation';
import { MaintenanceManager } from './maintenance';
import { AnalyticsManager } from './analytics';
import { TimezoneManager } from './timezone';
import { CacheManager } from './cache';

export interface RouteConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: (req: Request, res: Response, next?: NextFunction) => Promise<void> | void;
  middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
  permissions?: string[];
  rateLimit?: {
    key: string;
    options?: any;
  };
  validation?: string;
  featureFlag?: string;
  cache?: {
    ttl: number;
    keyGenerator?: (req: Request) => string;
  };
  analytics?: {
    track: boolean;
    event?: string;
  };
  maintenance?: {
    service?: string;
    bypass?: boolean;
  };
  timezone?: boolean;
  version?: string;
  deprecated?: boolean;
  deprecatedAt?: Date;
  sunsetAt?: Date;
}

export interface RouteMetrics {
  path: string;
  method: string;
  requests: number;
  errors: number;
  avgResponseTime: number;
  lastAccessed: Date;
}

export class EnterpriseRouter {
  private static instance: EnterpriseRouter;
  private routes: Map<string, RouteConfig[]> = new Map();
  private metrics: Map<string, RouteMetrics> = new Map();
  private rateLimiter = RateLimiter.getInstance();
  private permissionManager = PermissionManager.getInstance();
  private featureFlagManager = FeatureFlagManager.getInstance();
  private validationManager = ValidationManager.getInstance();
  private maintenanceManager = MaintenanceManager.getInstance();
  private analytics = AnalyticsManager.getInstance();
  private timezoneManager = TimezoneManager.getInstance();
  private cacheManager = CacheManager.getInstance();

  static getInstance(): EnterpriseRouter {
    if (!EnterpriseRouter.instance) {
      EnterpriseRouter.instance = new EnterpriseRouter();
    }
    return EnterpriseRouter.instance;
  }

  registerRoute(config: RouteConfig): void {
    const key = `${config.method}:${config.path}`;
    
    if (!this.routes.has(key)) {
      this.routes.set(key, []);
    }
    
    this.routes.get(key)!.push(config);
    
    // Initialize metrics
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        path: config.path,
        method: config.method,
        requests: 0,
        errors: 0,
        avgResponseTime: 0,
        lastAccessed: new Date(),
      });
    }
  }

  async handleRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    const key = `${req.method}:${req.route?.path || req.path}`;
    const routes = this.routes.get(key) || [];
    
    if (routes.length === 0) {
      return next();
    }

    // Find matching route (could support versioning, content negotiation, etc.)
    const route = this.findMatchingRoute(routes, req);
    if (!route) {
      return next();
    }

    const startTime = Date.now();
    let metrics = this.metrics.get(key)!;

    try {
      // Update metrics
      metrics.requests++;
      metrics.lastAccessed = new Date();

      // 1. Maintenance Mode Check
      if (route.maintenance && !route.maintenance.bypass) {
        if (this.maintenanceManager.isMaintenanceActive(route.maintenance.service)) {
          const canAccess = this.maintenanceManager.canAccess(
            req.user?.id,
            req.ip,
            req.headers['x-maintenance-bypass'] as string
          );
          
          if (!canAccess) {
            res.status(503).json({
              error: 'Service Unavailable',
              message: 'System is under maintenance',
            });
            return;
          }
        }
      }

      // 2. Feature Flag Check
      if (route.featureFlag) {
        const isEnabled = await this.featureFlagManager.isEnabled(
          route.featureFlag,
          req.user?.id
        );
        
        if (!isEnabled) {
          res.status(404).json({
            error: 'Not Found',
            message: 'Feature not available',
          });
          return;
        }
      }

      // 3. Rate Limiting
      if (route.rateLimit) {
        const identifier = req.user?.id || req.ip;
        const result = await this.rateLimiter.checkLimit(
          route.rateLimit.key,
          identifier,
          route.rateLimit.options
        );
        
        if (!result.allowed) {
          res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: result.retryAfter,
            limit: result.limit,
            remaining: result.remaining,
            resetTime: result.resetTime,
          });
          return;
        }
      }

      // 4. Permission Check
      if (route.permissions && route.permissions.length > 0) {
        if (!req.user?.id) {
          res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required',
          });
          return;
        }

        const hasAllPermissions = await Promise.all(
          route.permissions.map(permission =>
            this.permissionManager.hasPermission(req.user!.id, permission as any)
          )
        );

        if (!hasAllPermissions.every(Boolean)) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Insufficient permissions',
          });
          return;
        }
      }

      // 5. Timezone Handling
      if (route.timezone && req.user?.id) {
        const userTimezone = this.timezoneManager.getUserTimezone(req.user.id);
        req.timezone = userTimezone;
      }

      // 6. Cache Check (for GET requests)
      if (req.method === 'GET' && route.cache) {
        const cacheKey = route.cache.keyGenerator 
          ? route.cache.keyGenerator(req)
          : `route:${key}:${JSON.stringify(req.query)}`;
        
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
          res.set('X-Cache', 'HIT');
          res.json(cached);
          return;
        }
      }

      // 7. Validation
      if (route.validation && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const validationResult = await this.validationManager.validate(
          route.validation,
          req.body
        );
        
        if (!validationResult.valid) {
          res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid input data',
            errors: validationResult.errors,
          });
          return;
        }
        
        // Use validated data
        req.body = validationResult.data;
      }

      // 8. Execute Custom Middleware
      if (route.middleware) {
        for (const middleware of route.middleware) {
          await new Promise<void>((resolve, reject) => {
            middleware(req, res, (error) => {
              if (error) reject(error);
              else resolve();
            });
          });
        }
      }

      // 9. Execute Route Handler
      await route.handler(req, res, next);

      // 10. Cache Response (for GET requests)
      if (req.method === 'GET' && route.cache && res.statusCode === 200) {
        const cacheKey = route.cache.keyGenerator 
          ? route.cache.keyGenerator(req)
          : `route:${key}:${JSON.stringify(req.query)}`;
        
        // Don't cache if already cached
        if (!res.get('X-Cache')) {
          await this.cacheManager.set(cacheKey, res.locals.data, route.cache.ttl);
          res.set('X-Cache', 'MISS');
        }
      }

      // 11. Analytics Tracking
      if (route.analytics?.track !== false) {
        await this.analytics.trackEvent({
          type: route.analytics?.event || 'api_request',
          category: 'api',
          action: req.method.toLowerCase(),
          userId: req.user?.id,
          metadata: {
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseTime: Date.now() - startTime,
          },
        });
      }

    } catch (error) {
      metrics.errors++;
      
      // Log error
      console.error(`Route error for ${key}:`, error);
      
      // Send error response
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
        });
      }
      
      // Track error in analytics
      await this.analytics.trackEvent({
        type: 'api_error',
        category: 'api',
        action: 'error',
        userId: req.user?.id,
        metadata: {
          path: req.path,
          method: req.method,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    } finally {
      // Update response time metrics
      const responseTime = Date.now() - startTime;
      metrics.avgResponseTime = (metrics.avgResponseTime + responseTime) / 2;
    }
  }

  private findMatchingRoute(routes: RouteConfig[], req: Request): RouteConfig | null {
    // Simple matching for now - could be enhanced for versioning, content negotiation, etc.
    return routes.find(route => {
      // Check version header
      if (route.version) {
        const requestedVersion = req.headers['api-version'];
        if (requestedVersion && requestedVersion !== route.version) {
          return false;
        }
      }
      
      // Check deprecation
      if (route.deprecated) {
        const warnHeader = route.deprecatedAt 
          ? `Deprecated since ${route.deprecatedAt.toISOString()}`
          : 'Deprecated';
        res.set('Deprecation', warnHeader);
        
        if (route.sunsetAt) {
          res.set('Sunset', route.sunsetAt.toISOString());
        }
      }
      
      return true;
    }) || null;
  }

  getRouteMetrics(): RouteMetrics[] {
    return Array.from(this.metrics.values());
  }

  getRouteMetricsForPath(path: string, method?: string): RouteMetrics[] {
    return Array.from(this.metrics.values()).filter(metric => {
      const pathMatch = metric.path === path || metric.path.includes(path);
      const methodMatch = !method || metric.method === method;
      return pathMatch && methodMatch;
    });
  }

  clearMetrics(): void {
    this.metrics.clear();
  }

  // Helper method to create route configurations
  static createRoute(config: Partial<RouteConfig>): RouteConfig {
    return {
      path: '',
      method: 'GET',
      handler: async (req, res) => res.json({}),
      ...config,
    } as RouteConfig;
  }
}

// Decorators for route configuration
export function Route(config: Partial<RouteConfig>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalHandler = descriptor.value;
    
    descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
      const router = EnterpriseRouter.getInstance();
      const routeConfig = EnterpriseRouter.createRoute({
        ...config,
        handler: originalHandler.bind(this),
      });
      
      await router.handleRequest(req, res, next);
    };
    
    return descriptor;
  };
}

export function RequiresPermission(permission: string) {
  return Route({
    permissions: [permission],
  });
}

export function RateLimit(key: string, options?: any) {
  return Route({
    rateLimit: { key, options },
  });
}

export function FeatureFlag(flag: string) {
  return Route({
    featureFlag: flag,
  });
}

export function Validate(schema: string) {
  return Route({
    validation: schema,
  });
}

export function Cache(ttl: number, keyGenerator?: (req: Request) => string) {
  return Route({
    cache: { ttl, keyGenerator },
  });
}

export function Analytics(event?: string) {
  return Route({
    analytics: { track: true, event },
  });
}

export function Maintenance(service?: string, bypass?: boolean) {
  return Route({
    maintenance: { service, bypass },
  });
}

export function Version(version: string, deprecated?: boolean, deprecatedAt?: Date, sunsetAt?: Date) {
  return Route({
    version,
    deprecated,
    deprecatedAt,
    sunsetAt,
  });
}

// Express middleware factory
export function createEnterpriseRouter() {
  const router = EnterpriseRouter.getInstance();
  
  return (req: Request, res: Response, next: NextFunction) => {
    router.handleRequest(req, res, next);
  };
}

export default EnterpriseRouter;
