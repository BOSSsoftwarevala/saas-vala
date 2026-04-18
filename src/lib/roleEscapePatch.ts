/**
 * Role Escape Patch
 * Ensures no user can access /dashboard (boss) or /reseller-dashboard without proper role
 */

import { supabase } from '@/lib/supabase';

export type UserRole = 'super_admin' | 'admin' | 'reseller' | 'master_reseller' | 'support' | 'user';

export interface RoleCheckResult {
  allowed: boolean;
  requiredRole: UserRole;
  userRole: UserRole | null;
  reason?: string;
}

/**
 * Check if user has required role
 */
export async function checkUserRole(userId: string, requiredRole: UserRole): Promise<RoleCheckResult> {
  try {
    const { data: roleRows, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      return {
        allowed: false,
        requiredRole,
        userRole: null,
        reason: 'Failed to verify user role',
      };
    }

    if (!roleRows || !Array.isArray(roleRows) || roleRows.length === 0) {
      return {
        allowed: false,
        requiredRole,
        userRole: null,
        reason: 'No role assigned to user',
      };
    }

    const userRoles = roleRows.map((row: any) => row.role as UserRole);
    const userRole = getPrimaryRole(userRoles);

    const allowed = hasRequiredRole(userRole, requiredRole);

    return {
      allowed,
      requiredRole,
      userRole,
      reason: allowed ? undefined : `User does not have required role: ${requiredRole}`,
    };
  } catch (error) {
    return {
      allowed: false,
      requiredRole,
      userRole: null,
      reason: 'Error checking user role',
    };
  }
}

/**
 * Get primary role from user's roles
 */
export function getPrimaryRole(roles: UserRole[]): UserRole {
  const roleHierarchy: UserRole[] = ['super_admin', 'admin', 'master_reseller', 'reseller', 'support', 'user'];

  for (const role of roleHierarchy) {
    if (roles.includes(role)) {
      return role;
    }
  }

  return 'user'; // Default fallback
}

/**
 * Check if user has required role based on hierarchy
 */
export function hasRequiredRole(userRole: UserRole | null, requiredRole: UserRole): boolean {
  if (!userRole) return false;

  const roleHierarchy: UserRole[] = ['super_admin', 'admin', 'master_reseller', 'reseller', 'support', 'user'];
  const userIndex = roleHierarchy.indexOf(userRole);
  const requiredIndex = roleHierarchy.indexOf(requiredRole);

  // User must have equal or higher privilege level
  return userIndex <= requiredIndex;
}

/**
 * Check if user can access dashboard (boss/admin only)
 */
export async function canAccessDashboard(userId: string): Promise<boolean> {
  const result = await checkUserRole(userId, 'admin');
  return result.allowed;
}

/**
 * Check if user can access reseller dashboard
 */
export async function canAccessResellerDashboard(userId: string): Promise<boolean> {
  const result = await checkUserRole(userId, 'reseller');
  return result.allowed;
}

/**
 * Check if user can access admin routes
 */
export async function canAccessAdminRoutes(userId: string): Promise<boolean> {
  const result = await checkUserRole(userId, 'admin');
  return result.allowed;
}

/**
 * Check if user can access support routes
 */
export async function canAccessSupportRoutes(userId: string): Promise<boolean> {
  const result = await checkUserRole(userId, 'support');
  return result.allowed;
}

/**
 * Validate route access based on role
 */
export async function validateRouteAccess(userId: string, route: string): Promise<RoleCheckResult> {
  // Define route requirements
  const routeRequirements: Record<string, UserRole> = {
    '/dashboard': 'admin',
    '/reseller-dashboard': 'reseller',
    '/support': 'support',
    '/automation': 'admin',
    '/audit-logs': 'admin',
    '/marketplace-admin': 'admin',
    '/system-health': 'admin',
    '/keys': 'user',
    '/wallet': 'user',
    '/products': 'admin',
  };

  const requiredRole = routeRequirements[route];

  if (!requiredRole) {
    // Public route, allow access
    return {
      allowed: true,
      requiredRole: 'user',
      userRole: null,
    };
  }

  return checkUserRole(userId, requiredRole);
}

/**
 * Get redirect path based on user's role
 */
export async function getRedirectPathForRole(userId: string): Promise<string> {
  const result = await checkUserRole(userId, 'admin');
  const userRole = result.userRole || 'user';

  switch (userRole) {
    case 'super_admin':
    case 'admin':
      return '/dashboard';
    case 'master_reseller':
    case 'reseller':
      return '/reseller-dashboard';
    case 'support':
      return '/support';
    case 'user':
    default:
      return '/marketplace';
  }
}

/**
 * Role-based access control middleware
 */
export function withRoleCheck(requiredRole: UserRole) {
  return async (userId: string): Promise<{ allowed: boolean; redirectPath?: string }> => {
    const result = await checkUserRole(userId, requiredRole);

    if (result.allowed) {
      return { allowed: true };
    }

    const redirectPath = await getRedirectPathForRole(userId);
    return { allowed: false, redirectPath };
  };
}
