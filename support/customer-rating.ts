import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraNotificationSystem } from './notification-system';
import { UltraSmartQueue } from './smart-queue';
import { Message, User, Workspace } from './slack-system';
import * as crypto from 'crypto';

export interface CustomerRating {
  id: string;
  workspaceId: string;
  ticketId?: string;
  messageId?: string;
  customerId: string;
  agentId: string;
  rating: number; // 1-5
  feedback?: string;
  categories: RatingCategory[];
  responseTime: number; // minutes
  resolutionTime?: number; // minutes
  sentiment: 'positive' | 'neutral' | 'negative';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: string;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface RatingCategory {
  name: string;
  score: number; // 1-5
  weight: number; // relative importance
}

export interface RatingRequest {
  id: string;
  workspaceId: string;
  ticketId?: string;
  messageId?: string;
  customerId: string;
  agentId: string;
  status: 'pending' | 'completed' | 'expired' | 'declined';
  sentAt: Date;
  expiresAt: Date;
  respondedAt?: Date;
  reminderSent?: boolean;
  channel: 'email' | 'in_app' | 'sms' | 'webhook';
  template: string;
  customMessage?: string;
  metadata: Record<string, any>;
}

export interface RatingAnalytics {
  workspaceId: string;
  date: Date;
  totalRatings: number;
  averageRating: number;
  ratingsByCategory: Record<string, number>;
  ratingsByPriority: Record<string, number>;
  ratingsByAgent: Record<string, { count: number; average: number }>;
  responseTimeVsRating: Array<{
    responseTimeRange: string;
    averageRating: number;
    count: number;
  }>;
  feedbackAnalysis: {
    positiveKeywords: Array<{ keyword: string; count: number }>;
    negativeKeywords: Array<{ keyword: string; count: number }>;
    sentiment: {
      positive: number;
      neutral: number;
      negative: number;
    };
  };
  trends: {
    ratingTrend: 'improving' | 'declining' | 'stable';
    changePercent: number;
  };
}

export interface RatingTemplate {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  subject: string;
  message: string;
  categories: RatingCategory[];
  customQuestions: RatingQuestion[];
  isActive: boolean;
  triggerConditions: RatingTriggerCondition[];
  sendDelay: number; // hours after resolution
  expiresIn: number; // hours
  reminderDelay: number; // hours
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RatingQuestion {
  id: string;
  type: 'text' | 'rating' | 'multiple_choice' | 'yes_no';
  question: string;
  required: boolean;
  options?: string[]; // for multiple choice
  minRating?: number; // for rating
  maxRating?: number; // for rating
}

export interface RatingTriggerCondition {
  type: 'ticket_closed' | 'resolution_time' | 'priority' | 'category' | 'customer_tier';
  parameters: {
    minResolutionTime?: number; // hours
    maxResolutionTime?: number; // hours
    priorities?: string[];
    categories?: string[];
    customerTiers?: string[];
  };
}

export class UltraCustomerRating extends EventEmitter {
  private static instance: UltraCustomerRating;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private notificationSystem: UltraNotificationSystem;
  private smartQueue: UltraSmartQueue;
  
  private templates: Map<string, Map<string, RatingTemplate>> = new Map(); // workspaceId -> templateId -> template
  private ratingRequests: Map<string, RatingRequest> = new Map();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout;

  static getInstance(): UltraCustomerRating {
    if (!UltraCustomerRating.instance) {
      UltraCustomerRating.instance = new UltraCustomerRating();
    }
    return UltraCustomerRating.instance;
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
      await this.loadTemplates();
      await this.loadRatingRequests();
      this.startRatingProcessing();
      
      this.logger.info('customer-rating', 'Customer rating system initialized', {
        templatesCount: Array.from(this.templates.values()).reduce((sum, templates) => sum + templates.size, 0),
        pendingRequestsCount: Array.from(this.ratingRequests.values())
          .filter(req => req.status === 'pending').length
      });
    } catch (error) {
      this.logger.error('customer-rating', 'Failed to initialize customer rating system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS customer_ratings (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        ticket_id VARCHAR(255),
        message_id VARCHAR(255),
        customer_id VARCHAR(255) NOT NULL,
        agent_id VARCHAR(255) NOT NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        feedback TEXT,
        categories JSONB NOT NULL,
        response_time INTEGER NOT NULL,
        resolution_time INTEGER,
        sentiment VARCHAR(10) NOT NULL,
        priority VARCHAR(10) NOT NULL,
        category VARCHAR(100) NOT NULL,
        tags TEXT[] NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS rating_requests (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        ticket_id VARCHAR(255),
        message_id VARCHAR(255),
        customer_id VARCHAR(255) NOT NULL,
        agent_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        sent_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        responded_at TIMESTAMP,
        reminder_sent BOOLEAN DEFAULT FALSE,
        channel VARCHAR(20) NOT NULL,
        template VARCHAR(255) NOT NULL,
        custom_message TEXT,
        metadata JSONB NOT NULL
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS rating_templates (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        categories JSONB NOT NULL,
        custom_questions JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        trigger_conditions JSONB NOT NULL,
        send_delay INTEGER DEFAULT 24,
        expires_in INTEGER DEFAULT 168,
        reminder_delay INTEGER DEFAULT 72,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS rating_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_ratings INTEGER DEFAULT 0,
        average_rating DECIMAL(3,2),
        ratings_by_category JSONB NOT NULL,
        ratings_by_priority JSONB NOT NULL,
        ratings_by_agent JSONB NOT NULL,
        response_time_vs_rating JSONB NOT NULL,
        feedback_analysis JSONB NOT NULL,
        trends JSONB NOT NULL,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_customer_ratings_workspace_id ON customer_ratings(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_customer_ratings_agent_id ON customer_ratings(agent_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_customer_ratings_created_at ON customer_ratings(created_at)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_rating_requests_workspace_id ON rating_requests(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_rating_requests_status ON rating_requests(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_rating_requests_expires_at ON rating_requests(expires_at)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_rating_templates_workspace_id ON rating_templates(workspace_id)');
  }

  private async loadTemplates(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM rating_templates WHERE is_active = TRUE ORDER BY created_at DESC');
      
      for (const row of rows) {
        const template: RatingTemplate = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          subject: row.subject,
          message: row.message,
          categories: row.categories || [],
          customQuestions: row.custom_questions || [],
          isActive: row.is_active,
          triggerConditions: row.trigger_conditions || [],
          sendDelay: row.send_delay || 24,
          expiresIn: row.expires_in || 168,
          reminderDelay: row.reminder_delay || 72,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.templates.has(template.workspaceId)) {
          this.templates.set(template.workspaceId, new Map());
        }
        this.templates.get(template.workspaceId)!.set(template.id, template);
      }
      
      this.logger.info('customer-rating', `Loaded rating templates for ${this.templates.size} workspaces`);
    } catch (error) {
      this.logger.error('customer-rating', 'Failed to load rating templates', error as Error);
    }
  }

  private async loadRatingRequests(): Promise<void> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM rating_requests WHERE status IN (\'pending\', \'sent\') ORDER BY sent_at DESC LIMIT 10000'
      );
      
      for (const row of rows) {
        const request: RatingRequest = {
          id: row.id,
          workspaceId: row.workspace_id,
          ticketId: row.ticket_id,
          messageId: row.message_id,
          customerId: row.customer_id,
          agentId: row.agent_id,
          status: row.status,
          sentAt: row.sent_at,
          expiresAt: row.expires_at,
          respondedAt: row.responded_at,
          reminderSent: row.reminder_sent,
          channel: row.channel,
          template: row.template,
          customMessage: row.custom_message,
          metadata: row.metadata || {}
        };
        
        this.ratingRequests.set(request.id, request);
      }
      
      this.logger.info('customer-rating', `Loaded ${this.ratingRequests.size} rating requests`);
    } catch (error) {
      this.logger.error('customer-rating', 'Failed to load rating requests', error as Error);
    }
  }

  private startRatingProcessing(): void {
    this.isProcessing = true;
    
    // Process rating requests every hour
    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) {
        await this.processRatingRequests();
        await this.updateAnalytics();
      }
    }, 60 * 60 * 1000);
  }

  // PUBLIC API METHODS
  async createRatingTemplate(config: {
    workspaceId: string;
    name: string;
    description?: string;
    subject: string;
    message: string;
    categories: RatingCategory[];
    customQuestions?: RatingQuestion[];
    triggerConditions?: RatingTriggerCondition[];
    sendDelay?: number;
    expiresIn?: number;
    reminderDelay?: number;
    createdBy: string;
  }): Promise<string> {
    const templateId = `template-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const template: RatingTemplate = {
        id: templateId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        subject: config.subject,
        message: config.message,
        categories: config.categories,
        customQuestions: config.customQuestions || [],
        isActive: true,
        triggerConditions: config.triggerConditions || [],
        sendDelay: config.sendDelay || 24,
        expiresIn: config.expiresIn || 168,
        reminderDelay: config.reminderDelay || 72,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO rating_templates (
          id, workspace_id, name, description, subject, message, categories, custom_questions,
          is_active, trigger_conditions, send_delay, expires_in, reminder_delay, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        template.id,
        template.workspaceId,
        template.name,
        template.description,
        template.subject,
        template.message,
        JSON.stringify(template.categories),
        JSON.stringify(template.customQuestions),
        template.isActive,
        JSON.stringify(template.triggerConditions),
        template.sendDelay,
        template.expiresIn,
        template.reminderDelay,
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
      this.logger.error('customer-rating', `Failed to create rating template: ${templateId}`, error as Error);
      throw error;
    }
  }

  async requestRating(config: {
    workspaceId: string;
    ticketId?: string;
    messageId?: string;
    customerId: string;
    agentId: string;
    templateId?: string;
    channel?: RatingRequest['channel'];
    customMessage?: string;
    sendDelay?: number;
  }): Promise<string> {
    const requestId = `rating-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      // Find appropriate template
      let template: RatingTemplate | null = null;
      
      if (config.templateId) {
        const workspaceTemplates = this.templates.get(config.workspaceId);
        template = workspaceTemplates ? workspaceTemplates.get(config.templateId) || null : null;
      } else {
        template = await this.findBestTemplate(config.workspaceId, config.ticketId);
      }
      
      if (!template) {
        this.logger.warn('customer-rating', `No rating template found for workspace: ${config.workspaceId}`);
        return '';
      }
      
      const sendDelay = config.sendDelay || template.sendDelay;
      const expiresAt = new Date(Date.now() + template.expiresIn * 60 * 60 * 1000);
      
      const request: RatingRequest = {
        id: requestId,
        workspaceId: config.workspaceId,
        ticketId: config.ticketId,
        messageId: config.messageId,
        customerId: config.customerId,
        agentId: config.agentId,
        status: 'pending',
        sentAt: new Date(Date.now() + sendDelay * 60 * 60 * 1000),
        expiresAt,
        reminderSent: false,
        channel: config.channel || 'in_app',
        template: template.id,
        customMessage: config.customMessage,
        metadata: {
          templateName: template.name,
          sendDelay,
          triggeredAt: new Date()
        }
      };
      
      await this.database.query(`
        INSERT INTO rating_requests (
          id, workspace_id, ticket_id, message_id, customer_id, agent_id, status,
          sent_at, expires_at, channel, template, custom_message, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        request.id,
        request.workspaceId,
        request.ticketId,
        request.messageId,
        request.customerId,
        request.agentId,
        request.status,
        request.sentAt,
        request.expiresAt,
        request.channel,
        request.template,
        request.customMessage,
        JSON.stringify(request.metadata)
      ]);
      
      this.ratingRequests.set(requestId, request);
      
      this.emit('ratingRequested', request);
      return requestId;
      
    } catch (error) {
      this.logger.error('customer-rating', `Failed to request rating: ${requestId}`, error as Error);
      throw error;
    }
  }

  async submitRating(config: {
    workspaceId: string;
    requestId: string;
    rating: number;
    feedback?: string;
    categories?: RatingCategory[];
    responseTime: number;
    resolutionTime?: number;
    priority: CustomerRating['priority'];
    category: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }): Promise<string> {
    const ratingId = `rating-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const request = this.ratingRequests.get(config.requestId);
      if (!request) {
        throw new Error('Rating request not found');
      }
      
      if (request.status !== 'pending') {
        throw new Error('Rating request is not pending');
      }
      
      if (new Date() > request.expiresAt) {
        throw new Error('Rating request has expired');
      }
      
      const sentiment = this.analyzeSentiment(config.rating, config.feedback);
      
      const rating: CustomerRating = {
        id: ratingId,
        workspaceId: config.workspaceId,
        ticketId: request.ticketId,
        messageId: request.messageId,
        customerId: request.customerId,
        agentId: request.agentId,
        rating: config.rating,
        feedback: config.feedback,
        categories: config.categories || [],
        responseTime: config.responseTime,
        resolutionTime: config.resolutionTime,
        sentiment,
        priority: config.priority,
        category: config.category,
        tags: config.tags || [],
        metadata: config.metadata || {},
        createdAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO customer_ratings (
          id, workspace_id, ticket_id, message_id, customer_id, agent_id, rating,
          feedback, categories, response_time, resolution_time, sentiment,
          priority, category, tags, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        rating.id,
        rating.workspaceId,
        rating.ticketId,
        rating.messageId,
        rating.customerId,
        rating.agentId,
        rating.rating,
        rating.feedback,
        JSON.stringify(rating.categories),
        rating.responseTime,
        rating.resolutionTime,
        rating.sentiment,
        rating.priority,
        rating.category,
        rating.tags,
        JSON.stringify(rating.metadata),
        rating.createdAt
      ]);
      
      // Update request status
      request.status = 'completed';
      request.respondedAt = new Date();
      
      await this.database.query(
        'UPDATE rating_requests SET status = $1, responded_at = $2 WHERE id = $3',
        [request.status, request.respondedAt, request.id]
      );
      
      this.ratingRequests.delete(config.requestId);
      
      // Send thank you notification
      await this.sendThankYouNotification(rating);
      
      this.emit('ratingSubmitted', rating);
      this.logger.info('customer-rating', `Rating submitted: ${ratingId}`, {
        rating: config.rating,
        agentId: request.agentId,
        sentiment
      });
      
      return ratingId;
      
    } catch (error) {
      this.logger.error('customer-rating', `Failed to submit rating: ${ratingId}`, error as Error);
      throw error;
    }
  }

  private async findBestTemplate(workspaceId: string, ticketId?: string): Promise<RatingTemplate | null> {
    try {
      const workspaceTemplates = this.templates.get(workspaceId);
      if (!workspaceTemplates || workspaceTemplates.size === 0) {
        return null;
      }
      
      // For now, return the first active template
      // In production, this would evaluate trigger conditions
      const templates = Array.from(workspaceTemplates.values())
        .filter(template => template.isActive);
      
      return templates.length > 0 ? templates[0] : null;
      
    } catch (error) {
      this.logger.error('customer-rating', 'Failed to find best template', error as Error);
      return null;
    }
  }

  private analyzeSentiment(rating: number, feedback?: string): CustomerRating['sentiment'] {
    if (rating >= 4) return 'positive';
    if (rating <= 2) return 'negative';
    return 'neutral';
  }

  private async sendThankYouNotification(rating: CustomerRating): Promise<void> {
    try {
      await this.notificationSystem.createNotification({
        userId: rating.customerId,
        workspaceId: rating.workspaceId,
        type: 'system',
        title: 'Thank You for Your Feedback',
        content: 'We appreciate your feedback and will use it to improve our service.',
        data: {
          ratingId: rating.id,
          rating: rating.rating
        },
        priority: 'low'
      });
      
    } catch (error) {
      this.logger.error('customer-rating', 'Failed to send thank you notification', error as Error);
    }
  }

  private async processRatingRequests(): Promise<void> {
    try {
      const now = new Date();
      
      for (const [requestId, request] of this.ratingRequests.entries()) {
        if (request.status !== 'pending') {
          continue;
        }
        
        // Check if it's time to send the request
        if (now >= request.sentAt && request.status === 'pending') {
          await this.sendRatingRequest(request);
          continue;
        }
        
        // Check if it's time to send a reminder
        const template = await this.getTemplateById(request.template);
        if (template && !request.reminderSent) {
          const reminderTime = new Date(request.sentAt.getTime() + template.reminderDelay * 60 * 60 * 1000);
          
          if (now >= reminderTime && now < request.expiresAt) {
            await this.sendReminder(request);
            continue;
          }
        }
        
        // Check if request has expired
        if (now >= request.expiresAt) {
          await this.expireRatingRequest(request);
        }
      }
      
    } catch (error) {
      this.logger.error('customer-rating', 'Failed to process rating requests', error as Error);
    }
  }

  private async sendRatingRequest(request: RatingRequest): Promise<void> {
    try {
      const template = await this.getTemplateById(request.template);
      if (!template) return;
      
      // Send rating request based on channel
      switch (request.channel) {
        case 'in_app':
          await this.sendInAppRating(request, template);
          break;
        case 'email':
          await this.sendEmailRating(request, template);
          break;
        case 'sms':
          await this.sendSMSRating(request, template);
          break;
        case 'webhook':
          await this.sendWebhookRating(request, template);
          break;
      }
      
      request.status = 'sent';
      
      await this.database.query(
        'UPDATE rating_requests SET status = $1 WHERE id = $2',
        [request.status, request.id]
      );
      
      this.emit('ratingRequestSent', request);
      
    } catch (error) {
      this.logger.error('customer-rating', 'Failed to send rating request', error as Error);
    }
  }

  private async sendInAppRating(request: RatingRequest, template: RatingTemplate): Promise<void> {
    await this.notificationSystem.createNotification({
      userId: request.customerId,
      workspaceId: request.workspaceId,
      type: 'system',
      title: template.subject,
      content: request.customMessage || template.message,
      data: {
        requestId: request.id,
        type: 'rating_request',
        expiresAt: request.expiresAt
      },
      priority: 'medium'
    });
  }

  private async sendEmailRating(request: RatingRequest, template: RatingTemplate): Promise<void> {
    // Would integrate with email service
    this.logger.info('customer-rating', `Email rating request sent to: ${request.customerId}`);
  }

  private async sendSMSRating(request: RatingRequest, template: RatingTemplate): Promise<void> {
    // Would integrate with SMS service
    this.logger.info('customer-rating', `SMS rating request sent to: ${request.customerId}`);
  }

  private async sendWebhookRating(request: RatingRequest, template: RatingTemplate): Promise<void> {
    // Would make HTTP request to webhook
    this.logger.info('customer-rating', `Webhook rating request sent for: ${request.id}`);
  }

  private async sendReminder(request: RatingRequest): Promise<void> {
    try {
      await this.notificationSystem.createNotification({
        userId: request.customerId,
        workspaceId: request.workspaceId,
        type: 'system',
        title: 'Rating Reminder',
        content: 'Please take a moment to rate your support experience. Your feedback helps us improve!',
        data: {
          requestId: request.id,
          type: 'rating_reminder',
          expiresAt: request.expiresAt
        },
        priority: 'low'
      });
      
      request.reminderSent = true;
      
      await this.database.query(
        'UPDATE rating_requests SET reminder_sent = TRUE WHERE id = $1',
        [request.id]
      );
      
      this.emit('ratingReminderSent', request);
      
    } catch (error) {
      this.logger.error('customer-rating', 'Failed to send reminder', error as Error);
    }
  }

  private async expireRatingRequest(request: RatingRequest): Promise<void> {
    try {
      request.status = 'expired';
      
      await this.database.query(
        'UPDATE rating_requests SET status = $1 WHERE id = $2',
        [request.status, request.id]
      );
      
      this.ratingRequests.delete(request.id);
      
      this.emit('ratingRequestExpired', request);
      
    } catch (error) {
      this.logger.error('customer-rating', 'Failed to expire rating request', error as Error);
    }
  }

  private async getTemplateById(templateId: string): Promise<RatingTemplate | null> {
    try {
      const result = await this.database.query('SELECT * FROM rating_templates WHERE id = $1', [templateId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        description: row.description,
        subject: row.subject,
        message: row.message,
        categories: row.categories || [],
        customQuestions: row.custom_questions || [],
        isActive: row.is_active,
        triggerConditions: row.trigger_conditions || [],
        sendDelay: row.send_delay || 24,
        expiresIn: row.expires_in || 168,
        reminderDelay: row.reminder_delay || 72,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
      
    } catch (error) {
      this.logger.error('customer-rating', 'Failed to get template by ID', error as Error);
      return null;
    }
  }

  async getRatings(workspaceId: string, filters?: {
    agentId?: string;
    customerId?: string;
    rating?: number;
    sentiment?: CustomerRating['sentiment'];
    dateRange?: { start: Date; end: Date };
    limit?: number;
    offset?: number;
  }): Promise<CustomerRating[]> {
    try {
      let sql = 'SELECT * FROM customer_ratings WHERE workspace_id = $1';
      const params: any[] = [workspaceId];
      
      if (filters?.agentId) {
        sql += ' AND agent_id = $2';
        params.push(filters.agentId);
      }
      
      if (filters?.customerId) {
        sql += filters.agentId ? ' AND customer_id = $3' : ' AND customer_id = $2';
        params.push(filters.customerId);
      }
      
      if (filters?.rating) {
        sql += ' AND rating = $' + (params.length + 1);
        params.push(filters.rating);
      }
      
      if (filters?.sentiment) {
        sql += ' AND sentiment = $' + (params.length + 1);
        params.push(filters.sentiment);
      }
      
      if (filters?.dateRange) {
        sql += ' AND created_at >= $' + (params.length + 1) + ' AND created_at <= $' + (params.length + 2);
        params.push(filters.dateRange.start, filters.dateRange.end);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      if (filters?.limit) {
        sql += ' LIMIT $' + (params.length + 1);
        params.push(filters.limit);
      }
      
      const rows = await this.database.query(sql, params);
      
      return rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        ticketId: row.ticket_id,
        messageId: row.message_id,
        customerId: row.customer_id,
        agentId: row.agent_id,
        rating: row.rating,
        feedback: row.feedback,
        categories: row.categories || [],
        responseTime: row.response_time,
        resolutionTime: row.resolution_time,
        sentiment: row.sentiment,
        priority: row.priority,
        category: row.category,
        tags: row.tags || [],
        metadata: row.metadata || {},
        createdAt: row.created_at
      }));
      
    } catch (error) {
      this.logger.error('customer-rating', 'Failed to get ratings', error as Error);
      return [];
    }
  }

  async getAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<RatingAnalytics[]> {
    try {
      let sql = 'SELECT * FROM rating_analytics WHERE workspace_id = $1';
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
        totalRatings: row.total_ratings,
        averageRating: parseFloat(row.average_rating) || 0,
        ratingsByCategory: row.ratings_by_category || {},
        ratingsByPriority: row.ratings_by_priority || {},
        ratingsByAgent: row.ratings_by_agent || {},
        responseTimeVsRating: row.response_time_vs_rating || [],
        feedbackAnalysis: row.feedback_analysis || {
          positiveKeywords: [],
          negativeKeywords: [],
          sentiment: { positive: 0, neutral: 0, negative: 0 }
        },
        trends: row.trends || { ratingTrend: 'stable', changePercent: 0 }
      }));
      
    } catch (error) {
      this.logger.error('customer-rating', 'Failed to get analytics', error as Error);
      return [];
    }
  }

  private async updateAnalytics(): Promise<void> {
    try {
      const workspaces = new Set(Array.from(this.templates.keys()));
      
      for (const workspaceId of workspaces) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const today = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000);
        
        // Calculate analytics for the period
        const ratingsResult = await this.database.query(`
          SELECT * FROM customer_ratings 
          WHERE workspace_id = $1 
          AND created_at >= $2 
          AND created_at < $3
        `, [workspaceId, yesterday, today]);
        
        const ratings = ratingsResult.rows;
        
        if (ratings.length === 0) continue;
        
        const totalRatings = ratings.length;
        const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings;
        
        const ratingsByCategory: Record<string, number> = {};
        const ratingsByPriority: Record<string, number> = {};
        const ratingsByAgent: Record<string, { count: number; average: number }> = {};
        
        for (const rating of ratings) {
          ratingsByCategory[rating.category] = (ratingsByCategory[rating.category] || 0) + 1;
          ratingsByPriority[rating.priority] = (ratingsByPriority[rating.priority] || 0) + 1;
          
          if (!ratingsByAgent[rating.agent_id]) {
            ratingsByAgent[rating.agent_id] = { count: 0, average: 0 };
          }
          ratingsByAgent[rating.agent_id].count++;
          ratingsByAgent[rating.agent_id].average += rating.rating;
        }
        
        // Calculate agent averages
        for (const agentId in ratingsByAgent) {
          ratingsByAgent[agentId].average /= ratingsByAgent[agentId].count;
        }
        
        const analytics: RatingAnalytics = {
          workspaceId,
          date: yesterday,
          totalRatings,
          averageRating,
          ratingsByCategory,
          ratingsByPriority,
          ratingsByAgent,
          responseTimeVsRating: [], // Would calculate response time ranges
          feedbackAnalysis: {
            positiveKeywords: [],
            negativeKeywords: [],
            sentiment: {
              positive: ratings.filter(r => r.sentiment === 'positive').length,
              neutral: ratings.filter(r => r.sentiment === 'neutral').length,
              negative: ratings.filter(r => r.sentiment === 'negative').length
            }
          },
          trends: { ratingTrend: 'stable', changePercent: 0 }
        };
        
        await this.database.query(`
          INSERT INTO rating_analytics (
            workspace_id, date, total_ratings, average_rating, ratings_by_category,
            ratings_by_priority, ratings_by_agent, response_time_vs_rating,
            feedback_analysis, trends
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (workspace_id, date) DO UPDATE SET
          total_ratings = EXCLUDED.total_ratings,
          average_rating = EXCLUDED.average_rating,
          ratings_by_category = EXCLUDED.ratings_by_category,
          ratings_by_priority = EXCLUDED.ratings_by_priority,
          ratings_by_agent = EXCLUDED.ratings_by_agent
        `, [
          analytics.workspaceId,
          analytics.date,
          analytics.totalRatings,
          analytics.averageRating,
          JSON.stringify(analytics.ratingsByCategory),
          JSON.stringify(analytics.ratingsByPriority),
          JSON.stringify(analytics.ratingsByAgent),
          JSON.stringify(analytics.responseTimeVsRating),
          JSON.stringify(analytics.feedbackAnalysis),
          JSON.stringify(analytics.trends)
        ]);
      }
      
    } catch (error) {
      this.logger.error('customer-rating', 'Failed to update analytics', error as Error);
    }
  }

  async createDefaultTemplate(workspaceId: string, createdBy: string): Promise<string> {
    return this.createRatingTemplate({
      workspaceId,
      name: 'Standard Customer Rating',
      description: 'Default template for customer satisfaction ratings',
      subject: 'How was your support experience?',
      message: 'Please take a moment to rate your recent support experience. Your feedback helps us improve our service.',
      categories: [
        { name: 'Response Time', score: 0, weight: 0.3 },
        { name: 'Agent Knowledge', score: 0, weight: 0.3 },
        { name: 'Problem Resolution', score: 0, weight: 0.4 }
      ],
      customQuestions: [
        {
          id: 'feedback',
          type: 'text',
          question: 'Any additional feedback?',
          required: false
        }
      ],
      triggerConditions: [
        {
          type: 'ticket_closed',
          parameters: {}
        }
      ],
      sendDelay: 24,
      expiresIn: 168,
      reminderDelay: 72,
      createdBy
    });
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    templatesCount: number;
    pendingRequestsCount: number;
    ratingProcessingActive: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!this.isProcessing) {
      issues.push('Rating processing is not active');
    }
    
    const templatesCount = Array.from(this.templates.values()).reduce((sum, templates) => sum + templates.size, 0);
    if (templatesCount === 0) {
      issues.push('No rating templates configured');
    }
    
    return {
      healthy: issues.length === 0,
      templatesCount,
      pendingRequestsCount: Array.from(this.ratingRequests.values())
        .filter(req => req.status === 'pending').length,
      ratingProcessingActive: this.isProcessing,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.logger.info('customer-rating', 'Customer rating system shut down');
  }
}

export default UltraCustomerRating;
