// Identity + Role Engine (RBAC) for Key Management
import { supabase } from '@/lib/supabase';

export type UserRole = 'boss' | 'admin' | 'reseller' | 'user';
export type Permission =
  | 'key:create'
  | 'key:read'
  | 'key:update'
  | 'key:delete'
  | 'key:assign'
  | 'key:revoke'
  | 'key:validate'
  | 'key:activate'
  | 'key:manage_all'
  | 'user:create'
  | 'user:read'
  | 'user:update'
  | 'user:delete'
  | 'user:manage_all'
  | 'product:create'
  | 'product:read'
  | 'product:update'
  | 'product:delete'
  | 'product:manage_all'
  | 'system:admin'
  | 'system:monitor'
  | 'system:configure';

export interface Role {
  id: string;
  name: UserRole;
  display_name: string;
  permissions: Permission[];
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  role_id: string;
  role?: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissionCheck {
  resource: string;
  action: string;
  resource_id?: string;
}

export class RBACService {
  private rolePermissions: Map<UserRole, Permission[]> = new Map([
    ['boss', [
      'key:create', 'key:read', 'key:update', 'key:delete', 'key:assign', 'key:revoke',
      'key:validate', 'key:activate', 'key:manage_all',
      'user:create', 'user:read', 'user:update', 'user:delete', 'user:manage_all',
      'product:create', 'product:read', 'product:update', 'product:delete', 'product:manage_all',
      'system:admin', 'system:monitor', 'system:configure',
    ]],
    ['admin', [
      'key:create', 'key:read', 'key:update', 'key:delete', 'key:assign', 'key:revoke',
      'key:validate', 'key:activate',
      'user:create', 'user:read', 'user:update', 'user:delete',
      'product:create', 'product:read', 'product:update', 'product:delete',
      'system:monitor',
    ]],
    ['reseller', [
      'key:read', 'key:assign', 'key:validate',
      'user:read',
      'product:read',
    ]],
    ['user', [
      'key:read', 'key:validate',
      'user:read',
    ]],
  ]);

  /**
   * Check if user has permission
   */
  async hasPermission(
    userId: string,
    permission: Permission
  ): Promise<boolean> {
    try {
      // Get user with role
      const user = await this.getUserWithRole(userId);

      if (!user || !user.role) {
        return false;
      }

      // Get permissions for role
      const permissions = this.rolePermissions.get(user.role);

      if (!permissions) {
        return false;
      }

      return permissions.includes(permission);
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Check multiple permissions
   */
  async hasAnyPermission(
    userId: string,
    permissions: Permission[]
  ): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, permission)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if user has all permissions
   */
  async hasAllPermissions(
    userId: string,
    permissions: Permission[]
  ): Promise<boolean> {
    for (const permission of permissions) {
      if (!(await this.hasPermission(userId, permission))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get user with role
   */
  async getUserWithRole(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, roles!inner(*)')
        .eq('id', userId)
        .single();

      if (error) throw error;

      const user = data as any;
      return {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
        role: user.roles.name as UserRole,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    } catch (error) {
      console.error('Error getting user with role:', error);
      return null;
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      const user = await this.getUserWithRole(userId);

      if (!user || !user.role) {
        return [];
      }

      return this.rolePermissions.get(user.role) || [];
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleName: UserRole): Promise<boolean> {
    try {
      // Get role
      const role = await this.getRoleByName(roleName);

      if (!role) {
        return false;
      }

      // Update user role
      const { error } = await supabase
        .from('users')
        .update({
          role_id: role.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error assigning role:', error);
      return false;
    }
  }

  /**
   * Get role by name
   */
  async getRoleByName(roleName: UserRole): Promise<Role | null> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('name', roleName)
        .single();

      if (error) throw error;
      return data as Role;
    } catch (error) {
      console.error('Error getting role by name:', error);
      return null;
    }
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (error) throw error;
      return (data as Role[]) || [];
    } catch (error) {
      console.error('Error getting all roles:', error);
      return [];
    }
  }

  /**
   * Create role
   */
  async createRole(
    name: UserRole,
    displayName: string,
    permissions: Permission[],
    isSystemRole = false
  ): Promise<Role | null> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .insert({
          name,
          display_name: displayName,
          permissions,
          is_system_role: isSystemRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as Role;
    } catch (error) {
      console.error('Error creating role:', error);
      return null;
    }
  }

  /**
   * Update role
   */
  async updateRole(
    roleId: string,
    updates: {
      display_name?: string;
      permissions?: Permission[];
    }
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('roles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating role:', error);
      return false;
    }
  }

  /**
   * Delete role (only custom roles)
   */
  async deleteRole(roleId: string): Promise<boolean> {
    try {
      // Check if it's a system role
      const role = await supabase
        .from('roles')
        .select('is_system_role')
        .eq('id', roleId)
        .single();

      if (role.data?.is_system_role) {
        return false;
      }

      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting role:', error);
      return false;
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(roleName: UserRole): Promise<User[]> {
    try {
      const role = await this.getRoleByName(roleName);

      if (!role) {
        return [];
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role_id', role.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data as User[]) || [];
    } catch (error) {
      console.error('Error getting users by role:', error);
      return [];
    }
  }

  /**
   * Check resource ownership
   */
  async canAccessResource(
    userId: string,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    try {
      // Admin and boss can access everything
      const user = await this.getUserWithRole(userId);

      if (!user) {
        return false;
      }

      if (user.role === 'boss' || user.role === 'admin') {
        return true;
      }

      // Check resource ownership based on type
      switch (resourceType) {
        case 'key':
          return await this.canAccessKey(userId, resourceId);
        case 'product':
          return await this.canAccessProduct(userId, resourceId);
        case 'user':
          return userId === resourceId;
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking resource access:', error);
      return false;
    }
  }

  /**
   * Check if user can access key
   */
  private async canAccessKey(userId: string, keyId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('keys')
        .select('assigned_user_id, product_id')
        .eq('id', keyId)
        .single();

      if (error) throw error;

      const key = data as any;

      // User can access their own keys
      if (key.assigned_user_id === userId) {
        return true;
      }

      // Reseller can access keys for products they manage
      const user = await this.getUserWithRole(userId);
      if (user?.role === 'reseller') {
        // Check if user manages this product
        const { data: productAccess } = await supabase
          .from('product_resellers')
          .select('id')
          .eq('reseller_id', userId)
          .eq('product_id', key.product_id)
          .single();

        return !!productAccess;
      }

      return false;
    } catch (error) {
      console.error('Error checking key access:', error);
      return false;
    }
  }

  /**
   * Check if user can access product
   */
  private async canAccessProduct(userId: string, productId: string): Promise<boolean> {
    try {
      const user = await this.getUserWithRole(userId);

      if (!user) {
        return false;
      }

      // Admin and boss can access all products
      if (user.role === 'boss' || user.role === 'admin') {
        return true;
      }

      // Reseller can access products they manage
      if (user.role === 'reseller') {
        const { data: productAccess } = await supabase
          .from('product_resellers')
          .select('id')
          .eq('reseller_id', userId)
          .eq('product_id', productId)
          .single();

        return !!productAccess;
      }

      // Regular users can only view active products
      if (user.role === 'user') {
        const { data: product } = await supabase
          .from('products')
          .select('id')
          .eq('id', productId)
          .eq('status', 'active')
          .single();

        return !!product;
      }

      return false;
    } catch (error) {
      console.error('Error checking product access:', error);
      return false;
    }
  }

  /**
   * Initialize default roles
   */
  async initializeDefaultRoles(): Promise<boolean> {
    try {
      const defaultRoles: Array<{
        name: UserRole;
        display_name: string;
        permissions: Permission[];
      }> = [
        {
          name: 'boss',
          display_name: 'Boss',
          permissions: this.rolePermissions.get('boss')!,
        },
        {
          name: 'admin',
          display_name: 'Administrator',
          permissions: this.rolePermissions.get('admin')!,
        },
        {
          name: 'reseller',
          display_name: 'Reseller',
          permissions: this.rolePermissions.get('reseller')!,
        },
        {
          name: 'user',
          display_name: 'User',
          permissions: this.rolePermissions.get('user')!,
        },
      ];

      for (const roleData of defaultRoles) {
        const existing = await this.getRoleByName(roleData.name);

        if (!existing) {
          await this.createRole(
            roleData.name,
            roleData.display_name,
            roleData.permissions,
            true
          );
        }
      }

      return true;
    } catch (error) {
      console.error('Error initializing default roles:', error);
      return false;
    }
  }

  /**
   * Get RBAC statistics
   */
  async getRBACStats(): Promise<{
    total_users: number;
    users_by_role: Record<UserRole, number>;
    total_roles: number;
    custom_roles: number;
  }> {
    try {
      const [totalUsersResult, rolesResult] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact' }),
        supabase.from('roles').select('*'),
      ]);

      const totalUsers = totalUsersResult.count || 0;
      const roles = rolesResult.data as Role[];

      const usersByRole: Record<UserRole, number> = {
        boss: 0,
        admin: 0,
        reseller: 0,
        user: 0,
      };

      for (const role of roles) {
        const { count } = await supabase
          .from('users')
          .select('id', { count: 'exact' })
          .eq('role_id', role.id);

        usersByRole[role.name] = count || 0;
      }

      const customRoles = roles.filter(r => !r.is_system_role).length;

      return {
        total_users: totalUsers,
        users_by_role: usersByRole,
        total_roles: roles.length,
        custom_roles: customRoles,
      };
    } catch (error) {
      console.error('Error getting RBAC stats:', error);
      return {
        total_users: 0,
        users_by_role: {
          boss: 0,
          admin: 0,
          reseller: 0,
          user: 0,
        },
        total_roles: 0,
        custom_roles: 0,
      };
    }
  }
}

export const rbacService = new RBACService();
