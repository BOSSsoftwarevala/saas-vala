import { supabase, EnterpriseDatabase, Database } from '../supabase';

export interface Permission {
  canCreateProduct: boolean;
  canDeployServer: boolean;
  canGenerateKey: boolean;
  canViewLogs: boolean;
  canManageSecurity: boolean;
  canManageUsers: boolean;
  canViewAnalytics: boolean;
  canManageSystem: boolean;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission;
  description?: string;
}

export const DEFAULT_PERMISSIONS: Permission = {
  canCreateProduct: false,
  canDeployServer: false,
  canGenerateKey: false,
  canViewLogs: false,
  canManageSecurity: false,
  canManageUsers: false,
  canViewAnalytics: false,
  canManageSystem: false,
};

export const SUPER_ADMIN_PERMISSIONS: Permission = {
  canCreateProduct: true,
  canDeployServer: true,
  canGenerateKey: true,
  canViewLogs: true,
  canManageSecurity: true,
  canManageUsers: true,
  canViewAnalytics: true,
  canManageSystem: true,
};

export const ADMIN_PERMISSIONS: Permission = {
  canCreateProduct: true,
  canDeployServer: true,
  canGenerateKey: true,
  canViewLogs: true,
  canManageSecurity: false,
  canManageUsers: false,
  canViewAnalytics: true,
  canManageSystem: false,
};

export class RealPermissionManager {
  private static instance: RealPermissionManager;

  static getInstance(): RealPermissionManager {
    if (!RealPermissionManager.instance) {
      RealPermissionManager.instance = new RealPermissionManager();
    }
    return RealPermissionManager.instance;
  }

  async getUserPermissions(userId: string): Promise<Permission> {
    const user = await EnterpriseDatabase.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    return user.permissions;
  }

  async hasPermission(userId: string, permission: keyof Permission): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return userPermissions[permission];
  }

  async checkMultiplePermissions(userId: string, permissions: (keyof Permission)[]): Promise<Record<keyof Permission, boolean>> {
    const userPermissions = await this.getUserPermissions(userId);
    const result: Record<keyof Permission, boolean> = {} as any;
    
    for (const permission of permissions) {
      result[permission] = userPermissions[permission];
    }
    
    return result;
  }

  async updateUserPermissions(userId: string, permissions: Permission): Promise<void> {
    await EnterpriseDatabase.updateUserPermissions(userId, permissions);
    
    // Create audit log
    const currentUser = await this.getCurrentUser();
    if (currentUser) {
      await EnterpriseDatabase.createAuditLog({
        action: 'permissions_updated',
        entity_type: 'user',
        entity_id: userId,
        user_id: currentUser.id,
        timezone: 'UTC',
        metadata: { 
          old_permissions: await this.getUserPermissions(userId),
          new_permissions: permissions 
        },
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent
      });
    }
  }

  async assignRole(userId: string, roleName: string, assignedBy: string): Promise<void> {
    let permissions: Permission;
    
    switch (roleName) {
      case 'super_admin':
        permissions = SUPER_ADMIN_PERMISSIONS;
        break;
      case 'admin':
        permissions = ADMIN_PERMISSIONS;
        break;
      case 'user':
      default:
        permissions = DEFAULT_PERMISSIONS;
        break;
    }

    await this.updateUserPermissions(userId, permissions);
    
    // Create audit log
    await EnterpriseDatabase.createAuditLog({
      action: 'role_assigned',
      entity_type: 'user',
      entity_id: userId,
      user_id: assignedBy,
      timezone: 'UTC',
      metadata: { role: roleName },
      ip_address: await this.getClientIP(),
      user_agent: navigator.userAgent
    });
  }

  async getUsersWithPermission(permission: keyof Permission): Promise<string[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('status', 'active')
      .eq(`permissions->>${permission}`, 'true');
    
    if (error) throw error;
    return data.map(user => user.id);
  }

  async createRole(roleData: Omit<Role, 'id'>): Promise<Role> {
    // In a real implementation, you might have a separate roles table
    // For now, we'll just return the role data
    const role: Role = {
      id: `role_${Date.now()}`,
      ...roleData
    };

    // Create audit log
    const currentUser = await this.getCurrentUser();
    if (currentUser) {
      await EnterpriseDatabase.createAuditLog({
        action: 'role_created',
        entity_type: 'role',
        entity_id: role.id,
        user_id: currentUser.id,
        timezone: 'UTC',
        metadata: { role },
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent
      });
    }

    return role;
  }

  private async getCurrentUser(): Promise<{ id: string } | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user ? { id: user.id } : null;
  }

  private async getClientIP(): Promise<string> {
    // In a real implementation, this would come from the request
    return 'unknown';
  }
}

// React hook for permissions
export function usePermissions(userId?: string) {
  const [permissions, setPermissions] = useState<Permission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    const loadPermissions = async () => {
      try {
        setLoading(true);
        const permissionManager = RealPermissionManager.getInstance();
        const userPermissions = await permissionManager.getUserPermissions(userId);
        setPermissions(userPermissions);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load permissions');
        setPermissions(null);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [userId]);

  const hasPermission = useCallback(async (permission: keyof Permission) => {
    if (!userId || !permissions) return false;
    return permissions[permission];
  }, [userId, permissions]);

  return { permissions, loading, error, hasPermission };
}

// React hook for current user permissions
export function useCurrentUserPermissions() {
  const { data: { user } } = useSupabaseUser();
  return usePermissions(user?.id);
}

// Supabase auth hook (you would implement this)
function useSupabaseUser() {
  const [data, setData] = useState<{ user: any } | null>(null);
  // Implementation would go here
  return { data };
}

// React state import
import { useState, useEffect, useCallback } from 'react';

export default RealPermissionManager;
