import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import * as crypto from 'crypto';

export interface Role {
  id: string;
  workspaceId: string;
  name: string;
  displayName: string;
  description: string;
  level: number; // Higher number = more permissions
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced role definitions for ultra-strict access control
export const ROLE_LEVELS = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  SUPPORT_AGENT: 60,
  RESELLER: 40,
  USER: 20
} as const;

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    'system:*', 'workspace:*', 'channel:*', 'message:*', 'user:*',
    'ticket:*', 'analytics:*', 'moderation:*', 'backup:*', 'settings:*'
  ],
  ADMIN: [
    'channel:*', 'message:read', 'message:send', 'ticket:*', 'user:assign',
    'analytics:view', 'moderation:view', 'settings:workspace'
  ],
  SUPPORT_AGENT: [
    'message:read', 'message:send', 'ticket:*', 'file:upload', 'file:download'
  ],
  RESELLER: [
    'message:read', 'message:send', 'ticket:create', 'file:upload', 'file:download'
  ],
  USER: [
    'message:read', 'message:send', 'ticket:create', 'file:upload', 'file:download'
  ]
} as const;

export interface AccessRule {
  id: string;
  workspaceId: string;
  resource: string;
  action: string;
  conditions: AccessCondition[];
  effect: 'allow' | 'deny';
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessCondition {
  type: 'user_role' | 'user_id' | 'channel_type' | 'message_type' | 'time_based' | 'ip_based';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
  negate?: boolean;
}

export interface AccessRequest {
  id: string;
  userId: string;
  workspaceId: string;
  resource: string;
  action: string;
  context: any;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
}

export interface AccessResult {
  allowed: boolean;
  reason?: string;
  rule?: AccessRule;
  conditions?: AccessCondition[];
}

export interface SecurityPolicy {
  id: string;
  workspaceId: string;
  name: string;
  type: 'password_policy' | 'session_policy' | 'data_retention' | 'file_access' | 'api_access';
  config: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  result: 'allowed' | 'denied';
  reason?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  details: any;
}

export class UltraAccessControl extends EventEmitter {
  private static instance: UltraAccessControl;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private roles: Map<string, Role> = new Map();
  private accessRules: Map<string, AccessRule[]> = new Map(); // workspaceId -> rules
  private securityPolicies: Map<string, SecurityPolicy[]> = new Map(); // workspaceId -> policies
  private sessionCache: Map<string, { userId: string; workspaceId: string; expires: Date }> = new Map();

  static getInstance(): UltraAccessControl {
    if (!UltraAccessControl.instance) {
      UltraAccessControl.instance = new UltraAccessControl();
    }
    return UltraAccessControl.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadRoles();
      await this.loadAccessRules();
      await this.loadSecurityPolicies();
      this.startCacheCleanup();
      
      this.logger.info('access-control', 'Access control system initialized', {
        rolesCount: this.roles.size,
        accessRulesCount: Array.from(this.accessRules.values()).reduce((sum, rules) => sum + rules.length, 0),
        policiesCount: Array.from(this.securityPolicies.values()).reduce((sum, policies) => sum + policies.length, 0)
      });
    } catch (error) {
      this.logger.error('access-control', 'Failed to initialize access control system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        level INTEGER NOT NULL,
        permissions JSONB NOT NULL,
        is_system BOOLEAN DEFAULT FALSE,
        workspace_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS access_rules (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        conditions JSONB NOT NULL,
        effect VARCHAR(10) NOT NULL,
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS security_policies (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        config JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        result VARCHAR(10) NOT NULL,
        reason TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT NOW(),
        details JSONB
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_roles_workspace_id ON roles(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_access_rules_workspace_id ON access_rules(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_security_policies_workspace_id ON security_policies(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)');
  }

  private async loadRoles(): Promise<void> {
    try {
      // Load system roles first
      await this.createSystemRoles();
      
      const rows = await this.database.query('SELECT * FROM roles ORDER BY level DESC');
      
      for (const row of rows) {
        const role: Role = {
          id: row.id,
          name: row.name,
          displayName: row.display_name,
          description: row.description,
          level: row.level,
          permissions: row.permissions || [],
          isSystem: row.is_system,
          workspaceId: row.workspace_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.roles.set(role.id, role);
      }
      
      this.logger.info('access-control', `Loaded ${this.roles.size} roles`);
    } catch (error) {
      this.logger.error('access-control', 'Failed to load roles', error as Error);
    }
  }

  private async createSystemRoles(): Promise<void> {
    const systemRoles: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'super_admin',
        displayName: 'Super Admin',
        description: 'Full access to all resources and settings',
        level: 100,
        permissions: [
          { resource: '*', actions: ['*'] }
        ],
        isSystem: true
      },
      {
        name: 'admin',
        displayName: 'Administrator',
        description: 'Can manage workspace settings, users, and channels',
        level: 80,
        permissions: [
          { resource: 'workspace', actions: ['read', 'update'] },
          { resource: 'users', actions: ['read', 'update', 'delete', 'invite'] },
          { resource: 'channels', actions: ['create', 'read', 'update', 'delete'] },
          { resource: 'messages', actions: ['read', 'send', 'delete', 'pin'] },
          { resource: 'tickets', actions: ['read', 'update', 'delete', 'assign'] },
          { resource: 'files', actions: ['read', 'upload', 'delete'] },
          { resource: 'analytics', actions: ['read'] },
          { resource: 'settings', actions: ['read', 'update'] }
        ],
        isSystem: true
      },
      {
        name: 'support_agent',
        displayName: 'Support Agent',
        description: 'Can handle customer support and manage tickets',
        level: 60,
        permissions: [
          { resource: 'channels', actions: ['read'] },
          { resource: 'messages', actions: ['read', 'send'] },
          { resource: 'tickets', actions: ['read', 'update', 'create'] },
          { resource: 'users', actions: ['read'] },
          { resource: 'files', actions: ['read', 'upload'] }
        ],
        isSystem: true
      },
      {
        name: 'reseller',
        displayName: 'Reseller',
        description: 'Can manage their own customers and basic support',
        level: 40,
        permissions: [
          { resource: 'channels', actions: ['read'] },
          { resource: 'messages', actions: ['read', 'send'] },
          { resource: 'tickets', actions: ['read', 'create'] },
          { resource: 'users', actions: ['read'] },
          { resource: 'files', actions: ['read', 'upload'] }
        ],
        isSystem: true
      },
      {
        name: 'customer',
        displayName: 'Customer',
        description: 'Basic user access to channels and messages',
        level: 20,
        permissions: [
          { resource: 'channels', actions: ['read'] },
          { resource: 'messages', actions: ['read', 'send'] },
          { resource: 'tickets', actions: ['read', 'create'] },
          { resource: 'files', actions: ['read', 'upload'] }
        ],
        isSystem: true
      }
    ];

    for (const roleData of systemRoles) {
      const existing = Array.from(this.roles.values()).find(r => r.name === roleData.name && r.isSystem);
      if (!existing) {
        const roleId = `role-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        const role: Role = {
          ...roleData,
          id: roleId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.database.query(`
          INSERT INTO roles (
            id, name, display_name, description, level, permissions,
            is_system, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          role.id,
          role.name,
          role.displayName,
          role.description,
          role.level,
          JSON.stringify(role.permissions),
          role.isSystem,
          role.createdAt,
          role.updatedAt
        ]);

        this.roles.set(roleId, role);
      }
    }
  }

  private async loadAccessRules(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM access_rules WHERE is_active = TRUE ORDER BY priority DESC');
      
      for (const row of rows) {
        const rule: AccessRule = {
          id: row.id,
          workspaceId: row.workspace_id,
          resource: row.resource,
          action: row.action,
          conditions: row.conditions || [],
          effect: row.effect,
          priority: row.priority,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.accessRules.has(rule.workspaceId)) {
          this.accessRules.set(rule.workspaceId, []);
        }
        this.accessRules.get(rule.workspaceId)!.push(rule);
      }
      
      this.logger.info('access-control', `Loaded access rules for ${this.accessRules.size} workspaces`);
    } catch (error) {
      this.logger.error('access-control', 'Failed to load access rules', error as Error);
    }
  }

  private async loadSecurityPolicies(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM security_policies WHERE is_active = TRUE');
      
      for (const row of rows) {
        const policy: SecurityPolicy = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          type: row.type,
          config: row.config,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.securityPolicies.has(policy.workspaceId)) {
          this.securityPolicies.set(policy.workspaceId, []);
        }
        this.securityPolicies.get(policy.workspaceId)!.push(policy);
      }
      
      this.logger.info('access-control', `Loaded security policies for ${this.securityPolicies.size} workspaces`);
    } catch (error) {
      this.logger.error('access-control', 'Failed to load security policies', error as Error);
    }
  }

  private startCacheCleanup(): void {
    // Clean up expired sessions every hour
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expired: string[] = [];
    
    for (const [sessionId, session] of this.sessionCache.entries()) {
      if (session.expires < now) {
        expired.push(sessionId);
      }
    }
    
    for (const sessionId of expired) {
      this.sessionCache.delete(sessionId);
    }
    
    if (expired.length > 0) {
      this.logger.debug('access-control', `Cleaned up ${expired.length} expired sessions`);
    }
  }

  // ACCESS CONTROL METHODS
  async checkAccess(request: AccessRequest): Promise<AccessResult> {
    try {
      // Get user's role in workspace
      const userRole = await this.getUserRole(request.userId, request.workspaceId);
      if (!userRole) {
        const result: AccessResult = {
          allowed: false,
          reason: 'User not found in workspace'
        };
        
        await this.logAccess(request, result);
        return result;
      }

      // Check role-based permissions first
      const roleResult = this.checkRolePermissions(userRole, request.resource, request.action);
      if (!roleResult.allowed) {
        await this.logAccess(request, roleResult);
        return roleResult;
      }

      // Check custom access rules
      const rules = this.accessRules.get(request.workspaceId) || [];
      for (const rule of rules) {
        if (this.matchesRule(rule, request, userRole)) {
          const result: AccessResult = {
            allowed: rule.effect === 'allow',
            reason: rule.effect === 'deny' ? 'Access denied by rule' : 'Access granted by rule',
            rule,
            conditions: rule.conditions
          };
          
          await this.logAccess(request, result);
          return result;
        }
      }

      // Default allow if no deny rules matched
      const result: AccessResult = {
        allowed: true,
        reason: 'Access granted by default'
      };
      
      await this.logAccess(request, result);
      return result;

    } catch (error) {
      this.logger.error('access-control', `Access check failed: ${request.userId}`, error as Error);
      
      const result: AccessResult = {
        allowed: false,
        reason: 'Access check error'
      };
      
      await this.logAccess(request, result);
      return result;
    }
  }

  private checkRolePermissions(role: Role, resource: string, action: string): AccessResult {
    // Check for wildcard permission
    const wildcardPermission = role.permissions.find(p => p.resource === '*' && p.actions.includes('*'));
    if (wildcardPermission) {
      return { allowed: true };
    }

    // Check for resource-specific permission
    const resourcePermission = role.permissions.find(p => 
      (p.resource === resource || p.resource === '*') && 
      (p.actions.includes(action) || p.actions.includes('*'))
    );

    if (resourcePermission) {
      return { allowed: true };
    }

    return { 
      allowed: false, 
      reason: `Insufficient permissions for ${action} on ${resource}` 
    };
  }

  private matchesRule(rule: AccessRule, request: AccessRequest, userRole: Role): boolean {
    // Check if rule applies to this resource and action
    if (rule.resource !== '*' && rule.resource !== request.resource) return false;
    if (rule.action !== '*' && rule.action !== request.action) return false;

    // Check all conditions
    for (const condition of rule.conditions) {
      if (!this.matchesCondition(condition, request, userRole)) {
        return false;
      }
    }

    return true;
  }

  private matchesCondition(condition: AccessCondition, request: AccessRequest, userRole: Role): boolean {
    let value: any;

    switch (condition.type) {
      case 'user_role':
        value = userRole.name;
        break;
      case 'user_id':
        value = request.userId;
        break;
      case 'channel_type':
        value = request.context?.channelType;
        break;
      case 'message_type':
        value = request.context?.messageType;
        break;
      case 'time_based':
        value = new Date().getHours();
        break;
      case 'ip_based':
        value = request.ipAddress;
        break;
      default:
        return true;
    }

    const matches = this.evaluateCondition(value, condition.operator, condition.value);
    return condition.negate ? !matches : matches;
  }

  private evaluateCondition(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'greater_than':
        return Number(actual) > Number(expected);
      case 'less_than':
        return Number(actual) < Number(expected);
      default:
        return false;
    }
  }

  private async getUserRole(userId: string, workspaceId: string): Promise<Role | null> {
    try {
      // This would typically query the workspace_members table
      // For now, we'll use a simplified approach
      const rows = await this.database.query(`
        SELECT w.members FROM workspaces w WHERE w.id = $1
      `, [workspaceId]);

      if (rows.length === 0) return null;

      const members = rows[0].members as WorkspaceMember[];
      const member = members.find(m => m.userId === userId);
      
      if (!member) return null;

      // Find role by name
      return Array.from(this.roles.values()).find(r => r.name === member.role) || null;
    } catch (error) {
      this.logger.error('access-control', `Failed to get user role: ${userId}`, error as Error);
      return null;
    }
  }

  private async logAccess(request: AccessRequest, result: AccessResult): Promise<void> {
    try {
      const logId = `audit-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      
      await this.database.query(`
        INSERT INTO audit_logs (
          id, workspace_id, user_id, action, resource, resource_id,
          result, reason, ip_address, user_agent, timestamp, details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        logId,
        request.workspaceId,
        request.userId,
        request.action,
        request.resource,
        request.context?.resourceId,
        result.allowed ? 'allowed' : 'denied',
        result.reason,
        request.ipAddress,
        request.userAgent,
        request.timestamp,
        JSON.stringify({
          rule: result.rule?.id,
          conditions: result.conditions?.map(c => c.type)
        })
      ]);
    } catch (error) {
      this.logger.error('access-control', 'Failed to log access', error as Error);
    }
  }

  // ROLE MANAGEMENT
  async createRole(workspaceId: string, config: {
    name: string;
    displayName: string;
    description: string;
    level: number;
    permissions: Permission[];
  }): Promise<string> {
    const roleId = `role-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const role: Role = {
        id: roleId,
        name: config.name as UserRole,
        displayName: config.displayName,
        description: config.description,
        level: config.level,
        permissions: config.permissions,
        isSystem: false,
        workspaceId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO roles (
          id, name, display_name, description, level, permissions,
          is_system, workspace_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        role.id,
        role.name,
        role.displayName,
        role.description,
        role.level,
        JSON.stringify(role.permissions),
        role.isSystem,
        role.workspaceId,
        role.createdAt,
        role.updatedAt
      ]);

      this.roles.set(roleId, role);

      this.logger.info('access-control', `Role created: ${role.name}`, {
        roleId,
        workspaceId
      });

      this.emit('roleCreated', role);
      return roleId;

    } catch (error) {
      this.logger.error('access-control', `Failed to create role: ${config.name}`, error as Error);
      throw error;
    }
  }

  async getRole(roleId: string): Promise<Role | null> {
    return this.roles.get(roleId) || null;
  }

  async getRolesByWorkspace(workspaceId: string): Promise<Role[]> {
    return Array.from(this.roles.values()).filter(r => 
      r.isSystem || r.workspaceId === workspaceId
    );
  }

  async updateRole(roleId: string, updates: Partial<Role>): Promise<boolean> {
    const role = this.roles.get(roleId);
    if (!role || role.isSystem) return false;

    try {
      Object.assign(role, updates, { updatedAt: new Date() });

      await this.database.query(`
        UPDATE roles 
        SET display_name = $1, description = $2, level = $3, permissions = $4, updated_at = $5
        WHERE id = $6
      `, [
        role.displayName,
        role.description,
        role.level,
        JSON.stringify(role.permissions),
        role.updatedAt,
        role.id
      ]);

      this.emit('roleUpdated', role);
      return true;

    } catch (error) {
      this.logger.error('access-control', `Failed to update role: ${roleId}`, error as Error);
      return false;
    }
  }

  async deleteRole(roleId: string): Promise<boolean> {
    const role = this.roles.get(roleId);
    if (!role || role.isSystem) return false;

    try {
      await this.database.query('DELETE FROM roles WHERE id = $1', [roleId]);
      this.roles.delete(roleId);

      this.emit('roleDeleted', role);
      return true;

    } catch (error) {
      this.logger.error('access-control', `Failed to delete role: ${roleId}`, error as Error);
      return false;
    }
  }

  // ACCESS RULE MANAGEMENT
  async createAccessRule(workspaceId: string, config: {
    resource: string;
    action: string;
    conditions: AccessCondition[];
    effect: AccessRule['effect'];
    priority?: number;
  }): Promise<string> {
    const ruleId = `rule-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const rule: AccessRule = {
        id: ruleId,
        workspaceId,
        resource: config.resource,
        action: config.action,
        conditions: config.conditions,
        effect: config.effect,
        priority: config.priority || 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO access_rules (
          id, workspace_id, resource, action, conditions, effect,
          priority, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        rule.id,
        rule.workspaceId,
        rule.resource,
        rule.action,
        JSON.stringify(rule.conditions),
        rule.effect,
        rule.priority,
        rule.isActive,
        rule.createdAt,
        rule.updatedAt
      ]);

      if (!this.accessRules.has(workspaceId)) {
        this.accessRules.set(workspaceId, []);
      }
      this.accessRules.get(workspaceId)!.push(rule);

      this.logger.info('access-control', `Access rule created: ${ruleId}`, {
        ruleId,
        workspaceId,
        resource: config.resource,
        action: config.action,
        effect: config.effect
      });

      this.emit('accessRuleCreated', rule);
      return ruleId;

    } catch (error) {
      this.logger.error('access-control', `Failed to create access rule`, error as Error);
      throw error;
    }
  }

  async getAccessRules(workspaceId: string): Promise<AccessRule[]> {
    return this.accessRules.get(workspaceId) || [];
  }

  async updateAccessRule(ruleId: string, updates: Partial<AccessRule>): Promise<boolean> {
    for (const [workspaceId, rules] of this.accessRules.entries()) {
      const ruleIndex = rules.findIndex(r => r.id === ruleId);
      if (ruleIndex !== -1) {
        const rule = rules[ruleIndex];
        Object.assign(rule, updates, { updatedAt: new Date() });

        try {
          await this.database.query(`
            UPDATE access_rules 
            SET conditions = $1, effect = $2, priority = $3, is_active = $4, updated_at = $5
            WHERE id = $6
          `, [
            JSON.stringify(rule.conditions),
            rule.effect,
            rule.priority,
            rule.isActive,
            rule.updatedAt,
            rule.id
          ]);

          this.emit('accessRuleUpdated', rule);
          return true;

        } catch (error) {
          this.logger.error('access-control', `Failed to update access rule: ${ruleId}`, error as Error);
          return false;
        }
      }
    }

    return false;
  }

  async deleteAccessRule(ruleId: string): Promise<boolean> {
    for (const [workspaceId, rules] of this.accessRules.entries()) {
      const ruleIndex = rules.findIndex(r => r.id === ruleId);
      if (ruleIndex !== -1) {
        const rule = rules[ruleIndex];
        rules.splice(ruleIndex, 1);

        try {
          await this.database.query('DELETE FROM access_rules WHERE id = $1', [ruleId]);

          this.emit('accessRuleDeleted', rule);
          return true;

        } catch (error) {
          this.logger.error('access-control', `Failed to delete access rule: ${ruleId}`, error as Error);
          return false;
        }
      }
    }

    return false;
  }

  // SECURITY POLICY MANAGEMENT
  async createSecurityPolicy(workspaceId: string, config: {
    name: string;
    type: SecurityPolicy['type'];
    config: any;
  }): Promise<string> {
    const policyId = `policy-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const policy: SecurityPolicy = {
        id: policyId,
        workspaceId,
        name: config.name,
        type: config.type,
        config: config.config,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO security_policies (
          id, workspace_id, name, type, config, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        policy.id,
        policy.workspaceId,
        policy.name,
        policy.type,
        JSON.stringify(policy.config),
        policy.isActive,
        policy.createdAt,
        policy.updatedAt
      ]);

      if (!this.securityPolicies.has(workspaceId)) {
        this.securityPolicies.set(workspaceId, []);
      }
      this.securityPolicies.get(workspaceId)!.push(policy);

      this.logger.info('access-control', `Security policy created: ${policy.name}`, {
        policyId,
        workspaceId,
        type: config.type
      });

      this.emit('securityPolicyCreated', policy);
      return policyId;

    } catch (error) {
      this.logger.error('access-control', `Failed to create security policy`, error as Error);
      throw error;
    }
  }

  async getSecurityPolicies(workspaceId: string): Promise<SecurityPolicy[]> {
    return this.securityPolicies.get(workspaceId) || [];
  }

  // AUDIT LOG METHODS
  async getAuditLogs(workspaceId: string, filters?: {
    userId?: string;
    action?: string;
    resource?: string;
    result?: 'allowed' | 'denied';
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    try {
      let sql = `
        SELECT * FROM audit_logs 
        WHERE workspace_id = $1
      `;
      const params: any[] = [workspaceId];
      let paramIndex = 2;

      if (filters?.userId) {
        sql += ` AND user_id = $${paramIndex}`;
        params.push(filters.userId);
        paramIndex++;
      }

      if (filters?.action) {
        sql += ` AND action = $${paramIndex}`;
        params.push(filters.action);
        paramIndex++;
      }

      if (filters?.resource) {
        sql += ` AND resource = $${paramIndex}`;
        params.push(filters.resource);
        paramIndex++;
      }

      if (filters?.result) {
        sql += ` AND result = $${paramIndex}`;
        params.push(filters.result);
        paramIndex++;
      }

      if (filters?.dateFrom) {
        sql += ` AND timestamp >= $${paramIndex}`;
        params.push(filters.dateFrom);
        paramIndex++;
      }

      if (filters?.dateTo) {
        sql += ` AND timestamp <= $${paramIndex}`;
        params.push(filters.dateTo);
        paramIndex++;
      }

      sql += ` ORDER BY timestamp DESC`;

      if (filters?.limit) {
        sql += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
        paramIndex++;

        if (filters?.offset) {
          sql += ` OFFSET $${paramIndex}`;
          params.push(filters.offset);
        }
      }

      const rows = await this.database.query(sql, params);
      
      return rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        userId: row.user_id,
        action: row.action,
        resource: row.resource,
        resourceId: row.resource_id,
        result: row.result,
        reason: row.reason,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        timestamp: row.timestamp,
        details: row.details
      }));

    } catch (error) {
      this.logger.error('access-control', 'Failed to get audit logs', error as Error);
      return [];
    }
  }

  // SESSION MANAGEMENT
  createSession(userId: string, workspaceId: string, expiresIn: number = 24 * 60 * 60 * 1000): string {
    const sessionId = `sess-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
    const expires = new Date(Date.now() + expiresIn);

    this.sessionCache.set(sessionId, {
      userId,
      workspaceId,
      expires
    });

    return sessionId;
  }

  validateSession(sessionId: string): { userId: string; workspaceId: string } | null {
    const session = this.sessionCache.get(sessionId);
    if (!session || session.expires < new Date()) {
      this.sessionCache.delete(sessionId);
      return null;
    }

    return {
      userId: session.userId,
      workspaceId: session.workspaceId
    };
  }

  destroySession(sessionId: string): void {
    this.sessionCache.delete(sessionId);
  }

  // UTILITY METHODS
  async getUserPermissions(userId: string, workspaceId: string): Promise<Permission[]> {
    const role = await this.getUserRole(userId, workspaceId);
    return role ? role.permissions : [];
  }

  async canAccessResource(userId: string, workspaceId: string, resource: string, action: string, context?: any): Promise<boolean> {
    const request: AccessRequest = {
      id: `req-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
      userId,
      workspaceId,
      resource,
      action,
      context: context || {},
      timestamp: new Date(),
      ipAddress: '127.0.0.1',
      userAgent: 'UltraAccessControl'
    };

    const result = await this.checkAccess(request);
    return result.allowed;
  }

  async getAccessStats(workspaceId: string): Promise<{
    totalRoles: number;
    customRoles: number;
    accessRules: number;
    securityPolicies: number;
    auditLogsLast24h: number;
    deniedAccessLast24h: number;
  }> {
    const roles = await this.getRolesByWorkspace(workspaceId);
    const rules = await this.getAccessRules(workspaceId);
    const policies = await this.getSecurityPolicies(workspaceId);
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const auditLogs = await this.getAuditLogs(workspaceId, {
      dateFrom: yesterday
    });

    return {
      totalRoles: roles.length,
      customRoles: roles.filter(r => !r.isSystem).length,
      accessRules: rules.length,
      securityPolicies: policies.length,
      auditLogsLast24h: auditLogs.length,
      deniedAccessLast24h: auditLogs.filter(l => l.result === 'denied').length
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    rolesCount: number;
    accessRulesCount: number;
    securityPoliciesCount: number;
    activeSessions: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (this.roles.size === 0) {
      issues.push('No roles found');
    }

    return {
      healthy: issues.length === 0,
      rolesCount: this.roles.size,
      accessRulesCount: Array.from(this.accessRules.values()).reduce((sum, rules) => sum + rules.length, 0),
      securityPoliciesCount: Array.from(this.securityPolicies.values()).reduce((sum, policies) => sum + policies.length, 0),
      activeSessions: this.sessionCache.size,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.sessionCache.clear();
    this.logger.info('access-control', 'Access control system shut down');
  }
}

export default UltraAccessControl;
