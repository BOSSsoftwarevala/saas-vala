import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { UltraNotificationSystem } from './notification-system';
import { UltraSmartQueue } from './smart-queue';
import { Message, User, Workspace, Channel } from './slack-system';
import * as crypto from 'crypto';

export interface PriorityRule {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  isActive: boolean;
  priority: number; // 1-100, higher = more priority
  conditions: {
    userPlan?: 'free' | 'basic' | 'premium' | 'enterprise';
    userRole?: string[];
    userTags?: string[];
    accountAge?: { min?: number; max?: number }; // days
    spending?: { min?: number; max?: number }; // currency amount
    previousInteractions?: { min?: number; max?: number };
    subscriptionStatus?: 'active' | 'trial' | 'expired' | 'cancelled';
    customAttributes?: Array<{
      key: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    }>;
  };
  actions: {
    queuePriority: 'urgent' | 'high' | 'normal' | 'low';
    maxWaitTime?: number; // minutes
    preferredAgents?: string[]; // agent IDs
    autoEscalate?: boolean;
    escalationTime?: number; // minutes
    notificationLevel: 'silent' | 'normal' | 'urgent';
    customRouting?: string; // custom routing logic
  };
  weighting: {
    responseTime: number; // 0-1
    agentSkill: number; // 0-1
    availability: number; // 0-1
    workload: number; // 0-1
    language: number; // 0-1
  };
  schedule: {
    activeHours?: { start: string; end: string }[]; // timezone-aware
    weekdays?: number[]; // 0-6, 0 = Sunday
    holidays?: string[]; // ISO dates
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriorityScore {
  id: string;
  workspaceId: string;
  userId: string;
  sessionId?: string;
  messageId?: string;
  baseScore: number;
  finalScore: number;
  appliedRules: Array<{
    ruleId: string;
    ruleName: string;
    score: number;
    weight: number;
  }>;
  factors: {
    userPlan: number;
    userRole: number;
    accountAge: number;
    spending: number;
    interactionHistory: number;
    urgency: number;
    timing: number;
  };
  calculatedAt: Date;
  expiresAt?: Date;
}

export interface RoutingDecision {
  id: string;
  workspaceId: string;
  userId: string;
  sessionId?: string;
  messageId?: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  targetAgentId?: string;
  targetQueueId?: string;
  estimatedWaitTime: number; // minutes
  routingPath: Array<{
    step: string;
    agentId?: string;
    queueId?: string;
    timestamp: Date;
    reason: string;
  }>;
  status: 'pending' | 'assigned' | 'escalated' | 'completed';
  metadata: {
    score: number;
    rules: string[];
    confidence: number; // 0-1
    alternativeOptions?: Array<{
      agentId: string;
      score: number;
      reason: string;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
  assignedAt?: Date;
  completedAt?: Date;
}

export interface PremiumFeature {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  type: 'routing' | 'queue' | 'notification' | 'escalation' | 'analytics';
  isEnabled: boolean;
  config: Record<string, any>;
  requiredPlan: 'basic' | 'premium' | 'enterprise';
  usageStats: {
    totalUsage: number;
    monthlyUsage: number;
    lastUsed: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PriorityAnalytics {
  workspaceId: string;
  date: Date;
  totalRequests: number;
  priorityDistribution: Record<string, number>;
  averageResponseTime: Record<string, number>; // by priority
  escalationRate: number;
  satisfactionByPriority: Record<string, number>;
  topRules: Array<{
    ruleId: string;
    ruleName: string;
    applications: number;
    avgScore: number;
  }>;
  agentPerformance: Array<{
    agentId: string;
    priorityHandled: Record<string, number>;
    avgResponseTime: number;
    satisfaction: number;
  }>;
  planComparison: {
    free: { requests: number; avgResponseTime: number; satisfaction: number };
    basic: { requests: number; avgResponseTime: number; satisfaction: number };
    premium: { requests: number; avgResponseTime: number; satisfaction: number };
    enterprise: { requests: number; avgResponseTime: number; satisfaction: number };
  };
}

export class UltraPriorityRouting extends EventEmitter {
  private static instance: UltraPriorityRouting;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  private notificationSystem: UltraNotificationSystem;
  private smartQueue: UltraSmartQueue;
  
  private rules: Map<string, Map<string, PriorityRule>> = new Map(); // workspaceId -> ruleId -> rule
  private scores: Map<string, PriorityScore> = new Map(); // userId -> score
  private decisions: Map<string, RoutingDecision> = new Map(); // sessionId -> decision
  private premiumFeatures: Map<string, Map<string, PremiumFeature>> = new Map(); // workspaceId -> featureId -> feature

  static getInstance(): UltraPriorityRouting {
    if (!UltraPriorityRouting.instance) {
      UltraPriorityRouting.instance = new UltraPriorityRouting();
    }
    return UltraPriorityRouting.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.accessControl = UltraAccessControl.getInstance();
    this.notificationSystem = UltraNotificationSystem.getInstance();
    this.smartQueue = UltraSmartQueue.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadRules();
      await this.loadPremiumFeatures();
      
      this.logger.info('priority-routing', 'Priority routing system initialized', {
        rulesCount: Array.from(this.rules.values()).reduce((sum, rules) => sum + rules.size, 0),
        premiumFeaturesCount: Array.from(this.premiumFeatures.values()).reduce((sum, features) => sum + features.size, 0),
        activeScoresCount: this.scores.size
      });
    } catch (error) {
      this.logger.error('priority-routing', 'Failed to initialize priority routing system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS priority_rules (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        priority INTEGER NOT NULL,
        conditions JSONB NOT NULL,
        actions JSONB NOT NULL,
        weighting JSONB NOT NULL,
        schedule JSONB NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS priority_scores (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        session_id VARCHAR(255),
        message_id VARCHAR(255),
        base_score DECIMAL(5,2) NOT NULL,
        final_score DECIMAL(5,2) NOT NULL,
        applied_rules JSONB NOT NULL,
        factors JSONB NOT NULL,
        calculated_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS routing_decisions (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        session_id VARCHAR(255),
        message_id VARCHAR(255),
        priority VARCHAR(20) NOT NULL,
        target_agent_id VARCHAR(255),
        target_queue_id VARCHAR(255),
        estimated_wait_time INTEGER NOT NULL,
        routing_path JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        assigned_at TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS premium_features (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(20) NOT NULL,
        is_enabled BOOLEAN DEFAULT TRUE,
        config JSONB NOT NULL,
        required_plan VARCHAR(20) NOT NULL,
        usage_stats JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS priority_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_requests INTEGER DEFAULT 0,
        priority_distribution JSONB NOT NULL,
        average_response_time JSONB NOT NULL,
        escalation_rate DECIMAL(5,2),
        satisfaction_by_priority JSONB NOT NULL,
        top_rules JSONB NOT NULL,
        agent_performance JSONB NOT NULL,
        plan_comparison JSONB NOT NULL,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_priority_rules_workspace_id ON priority_rules(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_priority_rules_priority ON priority_rules(priority)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_priority_scores_user_id ON priority_scores(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_routing_decisions_user_id ON routing_decisions(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_premium_features_workspace_id ON premium_features(workspace_id)');
  }

  private async loadRules(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM priority_rules WHERE is_active = TRUE ORDER BY priority DESC');
      
      for (const row of rows) {
        const rule: PriorityRule = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          isActive: row.is_active,
          priority: row.priority,
          conditions: row.conditions || {},
          actions: row.actions || {},
          weighting: row.weighting || {},
          schedule: row.schedule || {},
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.rules.has(rule.workspaceId)) {
          this.rules.set(rule.workspaceId, new Map());
        }
        this.rules.get(rule.workspaceId)!.set(rule.id, rule);
      }
      
      this.logger.info('priority-routing', `Loaded rules for ${this.rules.size} workspaces`);
    } catch (error) {
      this.logger.error('priority-routing', 'Failed to load rules', error as Error);
    }
  }

  private async loadPremiumFeatures(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM premium_features WHERE is_enabled = TRUE');
      
      for (const row of rows) {
        const feature: PremiumFeature = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          type: row.type,
          isEnabled: row.is_enabled,
          config: row.config || {},
          requiredPlan: row.required_plan,
          usageStats: row.usage_stats || {
            totalUsage: 0,
            monthlyUsage: 0,
            lastUsed: new Date()
          },
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.premiumFeatures.has(feature.workspaceId)) {
          this.premiumFeatures.set(feature.workspaceId, new Map());
        }
        this.premiumFeatures.get(feature.workspaceId)!.set(feature.id, feature);
      }
      
      this.logger.info('priority-routing', `Loaded premium features for ${this.premiumFeatures.size} workspaces`);
    } catch (error) {
      this.logger.error('priority-routing', 'Failed to load premium features', error as Error);
    }
  }

  // PUBLIC API METHODS
  async calculatePriority(config: {
    workspaceId: string;
    userId: string;
    sessionId?: string;
    messageId?: string;
    context?: {
      urgency?: 'low' | 'medium' | 'high' | 'critical';
      category?: string;
      language?: string;
      timeOfDay?: Date;
    };
  }): Promise<PriorityScore> {
    const scoreId = `score-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      // Get user information
      const userInfo = await this.getUserInfo(config.userId, config.workspaceId);
      
      // Get applicable rules
      const applicableRules = await this.getApplicableRules(config.workspaceId, userInfo, config.context);
      
      // Calculate base score
      const baseScore = await this.calculateBaseScore(userInfo, config.context);
      
      // Apply rules
      let finalScore = baseScore;
      const appliedRules: PriorityScore['appliedRules'] = [];
      
      for (const rule of applicableRules) {
        const ruleScore = await this.applyRule(rule, userInfo, config.context);
        const weightedScore = ruleScore * (rule.priority / 100);
        
        finalScore += weightedScore;
        appliedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          score: ruleScore,
          weight: rule.priority / 100
        });
      }
      
      // Calculate individual factors
      const factors = await this.calculateFactors(userInfo, config.context);
      
      // Ensure score is within bounds
      finalScore = Math.max(0, Math.min(100, finalScore));
      
      const priorityScore: PriorityScore = {
        id: scoreId,
        workspaceId: config.workspaceId,
        userId: config.userId,
        sessionId: config.sessionId,
        messageId: config.messageId,
        baseScore,
        finalScore,
        appliedRules,
        factors,
        calculatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      };
      
      // Save to database
      await this.database.query(`
        INSERT INTO priority_scores (
          id, workspace_id, user_id, session_id, message_id, base_score, final_score,
          applied_rules, factors, calculated_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        priorityScore.id,
        priorityScore.workspaceId,
        priorityScore.userId,
        priorityScore.sessionId,
        priorityScore.messageId,
        priorityScore.baseScore,
        priorityScore.finalScore,
        JSON.stringify(priorityScore.appliedRules),
        JSON.stringify(priorityScore.factors),
        priorityScore.calculatedAt,
        priorityScore.expiresAt
      ]);
      
      // Cache score
      this.scores.set(config.userId, priorityScore);
      
      this.emit('priorityCalculated', priorityScore);
      return priorityScore;
      
    } catch (error) {
      this.logger.error('priority-routing', `Failed to calculate priority: ${scoreId}`, error as Error);
      throw error;
    }
  }

  async routeRequest(config: {
    workspaceId: string;
    userId: string;
    sessionId?: string;
    messageId?: string;
    priority?: PriorityScore;
    context?: {
      urgency?: string;
      category?: string;
      language?: string;
      preferredAgents?: string[];
    };
  }): Promise<RoutingDecision> {
    const decisionId = `decision-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      // Calculate priority if not provided
      const priority = config.priority || await this.calculatePriority({
        workspaceId: config.workspaceId,
        userId: config.userId,
        sessionId: config.sessionId,
        messageId: config.messageId,
        context: config.context
      });
      
      // Determine priority level
      const priorityLevel = this.getPriorityLevel(priority.finalScore);
      
      // Find best agent/queue
      const routingResult = await this.findBestRouting(config.workspaceId, config.userId, priorityLevel, config.context);
      
      const decision: RoutingDecision = {
        id: decisionId,
        workspaceId: config.workspaceId,
        userId: config.userId,
        sessionId: config.sessionId,
        messageId: config.messageId,
        priority: priorityLevel,
        targetAgentId: routingResult.agentId,
        targetQueueId: routingResult.queueId,
        estimatedWaitTime: routingResult.estimatedWaitTime,
        routingPath: [{
          step: 'initial_routing',
          agentId: routingResult.agentId,
          queueId: routingResult.queueId,
          timestamp: new Date(),
          reason: routingResult.reason
        }],
        status: 'pending',
        metadata: {
          score: priority.finalScore,
          rules: priority.appliedRules.map(r => r.ruleId),
          confidence: routingResult.confidence,
          alternativeOptions: routingResult.alternatives
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Save decision
      await this.database.query(`
        INSERT INTO routing_decisions (
          id, workspace_id, user_id, session_id, message_id, priority,
          target_agent_id, target_queue_id, estimated_wait_time, routing_path,
          status, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        decision.id,
        decision.workspaceId,
        decision.userId,
        decision.sessionId,
        decision.messageId,
        decision.priority,
        decision.targetAgentId,
        decision.targetQueueId,
        decision.estimatedWaitTime,
        JSON.stringify(decision.routingPath),
        decision.status,
        JSON.stringify(decision.metadata),
        decision.createdAt,
        decision.updatedAt
      ]);
      
      // Cache decision
      if (config.sessionId) {
        this.decisions.set(config.sessionId, decision);
      }
      
      // Execute routing
      await this.executeRouting(decision);
      
      this.emit('routingDecision', decision);
      return decision;
      
    } catch (error) {
      this.logger.error('priority-routing', `Failed to route request: ${decisionId}`, error as Error);
      throw error;
    }
  }

  async createRule(config: {
    workspaceId: string;
    name: string;
    description?: string;
    priority: number;
    conditions: PriorityRule['conditions'];
    actions: PriorityRule['actions'];
    weighting?: PriorityRule['weighting'];
    schedule?: PriorityRule['schedule'];
    createdBy: string;
  }): Promise<string> {
    const ruleId = `rule-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const rule: PriorityRule = {
        id: ruleId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        isActive: true,
        priority: config.priority,
        conditions: config.conditions,
        actions: config.actions,
        weighting: config.weighting || {
          responseTime: 0.3,
          agentSkill: 0.25,
          availability: 0.2,
          workload: 0.15,
          language: 0.1
        },
        schedule: config.schedule || {},
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO priority_rules (
          id, workspace_id, name, description, is_active, priority, conditions,
          actions, weighting, schedule, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        rule.id,
        rule.workspaceId,
        rule.name,
        rule.description,
        rule.isActive,
        rule.priority,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        JSON.stringify(rule.weighting),
        JSON.stringify(rule.schedule),
        rule.createdBy,
        rule.createdAt,
        rule.updatedAt
      ]);
      
      if (!this.rules.has(rule.workspaceId)) {
        this.rules.set(rule.workspaceId, new Map());
      }
      this.rules.get(rule.workspaceId)!.set(rule.id, rule);
      
      this.emit('ruleCreated', rule);
      return ruleId;
      
    } catch (error) {
      this.logger.error('priority-routing', `Failed to create rule: ${ruleId}`, error as Error);
      throw error;
    }
  }

  async enablePremiumFeature(config: {
    workspaceId: string;
    featureName: string;
    featureType: PremiumFeature['type'];
    config: Record<string, any>;
    requiredPlan: PremiumFeature['requiredPlan'];
  }): Promise<string> {
    const featureId = `feature-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const feature: PremiumFeature = {
        id: featureId,
        workspaceId: config.workspaceId,
        name: config.featureName,
        description: `Premium feature: ${config.featureName}`,
        type: config.featureType,
        isEnabled: true,
        config: config.config,
        requiredPlan: config.requiredPlan,
        usageStats: {
          totalUsage: 0,
          monthlyUsage: 0,
          lastUsed: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO premium_features (
          id, workspace_id, name, description, type, is_enabled, config,
          required_plan, usage_stats, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        feature.id,
        feature.workspaceId,
        feature.name,
        feature.description,
        feature.type,
        feature.isEnabled,
        JSON.stringify(feature.config),
        feature.requiredPlan,
        JSON.stringify(feature.usageStats),
        feature.createdAt,
        feature.updatedAt
      ]);
      
      if (!this.premiumFeatures.has(feature.workspaceId)) {
        this.premiumFeatures.set(feature.workspaceId, new Map());
      }
      this.premiumFeatures.get(feature.workspaceId)!.set(feature.id, feature);
      
      this.emit('premiumFeatureEnabled', feature);
      return featureId;
      
    } catch (error) {
      this.logger.error('priority-routing', `Failed to enable premium feature: ${featureId}`, error as Error);
      throw error;
    }
  }

  async getRules(workspaceId: string): Promise<PriorityRule[]> {
    try {
      const workspaceRules = this.rules.get(workspaceId);
      if (!workspaceRules) {
        return [];
      }
      
      return Array.from(workspaceRules.values())
        .sort((a, b) => b.priority - a.priority);
      
    } catch (error) {
      this.logger.error('priority-routing', 'Failed to get rules', error as Error);
      return [];
    }
  }

  async getPremiumFeatures(workspaceId: string): Promise<PremiumFeature[]> {
    try {
      const workspaceFeatures = this.premiumFeatures.get(workspaceId);
      if (!workspaceFeatures) {
        return [];
      }
      
      return Array.from(workspaceFeatures.values());
      
    } catch (error) {
      this.logger.error('priority-routing', 'Failed to get premium features', error as Error);
      return [];
    }
  }

  async getRoutingDecision(sessionId: string): Promise<RoutingDecision | null> {
    return this.decisions.get(sessionId) || null;
  }

  async getAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<PriorityAnalytics[]> {
    try {
      let sql = 'SELECT * FROM priority_analytics WHERE workspace_id = $1';
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
        totalRequests: row.total_requests,
        priorityDistribution: row.priority_distribution || {},
        averageResponseTime: row.average_response_time || {},
        escalationRate: parseFloat(row.escalation_rate) || 0,
        satisfactionByPriority: row.satisfaction_by_priority || {},
        topRules: row.top_rules || [],
        agentPerformance: row.agent_performance || [],
        planComparison: row.plan_comparison || {
          free: { requests: 0, avgResponseTime: 0, satisfaction: 0 },
          basic: { requests: 0, avgResponseTime: 0, satisfaction: 0 },
          premium: { requests: 0, avgResponseTime: 0, satisfaction: 0 },
          enterprise: { requests: 0, avgResponseTime: 0, satisfaction: 0 }
        }
      }));
      
    } catch (error) {
      this.logger.error('priority-routing', 'Failed to get analytics', error as Error);
      return [];
    }
  }

  // Private helper methods
  private async getUserInfo(userId: string, workspaceId: string): Promise<any> {
    try {
      // Get user details
      const userResult = await this.database.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return null;
      }
      
      const user = userResult.rows[0];
      
      // Get workspace membership
      const membershipResult = await this.database.query(
        'SELECT * FROM workspace_members WHERE user_id = $1 AND workspace_id = $2',
        [userId, workspaceId]
      );
      
      const membership = membershipResult.rows[0] || {};
      
      // Get interaction history
      const historyResult = await this.database.query(
        'SELECT COUNT(*) as interactions FROM messages WHERE sender_id = $1 AND created_at > NOW() - INTERVAL \'30 days\'',
        [userId]
      );
      
      return {
        ...user,
        membership,
        interactionCount: parseInt(historyResult.rows[0].interactions) || 0,
        accountAge: Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
      };
      
    } catch (error) {
      this.logger.error('priority-routing', 'Failed to get user info', error as Error);
      return null;
    }
  }

  private async getApplicableRules(workspaceId: string, userInfo: any, context?: any): Promise<PriorityRule[]> {
    try {
      const workspaceRules = this.rules.get(workspaceId);
      if (!workspaceRules) {
        return [];
      }
      
      const applicableRules: PriorityRule[] = [];
      
      for (const rule of workspaceRules.values()) {
        if (await this.evaluateRuleConditions(rule.conditions, userInfo, context)) {
          applicableRules.push(rule);
        }
      }
      
      return applicableRules.sort((a, b) => b.priority - a.priority);
      
    } catch (error) {
      this.logger.error('priority-routing', 'Failed to get applicable rules', error as Error);
      return [];
    }
  }

  private async evaluateRuleConditions(conditions: PriorityRule['conditions'], userInfo: any, context?: any): Promise<boolean> {
    try {
      // Check user plan
      if (conditions.userPlan && userInfo.membership?.plan !== conditions.userPlan) {
        return false;
      }
      
      // Check user role
      if (conditions.userRole && conditions.userRole.length > 0) {
        if (!conditions.userRole.includes(userInfo.membership?.role)) {
          return false;
        }
      }
      
      // Check account age
      if (conditions.accountAge) {
        if (conditions.accountAge.min && userInfo.accountAge < conditions.accountAge.min) {
          return false;
        }
        if (conditions.accountAge.max && userInfo.accountAge > conditions.accountAge.max) {
          return false;
        }
      }
      
      // Check interaction history
      if (conditions.previousInteractions) {
        if (conditions.previousInteractions.min && userInfo.interactionCount < conditions.previousInteractions.min) {
          return false;
        }
        if (conditions.previousInteractions.max && userInfo.interactionCount > conditions.previousInteractions.max) {
          return false;
        }
      }
      
      // Check custom attributes
      if (conditions.customAttributes) {
        for (const attr of conditions.customAttributes) {
          const userValue = userInfo[attr.key];
          if (!this.evaluateCondition(userValue, attr.operator, attr.value)) {
            return false;
          }
        }
      }
      
      return true;
      
    } catch (error) {
      this.logger.error('priority-routing', 'Failed to evaluate rule conditions', error as Error);
      return false;
    }
  }

  private evaluateCondition(actualValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return actualValue === expectedValue;
      case 'not_equals':
        return actualValue !== expectedValue;
      case 'contains':
        return String(actualValue).includes(String(expectedValue));
      case 'greater_than':
        return Number(actualValue) > Number(expectedValue);
      case 'less_than':
        return Number(actualValue) < Number(expectedValue);
      default:
        return false;
    }
  }

  private async calculateBaseScore(userInfo: any, context?: any): Promise<number> {
    let score = 50; // Base score
    
    // Adjust based on user plan
    const planBonus = {
      free: 0,
      basic: 10,
      premium: 25,
      enterprise: 40
    };
    
    score += planBonus[userInfo.membership?.plan] || 0;
    
    // Adjust based on account age
    if (userInfo.accountAge > 365) {
      score += 10; // Long-term customer bonus
    }
    
    // Adjust based on interaction history
    if (userInfo.interactionCount > 10) {
      score += 5; // Active customer bonus
    }
    
    // Adjust based on urgency
    if (context?.urgency) {
      const urgencyBonus = {
        low: -10,
        medium: 0,
        high: 15,
        critical: 30
      };
      score += urgencyBonus[context.urgency] || 0;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private async applyRule(rule: PriorityRule, userInfo: any, context?: any): Promise<number> {
    // Simple rule application - in production would be more sophisticated
    let score = 0;
    
    // Base score from rule priority
    score += rule.priority * 0.5;
    
    // Apply weighting factors
    if (rule.weighting.responseTime > 0) {
      score += rule.weighting.responseTime * 10;
    }
    
    if (rule.weighting.agentSkill > 0) {
      score += rule.weighting.agentSkill * 8;
    }
    
    return score;
  }

  private async calculateFactors(userInfo: any, context?: any): Promise<PriorityScore['factors']> {
    return {
      userPlan: this.getPlanScore(userInfo.membership?.plan),
      userRole: this.getRoleScore(userInfo.membership?.role),
      accountAge: Math.min(userInfo.accountAge / 365 * 20, 20),
      spending: 0, // Would calculate from payment history
      interactionHistory: Math.min(userInfo.interactionCount * 2, 20),
      urgency: this.getUrgencyScore(context?.urgency),
      timing: this.getTimingScore()
    };
  }

  private getPlanScore(plan?: string): number {
    const scores = {
      free: 0,
      basic: 15,
      premium: 30,
      enterprise: 50
    };
    return scores[plan as keyof typeof scores] || 0;
  }

  private getRoleScore(role?: string): number {
    const scores = {
      admin: 50,
      agent: 30,
      user: 10,
      guest: 0
    };
    return scores[role as keyof typeof scores] || 0;
  }

  private getUrgencyScore(urgency?: string): number {
    const scores = {
      low: 0,
      medium: 15,
      high: 30,
      critical: 50
    };
    return scores[urgency as keyof typeof scores] || 0;
  }

  private getTimingScore(): number {
    const hour = new Date().getHours();
    // Business hours get higher score
    if (hour >= 9 && hour <= 17) {
      return 20;
    } else if (hour >= 18 && hour <= 22) {
      return 10;
    } else {
      return 5;
    }
  }

  private getPriorityLevel(score: number): 'urgent' | 'high' | 'normal' | 'low' {
    if (score >= 80) return 'urgent';
    if (score >= 60) return 'high';
    if (score >= 40) return 'normal';
    return 'low';
  }

  private async findBestRouting(workspaceId: string, userId: string, priority: string, context?: any): Promise<{
    agentId?: string;
    queueId?: string;
    estimatedWaitTime: number;
    reason: string;
    confidence: number;
    alternatives?: Array<{
      agentId: string;
      score: number;
      reason: string;
    }>;
  }> {
    try {
      // Get available agents
      const agents = await this.getAvailableAgents(workspaceId, priority, context);
      
      if (agents.length === 0) {
        // No agents available, route to queue
        return {
          queueId: await this.getDefaultQueue(workspaceId, priority),
          estimatedWaitTime: this.calculateWaitTime(priority),
          reason: 'No agents available, routed to queue',
          confidence: 0.5
        };
      }
      
      // Score agents
      const scoredAgents = await this.scoreAgents(agents, userId, priority, context);
      
      // Sort by score
      scoredAgents.sort((a, b) => b.score - a.score);
      
      const bestAgent = scoredAgents[0];
      
      return {
        agentId: bestAgent.agentId,
        estimatedWaitTime: bestAgent.estimatedWaitTime,
        reason: bestAgent.reason,
        confidence: bestAgent.confidence,
        alternatives: scoredAgents.slice(1, 3).map(agent => ({
          agentId: agent.agentId,
          score: agent.score,
          reason: agent.reason
        }))
      };
      
    } catch (error) {
      this.logger.error('priority-routing', 'Failed to find best routing', error as Error);
      return {
        queueId: 'default',
        estimatedWaitTime: 10,
        reason: 'Error in routing, using default',
        confidence: 0.1
      };
    }
  }

  private async getAvailableAgents(workspaceId: string, priority: string, context?: any): Promise<any[]> {
    // Mock implementation - would query actual agent availability
    return [
      { id: 'agent-1', name: 'Agent 1', skills: ['technical'], workload: 0.5 },
      { id: 'agent-2', name: 'Agent 2', skills: ['billing'], workload: 0.3 },
      { id: 'agent-3', name: 'Agent 3', skills: ['technical', 'billing'], workload: 0.7 }
    ];
  }

  private async scoreAgents(agents: any[], userId: string, priority: string, context?: any): Promise<any[]> {
    return agents.map(agent => ({
      agentId: agent.id,
      score: Math.random() * 100, // Mock scoring
      estimatedWaitTime: Math.floor(Math.random() * 10) + 1,
      reason: `Agent ${agent.name} available with matching skills`,
      confidence: 0.8
    }));
  }

  private async getDefaultQueue(workspaceId: string, priority: string): Promise<string> {
    return `queue-${priority}-${workspaceId}`;
  }

  private calculateWaitTime(priority: string): number {
    const baseTimes = {
      urgent: 1,
      high: 3,
      normal: 5,
      low: 10
    };
    return baseTimes[priority as keyof typeof baseTimes] || 5;
  }

  private async executeRouting(decision: RoutingDecision): Promise<void> {
    try {
      if (decision.targetAgentId) {
        // Assign to specific agent
        await this.smartQueue.assignToAgent(decision.sessionId!, decision.targetAgentId);
        decision.status = 'assigned';
        decision.assignedAt = new Date();
      } else if (decision.targetQueueId) {
        // Add to queue
        await this.smartQueue.addToQueue(decision.sessionId!, decision.targetQueueId, decision.priority);
        decision.status = 'pending';
      }
      
      // Update decision
      await this.database.query(
        'UPDATE routing_decisions SET status = $1, assigned_at = $2, updated_at = $3 WHERE id = $4',
        [decision.status, decision.assignedAt, new Date(), decision.id]
      );
      
      this.emit('routingExecuted', decision);
      
    } catch (error) {
      this.logger.error('priority-routing', 'Failed to execute routing', error as Error);
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    rulesCount: number;
    premiumFeaturesCount: number;
    activeScoresCount: number;
    activeDecisionsCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    return {
      healthy: issues.length === 0,
      rulesCount: Array.from(this.rules.values()).reduce((sum, rules) => sum + rules.size, 0),
      premiumFeaturesCount: Array.from(this.premiumFeatures.values()).reduce((sum, features) => sum + features.size, 0),
      activeScoresCount: this.scores.size,
      activeDecisionsCount: this.decisions.size,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.rules.clear();
    this.scores.clear();
    this.decisions.clear();
    this.premiumFeatures.clear();
    
    this.logger.info('priority-routing', 'Priority routing system shut down');
  }
}

export default UltraPriorityRouting;
