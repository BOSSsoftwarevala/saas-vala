import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl, ROLE_LEVELS } from './access-control';
import { UltraNotificationSystem } from './notification-system';
import { Message, User, Workspace } from './slack-system';
import * as crypto from 'crypto';

export interface QueueItem {
  id: string;
  workspaceId: string;
  type: 'chat' | 'ticket' | 'escalation';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'waiting' | 'assigned' | 'active' | 'resolved' | 'closed';
  userId: string;
  resellerId?: string;
  assignedAgent?: string;
  channelId?: string;
  messageId?: string;
  ticketId?: string;
  subject?: string;
  category?: string;
  language?: string;
  tags: string[];
  metadata: QueueMetadata;
  createdAt: Date;
  assignedAt?: Date;
  resolvedAt?: Date;
  updatedAt: Date;
}

export interface QueueMetadata {
  source: 'web' | 'mobile' | 'email' | 'api';
  userAgent?: string;
  ipAddress?: string;
  estimatedResolution?: number; // minutes
  satisfactionScore?: number;
  firstResponseTime?: number; // seconds
  totalResolutionTime?: number; // seconds
  agentPerformance?: {
    responseTime: number;
    resolutionTime: number;
    satisfactionScore: number;
  };
  autoDetected?: {
    sentiment: 'positive' | 'neutral' | 'negative';
    urgency: number; // 1-10
    complexity: number; // 1-10
    category: string;
  };
}

export interface Agent {
  id: string;
  userId: string;
  workspaceId: string;
  status: 'online' | 'busy' | 'offline' | 'away';
  capacity: number; // Max concurrent chats
  currentLoad: number;
  skills: string[];
  languages: string[];
  specializations: string[];
  performance: AgentPerformance;
  lastActivity: Date;
  isAvailable: boolean;
}

export interface AgentPerformance {
  totalChats: number;
  averageResponseTime: number; // seconds
  averageResolutionTime: number; // seconds
  satisfactionScore: number; // 1-5
  resolutionRate: number; // percentage
  escalationRate: number; // percentage
  lastUpdated: Date;
}

export interface QueueStats {
  workspaceId: string;
  date: Date;
  totalItems: number;
  waitingItems: number;
  activeItems: number;
  resolvedItems: number;
  averageWaitTime: number; // minutes
  averageResolutionTime: number; // minutes
  agentUtilization: number; // percentage
  satisfactionScore: number; // 1-5
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  byAgent: Record<string, number>;
}

export interface RoutingRule {
  id: string;
  workspaceId: string;
  name: string;
  conditions: RoutingCondition[];
  actions: RoutingAction[];
  priority: number;
  isActive: boolean;
  matchCount: number;
  lastMatched?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutingCondition {
  field: 'priority' | 'category' | 'language' | 'reseller' | 'user_type' | 'time_of_day' | 'sentiment';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
}

export interface RoutingAction {
  type: 'assign_agent' | 'assign_group' | 'set_priority' | 'escalate' | 'notify' | 'create_ticket';
  parameters: any;
  delay?: number; // minutes
}

export class UltraSmartQueue extends EventEmitter {
  private static instance: UltraSmartQueue;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  private notificationSystem: UltraNotificationSystem;
  private queue: Map<string, QueueItem> = new Map();
  private agents: Map<string, Agent> = new Map(); // workspaceId -> agents
  private routingRules: Map<string, RoutingRule[]> = new Map(); // workspaceId -> rules
  private processingQueue = false;
  private autoAssignmentInterval: NodeJS.Timeout;

  static getInstance(): UltraSmartQueue {
    if (!UltraSmartQueue.instance) {
      UltraSmartQueue.instance = new UltraSmartQueue();
    }
    return UltraSmartQueue.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.accessControl = UltraAccessControl.getInstance();
    this.notificationSystem = UltraNotificationSystem.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadQueue();
      await this.loadAgents();
      await this.loadRoutingRules();
      this.startAutoAssignment();
      this.startPerformanceMonitoring();
      
      this.logger.info('smart-queue', 'Smart queue system initialized', {
        queueSize: this.queue.size,
        agentsCount: Array.from(this.agents.values()).reduce((sum, agents) => sum + agents.length, 0),
        routingRulesCount: Array.from(this.routingRules.values()).reduce((sum, rules) => sum + rules.length, 0)
      });
    } catch (error) {
      this.logger.error('smart-queue', 'Failed to initialize smart queue system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS queue_items (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        priority VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        reseller_id VARCHAR(255),
        assigned_agent VARCHAR(255),
        channel_id VARCHAR(255),
        message_id VARCHAR(255),
        ticket_id VARCHAR(255),
        subject VARCHAR(255),
        category VARCHAR(100),
        language VARCHAR(10),
        tags TEXT[],
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        assigned_at TIMESTAMP,
        resolved_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        capacity INTEGER NOT NULL,
        current_load INTEGER DEFAULT 0,
        skills TEXT[],
        languages TEXT[],
        specializations TEXT[],
        performance JSONB NOT NULL,
        last_activity TIMESTAMP DEFAULT NOW(),
        is_available BOOLEAN DEFAULT TRUE,
        UNIQUE(user_id, workspace_id)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS routing_rules (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        conditions JSONB NOT NULL,
        actions JSONB NOT NULL,
        priority INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        match_count INTEGER DEFAULT 0,
        last_matched TIMESTAMP,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS queue_stats (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_items INTEGER DEFAULT 0,
        waiting_items INTEGER DEFAULT 0,
        active_items INTEGER DEFAULT 0,
        resolved_items INTEGER DEFAULT 0,
        average_wait_time DECIMAL(10,2),
        average_resolution_time DECIMAL(10,2),
        agent_utilization DECIMAL(5,2),
        satisfaction_score DECIMAL(3,2),
        by_priority JSONB NOT NULL,
        by_category JSONB NOT NULL,
        by_agent JSONB NOT NULL,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_queue_items_workspace_id ON queue_items(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_queue_items_status ON queue_items(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_queue_items_priority ON queue_items(priority)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_queue_items_assigned_agent ON queue_items(assigned_agent)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON agents(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_routing_rules_workspace_id ON routing_rules(workspace_id)');
  }

  private async loadQueue(): Promise<void> {
    try {
      const rows = await this.database.query(`
        SELECT * FROM queue_items 
        WHERE status IN ('waiting', 'assigned', 'active') 
        ORDER BY created_at ASC
      `);
      
      for (const row of rows) {
        const item: QueueItem = {
          id: row.id,
          workspaceId: row.workspace_id,
          type: row.type,
          priority: row.priority,
          status: row.status,
          userId: row.user_id,
          resellerId: row.reseller_id,
          assignedAgent: row.assigned_agent,
          channelId: row.channel_id,
          messageId: row.message_id,
          ticketId: row.ticket_id,
          subject: row.subject,
          category: row.category,
          language: row.language,
          tags: row.tags || [],
          metadata: row.metadata || {},
          createdAt: row.created_at,
          assignedAt: row.assigned_at,
          resolvedAt: row.resolved_at,
          updatedAt: row.updated_at
        };
        
        this.queue.set(item.id, item);
      }
      
      this.logger.info('smart-queue', `Loaded ${this.queue.size} queue items`);
    } catch (error) {
      this.logger.error('smart-queue', 'Failed to load queue', error as Error);
    }
  }

  private async loadAgents(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM agents WHERE is_available = TRUE');
      
      for (const row of rows) {
        const agent: Agent = {
          id: row.id,
          userId: row.user_id,
          workspaceId: row.workspace_id,
          status: row.status,
          capacity: row.capacity,
          currentLoad: row.current_load,
          skills: row.skills || [],
          languages: row.languages || [],
          specializations: row.specializations || [],
          performance: row.performance || {
            totalChats: 0,
            averageResponseTime: 0,
            averageResolutionTime: 0,
            satisfactionScore: 0,
            resolutionRate: 0,
            escalationRate: 0,
            lastUpdated: new Date()
          },
          lastActivity: row.last_activity,
          isAvailable: row.is_available
        };
        
        if (!this.agents.has(agent.workspaceId)) {
          this.agents.set(agent.workspaceId, []);
        }
        this.agents.get(agent.workspaceId)!.push(agent);
      }
      
      this.logger.info('smart-queue', `Loaded agents for ${this.agents.size} workspaces`);
    } catch (error) {
      this.logger.error('smart-queue', 'Failed to load agents', error as Error);
    }
  }

  private async loadRoutingRules(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM routing_rules WHERE is_active = TRUE ORDER BY priority DESC');
      
      for (const row of rows) {
        const rule: RoutingRule = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          conditions: row.conditions || [],
          actions: row.actions || [],
          priority: row.priority,
          isActive: row.is_active,
          matchCount: row.match_count,
          lastMatched: row.last_matched,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.routingRules.has(rule.workspaceId)) {
          this.routingRules.set(rule.workspaceId, []);
        }
        this.routingRules.get(rule.workspaceId)!.push(rule);
      }
      
      this.logger.info('smart-queue', `Loaded routing rules for ${this.routingRules.size} workspaces`);
    } catch (error) {
      this.logger.error('smart-queue', 'Failed to load routing rules', error as Error);
    }
  }

  private startAutoAssignment(): void {
    // Run auto-assignment every 30 seconds
    this.autoAssignmentInterval = setInterval(async () => {
      if (!this.processingQueue) {
        await this.processQueueAssignment();
      }
    }, 30000);
  }

  private startPerformanceMonitoring(): void {
    // Update performance metrics every 5 minutes
    setInterval(async () => {
      await this.updateAgentPerformance();
    }, 5 * 60 * 1000);

    // Update queue statistics every hour
    setInterval(async () => {
      await this.updateQueueStats();
    }, 60 * 60 * 1000);
  }

  // PUBLIC API METHODS
  async addToQueue(config: {
    workspaceId: string;
    type: QueueItem['type'];
    userId: string;
    resellerId?: string;
    priority?: QueueItem['priority'];
    subject?: string;
    category?: string;
    language?: string;
    tags?: string[];
    metadata?: Partial<QueueMetadata>;
    channelId?: string;
    messageId?: string;
    ticketId?: string;
  }): Promise<string> {
    const queueId = `queue-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      // Auto-detect priority if not provided
      const priority = config.priority || await this.detectPriority(config);
      
      // Auto-detect category if not provided
      const category = config.category || await this.detectCategory(config);
      
      // Auto-detect language if not provided
      const language = config.language || await this.detectLanguage(config);
      
      const item: QueueItem = {
        id: queueId,
        workspaceId: config.workspaceId,
        type: config.type,
        priority,
        status: 'waiting',
        userId: config.userId,
        resellerId: config.resellerId,
        channelId: config.channelId,
        messageId: config.messageId,
        ticketId: config.ticketId,
        subject: config.subject,
        category,
        language,
        tags: config.tags || [],
        metadata: {
          source: 'web',
          estimatedResolution: await this.estimateResolutionTime(config),
          ...config.metadata
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO queue_items (
          id, workspace_id, type, priority, status, user_id, reseller_id,
          channel_id, message_id, ticket_id, subject, category, language,
          tags, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        item.id,
        item.workspaceId,
        item.type,
        item.priority,
        item.status,
        item.userId,
        item.resellerId,
        item.channelId,
        item.messageId,
        item.ticketId,
        item.subject,
        item.category,
        item.language,
        item.tags,
        JSON.stringify(item.metadata),
        item.createdAt,
        item.updatedAt
      ]);
      
      this.queue.set(queueId, item);
      
      // Apply routing rules
      await this.applyRoutingRules(item);
      
      // Trigger immediate assignment for high priority items
      if (item.priority === 'urgent' || item.priority === 'high') {
        await this.processQueueAssignment();
      }
      
      this.emit('itemAddedToQueue', item);
      this.logger.info('smart-queue', `Item added to queue: ${queueId}`, {
        workspaceId: config.workspaceId,
        type: config.type,
        priority,
        category
      });
      
      return queueId;
      
    } catch (error) {
      this.logger.error('smart-queue', `Failed to add item to queue: ${queueId}`, error as Error);
      throw error;
    }
  }

  private async detectPriority(config: any): Promise<QueueItem['priority']> {
    try {
      // Analyze content and user history to determine priority
      const hasUrgentKeywords = config.subject?.toLowerCase().includes('urgent') || 
                               config.subject?.toLowerCase().includes('emergency');
      
      if (hasUrgentKeywords) return 'urgent';
      
      // Check user's subscription level or previous issues
      const isPremiumUser = await this.isPremiumUser(config.userId, config.workspaceId);
      if (isPremiumUser) return 'high';
      
      return 'medium';
    } catch (error) {
      return 'medium';
    }
  }

  private async detectCategory(config: any): Promise<string> {
    try {
      // Simple keyword-based category detection
      const subject = (config.subject || '').toLowerCase();
      
      if (subject.includes('login') || subject.includes('password')) return 'authentication';
      if (subject.includes('payment') || subject.includes('billing')) return 'billing';
      if (subject.includes('bug') || subject.includes('error')) return 'technical';
      if (subject.includes('feature') || subject.includes('request')) return 'feature_request';
      
      return 'general';
    } catch (error) {
      return 'general';
    }
  }

  private async detectLanguage(config: any): Promise<string> {
    try {
      // Simple language detection - in production would use proper language detection
      const subject = config.subject || '';
      if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþß]/i.test(subject)) return 'fr';
      if (/[äöüß]/i.test(subject)) return 'de';
      if (/[ñáéíóúü]/i.test(subject)) return 'es';
      
      return 'en';
    } catch (error) {
      return 'en';
    }
  }

  private async estimateResolutionTime(config: any): Promise<number> {
    try {
      const category = await this.detectCategory(config);
      const baseTimes = {
        'authentication': 15,
        'billing': 30,
        'technical': 45,
        'feature_request': 60,
        'general': 20
      };
      
      return baseTimes[category as keyof typeof baseTimes] || 30;
    } catch (error) {
      return 30;
    }
  }

  private async isPremiumUser(userId: string, workspaceId: string): Promise<boolean> {
    try {
      // Check if user has premium subscription
      const user = await this.database.query(
        'SELECT subscription_tier FROM users WHERE id = $1 AND workspace_id = $2',
        [userId, workspaceId]
      );
      
      return user.rows[0]?.subscription_tier === 'premium';
    } catch (error) {
      return false;
    }
  }

  private async applyRoutingRules(item: QueueItem): Promise<void> {
    try {
      const rules = this.routingRules.get(item.workspaceId) || [];
      
      for (const rule of rules) {
        if (await this.evaluateRoutingCondition(rule.conditions, item)) {
          await this.executeRoutingActions(rule.actions, item);
          
          // Update rule match count
          rule.matchCount++;
          rule.lastMatched = new Date();
          await this.updateRoutingRule(rule);
          
          this.logger.info('smart-queue', `Routing rule matched: ${rule.name}`, {
            queueItemId: item.id,
            ruleId: rule.id
          });
          
          break; // Stop after first match
        }
      }
    } catch (error) {
      this.logger.error('smart-queue', `Failed to apply routing rules: ${item.id}`, error as Error);
    }
  }

  private async evaluateRoutingCondition(conditions: RoutingCondition[], item: QueueItem): Promise<boolean> {
    for (const condition of conditions) {
      let matches = false;
      
      switch (condition.field) {
        case 'priority':
          matches = this.evaluateCondition(item.priority, condition.operator, condition.value);
          break;
        case 'category':
          matches = this.evaluateCondition(item.category, condition.operator, condition.value);
          break;
        case 'language':
          matches = this.evaluateCondition(item.language, condition.operator, condition.value);
          break;
        case 'reseller':
          matches = this.evaluateCondition(item.resellerId, condition.operator, condition.value);
          break;
        case 'user_type':
          const userType = await this.getUserType(item.userId, item.workspaceId);
          matches = this.evaluateCondition(userType, condition.operator, condition.value);
          break;
        case 'time_of_day':
          const currentHour = new Date().getHours();
          matches = this.evaluateCondition(currentHour, condition.operator, condition.value);
          break;
        case 'sentiment':
          const sentiment = item.metadata.autoDetected?.sentiment || 'neutral';
          matches = this.evaluateCondition(sentiment, condition.operator, condition.value);
          break;
      }
      
      if (!matches) return false;
    }
    
    return true;
  }

  private evaluateCondition(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'greater_than':
        return Number(actual) > Number(expected);
      case 'less_than':
        return Number(actual) < Number(expected);
      default:
        return false;
    }
  }

  private async executeRoutingActions(actions: RoutingAction[], item: QueueItem): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'assign_agent':
          if (action.parameters.agentId) {
            await this.assignToAgent(item.id, action.parameters.agentId);
          }
          break;
        case 'assign_group':
          await this.assignToGroup(item.id, action.parameters.groupId);
          break;
        case 'set_priority':
          await this.updatePriority(item.id, action.parameters.priority);
          break;
        case 'escalate':
          await this.escalateItem(item.id, action.parameters.reason);
          break;
        case 'notify':
          await this.notifyAgents(item, action.parameters.message);
          break;
        case 'create_ticket':
          await this.createTicketFromQueue(item);
          break;
      }
    }
  }

  private async processQueueAssignment(): Promise<void> {
    if (this.processingQueue) return;
    
    this.processingQueue = true;
    
    try {
      const waitingItems = Array.from(this.queue.values())
        .filter(item => item.status === 'waiting')
        .sort((a, b) => {
          // Sort by priority first, then by creation time
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          const aPriority = priorityOrder[a.priority] || 0;
          const bPriority = priorityOrder[b.priority] || 0;
          
          if (aPriority !== bPriority) {
            return bPriority - aPriority;
          }
          
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
      
      for (const item of waitingItems) {
        const assignedAgent = await this.findBestAgent(item);
        if (assignedAgent) {
          await this.assignToAgent(item.id, assignedAgent.id);
        }
      }
      
    } catch (error) {
      this.logger.error('smart-queue', 'Failed to process queue assignment', error as Error);
    } finally {
      this.processingQueue = false;
    }
  }

  private async findBestAgent(item: QueueItem): Promise<Agent | null> {
    try {
      const workspaceAgents = this.agents.get(item.workspaceId) || [];
      
      // Filter available agents
      const availableAgents = workspaceAgents.filter(agent => 
        agent.isAvailable && 
        agent.status === 'online' && 
        agent.currentLoad < agent.capacity
      );
      
      if (availableAgents.length === 0) return null;
      
      // Score agents based on multiple factors
      const scoredAgents = await Promise.all(
        availableAgents.map(async agent => ({
          agent,
          score: await this.calculateAgentScore(agent, item)
        }))
      );
      
      // Sort by score (highest first)
      scoredAgents.sort((a, b) => b.score - a.score);
      
      return scoredAgents[0]?.agent || null;
      
    } catch (error) {
      this.logger.error('smart-queue', 'Failed to find best agent', error as Error);
      return null;
    }
  }

  private async calculateAgentScore(agent: Agent, item: QueueItem): Promise<number> {
    let score = 0;
    
    // Language match (30 points)
    if (item.language && agent.languages.includes(item.language)) {
      score += 30;
    }
    
    // Skills match (25 points)
    if (item.category && agent.skills.includes(item.category)) {
      score += 25;
    }
    
    // Specialization match (20 points)
    if (item.category && agent.specializations.includes(item.category)) {
      score += 20;
    }
    
    // Current load (15 points) - lower load = higher score
    const loadRatio = agent.currentLoad / agent.capacity;
    score += Math.max(0, 15 - (loadRatio * 15));
    
    // Performance score (10 points)
    score += Math.min(10, agent.performance.satisfactionScore * 2);
    
    return score;
  }

  private async assignToAgent(queueItemId: string, agentId: string): Promise<boolean> {
    try {
      const item = this.queue.get(queueItemId);
      if (!item) return false;
      
      const workspaceAgents = this.agents.get(item.workspaceId) || [];
      const agent = workspaceAgents.find(a => a.id === agentId);
      if (!agent) return false;
      
      // Update queue item
      item.assignedAgent = agentId;
      item.status = 'assigned';
      item.assignedAt = new Date();
      item.updatedAt = new Date();
      
      await this.database.query(`
        UPDATE queue_items 
        SET assigned_agent = $1, status = $2, assigned_at = $3, updated_at = $4
        WHERE id = $5
      `, [agentId, item.status, item.assignedAt, item.updatedAt, item.id]);
      
      // Update agent load
      agent.currentLoad++;
      agent.lastActivity = new Date();
      await this.updateAgentLoad(agent);
      
      // Notify agent
      await this.notifyAgentAssignment(agent, item);
      
      this.emit('itemAssigned', { item, agent });
      this.logger.info('smart-queue', `Queue item assigned: ${queueItemId}`, {
        agentId,
        agentUserId: agent.userId
      });
      
      return true;
      
    } catch (error) {
      this.logger.error('smart-queue', `Failed to assign item to agent: ${queueItemId}`, error as Error);
      return false;
    }
  }

  private async notifyAgentAssignment(agent: Agent, item: QueueItem): Promise<void> {
    try {
      await this.notificationSystem.createNotification({
        userId: agent.userId,
        workspaceId: item.workspaceId,
        type: 'assignment',
        title: 'New Chat Assignment',
        content: `You have been assigned a new ${item.type}: ${item.subject || 'No subject'}`,
        data: {
          queueItemId: item.id,
          type: item.type,
          priority: item.priority,
          userId: item.userId
        },
        priority: item.priority === 'urgent' ? 'urgent' : 'high'
      });
      
    } catch (error) {
      this.logger.error('smart-queue', 'Failed to notify agent assignment', error as Error);
    }
  }

  private async updateAgentLoad(agent: Agent): Promise<void> {
    await this.database.query(
      'UPDATE agents SET current_load = $1, last_activity = $2 WHERE id = $3',
      [agent.currentLoad, agent.lastActivity, agent.id]
    );
  }

  private async updateRoutingRule(rule: RoutingRule): Promise<void> {
    await this.database.query(`
      UPDATE routing_rules 
      SET match_count = $1, last_matched = $2, updated_at = $3
      WHERE id = $4
    `, [rule.matchCount, rule.lastMatched, new Date(), rule.id]);
  }

  // AGENT MANAGEMENT
  async registerAgent(config: {
    userId: string;
    workspaceId: string;
    capacity: number;
    skills: string[];
    languages: string[];
    specializations: string[];
  }): Promise<string> {
    const agentId = `agent-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const agent: Agent = {
        id: agentId,
        userId: config.userId,
        workspaceId: config.workspaceId,
        status: 'online',
        capacity: config.capacity,
        currentLoad: 0,
        skills: config.skills,
        languages: config.languages,
        specializations: config.specializations,
        performance: {
          totalChats: 0,
          averageResponseTime: 0,
          averageResolutionTime: 0,
          satisfactionScore: 0,
          resolutionRate: 0,
          escalationRate: 0,
          lastUpdated: new Date()
        },
        lastActivity: new Date(),
        isAvailable: true
      };
      
      await this.database.query(`
        INSERT INTO agents (
          id, user_id, workspace_id, status, capacity, current_load,
          skills, languages, specializations, performance, last_activity, is_available
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (user_id, workspace_id) DO UPDATE SET
        capacity = EXCLUDED.capacity,
        skills = EXCLUDED.skills,
        languages = EXCLUDED.languages,
        specializations = EXCLUDED.specializations,
        is_available = TRUE
      `, [
        agent.id,
        agent.userId,
        agent.workspaceId,
        agent.status,
        agent.capacity,
        agent.currentLoad,
        agent.skills,
        agent.languages,
        agent.specializations,
        JSON.stringify(agent.performance),
        agent.lastActivity,
        agent.isAvailable
      ]);
      
      if (!this.agents.has(agent.workspaceId)) {
        this.agents.set(agent.workspaceId, []);
      }
      this.agents.get(agent.workspaceId)!.push(agent);
      
      this.emit('agentRegistered', agent);
      return agentId;
      
    } catch (error) {
      this.logger.error('smart-queue', `Failed to register agent: ${agentId}`, error as Error);
      throw error;
    }
  }

  async updateAgentStatus(agentId: string, status: Agent['status']): Promise<boolean> {
    try {
      const workspaceAgents = Array.from(this.agents.values()).flat();
      const agent = workspaceAgents.find(a => a.id === agentId);
      if (!agent) return false;
      
      agent.status = status;
      agent.lastActivity = new Date();
      
      await this.database.query(
        'UPDATE agents SET status = $1, last_activity = $2 WHERE id = $3',
        [status, agent.lastActivity, agentId]
      );
      
      // If agent goes offline, reassign their active items
      if (status === 'offline') {
        await this.reassignAgentItems(agentId);
      }
      
      this.emit('agentStatusUpdated', { agent, status });
      return true;
      
    } catch (error) {
      this.logger.error('smart-queue', `Failed to update agent status: ${agentId}`, error as Error);
      return false;
    }
  }

  private async reassignAgentItems(agentId: string): Promise<void> {
    try {
      const agentItems = Array.from(this.queue.values())
        .filter(item => item.assignedAgent === agentId && item.status === 'assigned');
      
      for (const item of agentItems) {
        item.assignedAgent = undefined;
        item.status = 'waiting';
        item.updatedAt = new Date();
        
        await this.database.query(`
          UPDATE queue_items 
          SET assigned_agent = NULL, status = $1, updated_at = $2
          WHERE id = $3
        `, [item.status, item.updatedAt, item.id]);
      }
      
      // Trigger reassignment
      await this.processQueueAssignment();
      
    } catch (error) {
      this.logger.error('smart-queue', `Failed to reassign agent items: ${agentId}`, error as Error);
    }
  }

  // QUEUE MANAGEMENT
  async getQueue(workspaceId: string, filters?: {
    status?: QueueItem['status'];
    priority?: QueueItem['priority'];
    assignedAgent?: string;
    userId?: string;
    resellerId?: string;
    limit?: number;
    offset?: number;
  }): Promise<QueueItem[]> {
    let items = Array.from(this.queue.values())
      .filter(item => item.workspaceId === workspaceId);
    
    // Apply strict role-based filtering
    // This would be called with the requesting user's context
    if (filters?.status) {
      items = items.filter(item => item.status === filters.status);
    }
    
    if (filters?.priority) {
      items = items.filter(item => item.priority === filters.priority);
    }
    
    if (filters?.assignedAgent) {
      items = items.filter(item => item.assignedAgent === filters.assignedAgent);
    }
    
    if (filters?.userId) {
      items = items.filter(item => item.userId === filters.userId);
    }
    
    if (filters?.resellerId) {
      items = items.filter(item => item.resellerId === filters.resellerId);
    }
    
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (filters?.limit) {
      const start = filters.offset || 0;
      items = items.slice(start, start + filters.limit);
    }
    
    return items;
  }

  async getAgentQueue(agentId: string): Promise<QueueItem[]> {
    return Array.from(this.queue.values())
      .filter(item => item.assignedAgent === agentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateItemStatus(queueItemId: string, status: QueueItem['status'], resolvedBy?: string): Promise<boolean> {
    try {
      const item = this.queue.get(queueItemId);
      if (!item) return false;
      
      item.status = status;
      item.updatedAt = new Date();
      
      if (status === 'resolved' || status === 'closed') {
        item.resolvedAt = new Date();
        
        // Update agent load and performance
        if (item.assignedAgent) {
          const workspaceAgents = this.agents.get(item.workspaceId) || [];
          const agent = workspaceAgents.find(a => a.id === item.assignedAgent);
          if (agent) {
            agent.currentLoad = Math.max(0, agent.currentLoad - 1);
            await this.updateAgentPerformanceMetrics(agent, item);
            await this.updateAgentLoad(agent);
          }
        }
      }
      
      await this.database.query(`
        UPDATE queue_items 
        SET status = $1, resolved_at = $2, updated_at = $3
        WHERE id = $4
      `, [status, item.resolvedAt, item.updatedAt, queueItemId]);
      
      this.emit('itemStatusUpdated', { item, status, resolvedBy });
      return true;
      
    } catch (error) {
      this.logger.error('smart-queue', `Failed to update item status: ${queueItemId}`, error as Error);
      return false;
    }
  }

  private async updateAgentPerformanceMetrics(agent: Agent, item: QueueItem): Promise<void> {
    try {
      const resolutionTime = item.resolvedAt && item.assignedAt
        ? (item.resolvedAt.getTime() - item.assignedAt.getTime()) / 1000
        : 0;
      
      // Update performance metrics
      agent.performance.totalChats++;
      agent.performance.averageResolutionTime = 
        (agent.performance.averageResolutionTime * (agent.performance.totalChats - 1) + resolutionTime) / 
        agent.performance.totalChats;
      
      agent.performance.lastUpdated = new Date();
      
      await this.database.query(
        'UPDATE agents SET performance = $1, current_load = $2 WHERE id = $3',
        [JSON.stringify(agent.performance), agent.currentLoad, agent.id]
      );
      
    } catch (error) {
      this.logger.error('smart-queue', 'Failed to update agent performance metrics', error as Error);
    }
  }

  private async updateAgentPerformance(): Promise<void> {
    try {
      const allAgents = Array.from(this.agents.values()).flat();
      
      for (const agent of allAgents) {
        // Update performance metrics based on recent activity
        const recentItems = Array.from(this.queue.values())
          .filter(item => 
            item.assignedAgent === agent.id && 
            item.resolvedAt && 
            item.resolvedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
          );
        
        if (recentItems.length > 0) {
          const avgResolutionTime = recentItems.reduce((sum, item) => {
            if (item.assignedAt && item.resolvedAt) {
              return sum + (item.resolvedAt.getTime() - item.assignedAt.getTime()) / 1000;
            }
            return sum;
          }, 0) / recentItems.length;
          
          agent.performance.averageResolutionTime = avgResolutionTime;
          agent.performance.resolutionRate = recentItems.length / agent.performance.totalChats * 100;
          
          await this.database.query(
            'UPDATE agents SET performance = $1 WHERE id = $2',
            [JSON.stringify(agent.performance), agent.id]
          );
        }
      }
      
    } catch (error) {
      this.logger.error('smart-queue', 'Failed to update agent performance', error as Error);
    }
  }

  private async updateQueueStats(): Promise<void> {
    try {
      const workspaces = new Set(Array.from(this.queue.values()).map(item => item.workspaceId));
      
      for (const workspaceId of workspaces) {
        const stats = await this.calculateQueueStats(workspaceId);
        await this.saveQueueStats(stats);
      }
      
    } catch (error) {
      this.logger.error('smart-queue', 'Failed to update queue stats', error as Error);
    }
  }

  private async calculateQueueStats(workspaceId: string): Promise<QueueStats> {
    const workspaceItems = Array.from(this.queue.values()).filter(item => item.workspaceId === workspaceId);
    
    const totalItems = workspaceItems.length;
    const waitingItems = workspaceItems.filter(item => item.status === 'waiting').length;
    const activeItems = workspaceItems.filter(item => item.status === 'active' || item.status === 'assigned').length;
    const resolvedItems = workspaceItems.filter(item => item.status === 'resolved' || item.status === 'closed').length;
    
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    
    for (const item of workspaceItems) {
      byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
      byCategory[item.category || 'unknown'] = (byCategory[item.category || 'unknown'] || 0) + 1;
      if (item.assignedAgent) {
        byAgent[item.assignedAgent] = (byAgent[item.assignedAgent] || 0) + 1;
      }
    }
    
    return {
      workspaceId,
      date: new Date(),
      totalItems,
      waitingItems,
      activeItems,
      resolvedItems,
      averageWaitTime: 0, // Would calculate from timestamps
      averageResolutionTime: 0, // Would calculate from timestamps
      agentUtilization: 0, // Would calculate from agent loads
      satisfactionScore: 0, // Would calculate from feedback
      byPriority,
      byCategory,
      byAgent
    };
  }

  private async saveQueueStats(stats: QueueStats): Promise<void> {
    await this.database.query(`
      INSERT INTO queue_stats (
        workspace_id, date, total_items, waiting_items, active_items, resolved_items,
        average_wait_time, average_resolution_time, agent_utilization, satisfaction_score,
        by_priority, by_category, by_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (workspace_id, date) DO UPDATE SET
      total_items = EXCLUDED.total_items,
      waiting_items = EXCLUDED.waiting_items,
      active_items = EXCLUDED.active_items,
      resolved_items = EXCLUDED.resolved_items,
      by_priority = EXCLUDED.by_priority,
      by_category = EXCLUDED.by_category,
      by_agent = EXCLUDED.by_agent
    `, [
      stats.workspaceId,
      stats.date,
      stats.totalItems,
      stats.waitingItems,
      stats.activeItems,
      stats.resolvedItems,
      stats.averageWaitTime,
      stats.averageResolutionTime,
      stats.agentUtilization,
      stats.satisfactionScore,
      JSON.stringify(stats.byPriority),
      JSON.stringify(stats.byCategory),
      JSON.stringify(stats.byAgent)
    ]);
  }

  private async getUserType(userId: string, workspaceId: string): Promise<string> {
    try {
      const user = await this.database.query(
        'SELECT role FROM workspace_members WHERE user_id = $1 AND workspace_id = $2',
        [userId, workspaceId]
      );
      
      return user.rows[0]?.role || 'user';
    } catch (error) {
      return 'user';
    }
  }

  // Helper methods for routing actions
  private async assignToGroup(queueItemId: string, groupId: string): Promise<void> {
    // Implementation for assigning to agent group
    this.logger.info('smart-queue', `Assigning to group: ${groupId}`, { queueItemId });
  }

  private async updatePriority(queueItemId: string, priority: QueueItem['priority']): Promise<void> {
    const item = this.queue.get(queueItemId);
    if (item) {
      item.priority = priority;
      item.updatedAt = new Date();
      
      await this.database.query(
        'UPDATE queue_items SET priority = $1, updated_at = $2 WHERE id = $3',
        [priority, item.updatedAt, queueItemId]
      );
    }
  }

  private async escalateItem(queueItemId: string, reason: string): Promise<void> {
    const item = this.queue.get(queueItemId);
    if (item) {
      item.priority = 'urgent';
      item.updatedAt = new Date();
      
      await this.database.query(
        'UPDATE queue_items SET priority = $1, updated_at = $2 WHERE id = $3',
        ['urgent', item.updatedAt, queueItemId]
      );
      
      // Notify admins
      this.emit('itemEscalated', { item, reason });
    }
  }

  private async notifyAgents(item: QueueItem, message: string): Promise<void> {
    const workspaceAgents = this.agents.get(item.workspaceId) || [];
    
    for (const agent of workspaceAgents) {
      if (agent.status === 'online') {
        await this.notificationSystem.createNotification({
          userId: agent.userId,
          workspaceId: item.workspaceId,
          type: 'system',
          title: 'Queue Alert',
          content: message,
          data: { queueItemId: item.id },
          priority: 'medium'
        });
      }
    }
  }

  private async createTicketFromQueue(item: QueueItem): Promise<void> {
    // Implementation for creating ticket from queue item
    this.logger.info('smart-queue', `Creating ticket from queue item: ${item.id}`);
  }

  // Analytics and reporting
  async getQueueStats(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<QueueStats[]> {
    try {
      let sql = 'SELECT * FROM queue_stats WHERE workspace_id = $1';
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
        totalItems: row.total_items,
        waitingItems: row.waiting_items,
        activeItems: row.active_items,
        resolvedItems: row.resolved_items,
        averageWaitTime: parseFloat(row.average_wait_time) || 0,
        averageResolutionTime: parseFloat(row.average_resolution_time) || 0,
        agentUtilization: parseFloat(row.agent_utilization) || 0,
        satisfactionScore: parseFloat(row.satisfaction_score) || 0,
        byPriority: row.by_priority || {},
        byCategory: row.by_category || {},
        byAgent: row.by_agent || {}
      }));
      
    } catch (error) {
      this.logger.error('smart-queue', `Failed to get queue stats: ${workspaceId}`, error as Error);
      return [];
    }
  }

  async getAgentPerformance(agentId: string): Promise<AgentPerformance | null> {
    const workspaceAgents = Array.from(this.agents.values()).flat();
    const agent = workspaceAgents.find(a => a.id === agentId);
    
    return agent ? agent.performance : null;
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    queueSize: number;
    activeAgents: number;
    waitingItems: number;
    processingQueue: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    const waitingItems = Array.from(this.queue.values()).filter(item => item.status === 'waiting').length;
    const activeAgents = Array.from(this.agents.values()).flat().filter(agent => 
      agent.isAvailable && agent.status === 'online'
    ).length;
    
    if (waitingItems > 100) {
      issues.push('High queue backlog');
    }
    
    if (activeAgents === 0 && waitingItems > 0) {
      issues.push('No available agents');
    }
    
    return {
      healthy: issues.length === 0,
      queueSize: this.queue.size,
      activeAgents,
      waitingItems,
      processingQueue: this.processingQueue,
      issues
    };
  }

  async destroy(): Promise<void> {
    if (this.autoAssignmentInterval) {
      clearInterval(this.autoAssignmentInterval);
    }
    
    this.processingQueue = false;
    this.logger.info('smart-queue', 'Smart queue system shut down');
  }
}

export default UltraSmartQueue;
