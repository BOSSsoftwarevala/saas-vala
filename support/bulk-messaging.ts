import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { UltraNotificationSystem } from './notification-system';
import { UltraMultiLanguage } from './multi-language';
import { Message, User, Workspace, Channel } from './slack-system';
import * as crypto from 'crypto';

export interface BulkMessage {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  type: 'announcement' | 'notification' | 'alert' | 'survey' | 'update';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  senderId: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
  targeting: {
    type: 'all' | 'roles' | 'users' | 'channels' | 'custom' | 'segments';
    criteria: {
      roles?: string[];
      userIds?: string[];
      channelIds?: string[];
      customQuery?: string;
      segments?: string[];
      excludeUsers?: string[];
      excludeRoles?: string[];
    };
  };
  scheduling: {
    sendNow: boolean;
    scheduledAt?: Date;
    timezone?: string;
    retryOnFailure?: boolean;
    maxRetries?: number;
  };
  delivery: {
    channels: ('in_app' | 'email' | 'sms' | 'push' | 'webhook')[];
    allowUnsubscribe?: boolean;
    trackOpens?: boolean;
    trackClicks?: boolean;
    personalize?: boolean;
  };
  localization: {
    enableMultiLanguage?: boolean;
    translations?: Record<string, { title: string; content: string }>;
    fallbackLanguage?: string;
  };
  metadata: {
    category?: string;
    tags?: string[];
    attachments?: Array<{
      id: string;
      name: string;
      url: string;
      type: string;
      size: number;
    }>;
    cta?: {
      text: string;
      url: string;
      style?: 'primary' | 'secondary' | 'danger';
    };
    expiresAt?: Date;
  };
  stats: {
    totalRecipients: number;
    sentCount: number;
    deliveredCount: number;
    openCount: number;
    clickCount: number;
    unsubscribeCount: number;
    failureCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  completedAt?: Date;
}

export interface BulkMessageTemplate {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  category: string;
  type: BulkMessage['type'];
  priority: BulkMessage['priority'];
  content: {
    title: string;
    body: string;
    variables: Array<{
      name: string;
      type: 'text' | 'number' | 'date' | 'boolean';
      description: string;
      required: boolean;
      defaultValue?: any;
    }>;
  };
  targeting: BulkMessage['targeting'];
  delivery: BulkMessage['delivery'];
  localization: BulkMessage['localization'];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageSegment {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  criteria: {
    type: 'dynamic' | 'static';
    conditions: Array<{
      field: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
      value: any;
    }>;
    staticUserIds?: string[];
  };
  userCount: number;
  lastCalculated: Date;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryReport {
  id: string;
  messageId: string;
  workspaceId: string;
  userId: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'unsubscribed';
  channel: BulkMessage['delivery']['channels'][0];
  attempts: number;
  lastAttempt: Date;
  error?: string;
  metadata: {
    openedAt?: Date;
    clickedAt?: Date;
    userAgent?: string;
    ipAddress?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkMessagingAnalytics {
  workspaceId: string;
  date: Date;
  totalMessages: number;
  totalRecipients: number;
  deliveryRate: number; // percentage
  openRate: number; // percentage
  clickRate: number; // percentage
  unsubscribeRate: number; // percentage
  messagesByType: Record<string, number>;
  messagesByPriority: Record<string, number>;
  topPerformingMessages: Array<{
    messageId: string;
    title: string;
    openRate: number;
    clickRate: number;
  }>;
  channelPerformance: Record<string, {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  }>;
  segmentPerformance: Record<string, number>;
}

export class UltraBulkMessaging extends EventEmitter {
  private static instance: UltraBulkMessaging;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  private notificationSystem: UltraNotificationSystem;
  private multiLanguage: UltraMultiLanguage;
  
  private messages: Map<string, BulkMessage> = new Map(); // messageId -> message
  private templates: Map<string, Map<string, BulkMessageTemplate>> = new Map(); // workspaceId -> templateId -> template
  private segments: Map<string, Map<string, MessageSegment>> = new Map(); // workspaceId -> segmentId -> segment
  private deliveryReports: Map<string, Map<string, DeliveryReport>> = new Map(); // messageId -> userId -> report
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout;

  static getInstance(): UltraBulkMessaging {
    if (!UltraBulkMessaging.instance) {
      UltraBulkMessaging.instance = new UltraBulkMessaging();
    }
    return UltraBulkMessaging.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.accessControl = UltraAccessControl.getInstance();
    this.notificationSystem = UltraNotificationSystem.getInstance();
    this.multiLanguage = UltraMultiLanguage.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadTemplates();
      await this.loadSegments();
      await this.loadActiveMessages();
      this.startProcessing();
      
      this.logger.info('bulk-messaging', 'Bulk messaging system initialized', {
        templatesCount: Array.from(this.templates.values()).reduce((sum, templates) => sum + templates.length, 0),
        segmentsCount: Array.from(this.segments.values()).reduce((sum, segments) => sum + segments.size, 0),
        activeMessagesCount: this.messages.size
      });
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to initialize bulk messaging system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS bulk_messages (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(20) NOT NULL,
        priority VARCHAR(10) NOT NULL,
        sender_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        targeting JSONB NOT NULL,
        scheduling JSONB NOT NULL,
        delivery JSONB NOT NULL,
        localization JSONB NOT NULL,
        metadata JSONB NOT NULL,
        stats JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        sent_at TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS bulk_message_templates (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        priority VARCHAR(10) NOT NULL,
        content JSONB NOT NULL,
        targeting JSONB NOT NULL,
        delivery JSONB NOT NULL,
        localization JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS message_segments (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        criteria JSONB NOT NULL,
        user_count INTEGER DEFAULT 0,
        last_calculated TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS delivery_reports (
        id VARCHAR(255) PRIMARY KEY,
        message_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        channel VARCHAR(20) NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_attempt TIMESTAMP DEFAULT NOW(),
        error TEXT,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(message_id, user_id)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS bulk_messaging_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_messages INTEGER DEFAULT 0,
        total_recipients INTEGER DEFAULT 0,
        delivery_rate DECIMAL(5,2),
        open_rate DECIMAL(5,2),
        click_rate DECIMAL(5,2),
        unsubscribe_rate DECIMAL(5,2),
        messages_by_type JSONB NOT NULL,
        messages_by_priority JSONB NOT NULL,
        top_performing_messages JSONB NOT NULL,
        channel_performance JSONB NOT NULL,
        segment_performance JSONB NOT NULL,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_bulk_messages_workspace_id ON bulk_messages(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_bulk_messages_status ON bulk_messages(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_bulk_messages_scheduled_at ON bulk_messages((scheduling->>\'scheduledAt\')::timestamp)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_bulk_message_templates_workspace_id ON bulk_message_templates(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_message_segments_workspace_id ON message_segments(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_delivery_reports_message_id ON delivery_reports(message_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_delivery_reports_user_id ON delivery_reports(user_id)');
  }

  private async loadTemplates(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM bulk_message_templates WHERE is_active = TRUE ORDER BY created_at DESC');
      
      for (const row of rows) {
        const template: BulkMessageTemplate = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          category: row.category,
          type: row.type,
          priority: row.priority,
          content: row.content,
          targeting: row.targeting,
          delivery: row.delivery,
          localization: row.localization,
          isActive: row.is_active,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.templates.has(template.workspaceId)) {
          this.templates.set(template.workspaceId, new Map());
        }
        this.templates.get(template.workspaceId)!.set(template.id, template);
      }
      
      this.logger.info('bulk-messaging', `Loaded templates for ${this.templates.size} workspaces`);
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to load templates', error as Error);
    }
  }

  private async loadSegments(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM message_segments WHERE is_active = TRUE ORDER BY created_at DESC');
      
      for (const row of rows) {
        const segment: MessageSegment = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          criteria: row.criteria,
          userCount: row.user_count,
          lastCalculated: row.last_calculated,
          isActive: row.is_active,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.segments.has(segment.workspaceId)) {
          this.segments.set(segment.workspaceId, new Map());
        }
        this.segments.get(segment.workspaceId)!.set(segment.id, segment);
      }
      
      this.logger.info('bulk-messaging', `Loaded segments for ${this.segments.size} workspaces`);
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to load segments', error as Error);
    }
  }

  private async loadActiveMessages(): Promise<void> {
    try {
      const rows = await this.database.query(
        "SELECT * FROM bulk_messages WHERE status IN ('scheduled', 'sending') ORDER BY created_at DESC"
      );
      
      for (const row of rows) {
        const message: BulkMessage = {
          id: row.id,
          workspaceId: row.workspace_id,
          title: row.title,
          content: row.content,
          type: row.type,
          priority: row.priority,
          senderId: row.sender_id,
          status: row.status,
          targeting: row.targeting,
          scheduling: row.scheduling,
          delivery: row.delivery,
          localization: row.localization,
          metadata: row.metadata,
          stats: row.stats,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          sentAt: row.sent_at,
          completedAt: row.completed_at
        };
        
        this.messages.set(message.id, message);
      }
      
      this.logger.info('bulk-messaging', `Loaded ${this.messages.size} active messages`);
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to load active messages', error as Error);
    }
  }

  private startProcessing(): void {
    this.isProcessing = true;
    
    // Process scheduled messages every minute
    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) {
        await this.processScheduledMessages();
        await this.updateDeliveryReports();
      }
    }, 60 * 1000);
  }

  // PUBLIC API METHODS
  async createBulkMessage(config: {
    workspaceId: string;
    title: string;
    content: string;
    type: BulkMessage['type'];
    priority: BulkMessage['priority'];
    senderId: string;
    targeting: BulkMessage['targeting'];
    scheduling: BulkMessage['scheduling'];
    delivery: BulkMessage['delivery'];
    localization?: BulkMessage['localization'];
    metadata?: BulkMessage['metadata'];
  }): Promise<string> {
    const messageId = `bulk-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const message: BulkMessage = {
        id: messageId,
        workspaceId: config.workspaceId,
        title: config.title,
        content: config.content,
        type: config.type,
        priority: config.priority,
        senderId: config.senderId,
        status: config.scheduling.sendNow ? 'sending' : 'scheduled',
        targeting: config.targeting,
        scheduling: config.scheduling,
        delivery: config.delivery,
        localization: config.localization || { enableMultiLanguage: false },
        metadata: config.metadata || {},
        stats: {
          totalRecipients: 0,
          sentCount: 0,
          deliveredCount: 0,
          openCount: 0,
          clickCount: 0,
          unsubscribeCount: 0,
          failureCount: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Calculate recipients
      const recipients = await this.getTargetRecipients(message);
      message.stats.totalRecipients = recipients.length;
      
      await this.database.query(`
        INSERT INTO bulk_messages (
          id, workspace_id, title, content, type, priority, sender_id, status,
          targeting, scheduling, delivery, localization, metadata, stats, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        message.id,
        message.workspaceId,
        message.title,
        message.content,
        message.type,
        message.priority,
        message.senderId,
        message.status,
        JSON.stringify(message.targeting),
        JSON.stringify(message.scheduling),
        JSON.stringify(message.delivery),
        JSON.stringify(message.localization),
        JSON.stringify(message.metadata),
        JSON.stringify(message.stats),
        message.createdAt,
        message.updatedAt
      ]);
      
      this.messages.set(message.id, message);
      
      // If send now, start processing immediately
      if (config.scheduling.sendNow) {
        await this.processMessage(message.id);
      }
      
      this.emit('messageCreated', message);
      return messageId;
      
    } catch (error) {
      this.logger.error('bulk-messaging', `Failed to create bulk message: ${messageId}`, error as Error);
      throw error;
    }
  }

  async createTemplate(config: {
    workspaceId: string;
    name: string;
    description?: string;
    category: string;
    type: BulkMessage['type'];
    priority: BulkMessage['priority'];
    content: BulkMessageTemplate['content'];
    targeting: BulkMessage['targeting'];
    delivery: BulkMessage['delivery'];
    localization?: BulkMessage['localization'];
    createdBy: string;
  }): Promise<string> {
    const templateId = `template-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const template: BulkMessageTemplate = {
        id: templateId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        category: config.category,
        type: config.type,
        priority: config.priority,
        content: config.content,
        targeting: config.targeting,
        delivery: config.delivery,
        localization: config.localization || { enableMultiLanguage: false },
        isActive: true,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO bulk_message_templates (
          id, workspace_id, name, description, category, type, priority, content,
          targeting, delivery, localization, is_active, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        template.id,
        template.workspaceId,
        template.name,
        template.description,
        template.category,
        template.type,
        template.priority,
        JSON.stringify(template.content),
        JSON.stringify(template.targeting),
        JSON.stringify(template.delivery),
        JSON.stringify(template.localization),
        template.isActive,
        template.createdBy,
        template.createdAt,
        template.updatedAt
      ]);
      
      if (!this.templates.has(template.workspaceId)) {
        this.templates.set(template.workspaceId, new Map());
      }
      this.templates.get(template.workspaceId)!.set(template.id, template);
      
      this.emit('templateCreated', template);
      return templateId;
      
    } catch (error) {
      this.logger.error('bulk-messaging', `Failed to create template: ${templateId}`, error as Error);
      throw error;
    }
  }

  async createSegment(config: {
    workspaceId: string;
    name: string;
    description?: string;
    criteria: MessageSegment['criteria'];
    createdBy: string;
  }): Promise<string> {
    const segmentId = `segment-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const segment: MessageSegment = {
        id: segmentId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        criteria: config.criteria,
        userCount: 0,
        lastCalculated: new Date(),
        isActive: true,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Calculate user count
      const users = await this.getSegmentUsers(segment);
      segment.userCount = users.length;
      
      await this.database.query(`
        INSERT INTO message_segments (
          id, workspace_id, name, description, criteria, user_count, last_calculated,
          is_active, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        segment.id,
        segment.workspaceId,
        segment.name,
        segment.description,
        JSON.stringify(segment.criteria),
        segment.userCount,
        segment.lastCalculated,
        segment.isActive,
        segment.createdBy,
        segment.createdAt,
        segment.updatedAt
      ]);
      
      if (!this.segments.has(segment.workspaceId)) {
        this.segments.set(segment.workspaceId, new Map());
      }
      this.segments.get(segment.workspaceId)!.set(segment.id, segment);
      
      this.emit('segmentCreated', segment);
      return segmentId;
      
    } catch (error) {
      this.logger.error('bulk-messaging', `Failed to create segment: ${segmentId}`, error as Error);
      throw error;
    }
  }

  async getBulkMessages(workspaceId: string, status?: BulkMessage['status']): Promise<BulkMessage[]> {
    try {
      let messages = Array.from(this.messages.values())
        .filter(msg => msg.workspaceId === workspaceId);
      
      if (status) {
        messages = messages.filter(msg => msg.status === status);
      }
      
      return messages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get bulk messages', error as Error);
      return [];
    }
  }

  async getTemplates(workspaceId: string, category?: string): Promise<BulkMessageTemplate[]> {
    try {
      const workspaceTemplates = this.templates.get(workspaceId);
      if (!workspaceTemplates) {
        return [];
      }
      
      let templates = Array.from(workspaceTemplates.values());
      
      if (category) {
        templates = templates.filter(template => template.category === category);
      }
      
      return templates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get templates', error as Error);
      return [];
    }
  }

  async getSegments(workspaceId: string): Promise<MessageSegment[]> {
    try {
      const workspaceSegments = this.segments.get(workspaceId);
      if (!workspaceSegments) {
        return [];
      }
      
      return Array.from(workspaceSegments.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get segments', error as Error);
      return [];
    }
  }

  async getDeliveryReport(messageId: string): Promise<DeliveryReport[]> {
    try {
      const messageReports = this.deliveryReports.get(messageId);
      if (!messageReports) {
        // Load from database
        await this.loadDeliveryReports(messageId);
        return this.deliveryReports.get(messageId)?.values().toArray() || [];
      }
      
      return Array.from(messageReports.values())
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get delivery report', error as Error);
      return [];
    }
  }

  async getMessageFromTemplate(templateId: string, variables: Record<string, any>): Promise<{
    title: string;
    content: string;
  }> {
    try {
      // Find template
      let template: BulkMessageTemplate | null = null;
      for (const workspaceTemplates of this.templates.values()) {
        template = workspaceTemplates.get(templateId) || null;
        if (template) break;
      }
      
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }
      
      // Replace variables
      let title = template.content.title;
      let content = template.content.body;
      
      for (const variable of template.content.variables) {
        const value = variables[variable.name] ?? variable.defaultValue ?? '';
        const placeholder = `{{${variable.name}}}`;
        
        title = title.replace(new RegExp(placeholder, 'g'), String(value));
        content = content.replace(new RegExp(placeholder, 'g'), String(value));
      }
      
      return { title, content };
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get message from template', error as Error);
      throw error;
    }
  }

  async cancelBulkMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      const message = this.messages.get(messageId);
      if (!message || !['draft', 'scheduled'].includes(message.status)) {
        return false;
      }
      
      // Check permissions
      const hasPermission = await this.accessControl.hasPermission(userId, message.workspaceId, 'admin');
      if (!hasPermission) {
        return false;
      }
      
      message.status = 'cancelled';
      message.updatedAt = new Date();
      
      await this.database.query(
        'UPDATE bulk_messages SET status = $1, updated_at = $2 WHERE id = $3',
        [message.status, message.updatedAt, messageId]
      );
      
      this.messages.delete(messageId);
      
      this.emit('messageCancelled', { messageId, userId });
      return true;
      
    } catch (error) {
      this.logger.error('bulk-messaging', `Failed to cancel bulk message: ${messageId}`, error as Error);
      return false;
    }
  }

  async getAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<BulkMessagingAnalytics[]> {
    try {
      let sql = 'SELECT * FROM bulk_messaging_analytics WHERE workspace_id = $1';
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
        totalMessages: row.total_messages,
        totalRecipients: row.total_recipients,
        deliveryRate: parseFloat(row.delivery_rate) || 0,
        openRate: parseFloat(row.open_rate) || 0,
        clickRate: parseFloat(row.click_rate) || 0,
        unsubscribeRate: parseFloat(row.unsubscribe_rate) || 0,
        messagesByType: row.messages_by_type || {},
        messagesByPriority: row.messages_by_priority || {},
        topPerformingMessages: row.top_performing_messages || [],
        channelPerformance: row.channel_performance || {},
        segmentPerformance: row.segment_performance || {}
      }));
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get analytics', error as Error);
      return [];
    }
  }

  // Private helper methods
  private async getTargetRecipients(message: BulkMessage): Promise<string[]> {
    try {
      switch (message.targeting.type) {
        case 'all':
          return await this.getAllWorkspaceUsers(message.workspaceId);
          
        case 'roles':
          return await this.getUsersByRoles(message.workspaceId, message.targeting.criteria.roles || []);
          
        case 'users':
          return message.targeting.criteria.userIds || [];
          
        case 'channels':
          return await this.getUsersByChannels(message.workspaceId, message.targeting.criteria.channelIds || []);
          
        case 'segments':
          return await this.getUsersBySegments(message.workspaceId, message.targeting.criteria.segments || []);
          
        case 'custom':
          return await this.getUsersByCustomQuery(message.workspaceId, message.targeting.criteria.customQuery || '');
          
        default:
          return [];
      }
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get target recipients', error as Error);
      return [];
    }
  }

  private async getAllWorkspaceUsers(workspaceId: string): Promise<string[]> {
    try {
      const result = await this.database.query(
        'SELECT user_id FROM workspace_members WHERE workspace_id = $1',
        [workspaceId]
      );
      
      return result.rows.map(row => row.user_id);
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get all workspace users', error as Error);
      return [];
    }
  }

  private async getUsersByRoles(workspaceId: string, roles: string[]): Promise<string[]> {
    try {
      const result = await this.database.query(
        'SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND role = ANY($2)',
        [workspaceId, roles]
      );
      
      return result.rows.map(row => row.user_id);
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get users by roles', error as Error);
      return [];
    }
  }

  private async getUsersByChannels(workspaceId: string, channelIds: string[]): Promise<string[]> {
    try {
      const result = await this.database.query(
        'SELECT DISTINCT user_id FROM channel_members WHERE channel_id = ANY($1)',
        [channelIds]
      );
      
      return result.rows.map(row => row.user_id);
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get users by channels', error as Error);
      return [];
    }
  }

  private async getUsersBySegments(workspaceId: string, segmentIds: string[]): Promise<string[]> {
    try {
      const userIds = new Set<string>();
      
      for (const segmentId of segmentIds) {
        const segment = this.segments.get(workspaceId)?.get(segmentId);
        if (segment) {
          const users = await this.getSegmentUsers(segment);
          users.forEach(userId => userIds.add(userId));
        }
      }
      
      return Array.from(userIds);
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get users by segments', error as Error);
      return [];
    }
  }

  private async getUsersByCustomQuery(workspaceId: string, query: string): Promise<string[]> {
    try {
      // In a real implementation, this would execute a safe custom query
      // For now, return empty to prevent SQL injection
      this.logger.warn('bulk-messaging', 'Custom query not implemented for security reasons');
      return [];
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get users by custom query', error as Error);
      return [];
    }
  }

  private async getSegmentUsers(segment: MessageSegment): Promise<string[]> {
    try {
      if (segment.criteria.type === 'static') {
        return segment.criteria.staticUserIds || [];
      }
      
      // Dynamic segment - apply conditions
      let sql = 'SELECT DISTINCT user_id FROM workspace_members WHERE workspace_id = $1';
      const params: any[] = [segment.workspaceId];
      
      for (const condition of segment.criteria.conditions) {
        // This is a simplified implementation
        // In production, would build more complex queries based on conditions
      }
      
      const result = await this.database.query(sql, params);
      return result.rows.map(row => row.user_id);
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get segment users', error as Error);
      return [];
    }
  }

  private async processScheduledMessages(): Promise<void> {
    try {
      const now = new Date();
      
      for (const message of this.messages.values()) {
        if (message.status === 'scheduled' && 
            message.scheduling.scheduledAt && 
            message.scheduling.scheduledAt <= now) {
          await this.processMessage(message.id);
        }
      }
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to process scheduled messages', error as Error);
    }
  }

  private async processMessage(messageId: string): Promise<void> {
    try {
      const message = this.messages.get(messageId);
      if (!message || message.status !== 'scheduled') {
        return;
      }
      
      message.status = 'sending';
      message.sentAt = new Date();
      message.updatedAt = new Date();
      
      await this.database.query(
        'UPDATE bulk_messages SET status = $1, sent_at = $2, updated_at = $3 WHERE id = $4',
        [message.status, message.sentAt, message.updatedAt, messageId]
      );
      
      // Get recipients
      const recipients = await this.getTargetRecipients(message);
      
      // Apply exclusions
      const excludedUsers = new Set(message.targeting.criteria.excludeUsers || []);
      const filteredRecipients = recipients.filter(userId => !excludedUsers.has(userId));
      
      // Send messages
      for (const userId of filteredRecipients) {
        await this.sendToUser(message, userId);
      }
      
      // Update status
      message.status = 'sent';
      message.completedAt = new Date();
      message.updatedAt = new Date();
      
      await this.database.query(
        'UPDATE bulk_messages SET status = $1, completed_at = $2, updated_at = $3 WHERE id = $4',
        [message.status, message.completedAt, message.updatedAt, messageId]
      );
      
      this.messages.delete(messageId);
      
      this.emit('messageSent', message);
      
    } catch (error) {
      this.logger.error('bulk-messaging', `Failed to process message: ${messageId}`, error as Error);
      
      // Update status to failed
      await this.database.query(
        'UPDATE bulk_messages SET status = $1 WHERE id = $2',
        ['failed', messageId]
      );
    }
  }

  private async sendToUser(message: BulkMessage, userId: string): Promise<void> {
    try {
      // Personalize message if enabled
      let title = message.title;
      let content = message.content;
      
      if (message.delivery.personalize) {
        const user = await this.getUser(userId);
        if (user) {
          title = title.replace(/\{\{name\}\}/g, user.name || 'User');
          title = title.replace(/\{\{email\}\}/g, user.email || '');
          content = content.replace(/\{\{name\}\}/g, user.name || 'User');
          content = content.replace(/\{\{email\}\}/g, user.email || '');
        }
      }
      
      // Handle multi-language
      if (message.localization.enableMultiLanguage) {
        const userPreference = await this.multiLanguage.getUserLanguagePreference(userId, message.workspaceId);
        if (userPreference && message.localization.translations?.[userPreference.primaryLanguage]) {
          const translation = message.localization.translations[userPreference.primaryLanguage];
          title = translation.title;
          content = translation.content;
        }
      }
      
      // Send through each channel
      for (const channel of message.delivery.channels) {
        await this.sendViaChannel(message, userId, title, content, channel);
      }
      
      // Update stats
      message.stats.sentCount++;
      
      // Create delivery report
      await this.createDeliveryReport(message.id, userId, 'sent', channel);
      
    } catch (error) {
      this.logger.error('bulk-messaging', `Failed to send to user: ${userId}`, error as Error);
      
      // Update failure count
      message.stats.failureCount++;
      
      // Create delivery report with error
      await this.createDeliveryReport(message.id, userId, 'failed', message.delivery.channels[0], error.message);
    }
  }

  private async sendViaChannel(
    message: BulkMessage,
    userId: string,
    title: string,
    content: string,
    channel: BulkMessage['delivery']['channels'][0]
  ): Promise<void> {
    try {
      switch (channel) {
        case 'in_app':
          await this.notificationSystem.createNotification({
            userId,
            workspaceId: message.workspaceId,
            type: message.type,
            title,
            content,
            data: {
              messageId: message.id,
              priority: message.priority,
              attachments: message.metadata.attachments,
              cta: message.metadata.cta
            },
            priority: message.priority
          });
          break;
          
        case 'email':
          // Send email (would integrate with email service)
          this.logger.info('bulk-messaging', `Email sent to ${userId}: ${title}`);
          break;
          
        case 'sms':
          // Send SMS (would integrate with SMS service)
          this.logger.info('bulk-messaging', `SMS sent to ${userId}: ${title}`);
          break;
          
        case 'push':
          // Send push notification (would integrate with push service)
          this.logger.info('bulk-messaging', `Push sent to ${userId}: ${title}`);
          break;
          
        case 'webhook':
          // Send webhook (would integrate with webhook service)
          this.logger.info('bulk-messaging', `Webhook sent for ${userId}: ${title}`);
          break;
      }
      
    } catch (error) {
      this.logger.error('bulk-messaging', `Failed to send via ${channel}`, error as Error);
      throw error;
    }
  }

  private async createDeliveryReport(
    messageId: string,
    userId: string,
    status: DeliveryReport['status'],
    channel: BulkMessage['delivery']['channels'][0],
    error?: string
  ): Promise<void> {
    try {
      const reportId = `report-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      
      const report: DeliveryReport = {
        id: reportId,
        messageId,
        workspaceId: this.messages.get(messageId)?.workspaceId || '',
        userId,
        status,
        channel,
        attempts: status === 'failed' ? 1 : 0,
        lastAttempt: new Date(),
        error,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO delivery_reports (
          id, message_id, workspace_id, user_id, status, channel, attempts,
          last_attempt, error, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (message_id, user_id) DO UPDATE SET
        status = EXCLUDED.status,
        attempts = EXCLUDED.attempts + 1,
        last_attempt = EXCLUDED.last_attempt,
        error = EXCLUDED.error,
        updated_at = EXCLUDED.updated_at
      `, [
        report.id,
        report.messageId,
        report.workspaceId,
        report.userId,
        report.status,
        report.channel,
        report.attempts,
        report.lastAttempt,
        report.error,
        JSON.stringify(report.metadata),
        report.createdAt,
        report.updatedAt
      ]);
      
      // Update local cache
      if (!this.deliveryReports.has(messageId)) {
        this.deliveryReports.set(messageId, new Map());
      }
      this.deliveryReports.get(messageId)!.set(userId, report);
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to create delivery report', error as Error);
    }
  }

  private async loadDeliveryReports(messageId: string): Promise<void> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM delivery_reports WHERE message_id = $1 ORDER BY updated_at DESC',
        [messageId]
      );
      
      const reports = new Map<string, DeliveryReport>();
      
      for (const row of rows) {
        const report: DeliveryReport = {
          id: row.id,
          messageId: row.message_id,
          workspaceId: row.workspace_id,
          userId: row.user_id,
          status: row.status,
          channel: row.channel,
          attempts: row.attempts,
          lastAttempt: row.last_attempt,
          error: row.error,
          metadata: row.metadata || {},
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        reports.set(report.userId, report);
      }
      
      this.deliveryReports.set(messageId, reports);
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to load delivery reports', error as Error);
    }
  }

  private async updateDeliveryReports(): Promise<void> {
    try {
      // This would update delivery reports based on external events
      // like email opens, clicks, etc.
      // For now, it's a placeholder
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to update delivery reports', error as Error);
    }
  }

  private async getUser(userId: string): Promise<User | null> {
    try {
      const result = await this.database.query('SELECT * FROM users WHERE id = $1', [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        avatar: row.avatar,
        status: row.status,
        lastSeen: row.last_seen,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: row.metadata || {}
      };
      
    } catch (error) {
      this.logger.error('bulk-messaging', 'Failed to get user', error as Error);
      return null;
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    processingActive: boolean;
    activeMessagesCount: number;
    templatesCount: number;
    segmentsCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!this.isProcessing) {
      issues.push('Message processing is not active');
    }
    
    return {
      healthy: issues.length === 0,
      processingActive: this.isProcessing,
      activeMessagesCount: this.messages.size,
      templatesCount: Array.from(this.templates.values()).reduce((sum, templates) => sum + templates.length, 0),
      segmentsCount: Array.from(this.segments.values()).reduce((sum, segments) => sum + segments.size, 0),
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.messages.clear();
    this.templates.clear();
    this.segments.clear();
    this.deliveryReports.clear();
    
    this.logger.info('bulk-messaging', 'Bulk messaging system shut down');
  }
}

export default UltraBulkMessaging;
