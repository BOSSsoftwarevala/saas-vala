import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraNotificationSystem } from './notification-system';
import { UltraSmartQueue } from './smart-queue';
import { Message, User, Workspace } from './slack-system';
import * as crypto from 'crypto';

export interface SLAPolicy {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  plan: 'basic' | 'premium' | 'enterprise' | 'custom';
  responseTime: {
    initial: number; // minutes
    urgent: number; // minutes
    high: number; // minutes
    medium: number; // minutes
    low: number; // minutes
  };
  resolutionTime: {
    urgent: number; // hours
    high: number; // hours
    medium: number; // hours
    low: number; // hours
  };
  availability: {
    businessHours: {
      start: string; // "09:00"
      end: string; // "17:00"
      timezone: string;
      days: number[]; // 1-7 (Monday-Sunday)
    };
    support24x7: boolean;
    holidays: string[]; // ISO dates
  };
  escalationRules: EscalationRule[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationRule {
  id: string;
  condition: 'response_time_exceeded' | 'resolution_time_exceeded' | 'no_agent_response' | 'customer_unhappy';
  threshold: number; // minutes/hours
  action: 'reassign_agent' | 'escalate_to_admin' | 'escalate_to_super_admin' | 'notify_manager';
  delay: number; // minutes before action
  isActive: boolean;
}

export interface SLAViolation {
  id: string;
  workspaceId: string;
  policyId: string;
  ticketId?: string;
  messageId?: string;
  userId: string;
  type: 'response_time' | 'resolution_time' | 'availability';
  severity: 'minor' | 'major' | 'critical';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  expectedTime: number; // minutes
  actualTime: number; // minutes
  violationTime: Date;
  resolvedAt?: Date;
  escalated: boolean;
  escalatedTo?: string;
  description: string;
  impact: string;
  compensation?: {
    type: 'refund' | 'credit' | 'extension';
    amount?: number;
    description: string;
  };
}

export interface SLAMetrics {
  workspaceId: string;
  date: Date;
  totalTickets: number;
  responseTimeMet: number;
  resolutionTimeMet: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  violationsByType: Record<string, number>;
  violationsBySeverity: Record<string, number>;
  complianceRate: number; // percentage
  customerSatisfaction: number; // 1-5
}

export interface SLATimer {
  id: string;
  workspaceId: string;
  ticketId?: string;
  messageId?: string;
  userId: string;
  type: 'response' | 'resolution';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  startTime: Date;
  endTime?: Date;
  threshold: number; // minutes
  remaining: number; // minutes
  status: 'active' | 'paused' | 'completed' | 'expired' | 'escalated';
  assignedAgent?: string;
  isVisibleToCustomer: boolean;
}

export class UltraSLASystem extends EventEmitter {
  private static instance: UltraSLASystem;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private notificationSystem: UltraNotificationSystem;
  private smartQueue: UltraSmartQueue;
  
  private policies: Map<string, SLAPolicy[]> = new Map(); // workspaceId -> policies
  private timers: Map<string, SLATimer> = new Map();
  private violations: Map<string, SLAViolation> = new Map();
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout;

  static getInstance(): UltraSLASystem {
    if (!UltraSLASystem.instance) {
      UltraSLASystem.instance = new UltraSLASystem();
    }
    return UltraSLASystem.instance;
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
      await this.loadPolicies();
      await this.loadActiveTimers();
      await this.loadViolations();
      this.startMonitoring();
      
      this.logger.info('sla-system', 'SLA system initialized', {
        policiesCount: Array.from(this.policies.values()).reduce((sum, policies) => sum + policies.length, 0),
        activeTimersCount: this.timers.size,
        violationsCount: this.violations.size
      });
    } catch (error) {
      this.logger.error('sla-system', 'Failed to initialize SLA system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS sla_policies (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        plan VARCHAR(20) NOT NULL,
        response_time JSONB NOT NULL,
        resolution_time JSONB NOT NULL,
        availability JSONB NOT NULL,
        escalation_rules JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS sla_violations (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        policy_id VARCHAR(255) NOT NULL,
        ticket_id VARCHAR(255),
        message_id VARCHAR(255),
        user_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        severity VARCHAR(10) NOT NULL,
        priority VARCHAR(10) NOT NULL,
        expected_time INTEGER NOT NULL,
        actual_time INTEGER NOT NULL,
        violation_time TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        escalated BOOLEAN DEFAULT FALSE,
        escalated_to VARCHAR(255),
        description TEXT NOT NULL,
        impact TEXT,
        compensation JSONB
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS sla_timers (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        ticket_id VARCHAR(255),
        message_id VARCHAR(255),
        user_id VARCHAR(255) NOT NULL,
        type VARCHAR(10) NOT NULL,
        priority VARCHAR(10) NOT NULL,
        start_time TIMESTAMP DEFAULT NOW(),
        end_time TIMESTAMP,
        threshold INTEGER NOT NULL,
        remaining INTEGER NOT NULL,
        status VARCHAR(15) NOT NULL,
        assigned_agent VARCHAR(255),
        is_visible_to_customer BOOLEAN DEFAULT TRUE
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS sla_metrics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_tickets INTEGER DEFAULT 0,
        response_time_met INTEGER DEFAULT 0,
        resolution_time_met INTEGER DEFAULT 0,
        average_response_time DECIMAL(8,2),
        average_resolution_time DECIMAL(8,2),
        violations_by_type JSONB NOT NULL,
        violations_by_severity JSONB NOT NULL,
        compliance_rate DECIMAL(5,2),
        customer_satisfaction DECIMAL(3,2),
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_sla_policies_workspace_id ON sla_policies(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_sla_violations_workspace_id ON sla_violations(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_sla_violations_user_id ON sla_violations(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_sla_timers_workspace_id ON sla_timers(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_sla_timers_status ON sla_timers(status)');
  }

  private async loadPolicies(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM sla_policies WHERE is_active = TRUE');
      
      for (const row of rows) {
        const policy: SLAPolicy = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          plan: row.plan,
          responseTime: row.response_time,
          resolutionTime: row.resolution_time,
          availability: row.availability,
          escalationRules: row.escalation_rules || [],
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.policies.has(policy.workspaceId)) {
          this.policies.set(policy.workspaceId, []);
        }
        this.policies.get(policy.workspaceId)!.push(policy);
      }
      
      this.logger.info('sla-system', `Loaded SLA policies for ${this.policies.size} workspaces`);
    } catch (error) {
      this.logger.error('sla-system', 'Failed to load SLA policies', error as Error);
    }
  }

  private async loadActiveTimers(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM sla_timers WHERE status IN (\'active\', \'paused\')');
      
      for (const row of rows) {
        const timer: SLATimer = {
          id: row.id,
          workspaceId: row.workspace_id,
          ticketId: row.ticket_id,
          messageId: row.message_id,
          userId: row.user_id,
          type: row.type,
          priority: row.priority,
          startTime: row.start_time,
          endTime: row.end_time,
          threshold: row.threshold,
          remaining: row.remaining,
          status: row.status,
          assignedAgent: row.assigned_agent,
          isVisibleToCustomer: row.is_visible_to_customer
        };
        
        this.timers.set(timer.id, timer);
      }
      
      this.logger.info('sla-system', `Loaded ${this.timers.size} active SLA timers`);
    } catch (error) {
      this.logger.error('sla-system', 'Failed to load SLA timers', error as Error);
    }
  }

  private async loadViolations(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM sla_violations WHERE resolved_at IS NULL ORDER BY violation_time DESC LIMIT 10000');
      
      for (const row of rows) {
        const violation: SLAViolation = {
          id: row.id,
          workspaceId: row.workspace_id,
          policyId: row.policy_id,
          ticketId: row.ticket_id,
          messageId: row.message_id,
          userId: row.user_id,
          type: row.type,
          severity: row.severity,
          priority: row.priority,
          expectedTime: row.expected_time,
          actualTime: row.actual_time,
          violationTime: row.violation_time,
          resolvedAt: row.resolved_at,
          escalated: row.escalated,
          escalatedTo: row.escalated_to,
          description: row.description,
          impact: row.impact,
          compensation: row.compensation
        };
        
        this.violations.set(violation.id, violation);
      }
      
      this.logger.info('sla-system', `Loaded ${this.violations.size} active SLA violations`);
    } catch (error) {
      this.logger.error('sla-system', 'Failed to load SLA violations', error as Error);
    }
  }

  private startMonitoring(): void {
    this.isMonitoring = true;
    
    // Monitor SLA timers every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.monitorSLATimers();
      }
    }, 30000);
  }

  // PUBLIC API METHODS
  async createSLAPolicy(config: {
    workspaceId: string;
    name: string;
    description?: string;
    plan: SLAPolicy['plan'];
    responseTime: SLAPolicy['responseTime'];
    resolutionTime: SLAPolicy['resolutionTime'];
    availability: SLAPolicy['availability'];
    escalationRules?: EscalationRule[];
  }): Promise<string> {
    const policyId = `sla-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const policy: SLAPolicy = {
        id: policyId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        plan: config.plan,
        responseTime: config.responseTime,
        resolutionTime: config.resolutionTime,
        availability: config.availability,
        escalationRules: config.escalationRules || [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO sla_policies (
          id, workspace_id, name, description, plan, response_time, resolution_time,
          availability, escalation_rules, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        policy.id,
        policy.workspaceId,
        policy.name,
        policy.description,
        policy.plan,
        JSON.stringify(policy.responseTime),
        JSON.stringify(policy.resolutionTime),
        JSON.stringify(policy.availability),
        JSON.stringify(policy.escalationRules),
        policy.isActive,
        policy.createdAt,
        policy.updatedAt
      ]);
      
      if (!this.policies.has(policy.workspaceId)) {
        this.policies.set(policy.workspaceId, []);
      }
      this.policies.get(policy.workspaceId)!.push(policy);
      
      this.emit('policyCreated', policy);
      return policyId;
      
    } catch (error) {
      this.logger.error('sla-system', `Failed to create SLA policy: ${policyId}`, error as Error);
      throw error;
    }
  }

  async startSLATimer(config: {
    workspaceId: string;
    type: 'response' | 'resolution';
    priority: 'urgent' | 'high' | 'medium' | 'low';
    userId: string;
    ticketId?: string;
    messageId?: string;
    assignedAgent?: string;
    isVisibleToCustomer?: boolean;
  }): Promise<string> {
    const timerId = `timer-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const policy = await this.getApplicablePolicy(config.workspaceId, config.userId);
      if (!policy) {
        this.logger.warn('sla-system', `No SLA policy found for user: ${config.userId}`);
        return '';
      }
      
      const threshold = config.type === 'response' 
        ? policy.responseTime[config.priority]
        : policy.resolutionTime[config.priority];
      
      const timer: SLATimer = {
        id: timerId,
        workspaceId: config.workspaceId,
        ticketId: config.ticketId,
        messageId: config.messageId,
        userId: config.userId,
        type: config.type,
        priority: config.priority,
        startTime: new Date(),
        threshold,
        remaining: threshold,
        status: 'active',
        assignedAgent: config.assignedAgent,
        isVisibleToCustomer: config.isVisibleToCustomer ?? true
      };
      
      await this.database.query(`
        INSERT INTO sla_timers (
          id, workspace_id, ticket_id, message_id, user_id, type, priority,
          start_time, threshold, remaining, status, assigned_agent, is_visible_to_customer
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        timer.id,
        timer.workspaceId,
        timer.ticketId,
        timer.messageId,
        timer.userId,
        timer.type,
        timer.priority,
        timer.startTime,
        timer.threshold,
        timer.remaining,
        timer.status,
        timer.assignedAgent,
        timer.isVisibleToCustomer
      ]);
      
      this.timers.set(timerId, timer);
      
      this.emit('timerStarted', timer);
      this.logger.info('sla-system', `SLA timer started: ${timerId}`, {
        type: config.type,
        priority: config.priority,
        threshold
      });
      
      return timerId;
      
    } catch (error) {
      this.logger.error('sla-system', `Failed to start SLA timer: ${timerId}`, error as Error);
      throw error;
    }
  }

  async stopSLATimer(timerId: string, completed: boolean = true): Promise<boolean> {
    try {
      const timer = this.timers.get(timerId);
      if (!timer) return false;
      
      timer.endTime = new Date();
      timer.status = completed ? 'completed' : 'expired';
      
      if (completed) {
        const elapsed = Math.floor((timer.endTime.getTime() - timer.startTime.getTime()) / (1000 * 60));
        timer.remaining = Math.max(0, timer.threshold - elapsed);
      } else {
        await this.handleSLAViolation(timer);
      }
      
      await this.database.query(
        'UPDATE sla_timers SET end_time = $1, status = $2, remaining = $3 WHERE id = $4',
        [timer.endTime, timer.status, timer.remaining, timerId]
      );
      
      if (!completed) {
        this.timers.delete(timerId);
      }
      
      this.emit('timerStopped', { timer, completed });
      return true;
      
    } catch (error) {
      this.logger.error('sla-system', `Failed to stop SLA timer: ${timerId}`, error as Error);
      return false;
    }
  }

  private async getApplicablePolicy(workspaceId: string, userId: string): Promise<SLAPolicy | null> {
    try {
      const workspacePolicies = this.policies.get(workspaceId) || [];
      if (workspacePolicies.length === 0) return null;
      
      // Get user's plan/subscription level
      const user = await this.database.query(
        'SELECT subscription_tier FROM users WHERE id = $1 AND workspace_id = $2',
        [userId, workspaceId]
      );
      
      const userPlan = user.rows[0]?.subscription_tier || 'basic';
      
      // Find matching policy
      const matchingPolicy = workspacePolicies.find(policy => policy.plan === userPlan);
      return matchingPolicy || workspacePolicies.find(policy => policy.plan === 'basic');
      
    } catch (error) {
      this.logger.error('sla-system', 'Failed to get applicable SLA policy', error as Error);
      return null;
    }
  }

  private async monitorSLATimers(): Promise<void> {
    try {
      const now = new Date();
      const timersToCheck = Array.from(this.timers.values())
        .filter(timer => timer.status === 'active');
      
      for (const timer of timersToCheck) {
        const elapsed = Math.floor((now.getTime() - timer.startTime.getTime()) / (1000 * 60));
        const remaining = Math.max(0, timer.threshold - elapsed);
        
        // Update remaining time
        if (remaining !== timer.remaining) {
          timer.remaining = remaining;
          
          await this.database.query(
            'UPDATE sla_timers SET remaining = $1 WHERE id = $2',
            [remaining, timer.id]
          );
          
          // Emit timer update for real-time display
          this.emit('timerUpdated', timer);
        }
        
        // Check for violations
        if (remaining <= 0 && timer.status === 'active') {
          await this.handleSLAViolation(timer);
        }
        
        // Check for escalation warnings (50% and 75% of time used)
        if (remaining > 0) {
          const usagePercent = ((timer.threshold - remaining) / timer.threshold) * 100;
          
          if (usagePercent >= 75 && !timer.assignedAgent) {
            await this.sendEscalationWarning(timer, 'warning_75');
          } else if (usagePercent >= 50 && !timer.assignedAgent) {
            await this.sendEscalationWarning(timer, 'warning_50');
          }
        }
      }
      
    } catch (error) {
      this.logger.error('sla-system', 'Failed to monitor SLA timers', error as Error);
    }
  }

  private async handleSLAViolation(timer: SLATimer): Promise<void> {
    try {
      const policy = await this.getApplicablePolicy(timer.workspaceId, timer.userId);
      if (!policy) return;
      
      const violationId = `violation-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const elapsed = Math.floor((new Date().getTime() - timer.startTime.getTime()) / (1000 * 60));
      
      const violation: SLAViolation = {
        id: violationId,
        workspaceId: timer.workspaceId,
        policyId: policy.id,
        ticketId: timer.ticketId,
        messageId: timer.messageId,
        userId: timer.userId,
        type: timer.type === 'response' ? 'response_time' : 'resolution_time',
        severity: this.calculateViolationSeverity(timer.priority, elapsed, timer.threshold),
        priority: timer.priority,
        expectedTime: timer.threshold,
        actualTime: elapsed,
        violationTime: new Date(),
        escalated: false,
        description: `SLA violation: ${timer.type} time exceeded for ${timer.priority} priority request`,
        impact: this.calculateViolationImpact(timer.type, timer.priority, elapsed - timer.threshold)
      };
      
      await this.database.query(`
        INSERT INTO sla_violations (
          id, workspace_id, policy_id, ticket_id, message_id, user_id, type,
          severity, priority, expected_time, actual_time, violation_time,
          escalated, description, impact
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        violation.id,
        violation.workspaceId,
        violation.policyId,
        violation.ticketId,
        violation.messageId,
        violation.userId,
        violation.type,
        violation.severity,
        violation.priority,
        violation.expectedTime,
        violation.actualTime,
        violation.violationTime,
        violation.escalated,
        violation.description,
        violation.impact
      ]);
      
      this.violations.set(violationId, violation);
      
      // Update timer status
      timer.status = 'escalated';
      await this.database.query('UPDATE sla_timers SET status = $1 WHERE id = $2', ['escalated', timer.id]);
      
      // Handle escalation
      await this.handleEscalation(violation, policy);
      
      // Notify stakeholders
      await this.notifyViolation(violation);
      
      this.emit('violationOccurred', violation);
      this.logger.warn('sla-system', `SLA violation occurred: ${violationId}`, {
        type: violation.type,
        severity: violation.severity,
        priority: violation.priority,
        expectedTime: violation.expectedTime,
        actualTime: violation.actualTime
      });
      
    } catch (error) {
      this.logger.error('sla-system', 'Failed to handle SLA violation', error as Error);
    }
  }

  private calculateViolationSeverity(priority: string, actualTime: number, expectedTime: number): SLAViolation['severity'] {
    const overagePercent = ((actualTime - expectedTime) / expectedTime) * 100;
    
    if (priority === 'urgent') {
      return overagePercent > 50 ? 'critical' : overagePercent > 20 ? 'major' : 'minor';
    } else if (priority === 'high') {
      return overagePercent > 100 ? 'critical' : overagePercent > 50 ? 'major' : 'minor';
    } else {
      return overagePercent > 200 ? 'critical' : overagePercent > 100 ? 'major' : 'minor';
    }
  }

  private calculateViolationImpact(type: string, priority: string, overageMinutes: number): string {
    const hours = Math.floor(overageMinutes / 60);
    const minutes = overageMinutes % 60;
    
    if (type === 'response_time') {
      return `Customer waited ${hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`} longer than promised for initial response`;
    } else {
      return `Issue resolution delayed by ${hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`} beyond SLA commitment`;
    }
  }

  private async handleEscalation(violation: SLAViolation, policy: SLAPolicy): Promise<void> {
    try {
      const applicableRules = policy.escalationRules.filter(rule => rule.isActive);
      
      for (const rule of applicableRules) {
        if (await this.evaluateEscalationRule(rule, violation)) {
          await this.executeEscalationAction(rule, violation);
          
          // Mark violation as escalated
          violation.escalated = true;
          violation.escalatedTo = rule.action;
          
          await this.database.query(
            'UPDATE sla_violations SET escalated = TRUE, escalated_to = $1 WHERE id = $2',
            [rule.action, violation.id]
          );
          
          break; // Execute first matching rule only
        }
      }
      
    } catch (error) {
      this.logger.error('sla-system', 'Failed to handle escalation', error as Error);
    }
  }

  private async evaluateEscalationRule(rule: EscalationRule, violation: SLAViolation): Promise<boolean> {
    switch (rule.condition) {
      case 'response_time_exceeded':
        return violation.type === 'response_time';
      case 'resolution_time_exceeded':
        return violation.type === 'resolution_time';
      case 'no_agent_response':
        // Check if assigned agent hasn't responded
        return violation.actualTime > rule.threshold;
      case 'customer_unhappy':
        // Would check customer satisfaction if available
        return false;
      default:
        return false;
    }
  }

  private async executeEscalationAction(rule: EscalationRule, violation: SLAViolation): Promise<void> {
    try {
      switch (rule.action) {
        case 'reassign_agent':
          if (violation.ticketId) {
            await this.smartQueue.updateItemStatus(violation.ticketId, 'waiting');
            // Trigger reassignment
            await this.smartQueue.processQueueAssignment();
          }
          break;
          
        case 'escalate_to_admin':
          await this.escalateToAdmin(violation, 'admin');
          break;
          
        case 'escalate_to_super_admin':
          await this.escalateToAdmin(violation, 'super_admin');
          break;
          
        case 'notify_manager':
          await this.notifyManager(violation);
          break;
      }
      
      this.logger.info('sla-system', `Escalation action executed: ${rule.action}`, {
        violationId: violation.id,
        ruleDelay: rule.delay
      });
      
    } catch (error) {
      this.logger.error('sla-system', 'Failed to execute escalation action', error as Error);
    }
  }

  private async escalateToAdmin(violation: SLAViolation, adminType: 'admin' | 'super_admin'): Promise<void> {
    try {
      const admins = await this.database.query(
        `SELECT user_id FROM workspace_members WHERE role = $1 AND workspace_id = $2`,
        [adminType, violation.workspaceId]
      );
      
      for (const admin of admins.rows) {
        await this.notificationSystem.createNotification({
          userId: admin.user_id,
          workspaceId: violation.workspaceId,
          type: 'system',
          title: `SLA Violation Escalation - ${violation.severity.toUpperCase()}`,
          content: `A ${violation.type} SLA violation requires immediate attention. Priority: ${violation.priority}`,
          data: {
            violationId: violation.id,
            ticketId: violation.ticketId,
            userId: violation.userId,
            severity: violation.severity
          },
          priority: violation.severity === 'critical' ? 'urgent' : 'high'
        });
      }
      
    } catch (error) {
      this.logger.error('sla-system', 'Failed to escalate to admin', error as Error);
    }
  }

  private async notifyManager(violation: SLAViolation): Promise<void> {
    try {
      // Get managers/supervisors
      const managers = await this.database.query(
        `SELECT user_id FROM workspace_members WHERE role IN ('admin', 'manager') AND workspace_id = $1`,
        [violation.workspaceId]
      );
      
      for (const manager of managers.rows) {
        await this.notificationSystem.createNotification({
          userId: manager.user_id,
          workspaceId: violation.workspaceId,
          type: 'system',
          title: 'SLA Violation Alert',
          content: `SLA violation detected: ${violation.description}`,
          data: {
            violationId: violation.id,
            severity: violation.severity,
            impact: violation.impact
          },
          priority: 'high'
        });
      }
      
    } catch (error) {
      this.logger.error('sla-system', 'Failed to notify manager', error as Error);
    }
  }

  private async sendEscalationWarning(timer: SLATimer, warningType: string): Promise<void> {
    try {
      const percent = warningType === 'warning_75' ? 75 : 50;
      
      // Notify assigned agent if exists
      if (timer.assignedAgent) {
        await this.notificationSystem.createNotification({
          userId: timer.assignedAgent,
          workspaceId: timer.workspaceId,
          type: 'system',
          title: 'SLA Timer Warning',
          content: `${percent}% of ${timer.type} time used for ${timer.priority} priority request`,
          data: {
            timerId: timer.id,
            remaining: timer.remaining,
            percent
          },
          priority: 'medium'
        });
      }
      
      // Notify supervisors
      const supervisors = await this.database.query(
        `SELECT user_id FROM workspace_members WHERE role IN ('admin', 'manager') AND workspace_id = $1`,
        [timer.workspaceId]
      );
      
      for (const supervisor of supervisors.rows) {
        await this.notificationSystem.createNotification({
          userId: supervisor.user_id,
          workspaceId: timer.workspaceId,
          type: 'system',
          title: 'SLA Timer Warning',
          content: `${percent}% of SLA time used without agent assignment`,
          data: {
            timerId: timer.id,
            priority: timer.priority,
            remaining: timer.remaining
          },
          priority: 'medium'
        });
      }
      
    } catch (error) {
      this.logger.error('sla-system', 'Failed to send escalation warning', error as Error);
    }
  }

  private async notifyViolation(violation: SLAViolation): Promise<void> {
    try {
      // Notify customer if appropriate
      if (violation.severity !== 'critical') {
        await this.notificationSystem.createNotification({
          userId: violation.userId,
          workspaceId: violation.workspaceId,
          type: 'system',
          title: 'Support Delay Notice',
          content: 'We\'re experiencing longer response times than usual. Your request has been prioritized.',
          data: {
            violationId: violation.id,
            type: violation.type
          },
          priority: 'medium'
        });
      }
      
    } catch (error) {
      this.logger.error('sla-system', 'Failed to notify violation', error as Error);
    }
  }

  // API METHODS
  async getSLATimers(workspaceId: string, filters?: {
    userId?: string;
    status?: SLATimer['status'];
    type?: SLATimer['type'];
    priority?: SLATimer['priority'];
    limit?: number;
    offset?: number;
  }): Promise<SLATimer[]> {
    let timers = Array.from(this.timers.values())
      .filter(timer => timer.workspaceId === workspaceId);
    
    if (filters?.userId) {
      timers = timers.filter(timer => timer.userId === filters.userId);
    }
    
    if (filters?.status) {
      timers = timers.filter(timer => timer.status === filters.status);
    }
    
    if (filters?.type) {
      timers = timers.filter(timer => timer.type === filters.type);
    }
    
    if (filters?.priority) {
      timers = timers.filter(timer => timer.priority === filters.priority);
    }
    
    timers.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    
    if (filters?.limit) {
      const start = filters.offset || 0;
      timers = timers.slice(start, start + filters.limit);
    }
    
    return timers;
  }

  async getSLAViolations(workspaceId: string, filters?: {
    userId?: string;
    severity?: SLAViolation['severity'];
    type?: SLAViolation['type'];
    resolved?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<SLAViolation[]> {
    try {
      let sql = 'SELECT * FROM sla_violations WHERE workspace_id = $1';
      const params: any[] = [workspaceId];
      
      if (filters?.userId) {
        sql += ' AND user_id = $2';
        params.push(filters.userId);
      }
      
      if (filters?.severity) {
        sql += filters.userId ? ' AND severity = $3' : ' AND severity = $2';
        params.push(filters.severity);
      }
      
      if (filters?.type) {
        sql += ' AND type = $' + (params.length + 1);
        params.push(filters.type);
      }
      
      if (filters?.resolved !== undefined) {
        sql += ' AND resolved_at IS ' + (filters.resolved ? 'NOT NULL' : 'NULL');
      }
      
      sql += ' ORDER BY violation_time DESC';
      
      if (filters?.limit) {
        sql += ' LIMIT $' + (params.length + 1);
        params.push(filters.limit);
      }
      
      const rows = await this.database.query(sql, params);
      
      return rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        policyId: row.policy_id,
        ticketId: row.ticket_id,
        messageId: row.message_id,
        userId: row.user_id,
        type: row.type,
        severity: row.severity,
        priority: row.priority,
        expectedTime: row.expected_time,
        actualTime: row.actual_time,
        violationTime: row.violation_time,
        resolvedAt: row.resolved_at,
        escalated: row.escalated,
        escalatedTo: row.escalated_to,
        description: row.description,
        impact: row.impact,
        compensation: row.compensation
      }));
      
    } catch (error) {
      this.logger.error('sla-system', 'Failed to get SLA violations', error as Error);
      return [];
    }
  }

  async getSLAMetrics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<SLAMetrics[]> {
    try {
      let sql = 'SELECT * FROM sla_metrics WHERE workspace_id = $1';
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
        totalTickets: row.total_tickets,
        responseTimeMet: row.response_time_met,
        resolutionTimeMet: row.resolution_time_met,
        averageResponseTime: parseFloat(row.average_response_time) || 0,
        averageResolutionTime: parseFloat(row.average_resolution_time) || 0,
        violationsByType: row.violations_by_type || {},
        violationsBySeverity: row.violations_by_severity || {},
        complianceRate: parseFloat(row.compliance_rate) || 0,
        customerSatisfaction: parseFloat(row.customer_satisfaction) || 0
      }));
      
    } catch (error) {
      this.logger.error('sla-system', 'Failed to get SLA metrics', error as Error);
      return [];
    }
  }

  async updateSLAMetrics(): Promise<void> {
    try {
      const workspaces = new Set(Array.from(this.timers.values()).map(timer => timer.workspaceId));
      
      for (const workspaceId of workspaces) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const today = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000);
        
        // Calculate metrics for the period
        const workspaceTimers = Array.from(this.timers.values())
          .filter(timer => timer.workspaceId === workspaceId && 
                     timer.startTime >= yesterday && 
                     timer.startTime < today);
        
        const completedTimers = workspaceTimers.filter(timer => timer.status === 'completed');
        const responseTimers = workspaceTimers.filter(timer => timer.type === 'response');
        const resolutionTimers = workspaceTimers.filter(timer => timer.type === 'resolution');
        
        const totalTickets = responseTimers.length;
        const responseTimeMet = completedTimers.filter(timer => 
          timer.type === 'response' && timer.remaining > 0
        ).length;
        const resolutionTimeMet = completedTimers.filter(timer => 
          timer.type === 'resolution' && timer.remaining > 0
        ).length;
        
        const averageResponseTime = responseTimers.length > 0
          ? responseTimers.reduce((sum, timer) => {
              const elapsed = timer.endTime 
                ? (timer.endTime.getTime() - timer.startTime.getTime()) / (1000 * 60)
                : (new Date().getTime() - timer.startTime.getTime()) / (1000 * 60);
              return sum + elapsed;
            }, 0) / responseTimers.length
          : 0;
        
        const averageResolutionTime = resolutionTimers.length > 0
          ? resolutionTimers.reduce((sum, timer) => {
              const elapsed = timer.endTime 
                ? (timer.endTime.getTime() - timer.startTime.getTime()) / (1000 * 60)
                : (new Date().getTime() - timer.startTime.getTime()) / (1000 * 60);
              return sum + elapsed;
            }, 0) / resolutionTimers.length
          : 0;
        
        const complianceRate = totalTickets > 0 
          ? ((responseTimeMet / totalTickets) * 100)
          : 0;
        
        const metrics: SLAMetrics = {
          workspaceId,
          date: yesterday,
          totalTickets,
          responseTimeMet,
          resolutionTimeMet,
          averageResponseTime,
          averageResolutionTime,
          violationsByType: {},
          violationsBySeverity: {},
          complianceRate,
          customerSatisfaction: 4.0 // Would be calculated from actual feedback
        };
        
        await this.database.query(`
          INSERT INTO sla_metrics (
            workspace_id, date, total_tickets, response_time_met, resolution_time_met,
            average_response_time, average_resolution_time, violations_by_type,
            violations_by_severity, compliance_rate, customer_satisfaction
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (workspace_id, date) DO UPDATE SET
          total_tickets = EXCLUDED.total_tickets,
          response_time_met = EXCLUDED.response_time_met,
          resolution_time_met = EXCLUDED.resolution_time_met,
          average_response_time = EXCLUDED.average_response_time,
          average_resolution_time = EXCLUDED.average_resolution_time,
          compliance_rate = EXCLUDED.compliance_rate
        `, [
          metrics.workspaceId,
          metrics.date,
          metrics.totalTickets,
          metrics.responseTimeMet,
          metrics.resolutionTimeMet,
          metrics.averageResponseTime,
          metrics.averageResolutionTime,
          JSON.stringify(metrics.violationsByType),
          JSON.stringify(metrics.violationsBySeverity),
          metrics.complianceRate,
          metrics.customerSatisfaction
        ]);
      }
      
    } catch (error) {
      this.logger.error('sla-system', 'Failed to update SLA metrics', error as Error);
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    activeTimersCount: number;
    violationsCount: number;
    policiesCount: number;
    monitoringActive: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!this.isMonitoring) {
      issues.push('SLA monitoring is not active');
    }
    
    const criticalViolations = Array.from(this.violations.values())
      .filter(v => v.severity === 'critical').length;
    
    if (criticalViolations > 5) {
      issues.push(`${criticalViolations} critical SLA violations`);
    }
    
    return {
      healthy: issues.length === 0,
      activeTimersCount: this.timers.size,
      violationsCount: this.violations.size,
      policiesCount: Array.from(this.policies.values()).reduce((sum, policies) => sum + policies.length, 0),
      monitoringActive: this.isMonitoring,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.logger.info('sla-system', 'SLA system shut down');
  }
}

export default UltraSLASystem;
