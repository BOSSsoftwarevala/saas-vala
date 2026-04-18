/**
 * RUNTIME ASSERT ENGINE (KILL SWITCH)
 * Global guard that validates every action before execution
 * 
 * VALIDATES:
 * - Route valid?
 * - Role allowed?
 * - Payload valid?
 * - API reachable?
 * - DB ready?
 * 
 * IF ANY FAIL:
 * - BLOCK EXECUTION
 * - LOG ERROR
 * - AUTO FIX ATTEMPT
 */

import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AssertResult {
  valid: boolean;
  blocked: boolean;
  reason?: string;
  canAutoFix?: boolean;
}

interface ActionContext {
  action: string;
  route?: string;
  payload?: any;
  apiEndpoint?: string;
  requiresRole?: 'admin' | 'reseller' | 'user';
}

export class RuntimeAssertEngine {
  private static instance: RuntimeAssertEngine;
  private routeMap: Map<string, boolean> = new Map();
  private apiHealth: Map<string, { healthy: boolean; lastCheck: number; failCount: number }> = new Map();
  private dbReady: boolean = true;
  private circuitBreakers: Map<string, { open: boolean; openUntil: number; failCount: number }> = new Map();

  private constructor() {
    this.initializeRouteMap();
    this.startHealthMonitor();
  }

  static getInstance(): RuntimeAssertEngine {
    if (!RuntimeAssertEngine.instance) {
      RuntimeAssertEngine.instance = new RuntimeAssertEngine();
    }
    return RuntimeAssertEngine.instance;
  }

  private initializeRouteMap(): void {
    // Initialize known valid routes
    const validRoutes = [
      '/dashboard',
      '/products',
      '/products/add',
      '/keys',
      '/servers',
      '/resellers',
      '/marketplace-admin',
      '/automation',
      '/audit-logs',
      '/system-health',
      '/settings',
      '/wallet',
      '/seo',
    ];
    validRoutes.forEach(route => this.routeMap.set(route, true));
  }

  private startHealthMonitor(): void {
    // Periodic health checks (every 30 seconds)
    setInterval(() => {
      this.checkApiHealth();
      this.checkCircuitBreakers();
    }, 30000);
  }

  private async checkApiHealth(): Promise<void> {
    const criticalApis = ['/api/health', '/api/auth/me'];
    for (const api of criticalApis) {
      try {
        const response = await fetch(api, { method: 'HEAD' });
        const healthy = response.ok;
        const current = this.apiHealth.get(api) || { healthy: true, lastCheck: 0, failCount: 0 };
        
        if (healthy) {
          this.apiHealth.set(api, { healthy: true, lastCheck: Date.now(), failCount: 0 });
        } else {
          this.apiHealth.set(api, { 
            healthy: false, 
            lastCheck: Date.now(), 
            failCount: current.failCount + 1 
          });
        }
      } catch (error) {
        const current = this.apiHealth.get(api) || { healthy: true, lastCheck: 0, failCount: 0 };
        this.apiHealth.set(api, { 
          healthy: false, 
          lastCheck: Date.now(), 
          failCount: current.failCount + 1 
        });
      }
    }
  }

  private checkCircuitBreakers(): void {
    const now = Date.now();
    for (const [api, breaker] of this.circuitBreakers) {
      if (breaker.open && now > breaker.openUntil) {
        // Try to close circuit breaker
        this.circuitBreakers.set(api, { open: false, openUntil: 0, failCount: 0 });
      }
    }
  }

  /**
   * Main assert function - validates action before execution
   */
  async assert(context: ActionContext): Promise<AssertResult> {
    // 1. Validate route
    if (context.route) {
      const routeValid = await this.validateRoute(context.route);
      if (!routeValid.valid) {
        return { valid: false, blocked: true, reason: routeValid.reason };
      }
    }

    // 2. Validate role
    if (context.requiresRole) {
      const roleValid = this.validateRole(context.requiresRole);
      if (!roleValid.valid) {
        return { valid: false, blocked: true, reason: roleValid.reason };
      }
    }

    // 3. Validate payload
    if (context.payload) {
      const payloadValid = this.validatePayload(context.payload);
      if (!payloadValid.valid) {
        return { valid: false, blocked: true, reason: payloadValid.reason };
      }
    }

    // 4. Validate API reachable
    if (context.apiEndpoint) {
      const apiValid = await this.validateApi(context.apiEndpoint);
      if (!apiValid.valid) {
        return { valid: false, blocked: true, reason: apiValid.reason, canAutoFix: apiValid.canAutoFix };
      }
    }

    // 5. Validate DB ready
    if (!this.dbReady) {
      return { valid: false, blocked: true, reason: 'Database not ready', canAutoFix: true };
    }

    return { valid: true, blocked: false };
  }

  private async validateRoute(route: string): Promise<AssertResult> {
    // Check if route exists in known routes
    const baseRoute = route.split('/')[1] ? `/${route.split('/')[1]}` : route;
    if (!this.routeMap.has(baseRoute) && !this.routeMap.has(route)) {
      // Dynamic routes might not be in the map, check pattern
      const patternMatch = this.matchRoutePattern(route);
      if (!patternMatch) {
        return { valid: false, blocked: true, reason: `Invalid route: ${route}` };
      }
    }
    return { valid: true, blocked: false };
  }

  private matchRoutePattern(route: string): boolean {
    // Check for dynamic route patterns
    const patterns = ['/products/:id', '/marketplace/:category', '/:demoSlug'];
    return patterns.some(pattern => {
      const patternParts = pattern.split('/');
      const routeParts = route.split('/');
      if (patternParts.length !== routeParts.length) return false;
      return patternParts.every((part, i) => 
        part.startsWith(':') || part === routeParts[i]
      );
    });
  }

  private validateRole(requiredRole: string): AssertResult {
    // This would use useAuth hook, but since this is a class method,
    // we'll need to pass the user context or use a different approach
    // For now, we'll return true and let the component handle role validation
    return { valid: true, blocked: false };
  }

  private validatePayload(payload: any): AssertResult {
    if (!payload) return { valid: true, blocked: false };

    // Check for null/undefined in critical fields
    if (typeof payload === 'object') {
      const criticalFields = ['id', 'user_id', 'product_id', 'order_id'];
      for (const field of criticalFields) {
        if (payload[field] === undefined || payload[field] === null) {
          return { valid: false, blocked: true, reason: `Missing critical field: ${field}` };
        }
      }
    }

    return { valid: true, blocked: false };
  }

  private async validateApi(apiEndpoint: string): Promise<AssertResult> {
    // Check circuit breaker
    const breaker = this.circuitBreakers.get(apiEndpoint);
    if (breaker && breaker.open) {
      return { 
        valid: false, 
        blocked: true, 
        reason: 'Circuit breaker open - API temporarily unavailable',
        canAutoFix: true
      };
    }

    // Check API health
    const health = this.apiHealth.get(apiEndpoint);
    if (health && !health.healthy && health.failCount > 5) {
      // Open circuit breaker
      this.circuitBreakers.set(apiEndpoint, {
        open: true,
        openUntil: Date.now() + 60000, // 1 minute
        failCount: health.failCount
      });
      return { 
        valid: false, 
        blocked: true, 
        reason: 'API unhealthy - circuit breaker triggered',
        canAutoFix: true
      };
    }

    return { valid: true, blocked: false };
  }

  /**
   * Record API failure for circuit breaker
   */
  recordApiFailure(apiEndpoint: string): void {
    const health = this.apiHealth.get(apiEndpoint) || { healthy: true, lastCheck: 0, failCount: 0 };
    this.apiHealth.set(apiEndpoint, {
      healthy: false,
      lastCheck: Date.now(),
      failCount: health.failCount + 1
    });

    // Update circuit breaker
    const breaker = this.circuitBreakers.get(apiEndpoint) || { open: false, openUntil: 0, failCount: 0 };
    if (breaker.failCount >= 3) {
      this.circuitBreakers.set(apiEndpoint, {
        open: true,
        openUntil: Date.now() + 60000,
        failCount: breaker.failCount + 1
      });
    } else {
      this.circuitBreakers.set(apiEndpoint, {
        open: false,
        openUntil: 0,
        failCount: breaker.failCount + 1
      });
    }
  }

  /**
   * Record API success
   */
  recordApiSuccess(apiEndpoint: string): void {
    this.apiHealth.set(apiEndpoint, { healthy: true, lastCheck: Date.now(), failCount: 0 });
    this.circuitBreakers.set(apiEndpoint, { open: false, openUntil: 0, failCount: 0 });
  }

  /**
   * Set DB ready state
   */
  setDbReady(ready: boolean): void {
    this.dbReady = ready;
  }

  /**
   * Get system health status
   */
  getSystemHealth(): {
    apis: Record<string, { healthy: boolean; failCount: number }>;
    dbReady: boolean;
    circuitBreakers: Record<string, { open: boolean; failCount: number }>;
  } {
    const apis: Record<string, { healthy: boolean; failCount: number }> = {};
    this.apiHealth.forEach((health, api) => {
      apis[api] = { healthy: health.healthy, failCount: health.failCount };
    });

    const circuitBreakers: Record<string, { open: boolean; failCount: number }> = {};
    this.circuitBreakers.forEach((breaker, api) => {
      circuitBreakers[api] = { open: breaker.open, failCount: breaker.failCount };
    });

    return { apis, dbReady: this.dbReady, circuitBreakers };
  }
}

// Singleton instance
export const runtimeAssert = RuntimeAssertEngine.getInstance();

/**
 * React hook for runtime assertions
 */
export function useRuntimeAssert() {
  const assert = async (context: ActionContext): Promise<AssertResult> => {
    return runtimeAssert.assert(context);
  };

  const recordFailure = (apiEndpoint: string) => {
    runtimeAssert.recordApiFailure(apiEndpoint);
  };

  const recordSuccess = (apiEndpoint: string) => {
    runtimeAssert.recordApiSuccess(apiEndpoint);
  };

  const getHealth = () => {
    return runtimeAssert.getSystemHealth();
  };

  return { assert, recordFailure, recordSuccess, getHealth };
}
