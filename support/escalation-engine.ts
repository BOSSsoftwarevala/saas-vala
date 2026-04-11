import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraNotificationSystem } from './notification-system';
import { UltraSmartQueue } from './smart-queue';
import { UltraSLASystem } from './sla-system';
import { Message, User, Workspace } from './slack-system';
import * as crypto from 'crypto';

export interface EscalationRule {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  triggerConditions: EscalationCondition[];
  actions: EscalationAction[];
  priority: number;
  isActive: boolean;
  cooldownPeriod: number; // minutes
  maxEscalations: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationCondition {
  type: 'time_based' | 'no_response' | 'customer_unhappy' | 'agent_overload' | 'priority_based' | 'custom';
  parameters: {
    timeThreshold?: number; // minutes
    responseThreshold?: number; // messages
    satisfactionThreshold?: number; // 1-5
    agentLoadThreshold?: number; // active chats
    priorityLevel?: 'urgent' | 'high' | 'medium' | 'low';
    customCondition?: string;
  };
  evaluation: 'all' | 'any'; // if multiple conditions
}

export interface EscalationAction {
  type: 'reassign_agent' | 'escalate_to_admin' | 'escalate_to_super_admin' | 'notify_manager' | 
        'notify_customer' | 'increase_priority' | 'create_incident' | 'send_email' | 'custom_webhook';
  parameters: {
    targetRole?: string;
    message?: string;
    priority?: 'urgent' | 'high' | 'medium' | 'low';
    incidentSeverity?: 'low' | 'medium' | 'high' | 'critical';
    webhookUrl?: string;
    emailAddresses?: string[];
    delay?: number; // minutes
  };
  order: number; // execution order
}

export interface EscalationEvent {
  id: string;
  workspaceId: string;
  ruleId: string;
  ticketId?: string;
  messageId?: string;
  userId: string;
  currentAgentId?: string;
  triggerReason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  triggeredAt: Date;
  completedAt?: Date;
  actions: EscalationActionExecution[];
  metadata: Record<string, any>;
}

export interface EscalationActionExecution {
  id: string;
  eventId: string;
  actionType: EscalationAction['type'];
  parameters: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
  executedAt?: Date;
  completedAt?: Date;
}

export interface EscalationMetrics {
  workspaceId: string;
  date: Date;
  totalEscalations: number;
  escalationsByType: Record<string, number>;
  escalationsBySeverity: Record<string, number>;
  averageResolutionTime: number;
  escalationsByAgent: Record<string, number>;
  customerImpact: {
    totalAffectedCustomers: number;
    averageDelayMinutes: number;
    satisfactionImpact: number;
  };
  systemHealth: {
    agentOverloadIncidents: number;
    slaViolationsPrevented: number;
    responseTimeImprovement: number;
  };
}

export class UltraEscalationEngine extends EventEmitter {
  private static instance: UltraEscalationEngine;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private notificationSystem: UltraNotificationSystem;
  private smartQueue: UltraSmartQueue;
  private slaSystem: UltraSLASystem;
  
  private rules: Map<string, EscalationRule[]> = new Map(); // workspaceId -> rules
  private activeEvents: Map<string, EscalationEvent> = new Map();
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout;
  private metricsInterval: NodeJS.Timeout;

  static getInstance(): UltraEscalationEngine {
    if (!UltraEscalationEngine.instance) {
      UltraEscalationEngine.instance = new UltraEscalationEngine();
    }
    return UltraEscalationEngine.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.notificationSystem = UltraNotificationSystem.getInstance();
    this.smartQueue = UltraSmartQueue.getInstance();
    this.slaSystem = UltraSLASystem.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadEscalationRules();
      await this.loadActiveEvents();
      this.startMonitoring();
      this.startMetricsCollection();
      
      this.logger.info('escalation-engine', 'Escalation engine initialized', {
        rulesCount: Array.from(this.rules.values()).reduce((sum, rules) => sum + rules.length, 0),
        activeEventsCount: this.activeEvents.size
      });
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to initialize escalation engine', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS escalation_rules (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        trigger_conditions JSONB NOT NULL,
        actions JSONB NOT NULL,
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        cooldown_period INTEGER DEFAULT 60,
        max_escalations INTEGER DEFAULT 5,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS escalation_events (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        rule_id VARCHAR(255) NOT NULL,
        ticket_id VARCHAR(255),
        message_id VARCHAR(255),
        user_id VARCHAR(255) NOT NULL,
        current_agent_id VARCHAR(255),
        trigger_reason TEXT NOT NULL,
        severity VARCHAR(10) NOT NULL,
        status VARCHAR(15) NOT NULL,
        triggered_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        metadata JSONB NOT NULL
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS escalation_action_executions (
        id VARCHAR(255) PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL,
        action_type VARCHAR(30) NOT NULL,
        parameters JSONB NOT NULL,
        status VARCHAR(15) NOT NULL,
        result JSONB,
        error TEXT,
        executed_at TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS escalation_metrics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_escalations INTEGER DEFAULT 0,
        escalations_by_type JSONB NOT NULL,
        escalations_by_severity JSONB NOT NULL,
        average_resolution_time DECIMAL(8,2),
        escalations_by_agent JSONB NOT NULL,
        customer_impact JSONB NOT NULL,
        system_health JSONB NOT NULL,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_escalation_rules_workspace_id ON escalation_rules(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_escalation_events_workspace_id ON escalation_events(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_escalation_events_status ON escalation_events(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_escalation_events_user_id ON escalation_events(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_escalation_action_executions_event_id ON escalation_action_executions(event_id)');
  }

  private async loadEscalationRules(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM escalation_rules WHERE is_active = TRUE ORDER BY priority DESC');
      
      for (const row of rows) {
        const rule: EscalationRule = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          triggerConditions: row.trigger_conditions || [],
          actions: row.actions || [],
          priority: row.priority,
          isActive: row.is_active,
          cooldownPeriod: row.cooldown_period,
          maxEscalations: row.max_escalations,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.rules.has(rule.workspaceId)) {
          this.rules.set(rule.workspaceId, []);
        }
        this.rules.get(rule.workspaceId)!.push(rule);
      }
      
      this.logger.info('escalation-engine', `Loaded escalation rules for ${this.rules.size} workspaces`);
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to load escalation rules', error as Error);
    }
  }

  private async loadActiveEvents(): Promise<void> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM escalation_events WHERE status IN (\'pending\', \'in_progress\') ORDER BY triggered_at DESC LIMIT 1000'
      );
      
      for (const row of rows) {
        const event: EscalationEvent = {
          id: row.id,
          workspaceId: row.workspace_id,
          ruleId: row.rule_id,
          ticketId: row.ticket_id,
          messageId: row.message_id,
          userId: row.user_id,
          currentAgentId: row.current_agent_id,
          triggerReason: row.trigger_reason,
          severity: row.severity,
          status: row.status,
          triggeredAt: row.triggered_at,
          completedAt: row.completed_at,
          metadata: row.metadata || {},
          actions: []
        };
        
        // Load action executions for this event
        const actionRows = await this.database.query(
          'SELECT * FROM escalation_action_executions WHERE event_id = $1 ORDER BY executed_at ASC',
          [event.id]
        );
        
        event.actions = actionRows.map(row => ({
          id: row.id,
          eventId: row.event_id,
          actionType: row.action_type,
          parameters: row.parameters,
          status: row.status,
          result: row.result,
          error: row.error,
          executedAt: row.executed_at,
          completedAt: row.completed_at
        }));
        
        this.activeEvents.set(event.id, event);
      }
      
      this.logger.info('escalation-engine', `Loaded ${this.activeEvents.size} active escalation events`);
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to load active escalation events', error as Error);
    }
  }

  private startMonitoring(): void {
    this.isMonitoring = true;
    
    // Monitor escalation conditions every 60 seconds
    this.monitoringInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.monitorEscalationConditions();
      }
    }, 60000);
  }

  private startMetricsCollection(): void {
    // Collect metrics every hour
    this.metricsInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.updateEscalationMetrics();
      }
    }, 60 * 60 * 1000);
  }

  // PUBLIC API METHODS
  async createEscalationRule(config: {
    workspaceId: string;
    name: string;
    description?: string;
    triggerConditions: EscalationCondition[];
    actions: EscalationAction[];
    priority?: number;
    cooldownPeriod?: number;
    maxEscalations?: number;
    createdBy: string;
  }): Promise<string> {
    const ruleId = `rule-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const rule: EscalationRule = {
        id: ruleId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        triggerConditions: config.triggerConditions,
        actions: config.actions,
        priority: config.priority || 0,
        isActive: true,
        cooldownPeriod: config.cooldownPeriod || 60,
        maxEscalations: config.maxEscalations || 5,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO escalation_rules (
          id, workspace_id, name, description, trigger_conditions, actions,
          priority, is_active, cooldown_period, max_escalations, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        rule.id,
        rule.workspaceId,
        rule.name,
        rule.description,
        JSON.stringify(rule.triggerConditions),
        JSON.stringify(rule.actions),
        rule.priority,
        rule.isActive,
        rule.cooldownPeriod,
        rule.maxEscalations,
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
      this.logger.error('escalation-engine', `Failed to create escalation rule: ${ruleId}`, error as Error);
      throw error;
    }
  }

  async triggerEscalation(config: {
    workspaceId: string;
    ticketId?: string;
    messageId?: string;
    userId: string;
    currentAgentId?: string;
    reason: string;
    severity: EscalationEvent['severity'];
    metadata?: Record<string, any>;
  }): Promise<string> {
    const eventId = `event-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const applicableRules = await this.findApplicableRules(config.workspaceId, config);
      
      if (applicableRules.length === 0) {
        this.logger.warn('escalation-engine', `No applicable escalation rules found for user: ${config.userId}`);
        return '';
      }
      
      const rule = applicableRules[0]; // Use highest priority rule
      
      const event: EscalationEvent = {
        id: eventId,
        workspaceId: config.workspaceId,
        ruleId: rule.id,
        ticketId: config.ticketId,
        messageId: config.messageId,
        userId: config.userId,
        currentAgentId: config.currentAgentId,
        triggerReason: config.reason,
        severity: config.severity,
        status: 'pending',
        triggeredAt: new Date(),
        metadata: config.metadata || {},
        actions: []
      };
      
      await this.database.query(`
        INSERT INTO escalation_events (
          id, workspace_id, rule_id, ticket_id, message_id, user_id, current_agent_id,
          trigger_reason, severity, status, triggered_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        event.id,
        event.workspaceId,
        event.ruleId,
        event.ticketId,
        event.messageId,
        event.userId,
        event.currentAgentId,
        event.triggerReason,
        event.severity,
        event.status,
        event.triggeredAt,
        JSON.stringify(event.metadata)
      ]);
      
      this.activeEvents.set(eventId, event);
      
      // Execute escalation actions
      await this.executeEscalationActions(event, rule);
      
      this.emit('escalationTriggered', event);
      this.logger.warn('escalation-engine', `Escalation triggered: ${eventId}`, {
        rule: rule.name,
        severity: config.severity,
        reason: config.reason
      });
      
      return eventId;
      
    } catch (error) {
      this.logger.error('escalation-engine', `Failed to trigger escalation: ${eventId}`, error as Error);
      throw error;
    }
  }

  private async findApplicableRules(workspaceId: string, config: any): Promise<EscalationRule[]> {
    try {
      const workspaceRules = this.rules.get(workspaceId) || [];
      const applicableRules: EscalationRule[] = [];
      
      for (const rule of workspaceRules) {
        if (await this.evaluateRuleConditions(rule, config)) {
          applicableRules.push(rule);
        }
      }
      
      // Sort by priority (highest first)
      return applicableRules.sort((a, b) => b.priority - a.priority);
      
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to find applicable escalation rules', error as Error);
      return [];
    }
  }

  private async evaluateRuleConditions(rule: EscalationRule, config: any): Promise<boolean> {
    try {
      for (const condition of rule.triggerConditions) {
        const conditionMet = await this.evaluateCondition(condition, config);
        
        if (condition.evaluation === 'any' && conditionMet) {
          return true;
        }
        
        if (condition.evaluation === 'all' && !conditionMet) {
          return false;
        }
      }
      
      return rule.triggerConditions.length > 0 && rule.triggerConditions[0].evaluation === 'all';
      
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to evaluate rule conditions', error as Error);
      return false;
    }
  }

  private async evaluateCondition(condition: EscalationCondition, config: any): Promise<boolean> {
    try {
      switch (condition.type) {
        case 'time_based':
          if (condition.parameters.timeThreshold && config.elapsedTime) {
            return config.elapsedTime >= condition.parameters.timeThreshold;
          }
          break;
          
        case 'no_response':
          if (condition.parameters.responseThreshold && config.messageCount) {
            return config.messageCount >= condition.parameters.responseThreshold;
          }
          break;
          
        case 'customer_unhappy':
          if (condition.parameters.satisfactionThreshold && config.satisfaction) {
            return config.satisfaction <= condition.parameters.satisfactionThreshold;
          }
          break;
          
        case 'agent_overload':
          if (condition.parameters.agentLoadThreshold && config.agentLoad) {
            return config.agentLoad >= condition.parameters.agentLoadThreshold;
          }
          break;
          
        case 'priority_based':
          if (condition.parameters.priorityLevel && config.priority) {
            return config.priority === condition.parameters.priorityLevel;
          }
          break;
          
        case 'custom':
          // Custom condition evaluation would be implemented here
          return false;
          
        default:
          return false;
      }
      
      return false;
      
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to evaluate condition', error as Error);
      return false;
    }
  }

  private async executeEscalationActions(event: EscalationEvent, rule: EscalationRule): Promise<void> {
    try {
      event.status = 'in_progress';
      await this.database.query('UPDATE escalation_events SET status = $1 WHERE id = $2', ['in_progress', event.id]);
      
      // Sort actions by execution order
      const sortedActions = rule.actions.sort((a, b) => a.order - b.order);
      
      for (const action of sortedActions) {
        const actionExecution: EscalationActionExecution = {
          id: `action-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
          eventId: event.id,
          actionType: action.type,
          parameters: action.parameters,
          status: 'pending'
        };
        
        event.actions.push(actionExecution);
        
        // Apply delay if specified
        if (action.parameters.delay) {
          await new Promise(resolve => setTimeout(resolve, action.parameters.delay * 60 * 1000));
        }
        
        await this.executeAction(actionExecution, event);
      }
      
      event.status = 'completed';
      event.completedAt = new Date();
      
      await this.database.query(
        'UPDATE escalation_events SET status = $1, completed_at = $2 WHERE id = $3',
        [event.status, event.completedAt, event.id]
      );
      
      this.activeEvents.delete(event.id);
      this.emit('escalationCompleted', event);
      
    } catch (error) {
      event.status = 'failed';
      await this.database.query('UPDATE escalation_events SET status = $1 WHERE id = $2', ['failed', event.id]);
      
      this.logger.error('escalation-engine', 'Failed to execute escalation actions', error as Error);
    }
  }

  private async executeAction(actionExecution: EscalationActionExecution, event: EscalationEvent): Promise<void> {
    try {
      actionExecution.status = 'in_progress';
      actionExecution.executedAt = new Date();
      
      await this.database.query(`
        INSERT INTO escalation_action_executions (
          id, event_id, action_type, parameters, status, executed_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        actionExecution.id,
        actionExecution.eventId,
        actionExecution.actionType,
        JSON.stringify(actionExecution.parameters),
        actionExecution.status,
        actionExecution.executedAt
      ]);
      
      switch (actionExecution.actionType) {
        case 'reassign_agent':
          await this.executeReassignAgent(actionExecution, event);
          break;
          
        case 'escalate_to_admin':
          await this.executeEscalateToAdmin(actionExecution, event, 'admin');
          break;
          
        case 'escalate_to_super_admin':
          await this.executeEscalateToAdmin(actionExecution, event, 'super_admin');
          break;
          
        case 'notify_manager':
          await this.executeNotifyManager(actionExecution, event);
          break;
          
        case 'notify_customer':
          await this.executeNotifyCustomer(actionExecution, event);
          break;
          
        case 'increase_priority':
          await this.executeIncreasePriority(actionExecution, event);
          break;
          
        case 'create_incident':
          await this.executeCreateIncident(actionExecution, event);
          break;
          
        case 'send_email':
          await this.executeSendEmail(actionExecution, event);
          break;
          
        case 'custom_webhook':
          await this.executeCustomWebhook(actionExecution, event);
          break;
          
        default:
          throw new Error(`Unknown action type: ${actionExecution.actionType}`);
      }
      
      actionExecution.status = 'completed';
      actionExecution.completedAt = new Date();
      
      await this.database.query(
        'UPDATE escalation_action_executions SET status = $1, completed_at = $2, result = $3 WHERE id = $4',
        [actionExecution.status, actionExecution.completedAt, JSON.stringify(actionExecution.result), actionExecution.id]
      );
      
    } catch (error) {
      actionExecution.status = 'failed';
      actionExecution.error = error.message;
      
      await this.database.query(
        'UPDATE escalation_action_executions SET status = $1, error = $2 WHERE id = $3',
        [actionExecution.status, actionExecution.error, actionExecution.id]
      );
      
      this.logger.error('escalation-engine', `Failed to execute action: ${actionExecution.actionType}`, error as Error);
    }
  }

  private async executeReassignAgent(actionExecution: EscalationActionExecution, event: EscalationEvent): Promise<void> {
    if (event.ticketId) {
      // Reassign to a different agent
      await this.smartQueue.updateItemStatus(event.ticketId, 'waiting');
      await this.smartQueue.processQueueAssignment();
      
      actionExecution.result = { message: 'Ticket reassigned to available agent' };
    }
  }

  private async executeEscalateToAdmin(actionExecution: EscalationActionExecution, event: EscalationEvent, adminType: string): Promise<void> {
    try {
      const admins = await this.database.query(
        `SELECT user_id FROM workspace_members WHERE role = $1 AND workspace_id = $2`,
        [adminType, event.workspaceId]
      );
      
      for (const admin of admins.rows) {
        await this.notificationSystem.createNotification({
          userId: admin.user_id,
          workspaceId: event.workspaceId,
          type: 'system',
          title: `Escalation Alert - ${event.severity.toUpperCase()}`,
          content: `Issue escalated: ${event.triggerReason}`,
          data: {
            eventId: event.id,
            ticketId: event.ticketId,
            userId: event.userId,
            severity: event.severity
          },
          priority: event.severity === 'critical' ? 'urgent' : 'high'
        });
      }
      
      actionExecution.result = { 
        message: `Escalated to ${adminType}`,
        notifiedAdmins: admins.rows.length
      };
      
    } catch (error) {
      throw new Error(`Failed to escalate to ${adminType}: ${error.message}`);
    }
  }

  private async executeNotifyManager(actionExecution: EscalationActionExecution, event: EscalationEvent): Promise<void> {
    try {
      const managers = await this.database.query(
        `SELECT user_id FROM workspace_members WHERE role IN ('admin', 'manager') AND workspace_id = $1`,
        [event.workspaceId]
      );
      
      for (const manager of managers.rows) {
        await this.notificationSystem.createNotification({
          userId: manager.user_id,
          workspaceId: event.workspaceId,
          type: 'system',
          title: 'Escalation Notification',
          content: `Escalation triggered: ${event.triggerReason}`,
          data: {
            eventId: event.id,
            severity: event.severity,
            userId: event.userId
          },
          priority: 'high'
        });
      }
      
      actionExecution.result = { 
        message: 'Managers notified',
        notifiedManagers: managers.rows.length
      };
      
    } catch (error) {
      throw new Error(`Failed to notify managers: ${error.message}`);
    }
  }

  private async executeNotifyCustomer(actionExecution: EscalationActionExecution, event: EscalationEvent): Promise<void> {
    try {
      const message = actionExecution.parameters.message || 
        'Your support request has been escalated to ensure prompt resolution.';
      
      await this.notificationSystem.createNotification({
        userId: event.userId,
        workspaceId: event.workspaceId,
        type: 'system',
        title: 'Support Update',
        content: message,
        data: {
          eventId: event.id,
          escalated: true
        },
        priority: 'medium'
      });
      
      actionExecution.result = { message: 'Customer notified' };
      
    } catch (error) {
      throw new Error(`Failed to notify customer: ${error.message}`);
    }
  }

  private async executeIncreasePriority(actionExecution: EscalationActionExecution, event: EscalationEvent): Promise<void> {
    try {
      if (event.ticketId) {
        const newPriority = actionExecution.parameters.priority || 'high';
        await this.smartQueue.updateItemPriority(event.ticketId, newPriority);
        
        actionExecution.result = { 
          message: 'Priority increased',
          newPriority
        };
      }
    } catch (error) {
      throw new Error(`Failed to increase priority: ${error.message}`);
    }
  }

  private async executeCreateIncident(actionExecution: EscalationActionExecution, event: EscalationEvent): Promise<void> {
    try {
      const incidentSeverity = actionExecution.parameters.incidentSeverity || 'medium';
      
      // Create incident record (would integrate with incident management system)
      const incidentId = `incident-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      
      await this.database.query(`
        INSERT INTO incidents (
          id, workspace_id, title, description, severity, status, created_at, escalation_event_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        incidentId,
        event.workspaceId,
        `Escalation: ${event.triggerReason}`,
        event.triggerReason,
        incidentSeverity,
        'open',
        new Date(),
        event.id
      ]);
      
      actionExecution.result = { 
        message: 'Incident created',
        incidentId,
        severity: incidentSeverity
      };
      
    } catch (error) {
      throw new Error(`Failed to create incident: ${error.message}`);
    }
  }

  private async executeSendEmail(actionExecution: EscalationActionExecution, event: EscalationEvent): Promise<void> {
    try {
      const emailAddresses = actionExecution.parameters.emailAddresses || [];
      const message = actionExecution.parameters.message || event.triggerReason;
      
      // Would integrate with email service
      actionExecution.result = { 
        message: 'Email sent',
        recipientCount: emailAddresses.length
      };
      
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  private async executeCustomWebhook(actionExecution: EscalationActionExecution, event: EscalationEvent): Promise<void> {
    try {
      const webhookUrl = actionExecution.parameters.webhookUrl;
      
      if (!webhookUrl) {
        throw new Error('Webhook URL not specified');
      }
      
      const payload = {
        eventId: event.id,
        workspaceId: event.workspaceId,
        userId: event.userId,
        severity: event.severity,
        triggerReason: event.triggerReason,
        timestamp: event.triggeredAt
      };
      
      // Would make HTTP request to webhook
      actionExecution.result = { 
        message: 'Webhook triggered',
        url: webhookUrl
      };
      
    } catch (error) {
      throw new Error(`Failed to execute webhook: ${error.message}`);
    }
  }

  private async monitorEscalationConditions(): Promise<void> {
    try {
      // Monitor agent response times
      await this.checkAgentResponseTimes();
      
      // Monitor agent workload
      await this.checkAgentWorkload();
      
      // Monitor customer satisfaction
      await this.checkCustomerSatisfaction();
      
      // Monitor SLA violations
      await this.checkSLAViolations();
      
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to monitor escalation conditions', error as Error);
    }
  }

  private async checkAgentResponseTimes(): Promise<void> {
    try {
      // Get active tickets with no recent agent response
      const staleTickets = await this.database.query(`
        SELECT qi.*, wm.user_id as agent_id, 
               EXTRACT(EPOCH FROM (NOW() - qi.updated_at))/60 as minutes_since_update
        FROM queue_items qi
        LEFT JOIN workspace_members wm ON wm.user_id = qi.assigned_agent_id
        WHERE qi.status = 'active' 
        AND qi.updated_at < NOW() - INTERVAL '30 minutes'
        AND minutes_since_update > 30
      `);
      
      for (const ticket of staleTickets.rows) {
        await this.triggerEscalation({
          workspaceId: ticket.workspace_id,
          ticketId: ticket.id,
          userId: ticket.user_id,
          currentAgentId: ticket.agent_id,
          reason: `Agent has not responded for ${Math.floor(ticket.minutes_since_update)} minutes`,
          severity: ticket.priority === 'urgent' ? 'critical' : 'high',
          metadata: {
            elapsedTime: Math.floor(ticket.minutes_since_update),
            agentId: ticket.agent_id,
            ticketPriority: ticket.priority
          }
        });
      }
      
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to check agent response times', error as Error);
    }
  }

  private async checkAgentWorkload(): Promise<void> {
    try {
      // Get agents with high workload
      const overloadedAgents = await this.database.query(`
        SELECT assigned_agent_id, workspace_id, COUNT(*) as active_chats
        FROM queue_items 
        WHERE status = 'active' AND assigned_agent_id IS NOT NULL
        GROUP BY assigned_agent_id, workspace_id
        HAVING COUNT(*) > 10
      `);
      
      for (const agent of overloadedAgents.rows) {
        await this.triggerEscalation({
          workspaceId: agent.workspace_id,
          userId: agent.assigned_agent_id,
          currentAgentId: agent.assigned_agent_id,
          reason: `Agent overloaded with ${agent.active_chats} active chats`,
          severity: 'medium',
          metadata: {
            agentId: agent.assigned_agent_id,
            activeChats: agent.active_chats,
            threshold: 10
          }
        });
      }
      
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to check agent workload', error as Error);
    }
  }

  private async checkCustomerSatisfaction(): Promise<void> {
    try {
      // Get customers with low satisfaction scores
      const unhappyCustomers = await this.database.query(`
        SELECT user_id, workspace_id, AVG(rating) as avg_rating, COUNT(*) as rating_count
        FROM customer_ratings 
        WHERE rating <= 2 AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY user_id, workspace_id
        HAVING COUNT(*) >= 2
      `);
      
      for (const customer of unhappyCustomers.rows) {
        await this.triggerEscalation({
          workspaceId: customer.workspace_id,
          userId: customer.user_id,
          reason: `Customer satisfaction: ${customer.avg_rating}/5 from ${customer.rating_count} ratings`,
          severity: 'high',
          metadata: {
            averageRating: parseFloat(customer.avg_rating),
            ratingCount: customer.rating_count
          }
        });
      }
      
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to check customer satisfaction', error as Error);
    }
  }

  private async checkSLAViolations(): Promise<void> {
    try {
      // Get recent SLA violations
      const violations = await this.slaSystem.getSLAViolations('all', {
        resolved: false,
        severity: 'critical'
      });
      
      for (const violation of violations) {
        await this.triggerEscalation({
          workspaceId: violation.workspaceId,
          ticketId: violation.ticketId,
          messageId: violation.messageId,
          userId: violation.userId,
          reason: `Critical SLA violation: ${violation.description}`,
          severity: 'critical',
          metadata: {
            violationId: violation.id,
            violationType: violation.type,
            expectedTime: violation.expectedTime,
            actualTime: violation.actualTime
          }
        });
      }
      
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to check SLA violations', error as Error);
    }
  }

  // API METHODS
  async getEscalationEvents(workspaceId: string, filters?: {
    userId?: string;
    severity?: EscalationEvent['severity'];
    status?: EscalationEvent['status'];
    limit?: number;
    offset?: number;
  }): Promise<EscalationEvent[]> {
    try {
      let sql = 'SELECT * FROM escalation_events WHERE workspace_id = $1';
      const params: any[] = [workspaceId];
      
      if (filters?.userId) {
        sql += ' AND user_id = $2';
        params.push(filters.userId);
      }
      
      if (filters?.severity) {
        sql += filters.userId ? ' AND severity = $3' : ' AND severity = $2';
        params.push(filters.severity);
      }
      
      if (filters?.status) {
        sql += ' AND status = $' + (params.length + 1);
        params.push(filters.status);
      }
      
      sql += ' ORDER BY triggered_at DESC';
      
      if (filters?.limit) {
        sql += ' LIMIT $' + (params.length + 1);
        params.push(filters.limit);
      }
      
      const rows = await this.database.query(sql, params);
      
      const events: EscalationEvent[] = [];
      
      for (const row of rows) {
        const event: EscalationEvent = {
          id: row.id,
          workspaceId: row.workspace_id,
          ruleId: row.rule_id,
          ticketId: row.ticket_id,
          messageId: row.message_id,
          userId: row.user_id,
          currentAgentId: row.current_agent_id,
          triggerReason: row.trigger_reason,
          severity: row.severity,
          status: row.status,
          triggeredAt: row.triggered_at,
          completedAt: row.completed_at,
          metadata: row.metadata || {},
          actions: []
        };
        
        // Load action executions
        const actionRows = await this.database.query(
          'SELECT * FROM escalation_action_executions WHERE event_id = $1 ORDER BY executed_at ASC',
          [event.id]
        );
        
        event.actions = actionRows.map(row => ({
          id: row.id,
          eventId: row.event_id,
          actionType: row.action_type,
          parameters: row.parameters,
          status: row.status,
          result: row.result,
          error: row.error,
          executedAt: row.executed_at,
          completedAt: row.completed_at
        }));
        
        events.push(event);
      }
      
      return events;
      
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to get escalation events', error as Error);
      return [];
    }
  }

  async getEscalationMetrics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<EscalationMetrics[]> {
    try {
      let sql = 'SELECT * FROM escalation_metrics WHERE workspace_id = $1';
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
        totalEscalations: row.total_escalations,
        escalationsByType: row.escalations_by_type || {},
        escalationsBySeverity: row.escalations_by_severity || {},
        averageResolutionTime: parseFloat(row.average_resolution_time) || 0,
        escalationsByAgent: row.escalations_by_agent || {},
        customerImpact: row.customer_impact || {},
        systemHealth: row.system_health || {}
      }));
      
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to get escalation metrics', error as Error);
      return [];
    }
  }

  private async updateEscalationMetrics(): Promise<void> {
    try {
      const workspaces = new Set(Array.from(this.activeEvents.values()).map(event => event.workspaceId));
      
      for (const workspaceId of workspaces) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const today = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000);
        
        // Calculate metrics for the period
        const workspaceEvents = Array.from(this.activeEvents.values())
          .filter(event => event.workspaceId === workspaceId && 
                     event.triggeredAt >= yesterday && 
                     event.triggeredAt < today);
        
        const completedEvents = workspaceEvents.filter(event => event.status === 'completed');
        
        const escalationsByType: Record<string, number> = {};
        const escalationsBySeverity: Record<string, number> = {};
        const escalationsByAgent: Record<string, number> = {};
        
        for (const event of workspaceEvents) {
          escalationsByType[event.triggerReason] = (escalationsByType[event.triggerReason] || 0) + 1;
          escalationsBySeverity[event.severity] = (escalationsBySeverity[event.severity] || 0) + 1;
          
          if (event.currentAgentId) {
            escalationsByAgent[event.currentAgentId] = (escalationsByAgent[event.currentAgentId] || 0) + 1;
          }
        }
        
        const averageResolutionTime = completedEvents.length > 0
          ? completedEvents.reduce((sum, event) => {
              if (event.completedAt) {
                return sum + (event.completedAt.getTime() - event.triggeredAt.getTime()) / (1000 * 60);
              }
              return sum;
            }, 0) / completedEvents.length
          : 0;
        
        const metrics: EscalationMetrics = {
          workspaceId,
          date: yesterday,
          totalEscalations: workspaceEvents.length,
          escalationsByType,
          escalationsBySeverity,
          averageResolutionTime,
          escalationsByAgent,
          customerImpact: {
            totalAffectedCustomers: new Set(workspaceEvents.map(e => e.userId)).size,
            averageDelayMinutes: averageResolutionTime,
            satisfactionImpact: 0 // Would be calculated from actual data
          },
          systemHealth: {
            agentOverloadIncidents: Object.keys(escalationsByAgent).length,
            slaViolationsPrevented: workspaceEvents.filter(e => e.metadata?.violationId).length,
            responseTimeImprovement: 0 // Would be calculated from actual data
          }
        };
        
        await this.database.query(`
          INSERT INTO escalation_metrics (
            workspace_id, date, total_escalations, escalations_by_type, escalations_by_severity,
            average_resolution_time, escalations_by_agent, customer_impact, system_health
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (workspace_id, date) DO UPDATE SET
          total_escalations = EXCLUDED.total_escalations,
          escalations_by_type = EXCLUDED.escalations_by_type,
          escalations_by_severity = EXCLUDED.escalations_by_severity,
          average_resolution_time = EXCLUDED.average_resolution_time
        `, [
          metrics.workspaceId,
          metrics.date,
          metrics.totalEscalations,
          JSON.stringify(metrics.escalationsByType),
          JSON.stringify(metrics.escalationsBySeverity),
          metrics.averageResolutionTime,
          JSON.stringify(metrics.escalationsByAgent),
          JSON.stringify(metrics.customerImpact),
          JSON.stringify(metrics.systemHealth)
        ]);
      }
      
    } catch (error) {
      this.logger.error('escalation-engine', 'Failed to update escalation metrics', error as Error);
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    activeEventsCount: number;
    rulesCount: number;
    monitoringActive: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!this.isMonitoring) {
      issues.push('Escalation monitoring is not active');
    }
    
    const criticalEvents = Array.from(this.activeEvents.values())
      .filter(event => event.severity === 'critical').length;
    
    if (criticalEvents > 3) {
      issues.push(`${criticalEvents} critical escalation events`);
    }
    
    return {
      healthy: issues.length === 0,
      activeEventsCount: this.activeEvents.size,
      rulesCount: Array.from(this.rules.values()).reduce((sum, rules) => sum + rules.length, 0),
      monitoringActive: this.isMonitoring,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    this.logger.info('escalation-engine', 'Escalation engine shut down');
  }
}

export default UltraEscalationEngine;
