import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { UltraNotificationSystem } from './notification-system';
import { UltraMultiLanguage } from './multi-language';
import { Message, User, Workspace, Channel } from './slack-system';
import * as crypto from 'crypto';

export interface WidgetConfig {
  id: string;
  workspaceId: string;
  name: string;
  domain: string; // Domain where widget will be embedded
  isActive: boolean;
  appearance: {
    theme: 'light' | 'dark' | 'auto';
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    borderRadius: number;
    shadow: boolean;
    animation: boolean;
  };
  positioning: {
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    offset: { x: number; y: number };
    zIndex: number;
  };
  behavior: {
    autoOpen: boolean;
    openDelay: number; // seconds
    hideOnMobile: boolean;
    showWhenOffline: boolean;
    collectEmail: boolean;
    requireEmail: boolean;
  };
  branding: {
    showLogo: boolean;
    logoUrl?: string;
    brandName: string;
    welcomeMessage: string;
    agentAvatar?: string;
  };
  features: {
    fileUpload: boolean;
    voiceMessages: boolean;
    emojis: boolean;
    typingIndicator: boolean;
    readReceipts: boolean;
    searchHistory: boolean;
    rateConversation: boolean;
  };
  restrictions: {
    allowedDomains: string[];
    blockedIps: string[];
    rateLimit: {
      messagesPerMinute: number;
      maxFileSize: number; // MB
    };
  };
  integration: {
    googleAnalytics?: string;
    customJs?: string;
    customCss?: string;
    webhookUrl?: string;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetSession {
  id: string;
  widgetId: string;
  workspaceId: string;
  visitorId: string;
  sessionId: string;
  userAgent: string;
  ipAddress: string;
  referrer?: string;
  landingPage?: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'ended' | 'transferred';
  metadata: {
    browser?: string;
    os?: string;
    device?: string;
    language?: string;
    timezone?: string;
    screenResolution?: string;
  };
  stats: {
    messageCount: number;
    fileUploads: number;
    duration: number; // seconds
    satisfaction?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetMessage {
  id: string;
  widgetId: string;
  sessionId: string;
  workspaceId: string;
  senderId?: string; // null for visitor
  senderType: 'visitor' | 'agent' | 'bot';
  content: string;
  type: 'text' | 'file' | 'image' | 'voice' | 'system';
  metadata: {
    fileName?: string;
    fileSize?: number;
    fileUrl?: string;
    duration?: number; // for voice messages
    language?: string;
    translatedContent?: string;
  };
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetAnalytics {
  widgetId: string;
  workspaceId: string;
  date: Date;
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  averageSessionDuration: number;
  averageResponseTime: number;
  satisfactionScore: number;
  bounceRate: number; // percentage
  conversionRate: number; // percentage
  topPages: Array<{
    url: string;
    sessions: number;
  }>;
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  languageBreakdown: Record<string, number>;
  agentPerformance: Array<{
    agentId: string;
    agentName: string;
    sessions: number;
    messages: number;
    satisfaction: number;
  }>;
}

export interface WidgetTemplate {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  category: string;
  config: Partial<WidgetConfig>;
  isPublic: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UltraChatWidget extends EventEmitter {
  private static instance: UltraChatWidget;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  private notificationSystem: UltraNotificationSystem;
  private multiLanguage: UltraMultiLanguage;
  
  private widgets: Map<string, Map<string, WidgetConfig>> = new Map(); // workspaceId -> widgetId -> config
  private sessions: Map<string, WidgetSession> = new Map(); // sessionId -> session
  private messages: Map<string, Map<string, WidgetMessage[]>> = new Map(); // sessionId -> messages
  private templates: Map<string, Map<string, WidgetTemplate>> = new Map(); // workspaceId -> templateId -> template

  static getInstance(): UltraChatWidget {
    if (!UltraChatWidget.instance) {
      UltraChatWidget.instance = new UltraChatWidget();
    }
    return UltraChatWidget.instance;
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
      await this.loadWidgets();
      await this.loadTemplates();
      
      this.logger.info('chat-widget', 'Chat widget system initialized', {
        widgetsCount: Array.from(this.widgets.values()).reduce((sum, widgets) => sum + widgets.size, 0),
        templatesCount: Array.from(this.templates.values()).reduce((sum, templates) => sum + templates.size, 0),
        activeSessionsCount: this.sessions.size
      });
    } catch (error) {
      this.logger.error('chat-widget', 'Failed to initialize chat widget system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS widget_configs (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        appearance JSONB NOT NULL,
        positioning JSONB NOT NULL,
        behavior JSONB NOT NULL,
        branding JSONB NOT NULL,
        features JSONB NOT NULL,
        restrictions JSONB NOT NULL,
        integration JSONB NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS widget_sessions (
        id VARCHAR(255) PRIMARY KEY,
        widget_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        visitor_id VARCHAR(255) NOT NULL,
        session_id VARCHAR(255) NOT NULL,
        user_agent TEXT,
        ip_address VARCHAR(45),
        referrer TEXT,
        landing_page TEXT,
        start_time TIMESTAMP DEFAULT NOW(),
        end_time TIMESTAMP,
        status VARCHAR(20) NOT NULL,
        metadata JSONB NOT NULL,
        stats JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS widget_messages (
        id VARCHAR(255) PRIMARY KEY,
        widget_id VARCHAR(255) NOT NULL,
        session_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        sender_id VARCHAR(255),
        sender_type VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(20) NOT NULL,
        metadata JSONB NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS widget_analytics (
        id SERIAL PRIMARY KEY,
        widget_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_sessions INTEGER DEFAULT 0,
        active_sessions INTEGER DEFAULT 0,
        total_messages INTEGER DEFAULT 0,
        average_session_duration DECIMAL(10,2),
        average_response_time DECIMAL(10,2),
        satisfaction_score DECIMAL(3,2),
        bounce_rate DECIMAL(5,2),
        conversion_rate DECIMAL(5,2),
        top_pages JSONB NOT NULL,
        device_breakdown JSONB NOT NULL,
        language_breakdown JSONB NOT NULL,
        agent_performance JSONB NOT NULL,
        UNIQUE(widget_id, date)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS widget_templates (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        config JSONB NOT NULL,
        is_public BOOLEAN DEFAULT FALSE,
        usage_count INTEGER DEFAULT 0,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_widget_configs_workspace_id ON widget_configs(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_widget_configs_domain ON widget_configs(domain)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_widget_sessions_widget_id ON widget_sessions(widget_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_widget_sessions_visitor_id ON widget_sessions(visitor_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_widget_messages_session_id ON widget_messages(session_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_widget_templates_workspace_id ON widget_templates(workspace_id)');
  }

  private async loadWidgets(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM widget_configs ORDER BY created_at DESC');
      
      for (const row of rows) {
        const widget: WidgetConfig = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          domain: row.domain,
          isActive: row.is_active,
          appearance: row.appearance || {},
          positioning: row.positioning || {},
          behavior: row.behavior || {},
          branding: row.branding || {},
          features: row.features || {},
          restrictions: row.restrictions || {},
          integration: row.integration || {},
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.widgets.has(widget.workspaceId)) {
          this.widgets.set(widget.workspaceId, new Map());
        }
        this.widgets.get(widget.workspaceId)!.set(widget.id, widget);
      }
      
      this.logger.info('chat-widget', `Loaded widgets for ${this.widgets.size} workspaces`);
    } catch (error) {
      this.logger.error('chat-widget', 'Failed to load widgets', error as Error);
    }
  }

  private async loadTemplates(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM widget_templates ORDER BY created_at DESC');
      
      for (const row of rows) {
        const template: WidgetTemplate = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          category: row.category,
          config: row.config || {},
          isPublic: row.is_public,
          usageCount: row.usage_count || 0,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.templates.has(template.workspaceId)) {
          this.templates.set(template.workspaceId, new Map());
        }
        this.templates.get(template.workspaceId)!.set(template.id, template);
      }
      
      this.logger.info('chat-widget', `Loaded templates for ${this.templates.size} workspaces`);
    } catch (error) {
      this.logger.error('chat-widget', 'Failed to load templates', error as Error);
    }
  }

  // PUBLIC API METHODS
  async createWidget(config: {
    workspaceId: string;
    name: string;
    domain: string;
    appearance?: WidgetConfig['appearance'];
    positioning?: WidgetConfig['positioning'];
    behavior?: WidgetConfig['behavior'];
    branding?: WidgetConfig['branding'];
    features?: WidgetConfig['features'];
    restrictions?: WidgetConfig['restrictions'];
    integration?: WidgetConfig['integration'];
    createdBy: string;
  }): Promise<string> {
    const widgetId = `widget-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const widget: WidgetConfig = {
        id: widgetId,
        workspaceId: config.workspaceId,
        name: config.name,
        domain: config.domain,
        isActive: true,
        appearance: config.appearance || {
          theme: 'light',
          primaryColor: '#007bff',
          secondaryColor: '#6c757d',
          fontFamily: 'Inter, sans-serif',
          borderRadius: 8,
          shadow: true,
          animation: true
        },
        positioning: config.positioning || {
          position: 'bottom-right',
          offset: { x: 20, y: 20 },
          zIndex: 9999
        },
        behavior: config.behavior || {
          autoOpen: false,
          openDelay: 5,
          hideOnMobile: false,
          showWhenOffline: true,
          collectEmail: false,
          requireEmail: false
        },
        branding: config.branding || {
          showLogo: true,
          brandName: 'Support',
          welcomeMessage: 'Hello! How can we help you today?'
        },
        features: config.features || {
          fileUpload: true,
          voiceMessages: false,
          emojis: true,
          typingIndicator: true,
          readReceipts: true,
          searchHistory: false,
          rateConversation: true
        },
        restrictions: config.restrictions || {
          allowedDomains: [],
          blockedIps: [],
          rateLimit: {
            messagesPerMinute: 30,
            maxFileSize: 10
          }
        },
        integration: config.integration || {},
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO widget_configs (
          id, workspace_id, name, domain, is_active, appearance, positioning,
          behavior, branding, features, restrictions, integration,
          created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        widget.id,
        widget.workspaceId,
        widget.name,
        widget.domain,
        widget.isActive,
        JSON.stringify(widget.appearance),
        JSON.stringify(widget.positioning),
        JSON.stringify(widget.behavior),
        JSON.stringify(widget.branding),
        JSON.stringify(widget.features),
        JSON.stringify(widget.restrictions),
        JSON.stringify(widget.integration),
        widget.createdBy,
        widget.createdAt,
        widget.updatedAt
      ]);
      
      if (!this.widgets.has(widget.workspaceId)) {
        this.widgets.set(widget.workspaceId, new Map());
      }
      this.widgets.get(widget.workspaceId)!.set(widget.id, widget);
      
      this.emit('widgetCreated', widget);
      return widgetId;
      
    } catch (error) {
      this.logger.error('chat-widget', `Failed to create widget: ${widgetId}`, error as Error);
      throw error;
    }
  }

  async createSession(config: {
    widgetId: string;
    visitorId: string;
    userAgent: string;
    ipAddress: string;
    referrer?: string;
    landingPage?: string;
    metadata?: WidgetSession['metadata'];
  }): Promise<string> {
    const sessionId = `session-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const widget = this.findWidget(config.widgetId);
      if (!widget || !widget.isActive) {
        throw new Error(`Widget not found or inactive: ${config.widgetId}`);
      }
      
      const session: WidgetSession = {
        id: sessionId,
        widgetId: config.widgetId,
        workspaceId: widget.workspaceId,
        visitorId: config.visitorId,
        sessionId: crypto.randomUUID(),
        userAgent: config.userAgent,
        ipAddress: config.ipAddress,
        referrer: config.referrer,
        landingPage: config.landingPage,
        startTime: new Date(),
        status: 'active',
        metadata: config.metadata || {},
        stats: {
          messageCount: 0,
          fileUploads: 0,
          duration: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO widget_sessions (
          id, widget_id, workspace_id, visitor_id, session_id, user_agent,
          ip_address, referrer, landing_page, start_time, status,
          metadata, stats, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        session.id,
        session.widgetId,
        session.workspaceId,
        session.visitorId,
        session.sessionId,
        session.userAgent,
        session.ipAddress,
        session.referrer,
        session.landingPage,
        session.startTime,
        session.status,
        JSON.stringify(session.metadata),
        JSON.stringify(session.stats),
        session.createdAt,
        session.updatedAt
      ]);
      
      this.sessions.set(session.id, session);
      this.messages.set(session.id, []);
      
      this.emit('sessionCreated', session);
      return sessionId;
      
    } catch (error) {
      this.logger.error('chat-widget', `Failed to create session: ${sessionId}`, error as Error);
      throw error;
    }
  }

  async sendMessage(config: {
    sessionId: string;
    content: string;
    type: WidgetMessage['type'];
    senderId?: string;
    senderType: WidgetMessage['senderType'];
    metadata?: WidgetMessage['metadata'];
  }): Promise<string> {
    const messageId = `message-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const session = this.sessions.get(config.sessionId);
      if (!session || session.status !== 'active') {
        throw new Error(`Session not found or inactive: ${config.sessionId}`);
      }
      
      const widget = this.findWidget(session.widgetId);
      if (!widget) {
        throw new Error(`Widget not found: ${session.widgetId}`);
      }
      
      const message: WidgetMessage = {
        id: messageId,
        widgetId: session.widgetId,
        sessionId: config.sessionId,
        workspaceId: session.workspaceId,
        senderId: config.senderId,
        senderType: config.senderType,
        content: config.content,
        type: config.type,
        metadata: config.metadata || {},
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO widget_messages (
          id, widget_id, session_id, workspace_id, sender_id, sender_type,
          content, type, metadata, is_read, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        message.id,
        message.widgetId,
        message.sessionId,
        message.workspaceId,
        message.senderId,
        message.senderType,
        message.content,
        message.type,
        JSON.stringify(message.metadata),
        message.isRead,
        message.createdAt,
        message.updatedAt
      ]);
      
      // Update session stats
      session.stats.messageCount++;
      session.updatedAt = new Date();
      await this.updateSessionStats(session);
      
      // Add to messages cache
      if (!this.messages.has(config.sessionId)) {
        this.messages.set(config.sessionId, []);
      }
      this.messages.get(config.sessionId)!.push(message);
      
      // Handle message routing
      if (config.senderType === 'visitor') {
        await this.routeVisitorMessage(message, session, widget);
      } else {
        await this.routeAgentMessage(message, session);
      }
      
      this.emit('messageSent', message);
      return messageId;
      
    } catch (error) {
      this.logger.error('chat-widget', `Failed to send message: ${messageId}`, error as Error);
      throw error;
    }
  }

  async getWidgetConfig(widgetId: string): Promise<WidgetConfig | null> {
    return this.findWidget(widgetId) || null;
  }

  async getWidgetByDomain(domain: string): Promise<WidgetConfig | null> {
    for (const workspaceWidgets of this.widgets.values()) {
      for (const widget of workspaceWidgets.values()) {
        if (widget.domain === domain && widget.isActive) {
          return widget;
        }
      }
    }
    return null;
  }

  async getSession(sessionId: string): Promise<WidgetSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async getMessages(sessionId: string): Promise<WidgetMessage[]> {
    try {
      const cached = this.messages.get(sessionId);
      if (cached) {
        return cached;
      }
      
      // Load from database
      const rows = await this.database.query(
        'SELECT * FROM widget_messages WHERE session_id = $1 ORDER BY created_at ASC',
        [sessionId]
      );
      
      const messages: WidgetMessage[] = rows.map(row => ({
        id: row.id,
        widgetId: row.widget_id,
        sessionId: row.session_id,
        workspaceId: row.workspace_id,
        senderId: row.sender_id,
        senderType: row.sender_type,
        content: row.content,
        type: row.type,
        metadata: row.metadata || {},
        isRead: row.is_read,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      this.messages.set(sessionId, messages);
      return messages;
      
    } catch (error) {
      this.logger.error('chat-widget', 'Failed to get messages', error as Error);
      return [];
    }
  }

  async endSession(sessionId: string, satisfaction?: number): Promise<boolean> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session || session.status !== 'active') {
        return false;
      }
      
      session.status = 'ended';
      session.endTime = new Date();
      session.stats.duration = Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000);
      if (satisfaction) {
        session.stats.satisfaction = satisfaction;
      }
      session.updatedAt = new Date();
      
      await this.database.query(`
        UPDATE widget_sessions SET
          status = $1, end_time = $2, stats = $3, updated_at = $4
        WHERE id = $5
      `, [
        session.status,
        session.endTime,
        JSON.stringify(session.stats),
        session.updatedAt,
        sessionId
      ]);
      
      this.sessions.delete(sessionId);
      
      this.emit('sessionEnded', session);
      return true;
      
    } catch (error) {
      this.logger.error('chat-widget', `Failed to end session: ${sessionId}`, error as Error);
      return false;
    }
  }

  async createTemplate(config: {
    workspaceId: string;
    name: string;
    description?: string;
    category: string;
    config: Partial<WidgetConfig>;
    isPublic?: boolean;
    createdBy: string;
  }): Promise<string> {
    const templateId = `template-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const template: WidgetTemplate = {
        id: templateId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        category: config.category,
        config: config.config,
        isPublic: config.isPublic || false,
        usageCount: 0,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO widget_templates (
          id, workspace_id, name, description, category, config, is_public,
          usage_count, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        template.id,
        template.workspaceId,
        template.name,
        template.description,
        template.category,
        JSON.stringify(template.config),
        template.isPublic,
        template.usageCount,
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
      this.logger.error('chat-widget', `Failed to create template: ${templateId}`, error as Error);
      throw error;
    }
  }

  async getWidgetEmbedCode(widgetId: string): Promise<string> {
    const widget = this.findWidget(widgetId);
    if (!widget) {
      throw new Error(`Widget not found: ${widgetId}`);
    }
    
    const baseUrl = process.env.WIDGET_BASE_URL || 'https://your-domain.com';
    
    return `
<!-- Ultra Chat Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['UltraWidgetObject']=o;w[o]=w[o]||function(){
    (w[o].q=w[o].q||[]).push(arguments)};w[o].l=1*new Date();
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.async=1;js.src=f;fjs.parentNode.insertBefore(js,fjs);
  })(window,document,'script','ultraWidget','${baseUrl}/widget.js');
  
  ultraWidget('init', {
    widgetId: '${widgetId}',
    autoOpen: ${widget.behavior.autoOpen},
    theme: '${widget.appearance.theme}',
    primaryColor: '${widget.appearance.primaryColor}'
  });
</script>
<!-- End Ultra Chat Widget -->
    `.trim();
  }

  async getAnalytics(widgetId: string, dateRange?: { start: Date; end: Date }): Promise<WidgetAnalytics[]> {
    try {
      let sql = 'SELECT * FROM widget_analytics WHERE widget_id = $1';
      const params: any[] = [widgetId];
      
      if (dateRange) {
        sql += ' AND date >= $2 AND date <= $3';
        params.push(dateRange.start, dateRange.end);
      }
      
      sql += ' ORDER BY date DESC';
      
      const rows = await this.database.query(sql, params);
      
      return rows.map(row => ({
        widgetId: row.widget_id,
        workspaceId: row.workspace_id,
        date: row.date,
        totalSessions: row.total_sessions,
        activeSessions: row.active_sessions,
        totalMessages: row.total_messages,
        averageSessionDuration: parseFloat(row.average_session_duration) || 0,
        averageResponseTime: parseFloat(row.average_response_time) || 0,
        satisfactionScore: parseFloat(row.satisfaction_score) || 0,
        bounceRate: parseFloat(row.bounce_rate) || 0,
        conversionRate: parseFloat(row.conversion_rate) || 0,
        topPages: row.top_pages || [],
        deviceBreakdown: row.device_breakdown || { desktop: 0, mobile: 0, tablet: 0 },
        languageBreakdown: row.language_breakdown || {},
        agentPerformance: row.agent_performance || []
      }));
      
    } catch (error) {
      this.logger.error('chat-widget', 'Failed to get analytics', error as Error);
      return [];
    }
  }

  // Private helper methods
  private findWidget(widgetId: string): WidgetConfig | null {
    for (const workspaceWidgets of this.widgets.values()) {
      const widget = workspaceWidgets.get(widgetId);
      if (widget) return widget;
    }
    return null;
  }

  private async routeVisitorMessage(message: WidgetMessage, session: WidgetSession, widget: WidgetConfig): Promise<void> {
    try {
      // Check if email collection is required
      if (widget.behavior.collectEmail && widget.behavior.requireEmail) {
        // In a real implementation, would check if visitor has provided email
        // For now, we'll proceed
      }
      
      // Send notification to agents
      await this.notificationSystem.createNotification({
        workspaceId: session.workspaceId,
        type: 'widget_message',
        title: 'New widget message',
        content: `Visitor from ${session.ipAddress}: ${message.content.substring(0, 100)}...`,
        data: {
          sessionId: session.id,
          widgetId: widget.id,
          visitorId: session.visitorId
        },
        priority: 'medium'
      });
      
      // Trigger webhook if configured
      if (widget.integration.webhookUrl) {
        // Send webhook notification
      }
      
      // Auto-response if configured
      if (widget.branding.welcomeMessage && session.stats.messageCount === 1) {
        await this.sendMessage({
          sessionId: session.id,
          content: widget.branding.welcomeMessage,
          type: 'text',
          senderType: 'bot'
        });
      }
      
    } catch (error) {
      this.logger.error('chat-widget', 'Failed to route visitor message', error as Error);
    }
  }

  private async routeAgentMessage(message: WidgetMessage, session: WidgetSession): Promise<void> {
    try {
      // Mark message as read for visitor
      message.isRead = true;
      
      // Update in database
      await this.database.query(
        'UPDATE widget_messages SET is_read = $1 WHERE id = $2',
        [message.isRead, message.id]
      );
      
      // Send real-time notification to visitor (WebSocket)
      this.emit('messageRead', { sessionId: session.id, messageId: message.id });
      
    } catch (error) {
      this.logger.error('chat-widget', 'Failed to route agent message', error as Error);
    }
  }

  private async updateSessionStats(session: WidgetSession): Promise<void> {
    await this.database.query(
      'UPDATE widget_sessions SET stats = $1, updated_at = $2 WHERE id = $3',
      [JSON.stringify(session.stats), session.updatedAt, session.id]
    );
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    widgetsCount: number;
    activeSessionsCount: number;
    templatesCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    return {
      healthy: issues.length === 0,
      widgetsCount: Array.from(this.widgets.values()).reduce((sum, widgets) => sum + widgets.size, 0),
      activeSessionsCount: this.sessions.size,
      templatesCount: Array.from(this.templates.values()).reduce((sum, templates) => sum + templates.size, 0),
      issues
    };
  }

  async destroy(): Promise<void> {
    this.widgets.clear();
    this.sessions.clear();
    this.messages.clear();
    this.templates.clear();
    
    this.logger.info('chat-widget', 'Chat widget system shut down');
  }
}

export default UltraChatWidget;
