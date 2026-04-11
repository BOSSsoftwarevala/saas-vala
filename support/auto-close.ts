import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraNotificationSystem } from './notification-system';
import { UltraSmartQueue } from './smart-queue';
import { Message, User, Workspace } from './slack-system';
import * as crypto from 'crypto';

export interface AutoCloseRule {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  conditions: AutoCloseCondition[];
  timeoutHours: number;
  warningHours?: number; // Send warning before closing
  categories: string[];
  priorities: ('urgent' | 'high' | 'medium' | 'low')[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoCloseCondition {
  type: 'no_activity' | 'customer_resolved' | 'agent_resolved' | 'time_elapsed' | 'custom';
  parameters: {
    noActivityHours?: number;
    customerInactiveHours?: number;
    agentInactiveHours?: number;
    resolutionKeywords?: string[];
    customCondition?: string;
  };
  operator: 'AND' | 'OR';
}

export interface AutoCloseEvent {
  id: string;
  workspaceId: string;
  ruleId: string;
  ticketId?: string;
  messageId?: string;
  channelId?: string;
  userId: string;
  status: 'pending' | 'warning_sent' | 'closed' | 'reopened' | 'cancelled';
  triggerReason: string;
  originalTimeout: Date;
  warningSentAt?: Date;
  closedAt?: Date;
  reopenedAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface ReopenRequest {
  id: string;
  workspaceId: string;
  closedEventId: string;
  ticketId?: string;
  messageId?: string;
  userId: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  expiresAt: Date;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface AutoCloseAnalytics {
  workspaceId: string;
  date: Date;
  totalClosed: number;
  closedByCategory: Record<string, number>;
  closedByPriority: Record<string, number>;
  averageTimeToClose: number; // hours
  reopenedCount: number;
  reopenRate: number; // percentage
  warningsSent: number;
  customerSatisfactionImpact: number; // 1-5
  agentWorkloadReduction: number; // percentage
}

export class UltraAutoClose extends EventEmitter {
  private static instance: UltraAutoClose;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private notificationSystem: UltraNotificationSystem;
  private smartQueue: UltraSmartQueue;
  
  private rules: Map<string, AutoCloseRule[]> = new Map(); // workspaceId -> rules
  private activeEvents: Map<string, AutoCloseEvent> = new Map();
  private reopenRequests: Map<string, ReopenRequest> = new Map();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout;

  static getInstance(): UltraAutoClose {
    if (!UltraAutoClose.instance) {
      UltraAutoClose.instance = new UltraAutoClose();
    }
    return UltraAutoClose.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.notificationSystem = UltraNotificationSystem.getInstance();
    this.smartQueue = UltraSmartQueue.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadRules();
      await this.loadActiveEvents();
      await this.loadReopenRequests();
      this.startAutoCloseProcessing();
      
      this.logger.info('auto-close', 'Auto-close system initialized', {
        rulesCount: Array.from(this.rules.values()).reduce((sum, rules) => sum + rules.length, 0),
        activeEventsCount: this.activeEvents.size,
        reopenRequestsCount: this.reopenRequests.size
      });
    } catch (error) {
      this.logger.error('auto-close', 'Failed to initialize auto-close system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS auto_close_rules (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        conditions JSONB NOT NULL,
        timeout_hours INTEGER NOT NULL,
        warning_hours INTEGER,
        categories TEXT[] NOT NULL,
        priorities TEXT[] NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS auto_close_events (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        rule_id VARCHAR(255) NOT NULL,
        ticket_id VARCHAR(255),
        message_id VARCHAR(255),
        channel_id VARCHAR(255),
        user_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        trigger_reason TEXT NOT NULL,
        original_timeout TIMESTAMP NOT NULL,
        warning_sent_at TIMESTAMP,
        closed_at TIMESTAMP,
        reopened_at TIMESTAMP,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS reopen_requests (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        closed_event_id VARCHAR(255) NOT NULL,
        ticket_id VARCHAR(255),
        message_id VARCHAR(255),
        user_id VARCHAR(255) NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(20) NOT NULL,
        requested_by VARCHAR(255) NOT NULL,
        approved_by VARCHAR(255),
        approved_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS auto_close_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_closed INTEGER DEFAULT 0,
        closed_by_category JSONB NOT NULL,
        closed_by_priority JSONB NOT NULL,
        average_time_to_close DECIMAL(8,2),
        reopened_count INTEGER DEFAULT 0,
        reopen_rate DECIMAL(5,2),
        warnings_sent INTEGER DEFAULT 0,
        customer_satisfaction_impact DECIMAL(3,2),
        agent_workload_reduction DECIMAL(5,2),
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_auto_close_rules_workspace_id ON auto_close_rules(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_auto_close_events_workspace_id ON auto_close_events(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_auto_close_events_status ON auto_close_events(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_auto_close_events_original_timeout ON auto_close_events(original_timeout)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_reopen_requests_status ON reopen_requests(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_reopen_requests_expires_at ON reopen_requests(expires_at)');
  }

  private async loadRules(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM auto_close_rules WHERE is_active = TRUE ORDER BY created_at DESC');
      
      for (const row of rows) {
        const rule: AutoCloseRule = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          conditions: row.conditions || [],
          timeoutHours: row.timeout_hours,
          warningHours: row.warning_hours,
          categories: row.categories || [],
          priorities: row.priorities || [],
          isActive: row.is_active,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.rules.has(rule.workspaceId)) {
          this.rules.set(rule.workspaceId, []);
        }
        this.rules.get(rule.workspaceId)!.push(rule);
      }
      
      this.logger.info('auto-close', `Loaded auto-close rules for ${this.rules.size} workspaces`);
    } catch (error) {
      this.logger.error('auto-close', 'Failed to load auto-close rules', error as Error);
    }
  }

  private async loadActiveEvents(): Promise<void> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM auto_close_events WHERE status IN (\'pending\', \'warning_sent\') ORDER BY created_at DESC LIMIT 10000'
      );
      
      for (const row of rows) {
        const event: AutoCloseEvent = {
          id: row.id,
          workspaceId: row.workspace_id,
          ruleId: row.rule_id,
          ticketId: row.ticket_id,
          messageId: row.message_id,
          channelId: row.channel_id,
          userId: row.user_id,
          status: row.status,
          triggerReason: row.trigger_reason,
          originalTimeout: row.original_timeout,
          warningSentAt: row.warning_sent_at,
          closedAt: row.closed_at,
          reopenedAt: row.reopened_at,
          metadata: row.metadata || {},
          createdAt: row.created_at
        };
        
        this.activeEvents.set(event.id, event);
      }
      
      this.logger.info('auto-close', `Loaded ${this.activeEvents.size} active auto-close events`);
    } catch (error) {
      this.logger.error('auto-close', 'Failed to load active auto-close events', error as Error);
    }
  }

  private async loadReopenRequests(): Promise<void> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM reopen_requests WHERE status IN (\'pending\', \'approved\') ORDER BY created_at DESC LIMIT 1000'
      );
      
      for (const row of rows) {
        const request: ReopenRequest = {
          id: row.id,
          workspaceId: row.workspace_id,
          closedEventId: row.closed_event_id,
          ticketId: row.ticket_id,
          messageId: row.message_id,
          userId: row.user_id,
          reason: row.reason,
          status: row.status,
          requestedBy: row.requested_by,
          approvedBy: row.approved_by,
          approvedAt: row.approved_at,
          expiresAt: row.expires_at,
          metadata: row.metadata || {},
          createdAt: row.created_at
        };
        
        this.reopenRequests.set(request.id, request);
      }
      
      this.logger.info('auto-close', `Loaded ${this.reopenRequests.size} reopen requests`);
    } catch (error) {
      this.logger.error('auto-close', 'Failed to load reopen requests', error as Error);
    }
  }

  private startAutoCloseProcessing(): void {
    this.isProcessing = true;
    
    // Process auto-close every 5 minutes
    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) {
        await this.processAutoCloseEvents();
        await this.processReopenRequests();
      }
    }, 5 * 60 * 1000);
  }

  // PUBLIC API METHODS
  async createAutoCloseRule(config: {
    workspaceId: string;
    name: string;
    description?: string;
    conditions: AutoCloseCondition[];
    timeoutHours: number;
    warningHours?: number;
    categories: string[];
    priorities: AutoCloseRule['priorities'];
    createdBy: string;
  }): Promise<string> {
    const ruleId = `rule-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const rule: AutoCloseRule = {
        id: ruleId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        conditions: config.conditions,
        timeoutHours: config.timeoutHours,
        warningHours: config.warningHours,
        categories: config.categories,
        priorities: config.priorities,
        isActive: true,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO auto_close_rules (
          id, workspace_id, name, description, conditions, timeout_hours, warning_hours,
          categories, priorities, is_active, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        rule.id,
        rule.workspaceId,
        rule.name,
        rule.description,
        JSON.stringify(rule.conditions),
        rule.timeoutHours,
        rule.warningHours,
        rule.categories,
        rule.priorities,
        rule.isActive,
        rule.createdBy,
        rule.createdAt,
        rule.updatedAt
      ]);
      
      if (!this.rules.has(rule.workspaceId)) {
        this.rules.set(rule.workspaceId, []);
      }
      this.rules.get(rule.workspaceId)!.push(rule);
      
      this.emit('ruleCreated', rule);
      return ruleId;
      
    } catch (error) {
      this.logger.error('auto-close', `Failed to create auto-close rule: ${ruleId}`, error as Error);
      throw error;
    }
  }

  async initiateAutoClose(config: {
    workspaceId: string;
    ticketId?: string;
    messageId?: string;
    channelId?: string;
    userId: string;
    category: string;
    priority: AutoCloseRule['priorities'][number];
    lastActivity: Date;
  }): Promise<string> {
    const eventId = `event-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      // Find applicable rule
      const applicableRule = await this.findApplicableRule(
        config.workspaceId,
        config.category,
        config.priority
      );
      
      if (!applicableRule) {
        this.logger.debug('auto-close', `No applicable auto-close rule found for category: ${config.category}`);
        return '';
      }
      
      const event: AutoCloseEvent = {
        id: eventId,
        workspaceId: config.workspaceId,
        ruleId: applicableRule.id,
        ticketId: config.ticketId,
        messageId: config.messageId,
        channelId: config.channelId,
        userId: config.userId,
        status: 'pending',
        triggerReason: 'Inactivity timeout',
        originalTimeout: new Date(Date.now() + applicableRule.timeoutHours * 60 * 60 * 1000),
        metadata: {
          category: config.category,
          priority: config.priority,
          lastActivity: config.lastActivity,
          ruleName: applicableRule.name
        },
        createdAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO auto_close_events (
          id, workspace_id, rule_id, ticket_id, message_id, channel_id, user_id,
          status, trigger_reason, original_timeout, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        event.id,
        event.workspaceId,
        event.ruleId,
        event.ticketId,
        event.messageId,
        event.channelId,
        event.userId,
        event.status,
        event.triggerReason,
        event.originalTimeout,
        JSON.stringify(event.metadata),
        event.createdAt
      ]);
      
      this.activeEvents.set(eventId, event);
      
      this.emit('autoCloseInitiated', event);
      this.logger.info('auto-close', `Auto-close initiated: ${eventId}`, {
        ticketId: config.ticketId,
        category: config.category,
        timeout: applicableRule.timeoutHours
      });
      
      return eventId;
      
    } catch (error) {
      this.logger.error('auto-close', `Failed to initiate auto-close: ${eventId}`, error as Error);
      throw error;
    }
  }

  async requestReopen(config: {
    workspaceId: string;
    closedEventId: string;
    ticketId?: string;
    messageId?: string;
    userId: string;
    reason: string;
    requestedBy: string;
  }): Promise<string> {
    const requestId = `reopen-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const request: ReopenRequest = {
        id: requestId,
        workspaceId: config.workspaceId,
        closedEventId: config.closedEventId,
        ticketId: config.ticketId,
        messageId: config.messageId,
        userId: config.userId,
        reason: config.reason,
        status: 'pending',
        requestedBy: config.requestedBy,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        metadata: {},
        createdAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO reopen_requests (
          id, workspace_id, closed_event_id, ticket_id, message_id, user_id,
          reason, status, requested_by, expires_at, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        request.id,
        request.workspaceId,
        request.closedEventId,
        request.ticketId,
        request.messageId,
        request.userId,
        request.reason,
        request.status,
        request.requestedBy,
        request.expiresAt,
        JSON.stringify(request.metadata),
        request.createdAt
      ]);
      
      this.reopenRequests.set(requestId, request);
      
      // Notify admins about reopen request
      await this.notifyReopenRequest(request);
      
      this.emit('reopenRequested', request);
      return requestId;
      
    } catch (error) {
      this.logger.error('auto-close', `Failed to request reopen: ${requestId}`, error as Error);
      throw error;
    }
  }

  async approveReopen(requestId: string, approvedBy: string): Promise<boolean> {
    try {
      const request = this.reopenRequests.get(requestId);
      if (!request) return false;
      
      if (request.status !== 'pending') {
        return false;
      }
      
      // Update request
      request.status = 'approved';
      request.approvedBy = approvedBy;
      request.approvedAt = new Date();
      
      await this.database.query(
        'UPDATE reopen_requests SET status = $1, approved_by = $2, approved_at = $3 WHERE id = $4',
        [request.status, request.approvedBy, request.approvedAt, request.id]
      );
      
      // Reopen the closed event
      await this.reopenClosedEvent(request.closedEventId);
      
      // Reopen ticket if exists
      if (request.ticketId) {
        await this.smartQueue.updateItemStatus(request.ticketId, 'waiting');
      }
      
      this.emit('reopenApproved', request);
      return true;
      
    } catch (error) {
      this.logger.error('auto-close', `Failed to approve reopen: ${requestId}`, error as Error);
      return false;
    }
  }

  async denyReopen(requestId: string, deniedBy: string): Promise<boolean> {
    try {
      const request = this.reopenRequests.get(requestId);
      if (!request) return false;
      
      if (request.status !== 'pending') {
        return false;
      }
      
      request.status = 'denied';
      
      await this.database.query(
        'UPDATE reopen_requests SET status = $1 WHERE id = $2',
        [request.status, request.id]
      );
      
      // Notify requester about denial
      await this.notifyReopenDenied(request, deniedBy);
      
      this.emit('reopenDenied', request);
      return true;
      
    } catch (error) {
      this.logger.error('auto-close', `Failed to deny reopen: ${requestId}`, error as Error);
      return false;
    }
  }

  private async findApplicableRule(
    workspaceId: string,
    category: string,
    priority: string
  ): Promise<AutoCloseRule | null> {
    try {
      const workspaceRules = this.rules.get(workspaceId) || [];
      
      return workspaceRules.find(rule => 
        rule.isActive &&
        rule.categories.includes(category) &&
        rule.priorities.includes(priority as any)
      ) || null;
      
    } catch (error) {
      this.logger.error('auto-close', 'Failed to find applicable rule', error as Error);
      return null;
    }
  }

  private async processAutoCloseEvents(): Promise<void> {
    try {
      const now = new Date();
      
      for (const [eventId, event] of this.activeEvents.entries()) {
        if (event.status !== 'pending' && event.status !== 'warning_sent') {
          continue;
        }
        
        const rule = await this.getRuleById(event.ruleId);
        if (!rule || !rule.isActive) {
          this.activeEvents.delete(eventId);
          continue;
        }
        
        // Check if conditions are met
        const conditionsMet = await this.evaluateCloseConditions(rule, event);
        
        if (!conditionsMet) {
          this.activeEvents.delete(eventId);
          continue;
        }
        
        // Check for warning
        if (rule.warningHours && event.status === 'pending') {
          const warningTime = new Date(event.originalTimeout.getTime() - rule.warningHours * 60 * 60 * 1000);
          
          if (now >= warningTime && now < event.originalTimeout) {
            await this.sendWarning(event, rule);
            continue;
          }
        }
        
        // Check for auto-close
        if (now >= event.originalTimeout) {
          await this.executeAutoClose(event, rule);
        }
      }
      
    } catch (error) {
      this.logger.error('auto-close', 'Failed to process auto-close events', error as Error);
    }
  }

  private async evaluateCloseConditions(rule: AutoCloseRule, event: AutoCloseEvent): Promise<boolean> {
    try {
      for (const condition of rule.conditions) {
        const conditionMet = await this.evaluateCondition(condition, event);
        
        if (condition.operator === 'OR' && conditionMet) {
          return true;
        }
        
        if (condition.operator === 'AND' && !conditionMet) {
          return false;
        }
      }
      
      return rule.conditions.length > 0 && rule.conditions[0].operator === 'AND';
      
    } catch (error) {
      this.logger.error('auto-close', 'Failed to evaluate close conditions', error as Error);
      return false;
    }
  }

  private async evaluateCondition(condition: AutoCloseCondition, event: AutoCloseEvent): Promise<boolean> {
    try {
      switch (condition.type) {
        case 'no_activity':
          if (condition.parameters.noActivityHours) {
            const lastActivity = event.metadata.lastActivity;
            if (!lastActivity) return false;
            
            const hoursSinceActivity = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60);
            return hoursSinceActivity >= condition.parameters.noActivityHours;
          }
          break;
          
        case 'time_elapsed':
          return Date.now() >= event.originalTimeout.getTime();
          
        case 'customer_resolved':
          // Would check for customer resolution indicators
          return false;
          
        case 'agent_resolved':
          // Would check for agent resolution indicators
          return false;
          
        default:
          return false;
      }
      
      return false;
      
    } catch (error) {
      this.logger.error('auto-close', 'Failed to evaluate condition', error as Error);
      return false;
    }
  }

  private async sendWarning(event: AutoCloseEvent, rule: AutoCloseRule): Promise<void> {
    try {
      // Send warning notification to user
      await this.notificationSystem.createNotification({
        userId: event.userId,
        workspaceId: event.workspaceId,
        type: 'system',
        title: 'Ticket Auto-Close Warning',
        content: `Your support ticket will be automatically closed in ${rule.warningHours} hours due to inactivity. Please reply if you need further assistance.`,
        data: {
          eventId: event.id,
          ticketId: event.ticketId,
          warningHours: rule.warningHours
        },
        priority: 'medium'
      });
      
      // Update event status
      event.status = 'warning_sent';
      event.warningSentAt = new Date();
      
      await this.database.query(
        'UPDATE auto_close_events SET status = $1, warning_sent_at = $2 WHERE id = $3',
        [event.status, event.warningSentAt, event.id]
      );
      
      this.emit('warningSent', event);
      
    } catch (error) {
      this.logger.error('auto-close', 'Failed to send warning', error as Error);
    }
  }

  private async executeAutoClose(event: AutoCloseEvent, rule: AutoCloseRule): Promise<void> {
    try {
      // Close ticket if exists
      if (event.ticketId) {
        await this.smartQueue.updateItemStatus(event.ticketId, 'closed');
      }
      
      // Send closure notification
      await this.notificationSystem.createNotification({
        userId: event.userId,
        workspaceId: event.workspaceId,
        type: 'system',
        title: 'Ticket Automatically Closed',
        content: `Your support ticket has been automatically closed due to inactivity. You can request to reopen it if needed.`,
        data: {
          eventId: event.id,
          ticketId: event.ticketId,
          closedAt: new Date()
        },
        priority: 'low'
      });
      
      // Update event status
      event.status = 'closed';
      event.closedAt = new Date();
      
      await this.database.query(
        'UPDATE auto_close_events SET status = $1, closed_at = $2 WHERE id = $3',
        [event.status, event.closedAt, event.id]
      );
      
      this.activeEvents.delete(event.id);
      
      this.emit('autoClosed', event);
      this.logger.info('auto-close', `Auto-close executed: ${event.id}`, {
        ticketId: event.ticketId,
        closedAt: event.closedAt
      });
      
    } catch (error) {
      this.logger.error('auto-close', 'Failed to execute auto-close', error as Error);
    }
  }

  private async processReopenRequests(): Promise<void> {
    try {
      const now = new Date();
      
      for (const [requestId, request] of this.reopenRequests.entries()) {
        if (request.status !== 'pending') {
          continue;
        }
        
        // Check if request has expired
        if (now >= request.expiresAt) {
          request.status = 'expired';
          
          await this.database.query(
            'UPDATE reopen_requests SET status = $1 WHERE id = $2',
            [request.status, request.id]
          );
          
          this.reopenRequests.delete(requestId);
          
          // Notify about expiration
          await this.notifyReopenExpired(request);
          
          this.emit('reopenExpired', request);
        }
      }
      
    } catch (error) {
      this.logger.error('auto-close', 'Failed to process reopen requests', error as Error);
    }
  }

  private async reopenClosedEvent(closedEventId: string): Promise<void> {
    try {
      await this.database.query(
        'UPDATE auto_close_events SET status = $1, reopened_at = $2 WHERE id = $3',
        ['reopened', new Date(), closedEventId]
      );
      
      // Update local cache
      for (const [eventId, event] of this.activeEvents.entries()) {
        if (event.id === closedEventId) {
          event.status = 'reopened';
          event.reopenedAt = new Date();
          break;
        }
      }
      
    } catch (error) {
      this.logger.error('auto-close', 'Failed to reopen closed event', error as Error);
    }
  }

  private async notifyReopenRequest(request: ReopenRequest): Promise<void> {
    try {
      // Get admins to notify
      const admins = await this.database.query(
        `SELECT user_id FROM workspace_members WHERE role IN ('admin', 'super_admin') AND workspace_id = $1`,
        [request.workspaceId]
      );
      
      for (const admin of admins.rows) {
        await this.notificationSystem.createNotification({
          userId: admin.user_id,
          workspaceId: request.workspaceId,
          type: 'system',
          title: 'Reopen Request',
          content: `User has requested to reopen a closed ticket: ${request.reason}`,
          data: {
            requestId: request.id,
            ticketId: request.ticketId,
            userId: request.userId,
            reason: request.reason
          },
          priority: 'high'
        });
      }
      
    } catch (error) {
      this.logger.error('auto-close', 'Failed to notify reopen request', error as Error);
    }
  }

  private async notifyReopenDenied(request: ReopenRequest, deniedBy: string): Promise<void> {
    try {
      await this.notificationSystem.createNotification({
        userId: request.requestedBy,
        workspaceId: request.workspaceId,
        type: 'system',
        title: 'Reopen Request Denied',
        content: `Your request to reopen the ticket has been denied. Reason: ${request.reason}`,
        data: {
          requestId: request.id,
          deniedBy,
          deniedAt: new Date()
        },
        priority: 'medium'
      });
      
    } catch (error) {
      this.logger.error('auto-close', 'Failed to notify reopen denied', error as Error);
    }
  }

  private async notifyReopenExpired(request: ReopenRequest): Promise<void> {
    try {
      await this.notificationSystem.createNotification({
        userId: request.requestedBy,
        workspaceId: request.workspaceId,
        type: 'system',
        title: 'Reopen Request Expired',
        content: 'Your request to reopen the ticket has expired.',
        data: {
          requestId: request.id,
          expiredAt: new Date()
        },
        priority: 'low'
      });
      
    } catch (error) {
      this.logger.error('auto-close', 'Failed to notify reopen expired', error as Error);
    }
  }

  private async getRuleById(ruleId: string): Promise<AutoCloseRule | null> {
    try {
      const result = await this.database.query('SELECT * FROM auto_close_rules WHERE id = $1', [ruleId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        description: row.description,
        conditions: row.conditions || [],
        timeoutHours: row.timeout_hours,
        warningHours: row.warning_hours,
        categories: row.categories || [],
        priorities: row.priorities || [],
        isActive: row.is_active,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
      
    } catch (error) {
      this.logger.error('auto-close', 'Failed to get rule by ID', error as Error);
      return null;
    }
  }

  async getActiveEvents(workspaceId: string): Promise<AutoCloseEvent[]> {
    return Array.from(this.activeEvents.values())
      .filter(event => event.workspaceId === workspaceId);
  }

  async getReopenRequests(workspaceId: string, status?: ReopenRequest['status']): Promise<ReopenRequest[]> {
    let requests = Array.from(this.reopenRequests.values())
      .filter(request => request.workspaceId === workspaceId);
    
    if (status) {
      requests = requests.filter(request => request.status === status);
    }
    
    return requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<AutoCloseAnalytics[]> {
    try {
      let sql = 'SELECT * FROM auto_close_analytics WHERE workspace_id = $1';
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
        totalClosed: row.total_closed,
        closedByCategory: row.closed_by_category || {},
        closedByPriority: row.closed_by_priority || {},
        averageTimeToClose: parseFloat(row.average_time_to_close) || 0,
        reopenedCount: row.reopened_count,
        reopenRate: parseFloat(row.reopen_rate) || 0,
        warningsSent: row.warnings_sent,
        customerSatisfactionImpact: parseFloat(row.customer_satisfaction_impact) || 0,
        agentWorkloadReduction: parseFloat(row.agent_workload_reduction) || 0
      }));
      
    } catch (error) {
      this.logger.error('auto-close', 'Failed to get analytics', error as Error);
      return [];
    }
  }

  async createDefaultRules(workspaceId: string, createdBy: string): Promise<void> {
    const defaultRules = [
      {
        name: 'Standard Auto-Close',
        description: 'Close tickets after 72 hours of inactivity with 24-hour warning',
        conditions: [{
          type: 'no_activity' as const,
          parameters: { noActivityHours: 72 },
          operator: 'AND' as const
        }],
        timeoutHours: 72,
        warningHours: 24,
        categories: ['general', 'information'],
        priorities: ['low', 'medium']
      },
      {
        name: 'Priority Auto-Close',
        description: 'Close high-priority tickets after 48 hours with 12-hour warning',
        conditions: [{
          type: 'no_activity' as const,
          parameters: { noActivityHours: 48 },
          operator: 'AND' as const
        }],
        timeoutHours: 48,
        warningHours: 12,
        categories: ['technical', 'billing'],
        priorities: ['high']
      },
      {
        name: 'Urgent Auto-Close',
        description: 'Close urgent tickets after 24 hours with 6-hour warning',
        conditions: [{
          type: 'no_activity' as const,
          parameters: { noActivityHours: 24 },
          operator: 'AND' as const
        }],
        timeoutHours: 24,
        warningHours: 6,
        categories: ['urgent', 'critical'],
        priorities: ['urgent']
      }
    ];
    
    for (const ruleConfig of defaultRules) {
      try {
        await this.createAutoCloseRule({
          workspaceId,
          ...ruleConfig,
          createdBy
        });
      } catch (error) {
        this.logger.debug('auto-close', `Default rule ${ruleConfig.name} may already exist`);
      }
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    activeEventsCount: number;
    pendingReopenRequestsCount: number;
    rulesCount: number;
    autoCloseProcessingActive: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!this.isProcessing) {
      issues.push('Auto-close processing is not active');
    }
    
    return {
      healthy: issues.length === 0,
      activeEventsCount: this.activeEvents.size,
      pendingReopenRequestsCount: Array.from(this.reopenRequests.values())
        .filter(req => req.status === 'pending').length,
      rulesCount: Array.from(this.rules.values()).reduce((sum, rules) => sum + rules.length, 0),
      autoCloseProcessingActive: this.isProcessing,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.logger.info('auto-close', 'Auto-close system shut down');
  }
}

export default UltraAutoClose;
