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

export interface UserRole {
  userId: string;
  roleId: string;
  assignedAt: string;
  assignedBy: string;
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

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'super_admin',
    name: 'Super Admin',
    permissions: SUPER_ADMIN_PERMISSIONS,
    description: 'Full system access with all permissions',
  },
  {
    id: 'admin',
    name: 'Admin',
    permissions: ADMIN_PERMISSIONS,
    description: 'Administrative access for product and server management',
  },
  {
    id: 'user',
    name: 'User',
    permissions: DEFAULT_PERMISSIONS,
    description: 'Basic user access with limited permissions',
  },
];

export class PermissionManager {
  private static instance: PermissionManager;
  private userPermissions: Map<string, Permission> = new Map();

  static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  async getUserPermissions(userId: string): Promise<Permission> {
    if (this.userPermissions.has(userId)) {
      return this.userPermissions.get(userId)!;
    }

    // Fetch from database/cache
    const permissions = await this.fetchUserPermissions(userId);
    this.userPermissions.set(userId, permissions);
    return permissions;
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
    // Update in database
    await this.updateUserPermissionsInDB(userId, permissions);
    
    // Update cache
    this.userPermissions.set(userId, permissions);
  }

  async assignRole(userId: string, roleId: string, assignedBy: string): Promise<void> {
    // Assign role in database
    await this.assignRoleInDB(userId, roleId, assignedBy);
    
    // Clear cache to force refresh
    this.userPermissions.delete(userId);
  }

  private async fetchUserPermissions(userId: string): Promise<Permission> {
    // Implement database fetch logic
    // For now, return default permissions
    return DEFAULT_PERMISSIONS;
  }

  private async updateUserPermissionsInDB(userId: string, permissions: Permission): Promise<void> {
    // Implement database update logic
  }

  private async assignRoleInDB(userId: string, roleId: string, assignedBy: string): Promise<void> {
    // Implement role assignment logic
  }

  clearCache(userId?: string): void {
    if (userId) {
      this.userPermissions.delete(userId);
    } else {
      this.userPermissions.clear();
    }
  }
}
