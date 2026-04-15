// Access Control Service - Strict role-based permissions
import { AppRole } from '@/hooks/useAuth';

export type Permission =
  | 'products:read'
  | 'products:write'
  | 'products:delete'
  | 'keys:read'
  | 'keys:write'
  | 'keys:delete'
  | 'servers:read'
  | 'servers:write'
  | 'servers:delete'
  | 'resellers:read'
  | 'resellers:write'
  | 'resellers:delete'
  | 'wallet:read'
  | 'wallet:write'
  | 'orders:read'
  | 'orders:write'
  | 'support:read'
  | 'support:write'
  | 'audit_logs:read'
  | 'system_health:read'
  | 'settings:read'
  | 'settings:write'
  | 'boss:all'
  | 'admin:all';

interface RolePermissions {
  [key: string]: Permission[];
}

const ROLE_PERMISSIONS: RolePermissions = {
  super_admin: [
    'boss:all',
    'products:read',
    'products:write',
    'products:delete',
    'keys:read',
    'keys:write',
    'keys:delete',
    'servers:read',
    'servers:write',
    'servers:delete',
    'resellers:read',
    'resellers:write',
    'resellers:delete',
    'wallet:read',
    'wallet:write',
    'orders:read',
    'orders:write',
    'support:read',
    'support:write',
    'audit_logs:read',
    'system_health:read',
    'settings:read',
    'settings:write',
  ],
  admin: [
    'admin:all',
    'products:read',
    'products:write',
    'products:delete',
    'keys:read',
    'keys:write',
    'keys:delete',
    'servers:read',
    'servers:write',
    'servers:delete',
    'resellers:read',
    'resellers:write',
    'wallet:read',
    'wallet:write',
    'orders:read',
    'orders:write',
    'support:read',
    'support:write',
    'audit_logs:read',
    'system_health:read',
    'settings:read',
  ],
  master_reseller: [
    'products:read',
    'keys:read',
    'keys:write',
    'wallet:read',
    'wallet:write',
    'orders:read',
    'orders:write',
    'support:read',
    'support:write',
    'settings:read',
  ],
  reseller: [
    'products:read',
    'keys:read',
    'wallet:read',
    'wallet:write',
    'orders:read',
    'orders:write',
    'support:read',
    'support:write',
  ],
  support: [
    'products:read',
    'keys:read',
    'orders:read',
    'orders:write',
    'support:read',
    'support:write',
    'audit_logs:read',
  ],
  user: [
    'products:read',
    'wallet:read',
    'orders:read',
    'support:read',
  ],
};

class AccessControlService {
  private static instance: AccessControlService;

  private constructor() {}

  static getInstance(): AccessControlService {
    if (!AccessControlService.instance) {
      AccessControlService.instance = new AccessControlService();
    }
    return AccessControlService.instance;
  }

  hasPermission(role: AppRole | null, permission: Permission): boolean {
    if (!role) return false;

    // Super admin has all permissions
    if (role === 'super_admin') return true;

    // Check role-specific permissions
    const rolePermissions = ROLE_PERMISSIONS[role];
    if (!rolePermissions) return false;

    return rolePermissions.includes(permission);
  }

  hasAnyPermission(role: AppRole | null, permissions: Permission[]): boolean {
    if (!role) return false;

    // Super admin has all permissions
    if (role === 'super_admin') return true;

    const rolePermissions = ROLE_PERMISSIONS[role];
    if (!rolePermissions) return false;

    return permissions.some(permission => rolePermissions.includes(permission));
  }

  hasAllPermissions(role: AppRole | null, permissions: Permission[]): boolean {
    if (!role) return false;

    // Super admin has all permissions
    if (role === 'super_admin') return true;

    const rolePermissions = ROLE_PERMISSIONS[role];
    if (!rolePermissions) return false;

    return permissions.every(permission => rolePermissions.includes(permission));
  }

  canAccessRoute(role: AppRole | null, route: string): boolean {
    if (!role) {
      // Allow public routes
      const publicRoutes = ['/', '/auth', '/marketplace', '/marketplace/product/:id'];
      return publicRoutes.some(r => route.startsWith(r));
    }

    // Super admin can access all routes
    if (role === 'super_admin') return true;

    // Admin routes
    const adminRoutes = ['/dashboard', '/products', '/keys', '/servers', '/settings', '/audit-logs', '/system-health'];
    if (role === 'admin' && adminRoutes.some(r => route.startsWith(r))) return true;

    // Reseller routes
    const resellerRoutes = ['/reseller/dashboard', '/wallet', '/orders', '/support'];
    if ((role === 'reseller' || role === 'master_reseller') && resellerRoutes.some(r => route.startsWith(r))) return true;

    // Support routes
    const supportRoutes = ['/support'];
    if (role === 'support' && supportRoutes.some(r => route.startsWith(r))) return true;

    // User routes
    const userRoutes = ['/', '/marketplace', '/orders', '/wallet', '/support'];
    if (role === 'user' && userRoutes.some(r => route.startsWith(r))) return true;

    return false;
  }

  getAccessibleRoutes(role: AppRole | null): string[] {
    if (!role) return ['/', '/auth', '/marketplace'];

    if (role === 'super_admin') {
      return [
        '/',
        '/boss',
        '/dashboard',
        '/products',
        '/keys',
        '/servers',
        '/wallet',
        '/orders',
        '/support',
        '/resellers',
        '/apk-pipeline',
        '/ai-chat',
        '/ai-apis',
        '/audit-logs',
        '/system-health',
        '/settings',
      ];
    }

    if (role === 'admin') {
      return [
        '/',
        '/dashboard',
        '/products',
        '/keys',
        '/servers',
        '/wallet',
        '/orders',
        '/support',
        '/apk-pipeline',
        '/audit-logs',
        '/system-health',
        '/settings',
      ];
    }

    if (role === 'master_reseller') {
      return [
        '/',
        '/reseller/dashboard',
        '/wallet',
        '/orders',
        '/support',
        '/keys',
        '/settings',
      ];
    }

    if (role === 'reseller') {
      return [
        '/',
        '/reseller/dashboard',
        '/wallet',
        '/orders',
        '/support',
        '/keys',
      ];
    }

    if (role === 'support') {
      return [
        '/',
        '/support',
        '/audit-logs',
      ];
    }

    // User
    return [
      '/',
      '/marketplace',
      '/orders',
      '/wallet',
      '/support',
    ];
  }

  checkPermission(role: AppRole | null, permission: Permission): void {
    if (!this.hasPermission(role, permission)) {
      throw new Error(`Permission denied: ${permission}`);
    }
  }

  filterByPermission<T extends { role: AppRole }>(
    items: T[],
    permission: Permission,
    userRole: AppRole
  ): T[] {
    return items.filter(item => {
      if (userRole === 'super_admin') return true;
      return this.hasPermission(item.role, permission);
    });
  }
}

export const accessControl = AccessControlService.getInstance();

// Convenience functions
export function hasPermission(role: AppRole | null, permission: Permission): boolean {
  return accessControl.hasPermission(role, permission);
}

export function canAccessRoute(role: AppRole | null, route: string): boolean {
  return accessControl.canAccessRoute(role, route);
}

export function requirePermission(role: AppRole | null, permission: Permission): void {
  accessControl.checkPermission(role, permission);
}
