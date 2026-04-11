import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { UltraNotificationSystem } from './notification-system';
import { UltraSmartQueue } from './smart-queue';
import { UltraSessionHistory } from './session-history';
import { UltraCustomerRating } from './customer-rating';
import { UltraAntiSpam } from './anti-spam';
import { UltraMultiLanguage } from './multi-language';
import { Message, User, Workspace, Channel } from './slack-system';
import * as crypto from 'crypto';

export interface DashboardMetrics {
  workspaceId: string;
  timestamp: Date;
  activeChats: number;
  waitingChats: number;
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  escalatedTickets: number;
  averageResponseTime: number; // minutes
  averageResolutionTime: number; // minutes
  customerSatisfaction: number; // 1-5
  agentWorkload: {
    agentId: string;
    activeChats: number;
    totalChats: number;
    averageResponseTime: number;
    satisfaction: number;
  }[];
  systemLoad: {
    cpuUsage: number; // percentage
    memoryUsage: number; // percentage
    diskUsage: number; // percentage
    networkLatency: number; // milliseconds
  };
  spamDetection: {
    blockedMessages: number;
    suspectedSpam: number;
    falsePositives: number;
  };
  languageUsage: Record<string, number>;
  topIssues: Array<{
    category: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

export interface AlertConfig {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  type: 'threshold' | 'anomaly' | 'trend' | 'custom';
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  notificationChannels: ('email' | 'sms' | 'webhook' | 'in_app')[];
  cooldownPeriod: number; // minutes
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Alert {
  id: string;
  workspaceId: string;
  configId: string;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: AlertConfig['severity'];
  status: 'active' | 'acknowledged' | 'resolved';
  message: string;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface DashboardWidget {
  id: string;
  workspaceId: string;
  userId: string;
  type: 'metrics' | 'charts' | 'alerts' | 'activity_feed' | 'agent_performance' | 'system_health';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  config: Record<string, any>;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityFeedItem {
  id: string;
  workspaceId: string;
  type: 'chat_started' | 'chat_ended' | 'ticket_created' | 'ticket_closed' | 'agent_assigned' | 
        'escalation' | 'spam_detected' | 'system_alert' | 'user_login' | 'user_logout';
  userId?: string;
  agentId?: string;
  ticketId?: string;
  chatId?: string;
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export class UltraAdminDashboard extends EventEmitter {
  private static instance: UltraAdminDashboard;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  private notificationSystem: UltraNotificationSystem;
  private smartQueue: UltraSmartQueue;
  private sessionHistory: UltraSessionHistory;
  private customerRating: UltraCustomerRating;
  private antiSpam: UltraAntiSpam;
  private multiLanguage: UltraMultiLanguage;
  
  private metrics: Map<string, DashboardMetrics> = new Map(); // workspaceId -> metrics
  private alerts: Map<string, Map<string, Alert>> = new Map(); // workspaceId -> alertId -> alert
  private widgets: Map<string, Map<string, DashboardWidget>> = new Map(); // workspaceId -> userId -> widgets
  private activityFeed: Map<string, ActivityFeedItem[]> = new Map(); // workspaceId -> items
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout;

  static getInstance(): UltraAdminDashboard {
    if (!UltraAdminDashboard.instance) {
      UltraAdminDashboard.instance = new UltraAdminDashboard();
    }
    return UltraAdminDashboard.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.accessControl = UltraAccessControl.getInstance();
    this.notificationSystem = UltraNotificationSystem.getInstance();
    this.smartQueue = UltraSmartQueue.getInstance();
    this.sessionHistory = UltraSessionHistory.getInstance();
    this.customerRating = UltraCustomerRating.getInstance();
    this.antiSpam = UltraAntiSpam.getInstance();
    this.multiLanguage = UltraMultiLanguage.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadAlerts();
      await this.loadWidgets();
      await this.loadActivityFeed();
      this.startRealTimeMonitoring();
      
      this.logger.info('admin-dashboard', 'Admin dashboard system initialized', {
        activeWorkspaces: this.metrics.size,
        activeAlerts: Array.from(this.alerts.values()).reduce((sum, alerts) => sum + alerts.size, 0),
        widgetsCount: Array.from(this.widgets.values()).reduce((sum, userWidgets) => sum + userWidgets.size, 0)
      });
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to initialize admin dashboard system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS dashboard_metrics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        active_chats INTEGER DEFAULT 0,
        waiting_chats INTEGER DEFAULT 0,
        total_tickets INTEGER DEFAULT 0,
        open_tickets INTEGER DEFAULT 0,
        closed_tickets INTEGER DEFAULT 0,
        escalated_tickets INTEGER DEFAULT 0,
        average_response_time DECIMAL(8,2),
        average_resolution_time DECIMAL(8,2),
        customer_satisfaction DECIMAL(3,2),
        agent_workload JSONB NOT NULL,
        system_load JSONB NOT NULL,
        spam_detection JSONB NOT NULL,
        language_usage JSONB NOT NULL,
        top_issues JSONB NOT NULL
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS alert_configs (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(20) NOT NULL,
        metric VARCHAR(100) NOT NULL,
        condition VARCHAR(20) NOT NULL,
        threshold DECIMAL(10,2) NOT NULL,
        severity VARCHAR(10) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        notification_channels TEXT[] NOT NULL,
        cooldown_period INTEGER DEFAULT 60,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        config_id VARCHAR(255) NOT NULL,
        metric VARCHAR(100) NOT NULL,
        current_value DECIMAL(10,2) NOT NULL,
        threshold DECIMAL(10,2) NOT NULL,
        severity VARCHAR(10) NOT NULL,
        status VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        acknowledged_by VARCHAR(255),
        acknowledged_at TIMESTAMP,
        resolved_at TIMESTAMP,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS dashboard_widgets (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        type VARCHAR(30) NOT NULL,
        title VARCHAR(255) NOT NULL,
        position JSONB NOT NULL,
        config JSONB NOT NULL,
        is_visible BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS activity_feed (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        type VARCHAR(30) NOT NULL,
        user_id VARCHAR(255),
        agent_id VARCHAR(255),
        ticket_id VARCHAR(255),
        chat_id VARCHAR(255),
        message TEXT NOT NULL,
        metadata JSONB NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_workspace_id ON dashboard_metrics(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_timestamp ON dashboard_metrics(timestamp)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_alert_configs_workspace_id ON alert_configs(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_alerts_workspace_id ON alerts(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_workspace_id ON dashboard_widgets(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user_id ON dashboard_widgets(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_activity_feed_workspace_id ON activity_feed(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_activity_feed_timestamp ON activity_feed(timestamp)');
  }

  private async loadAlerts(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM alerts WHERE status IN (\'active\', \'acknowledged\') ORDER BY created_at DESC');
      
      for (const row of rows) {
        const alert: Alert = {
          id: row.id,
          workspaceId: row.workspace_id,
          configId: row.config_id,
          metric: row.metric,
          currentValue: parseFloat(row.current_value),
          threshold: parseFloat(row.threshold),
          severity: row.severity,
          status: row.status,
          message: row.message,
          acknowledgedBy: row.acknowledged_by,
          acknowledgedAt: row.acknowledged_at,
          resolvedAt: row.resolved_at,
          metadata: row.metadata || {},
          createdAt: row.created_at
        };
        
        if (!this.alerts.has(alert.workspaceId)) {
          this.alerts.set(alert.workspaceId, new Map());
        }
        this.alerts.get(alert.workspaceId)!.set(alert.id, alert);
      }
      
      this.logger.info('admin-dashboard', `Loaded ${this.alerts.size} active alerts`);
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to load alerts', error as Error);
    }
  }

  private async loadWidgets(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM dashboard_widgets WHERE is_visible = TRUE ORDER BY user_id, created_at');
      
      for (const row of rows) {
        const widget: DashboardWidget = {
          id: row.id,
          workspaceId: row.workspace_id,
          userId: row.user_id,
          type: row.type,
          title: row.title,
          position: row.position,
          config: row.config || {},
          isVisible: row.is_visible,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.widgets.has(widget.workspaceId)) {
          this.widgets.set(widget.workspaceId, new Map());
        }
        
        const workspaceWidgets = this.widgets.get(widget.workspaceId)!;
        if (!workspaceWidgets.has(widget.userId)) {
          workspaceWidgets.set(widget.userId, []);
        }
        
        workspaceWidgets.get(widget.userId)!.push(widget);
      }
      
      this.logger.info('admin-dashboard', `Loaded widgets for ${this.widgets.size} workspaces`);
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to load widgets', error as Error);
    }
  }

  private async loadActivityFeed(): Promise<void> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM activity_feed ORDER BY timestamp DESC LIMIT 1000'
      );
      
      for (const row of rows) {
        const item: ActivityFeedItem = {
          id: row.id,
          workspaceId: row.workspace_id,
          type: row.type,
          userId: row.user_id,
          agentId: row.agent_id,
          ticketId: row.ticket_id,
          chatId: row.chat_id,
          message: row.message,
          metadata: row.metadata || {},
          timestamp: row.timestamp
        };
        
        if (!this.activityFeed.has(item.workspaceId)) {
          this.activityFeed.set(item.workspaceId, []);
        }
        
        const feed = this.activityFeed.get(item.workspaceId)!;
        feed.push(item);
        
        // Keep only last 100 items per workspace
        if (feed.length > 100) {
          feed.splice(100);
        }
      }
      
      this.logger.info('admin-dashboard', `Loaded activity feed for ${this.activityFeed.size} workspaces`);
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to load activity feed', error as Error);
    }
  }

  private startRealTimeMonitoring(): void {
    this.isMonitoring = true;
    
    // Update metrics every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.updateMetrics();
        await this.checkAlerts();
      }
    }, 30 * 1000);
  }

  // PUBLIC API METHODS
  async getMetrics(workspaceId: string): Promise<DashboardMetrics | null> {
    try {
      // Return cached metrics or generate new ones
      if (this.metrics.has(workspaceId)) {
        return this.metrics.get(workspaceId)!;
      }
      
      return await this.generateMetrics(workspaceId);
      
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to get metrics', error as Error);
      return null;
    }
  }

  async createAlertConfig(config: {
    workspaceId: string;
    name: string;
    description?: string;
    type: AlertConfig['type'];
    metric: string;
    condition: AlertConfig['condition'];
    threshold: number;
    severity: AlertConfig['severity'];
    notificationChannels: AlertConfig['notificationChannels'];
    cooldownPeriod?: number;
    createdBy: string;
  }): Promise<string> {
    const configId = `alert-config-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const alertConfig: AlertConfig = {
        id: configId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        type: config.type,
        metric: config.metric,
        condition: config.condition,
        threshold: config.threshold,
        severity: config.severity,
        isActive: true,
        notificationChannels: config.notificationChannels,
        cooldownPeriod: config.cooldownPeriod || 60,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO alert_configs (
          id, workspace_id, name, description, type, metric, condition, threshold,
          severity, is_active, notification_channels, cooldown_period, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        alertConfig.id,
        alertConfig.workspaceId,
        alertConfig.name,
        alertConfig.description,
        alertConfig.type,
        alertConfig.metric,
        alertConfig.condition,
        alertConfig.threshold,
        alertConfig.severity,
        alertConfig.isActive,
        alertConfig.notificationChannels,
        alertConfig.cooldownPeriod,
        alertConfig.createdBy,
        alertConfig.createdAt,
        alertConfig.updatedAt
      ]);
      
      this.emit('alertConfigCreated', alertConfig);
      return configId;
      
    } catch (error) {
      this.logger.error('admin-dashboard', `Failed to create alert config: ${configId}`, error as Error);
      throw error;
    }
  }

  async getAlerts(workspaceId: string, status?: Alert['status']): Promise<Alert[]> {
    try {
      const workspaceAlerts = this.alerts.get(workspaceId);
      if (!workspaceAlerts) {
        return [];
      }
      
      let alerts = Array.from(workspaceAlerts.values());
      
      if (status) {
        alerts = alerts.filter(alert => alert.status === status);
      }
      
      return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to get alerts', error as Error);
      return [];
    }
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      const alert = this.findAlert(alertId);
      if (!alert || alert.status !== 'active') {
        return false;
      }
      
      alert.status = 'acknowledged';
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
      
      await this.database.query(
        'UPDATE alerts SET status = $1, acknowledged_by = $2, acknowledged_at = $3 WHERE id = $4',
        [alert.status, alert.acknowledgedBy, alert.acknowledgedAt, alert.id]
      );
      
      this.emit('alertAcknowledged', alert);
      return true;
      
    } catch (error) {
      this.logger.error('admin-dashboard', `Failed to acknowledge alert: ${alertId}`, error as Error);
      return false;
    }
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    try {
      const alert = this.findAlert(alertId);
      if (!alert) {
        return false;
      }
      
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      
      await this.database.query(
        'UPDATE alerts SET status = $1, resolved_at = $2 WHERE id = $3',
        [alert.status, alert.resolvedAt, alert.id]
      );
      
      // Remove from active alerts
      const workspaceAlerts = this.alerts.get(alert.workspaceId);
      if (workspaceAlerts) {
        workspaceAlerts.delete(alert.id);
      }
      
      this.emit('alertResolved', alert);
      return true;
      
    } catch (error) {
      this.logger.error('admin-dashboard', `Failed to resolve alert: ${alertId}`, error as Error);
      return false;
    }
  }

  async createWidget(config: {
    workspaceId: string;
    userId: string;
    type: DashboardWidget['type'];
    title: string;
    position: DashboardWidget['position'];
    config?: Record<string, any>;
  }): Promise<string> {
    const widgetId = `widget-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const widget: DashboardWidget = {
        id: widgetId,
        workspaceId: config.workspaceId,
        userId: config.userId,
        type: config.type,
        title: config.title,
        position: config.position,
        config: config.config || {},
        isVisible: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO dashboard_widgets (
          id, workspace_id, user_id, type, title, position, config, is_visible, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        widget.id,
        widget.workspaceId,
        widget.userId,
        widget.type,
        widget.title,
        JSON.stringify(widget.position),
        JSON.stringify(widget.config),
        widget.isVisible,
        widget.createdAt,
        widget.updatedAt
      ]);
      
      // Update local cache
      if (!this.widgets.has(widget.workspaceId)) {
        this.widgets.set(widget.workspaceId, new Map());
      }
      
      const workspaceWidgets = this.widgets.get(widget.workspaceId)!;
      if (!workspaceWidgets.has(widget.userId)) {
        workspaceWidgets.set(widget.userId, []);
      }
      
      workspaceWidgets.get(widget.userId)!.push(widget);
      
      this.emit('widgetCreated', widget);
      return widgetId;
      
    } catch (error) {
      this.logger.error('admin-dashboard', `Failed to create widget: ${widgetId}`, error as Error);
      throw error;
    }
  }

  async getWidgets(workspaceId: string, userId: string): Promise<DashboardWidget[]> {
    try {
      const workspaceWidgets = this.widgets.get(workspaceId);
      if (!workspaceWidgets) {
        return [];
      }
      
      return workspaceWidgets.get(userId) || [];
      
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to get widgets', error as Error);
      return [];
    }
  }

  async getActivityFeed(workspaceId: string, limit: number = 50): Promise<ActivityFeedItem[]> {
    try {
      const feed = this.activityFeed.get(workspaceId) || [];
      return feed.slice(0, limit);
      
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to get activity feed', error as Error);
      return [];
    }
  }

  async addActivityItem(item: Omit<ActivityFeedItem, 'id' | 'timestamp'>): Promise<string> {
    const itemId = `activity-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const activityItem: ActivityFeedItem = {
        id: itemId,
        ...item,
        timestamp: new Date()
      };
      
      await this.database.query(`
        INSERT INTO activity_feed (
          id, workspace_id, type, user_id, agent_id, ticket_id, chat_id, message, metadata, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        activityItem.id,
        activityItem.workspaceId,
        activityItem.type,
        activityItem.userId,
        activityItem.agentId,
        activityItem.ticketId,
        activityItem.chatId,
        activityItem.message,
        JSON.stringify(activityItem.metadata),
        activityItem.timestamp
      ]);
      
      // Update local cache
      if (!this.activityFeed.has(activityItem.workspaceId)) {
        this.activityFeed.set(activityItem.workspaceId, []);
      }
      
      const feed = this.activityFeed.get(activityItem.workspaceId)!;
      feed.unshift(activityItem);
      
      // Keep only last 100 items
      if (feed.length > 100) {
        feed.splice(100);
      }
      
      this.emit('activityAdded', activityItem);
      return itemId;
      
    } catch (error) {
      this.logger.error('admin-dashboard', `Failed to add activity item: ${itemId}`, error as Error);
      throw error;
    }
  }

  private async generateMetrics(workspaceId: string): Promise<DashboardMetrics> {
    try {
      // Get real-time data from various systems
      const queueStats = await this.smartQueue.getQueueStats(workspaceId);
      const ratingAnalytics = await this.customerRating.getAnalytics(workspaceId);
      const spamAnalytics = await this.antiSpam.getAnalytics(workspaceId);
      const languageAnalytics = await this.multiLanguage.getAnalytics(workspaceId);
      
      // Calculate metrics
      const metrics: DashboardMetrics = {
        workspaceId,
        timestamp: new Date(),
        activeChats: queueStats.activeItems || 0,
        waitingChats: queueStats.waitingItems || 0,
        totalTickets: queueStats.totalItems || 0,
        openTickets: queueStats.openItems || 0,
        closedTickets: queueStats.closedItems || 0,
        escalatedTickets: queueStats.escalatedItems || 0,
        averageResponseTime: queueStats.averageResponseTime || 0,
        averageResolutionTime: queueStats.averageResolutionTime || 0,
        customerSatisfaction: ratingAnalytics.length > 0 ? 
          ratingAnalytics.reduce((sum, r) => sum + r.averageRating, 0) / ratingAnalytics.length : 0,
        agentWorkload: await this.calculateAgentWorkload(workspaceId),
        systemLoad: await this.getSystemLoad(),
        spamDetection: {
          blockedMessages: spamAnalytics.length > 0 ? 
            spamAnalytics.reduce((sum, a) => sum + a.blockedAttempts, 0) : 0,
          suspectedSpam: 0,
          falsePositives: 0
        },
        languageUsage: languageAnalytics.length > 0 ? 
          languageAnalytics[0].translationsByLanguage : {},
        topIssues: await this.getTopIssues(workspaceId)
      };
      
      // Save to database
      await this.database.query(`
        INSERT INTO dashboard_metrics (
          workspace_id, timestamp, active_chats, waiting_chats, total_tickets, open_tickets,
          closed_tickets, escalated_tickets, average_response_time, average_resolution_time,
          customer_satisfaction, agent_workload, system_load, spam_detection, language_usage, top_issues
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        metrics.workspaceId,
        metrics.timestamp,
        metrics.activeChats,
        metrics.waitingChats,
        metrics.totalTickets,
        metrics.openTickets,
        metrics.closedTickets,
        metrics.escalatedTickets,
        metrics.averageResponseTime,
        metrics.averageResolutionTime,
        metrics.customerSatisfaction,
        JSON.stringify(metrics.agentWorkload),
        JSON.stringify(metrics.systemLoad),
        JSON.stringify(metrics.spamDetection),
        JSON.stringify(metrics.languageUsage),
        JSON.stringify(metrics.topIssues)
      ]);
      
      // Update cache
      this.metrics.set(workspaceId, metrics);
      
      return metrics;
      
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to generate metrics', error as Error);
      
      // Return default metrics
      return {
        workspaceId,
        timestamp: new Date(),
        activeChats: 0,
        waitingChats: 0,
        totalTickets: 0,
        openTickets: 0,
        closedTickets: 0,
        escalatedTickets: 0,
        averageResponseTime: 0,
        averageResolutionTime: 0,
        customerSatisfaction: 0,
        agentWorkload: [],
        systemLoad: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, networkLatency: 0 },
        spamDetection: { blockedMessages: 0, suspectedSpam: 0, falsePositives: 0 },
        languageUsage: {},
        topIssues: []
      };
    }
  }

  private async calculateAgentWorkload(workspaceId: string): Promise<DashboardMetrics['agentWorkload']> {
    try {
      // Get agent performance data
      const result = await this.database.query(`
        SELECT 
          agent_id,
          COUNT(*) as total_chats,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_chats,
          AVG(response_time) as avg_response_time,
          AVG(satisfaction_score) as avg_satisfaction
        FROM queue_items 
        WHERE workspace_id = $1 
        AND assigned_to IS NOT NULL
        AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY agent_id
      `, [workspaceId]);
      
      return result.rows.map(row => ({
        agentId: row.agent_id,
        activeChats: parseInt(row.active_chats),
        totalChats: parseInt(row.total_chats),
        averageResponseTime: parseFloat(row.avg_response_time) || 0,
        satisfaction: parseFloat(row.avg_satisfaction) || 0
      }));
      
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to calculate agent workload', error as Error);
      return [];
    }
  }

  private async getSystemLoad(): Promise<DashboardMetrics['systemLoad']> {
    try {
      // Mock system load metrics - in production would get actual system metrics
      return {
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        diskUsage: Math.random() * 100,
        networkLatency: 10 + Math.random() * 100
      };
      
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to get system load', error as Error);
      return { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, networkLatency: 0 };
    }
  }

  private async getTopIssues(workspaceId: string): Promise<DashboardMetrics['topIssues']> {
    try {
      const result = await this.database.query(`
        SELECT 
          category,
          COUNT(*) as count,
          CASE 
            WHEN COUNT(*) > LAG(COUNT(*)) OVER (ORDER BY DATE(created_at) DESC) THEN 'up'
            WHEN COUNT(*) < LAG(COUNT(*)) OVER (ORDER BY DATE(created_at) DESC) THEN 'down'
            ELSE 'stable'
          END as trend
        FROM queue_items 
        WHERE workspace_id = $1 
        AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY category
        ORDER BY count DESC
        LIMIT 5
      `, [workspaceId]);
      
      return result.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count),
        trend: row.trend || 'stable'
      }));
      
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to get top issues', error as Error);
      return [];
    }
  }

  private async updateMetrics(): Promise<void> {
    try {
      // Get all active workspaces
      const workspaces = await this.database.query('SELECT DISTINCT workspace_id FROM queue_items');
      
      for (const row of workspaces.rows) {
        const workspaceId = row.workspace_id;
        await this.generateMetrics(workspaceId);
      }
      
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to update metrics', error as Error);
    }
  }

  private async checkAlerts(): Promise<void> {
    try {
      const configs = await this.database.query('SELECT * FROM alert_configs WHERE is_active = TRUE');
      
      for (const configRow of configs.rows) {
        const config: AlertConfig = {
          ...configRow,
          notificationChannels: configRow.notification_channels
        };
        
        // Get current metrics for the workspace
        const metrics = await this.getMetrics(config.workspaceId);
        if (!metrics) continue;
        
        // Get the metric value
        const currentValue = this.getMetricValue(metrics, config.metric);
        if (currentValue === null) continue;
        
        // Check if alert condition is met
        const conditionMet = this.evaluateCondition(currentValue, config.condition, config.threshold);
        
        if (conditionMet) {
          await this.triggerAlert(config, currentValue);
        }
      }
      
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to check alerts', error as Error);
    }
  }

  private getMetricValue(metrics: DashboardMetrics, metric: string): number | null {
    switch (metric) {
      case 'activeChats': return metrics.activeChats;
      case 'waitingChats': return metrics.waitingChats;
      case 'openTickets': return metrics.openTickets;
      case 'escalatedTickets': return metrics.escalatedTickets;
      case 'averageResponseTime': return metrics.averageResponseTime;
      case 'averageResolutionTime': return metrics.averageResolutionTime;
      case 'customerSatisfaction': return metrics.customerSatisfaction;
      case 'cpuUsage': return metrics.systemLoad.cpuUsage;
      case 'memoryUsage': return metrics.systemLoad.memoryUsage;
      case 'diskUsage': return metrics.systemLoad.diskUsage;
      case 'networkLatency': return metrics.systemLoad.networkLatency;
      case 'blockedMessages': return metrics.spamDetection.blockedMessages;
      default: return null;
    }
  }

  private evaluateCondition(currentValue: number, condition: AlertConfig['condition'], threshold: number): boolean {
    switch (condition) {
      case 'greater_than': return currentValue > threshold;
      case 'less_than': return currentValue < threshold;
      case 'equals': return currentValue === threshold;
      case 'not_equals': return currentValue !== threshold;
      default: return false;
    }
  }

  private async triggerAlert(config: AlertConfig, currentValue: number): Promise<void> {
    try {
      // Check cooldown period
      const recentAlerts = Array.from(this.alerts.get(config.workspaceId)?.values() || [])
        .filter(alert => 
          alert.configId === config.id && 
          alert.status === 'active' &&
          (Date.now() - alert.createdAt.getTime()) < config.cooldownPeriod * 60 * 1000
        );
      
      if (recentAlerts.length > 0) {
        return; // Still in cooldown period
      }
      
      // Create alert
      const alertId = `alert-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const alert: Alert = {
        id: alertId,
        workspaceId: config.workspaceId,
        configId: config.id,
        metric: config.metric,
        currentValue,
        threshold: config.threshold,
        severity: config.severity,
        status: 'active',
        message: `${config.name}: ${config.metric} is ${currentValue} (threshold: ${config.threshold})`,
        metadata: {
          configName: config.name,
          description: config.description
        },
        createdAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO alerts (
          id, workspace_id, config_id, metric, current_value, threshold, severity,
          status, message, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        alert.id,
        alert.workspaceId,
        alert.configId,
        alert.metric,
        alert.currentValue,
        alert.threshold,
        alert.severity,
        alert.status,
        alert.message,
        JSON.stringify(alert.metadata),
        alert.createdAt
      ]);
      
      // Add to active alerts
      if (!this.alerts.has(alert.workspaceId)) {
        this.alerts.set(alert.workspaceId, new Map());
      }
      this.alerts.get(alert.workspaceId)!.set(alert.id, alert);
      
      // Send notifications
      await this.sendAlertNotifications(alert, config);
      
      // Add to activity feed
      await this.addActivityItem({
        workspaceId: alert.workspaceId,
        type: 'system_alert',
        message: alert.message,
        metadata: {
          alertId: alert.id,
          severity: alert.severity,
          metric: alert.metric
        }
      });
      
      this.emit('alertTriggered', alert);
      
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to trigger alert', error as Error);
    }
  }

  private async sendAlertNotifications(alert: Alert, config: AlertConfig): Promise<void> {
    try {
      // Get admins to notify
      const admins = await this.database.query(
        `SELECT user_id FROM workspace_members WHERE role IN ('admin', 'super_admin') AND workspace_id = $1`,
        [alert.workspaceId]
      );
      
      for (const admin of admins.rows) {
        if (config.notificationChannels.includes('in_app')) {
          await this.notificationSystem.createNotification({
            userId: admin.user_id,
            workspaceId: alert.workspaceId,
            type: 'system',
            title: `Alert: ${config.name}`,
            content: alert.message,
            data: {
              alertId: alert.id,
              severity: alert.severity,
              metric: alert.metric,
              currentValue: alert.currentValue,
              threshold: alert.threshold
            },
            priority: alert.severity === 'critical' ? 'urgent' : 
                     alert.severity === 'high' ? 'high' : 'medium'
          });
        }
        
        // Add other notification channels (email, SMS, webhook) here
      }
      
    } catch (error) {
      this.logger.error('admin-dashboard', 'Failed to send alert notifications', error as Error);
    }
  }

  private findAlert(alertId: string): Alert | null {
    for (const workspaceAlerts of this.alerts.values()) {
      const alert = workspaceAlerts.get(alertId);
      if (alert) {
        return alert;
      }
    }
    return null;
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    monitoringActive: boolean;
    activeWorkspacesCount: number;
    activeAlertsCount: number;
    widgetsCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!this.isMonitoring) {
      issues.push('Real-time monitoring is not active');
    }
    
    return {
      healthy: issues.length === 0,
      monitoringActive: this.isMonitoring,
      activeWorkspacesCount: this.metrics.size,
      activeAlertsCount: Array.from(this.alerts.values()).reduce((sum, alerts) => sum + alerts.size, 0),
      widgetsCount: Array.from(this.widgets.values()).reduce((sum, userWidgets) => sum + userWidgets.size, 0),
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.metrics.clear();
    this.alerts.clear();
    this.widgets.clear();
    this.activityFeed.clear();
    
    this.logger.info('admin-dashboard', 'Admin dashboard system shut down');
  }
}

export default UltraAdminDashboard;
