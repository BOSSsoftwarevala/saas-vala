import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { UltraNotificationSystem } from './notification-system';
import { Message, User, Workspace } from './slack-system';
import * as crypto from 'crypto';

export interface MessageEditPolicy {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  editTimeLimit: number; // minutes, 0 = unlimited
  deleteTimeLimit: number; // minutes, 0 = unlimited
  maxEdits: number; // 0 = unlimited
  requireReason: boolean;
  logEdits: boolean;
  notifyUsers: boolean;
  roles: {
    canEditOwn: string[]; // roles that can edit their own messages
    canEditOthers: string[]; // roles that can edit others' messages
    canDeleteOwn: string[]; // roles that can delete their own messages
    canDeleteOthers: string[]; // roles that can delete others' messages
    canBypassTimeLimit: string[]; // roles that can bypass time limits
  };
  channelTypes: {
    publicChannels: boolean;
    privateChannels: boolean;
    directMessages: boolean;
    groupMessages: boolean;
  };
  messageTypes: string[]; // which message types can be edited/deleted
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageEdit {
  id: string;
  messageId: string;
  workspaceId: string;
  userId: string;
  originalContent: string;
  editedContent: string;
  editReason?: string;
  editNumber: number; // 1, 2, 3, etc.
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface MessageDeletion {
  id: string;
  messageId: string;
  workspaceId: string;
  userId: string;
  deletedBy: string;
  originalContent: string;
  deletionReason?: string;
  isPermanent: boolean;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface MessageControlAnalytics {
  workspaceId: string;
  date: Date;
  totalEdits: number;
  totalDeletions: number;
  editsByUser: Record<string, number>;
  deletionsByUser: Record<string, number>;
  editsByChannel: Record<string, number>;
  deletionsByChannel: Record<string, number>;
  averageEditsPerMessage: number;
  editReasons: Record<string, number>;
  deletionReasons: Record<string, number>;
  timeToEdit: number; // average minutes from creation to first edit
  timeToDelete: number; // average minutes from creation to deletion
  policyViolations: number;
}

export class UltraMessageControl extends EventEmitter {
  private static instance: UltraMessageControl;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  private notificationSystem: UltraNotificationSystem;
  
  private policies: Map<string, Map<string, MessageEditPolicy>> = new Map(); // workspaceId -> policyId -> policy
  private messageEdits: Map<string, MessageEdit[]> = new Map(); // messageId -> edits
  private messageDeletions: Map<string, MessageDeletion> = new Map(); // messageId -> deletion

  static getInstance(): UltraMessageControl {
    if (!UltraMessageControl.instance) {
      UltraMessageControl.instance = new UltraMessageControl();
    }
    return UltraMessageControl.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.accessControl = UltraAccessControl.getInstance();
    this.notificationSystem = UltraNotificationSystem.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadPolicies();
      await this.loadMessageEdits();
      await this.loadMessageDeletions();
      
      this.logger.info('message-control', 'Message control system initialized', {
        policiesCount: Array.from(this.policies.values()).reduce((sum, policies) => sum + policies.length, 0),
        totalEditsCount: Array.from(this.messageEdits.values()).reduce((sum, edits) => sum + edits.length, 0),
        totalDeletionsCount: this.messageDeletions.size
      });
    } catch (error) {
      this.logger.error('message-control', 'Failed to initialize message control system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS message_edit_policies (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        edit_time_limit INTEGER DEFAULT 15,
        delete_time_limit INTEGER DEFAULT 60,
        max_edits INTEGER DEFAULT 5,
        require_reason BOOLEAN DEFAULT FALSE,
        log_edits BOOLEAN DEFAULT TRUE,
        notify_users BOOLEAN DEFAULT FALSE,
        roles JSONB NOT NULL,
        channel_types JSONB NOT NULL,
        message_types TEXT[] NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS message_edits (
        id VARCHAR(255) PRIMARY KEY,
        message_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        original_content TEXT NOT NULL,
        edited_content TEXT NOT NULL,
        edit_reason TEXT,
        edit_number INTEGER NOT NULL,
        ip_address INET,
        user_agent TEXT,
        metadata JSONB NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS message_deletions (
        id VARCHAR(255) PRIMARY KEY,
        message_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        deleted_by VARCHAR(255) NOT NULL,
        original_content TEXT NOT NULL,
        deletion_reason TEXT,
        is_permanent BOOLEAN DEFAULT TRUE,
        ip_address INET,
        user_agent TEXT,
        metadata JSONB NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS message_control_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_edits INTEGER DEFAULT 0,
        total_deletions INTEGER DEFAULT 0,
        edits_by_user JSONB NOT NULL,
        deletions_by_user JSONB NOT NULL,
        edits_by_channel JSONB NOT NULL,
        deletions_by_channel JSONB NOT NULL,
        average_edits_per_message DECIMAL(8,2),
        edit_reasons JSONB NOT NULL,
        deletion_reasons JSONB NOT NULL,
        time_to_edit DECIMAL(8,2),
        time_to_delete DECIMAL(8,2),
        policy_violations INTEGER DEFAULT 0,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_message_edit_policies_workspace_id ON message_edit_policies(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_message_edits_message_id ON message_edits(message_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_message_edits_user_id ON message_edits(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_message_edits_timestamp ON message_edits(timestamp)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_message_deletions_message_id ON message_deletions(message_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_message_deletions_user_id ON message_deletions(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_message_deletions_timestamp ON message_deletions(timestamp)');
  }

  private async loadPolicies(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM message_edit_policies WHERE is_active = TRUE ORDER BY created_at DESC');
      
      for (const row of rows) {
        const policy: MessageEditPolicy = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          editTimeLimit: row.edit_time_limit,
          deleteTimeLimit: row.delete_time_limit,
          maxEdits: row.max_edits,
          requireReason: row.require_reason,
          logEdits: row.log_edits,
          notifyUsers: row.notify_users,
          roles: row.roles || {
            canEditOwn: ['user', 'support_agent', 'admin', 'super_admin'],
            canEditOthers: ['admin', 'super_admin'],
            canDeleteOwn: ['user', 'support_agent', 'admin', 'super_admin'],
            canDeleteOthers: ['admin', 'super_admin'],
            canBypassTimeLimit: ['admin', 'super_admin']
          },
          channelTypes: row.channel_types || {
            publicChannels: true,
            privateChannels: true,
            directMessages: true,
            groupMessages: true
          },
          messageTypes: row.message_types || ['text', 'file'],
          isActive: row.is_active,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.policies.has(policy.workspaceId)) {
          this.policies.set(policy.workspaceId, new Map());
        }
        this.policies.get(policy.workspaceId)!.set(policy.id, policy);
      }
      
      this.logger.info('message-control', `Loaded message edit policies for ${this.policies.size} workspaces`);
    } catch (error) {
      this.logger.error('message-control', 'Failed to load message edit policies', error as Error);
    }
  }

  private async loadMessageEdits(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM message_edits ORDER BY timestamp DESC LIMIT 50000');
      
      for (const row of rows) {
        const edit: MessageEdit = {
          id: row.id,
          messageId: row.message_id,
          workspaceId: row.workspace_id,
          userId: row.user_id,
          originalContent: row.original_content,
          editedContent: row.edited_content,
          editReason: row.edit_reason,
          editNumber: row.edit_number,
          ipAddress: row.ip_address,
          userAgent: row.user_agent,
          timestamp: row.timestamp,
          metadata: row.metadata || {}
        };
        
        if (!this.messageEdits.has(edit.messageId)) {
          this.messageEdits.set(edit.messageId, []);
        }
        this.messageEdits.get(edit.messageId)!.push(edit);
      }
      
      this.logger.info('message-control', `Loaded ${this.messageEdits.size} message edit histories`);
    } catch (error) {
      this.logger.error('message-control', 'Failed to load message edits', error as Error);
    }
  }

  private async loadMessageDeletions(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM message_deletions ORDER BY timestamp DESC LIMIT 50000');
      
      for (const row of rows) {
        const deletion: MessageDeletion = {
          id: row.id,
          messageId: row.message_id,
          workspaceId: row.workspace_id,
          userId: row.user_id,
          deletedBy: row.deleted_by,
          originalContent: row.original_content,
          deletionReason: row.deletion_reason,
          isPermanent: row.is_permanent,
          ipAddress: row.ip_address,
          userAgent: row.user_agent,
          timestamp: row.timestamp,
          metadata: row.metadata || {}
        };
        
        this.messageDeletions.set(deletion.messageId, deletion);
      }
      
      this.logger.info('message-control', `Loaded ${this.messageDeletions.size} message deletions`);
    } catch (error) {
      this.logger.error('message-control', 'Failed to load message deletions', error as Error);
    }
  }

  // PUBLIC API METHODS
  async createPolicy(config: {
    workspaceId: string;
    name: string;
    description?: string;
    editTimeLimit?: number;
    deleteTimeLimit?: number;
    maxEdits?: number;
    requireReason?: boolean;
    logEdits?: boolean;
    notifyUsers?: boolean;
    roles?: MessageEditPolicy['roles'];
    channelTypes?: MessageEditPolicy['channelTypes'];
    messageTypes?: string[];
    createdBy: string;
  }): Promise<string> {
    const policyId = `policy-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const policy: MessageEditPolicy = {
        id: policyId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        editTimeLimit: config.editTimeLimit || 15,
        deleteTimeLimit: config.deleteTimeLimit || 60,
        maxEdits: config.maxEdits || 5,
        requireReason: config.requireReason || false,
        logEdits: config.logEdits !== false,
        notifyUsers: config.notifyUsers || false,
        roles: config.roles || {
          canEditOwn: ['user', 'support_agent', 'admin', 'super_admin'],
          canEditOthers: ['admin', 'super_admin'],
          canDeleteOwn: ['user', 'support_agent', 'admin', 'super_admin'],
          canDeleteOthers: ['admin', 'super_admin'],
          canBypassTimeLimit: ['admin', 'super_admin']
        },
        channelTypes: config.channelTypes || {
          publicChannels: true,
          privateChannels: true,
          directMessages: true,
          groupMessages: true
        },
        messageTypes: config.messageTypes || ['text', 'file'],
        isActive: true,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO message_edit_policies (
          id, workspace_id, name, description, edit_time_limit, delete_time_limit,
          max_edits, require_reason, log_edits, notify_users, roles,
          channel_types, message_types, is_active, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        policy.id,
        policy.workspaceId,
        policy.name,
        policy.description,
        policy.editTimeLimit,
        policy.deleteTimeLimit,
        policy.maxEdits,
        policy.requireReason,
        policy.logEdits,
        policy.notifyUsers,
        JSON.stringify(policy.roles),
        JSON.stringify(policy.channelTypes),
        policy.messageTypes,
        policy.isActive,
        policy.createdBy,
        policy.createdAt,
        policy.updatedAt
      ]);
      
      if (!this.policies.has(policy.workspaceId)) {
        this.policies.set(policy.workspaceId, new Map());
      }
      this.policies.get(policy.workspaceId)!.set(policy.id, policy);
      
      this.emit('policyCreated', policy);
      return policyId;
      
    } catch (error) {
      this.logger.error('message-control', `Failed to create message edit policy: ${policyId}`, error as Error);
      throw error;
    }
  }

  async canEditMessage(messageId: string, userId: string, workspaceId: string): Promise<{
    canEdit: boolean;
    reason?: string;
    policy?: MessageEditPolicy;
  }> {
    try {
      // Get applicable policy
      const policy = await this.getApplicablePolicy(workspaceId);
      if (!policy) {
        return { canEdit: false, reason: 'No edit policy configured' };
      }
      
      // Get message details
      const message = await this.getMessage(messageId);
      if (!message) {
        return { canEdit: false, reason: 'Message not found' };
      }
      
      // Check if message type is editable
      if (!policy.messageTypes.includes(message.type)) {
        return { canEdit: false, reason: 'Message type cannot be edited', policy };
      }
      
      // Check channel type permissions
      const channelTypeAllowed = await this.checkChannelTypePermission(policy, message.channelId);
      if (!channelTypeAllowed) {
        return { canEdit: false, reason: 'Channel type does not allow editing', policy };
      }
      
      // Get user role
      const userRole = await this.accessControl.getUserRole(userId, workspaceId);
      if (!userRole) {
        return { canEdit: false, reason: 'User role not found', policy };
      }
      
      // Check if user can edit this message
      const canEditOwn = policy.roles.canEditOwn.includes(userRole);
      const canEditOthers = policy.roles.canEditOthers.includes(userRole);
      
      const isOwnMessage = message.userId === userId;
      
      if (!isOwnMessage && !canEditOthers) {
        return { canEdit: false, reason: 'Cannot edit other users\' messages', policy };
      }
      
      if (isOwnMessage && !canEditOwn) {
        return { canEdit: false, reason: 'Cannot edit own messages', policy };
      }
      
      // Check time limit
      const canBypassTimeLimit = policy.roles.canBypassTimeLimit.includes(userRole);
      if (!canBypassTimeLimit && policy.editTimeLimit > 0) {
        const timeSinceCreation = (Date.now() - message.createdAt.getTime()) / (1000 * 60);
        if (timeSinceCreation > policy.editTimeLimit) {
          return { canEdit: false, reason: `Edit time limit of ${policy.editTimeLimit} minutes exceeded`, policy };
        }
      }
      
      // Check max edits limit
      if (policy.maxEdits > 0) {
        const existingEdits = this.messageEdits.get(messageId) || [];
        if (existingEdits.length >= policy.maxEdits) {
          return { canEdit: false, reason: `Maximum edit limit of ${policy.maxEdits} exceeded`, policy };
        }
      }
      
      return { canEdit: true, policy };
      
    } catch (error) {
      this.logger.error('message-control', 'Failed to check edit permissions', error as Error);
      return { canEdit: false, reason: 'Error checking permissions' };
    }
  }

  async editMessage(config: {
    messageId: string;
    userId: string;
    workspaceId: string;
    newContent: string;
    editReason?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    success: boolean;
    editId?: string;
    reason?: string;
  }> {
    try {
      // Check edit permissions
      const permissionCheck = await this.canEditMessage(config.messageId, config.userId, config.workspaceId);
      if (!permissionCheck.canEdit) {
        return { success: false, reason: permissionCheck.reason };
      }
      
      const policy = permissionCheck.policy!;
      
      // Check if reason is required
      if (policy.requireReason && !config.editReason) {
        return { success: false, reason: 'Edit reason is required' };
      }
      
      // Get current message
      const message = await this.getMessage(config.messageId);
      if (!message) {
        return { success: false, reason: 'Message not found' };
      }
      
      // Create edit record
      const editId = `edit-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const existingEdits = this.messageEdits.get(config.messageId) || [];
      const editNumber = existingEdits.length + 1;
      
      const edit: MessageEdit = {
        id: editId,
        messageId: config.messageId,
        workspaceId: config.workspaceId,
        userId: config.userId,
        originalContent: message.content,
        editedContent: config.newContent,
        editReason: config.editReason,
        editNumber,
        ipAddress: config.ipAddress,
        userAgent: config.userAgent,
        timestamp: new Date(),
        metadata: config.metadata || {}
      };
      
      // Save edit to database
      await this.database.query(`
        INSERT INTO message_edits (
          id, message_id, workspace_id, user_id, original_content, edited_content,
          edit_reason, edit_number, ip_address, user_agent, metadata, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        edit.id,
        edit.messageId,
        edit.workspaceId,
        edit.userId,
        edit.originalContent,
        edit.editedContent,
        edit.editReason,
        edit.editNumber,
        edit.ipAddress,
        edit.userAgent,
        JSON.stringify(edit.metadata),
        edit.timestamp
      ]);
      
      // Update message content
      await this.database.query(
        'UPDATE messages SET content = $1, updated_at = NOW() WHERE id = $2',
        [config.newContent, config.messageId]
      );
      
      // Update local cache
      if (!this.messageEdits.has(config.messageId)) {
        this.messageEdits.set(config.messageId, []);
      }
      this.messageEdits.get(config.messageId)!.push(edit);
      
      // Log edit if required
      if (policy.logEdits) {
        this.logger.info('message-control', `Message edited: ${config.messageId}`, {
          userId: config.userId,
          editNumber,
          reason: config.editReason
        });
      }
      
      // Notify users if required
      if (policy.notifyUsers) {
        await this.notifyMessageEdit(edit, message);
      }
      
      this.emit('messageEdited', edit);
      return { success: true, editId: edit.id };
      
    } catch (error) {
      this.logger.error('message-control', 'Failed to edit message', error as Error);
      return { success: false, reason: 'Internal error' };
    }
  }

  async canDeleteMessage(messageId: string, userId: string, workspaceId: string): Promise<{
    canDelete: boolean;
    reason?: string;
    policy?: MessageEditPolicy;
  }> {
    try {
      // Get applicable policy
      const policy = await this.getApplicablePolicy(workspaceId);
      if (!policy) {
        return { canDelete: false, reason: 'No delete policy configured' };
      }
      
      // Get message details
      const message = await this.getMessage(messageId);
      if (!message) {
        return { canDelete: false, reason: 'Message not found' };
      }
      
      // Check if message type is deletable
      if (!policy.messageTypes.includes(message.type)) {
        return { canDelete: false, reason: 'Message type cannot be deleted', policy };
      }
      
      // Check channel type permissions
      const channelTypeAllowed = await this.checkChannelTypePermission(policy, message.channelId);
      if (!channelTypeAllowed) {
        return { canDelete: false, reason: 'Channel type does not allow deletion', policy };
      }
      
      // Get user role
      const userRole = await this.accessControl.getUserRole(userId, workspaceId);
      if (!userRole) {
        return { canDelete: false, reason: 'User role not found', policy };
      }
      
      // Check if user can delete this message
      const canDeleteOwn = policy.roles.canDeleteOwn.includes(userRole);
      const canDeleteOthers = policy.roles.canDeleteOthers.includes(userRole);
      
      const isOwnMessage = message.userId === userId;
      
      if (!isOwnMessage && !canDeleteOthers) {
        return { canDelete: false, reason: 'Cannot delete other users\' messages', policy };
      }
      
      if (isOwnMessage && !canDeleteOwn) {
        return { canDelete: false, reason: 'Cannot delete own messages', policy };
      }
      
      // Check time limit
      const canBypassTimeLimit = policy.roles.canBypassTimeLimit.includes(userRole);
      if (!canBypassTimeLimit && policy.deleteTimeLimit > 0) {
        const timeSinceCreation = (Date.now() - message.createdAt.getTime()) / (1000 * 60);
        if (timeSinceCreation > policy.deleteTimeLimit) {
          return { canDelete: false, reason: `Delete time limit of ${policy.deleteTimeLimit} minutes exceeded`, policy };
        }
      }
      
      return { canDelete: true, policy };
      
    } catch (error) {
      this.logger.error('message-control', 'Failed to check delete permissions', error as Error);
      return { canDelete: false, reason: 'Error checking permissions' };
    }
  }

  async deleteMessage(config: {
    messageId: string;
    userId: string;
    workspaceId: string;
    deletedBy: string;
    deletionReason?: string;
    isPermanent?: boolean;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    success: boolean;
    deletionId?: string;
    reason?: string;
  }> {
    try {
      // Check delete permissions
      const permissionCheck = await this.canDeleteMessage(config.messageId, config.deletedBy, config.workspaceId);
      if (!permissionCheck.canDelete) {
        return { success: false, reason: permissionCheck.reason };
      }
      
      const policy = permissionCheck.policy!;
      
      // Get current message
      const message = await this.getMessage(config.messageId);
      if (!message) {
        return { success: false, reason: 'Message not found' };
      }
      
      // Create deletion record
      const deletionId = `delete-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      
      const deletion: MessageDeletion = {
        id: deletionId,
        messageId: config.messageId,
        workspaceId: config.workspaceId,
        userId: config.userId,
        deletedBy: config.deletedBy,
        originalContent: message.content,
        deletionReason: config.deletionReason,
        isPermanent: config.isPermanent !== false,
        ipAddress: config.ipAddress,
        userAgent: config.userAgent,
        timestamp: new Date(),
        metadata: config.metadata || {}
      };
      
      // Save deletion to database
      await this.database.query(`
        INSERT INTO message_deletions (
          id, message_id, workspace_id, user_id, deleted_by, original_content,
          deletion_reason, is_permanent, ip_address, user_agent, metadata, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        deletion.id,
        deletion.messageId,
        deletion.workspaceId,
        deletion.userId,
        deletion.deletedBy,
        deletion.originalContent,
        deletion.deletionReason,
        deletion.isPermanent,
        deletion.ipAddress,
        deletion.userAgent,
        JSON.stringify(deletion.metadata),
        deletion.timestamp
      ]);
      
      // Update message status (soft delete) or remove permanently
      if (deletion.isPermanent) {
        await this.database.query('DELETE FROM messages WHERE id = $1', [config.messageId]);
      } else {
        await this.database.query(
          'UPDATE messages SET content = \'[Message deleted]\', deleted = TRUE, updated_at = NOW() WHERE id = $1',
          [config.messageId]
        );
      }
      
      // Update local cache
      this.messageDeletions.set(config.messageId, deletion);
      
      // Log deletion if required
      if (policy.logEdits) {
        this.logger.info('message-control', `Message deleted: ${config.messageId}`, {
          userId: config.deletedBy,
          originalUserId: config.userId,
          reason: config.deletionReason,
          permanent: deletion.isPermanent
        });
      }
      
      // Notify users if required
      if (policy.notifyUsers) {
        await this.notifyMessageDeletion(deletion, message);
      }
      
      this.emit('messageDeleted', deletion);
      return { success: true, deletionId: deletion.id };
      
    } catch (error) {
      this.logger.error('message-control', 'Failed to delete message', error as Error);
      return { success: false, reason: 'Internal error' };
    }
  }

  private async getApplicablePolicy(workspaceId: string): Promise<MessageEditPolicy | null> {
    const workspacePolicies = this.policies.get(workspaceId);
    if (!workspacePolicies || workspacePolicies.size === 0) {
      return null;
    }
    
    // Return the first active policy (could be enhanced to prioritize by some criteria)
    return Array.from(workspacePolicies.values()).find(policy => policy.isActive) || null;
  }

  private async getMessage(messageId: string): Promise<Message | null> {
    try {
      const result = await this.database.query('SELECT * FROM messages WHERE id = $1', [messageId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        channelId: row.channel_id,
        userId: row.user_id,
        content: row.content,
        type: row.type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: row.metadata || {}
      };
      
    } catch (error) {
      this.logger.error('message-control', 'Failed to get message', error as Error);
      return null;
    }
  }

  private async checkChannelTypePermission(policy: MessageEditPolicy, channelId: string): Promise<boolean> {
    try {
      // Get channel details
      const result = await this.database.query('SELECT type FROM channels WHERE id = $1', [channelId]);
      
      if (result.rows.length === 0) {
        return false;
      }
      
      const channelType = result.rows[0].type;
      
      switch (channelType) {
        case 'public':
          return policy.channelTypes.publicChannels;
        case 'private':
          return policy.channelTypes.privateChannels;
        case 'direct':
          return policy.channelTypes.directMessages;
        case 'group':
          return policy.channelTypes.groupMessages;
        default:
          return false;
      }
      
    } catch (error) {
      this.logger.error('message-control', 'Failed to check channel type permission', error as Error);
      return false;
    }
  }

  private async notifyMessageEdit(edit: MessageEdit, originalMessage: Message): Promise<void> {
    try {
      // Get channel members to notify
      const members = await this.database.query(
        'SELECT user_id FROM channel_members WHERE channel_id = $1',
        [originalMessage.channelId]
      );
      
      for (const member of members.rows) {
        if (member.user_id !== edit.userId) { // Don't notify the editor
          await this.notificationSystem.createNotification({
            userId: member.user_id,
            workspaceId: edit.workspaceId,
            type: 'system',
            title: 'Message Edited',
            content: `A message in this channel was edited${edit.editReason ? ': ' + edit.editReason : ''}`,
            data: {
              messageId: edit.messageId,
              editId: edit.id,
              editNumber: edit.editNumber,
              editedBy: edit.userId
            },
            priority: 'low'
          });
        }
      }
      
    } catch (error) {
      this.logger.error('message-control', 'Failed to notify message edit', error as Error);
    }
  }

  private async notifyMessageDeletion(deletion: MessageDeletion, originalMessage: Message): Promise<void> {
    try {
      // Get channel members to notify
      const members = await this.database.query(
        'SELECT user_id FROM channel_members WHERE channel_id = $1',
        [originalMessage.channelId]
      );
      
      for (const member of members.rows) {
        if (member.user_id !== deletion.deletedBy) { // Don't notify the deleter
          await this.notificationSystem.createNotification({
            userId: member.user_id,
            workspaceId: deletion.workspaceId,
            type: 'system',
            title: 'Message Deleted',
            content: `A message in this channel was deleted${deletion.deletionReason ? ': ' + deletion.deletionReason : ''}`,
            data: {
              messageId: deletion.messageId,
              deletionId: deletion.id,
              deletedBy: deletion.deletedBy,
              originalUserId: deletion.userId
            },
            priority: 'low'
          });
        }
      }
      
    } catch (error) {
      this.logger.error('message-control', 'Failed to notify message deletion', error as Error);
    }
  }

  async getMessageEditHistory(messageId: string): Promise<MessageEdit[]> {
    return this.messageEdits.get(messageId) || [];
  }

  async getMessageDeletion(messageId: string): Promise<MessageDeletion | null> {
    return this.messageDeletions.get(messageId) || null;
  }

  async getAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<MessageControlAnalytics[]> {
    try {
      let sql = 'SELECT * FROM message_control_analytics WHERE workspace_id = $1';
      const params: any[] = [workspaceId];
      
      if (dateRange) {
        sql += ' AND date >= $2 AND date <= $3';
        params.push(dateRange.start, dateRange.end);
      }
      
      sql += ' ORDER BY date DESC';
      
      const rows = await this.database.query(sql, params);
      
      return rows.map(row => ({
        workspaceId: row.workspace_id,
        date: row.date,
        totalEdits: row.total_edits,
        totalDeletions: row.total_deletions,
        editsByUser: row.edits_by_user || {},
        deletionsByUser: row.deletions_by_user || {},
        editsByChannel: row.edits_by_channel || {},
        deletionsByChannel: row.deletions_by_channel || {},
        averageEditsPerMessage: parseFloat(row.average_edits_per_message) || 0,
        editReasons: row.edit_reasons || {},
        deletionReasons: row.deletion_reasons || {},
        timeToEdit: parseFloat(row.time_to_edit) || 0,
        timeToDelete: parseFloat(row.time_to_delete) || 0,
        policyViolations: row.policy_violations
      }));
      
    } catch (error) {
      this.logger.error('message-control', 'Failed to get analytics', error as Error);
      return [];
    }
  }

  async createDefaultPolicy(workspaceId: string, createdBy: string): Promise<string> {
    return this.createPolicy({
      workspaceId,
      name: 'Default Message Control',
      description: 'Default policy for message editing and deletion',
      editTimeLimit: 15,
      deleteTimeLimit: 60,
      maxEdits: 5,
      requireReason: false,
      logEdits: true,
      notifyUsers: false,
      messageTypes: ['text', 'file'],
      createdBy
    });
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    policiesCount: number;
    totalEditsCount: number;
    totalDeletionsCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    const policiesCount = Array.from(this.policies.values()).reduce((sum, policies) => sum + policies.length, 0);
    if (policiesCount === 0) {
      issues.push('No message control policies configured');
    }
    
    return {
      healthy: issues.length === 0,
      policiesCount,
      totalEditsCount: Array.from(this.messageEdits.values()).reduce((sum, edits) => sum + edits.length, 0),
      totalDeletionsCount: this.messageDeletions.size,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.logger.info('message-control', 'Message control system shut down');
  }
}

export default UltraMessageControl;
