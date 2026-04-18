/**
 * Route Self-Heal
 * Auto redirect to nearest valid route on invalid route
 */

import { selfHealingEngine } from './selfHealingEngine';
import { localApi } from './localApi';

export interface RouteValidationResult {
  valid: boolean;
  redirectPath?: string;
  reason?: string;
}

export interface RouteConfig {
  path: string;
  requiredAuth?: boolean;
  requiredRole?: string;
  fallbackPath?: string;
}

class RouteSelfHeal {
  private validRoutes: Set<string> = new Set([
    '/',
    '/marketplace',
    '/marketplace/:category',
    '/marketplace/:category/:sub',
    '/marketplace/:category/:sub/:micro',
    '/marketplace/:category/:sub/:micro/:nano',
    '/dashboard',
    '/reseller-dashboard',
    '/profile',
    '/wallet',
    '/orders',
    '/license-keys',
    '/settings',
  ]);

  private routeConfigs: Map<string, RouteConfig> = new Map([
    ['/dashboard', { path: '/dashboard', requiredAuth: true, requiredRole: 'boss', fallbackPath: '/marketplace' }],
    ['/reseller-dashboard', { path: '/reseller-dashboard', requiredAuth: true, requiredRole: 'reseller', fallbackPath: '/marketplace' }],
    ['/wallet', { path: '/wallet', requiredAuth: true, fallbackPath: '/marketplace' }],
    ['/orders', { path: '/orders', requiredAuth: true, fallbackPath: '/marketplace' }],
    ['/license-keys', { path: '/license-keys', requiredAuth: true, fallbackPath: '/marketplace' }],
    ['/settings', { path: '/settings', requiredAuth: true, fallbackPath: '/marketplace' }],
  ]);

  async validateRoute(path: string, userRole?: string): Promise<RouteValidationResult> {
    try {
      // Check if route exists
      if (!this.isRouteExists(path)) {
        const redirectPath = this.getNearestValidRoute(path);
        return {
          valid: false,
          redirectPath,
          reason: 'Route does not exist',
        };
      }

      // Check authentication requirements
      const config = this.routeConfigs.get(path);
      if (config?.requiredAuth) {
        const { data } = await localApi.select('users').execute();
        const users = (data as any)?.data || [];

        if (users.length === 0) {
          return {
            valid: false,
            redirectPath: config.fallbackPath || '/marketplace',
            reason: 'Authentication required',
          };
        }

        // Check role requirements
        if (config.requiredRole && userRole !== config.requiredRole) {
          return {
            valid: false,
            redirectPath: config.fallbackPath || '/marketplace',
            reason: `Role ${config.requiredRole} required`,
          };
        }
      }

      // Validate route parameters
      const paramValidation = this.validateRouteParams(path);
      if (!paramValidation.valid) {
        return paramValidation;
      }

      return { valid: true };
    } catch (error) {
      selfHealingEngine.handleEvent({
        type: 'route_fail',
        severity: 'high',
        module: 'route_self_heal',
        message: `Route validation failed for ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        context: { path, error },
        healed: false,
      });

      return {
        valid: false,
        redirectPath: '/marketplace',
        reason: 'Route validation error',
      };
    }
  }

  private isRouteExists(path: string): boolean {
    // Check exact match
    if (this.validRoutes.has(path)) {
      return true;
    }

    // Check pattern match
    for (const route of this.validRoutes) {
      if (this.matchRoutePattern(route, path)) {
        return true;
      }
    }

    return false;
  }

  private matchRoutePattern(pattern: string, path: string): boolean {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      // Check if it's a parameter
      if (patternPart.startsWith(':')) {
        continue;
      }

      if (patternPart !== pathPart) {
        return false;
      }
    }

    return true;
  }

  private validateRouteParams(path: string): RouteValidationResult {
    const parts = path.split('/').filter(Boolean);

    // Validate category slug
    if (parts[0] === 'marketplace' && parts.length > 1) {
      const categorySlug = parts[1];
      if (!this.isValidSlug(categorySlug)) {
        return {
          valid: false,
          redirectPath: '/marketplace',
          reason: 'Invalid category slug',
        };
      }
    }

    // Validate sub-category slug
    if (parts[0] === 'marketplace' && parts.length > 2) {
      const subSlug = parts[2];
      if (!this.isValidSlug(subSlug)) {
        return {
          valid: false,
          redirectPath: `/marketplace/${parts[1]}`,
          reason: 'Invalid sub-category slug',
        };
      }
    }

    // Validate micro-category slug
    if (parts[0] === 'marketplace' && parts.length > 3) {
      const microSlug = parts[3];
      if (!this.isValidSlug(microSlug)) {
        return {
          valid: false,
          redirectPath: `/marketplace/${parts[1]}/${parts[2]}`,
          reason: 'Invalid micro-category slug',
        };
      }
    }

    // Validate nano-category slug
    if (parts[0] === 'marketplace' && parts.length > 4) {
      const nanoSlug = parts[4];
      if (!this.isValidSlug(nanoSlug)) {
        return {
          valid: false,
          redirectPath: `/marketplace/${parts[1]}/${parts[2]}/${parts[3]}`,
          reason: 'Invalid nano-category slug',
        };
      }
    }

    return { valid: true };
  }

  private isValidSlug(slug: string): boolean {
    // Slug should be lowercase, alphanumeric, hyphens only
    const slugRegex = /^[a-z0-9-]+$/;
    return slugRegex.test(slug) && slug.length > 0;
  }

  private getNearestValidRoute(path: string): string {
    const parts = path.split('/').filter(Boolean);

    if (parts.length === 0) {
      return '/marketplace';
    }

    // Try to find nearest valid parent
    if (parts[0] === 'marketplace') {
      if (parts.length > 1) {
        return '/marketplace';
      }
    }

    return '/marketplace';
  }

  async healRoute(path: string, userRole?: string): Promise<boolean> {
    const validation = await this.validateRoute(path, userRole);

    if (!validation.valid && validation.redirectPath) {
      // Perform redirect
      window.location.href = validation.redirectPath;

      selfHealingEngine.handleEvent({
        type: 'route_fail',
        severity: 'low',
        module: 'route_self_heal',
        message: `Route healed: ${path} → ${validation.redirectPath}`,
        timestamp: new Date().toISOString(),
        context: { originalPath: path, redirectPath: validation.redirectPath, reason: validation.reason },
        healed: true,
        healingAction: 'redirected',
      });

      return true;
    }

    return false;
  }

  registerRoute(route: string, config?: RouteConfig): void {
    this.validRoutes.add(route);
    if (config) {
      this.routeConfigs.set(route, config);
    }
  }

  unregisterRoute(route: string): void {
    this.validRoutes.delete(route);
    this.routeConfigs.delete(route);
  }

  getValidRoutes(): string[] {
    return Array.from(this.validRoutes);
  }

  getRouteConfig(path: string): RouteConfig | undefined {
    return this.routeConfigs.get(path);
  }

  async validateAllRoutes(userRole?: string): Promise<Map<string, RouteValidationResult>> {
    const results = new Map<string, RouteValidationResult>();

    for (const route of this.validRoutes) {
      const result = await this.validateRoute(route, userRole);
      results.set(route, result);
    }

    return results;
  }
}

// Singleton instance
export const routeSelfHeal = new RouteSelfHeal();
