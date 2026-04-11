import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraWebSocketServer } from './websocket-server';
import { UltraNotificationSystem } from './notification-system';
import { UltraSmartQueue } from './smart-queue';
import { Message, Channel, User } from './slack-system';
import * as crypto from 'crypto';

export interface HealthIssue {
  id: string;
  type: 'connection' | 'message' | 'queue' | 'database' | 'file' | 'notification' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  description: string;
  affectedUsers: string[];
  affectedWorkspaces: string[];
  metrics: Record<string, any>;
  detectedAt: Date;
  resolvedAt?: Date;
  resolutionAttempts: number;
  autoResolved: boolean;
  resolution?: string;
}

export interface HealingAction {
  id: string;
  issueId: string;
  type: 'restart' | 'reconnect' | 'retry' | 'fallback' | 'escalate' | 'notify' | 'repair';
  description: string;
  parameters: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  executedAt: Date;
  completedAt?: Date;
}

export interface CircuitBreaker {
  id: string;
  component: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  failureThreshold: number;
  recoveryTimeout: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface PerformanceMetrics {
  component: string;
  timestamp: Date;
  responseTime: number;
  errorRate: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  queueSize: number;
}

export interface HealingRule {
  id: string;
  name: string;
  description: string;
  conditions: HealingCondition[];
  actions: HealingActionRule[];
  isActive: boolean;
  priority: number;
  cooldownPeriod: number; // minutes
  lastExecuted?: Date;
  executionCount: number;
  successCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealingCondition {
  metric: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  duration: number; // minutes
}

export interface HealingActionRule {
  type: HealingAction['type'];
  parameters: any;
  delay?: number; // seconds
  condition?: string; // conditional execution
}

export class UltraSelfHealing extends EventEmitter {
  private static instance: UltraSelfHealing;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private webSocketServer: UltraWebSocketServer;
  private notificationSystem: UltraNotificationSystem;
  private smartQueue: UltraSmartQueue;
  
  private activeIssues: Map<string, HealthIssue> = new Map();
  private healingActions: Map<string, HealingAction> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private healingRules: Map<string, HealingRule[]> = new Map(); // component -> rules
  private performanceMetrics: Map<string, PerformanceMetrics[]> = new Map(); // component -> metrics
  
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout;
  private healingInterval: NodeJS.Timeout;
  private metricsInterval: NodeJS.Timeout;
  
  // Default retry policies
  private retryPolicies: Record<string, RetryPolicy> = {
    websocket: {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true
    },
    database: {
      maxAttempts: 3,
      baseDelay: 2000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true
    },
    notification: {
      maxAttempts: 3,
      baseDelay: 5000,
      maxDelay: 60000,
      backoffMultiplier: 1.5,
      jitter: true
    },
    message: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 2,
      jitter: false
    }
  };

  static getInstance(): UltraSelfHealing {
    if (!UltraSelfHealing.instance) {
      UltraSelfHealing.instance = new UltraSelfHealing();
    }
    return UltraSelfHealing.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.webSocketServer = UltraWebSocketServer.getInstance();
    this.notificationSystem = UltraNotificationSystem.getInstance();
    this.smartQueue = UltraSmartQueue.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadHealingRules();
      await this.loadActiveIssues();
      this.setupCircuitBreakers();
      this.startMonitoring();
      this.startHealingProcessor();
      this.startMetricsCollection();
      
      this.logger.info('self-healing', 'Self-healing system initialized', {
        activeIssuesCount: this.activeIssues.size,
        healingRulesCount: Array.from(this.healingRules.values()).reduce((sum, rules) => sum + rules.length, 0),
        circuitBreakersCount: this.circuitBreakers.size
      });
    } catch (error) {
      this.logger.error('self-healing', 'Failed to initialize self-healing system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS health_issues (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        component VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        affected_users TEXT[],
        affected_workspaces TEXT[],
        metrics JSONB NOT NULL,
        detected_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        resolution_attempts INTEGER DEFAULT 0,
        auto_resolved BOOLEAN DEFAULT FALSE,
        resolution TEXT
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS healing_actions (
        id VARCHAR(255) PRIMARY KEY,
        issue_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        parameters JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        result JSONB,
        error TEXT,
        executed_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS healing_rules (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        conditions JSONB NOT NULL,
        actions JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        priority INTEGER DEFAULT 0,
        cooldown_period INTEGER DEFAULT 5,
        last_executed TIMESTAMP,
        execution_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id SERIAL PRIMARY KEY,
        component VARCHAR(100) NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW(),
        response_time DECIMAL(10,3),
        error_rate DECIMAL(5,2),
        throughput INTEGER,
        memory_usage BIGINT,
        cpu_usage DECIMAL(5,2),
        active_connections INTEGER,
        queue_size INTEGER
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_health_issues_component ON health_issues(component)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_health_issues_status ON health_issues(resolved_at)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_healing_actions_issue_id ON healing_actions(issue_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_healing_rules_component ON healing_rules(conditions)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_performance_metrics_component ON performance_metrics(component)');
  }

  private async loadHealingRules(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM healing_rules WHERE is_active = TRUE ORDER BY priority DESC');
      
      for (const row of rows) {
        const rule: HealingRule = {
          id: row.id,
          name: row.name,
          description: row.description,
          conditions: row.conditions || [],
          actions: row.actions || [],
          isActive: row.is_active,
          priority: row.priority,
          cooldownPeriod: row.cooldown_period,
          lastExecuted: row.last_executed,
          executionCount: row.execution_count,
          successCount: row.success_count,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        // Extract component from conditions
        const component = this.extractComponentFromRule(rule);
        if (!this.healingRules.has(component)) {
          this.healingRules.set(component, []);
        }
        this.healingRules.get(component)!.push(rule);
      }
      
      this.logger.info('self-healing', `Loaded healing rules for ${this.healingRules.size} components`);
    } catch (error) {
      this.logger.error('self-healing', 'Failed to load healing rules', error as Error);
    }
  }

  private extractComponentFromRule(rule: HealingRule): string {
    // Extract component name from conditions
    for (const condition of rule.conditions) {
      if (condition.metric.includes('websocket')) return 'websocket';
      if (condition.metric.includes('database')) return 'database';
      if (condition.metric.includes('notification')) return 'notification';
      if (condition.metric.includes('queue')) return 'queue';
      if (condition.metric.includes('message')) return 'message';
      if (condition.metric.includes('file')) return 'file';
    }
    return 'general';
  }

  private async loadActiveIssues(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM health_issues WHERE resolved_at IS NULL');
      
      for (const row of rows) {
        const issue: HealthIssue = {
          id: row.id,
          type: row.type,
          severity: row.severity,
          component: row.component,
          description: row.description,
          affectedUsers: row.affected_users || [],
          affectedWorkspaces: row.affected_workspaces || [],
          metrics: row.metrics || {},
          detectedAt: row.detected_at,
          resolvedAt: row.resolved_at,
          resolutionAttempts: row.resolution_attempts,
          autoResolved: row.auto_resolved,
          resolution: row.resolution
        };
        
        this.activeIssues.set(issue.id, issue);
      }
      
      this.logger.info('self-healing', `Loaded ${this.activeIssues.size} active issues`);
    } catch (error) {
      this.logger.error('self-healing', 'Failed to load active issues', error as Error);
    }
  }

  private setupCircuitBreakers(): Promise<void> {
    // Set up circuit breakers for critical components
    const components = ['websocket', 'database', 'notification', 'queue', 'message'];
    
    for (const component of components) {
      const circuitBreaker: CircuitBreaker = {
        id: `cb-${component}`,
        component,
        state: 'closed',
        failureCount: 0,
        failureThreshold: 5,
        recoveryTimeout: 60000 // 1 minute
      };
      
      this.circuitBreakers.set(component, circuitBreaker);
    }
    
    return Promise.resolve();
  }

  private startMonitoring(): void {
    this.isMonitoring = true;
    
    // Monitor system health every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.performHealthChecks();
      }
    }, 30000);
  }

  private startHealingProcessor(): void {
    // Process healing actions every 10 seconds
    this.healingInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.processHealingActions();
      }
    }, 10000);
  }

  private startMetricsCollection(): void {
    // Collect performance metrics every minute
    this.metricsInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.collectPerformanceMetrics();
      }
    }, 60000);
  }

  private async performHealthChecks(): Promise<void> {
    try {
      const checks = await Promise.allSettled([
        this.checkWebSocketHealth(),
        this.checkDatabaseHealth(),
        this.checkNotificationHealth(),
        this.checkQueueHealth(),
        this.checkMessageHealth(),
        this.checkFileHealth()
      ]);
      
      for (const [index, check] of checks.entries()) {
        const componentNames = ['websocket', 'database', 'notification', 'queue', 'message', 'file'];
        if (check.status === 'rejected') {
          await this.reportHealthIssue(componentNames[index], 'critical', `Health check failed: ${check.reason}`);
        }
      }
      
    } catch (error) {
      this.logger.error('self-healing', 'Failed to perform health checks', error as Error);
    }
  }

  private async checkWebSocketHealth(): Promise<void> {
    try {
      const health = await this.webSocketServer.healthCheck();
      
      if (!health.healthy) {
        await this.reportHealthIssue('websocket', 'high', `WebSocket server unhealthy: ${health.issues.join(', ')}`, {
          connectionCount: health.connectionCount,
          issues: health.issues
        });
      } else {
        await this.resolveHealthIssues('websocket', 'WebSocket server is now healthy');
      }
      
      // Update circuit breaker
      await this.updateCircuitBreaker('websocket', health.healthy);
      
    } catch (error) {
      await this.reportHealthIssue('websocket', 'critical', `WebSocket health check failed: ${error.message}`);
      await this.updateCircuitBreaker('websocket', false);
    }
  }

  private async checkDatabaseHealth(): Promise<void> {
    try {
      const startTime = Date.now();
      await this.database.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      
      if (responseTime > 5000) { // 5 seconds threshold
        await this.reportHealthIssue('database', 'medium', `Database response time high: ${responseTime}ms`, {
          responseTime
        });
      } else {
        await this.resolveHealthIssues('database', 'Database performance is normal');
      }
      
      await this.updateCircuitBreaker('database', true);
      
    } catch (error) {
      await this.reportHealthIssue('database', 'critical', `Database health check failed: ${error.message}`);
      await this.updateCircuitBreaker('database', false);
    }
  }

  private async checkNotificationHealth(): Promise<void> {
    try {
      const health = await this.notificationSystem.healthCheck();
      
      if (!health.healthy) {
        await this.reportHealthIssue('notification', 'medium', `Notification system unhealthy: ${health.issues.join(', ')}`, {
          queueSize: health.queueSize,
          issues: health.issues
        });
      } else {
        await this.resolveHealthIssues('notification', 'Notification system is healthy');
      }
      
      await this.updateCircuitBreaker('notification', health.healthy);
      
    } catch (error) {
      await this.reportHealthIssue('notification', 'high', `Notification health check failed: ${error.message}`);
      await this.updateCircuitBreaker('notification', false);
    }
  }

  private async checkQueueHealth(): Promise<void> {
    try {
      const health = await this.smartQueue.healthCheck();
      
      if (!health.healthy) {
        await this.reportHealthIssue('queue', 'medium', `Queue system unhealthy: ${health.issues.join(', ')}`, {
          queueSize: health.queueSize,
          waitingItems: health.waitingItems,
          activeAgents: health.activeAgents,
          issues: health.issues
        });
      } else {
        await this.resolveHealthIssues('queue', 'Queue system is healthy');
      }
      
      await this.updateCircuitBreaker('queue', health.healthy);
      
    } catch (error) {
      await this.reportHealthIssue('queue', 'high', `Queue health check failed: ${error.message}`);
      await this.updateCircuitBreaker('queue', false);
    }
  }

  private async checkMessageHealth(): Promise<void> {
    try {
      // Check for message delivery failures
      const failedMessages = await this.database.query(
        'SELECT COUNT(*) as count FROM messages WHERE delivery_failed = TRUE AND created_at > NOW() - INTERVAL \'1 hour\''
      );
      
      const failureCount = parseInt(failedMessages.rows[0].count);
      
      if (failureCount > 10) {
        await this.reportHealthIssue('message', 'medium', `High message failure rate: ${failureCount} messages in last hour`, {
          failureCount
        });
      } else {
        await this.resolveHealthIssues('message', 'Message delivery is normal');
      }
      
      await this.updateCircuitBreaker('message', failureCount <= 10);
      
    } catch (error) {
      await this.reportHealthIssue('message', 'high', `Message health check failed: ${error.message}`);
      await this.updateCircuitBreaker('message', false);
    }
  }

  private async checkFileHealth(): Promise<void> {
    try {
      // Check file upload failures
      const failedUploads = await this.database.query(
        'SELECT COUNT(*) as count FROM file_uploads WHERE status = \'failed\' AND created_at > NOW() - INTERVAL \'1 hour\''
      );
      
      const failureCount = parseInt(failedUploads.rows[0].count);
      
      if (failureCount > 5) {
        await this.reportHealthIssue('file', 'medium', `High file upload failure rate: ${failureCount} failures in last hour`, {
          failureCount
        });
      } else {
        await this.resolveHealthIssues('file', 'File system is healthy');
      }
      
    } catch (error) {
      await this.reportHealthIssue('file', 'high', `File health check failed: ${error.message}`);
    }
  }

  private async reportHealthIssue(component: string, severity: HealthIssue['severity'], description: string, metrics?: any): Promise<void> {
    try {
      // Check if similar issue already exists
      const existingIssue = Array.from(this.activeIssues.values())
        .find(issue => issue.component === component && issue.severity === severity && 
                     issue.description.includes(description.substring(0, 50)));
      
      if (existingIssue) {
        // Update existing issue
        existingIssue.resolutionAttempts++;
        existingIssue.metrics = { ...existingIssue.metrics, ...metrics };
        
        await this.database.query(
          'UPDATE health_issues SET resolution_attempts = $1, metrics = $2 WHERE id = $3',
          [existingIssue.resolutionAttempts, JSON.stringify(existingIssue.metrics), existingIssue.id]
        );
        
        return;
      }
      
      // Create new issue
      const issueId = `issue-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      
      const issue: HealthIssue = {
        id: issueId,
        type: this.getIssueTypeFromComponent(component),
        severity,
        component,
        description,
        affectedUsers: [],
        affectedWorkspaces: [],
        metrics: metrics || {},
        detectedAt: new Date(),
        resolutionAttempts: 0,
        autoResolved: false
      };
      
      await this.database.query(`
        INSERT INTO health_issues (
          id, type, severity, component, description, affected_users, affected_workspaces,
          metrics, detected_at, resolution_attempts, auto_resolved
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        issue.id,
        issue.type,
        issue.severity,
        issue.component,
        issue.description,
        issue.affectedUsers,
        issue.affectedWorkspaces,
        JSON.stringify(issue.metrics),
        issue.detectedAt,
        issue.resolutionAttempts,
        issue.autoResolved
      ]);
      
      this.activeIssues.set(issueId, issue);
      
      // Trigger healing actions
      await this.triggerHealingActions(issue);
      
      // Notify administrators for critical issues
      if (severity === 'critical') {
        await this.notifyAdministrators(issue);
      }
      
      this.emit('healthIssueDetected', issue);
      this.logger.warn('self-healing', `Health issue detected: ${issueId}`, {
        component,
        severity,
        description
      });
      
    } catch (error) {
      this.logger.error('self-healing', 'Failed to report health issue', error as Error);
    }
  }

  private getIssueTypeFromComponent(component: string): HealthIssue['type'] {
    const typeMap: Record<string, HealthIssue['type']> = {
      websocket: 'connection',
      database: 'database',
      notification: 'notification',
      queue: 'queue',
      message: 'message',
      file: 'file'
    };
    
    return typeMap[component] || 'performance';
  }

  private async resolveHealthIssues(component: string, resolution: string): Promise<void> {
    try {
      const issuesToResolve = Array.from(this.activeIssues.values())
        .filter(issue => issue.component === component);
      
      for (const issue of issuesToResolve) {
        issue.resolvedAt = new Date();
        issue.autoResolved = true;
        issue.resolution = resolution;
        
        await this.database.query(
          'UPDATE health_issues SET resolved_at = $1, auto_resolved = TRUE, resolution = $2 WHERE id = $3',
          [issue.resolvedAt, issue.resolution, issue.id]
        );
        
        this.activeIssues.delete(issue.id);
        this.emit('healthIssueResolved', issue);
      }
      
      this.logger.info('self-healing', `Resolved health issues for component: ${component}`, {
        resolvedCount: issuesToResolve.length,
        resolution
      });
      
    } catch (error) {
      this.logger.error('self-healing', 'Failed to resolve health issues', error as Error);
    }
  }

  private async triggerHealingActions(issue: HealthIssue): Promise<void> {
    try {
      const rules = this.healingRules.get(issue.component) || [];
      
      for (const rule of rules) {
        if (await this.evaluateHealingRule(rule, issue)) {
          await this.executeHealingRule(rule, issue);
        }
      }
      
    } catch (error) {
      this.logger.error('self-healing', 'Failed to trigger healing actions', error as Error);
    }
  }

  private async evaluateHealingRule(rule: HealingRule, issue: HealthIssue): Promise<boolean> {
    try {
      // Check cooldown period
      if (rule.lastExecuted) {
        const cooldownEnd = new Date(rule.lastExecuted.getTime() + rule.cooldownPeriod * 60 * 1000);
        if (new Date() < cooldownEnd) {
          return false;
        }
      }
      
      // Evaluate conditions
      for (const condition of rule.conditions) {
        const metricValue = this.getMetricValue(condition.metric, issue);
        if (!this.evaluateCondition(metricValue, condition.operator, condition.threshold)) {
          return false;
        }
      }
      
      return true;
      
    } catch (error) {
      this.logger.error('self-healing', 'Failed to evaluate healing rule', error as Error);
      return false;
    }
  }

  private getMetricValue(metric: string, issue: HealthIssue): number {
    // Extract metric value from issue metrics or current system state
    if (metric.includes('response_time')) {
      return issue.metrics.responseTime || 0;
    }
    if (metric.includes('error_rate')) {
      return issue.metrics.errorRate || 0;
    }
    if (metric.includes('queue_size')) {
      return issue.metrics.queueSize || 0;
    }
    if (metric.includes('failure_count')) {
      return issue.resolutionAttempts || 0;
    }
    
    return 0;
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      default:
        return false;
    }
  }

  private async executeHealingRule(rule: HealingRule, issue: HealthIssue): Promise<void> {
    try {
      rule.lastExecuted = new Date();
      rule.executionCount++;
      
      for (const actionRule of rule.actions) {
        const actionId = `action-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        
        const action: HealingAction = {
          id: actionId,
          issueId: issue.id,
          type: actionRule.type,
          description: `Execute ${actionRule.type} for ${issue.component}`,
          parameters: actionRule.parameters,
          status: 'pending',
          executedAt: new Date()
        };
        
        // Add delay if specified
        if (actionRule.delay) {
          await new Promise(resolve => setTimeout(resolve, actionRule.delay * 1000));
        }
        
        await this.executeHealingAction(action);
        
        if (action.status === 'completed') {
          rule.successCount++;
        }
      }
      
      // Update rule in database
      await this.database.query(
        'UPDATE healing_rules SET last_executed = $1, execution_count = $2, success_count = $3 WHERE id = $4',
        [rule.lastExecuted, rule.executionCount, rule.successCount, rule.id]
      );
      
    } catch (error) {
      this.logger.error('self-healing', 'Failed to execute healing rule', error as Error);
    }
  }

  private async executeHealingAction(action: HealingAction): Promise<void> {
    try {
      action.status = 'running';
      
      switch (action.type) {
        case 'restart':
          await this.executeRestartAction(action);
          break;
        case 'reconnect':
          await this.executeReconnectAction(action);
          break;
        case 'retry':
          await this.executeRetryAction(action);
          break;
        case 'fallback':
          await this.executeFallbackAction(action);
          break;
        case 'escalate':
          await this.executeEscalateAction(action);
          break;
        case 'notify':
          await this.executeNotifyAction(action);
          break;
        case 'repair':
          await this.executeRepairAction(action);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
      
      action.status = 'completed';
      action.completedAt = new Date();
      
      this.emit('healingActionCompleted', action);
      
    } catch (error) {
      action.status = 'failed';
      action.error = error.message;
      action.completedAt = new Date();
      
      this.logger.error('self-healing', `Healing action failed: ${action.id}`, error as Error);
    }
    
    // Store action in database
    await this.database.query(`
      INSERT INTO healing_actions (
        id, issue_id, type, description, parameters, status, result, error, executed_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      action.id,
      action.issueId,
      action.type,
      action.description,
      JSON.stringify(action.parameters),
      action.status,
      JSON.stringify(action.result),
      action.error,
      action.executedAt,
      action.completedAt
    ]);
    
    this.healingActions.set(action.id, action);
  }

  private async executeRestartAction(action: HealingAction): Promise<void> {
    const component = action.parameters.component;
    
    switch (component) {
      case 'websocket':
        // Restart WebSocket server
        await this.webSocketServer.restart();
        action.result = { message: 'WebSocket server restarted' };
        break;
      case 'queue':
        // Restart queue processor
        await this.smartQueue.restart();
        action.result = { message: 'Queue processor restarted' };
        break;
      default:
        throw new Error(`Cannot restart component: ${component}`);
    }
  }

  private async executeReconnectAction(action: HealingAction): Promise<void> {
    const component = action.parameters.component;
    
    switch (component) {
      case 'websocket':
        // Reconnect WebSocket clients
        await this.webSocketServer.reconnectAll();
        action.result = { message: 'WebSocket clients reconnected' };
        break;
      case 'database':
        // Reconnect to database
        await this.database.reconnect();
        action.result = { message: 'Database reconnected' };
        break;
      default:
        throw new Error(`Cannot reconnect to component: ${component}`);
    }
  }

  private async executeRetryAction(action: HealingAction): Promise<void> {
    const component = action.parameters.component;
    const policy = this.retryPolicies[component];
    
    if (!policy) {
      throw new Error(`No retry policy for component: ${component}`);
    }
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        switch (component) {
          case 'websocket':
            await this.webSocketServer.retryFailedConnections();
            break;
          case 'database':
            await this.database.query('SELECT 1');
            break;
          case 'notification':
            await this.notificationSystem.retryFailedNotifications();
            break;
          case 'message':
            await this.retryFailedMessages();
            break;
        }
        
        action.result = { 
          message: `Retry successful on attempt ${attempt}`,
          attempts: attempt
        };
        return;
        
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < policy.maxAttempts) {
          const delay = this.calculateRetryDelay(policy, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Retry failed after all attempts');
  }

  private calculateRetryDelay(policy: RetryPolicy, attempt: number): number {
    let delay = policy.baseDelay * Math.pow(policy.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, policy.maxDelay);
    
    if (policy.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  private async retryFailedMessages(): Promise<void> {
    const failedMessages = await this.database.query(
      'SELECT * FROM messages WHERE delivery_failed = TRUE AND retry_count < 3 ORDER BY created_at ASC LIMIT 100'
    );
    
    for (const message of failedMessages.rows) {
      try {
        // Attempt to redeliver message
        await this.webSocketServer.deliverMessage(message);
        
        await this.database.query(
          'UPDATE messages SET delivery_failed = FALSE, retry_count = retry_count + 1 WHERE id = $1',
          [message.id]
        );
        
      } catch (error) {
        await this.database.query(
          'UPDATE messages SET retry_count = retry_count + 1 WHERE id = $1',
          [message.id]
        );
      }
    }
  }

  private async executeFallbackAction(action: HealingAction): Promise<void> {
    const component = action.parameters.component;
    
    switch (component) {
      case 'notification':
        // Switch to email-only notifications
        await this.notificationSystem.enableFallbackMode();
        action.result = { message: 'Notification fallback mode enabled' };
        break;
      case 'queue':
        // Enable manual queue assignment
        await this.smartQueue.enableManualMode();
        action.result = { message: 'Queue manual mode enabled' };
        break;
      default:
        throw new Error(`No fallback for component: ${component}`);
    }
  }

  private async executeEscalateAction(action: HealingAction): Promise<void> {
    // Escalate issue to administrators
    const issue = this.activeIssues.get(action.issueId);
    if (issue) {
      await this.notifyAdministrators(issue, true);
      action.result = { message: 'Issue escalated to administrators' };
    }
  }

  private async executeNotifyAction(action: HealingAction): Promise<void> {
    const recipients = action.parameters.recipients || [];
    const message = action.parameters.message || 'System health issue detected';
    
    for (const recipient of recipients) {
      await this.notificationSystem.createNotification({
        userId: recipient,
        workspaceId: 'system',
        type: 'system',
        title: 'Health Alert',
        content: message,
        data: { actionId: action.id },
        priority: 'high'
      });
    }
    
    action.result = { message: `Notifications sent to ${recipients.length} recipients` };
  }

  private async executeRepairAction(action: HealingAction): Promise<void> {
    const component = action.parameters.component;
    
    switch (component) {
      case 'database':
        // Repair database connections
        await this.database.repairConnections();
        action.result = { message: 'Database connections repaired' };
        break;
      case 'queue':
        // Repair queue state
        await this.smartQueue.repairQueue();
        action.result = { message: 'Queue state repaired' };
        break;
      default:
        throw new Error(`Cannot repair component: ${component}`);
    }
  }

  private async notifyAdministrators(issue: HealthIssue, escalated: boolean = false): Promise<void> {
    try {
      // Get all super admin users
      const admins = await this.database.query(
        'SELECT user_id FROM workspace_members WHERE role = \'super_admin\''
      );
      
      for (const admin of admins.rows) {
        await this.notificationSystem.createNotification({
          userId: admin.user_id,
          workspaceId: 'system',
          type: 'system',
          title: escalated ? 'CRITICAL: System Issue Escalated' : 'System Health Issue',
          content: `${issue.severity.toUpperCase()} issue detected in ${issue.component}: ${issue.description}`,
          data: { 
            issueId: issue.id,
            component: issue.component,
            severity: issue.severity,
            escalated
          },
          priority: escalated ? 'urgent' : 'high'
        });
      }
      
    } catch (error) {
      this.logger.error('self-healing', 'Failed to notify administrators', error as Error);
    }
  }

  private async updateCircuitBreaker(component: string, success: boolean): Promise<void> {
    const circuitBreaker = this.circuitBreakers.get(component);
    if (!circuitBreaker) return;
    
    if (success) {
      if (circuitBreaker.state === 'open') {
        // Check if recovery timeout has passed
        if (new Date() >= circuitBreaker.nextAttemptTime!) {
          circuitBreaker.state = 'half-open';
          this.logger.info('self-healing', `Circuit breaker for ${component} moved to half-open`);
        }
      } else if (circuitBreaker.state === 'half-open') {
        // Successful call in half-open state, close circuit
        circuitBreaker.state = 'closed';
        circuitBreaker.failureCount = 0;
        this.logger.info('self-healing', `Circuit breaker for ${component} closed`);
      }
    } else {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = new Date();
      
      if (circuitBreaker.failureCount >= circuitBreaker.failureThreshold) {
        circuitBreaker.state = 'open';
        circuitBreaker.nextAttemptTime = new Date(Date.now() + circuitBreaker.recoveryTimeout);
        this.logger.warn('self-healing', `Circuit breaker for ${component} opened`);
      }
    }
  }

  private async processHealingActions(): Promise<void> {
    try {
      // Process pending healing actions
      const pendingActions = Array.from(this.healingActions.values())
        .filter(action => action.status === 'pending')
        .slice(0, 10); // Process max 10 actions per cycle
      
      for (const action of pendingActions) {
        await this.executeHealingAction(action);
      }
      
    } catch (error) {
      this.logger.error('self-healing', 'Failed to process healing actions', error as Error);
    }
  }

  private async collectPerformanceMetrics(): Promise<void> {
    try {
      const components = ['websocket', 'database', 'notification', 'queue', 'message'];
      
      for (const component of components) {
        const metrics = await this.collectComponentMetrics(component);
        
        if (!this.performanceMetrics.has(component)) {
          this.performanceMetrics.set(component, []);
        }
        
        const componentMetrics = this.performanceMetrics.get(component)!;
        componentMetrics.push(metrics);
        
        // Keep only last 100 metrics per component
        if (componentMetrics.length > 100) {
          componentMetrics.shift();
        }
        
        // Store in database
        await this.database.query(`
          INSERT INTO performance_metrics (
            component, timestamp, response_time, error_rate, throughput,
            memory_usage, cpu_usage, active_connections, queue_size
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          metrics.component,
          metrics.timestamp,
          metrics.responseTime,
          metrics.errorRate,
          metrics.throughput,
          metrics.memoryUsage,
          metrics.cpuUsage,
          metrics.activeConnections,
          metrics.queueSize
        ]);
      }
      
    } catch (error) {
      this.logger.error('self-healing', 'Failed to collect performance metrics', error as Error);
    }
  }

  private async collectComponentMetrics(component: string): Promise<PerformanceMetrics> {
    const baseMetrics = {
      component,
      timestamp: new Date(),
      responseTime: 0,
      errorRate: 0,
      throughput: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      activeConnections: 0,
      queueSize: 0
    };
    
    try {
      switch (component) {
        case 'websocket':
          const wsHealth = await this.webSocketServer.healthCheck();
          return {
            ...baseMetrics,
            activeConnections: wsHealth.connectionCount,
            responseTime: wsHealth.averageResponseTime || 0
          };
          
        case 'database':
          const dbStart = Date.now();
          await this.database.query('SELECT 1');
          return {
            ...baseMetrics,
            responseTime: Date.now() - dbStart
          };
          
        case 'notification':
          const notifHealth = await this.notificationSystem.healthCheck();
          return {
            ...baseMetrics,
            queueSize: notifHealth.queueSize,
            errorRate: notifHealth.errorRate || 0
          };
          
        case 'queue':
          const queueHealth = await this.smartQueue.healthCheck();
          return {
            ...baseMetrics,
            queueSize: queueHealth.queueSize,
            activeConnections: queueHealth.activeAgents
          };
          
        default:
          return baseMetrics;
      }
      
    } catch (error) {
      return {
        ...baseMetrics,
        errorRate: 100
      };
    }
  }

  // PUBLIC API METHODS
  async reportCustomIssue(config: {
    component: string;
    severity: HealthIssue['severity'];
    description: string;
    metrics?: any;
    affectedUsers?: string[];
    affectedWorkspaces?: string[];
  }): Promise<string> {
    const issueId = `issue-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const issue: HealthIssue = {
        id: issueId,
        type: 'performance',
        severity: config.severity,
        component: config.component,
        description: config.description,
        affectedUsers: config.affectedUsers || [],
        affectedWorkspaces: config.affectedWorkspaces || [],
        metrics: config.metrics || {},
        detectedAt: new Date(),
        resolutionAttempts: 0,
        autoResolved: false
      };
      
      await this.database.query(`
        INSERT INTO health_issues (
          id, type, severity, component, description, affected_users, affected_workspaces,
          metrics, detected_at, resolution_attempts, auto_resolved
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        issue.id,
        issue.type,
        issue.severity,
        issue.component,
        issue.description,
        issue.affectedUsers,
        issue.affectedWorkspaces,
        JSON.stringify(issue.metrics),
        issue.detectedAt,
        issue.resolutionAttempts,
        issue.autoResolved
      ]);
      
      this.activeIssues.set(issueId, issue);
      await this.triggerHealingActions(issue);
      
      this.emit('customIssueReported', issue);
      return issueId;
      
    } catch (error) {
      this.logger.error('self-healing', `Failed to report custom issue: ${issueId}`, error as Error);
      throw error;
    }
  }

  async getActiveIssues(filters?: {
    component?: string;
    severity?: HealthIssue['severity'];
    type?: HealthIssue['type'];
    limit?: number;
    offset?: number;
  }): Promise<HealthIssue[]> {
    let issues = Array.from(this.activeIssues.values());
    
    if (filters?.component) {
      issues = issues.filter(issue => issue.component === filters.component);
    }
    
    if (filters?.severity) {
      issues = issues.filter(issue => issue.severity === filters.severity);
    }
    
    if (filters?.type) {
      issues = issues.filter(issue => issue.type === filters.type);
    }
    
    issues.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
    
    if (filters?.limit) {
      const start = filters.offset || 0;
      issues = issues.slice(start, start + filters.limit);
    }
    
    return issues;
  }

  async getHealingActions(filters?: {
    issueId?: string;
    type?: HealingAction['type'];
    status?: HealingAction['status'];
    limit?: number;
    offset?: number;
  }): Promise<HealingAction[]> {
    let actions = Array.from(this.healingActions.values());
    
    if (filters?.issueId) {
      actions = actions.filter(action => action.issueId === filters.issueId);
    }
    
    if (filters?.type) {
      actions = actions.filter(action => action.type === filters.type);
    }
    
    if (filters?.status) {
      actions = actions.filter(action => action.status === filters.status);
    }
    
    actions.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
    
    if (filters?.limit) {
      const start = filters.offset || 0;
      actions = actions.slice(start, start + filters.limit);
    }
    
    return actions;
  }

  async getCircuitBreakerStatus(): Promise<Record<string, CircuitBreaker>> {
    const status: Record<string, CircuitBreaker> = {};
    
    for (const [component, breaker] of this.circuitBreakers.entries()) {
      status[component] = { ...breaker };
    }
    
    return status;
  }

  async getPerformanceMetrics(component?: string, timeRange?: { start: Date; end: Date }): Promise<PerformanceMetrics[]> {
    try {
      let sql = 'SELECT * FROM performance_metrics';
      const params: any[] = [];
      
      if (component) {
        sql += ' WHERE component = $1';
        params.push(component);
      }
      
      if (timeRange) {
        sql += component ? ' AND timestamp >= $2 AND timestamp <= $3' : ' WHERE timestamp >= $1 AND timestamp <= $2';
        params.push(timeRange.start, timeRange.end);
      }
      
      sql += ' ORDER BY timestamp DESC';
      
      if (component && !timeRange) {
        sql += ' LIMIT 100';
      }
      
      const rows = await this.database.query(sql, params);
      
      return rows.map(row => ({
        component: row.component,
        timestamp: row.timestamp,
        responseTime: row.response_time || 0,
        errorRate: row.error_rate || 0,
        throughput: row.throughput || 0,
        memoryUsage: row.memory_usage || 0,
        cpuUsage: row.cpu_usage || 0,
        activeConnections: row.active_connections || 0,
        queueSize: row.queue_size || 0
      }));
      
    } catch (error) {
      this.logger.error('self-healing', 'Failed to get performance metrics', error as Error);
      return [];
    }
  }

  async createHealingRule(config: {
    name: string;
    description?: string;
    conditions: HealingCondition[];
    actions: HealingActionRule[];
    priority?: number;
    cooldownPeriod?: number;
    createdBy: string;
  }): Promise<string> {
    const ruleId = `rule-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const rule: HealingRule = {
        id: ruleId,
        name: config.name,
        description: config.description,
        conditions: config.conditions,
        actions: config.actions,
        isActive: true,
        priority: config.priority || 0,
        cooldownPeriod: config.cooldownPeriod || 5,
        executionCount: 0,
        successCount: 0,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO healing_rules (
          id, name, description, conditions, actions, is_active, priority,
          cooldown_period, execution_count, success_count, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        rule.id,
        rule.name,
        rule.description,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        rule.isActive,
        rule.priority,
        rule.cooldownPeriod,
        rule.executionCount,
        rule.successCount,
        rule.createdBy,
        rule.createdAt,
        rule.updatedAt
      ]);
      
      const component = this.extractComponentFromRule(rule);
      if (!this.healingRules.has(component)) {
        this.healingRules.set(component, []);
      }
      this.healingRules.get(component)!.push(rule);
      
      this.emit('healingRuleCreated', rule);
      return ruleId;
      
    } catch (error) {
      this.logger.error('self-healing', `Failed to create healing rule: ${ruleId}`, error as Error);
      throw error;
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    activeIssuesCount: number;
    circuitBreakersOpen: number;
    healingActionsCount: number;
    monitoringActive: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    const openCircuitBreakers = Array.from(this.circuitBreakers.values())
      .filter(breaker => breaker.state === 'open').length;
    
    if (openCircuitBreakers > 0) {
      issues.push(`${openCircuitBreakers} circuit breakers are open`);
    }
    
    const criticalIssues = Array.from(this.activeIssues.values())
      .filter(issue => issue.severity === 'critical').length;
    
    if (criticalIssues > 0) {
      issues.push(`${criticalIssues} critical issues are active`);
    }
    
    if (!this.isMonitoring) {
      issues.push('Health monitoring is not active');
    }
    
    return {
      healthy: issues.length === 0,
      activeIssuesCount: this.activeIssues.size,
      circuitBreakersOpen: openCircuitBreakers,
      healingActionsCount: this.healingActions.size,
      monitoringActive: this.isMonitoring,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.healingInterval) {
      clearInterval(this.healingInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    this.logger.info('self-healing', 'Self-healing system shut down');
  }
}

export default UltraSelfHealing;
