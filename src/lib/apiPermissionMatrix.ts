/**
 * API Permission Matrix
 * Adds role check and ownership check for each API
 */

import { supabase } from '@/lib/supabase';
import type { UserRole } from './roleEscapePatch';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface ResourceOwnership {
  userId: string;
  resourceType: string;
  resourceId: string;
}

/**
 * Check if user has required role
 */
export async function checkRolePermission(
  userId: string,
  requiredRole: UserRole
): Promise<PermissionCheckResult> {
  try {
    const { data: roleRows, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error || !roleRows || !Array.isArray(roleRows) || roleRows.length === 0) {
      return { allowed: false, reason: 'User has no role assigned' };
    }

    const userRoles = roleRows.map((row: any) => row.role as UserRole);
    const roleHierarchy: UserRole[] = ['super_admin', 'admin', 'master_reseller', 'reseller', 'support', 'user'];
    
    const userIndex = userRoles.findIndex(r => roleHierarchy.includes(r));
    const requiredIndex = roleHierarchy.indexOf(requiredRole);

    if (userIndex === -1) {
      return { allowed: false, reason: `User role not found in hierarchy` };
    }

    const allowed = userIndex <= requiredIndex;

    return {
      allowed,
      reason: allowed ? undefined : `User does not have required role: ${requiredRole}`,
    };
  } catch (error) {
    return { allowed: false, reason: 'Error checking role permission' };
  }
}

/**
 * Check if user owns a resource
 */
export async function checkResourceOwnership(
  userId: string,
  resourceType: string,
  resourceId: string
): Promise<PermissionCheckResult> {
  try {
    let query;

    switch (resourceType) {
      case 'order':
        query = supabase.from('orders').select('user_id').eq('id', resourceId).maybeSingle();
        break;
      case 'license_key':
        query = supabase.from('license_keys').select('assigned_to').eq('id', resourceId).maybeSingle();
        break;
      case 'wallet':
        query = supabase.from('wallets').select('user_id').eq('id', resourceId).maybeSingle();
        break;
      case 'product':
        // Products are public, so ownership check is not applicable
        return { allowed: true };
      default:
        return { allowed: false, reason: 'Unknown resource type' };
    }

    const { data, error } = await query;

    if (error || !data) {
      return { allowed: false, reason: 'Resource not found' };
    }

    // Check if user_id matches
    const resourceUserId = data.user_id || data.assigned_to;
    const allowed = resourceUserId === userId;

    return {
      allowed,
      reason: allowed ? undefined : 'User does not own this resource',
    };
  } catch (error) {
    return { allowed: false, reason: 'Error checking resource ownership' };
  }
}

/**
 * Check both role and ownership permissions
 */
export async function checkFullPermission(
  userId: string,
  requiredRole: UserRole,
  resourceType?: string,
  resourceId?: string
): Promise<PermissionCheckResult> {
  // First check role
  const roleCheck = await checkRolePermission(userId, requiredRole);
  
  if (!roleCheck.allowed) {
    return roleCheck;
  }

  // If resource type and ID are provided, check ownership
  if (resourceType && resourceId) {
    const ownershipCheck = await checkResourceOwnership(userId, resourceType, resourceId);
    
    if (!ownershipCheck.allowed) {
      return ownershipCheck;
    }
  }

  return { allowed: true };
}

/**
 * API permission matrix - defines required roles for each API endpoint
 */
export const API_PERMISSION_MATRIX: Record<string, { requiredRole: UserRole; requiresOwnership?: boolean }> = {
  // Dashboard APIs
  'GET /api/dashboard/stats': { requiredRole: 'admin' },
  'GET /api/dashboard/users': { requiredRole: 'admin' },
  'POST /api/dashboard/users': { requiredRole: 'super_admin' },
  
  // Reseller APIs
  'GET /api/reseller/dashboard': { requiredRole: 'reseller' },
  'POST /api/reseller/purchase': { requiredRole: 'reseller' },
  
  // Product APIs
  'GET /api/products': { requiredRole: 'user' },
  'POST /api/products': { requiredRole: 'admin' },
  'PUT /api/products/:id': { requiredRole: 'admin' },
  'DELETE /api/products/:id': { requiredRole: 'super_admin' },
  
  // Order APIs
  'GET /api/orders': { requiredRole: 'user', requiresOwnership: true },
  'POST /api/orders': { requiredRole: 'user' },
  'GET /api/orders/:id': { requiredRole: 'user', requiresOwnership: true },
  'PUT /api/orders/:id': { requiredRole: 'admin' },
  
  // License Key APIs
  'GET /api/license-keys': { requiredRole: 'user', requiresOwnership: true },
  'POST /api/license-keys': { requiredRole: 'admin' },
  'GET /api/license-keys/:id': { requiredRole: 'user', requiresOwnership: true },
  'PUT /api/license-keys/:id': { requiredRole: 'admin' },
  'DELETE /api/license-keys/:id': { requiredRole: 'admin' },
  
  // Wallet APIs
  'GET /api/wallet': { requiredRole: 'user', requiresOwnership: true },
  'POST /api/wallet/credit': { requiredRole: 'admin' },
  'POST /api/wallet/debit': { requiredRole: 'admin' },
  
  // Support APIs
  'GET /api/support/tickets': { requiredRole: 'support' },
  'POST /api/support/tickets': { requiredRole: 'user' },
  'PUT /api/support/tickets/:id': { requiredRole: 'support' },
  
  // System Health APIs
  'GET /api/system/health': { requiredRole: 'admin' },
  'GET /api/system/metrics': { requiredRole: 'super_admin' },
  
  // Audit Log APIs
  'GET /api/audit-logs': { requiredRole: 'admin' },
  'POST /api/audit-logs': { requiredRole: 'super_admin' },
  
  // Category APIs
  'GET /api/categories': { requiredRole: 'user' },
  'POST /api/categories': { requiredRole: 'admin' },
  'PUT /api/categories/:id': { requiredRole: 'admin' },
  'DELETE /api/categories/:id': { requiredRole: 'super_admin' },
};

/**
 * Check permission for a specific API endpoint
 */
export async function checkAPIPermission(
  userId: string,
  method: string,
  path: string,
  resourceId?: string
): Promise<PermissionCheckResult> {
  const key = `${method} ${path}`;
  const permission = API_PERMISSION_MATRIX[key];

  if (!permission) {
    // If no permission defined, default to user role
    return checkRolePermission(userId, 'user');
  }

  const { requiredRole, requiresOwnership } = permission;

  // Check role
  const roleCheck = await checkRolePermission(userId, requiredRole);
  if (!roleCheck.allowed) {
    return roleCheck;
  }

  // Check ownership if required
  if (requiresOwnership && resourceId) {
    // Extract resource type from path
    const resourceType = extractResourceType(path);
    const ownershipCheck = await checkResourceOwnership(userId, resourceType, resourceId);
    
    if (!ownershipCheck.allowed) {
      return ownershipCheck;
    }
  }

  return { allowed: true };
}

/**
 * Extract resource type from API path
 */
function extractResourceType(path: string): string {
  const match = path.match(/\/api\/(\w+)/);
  return match ? match[1].slice(0, -1) : 'unknown'; // Remove trailing 's' for singular form
}

/**
 * Higher-order function to wrap API handlers with permission checks
 */
export function withPermissionCheck(
  handler: (userId: string, ...args: any[]) => Promise<any>,
  requiredRole: UserRole,
  resourceType?: string
) {
  return async (userId: string, ...args: any[]): Promise<any> => {
    const permissionCheck = await checkFullPermission(
      userId,
      requiredRole,
      resourceType,
      args[0] // Assume first arg is resource ID if applicable
    );

    if (!permissionCheck.allowed) {
      return {
        success: false,
        error: permissionCheck.reason || 'Permission denied',
      };
    }

    return handler(userId, ...args);
  };
}
