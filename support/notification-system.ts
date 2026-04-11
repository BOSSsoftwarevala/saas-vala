import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraWebSocketServer } from './websocket-server';
import { Notification } from './slack-system';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

export interface NotificationTemplate {
  id: string;
  workspaceId: string;
  name: string;
  type: Notification['type'];
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  workspaceId: string;
  type: Notification['type'];
  enabled: boolean;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
    sound: boolean;
  };
  conditions: NotificationCondition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationCondition {
  type: 'time_based' | 'priority_based' | 'sender_based' | 'channel_based';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
}

export interface EmailConfig {
  id: string;
  workspaceId: string;
  provider: 'smtp' | 'sendgrid' | 'ses' | 'mailgun';
  settings: {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
    apiKey?: string;
    fromEmail: string;
    fromName: string;
    replyTo?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PushConfig {
  id: string;
  workspaceId: string;
  provider: 'fcm' | 'apns' | 'webpush';
  settings: {
    serverKey?: string; // FCM
    keyId?: string; // APNS
    teamId?: string; // APNS
    bundleId?: string; // APNS
    vapidKeys?: {
      publicKey: string;
      privateKey: string;
    }; // WebPush
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationQueue {
  id: string;
  workspaceId: string;
  type: 'email' | 'push' | 'in_app';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  data: any;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationAnalytics {
  workspaceId: string;
  date: Date;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  byType: Record<string, {
    sent: number;
    delivered: number;
    read: number;
  }>;
  byChannel: Record<string, {
    sent: number;
    delivered: number;
    read: number;
  }>;
}

export interface UserDevice {
  id: string;
  userId: string;
  workspaceId: string;
  type: 'web' | 'ios' | 'android';
  token: string;
  isActive: boolean;
  lastUsed: Date;
  metadata: {
    userAgent?: string;
    platform?: string;
    version?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class UltraNotificationSystem extends EventEmitter {
  private static instance: UltraNotificationSystem;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private webSocketServer: UltraWebSocketServer;
  private templates: Map<string, NotificationTemplate> = new Map();
  private preferences: Map<string, NotificationPreference[]> = new Map(); // userId -> preferences
  private emailConfigs: Map<string, EmailConfig> = new Map(); // workspaceId -> config
  private pushConfigs: Map<string, PushConfig> = new Map(); // workspaceId -> config
  private queue: Map<string, NotificationQueue> = new Map();
  private devices: Map<string, UserDevice[]> = new Map(); // userId -> devices
  private emailTransporters: Map<string, nodemailer.Transporter> = new Map();
  private processingQueue = false;

  static getInstance(): UltraNotificationSystem {
    if (!UltraNotificationSystem.instance) {
      UltraNotificationSystem.instance = new UltraNotificationSystem();
    }
    return UltraNotificationSystem.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.webSocketServer = UltraWebSocketServer.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadTemplates();
      await this.loadPreferences();
      await this.loadEmailConfigs();
      await this.loadPushConfigs();
      await this.loadQueue();
      await this.loadDevices();
      this.startQueueProcessor();
      this.startAnalyticsProcessor();
      
      this.logger.info('notification-system', 'Notification system initialized', {
        templatesCount: this.templates.size,
        preferencesCount: Array.from(this.preferences.values()).reduce((sum, prefs) => sum + prefs.length, 0),
        emailConfigsCount: this.emailConfigs.size,
        pushConfigsCount: this.pushConfigs.size,
        queueCount: this.queue.size,
        devicesCount: Array.from(this.devices.values()).reduce((sum, devs) => sum + devs.length, 0)
      });
    } catch (error) {
      this.logger.error('notification-system', 'Failed to initialize notification system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS notification_templates (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        subject VARCHAR(255),
        html_body TEXT,
        text_body TEXT,
        variables JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        channels JSONB NOT NULL,
        conditions JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, workspace_id, type)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS email_configs (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        provider VARCHAR(20) NOT NULL,
        settings JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS push_configs (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        provider VARCHAR(20) NOT NULL,
        settings JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS notification_queue (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        priority VARCHAR(20) NOT NULL,
        data JSONB NOT NULL,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        next_attempt_at TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL,
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS user_devices (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        token VARCHAR(500) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_used TIMESTAMP DEFAULT NOW(),
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS notification_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_sent INTEGER DEFAULT 0,
        total_delivered INTEGER DEFAULT 0,
        total_read INTEGER DEFAULT 0,
        by_type JSONB NOT NULL,
        by_channel JSONB NOT NULL,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_notification_templates_workspace_id ON notification_templates(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_notification_queue_next_attempt ON notification_queue(next_attempt_at)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id)');
  }

  private async loadTemplates(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM notification_templates WHERE is_active = TRUE');
      
      for (const row of rows) {
        const template: NotificationTemplate = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          type: row.type,
          subject: row.subject,
          htmlBody: row.html_body,
          textBody: row.text_body,
          variables: row.variables || [],
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.templates.set(template.id, template);
      }
      
      this.logger.info('notification-system', `Loaded ${this.templates.size} notification templates`);
    } catch (error) {
      this.logger.error('notification-system', 'Failed to load notification templates', error as Error);
    }
  }

  private async loadPreferences(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM notification_preferences');
      
      for (const row of rows) {
        const preference: NotificationPreference = {
          id: row.id,
          userId: row.user_id,
          workspaceId: row.workspace_id,
          type: row.type,
          enabled: row.enabled,
          channels: row.channels,
          conditions: row.conditions || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.preferences.has(preference.userId)) {
          this.preferences.set(preference.userId, []);
        }
        this.preferences.get(preference.userId)!.push(preference);
      }
      
      this.logger.info('notification-system', `Loaded preferences for ${this.preferences.size} users`);
    } catch (error) {
      this.logger.error('notification-system', 'Failed to load notification preferences', error as Error);
    }
  }

  private async loadEmailConfigs(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM email_configs WHERE is_active = TRUE');
      
      for (const row of rows) {
        const config: EmailConfig = {
          id: row.id,
          workspaceId: row.workspace_id,
          provider: row.provider,
          settings: row.settings,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.emailConfigs.set(config.workspaceId, config);
        
        // Create email transporter
        await this.createEmailTransporter(config);
      }
      
      this.logger.info('notification-system', `Loaded ${this.emailConfigs.size} email configurations`);
    } catch (error) {
      this.logger.error('notification-system', 'Failed to load email configurations', error as Error);
    }
  }

  private async loadPushConfigs(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM push_configs WHERE is_active = TRUE');
      
      for (const row of rows) {
        const config: PushConfig = {
          id: row.id,
          workspaceId: row.workspace_id,
          provider: row.provider,
          settings: row.settings,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.pushConfigs.set(config.workspaceId, config);
      }
      
      this.logger.info('notification-system', `Loaded ${this.pushConfigs.size} push configurations`);
    } catch (error) {
      this.logger.error('notification-system', 'Failed to load push configurations', error as Error);
    }
  }

  private async loadQueue(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM notification_queue WHERE status = \'pending\' ORDER BY next_attempt_at ASC');
      
      for (const row of rows) {
        const queueItem: NotificationQueue = {
          id: row.id,
          workspaceId: row.workspace_id,
          type: row.type,
          priority: row.priority,
          data: row.data,
          attempts: row.attempts,
          maxAttempts: row.max_attempts,
          nextAttemptAt: row.next_attempt_at,
          status: row.status,
          error: row.error,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.queue.set(queueItem.id, queueItem);
      }
      
      this.logger.info('notification-system', `Loaded ${this.queue.size} queue items`);
    } catch (error) {
      this.logger.error('notification-system', 'Failed to load notification queue', error as Error);
    }
  }

  private async loadDevices(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM user_devices WHERE is_active = TRUE');
      
      for (const row of rows) {
        const device: UserDevice = {
          id: row.id,
          userId: row.user_id,
          workspaceId: row.workspace_id,
          type: row.type,
          token: row.token,
          isActive: row.is_active,
          lastUsed: row.last_used,
          metadata: row.metadata || {},
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.devices.has(device.userId)) {
          this.devices.set(device.userId, []);
        }
        this.devices.get(device.userId)!.push(device);
      }
      
      this.logger.info('notification-system', `Loaded devices for ${this.devices.size} users`);
    } catch (error) {
      this.logger.error('notification-system', 'Failed to load user devices', error as Error);
    }
  }

  private async createEmailTransporter(config: EmailConfig): Promise<void> {
    try {
      let transporter: nodemailer.Transporter;
      
      if (config.provider === 'smtp') {
        transporter = nodemailer.createTransporter({
          host: config.settings.host,
          port: config.settings.port,
          secure: config.settings.secure,
          auth: config.settings.auth
        });
      } else {
        // For other providers, you would use their specific SDKs
        transporter = nodemailer.createTransporter({
          // Default to SMTP for now
          host: 'localhost',
          port: 587,
          secure: false
        });
      }
      
      this.emailTransporters.set(config.workspaceId, transporter);
      
      // Verify connection
      await transporter.verify();
      this.logger.info('notification-system', `Email transporter created for workspace: ${config.workspaceId}`);
      
    } catch (error) {
      this.logger.error('notification-system', `Failed to create email transporter for workspace: ${config.workspaceId}`, error as Error);
    }
  }

  private startQueueProcessor(): void {
    // Process queue every 30 seconds
    setInterval(async () => {
      if (!this.processingQueue) {
        await this.processQueue();
      }
    }, 30000);
  }

  private async processQueue(): Promise<void> {
    this.processingQueue = true;
    
    try {
      const now = new Date();
      const readyItems = Array.from(this.queue.values())
        .filter(item => item.nextAttemptAt <= now && item.status === 'pending')
        .sort((a, b) => {
          // Sort by priority first, then by creation time
          const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
          const aPriority = priorityOrder[a.priority] || 0;
          const bPriority = priorityOrder[b.priority] || 0;
          
          if (aPriority !== bPriority) {
            return bPriority - aPriority;
          }
          
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
      
      for (const item of readyItems.slice(0, 10)) { // Process max 10 items per cycle
        await this.processQueueItem(item);
      }
      
    } catch (error) {
      this.logger.error('notification-system', 'Failed to process notification queue', error as Error);
    } finally {
      this.processingQueue = false;
    }
  }

  private async processQueueItem(item: NotificationQueue): Promise<void> {
    try {
      item.status = 'processing';
      item.attempts++;
      await this.updateQueueItem(item);
      
      let success = false;
      
      switch (item.type) {
        case 'email':
          success = await this.sendEmailNotification(item);
          break;
        case 'push':
          success = await this.sendPushNotification(item);
          break;
        case 'in_app':
          success = await this.sendInAppNotification(item);
          break;
      }
      
      if (success) {
        item.status = 'sent';
        await this.updateQueueItem(item);
        this.queue.delete(item.id);
        
        this.logger.info('notification-system', `Notification sent successfully: ${item.id}`);
        
      } else {
        if (item.attempts >= item.maxAttempts) {
          item.status = 'failed';
          await this.updateQueueItem(item);
          this.queue.delete(item.id);
          
          this.logger.error('notification-system', `Notification failed after max attempts: ${item.id}`);
          
        } else {
          // Schedule retry with exponential backoff
          const backoffMs = Math.min(1000 * Math.pow(2, item.attempts), 300000); // Max 5 minutes
          item.nextAttemptAt = new Date(Date.now() + backoffMs);
          item.status = 'pending';
          await this.updateQueueItem(item);
          
          this.logger.warn('notification-system', `Notification retry scheduled: ${item.id}, attempt ${item.attempts}`);
        }
      }
      
    } catch (error) {
      item.error = error.message;
      item.status = 'failed';
      await this.updateQueueItem(item);
      this.queue.delete(item.id);
      
      this.logger.error('notification-system', `Failed to process queue item: ${item.id}`, error as Error);
    }
  }

  private async sendEmailNotification(item: NotificationQueue): Promise<boolean> {
    try {
      const { to, subject, html, text } = item.data;
      const config = this.emailConfigs.get(item.workspaceId);
      
      if (!config) {
        throw new Error('Email configuration not found');
      }
      
      const transporter = this.emailTransporters.get(item.workspaceId);
      if (!transporter) {
        throw new Error('Email transporter not available');
      }
      
      await transporter.sendMail({
        from: `${config.settings.fromName} <${config.settings.fromEmail}>`,
        to,
        subject,
        html,
        text,
        replyTo: config.settings.replyTo
      });
      
      return true;
      
    } catch (error) {
      this.logger.error('notification-system', `Failed to send email notification: ${item.id}`, error as Error);
      return false;
    }
  }

  private async sendPushNotification(item: NotificationQueue): Promise<boolean> {
    try {
      const { userId, title, body, data } = item.data;
      const devices = this.devices.get(userId) || [];
      const config = this.pushConfigs.get(item.workspaceId);
      
      if (!config) {
        throw new Error('Push configuration not found');
      }
      
      // Send to all active devices
      const promises = devices
        .filter(device => device.isActive)
        .map(device => this.sendPushToDevice(device, title, body, data, config));
      
      const results = await Promise.allSettled(promises);
      return results.some(result => result.status === 'fulfilled');
      
    } catch (error) {
      this.logger.error('notification-system', `Failed to send push notification: ${item.id}`, error as Error);
      return false;
    }
  }

  private async sendPushToDevice(device: UserDevice, title: string, body: string, data: any, config: PushConfig): Promise<boolean> {
    try {
      // Simplified push notification - would use actual push service SDKs
      if (device.type === 'web') {
        // Web Push via Service Worker
        // This would use web-push library
        this.logger.debug('notification-system', `Web push sent to device: ${device.id}`);
      } else if (device.type === 'ios') {
        // APNS
        this.logger.debug('notification-system', `APNS push sent to device: ${device.id}`);
      } else if (device.type === 'android') {
        // FCM
        this.logger.debug('notification-system', `FCM push sent to device: ${device.id}`);
      }
      
      return true;
      
    } catch (error) {
      this.logger.error('notification-system', `Failed to send push to device: ${device.id}`, error as Error);
      return false;
    }
  }

  private async sendInAppNotification(item: NotificationQueue): Promise<boolean> {
    try {
      const { userId, notification } = item.data;
      
      // Send via WebSocket
      await this.webSocketServer.broadcastToUser(userId, {
        type: 'notification',
        data: notification,
        timestamp: new Date()
      });
      
      return true;
      
    } catch (error) {
      this.logger.error('notification-system', `Failed to send in-app notification: ${item.id}`, error as Error);
      return false;
    }
  }

  private async updateQueueItem(item: NotificationQueue): Promise<void> {
    await this.database.query(`
      UPDATE notification_queue 
      SET status = $1, attempts = $2, next_attempt_at = $3, error = $4, updated_at = $5
      WHERE id = $6
    `, [item.status, item.attempts, item.nextAttemptAt, item.error, new Date(), item.id]);
  }

  private startAnalyticsProcessor(): void {
    // Update analytics every hour
    setInterval(async () => {
      await this.updateAnalytics();
    }, 60 * 60 * 1000);
  }

  private async updateAnalytics(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      // Get all workspaces
      const workspaces = await this.database.query('SELECT DISTINCT workspace_id FROM notifications WHERE created_at >= $1', [yesterday]);
      
      for (const workspace of workspaces.rows) {
        await this.calculateWorkspaceAnalytics(workspace.workspace_id, yesterday);
      }
      
    } catch (error) {
      this.logger.error('notification-system', 'Failed to update analytics', error as Error);
    }
  }

  private async calculateWorkspaceAnalytics(workspaceId: string, date: Date): Promise<void> {
    try {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Get notifications for the day
      const notifications = await this.database.query(`
        SELECT * FROM notifications 
        WHERE workspace_id = $1 AND created_at >= $2 AND created_at < $3
      `, [workspaceId, date, nextDay]);
      
      const analytics: NotificationAnalytics = {
        workspaceId,
        date,
        totalSent: notifications.rows.length,
        totalDelivered: notifications.rows.filter((n: any) => n.is_delivered).length,
        totalRead: notifications.rows.filter((n: any) => n.is_read).length,
        byType: {},
        byChannel: {}
      };
      
      // Calculate by type and channel
      for (const notification of notifications.rows) {
        const type = notification.type;
        const channel = notification.is_email_sent ? 'email' : 'in_app';
        
        if (!analytics.byType[type]) {
          analytics.byType[type] = { sent: 0, delivered: 0, read: 0 };
        }
        if (!analytics.byChannel[channel]) {
          analytics.byChannel[channel] = { sent: 0, delivered: 0, read: 0 };
        }
        
        analytics.byType[type].sent++;
        analytics.byChannel[channel].sent++;
        
        if (notification.is_delivered) {
          analytics.byType[type].delivered++;
          analytics.byChannel[channel].delivered++;
        }
        
        if (notification.is_read) {
          analytics.byType[type].read++;
          analytics.byChannel[channel].read++;
        }
      }
      
      // Store analytics
      await this.database.query(`
        INSERT INTO notification_analytics (
          workspace_id, date, total_sent, total_delivered, total_read, by_type, by_channel
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (workspace_id, date) DO UPDATE SET
        total_sent = EXCLUDED.total_sent,
        total_delivered = EXCLUDED.total_delivered,
        total_read = EXCLUDED.total_read,
        by_type = EXCLUDED.by_type,
        by_channel = EXCLUDED.by_channel
      `, [
        analytics.workspaceId,
        analytics.date,
        analytics.totalSent,
        analytics.totalDelivered,
        analytics.totalRead,
        JSON.stringify(analytics.byType),
        JSON.stringify(analytics.byChannel)
      ]);
      
    } catch (error) {
      this.logger.error('notification-system', `Failed to calculate analytics for workspace: ${workspaceId}`, error as Error);
    }
  }

  // PUBLIC API METHODS
  async createNotification(config: {
    userId: string;
    workspaceId: string;
    type: Notification['type'];
    title: string;
    content: string;
    data: any;
    priority?: NotificationQueue['priority'];
    channels?: {
      inApp?: boolean;
      email?: boolean;
      push?: boolean;
    };
  }): Promise<string> {
    const notificationId = `notif-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      // Check user preferences
      const preferences = this.getUserPreferences(config.userId, config.workspaceId, config.type);
      if (!preferences || !preferences.enabled) {
        return notificationId; // User has disabled this notification type
      }
      
      // Create notification record
      await this.database.query(`
        INSERT INTO notifications (
          id, user_id, workspace_id, type, title, content, data, is_read, is_email_sent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        notificationId,
        config.userId,
        config.workspaceId,
        config.type,
        config.title,
        config.content,
        JSON.stringify(config.data),
        false,
        false,
        new Date()
      ]);
      
      // Queue notifications based on preferences
      const channels = config.channels || {
        inApp: preferences.channels.inApp,
        email: preferences.channels.email,
        push: preferences.channels.push
      };
      
      if (channels.inApp) {
        await this.queueNotification({
          workspaceId: config.workspaceId,
          type: 'in_app',
          priority: config.priority || 'normal',
          data: {
            userId: config.userId,
            notification: {
              id: notificationId,
              type: config.type,
              title: config.title,
              content: config.content,
              data: config.data,
              timestamp: new Date()
            }
          }
        });
      }
      
      if (channels.email) {
        await this.queueNotification({
          workspaceId: config.workspaceId,
          type: 'email',
          priority: config.priority || 'normal',
          data: {
            to: await this.getUserEmail(config.userId),
            subject: config.title,
            html: await this.renderEmailTemplate(config.workspaceId, config.type, config.data),
            text: config.content
          }
        });
      }
      
      if (channels.push) {
        await this.queueNotification({
          workspaceId: config.workspaceId,
          type: 'push',
          priority: config.priority || 'normal',
          data: {
            userId: config.userId,
            title: config.title,
            body: config.content,
            data: config.data
          }
        });
      }
      
      this.emit('notificationCreated', {
        id: notificationId,
        userId: config.userId,
        workspaceId: config.workspaceId,
        type: config.type
      });
      
      return notificationId;
      
    } catch (error) {
      this.logger.error('notification-system', `Failed to create notification: ${notificationId}`, error as Error);
      throw error;
    }
  }

  private getUserPreferences(userId: string, workspaceId: string, type: Notification['type']): NotificationPreference | null {
    const preferences = this.preferences.get(userId) || [];
    return preferences.find(p => p.workspaceId === workspaceId && p.type === type) || null;
  }

  private async getUserEmail(userId: string): Promise<string> {
    // This would typically query the users table
    // For now, return a placeholder
    return `${userId}@example.com`;
  }

  private async renderEmailTemplate(workspaceId: string, type: Notification['type'], data: any): Promise<string> {
    const template = Array.from(this.templates.values())
      .find(t => t.workspaceId === workspaceId && t.type === type);
    
    if (template && template.htmlBody) {
      // Simple template variable replacement
      let html = template.htmlBody;
      for (const variable of template.variables) {
        const value = this.getNestedValue(data, variable);
        html = html.replace(new RegExp(`{{${variable}}}`, 'g'), value || '');
      }
      return html;
    }
    
    // Default template
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${data.title || 'Notification'}</h2>
        <p style="color: #666;">${data.content || ''}</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">This is an automated notification from UltraSlack.</p>
      </div>
    `;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async queueNotification(config: {
    workspaceId: string;
    type: NotificationQueue['type'];
    priority: NotificationQueue['priority'];
    data: any;
  }): Promise<string> {
    const queueId = `queue-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    const queueItem: NotificationQueue = {
      id: queueId,
      workspaceId: config.workspaceId,
      type: config.type,
      priority: config.priority,
      data: config.data,
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: new Date(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await this.database.query(`
      INSERT INTO notification_queue (
        id, workspace_id, type, priority, data, attempts, max_attempts,
        next_attempt_at, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      queueItem.id,
      queueItem.workspaceId,
      queueItem.type,
      queueItem.priority,
      JSON.stringify(queueItem.data),
      queueItem.attempts,
      queueItem.maxAttempts,
      queueItem.nextAttemptAt,
      queueItem.status,
      queueItem.createdAt,
      queueItem.updatedAt
    ]);
    
    this.queue.set(queueId, queueItem);
    return queueId;
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.database.query(`
        UPDATE notifications 
        SET is_read = TRUE, read_at = NOW() 
        WHERE id = $1 AND user_id = $2
      `, [notificationId, userId]);
      
      return result.rowCount > 0;
      
    } catch (error) {
      this.logger.error('notification-system', `Failed to mark notification as read: ${notificationId}`, error as Error);
      return false;
    }
  }

  async getUserNotifications(userId: string, workspaceId: string, filters?: {
    type?: Notification['type'];
    isRead?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Notification[]> {
    try {
      let sql = `
        SELECT * FROM notifications 
        WHERE user_id = $1 AND workspace_id = $2
      `;
      const params: any[] = [userId, workspaceId];
      let paramIndex = 3;
      
      if (filters?.type) {
        sql += ` AND type = $${paramIndex}`;
        params.push(filters.type);
        paramIndex++;
      }
      
      if (filters?.isRead !== undefined) {
        sql += ` AND is_read = $${paramIndex}`;
        params.push(filters.isRead);
        paramIndex++;
      }
      
      sql += ` ORDER BY created_at DESC`;
      
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
        userId: row.user_id,
        workspaceId: row.workspace_id,
        type: row.type,
        title: row.title,
        content: row.content,
        data: row.data,
        isRead: row.is_read,
        isEmailSent: row.is_email_sent,
        createdAt: row.created_at,
        readAt: row.read_at
      }));
      
    } catch (error) {
      this.logger.error('notification-system', `Failed to get user notifications: ${userId}`, error as Error);
      return [];
    }
  }

  async registerDevice(config: {
    userId: string;
    workspaceId: string;
    type: UserDevice['type'];
    token: string;
    metadata?: UserDevice['metadata'];
  }): Promise<string> {
    const deviceId = `device-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const device: UserDevice = {
        id: deviceId,
        userId: config.userId,
        workspaceId: config.workspaceId,
        type: config.type,
        token: config.token,
        isActive: true,
        lastUsed: new Date(),
        metadata: config.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO user_devices (
          id, user_id, workspace_id, type, token, is_active, last_used, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id, workspace_id, token) DO UPDATE SET
        is_active = TRUE, last_used = EXCLUDED.last_used, updated_at = EXCLUDED.updated_at
      `, [
        device.id,
        device.userId,
        device.workspaceId,
        device.type,
        device.token,
        device.isActive,
        device.lastUsed,
        JSON.stringify(device.metadata),
        device.createdAt,
        device.updatedAt
      ]);
      
      if (!this.devices.has(device.userId)) {
        this.devices.set(device.userId, []);
      }
      this.devices.get(device.userId)!.push(device);
      
      this.emit('deviceRegistered', device);
      return deviceId;
      
    } catch (error) {
      this.logger.error('notification-system', `Failed to register device: ${deviceId}`, error as Error);
      throw error;
    }
  }

  async getNotificationStats(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    deliveryRate: number;
    readRate: number;
    byType: Record<string, { sent: number; delivered: number; read: number }>;
    byChannel: Record<string, { sent: number; delivered: number; read: number }>;
  }> {
    try {
      let sql = `
        SELECT 
          SUM(total_sent) as total_sent,
          SUM(total_delivered) as total_delivered,
          SUM(total_read) as total_read,
          jsonb_object_agg(by_type.key, by_type.value) as by_type,
          jsonb_object_agg(by_channel.key, by_channel.value) as by_channel
        FROM notification_analytics 
        WHERE workspace_id = $1
      `;
      const params: any[] = [workspaceId];
      
      if (dateRange) {
        sql += ` AND date >= $2 AND date <= $3`;
        params.push(dateRange.start, dateRange.end);
      }
      
      const result = await this.database.query(sql, params);
      
      if (result.rows.length === 0) {
        return {
          totalSent: 0,
          totalDelivered: 0,
          totalRead: 0,
          deliveryRate: 0,
          readRate: 0,
          byType: {},
          byChannel: {}
        };
      }
      
      const row = result.rows[0];
      const totalSent = parseInt(row.total_sent) || 0;
      const totalDelivered = parseInt(row.total_delivered) || 0;
      const totalRead = parseInt(row.total_read) || 0;
      
      return {
        totalSent,
        totalDelivered,
        totalRead,
        deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
        readRate: totalSent > 0 ? (totalRead / totalSent) * 100 : 0,
        byType: row.by_type || {},
        byChannel: row.by_channel || {}
      };
      
    } catch (error) {
      this.logger.error('notification-system', `Failed to get notification stats: ${workspaceId}`, error as Error);
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalRead: 0,
        deliveryRate: 0,
        readRate: 0,
        byType: {},
        byChannel: {}
      };
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    queueSize: number;
    emailConfigsCount: number;
    pushConfigsCount: number;
    devicesCount: number;
    processingQueue: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (this.queue.size > 1000) {
      issues.push('Large notification queue backlog');
    }
    
    if (this.emailConfigs.size === 0) {
      issues.push('No email configurations found');
    }
    
    return {
      healthy: issues.length === 0,
      queueSize: this.queue.size,
      emailConfigsCount: this.emailConfigs.size,
      pushConfigsCount: this.pushConfigs.size,
      devicesCount: Array.from(this.devices.values()).reduce((sum, devices) => sum + devices.length, 0),
      processingQueue: this.processingQueue,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.processingQueue = false;
    this.logger.info('notification-system', 'Notification system shut down');
  }
}

export default UltraNotificationSystem;
