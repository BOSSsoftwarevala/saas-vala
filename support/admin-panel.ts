import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraSlackSystem } from './slack-system';
import { UltraAccessControl } from './access-control';
import { UltraNotificationSystem } from './notification-system';
import { Message, Channel, DirectMessage, User, Workspace, Ticket } from './slack-system';
import * as crypto from 'crypto';

export interface ModerationAction {
  id: string;
  workspaceId: string;
  targetId: string; // messageId, userId, channelId
  targetType: 'message' | 'user' | 'channel';
  action: 'delete' | 'warn' | 'suspend' | 'ban' | 'mute' | 'unmute' | 'archive';
  reason: string;
  moderatorId: string;
  moderatorNote?: string;
  duration?: number; // minutes for temporary actions
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModerationRule {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  conditions: ModerationCondition[];
  actions: ModerationActionRule[];
  isActive: boolean;
  autoApply: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModerationCondition {
  type: 'keyword' | 'regex' | 'user_role' | 'message_frequency' | 'spam_score' | 'attachment_type' | 'link_domain';
  operator: 'contains' | 'equals' | 'matches' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  caseSensitive?: boolean;
}

export interface ModerationActionRule {
  type: 'delete_message' | 'warn_user' | 'mute_user' | 'suspend_user' | 'ban_user' | 'notify_admins' | 'create_ticket';
  parameters: any;
  delay?: number; // minutes before action
}

export interface ModerationQueue {
  id: string;
  workspaceId: string;
  type: 'message' | 'user' | 'channel';
  targetId: string;
  reason: string;
  severity: ModerationRule['severity'];
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  assignedTo?: string; // moderatorId
  reviewedBy?: string;
  reviewNote?: string;
  autoFlagged: boolean;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModerationReport {
  id: string;
  workspaceId: string;
  reporterId: string;
  targetId: string;
  targetType: 'message' | 'user' | 'channel';
  reason: string;
  description: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  assignedTo?: string;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModerationStats {
  workspaceId: string;
  date: Date;
  totalActions: number;
  actionsByType: Record<string, number>;
  actionsByModerator: Record<string, number>;
  autoFlaggedContent: number;
  userReports: number;
  resolvedReports: number;
  averageResolutionTime: number; // minutes
  activeModerators: number;
}

export interface ContentFilter {
  id: string;
  workspaceId: string;
  name: string;
  type: 'keyword' | 'regex' | 'ml_model';
  pattern: string;
  category: 'spam' | 'harassment' | 'inappropriate' | 'violence' | 'custom';
  severity: ModerationRule['severity'];
  isActive: boolean;
  matchCount: number;
  lastMatched?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UltraAdminPanel extends EventEmitter {
  private static instance: UltraAdminPanel;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private slackSystem: UltraSlackSystem;
  private accessControl: UltraAccessControl;
  private notificationSystem: UltraNotificationSystem;
  private moderationActions: Map<string, ModerationAction> = new Map();
  private moderationRules: Map<string, ModerationRule[]> = new Map(); // workspaceId -> rules
  private moderationQueue: Map<string, ModerationQueue> = new Map();
  moderationReports: Map<string, ModerationReport> = new Map();
  private contentFilters: Map<string, ContentFilter[]> = new Map(); // workspaceId -> filters
  private processingQueue = false;

  static getInstance(): UltraAdminPanel {
    if (!UltraAdminPanel.instance) {
      UltraAdminPanel.instance = new UltraAdminPanel();
    }
    return UltraAdminPanel.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.slackSystem = UltraSlackSystem.getInstance();
    this.accessControl = UltraAccessControl.getInstance();
    this.notificationSystem = UltraNotificationSystem.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadModerationActions();
      await this.loadModerationRules();
      await this.loadModerationQueue();
      await this.loadModerationReports();
      await this.loadContentFilters();
      this.startQueueProcessor();
      this.startExpirationChecker();
      
      this.logger.info('admin-panel', 'Admin panel initialized', {
        actionsCount: this.moderationActions.size,
        rulesCount: Array.from(this.moderationRules.values()).reduce((sum, rules) => sum + rules.length, 0),
        queueCount: this.moderationQueue.size,
        reportsCount: this.moderationReports.size,
        filtersCount: Array.from(this.contentFilters.values()).reduce((sum, filters) => sum + filters.length, 0)
      });
    } catch (error) {
      this.logger.error('admin-panel', 'Failed to initialize admin panel', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS moderation_actions (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        target_id VARCHAR(255) NOT NULL,
        target_type VARCHAR(20) NOT NULL,
        action VARCHAR(20) NOT NULL,
        reason TEXT NOT NULL,
        moderator_id VARCHAR(255) NOT NULL,
        moderator_note TEXT,
        duration INTEGER,
        is_active BOOLEAN DEFAULT TRUE,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS moderation_rules (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        conditions JSONB NOT NULL,
        actions JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        auto_apply BOOLEAN DEFAULT FALSE,
        severity VARCHAR(20) NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS moderation_queue (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        target_id VARCHAR(255) NOT NULL,
        reason TEXT NOT NULL,
        severity VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        assigned_to VARCHAR(255),
        reviewed_by VARCHAR(255),
        review_note TEXT,
        auto_flagged BOOLEAN DEFAULT FALSE,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS moderation_reports (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        reporter_id VARCHAR(255) NOT NULL,
        target_id VARCHAR(255) NOT NULL,
        target_type VARCHAR(20) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL,
        assigned_to VARCHAR(255),
        resolution TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS content_filters (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        pattern TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        match_count INTEGER DEFAULT 0,
        last_matched TIMESTAMP,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS moderation_stats (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_actions INTEGER DEFAULT 0,
        actions_by_type JSONB NOT NULL,
        actions_by_moderator JSONB NOT NULL,
        auto_flagged_content INTEGER DEFAULT 0,
        user_reports INTEGER DEFAULT 0,
        resolved_reports INTEGER DEFAULT 0,
        average_resolution_time DECIMAL(10,2),
        active_moderators INTEGER DEFAULT 0,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_moderation_actions_workspace_id ON moderation_actions(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_moderation_actions_target_id ON moderation_actions(target_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_moderation_actions_is_active ON moderation_actions(is_active)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_moderation_rules_workspace_id ON moderation_rules(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON moderation_queue(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_moderation_queue_workspace_id ON moderation_queue(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_moderation_reports_status ON moderation_reports(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_content_filters_workspace_id ON content_filters(workspace_id)');
  }

  private async loadModerationActions(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM moderation_actions WHERE is_active = TRUE');
      
      for (const row of rows) {
        const action: ModerationAction = {
          id: row.id,
          workspaceId: row.workspace_id,
          targetId: row.target_id,
          targetType: row.target_type,
          action: row.action,
          reason: row.reason,
          moderatorId: row.moderator_id,
          moderatorNote: row.moderator_note,
          duration: row.duration,
          isActive: row.is_active,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.moderationActions.set(action.id, action);
      }
      
      this.logger.info('admin-panel', `Loaded ${this.moderationActions.size} moderation actions`);
    } catch (error) {
      this.logger.error('admin-panel', 'Failed to load moderation actions', error as Error);
    }
  }

  private async loadModerationRules(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM moderation_rules WHERE is_active = TRUE');
      
      for (const row of rows) {
        const rule: ModerationRule = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          conditions: row.conditions || [],
          actions: row.actions || [],
          isActive: row.is_active,
          autoApply: row.auto_apply,
          severity: row.severity,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.moderationRules.has(rule.workspaceId)) {
          this.moderationRules.set(rule.workspaceId, []);
        }
        this.moderationRules.get(rule.workspaceId)!.push(rule);
      }
      
      this.logger.info('admin-panel', `Loaded moderation rules for ${this.moderationRules.size} workspaces`);
    } catch (error) {
      this.logger.error('admin-panel', 'Failed to load moderation rules', error as Error);
    }
  }

  private async loadModerationQueue(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM moderation_queue WHERE status IN (\'pending\', \'reviewing\') ORDER BY created_at ASC');
      
      for (const row of rows) {
        const queue: ModerationQueue = {
          id: row.id,
          workspaceId: row.workspace_id,
          type: row.type,
          targetId: row.target_id,
          reason: row.reason,
          severity: row.severity,
          status: row.status,
          assignedTo: row.assigned_to,
          reviewedBy: row.reviewed_by,
          reviewNote: row.review_note,
          autoFlagged: row.auto_flagged,
          metadata: row.metadata || {},
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.moderationQueue.set(queue.id, queue);
      }
      
      this.logger.info('admin-panel', `Loaded ${this.moderationQueue.size} queue items`);
    } catch (error) {
      this.logger.error('admin-panel', 'Failed to load moderation queue', error as Error);
    }
  }

  private async loadModerationReports(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM moderation_reports ORDER BY created_at DESC');
      
      for (const row of rows) {
        const report: ModerationReport = {
          id: row.id,
          workspaceId: row.workspace_id,
          reporterId: row.reporter_id,
          targetId: row.target_id,
          targetType: row.target_type,
          reason: row.reason,
          description: row.description,
          status: row.status,
          assignedTo: row.assigned_to,
          resolution: row.resolution,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.moderationReports.set(report.id, report);
      }
      
      this.logger.info('admin-panel', `Loaded ${this.moderationReports.size} moderation reports`);
    } catch (error) {
      this.logger.error('admin-panel', 'Failed to load moderation reports', error as Error);
    }
  }

  private async loadContentFilters(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM content_filters WHERE is_active = TRUE');
      
      for (const row of rows) {
        const filter: ContentFilter = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          type: row.type,
          pattern: row.pattern,
          category: row.category,
          severity: row.severity,
          isActive: row.is_active,
          matchCount: row.match_count,
          lastMatched: row.last_matched,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.contentFilters.has(filter.workspaceId)) {
          this.contentFilters.set(filter.workspaceId, []);
        }
        this.contentFilters.get(filter.workspaceId)!.push(filter);
      }
      
      this.logger.info('admin-panel', `Loaded content filters for ${this.contentFilters.size} workspaces`);
    } catch (error) {
      this.logger.error('admin-panel', 'Failed to load content filters', error as Error);
    }
  }

  private startQueueProcessor(): void {
    // Process moderation queue every 30 seconds
    setInterval(async () => {
      if (!this.processingQueue) {
        await this.processModerationQueue();
      }
    }, 30000);
  }

  private startExpirationChecker(): void {
    // Check for expired actions every 5 minutes
    setInterval(async () => {
      await this.checkExpiredActions();
    }, 5 * 60 * 1000);
  }

  private async processModerationQueue(): Promise<void> {
    this.processingQueue = true;
    
    try {
      const pendingItems = Array.from(this.moderationQueue.values())
        .filter(item => item.status === 'pending')
        .sort((a, b) => {
          // Sort by severity first, then by creation time
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          const aSeverity = severityOrder[a.severity] || 0;
          const bSeverity = severityOrder[b.severity] || 0;
          
          if (aSeverity !== bSeverity) {
            return bSeverity - aSeverity;
          }
          
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
      
      for (const item of pendingItems.slice(0, 10)) { // Process max 10 items per cycle
        await this.processQueueItem(item);
      }
      
    } catch (error) {
      this.logger.error('admin-panel', 'Failed to process moderation queue', error as Error);
    } finally {
      this.processingQueue = false;
    }
  }

  private async processQueueItem(item: ModerationQueue): Promise<void> {
    try {
      item.status = 'reviewing';
      await this.updateQueueItem(item);
      
      // Auto-apply rules if configured
      const rules = this.moderationRules.get(item.workspaceId) || [];
      const autoRules = rules.filter(r => r.autoApply && r.severity === item.severity);
      
      for (const rule of autoRules) {
        await this.applyModerationRule(rule, item);
      }
      
      // If no auto-apply, notify moderators
      if (autoRules.length === 0) {
        await this.notifyModerators(item);
      }
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to process queue item: ${item.id}`, error as Error);
    }
  }

  private async applyModerationRule(rule: ModerationRule, item: ModerationQueue): Promise<void> {
    try {
      for (const actionRule of rule.actions) {
        switch (actionRule.type) {
          case 'delete_message':
            if (item.type === 'message') {
              await this.deleteMessage(item.targetId, item.workspaceId, 'Auto-moderation', rule.id);
            }
            break;
          case 'warn_user':
            await this.warnUser(item.targetId, item.workspaceId, rule.name);
            break;
          case 'mute_user':
            await this.muteUser(item.targetId, item.workspaceId, actionRule.parameters.duration || 60, rule.name);
            break;
          case 'notify_admins':
            await this.notifyAdmins(item, rule.name);
            break;
          case 'create_ticket':
            await this.createModerationTicket(item, rule.name);
            break;
        }
      }
      
      item.status = 'resolved';
      await this.updateQueueItem(item);
      this.moderationQueue.delete(item.id);
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to apply moderation rule: ${rule.id}`, error as Error);
    }
  }

  private async notifyModerators(item: ModerationQueue): Promise<void> {
    try {
      // Get all moderators for the workspace
      const workspace = await this.slackSystem.getWorkspace(item.workspaceId);
      if (!workspace) return;
      
      const moderators = workspace.members.filter(m => 
        m.role === 'admin' || m.role === 'super_admin'
      );
      
      for (const moderator of moderators) {
        await this.notificationSystem.createNotification({
          userId: moderator.userId,
          workspaceId: item.workspaceId,
          type: 'system',
          title: 'Moderation Queue Item',
          content: `New ${item.severity} priority item requires review: ${item.reason}`,
          data: {
            queueItemId: item.id,
            type: item.type,
            targetId: item.targetId
          },
          priority: item.severity === 'critical' ? 'urgent' : 'high'
        });
      }
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to notify moderators: ${item.id}`, error as Error);
    }
  }

  private async notifyAdmins(item: ModerationQueue, ruleName: string): Promise<void> {
    try {
      const workspace = await this.slackSystem.getWorkspace(item.workspaceId);
      if (!workspace) return;
      
      const admins = workspace.members.filter(m => 
        m.role === 'admin' || m.role === 'super_admin'
      );
      
      for (const admin of admins) {
        await this.notificationSystem.createNotification({
          userId: admin.userId,
          workspaceId: item.workspaceId,
          type: 'system',
          title: 'Moderation Alert',
          content: `Rule "${ruleName}" triggered: ${item.reason}`,
          data: {
            ruleName,
            queueItemId: item.id,
            type: item.type,
            targetId: item.targetId
          },
          priority: 'high'
        });
      }
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to notify admins: ${item.id}`, error as Error);
    }
  }

  private async createModerationTicket(item: ModerationQueue, ruleName: string): Promise<void> {
    try {
      const ticketId = await this.slackSystem.createTicket({
        workspaceId: item.workspaceId,
        messageId: item.type === 'message' ? item.targetId : '',
        title: `Moderation: ${item.reason}`,
        description: `Auto-flagged by rule "${ruleName}". ${item.metadata.description || ''}`,
        category: 'moderation',
        priority: item.severity === 'critical' ? 'urgent' : item.severity,
        createdBy: 'system',
        tags: ['moderation', 'auto-flagged', item.type]
      });
      
      this.logger.info('admin-panel', `Moderation ticket created: ${ticketId}`, {
        queueItemId: item.id,
        ruleName
      });
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to create moderation ticket: ${item.id}`, error as Error);
    }
  }

  private async checkExpiredActions(): Promise<void> {
    try {
      const now = new Date();
      const expiredActions: string[] = [];
      
      for (const [actionId, action] of this.moderationActions.entries()) {
        if (action.expiresAt && action.expiresAt <= now && action.isActive) {
          expiredActions.push(actionId);
        }
      }
      
      for (const actionId of expiredActions) {
        await this.expireAction(actionId);
      }
      
      if (expiredActions.length > 0) {
        this.logger.info('admin-panel', `Expired ${expiredActions.length} moderation actions`);
      }
      
    } catch (error) {
      this.logger.error('admin-panel', 'Failed to check expired actions', error as Error);
    }
  }

  private async expireAction(actionId: string): Promise<void> {
    const action = this.moderationActions.get(actionId);
    if (!action) return;
    
    try {
      action.isActive = false;
      action.updatedAt = new Date();
      
      await this.database.query(`
        UPDATE moderation_actions 
        SET is_active = FALSE, updated_at = $1 
        WHERE id = $2
      `, [action.updatedAt, action.id]);
      
      // Handle specific action expiration
      switch (action.action) {
        case 'mute':
        case 'suspend':
        case 'ban':
          await this.restoreUserAccess(action.targetId, action.workspaceId, action.action);
          break;
      }
      
      this.emit('actionExpired', action);
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to expire action: ${actionId}`, error as Error);
    }
  }

  private async restoreUserAccess(userId: string, workspaceId: string, actionType: string): Promise<void> {
    try {
      // This would restore user access based on the action type
      // For now, just log the action
      this.logger.info('admin-panel', `User access restored: ${userId}`, {
        workspaceId,
        actionType
      });
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to restore user access: ${userId}`, error as Error);
    }
  }

  // PUBLIC API METHODS
  async createModerationAction(config: {
    workspaceId: string;
    targetId: string;
    targetType: ModerationAction['targetType'];
    action: ModerationAction['action'];
    reason: string;
    moderatorId: string;
    moderatorNote?: string;
    duration?: number;
  }): Promise<string> {
    const actionId = `action-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      // Check permissions
      const hasPermission = await this.accessControl.canAccessResource(
        config.moderatorId,
        config.workspaceId,
        'moderation',
        config.action
      );
      
      if (!hasPermission) {
        throw new Error('Insufficient permissions for moderation action');
      }
      
      const action: ModerationAction = {
        id: actionId,
        workspaceId: config.workspaceId,
        targetId: config.targetId,
        targetType: config.targetType,
        action: config.action,
        reason: config.reason,
        moderatorId: config.moderatorId,
        moderatorNote: config.moderatorNote,
        duration: config.duration,
        isActive: true,
        expiresAt: config.duration ? new Date(Date.now() + config.duration * 60 * 1000) : undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO moderation_actions (
          id, workspace_id, target_id, target_type, action, reason,
          moderator_id, moderator_note, duration, is_active, expires_at,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        action.id,
        action.workspaceId,
        action.targetId,
        action.targetType,
        action.action,
        action.reason,
        action.moderatorId,
        action.moderatorNote,
        action.duration,
        action.isActive,
        action.expiresAt,
        action.createdAt,
        action.updatedAt
      ]);
      
      this.moderationActions.set(actionId, action);
      
      // Execute the action
      await this.executeModerationAction(action);
      
      this.emit('actionCreated', action);
      return actionId;
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to create moderation action: ${actionId}`, error as Error);
      throw error;
    }
  }

  private async executeModerationAction(action: ModerationAction): Promise<void> {
    try {
      switch (action.action) {
        case 'delete':
          if (action.targetType === 'message') {
            await this.deleteMessage(action.targetId, action.workspaceId, action.reason, action.moderatorId);
          }
          break;
        case 'warn':
          await this.warnUser(action.targetId, action.workspaceId, action.reason);
          break;
        case 'mute':
          await this.muteUser(action.targetId, action.workspaceId, action.duration || 60, action.reason);
          break;
        case 'suspend':
          await this.suspendUser(action.targetId, action.workspaceId, action.duration || 1440, action.reason); // 24h default
          break;
        case 'ban':
          await this.banUser(action.targetId, action.workspaceId, action.reason);
          break;
        case 'archive':
          if (action.targetType === 'channel') {
            await this.archiveChannel(action.targetId, action.workspaceId, action.reason);
          }
          break;
      }
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to execute moderation action: ${action.id}`, error as Error);
    }
  }

  private async deleteMessage(messageId: string, workspaceId: string, reason: string, moderatorId?: string): Promise<void> {
    try {
      // This would delete the message from the slack system
      // For now, just log the action
      this.logger.info('admin-panel', `Message deleted: ${messageId}`, {
        workspaceId,
        reason,
        moderatorId
      });
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to delete message: ${messageId}`, error as Error);
    }
  }

  private async warnUser(userId: string, workspaceId: string, reason: string): Promise<void> {
    try {
      await this.notificationSystem.createNotification({
        userId,
        workspaceId,
        type: 'system',
        title: 'Warning',
        content: `You have received a warning: ${reason}`,
        data: { type: 'warning', reason },
        priority: 'high'
      });
      
      this.logger.info('admin-panel', `User warned: ${userId}`, {
        workspaceId,
        reason
      });
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to warn user: ${userId}`, error as Error);
    }
  }

  private async muteUser(userId: string, workspaceId: string, duration: number, reason: string): Promise<void> {
    try {
      // This would mute the user in the slack system
      // For now, just send notification
      await this.notificationSystem.createNotification({
        userId,
        workspaceId,
        type: 'system',
        title: 'You have been muted',
        content: `You have been muted for ${duration} minutes. Reason: ${reason}`,
        data: { type: 'mute', duration, reason },
        priority: 'high'
      });
      
      this.logger.info('admin-panel', `User muted: ${userId}`, {
        workspaceId,
        duration,
        reason
      });
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to mute user: ${userId}`, error as Error);
    }
  }

  private async suspendUser(userId: string, workspaceId: string, duration: number, reason: string): Promise<void> {
    try {
      // This would suspend the user in the slack system
      await this.notificationSystem.createNotification({
        userId,
        workspaceId,
        type: 'system',
        title: 'Account suspended',
        content: `Your account has been suspended for ${duration} minutes. Reason: ${reason}`,
        data: { type: 'suspend', duration, reason },
        priority: 'urgent'
      });
      
      this.logger.info('admin-panel', `User suspended: ${userId}`, {
        workspaceId,
        duration,
        reason
      });
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to suspend user: ${userId}`, error as Error);
    }
  }

  private async banUser(userId: string, workspaceId: string, reason: string): Promise<void> {
    try {
      // This would ban the user from the workspace
      await this.notificationSystem.createNotification({
        userId,
        workspaceId,
        type: 'system',
        title: 'Account banned',
        content: `Your account has been banned. Reason: ${reason}`,
        data: { type: 'ban', reason },
        priority: 'urgent'
      });
      
      this.logger.info('admin-panel', `User banned: ${userId}`, {
        workspaceId,
        reason
      });
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to ban user: ${userId}`, error as Error);
    }
  }

  private async archiveChannel(channelId: string, workspaceId: string, reason: string): Promise<void> {
    try {
      // This would archive the channel in the slack system
      this.logger.info('admin-panel', `Channel archived: ${channelId}`, {
        workspaceId,
        reason
      });
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to archive channel: ${channelId}`, error as Error);
    }
  }

  async createModerationReport(config: {
    workspaceId: string;
    reporterId: string;
    targetId: string;
    targetType: ModerationReport['targetType'];
    reason: string;
    description?: string;
  }): Promise<string> {
    const reportId = `report-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const report: ModerationReport = {
        id: reportId,
        workspaceId: config.workspaceId,
        reporterId: config.reporterId,
        targetId: config.targetId,
        targetType: config.targetType,
        reason: config.reason,
        description: config.description,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO moderation_reports (
          id, workspace_id, reporter_id, target_id, target_type,
          reason, description, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        report.id,
        report.workspaceId,
        report.reporterId,
        report.targetId,
        report.targetType,
        report.reason,
        report.description,
        report.status,
        report.createdAt,
        report.updatedAt
      ]);
      
      this.moderationReports.set(reportId, report);
      
      // Notify moderators
      await this.notifyModerators({
        id: report.id,
        workspaceId: report.workspaceId,
        type: report.targetType,
        targetId: report.targetId,
        reason: `User report: ${report.reason}`,
        severity: 'medium',
        status: 'pending',
        autoFlagged: false,
        metadata: { description: report.description },
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
      } as ModerationQueue);
      
      this.emit('reportCreated', report);
      return reportId;
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to create moderation report: ${reportId}`, error as Error);
      throw error;
    }
  }

  async getContentFlag(message: Message): Promise<{
    flagged: boolean;
    rules: string[];
    severity: ModerationRule['severity'];
    reason: string;
  }> {
    try {
      const filters = this.contentFilters.get(message.workspaceId) || [];
      const matchedRules: string[] = [];
      let maxSeverity: ModerationRule['severity'] = 'low';
      const reasons: string[] = [];
      
      for (const filter of filters) {
        if (this.matchesFilter(filter, message)) {
          matchedRules.push(filter.name);
          reasons.push(filter.name);
          
          // Update filter match count
          filter.matchCount++;
          filter.lastMatched = new Date();
          await this.updateContentFilter(filter);
          
          // Update severity if this filter is more severe
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          if (severityOrder[filter.severity] > severityOrder[maxSeverity]) {
            maxSeverity = filter.severity;
          }
        }
      }
      
      if (matchedRules.length > 0) {
        // Add to moderation queue
        await this.addToQueue({
          workspaceId: message.workspaceId,
          type: 'message',
          targetId: message.id,
          reason: `Content flagged: ${reasons.join(', ')}`,
          severity: maxSeverity,
          autoFlagged: true,
          metadata: {
            content: message.content,
            senderId: message.senderId,
            matchedRules
          }
        });
      }
      
      return {
        flagged: matchedRules.length > 0,
        rules: matchedRules,
        severity: maxSeverity,
        reason: reasons.join(', ')
      };
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to check content flag: ${message.id}`, error as Error);
      return {
        flagged: false,
        rules: [],
        severity: 'low',
        reason: ''
      };
    }
  }

  private matchesFilter(filter: ContentFilter, message: Message): boolean {
    try {
      const content = message.content.toLowerCase();
      const pattern = filter.pattern.toLowerCase();
      
      switch (filter.type) {
        case 'keyword':
          return content.includes(pattern);
        case 'regex':
          const regex = new RegExp(filter.pattern, filter.caseSensitive ? 'g' : 'gi');
          return regex.test(message.content);
        default:
          return false;
      }
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to match filter: ${filter.id}`, error as Error);
      return false;
    }
  }

  private async updateContentFilter(filter: ContentFilter): Promise<void> {
    try {
      await this.database.query(`
        UPDATE content_filters 
        SET match_count = $1, last_matched = $2, updated_at = $3 
        WHERE id = $4
      `, [filter.matchCount, filter.lastMatched, new Date(), filter.id]);
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to update content filter: ${filter.id}`, error as Error);
    }
  }

  private async addToQueue(config: {
    workspaceId: string;
    type: ModerationQueue['type'];
    targetId: string;
    reason: string;
    severity: ModerationRule['severity'];
    autoFlagged: boolean;
    metadata: any;
  }): Promise<string> {
    const queueId = `queue-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const queue: ModerationQueue = {
        id: queueId,
        workspaceId: config.workspaceId,
        type: config.type,
        targetId: config.targetId,
        reason: config.reason,
        severity: config.severity,
        status: 'pending',
        autoFlagged: config.autoFlagged,
        metadata: config.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO moderation_queue (
          id, workspace_id, type, target_id, reason, severity,
          status, auto_flagged, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        queue.id,
        queue.workspaceId,
        queue.type,
        queue.targetId,
        queue.reason,
        queue.severity,
        queue.status,
        queue.autoFlagged,
        JSON.stringify(queue.metadata),
        queue.createdAt,
        queue.updatedAt
      ]);
      
      this.moderationQueue.set(queueId, queue);
      
      this.emit('addedToQueue', queue);
      return queueId;
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to add to moderation queue: ${queueId}`, error as Error);
      throw error;
    }
  }

  private async updateQueueItem(item: ModerationQueue): Promise<void> {
    await this.database.query(`
      UPDATE moderation_queue 
      SET status = $1, assigned_to = $2, reviewed_by = $3, review_note = $4, updated_at = $5
      WHERE id = $6
    `, [
      item.status,
      item.assignedTo,
      item.reviewedBy,
      item.reviewNote,
      item.updatedAt,
      item.id
    ]);
  }

  // DASHBOARD METHODS
  async getModerationStats(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<ModerationStats[]> {
    try {
      let sql = 'SELECT * FROM moderation_stats WHERE workspace_id = $1';
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
        totalActions: row.total_actions,
        actionsByType: row.actions_by_type || {},
        actionsByModerator: row.actions_by_moderator || {},
        autoFlaggedContent: row.auto_flagged_content,
        userReports: row.user_reports,
        resolvedReports: row.resolved_reports,
        averageResolutionTime: parseFloat(row.average_resolution_time) || 0,
        activeModerators: row.active_moderators
      }));
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to get moderation stats: ${workspaceId}`, error as Error);
      return [];
    }
  }

  async getModerationQueue(workspaceId: string, filters?: {
    status?: ModerationQueue['status'];
    severity?: ModerationRule['severity'];
    assignedTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModerationQueue[]> {
    try {
      let items = Array.from(this.moderationQueue.values())
        .filter(item => item.workspaceId === workspaceId);
      
      if (filters?.status) {
        items = items.filter(item => item.status === filters.status);
      }
      
      if (filters?.severity) {
        items = items.filter(item => item.severity === filters.severity);
      }
      
      if (filters?.assignedTo) {
        items = items.filter(item => item.assignedTo === filters.assignedTo);
      }
      
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      if (filters?.limit) {
        const start = filters.offset || 0;
        items = items.slice(start, start + filters.limit);
      }
      
      return items;
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to get moderation queue: ${workspaceId}`, error as Error);
      return [];
    }
  }

  async getModerationReports(workspaceId: string, filters?: {
    status?: ModerationReport['status'];
    targetType?: ModerationReport['targetType'];
    assignedTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModerationReport[]> {
    try {
      let reports = Array.from(this.moderationReports.values())
        .filter(report => report.workspaceId === workspaceId);
      
      if (filters?.status) {
        reports = reports.filter(report => report.status === filters.status);
      }
      
      if (filters?.targetType) {
        reports = reports.filter(report => report.targetType === filters.targetType);
      }
      
      if (filters?.assignedTo) {
        reports = reports.filter(report => report.assignedTo === filters.assignedTo);
      }
      
      reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      if (filters?.limit) {
        const start = filters.offset || 0;
        reports = reports.slice(start, start + filters.limit);
      }
      
      return reports;
      
    } catch (error) {
      this.logger.error('admin-panel', `Failed to get moderation reports: ${workspaceId}`, error as Error);
      return [];
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    actionsCount: number;
    queueCount: number;
    reportsCount: number;
    filtersCount: number;
    processingQueue: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (this.moderationQueue.size > 100) {
      issues.push('Large moderation queue backlog');
    }
    
    return {
      healthy: issues.length === 0,
      actionsCount: this.moderationActions.size,
      queueCount: this.moderationQueue.size,
      reportsCount: this.moderationReports.size,
      filtersCount: Array.from(this.contentFilters.values()).reduce((sum, filters) => sum + filters.length, 0),
      processingQueue: this.processingQueue,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.processingQueue = false;
    this.logger.info('admin-panel', 'Admin panel shut down');
  }
}

export default UltraAdminPanel;
