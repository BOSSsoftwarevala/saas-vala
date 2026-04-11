import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { Message, User, Workspace, Channel } from './slack-system';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';

export interface Webhook {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  retryConfig: {
    maxRetries: number;
    retryDelay: number; // seconds
    backoffMultiplier: number;
  };
  headers: Record<string, string>;
  timeout: number; // milliseconds
  verifySsl: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  successCount: number;
  failureCount: number;
}

export interface WebhookEvent {
  id: string;
  workspaceId: string;
  eventType: string;
  data: any;
  timestamp: Date;
  userId?: string;
  metadata: {
    source: string;
    version: string;
    idempotencyKey: string;
  };
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  workspaceId: string;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  statusCode?: number;
  response?: string;
  error?: string;
  attempt: number;
  nextRetryAt?: Date;
  duration: number; // milliseconds
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiHook {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  triggers: {
    type: 'webhook' | 'schedule' | 'event' | 'manual';
    config: any;
  };
  authentication: {
    type: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth2';
    config: any;
  };
  requestConfig: {
    headers: Record<string, string>;
    bodyTemplate?: string;
    queryParams?: Record<string, string>;
    timeout: number;
  };
  responseHandling: {
    successCodes: number[];
    errorHandling: 'ignore' | 'retry' | 'alert';
    dataExtraction?: {
      path: string; // JSONPath to extract data
      type: 'string' | 'number' | 'boolean' | 'object';
    };
  };
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastExecuted?: Date;
  executionCount: number;
  successCount: number;
  failureCount: number;
}

export interface HookExecution {
  id: string;
  hookId: string;
  workspaceId: string;
  triggerType: ApiHook['triggers']['type'];
  triggerData?: any;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  };
  response: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    extractedData?: any;
  };
  status: 'pending' | 'success' | 'failed' | 'timeout';
  duration: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface WebhookAnalytics {
  workspaceId: string;
  date: Date;
  totalWebhooks: number;
  activeWebhooks: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageResponseTime: number;
  topEvents: Array<{
    eventType: string;
    count: number;
  }>;
  webhookPerformance: Array<{
    webhookId: string;
    webhookName: string;
    deliveries: number;
    successRate: number;
    averageResponseTime: number;
  }>;
  errorAnalysis: {
    commonErrors: Array<{
      error: string;
      count: number;
    }>;
    timeouts: number;
    sslErrors: number;
  };
}

export class UltraWebhookHooks extends EventEmitter {
  private static instance: UltraWebhookHooks;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  
  private webhooks: Map<string, Map<string, Webhook>> = new Map(); // workspaceId -> webhookId -> webhook
  private apiHooks: Map<string, Map<string, ApiHook>> = new Map(); // workspaceId -> hookId -> hook
  private deliveries: Map<string, Map<string, WebhookDelivery>> = new Map(); // webhookId -> deliveryId -> delivery
  private executions: Map<string, Map<string, HookExecution>> = new Map(); // hookId -> executionId -> execution
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout;

  static getInstance(): UltraWebhookHooks {
    if (!UltraWebhookHooks.instance) {
      UltraWebhookHooks.instance = new UltraWebhookHooks();
    }
    return UltraWebhookHooks.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.accessControl = UltraAccessControl.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadWebhooks();
      await this.loadApiHooks();
      await this.loadPendingDeliveries();
      this.startProcessing();
      
      this.logger.info('webhook-hooks', 'Webhook and API hooks system initialized', {
        webhooksCount: Array.from(this.webhooks.values()).reduce((sum, webhooks) => sum + webhooks.size, 0),
        hooksCount: Array.from(this.apiHooks.values()).reduce((sum, hooks) => sum + hooks.size, 0),
        pendingDeliveriesCount: Array.from(this.deliveries.values()).reduce((sum, deliveries) => 
          sum + Array.from(deliveries.values()).filter(d => d.status === 'pending' || d.status === 'retrying').length, 0)
      });
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to initialize webhook and API hooks system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        events TEXT[] NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        secret VARCHAR(255),
        retry_config JSONB NOT NULL,
        headers JSONB NOT NULL,
        timeout INTEGER DEFAULT 30000,
        verify_ssl BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_triggered TIMESTAMP,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        data JSONB NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW(),
        user_id VARCHAR(255),
        metadata JSONB NOT NULL
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id VARCHAR(255) PRIMARY KEY,
        webhook_id VARCHAR(255) NOT NULL,
        event_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        status_code INTEGER,
        response TEXT,
        error TEXT,
        attempt INTEGER DEFAULT 1,
        next_retry_at TIMESTAMP,
        duration INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS api_hooks (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        endpoint VARCHAR(500) NOT NULL,
        method VARCHAR(10) NOT NULL,
        triggers JSONB NOT NULL,
        authentication JSONB NOT NULL,
        request_config JSONB NOT NULL,
        response_handling JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_executed TIMESTAMP,
        execution_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS hook_executions (
        id VARCHAR(255) PRIMARY KEY,
        hook_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        trigger_type VARCHAR(20) NOT NULL,
        trigger_data JSONB,
        request JSONB NOT NULL,
        response JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        duration INTEGER NOT NULL,
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS webhook_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_webhooks INTEGER DEFAULT 0,
        active_webhooks INTEGER DEFAULT 0,
        total_deliveries INTEGER DEFAULT 0,
        successful_deliveries INTEGER DEFAULT 0,
        failed_deliveries INTEGER DEFAULT 0,
        average_response_time DECIMAL(10,2),
        top_events JSONB NOT NULL,
        webhook_performance JSONB NOT NULL,
        error_analysis JSONB NOT NULL,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_id ON webhooks(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_webhooks_events ON webhooks USING GIN(events)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_webhook_events_workspace_id ON webhook_events(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_api_hooks_workspace_id ON api_hooks(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_hook_executions_hook_id ON hook_executions(hook_id)');
  }

  private async loadWebhooks(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM webhooks ORDER BY created_at DESC');
      
      for (const row of rows) {
        const webhook: Webhook = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          url: row.url,
          events: row.events || [],
          isActive: row.is_active,
          secret: row.secret,
          retryConfig: row.retry_config || { maxRetries: 3, retryDelay: 60, backoffMultiplier: 2 },
          headers: row.headers || {},
          timeout: row.timeout || 30000,
          verifySsl: row.verify_ssl,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastTriggered: row.last_triggered,
          successCount: row.success_count || 0,
          failureCount: row.failure_count || 0
        };
        
        if (!this.webhooks.has(webhook.workspaceId)) {
          this.webhooks.set(webhook.workspaceId, new Map());
        }
        this.webhooks.get(webhook.workspaceId)!.set(webhook.id, webhook);
      }
      
      this.logger.info('webhook-hooks', `Loaded webhooks for ${this.webhooks.size} workspaces`);
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to load webhooks', error as Error);
    }
  }

  private async loadApiHooks(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM api_hooks ORDER BY created_at DESC');
      
      for (const row of rows) {
        const hook: ApiHook = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          endpoint: row.endpoint,
          method: row.method,
          triggers: row.triggers,
          authentication: row.authentication,
          requestConfig: row.request_config,
          responseHandling: row.response_handling,
          isActive: row.is_active,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastExecuted: row.last_executed,
          executionCount: row.execution_count || 0,
          successCount: row.success_count || 0,
          failureCount: row.failure_count || 0
        };
        
        if (!this.apiHooks.has(hook.workspaceId)) {
          this.apiHooks.set(hook.workspaceId, new Map());
        }
        this.apiHooks.get(hook.workspaceId)!.set(hook.id, hook);
      }
      
      this.logger.info('webhook-hooks', `Loaded API hooks for ${this.apiHooks.size} workspaces`);
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to load API hooks', error as Error);
    }
  }

  private async loadPendingDeliveries(): Promise<void> {
    try {
      const rows = await this.database.query(
        "SELECT * FROM webhook_deliveries WHERE status IN ('pending', 'retrying') ORDER BY created_at ASC"
      );
      
      for (const row of rows) {
        const delivery: WebhookDelivery = {
          id: row.id,
          webhookId: row.webhook_id,
          eventId: row.event_id,
          workspaceId: row.workspace_id,
          status: row.status,
          statusCode: row.status_code,
          response: row.response,
          error: row.error,
          attempt: row.attempt,
          nextRetryAt: row.next_retry_at,
          duration: row.duration,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.deliveries.has(delivery.webhookId)) {
          this.deliveries.set(delivery.webhookId, new Map());
        }
        this.deliveries.get(delivery.webhookId)!.set(delivery.id, delivery);
      }
      
      this.logger.info('webhook-hooks', `Loaded ${rows.length} pending deliveries`);
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to load pending deliveries', error as Error);
    }
  }

  private startProcessing(): void {
    this.isProcessing = true;
    
    // Process pending deliveries and scheduled hooks every minute
    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) {
        await this.processPendingDeliveries();
        await this.processScheduledHooks();
      }
    }, 60 * 1000);
  }

  // PUBLIC API METHODS
  async createWebhook(config: {
    workspaceId: string;
    name: string;
    description?: string;
    url: string;
    events: string[];
    secret?: string;
    retryConfig?: Webhook['retryConfig'];
    headers?: Record<string, string>;
    timeout?: number;
    verifySsl?: boolean;
    createdBy: string;
  }): Promise<string> {
    const webhookId = `webhook-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const webhook: Webhook = {
        id: webhookId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        url: config.url,
        events: config.events,
        isActive: true,
        secret: config.secret || crypto.randomBytes(32).toString('hex'),
        retryConfig: config.retryConfig || { maxRetries: 3, retryDelay: 60, backoffMultiplier: 2 },
        headers: config.headers || {},
        timeout: config.timeout || 30000,
        verifySsl: config.verifySsl !== false,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        successCount: 0,
        failureCount: 0
      };
      
      await this.database.query(`
        INSERT INTO webhooks (
          id, workspace_id, name, description, url, events, is_active, secret,
          retry_config, headers, timeout, verify_ssl, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        webhook.id,
        webhook.workspaceId,
        webhook.name,
        webhook.description,
        webhook.url,
        webhook.events,
        webhook.isActive,
        webhook.secret,
        JSON.stringify(webhook.retryConfig),
        JSON.stringify(webhook.headers),
        webhook.timeout,
        webhook.verifySsl,
        webhook.createdBy,
        webhook.createdAt,
        webhook.updatedAt
      ]);
      
      if (!this.webhooks.has(webhook.workspaceId)) {
        this.webhooks.set(webhook.workspaceId, new Map());
      }
      this.webhooks.get(webhook.workspaceId)!.set(webhook.id, webhook);
      
      this.emit('webhookCreated', webhook);
      return webhookId;
      
    } catch (error) {
      this.logger.error('webhook-hooks', `Failed to create webhook: ${webhookId}`, error as Error);
      throw error;
    }
  }

  async createApiHook(config: {
    workspaceId: string;
    name: string;
    description?: string;
    endpoint: string;
    method: ApiHook['method'];
    triggers: ApiHook['triggers'];
    authentication: ApiHook['authentication'];
    requestConfig: ApiHook['requestConfig'];
    responseHandling: ApiHook['responseHandling'];
    createdBy: string;
  }): Promise<string> {
    const hookId = `hook-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const hook: ApiHook = {
        id: hookId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        endpoint: config.endpoint,
        method: config.method,
        triggers: config.triggers,
        authentication: config.authentication,
        requestConfig: config.requestConfig,
        responseHandling: config.responseHandling,
        isActive: true,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        successCount: 0,
        failureCount: 0
      };
      
      await this.database.query(`
        INSERT INTO api_hooks (
          id, workspace_id, name, description, endpoint, method, triggers,
          authentication, request_config, response_handling, is_active,
          created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        hook.id,
        hook.workspaceId,
        hook.name,
        hook.description,
        hook.endpoint,
        hook.method,
        JSON.stringify(hook.triggers),
        JSON.stringify(hook.authentication),
        JSON.stringify(hook.requestConfig),
        JSON.stringify(hook.responseHandling),
        hook.isActive,
        hook.createdBy,
        hook.createdAt,
        hook.updatedAt
      ]);
      
      if (!this.apiHooks.has(hook.workspaceId)) {
        this.apiHooks.set(hook.workspaceId, new Map());
      }
      this.apiHooks.get(hook.workspaceId)!.set(hook.id, hook);
      
      this.emit('apiHookCreated', hook);
      return hookId;
      
    } catch (error) {
      this.logger.error('webhook-hooks', `Failed to create API hook: ${hookId}`, error as Error);
      throw error;
    }
  }

  async triggerEvent(event: {
    workspaceId: string;
    eventType: string;
    data: any;
    userId?: string;
  }): Promise<void> {
    try {
      const eventId = `event-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      
      const webhookEvent: WebhookEvent = {
        id: eventId,
        workspaceId: event.workspaceId,
        eventType: event.eventType,
        data: event.data,
        timestamp: new Date(),
        userId: event.userId,
        metadata: {
          source: 'ultra-system',
          version: '1.0.0',
          idempotencyKey: crypto.randomUUID()
        }
      };
      
      // Save event
      await this.database.query(`
        INSERT INTO webhook_events (
          id, workspace_id, event_type, data, timestamp, user_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        webhookEvent.id,
        webhookEvent.workspaceId,
        webhookEvent.eventType,
        JSON.stringify(webhookEvent.data),
        webhookEvent.timestamp,
        webhookEvent.userId,
        JSON.stringify(webhookEvent.metadata)
      ]);
      
      // Find matching webhooks
      const workspaceWebhooks = this.webhooks.get(event.workspaceId);
      if (!workspaceWebhooks) return;
      
      for (const webhook of workspaceWebhooks.values()) {
        if (webhook.isActive && webhook.events.includes(event.eventType)) {
          await this.deliverWebhook(webhook, webhookEvent);
        }
      }
      
      // Trigger matching API hooks
      await this.triggerApiHooks(event.workspaceId, 'event', event);
      
      this.emit('eventTriggered', webhookEvent);
      
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to trigger event', error as Error);
    }
  }

  async executeHook(hookId: string, triggerData?: any): Promise<string> {
    try {
      let hook: ApiHook | null = null;
      
      // Find hook
      for (const workspaceHooks of this.apiHooks.values()) {
        hook = workspaceHooks.get(hookId) || null;
        if (hook) break;
      }
      
      if (!hook || !hook.isActive) {
        throw new Error(`Hook not found or inactive: ${hookId}`);
      }
      
      return await this.executeApiHook(hook, 'manual', triggerData);
      
    } catch (error) {
      this.logger.error('webhook-hooks', `Failed to execute hook: ${hookId}`, error as Error);
      throw error;
    }
  }

  async getWebhooks(workspaceId: string): Promise<Webhook[]> {
    try {
      const workspaceWebhooks = this.webhooks.get(workspaceId);
      if (!workspaceWebhooks) {
        return [];
      }
      
      return Array.from(workspaceWebhooks.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to get webhooks', error as Error);
      return [];
    }
  }

  async getApiHooks(workspaceId: string): Promise<ApiHook[]> {
    try {
      const workspaceHooks = this.apiHooks.get(workspaceId);
      if (!workspaceHooks) {
        return [];
      }
      
      return Array.from(workspaceHooks.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to get API hooks', error as Error);
      return [];
    }
  }

  async getWebhookDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
    try {
      const webhookDeliveries = this.deliveries.get(webhookId);
      if (!webhookDeliveries) {
        // Load from database
        await this.loadWebhookDeliveries(webhookId);
        return this.deliveries.get(webhookId)?.values().toArray() || [];
      }
      
      return Array.from(webhookDeliveries.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to get webhook deliveries', error as Error);
      return [];
    }
  }

  async getHookExecutions(hookId: string): Promise<HookExecution[]> {
    try {
      const hookExecutions = this.executions.get(hookId);
      if (!hookExecutions) {
        // Load from database
        await this.loadHookExecutions(hookId);
        return this.executions.get(hookId)?.values().toArray() || [];
      }
      
      return Array.from(hookExecutions.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to get hook executions', error as Error);
      return [];
    }
  }

  async getAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<WebhookAnalytics[]> {
    try {
      let sql = 'SELECT * FROM webhook_analytics WHERE workspace_id = $1';
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
        totalWebhooks: row.total_webhooks,
        activeWebhooks: row.active_webhooks,
        totalDeliveries: row.total_deliveries,
        successfulDeliveries: row.successful_deliveries,
        failedDeliveries: row.failed_deliveries,
        averageResponseTime: parseFloat(row.average_response_time) || 0,
        topEvents: row.top_events || [],
        webhookPerformance: row.webhook_performance || [],
        errorAnalysis: row.error_analysis || {
          commonErrors: [],
          timeouts: 0,
          sslErrors: 0
        }
      }));
      
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to get analytics', error as Error);
      return [];
    }
  }

  async testWebhook(webhookId: string): Promise<{
    success: boolean;
    statusCode?: number;
    response?: string;
    error?: string;
    duration: number;
  }> {
    try {
      const webhook = this.findWebhook(webhookId);
      if (!webhook) {
        throw new Error(`Webhook not found: ${webhookId}`);
      }
      
      const testEvent: WebhookEvent = {
        id: `test-${Date.now()}`,
        workspaceId: webhook.workspaceId,
        eventType: 'test',
        data: { message: 'Test event from Ultra System' },
        timestamp: new Date(),
        metadata: {
          source: 'ultra-system',
          version: '1.0.0',
          idempotencyKey: crypto.randomUUID()
        }
      };
      
      return await this.sendWebhookRequest(webhook, testEvent);
      
    } catch (error) {
      this.logger.error('webhook-hooks', `Failed to test webhook: ${webhookId}`, error as Error);
      return {
        success: false,
        error: error.message,
        duration: 0
      };
    }
  }

  // Private helper methods
  private async deliverWebhook(webhook: Webhook, event: WebhookEvent): Promise<void> {
    try {
      const deliveryId = `delivery-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      
      const delivery: WebhookDelivery = {
        id: deliveryId,
        webhookId: webhook.id,
        eventId: event.id,
        workspaceId: webhook.workspaceId,
        status: 'pending',
        attempt: 1,
        duration: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO webhook_deliveries (
          id, webhook_id, event_id, workspace_id, status, attempt, duration, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        delivery.id,
        delivery.webhookId,
        delivery.eventId,
        delivery.workspaceId,
        delivery.status,
        delivery.attempt,
        delivery.duration,
        delivery.createdAt,
        delivery.updatedAt
      ]);
      
      if (!this.deliveries.has(webhook.id)) {
        this.deliveries.set(webhook.id, new Map());
      }
      this.deliveries.get(webhook.id)!.set(delivery.id, delivery);
      
      // Update webhook stats
      webhook.lastTriggered = new Date();
      await this.updateWebhookStats(webhook);
      
      // Process delivery immediately
      await this.processDelivery(webhook.id, delivery.id);
      
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to deliver webhook', error as Error);
    }
  }

  private async processDelivery(webhookId: string, deliveryId: string): Promise<void> {
    try {
      const webhook = this.findWebhook(webhookId);
      if (!webhook) return;
      
      const delivery = this.deliveries.get(webhookId)?.get(deliveryId);
      if (!delivery) return;
      
      // Get event
      const eventResult = await this.database.query('SELECT * FROM webhook_events WHERE id = $1', [delivery.eventId]);
      if (eventResult.rows.length === 0) return;
      
      const event: WebhookEvent = {
        ...eventResult.rows[0],
        data: eventResult.rows[0].data,
        metadata: eventResult.rows[0].metadata
      };
      
      // Send webhook
      const result = await this.sendWebhookRequest(webhook, event);
      
      // Update delivery
      delivery.status = result.success ? 'sent' : 'failed';
      delivery.statusCode = result.statusCode;
      delivery.response = result.response;
      delivery.error = result.error;
      delivery.duration = result.duration;
      delivery.updatedAt = new Date();
      
      if (!result.success && delivery.attempt < webhook.retryConfig.maxRetries) {
        delivery.status = 'retrying';
        delivery.nextRetryAt = new Date(Date.now() + webhook.retryConfig.retryDelay * 1000 * Math.pow(webhook.retryConfig.backoffMultiplier, delivery.attempt - 1));
      }
      
      await this.database.query(`
        UPDATE webhook_deliveries SET
          status = $1, status_code = $2, response = $3, error = $4,
          duration = $5, attempt = $6, next_retry_at = $7, updated_at = $8
        WHERE id = $9
      `, [
        delivery.status,
        delivery.statusCode,
        delivery.response,
        delivery.error,
        delivery.duration,
        delivery.attempt,
        delivery.nextRetryAt,
        delivery.updatedAt,
        delivery.id
      ]);
      
      // Update webhook stats
      if (result.success) {
        webhook.successCount++;
      } else {
        webhook.failureCount++;
      }
      await this.updateWebhookStats(webhook);
      
      this.emit('deliveryProcessed', { webhook, delivery, result });
      
    } catch (error) {
      this.logger.error('webhook-hooks', `Failed to process delivery: ${deliveryId}`, error as Error);
    }
  }

  private async sendWebhookRequest(webhook: Webhook, event: WebhookEvent): Promise<{
    success: boolean;
    statusCode?: number;
    response?: string;
    error?: string;
    duration: number;
  }> {
    const startTime = Date.now();
    
    try {
      const payload = {
        id: event.id,
        eventType: event.eventType,
        data: event.data,
        timestamp: event.timestamp.toISOString(),
        userId: event.userId,
        metadata: event.metadata
      };
      
      const payloadString = JSON.stringify(payload);
      
      // Create signature if secret is set
      const signature = webhook.secret ? 
        'sha256=' + crypto.createHmac('sha256', webhook.secret).update(payloadString).digest('hex') : 
        undefined;
      
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Ultra-Webhooks/1.0',
        'X-Webhook-ID': webhook.id,
        'X-Event-ID': event.id,
        'X-Event-Type': event.eventType,
        'X-Timestamp': event.timestamp.toISOString(),
        ...webhook.headers
      };
      
      if (signature) {
        headers['X-Signature'] = signature;
      }
      
      const options: https.RequestOptions = {
        method: 'POST',
        headers,
        timeout: webhook.timeout,
        rejectUnauthorized: webhook.verifySsl
      };
      
      const url = new URL(webhook.url);
      options.hostname = url.hostname;
      options.port = url.port || (url.protocol === 'https:' ? 443 : 80);
      options.path = url.pathname + url.search;
      
      return new Promise((resolve) => {
        const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            const duration = Date.now() - startTime;
            const success = res.statusCode >= 200 && res.statusCode < 300;
            
            resolve({
              success,
              statusCode: res.statusCode,
              response: data,
              duration
            });
          });
        });
        
        req.on('error', (error) => {
          const duration = Date.now() - startTime;
          resolve({
            success: false,
            error: error.message,
            duration
          });
        });
        
        req.on('timeout', () => {
          req.destroy();
          const duration = Date.now() - startTime;
          resolve({
            success: false,
            error: 'Request timeout',
            duration
          });
        });
        
        req.write(payloadString);
        req.end();
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  private async triggerApiHooks(workspaceId: string, triggerType: ApiHook['triggers']['type'], triggerData: any): Promise<void> {
    try {
      const workspaceHooks = this.apiHooks.get(workspaceId);
      if (!workspaceHooks) return;
      
      for (const hook of workspaceHooks.values()) {
        if (hook.isActive && hook.triggers.type === triggerType) {
          await this.executeApiHook(hook, triggerType, triggerData);
        }
      }
      
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to trigger API hooks', error as Error);
    }
  }

  private async executeApiHook(hook: ApiHook, triggerType: ApiHook['triggers']['type'], triggerData?: any): Promise<string> {
    const executionId = `execution-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const startTime = Date.now();
      
      // Prepare request
      const url = new URL(hook.endpoint);
      let body: string | undefined;
      
      if (hook.requestConfig.bodyTemplate) {
        body = this.templateReplace(hook.requestConfig.bodyTemplate, triggerData || {});
      }
      
      const headers = { ...hook.requestConfig.headers };
      
      // Add authentication
      await this.addAuthentication(headers, hook.authentication, hook);
      
      const request: HookExecution['request'] = {
        url: hook.endpoint,
        method: hook.method,
        headers,
        body
      };
      
      // Make request
      const response = await this.makeHttpRequest({
        method: hook.method,
        url: hook.endpoint,
        headers,
        body,
        timeout: hook.requestConfig.timeout
      });
      
      const duration = Date.now() - startTime;
      
      // Extract data if configured
      let extractedData;
      if (hook.responseHandling.dataExtraction) {
        extractedData = this.extractJsonData(response.body, hook.responseHandling.dataExtraction.path);
      }
      
      const execution: HookExecution = {
        id: executionId,
        hookId: hook.id,
        workspaceId: hook.workspaceId,
        triggerType,
        triggerData,
        request,
        response: {
          statusCode: response.statusCode,
          headers: response.headers,
          body: response.body,
          extractedData
        },
        status: hook.responseHandling.successCodes.includes(response.statusCode) ? 'success' : 'failed',
        duration,
        createdAt: new Date(),
        completedAt: new Date()
      };
      
      // Save execution
      await this.database.query(`
        INSERT INTO hook_executions (
          id, hook_id, workspace_id, trigger_type, trigger_data, request,
          response, status, duration, created_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        execution.id,
        execution.hookId,
        execution.workspaceId,
        execution.triggerType,
        JSON.stringify(execution.triggerData),
        JSON.stringify(execution.request),
        JSON.stringify(execution.response),
        execution.status,
        execution.duration,
        execution.createdAt,
        execution.completedAt
      ]);
      
      // Update hook stats
      hook.lastExecuted = new Date();
      hook.executionCount++;
      if (execution.status === 'success') {
        hook.successCount++;
      } else {
        hook.failureCount++;
      }
      await this.updateHookStats(hook);
      
      // Cache execution
      if (!this.executions.has(hook.id)) {
        this.executions.set(hook.id, new Map());
      }
      this.executions.get(hook.id)!.set(execution.id, execution);
      
      this.emit('hookExecuted', execution);
      return executionId;
      
    } catch (error) {
      this.logger.error('webhook-hooks', `Failed to execute API hook: ${hook.id}`, error as Error);
      
      // Save failed execution
      const execution: HookExecution = {
        id: executionId,
        hookId: hook.id,
        workspaceId: hook.workspaceId,
        triggerType,
        triggerData,
        request: { url: hook.endpoint, method: hook.method, headers: {}, body: undefined },
        response: { statusCode: 0, headers: {}, body: '' },
        status: 'failed',
        duration: 0,
        error: error.message,
        createdAt: new Date(),
        completedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO hook_executions (
          id, hook_id, workspace_id, trigger_type, trigger_data, request,
          response, status, duration, error, created_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        execution.id,
        execution.hookId,
        execution.workspaceId,
        execution.triggerType,
        JSON.stringify(execution.triggerData),
        JSON.stringify(execution.request),
        JSON.stringify(execution.response),
        execution.status,
        execution.duration,
        execution.error,
        execution.createdAt,
        execution.completedAt
      ]);
      
      return executionId;
    }
  }

  private async makeHttpRequest(config: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    timeout: number;
  }): Promise<{
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  }> {
    return new Promise((resolve, reject) => {
      const url = new URL(config.url);
      const options: https.RequestOptions = {
        method: config.method,
        headers: config.headers,
        timeout: config.timeout
      };
      
      const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers as Record<string, string>,
            body: data
          });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (config.body) {
        req.write(config.body);
      }
      
      req.end();
    });
  }

  private async addAuthentication(headers: Record<string, string>, auth: ApiHook['authentication'], hook: ApiHook): Promise<void> {
    switch (auth.type) {
      case 'api_key':
        headers[auth.config.header || 'X-API-Key'] = auth.config.key;
        break;
        
      case 'bearer':
        headers['Authorization'] = `Bearer ${auth.config.token}`;
        break;
        
      case 'basic':
        const credentials = Buffer.from(`${auth.config.username}:${auth.config.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
        break;
        
      case 'oauth2':
        // In a real implementation, would handle OAuth2 flow
        headers['Authorization'] = `Bearer ${auth.config.accessToken}`;
        break;
    }
  }

  private templateReplace(template: string, data: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  private extractJsonData(json: string, path: string): any {
    try {
      const obj = JSON.parse(json);
      const parts = path.split('.');
      let current = obj;
      
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return null;
        }
      }
      
      return current;
    } catch (error) {
      return null;
    }
  }

  private async processPendingDeliveries(): Promise<void> {
    try {
      const now = new Date();
      
      for (const [webhookId, deliveries] of this.deliveries.entries()) {
        for (const delivery of deliveries.values()) {
          if ((delivery.status === 'retrying' && delivery.nextRetryAt && delivery.nextRetryAt <= now) ||
              (delivery.status === 'pending')) {
            await this.processDelivery(webhookId, delivery.id);
          }
        }
      }
      
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to process pending deliveries', error as Error);
    }
  }

  private async processScheduledHooks(): Promise<void> {
    try {
      const now = new Date();
      
      for (const workspaceHooks of this.apiHooks.values()) {
        for (const hook of workspaceHooks.values()) {
          if (hook.isActive && hook.triggers.type === 'schedule') {
            const schedule = hook.triggers.config;
            // Simple check - in production would use a proper cron parser
            if (this.shouldExecuteScheduledHook(schedule, now)) {
              await this.executeApiHook(hook, 'schedule');
            }
          }
        }
      }
      
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to process scheduled hooks', error as Error);
    }
  }

  private shouldExecuteScheduledHook(schedule: any, now: Date): boolean {
    // Simplified scheduling logic
    // In production, would use a proper cron library
    if (schedule.type === 'interval') {
      // Check if enough time has passed since last execution
      return true; // Placeholder
    }
    
    return false;
  }

  private findWebhook(webhookId: string): Webhook | null {
    for (const workspaceWebhooks of this.webhooks.values()) {
      const webhook = workspaceWebhooks.get(webhookId);
      if (webhook) return webhook;
    }
    return null;
  }

  private async updateWebhookStats(webhook: Webhook): Promise<void> {
    await this.database.query(
      'UPDATE webhooks SET last_triggered = $1, success_count = $2, failure_count = $3, updated_at = $4 WHERE id = $5',
      [webhook.lastTriggered, webhook.successCount, webhook.failureCount, new Date(), webhook.id]
    );
  }

  private async updateHookStats(hook: ApiHook): Promise<void> {
    await this.database.query(
      'UPDATE api_hooks SET last_executed = $1, execution_count = $2, success_count = $3, failure_count = $4, updated_at = $5 WHERE id = $6',
      [hook.lastExecuted, hook.executionCount, hook.successCount, hook.failureCount, new Date(), hook.id]
    );
  }

  private async loadWebhookDeliveries(webhookId: string): Promise<void> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT 100',
        [webhookId]
      );
      
      const deliveries = new Map<string, WebhookDelivery>();
      
      for (const row of rows) {
        const delivery: WebhookDelivery = {
          id: row.id,
          webhookId: row.webhook_id,
          eventId: row.event_id,
          workspaceId: row.workspace_id,
          status: row.status,
          statusCode: row.status_code,
          response: row.response,
          error: row.error,
          attempt: row.attempt,
          nextRetryAt: row.next_retry_at,
          duration: row.duration,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        deliveries.set(delivery.id, delivery);
      }
      
      this.deliveries.set(webhookId, deliveries);
      
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to load webhook deliveries', error as Error);
    }
  }

  private async loadHookExecutions(hookId: string): Promise<void> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM hook_executions WHERE hook_id = $1 ORDER BY created_at DESC LIMIT 100',
        [hookId]
      );
      
      const executions = new Map<string, HookExecution>();
      
      for (const row of rows) {
        const execution: HookExecution = {
          id: row.id,
          hookId: row.hook_id,
          workspaceId: row.workspace_id,
          triggerType: row.trigger_type,
          triggerData: row.trigger_data,
          request: row.request,
          response: row.response,
          status: row.status,
          duration: row.duration,
          error: row.error,
          createdAt: row.created_at,
          completedAt: row.completed_at
        };
        
        executions.set(execution.id, execution);
      }
      
      this.executions.set(hookId, executions);
      
    } catch (error) {
      this.logger.error('webhook-hooks', 'Failed to load hook executions', error as Error);
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    processingActive: boolean;
    webhooksCount: number;
    hooksCount: number;
    pendingDeliveriesCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!this.isProcessing) {
      issues.push('Processing is not active');
    }
    
    const pendingCount = Array.from(this.deliveries.values()).reduce((sum, deliveries) => 
      sum + Array.from(deliveries.values()).filter(d => d.status === 'pending' || d.status === 'retrying').length, 0);
    
    return {
      healthy: issues.length === 0,
      processingActive: this.isProcessing,
      webhooksCount: Array.from(this.webhooks.values()).reduce((sum, webhooks) => sum + webhooks.size, 0),
      hooksCount: Array.from(this.apiHooks.values()).reduce((sum, hooks) => sum + hooks.size, 0),
      pendingDeliveriesCount: pendingCount,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.webhooks.clear();
    this.apiHooks.clear();
    this.deliveries.clear();
    this.executions.clear();
    
    this.logger.info('webhook-hooks', 'Webhook and API hooks system shut down');
  }
}

export default UltraWebhookHooks;
