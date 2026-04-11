import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { UltraNotificationSystem } from './notification-system';
import { Message, User, Workspace } from './slack-system';
import * as crypto from 'crypto';

export interface SpamRule {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  type: 'keyword' | 'pattern' | 'frequency' | 'behavioral' | 'reputation' | 'ml_model';
  isActive: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  conditions: SpamCondition[];
  actions: SpamAction[];
  weight: number; // 0-1, importance in overall scoring
  cooldownPeriod: number; // minutes
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpamCondition {
  type: 'keyword_match' | 'regex_pattern' | 'message_frequency' | 'link_count' | 
        'caps_ratio' | 'duplicate_content' | 'new_account' | 'suspicious_behavior' | 'custom';
  parameters: {
    keywords?: string[];
    pattern?: string;
    maxMessagesPerMinute?: number;
    maxLinksPerMessage?: number;
    maxCapsRatio?: number; // 0-1
    minAccountAge?: number; // hours
    customCondition?: string;
    threshold?: number;
  };
  operator: 'AND' | 'OR';
}

export interface SpamAction {
  type: 'block' | 'quarantine' | 'flag' | 'rate_limit' | 'notify_admin' | 'require_verification' | 'custom';
  parameters: {
    blockDuration?: number; // minutes
    quarantineReason?: string;
    flagReason?: string;
    rateLimitPerMinute?: number;
    notificationMessage?: string;
    customAction?: string;
  };
  delay?: number; // minutes
}

export interface SpamDetection {
  id: string;
  workspaceId: string;
  messageId?: string;
  userId: string;
  ruleId: string;
  score: number; // 0-1
  severity: SpamRule['severity'];
  confidence: number; // 0-1
  triggeredConditions: string[];
  actionsTaken: string[];
  status: 'pending' | 'processed' | 'false_positive' | 'appealed';
  metadata: {
    messageContent?: string;
    userBehavior?: Record<string, any>;
    detectionDetails?: Record<string, any>;
  };
  detectedAt: Date;
  processedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface UserReputation {
  id: string;
  userId: string;
  workspaceId: string;
  score: number; // -100 to 100
  trustLevel: 'unknown' | 'low' | 'medium' | 'high' | 'trusted';
  messageCount: number;
  spamCount: number;
  lastActivity: Date;
  flags: {
    frequentlyReported: boolean;
    suspiciousPattern: boolean;
    newAccount: boolean;
    verifiedIdentity: boolean;
  };
  history: ReputationEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReputationEvent {
  type: 'message_sent' | 'spam_detected' | 'spam_confirmed' | 'spam_false_positive' | 
        'user_reported' | 'admin_review' | 'verification_completed';
  score: number; // positive or negative impact
  reason: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SpamAnalytics {
  workspaceId: string;
  date: Date;
  totalMessages: number;
  spamMessages: number;
  spamRate: number; // percentage
  blockedAttempts: number;
  quarantinedMessages: number;
  falsePositives: number;
  accuracyRate: number; // percentage
  topSpamPatterns: Array<{
    pattern: string;
    count: number;
    severity: string;
  }>;
  userReputationDistribution: {
    unknown: number;
    low: number;
    medium: number;
    high: number;
    trusted: number;
  };
  detectionLatency: number; // average milliseconds
}

export class UltraAntiSpam extends EventEmitter {
  private static instance: UltraAntiSpam;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  private notificationSystem: UltraNotificationSystem;
  
  private rules: Map<string, Map<string, SpamRule>> = new Map(); // workspaceId -> ruleId -> rule
  private userReputations: Map<string, Map<string, UserReputation>> = new Map(); // workspaceId -> userId -> reputation
  private messageFrequency: Map<string, Array<{ timestamp: number; count: number }>> = new Map(); // userId -> messages
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout;

  static getInstance(): UltraAntiSpam {
    if (!UltraAntiSpam.instance) {
      UltraAntiSpam.instance = new UltraAntiSpam();
    }
    return UltraAntiSpam.instance;
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
      await this.loadSpamRules();
      await this.loadUserReputations();
      this.startSpamProcessing();
      
      this.logger.info('anti-spam', 'Anti-spam system initialized', {
        rulesCount: Array.from(this.rules.values()).reduce((sum, rules) => sum + rules.length, 0),
        userReputationsCount: Array.from(this.userReputations.values()).reduce((sum, reps) => sum + reps.size, 0)
      });
    } catch (error) {
      this.logger.error('anti-spam', 'Failed to initialize anti-spam system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS spam_rules (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(20) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        severity VARCHAR(10) NOT NULL,
        conditions JSONB NOT NULL,
        actions JSONB NOT NULL,
        weight DECIMAL(3,2) DEFAULT 0.5,
        cooldown_period INTEGER DEFAULT 60,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS spam_detections (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255),
        user_id VARCHAR(255) NOT NULL,
        rule_id VARCHAR(255) NOT NULL,
        score DECIMAL(3,2) NOT NULL,
        severity VARCHAR(10) NOT NULL,
        confidence DECIMAL(3,2) NOT NULL,
        triggered_conditions TEXT[] NOT NULL,
        actions_taken TEXT[] NOT NULL,
        status VARCHAR(20) NOT NULL,
        metadata JSONB NOT NULL,
        detected_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP,
        reviewed_by VARCHAR(255),
        review_notes TEXT
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS user_reputations (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        score INTEGER DEFAULT 0,
        trust_level VARCHAR(10) DEFAULT 'unknown',
        message_count INTEGER DEFAULT 0,
        spam_count INTEGER DEFAULT 0,
        last_activity TIMESTAMP DEFAULT NOW(),
        flags JSONB NOT NULL,
        history JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, workspace_id)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS spam_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_messages INTEGER DEFAULT 0,
        spam_messages INTEGER DEFAULT 0,
        spam_rate DECIMAL(5,2),
        blocked_attempts INTEGER DEFAULT 0,
        quarantined_messages INTEGER DEFAULT 0,
        false_positives INTEGER DEFAULT 0,
        accuracy_rate DECIMAL(5,2),
        top_spam_patterns JSONB NOT NULL,
        user_reputation_distribution JSONB NOT NULL,
        detection_latency DECIMAL(8,2),
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_spam_rules_workspace_id ON spam_rules(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_spam_detections_workspace_id ON spam_detections(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_spam_detections_user_id ON spam_detections(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_spam_detections_status ON spam_detections(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_user_reputations_workspace_id ON user_reputations(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_user_reputations_trust_level ON user_reputations(trust_level)');
  }

  private async loadSpamRules(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM spam_rules WHERE is_active = TRUE ORDER BY weight DESC');
      
      for (const row of rows) {
        const rule: SpamRule = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          type: row.type,
          isActive: row.is_active,
          severity: row.severity,
          conditions: row.conditions || [],
          actions: row.actions || [],
          weight: parseFloat(row.weight) || 0.5,
          cooldownPeriod: row.cooldown_period || 60,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.rules.has(rule.workspaceId)) {
          this.rules.set(rule.workspaceId, new Map());
        }
        this.rules.get(rule.workspaceId)!.set(rule.id, rule);
      }
      
      this.logger.info('anti-spam', `Loaded spam rules for ${this.rules.size} workspaces`);
    } catch (error) {
      this.logger.error('anti-spam', 'Failed to load spam rules', error as Error);
    }
  }

  private async loadUserReputations(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM user_reputations ORDER BY updated_at DESC LIMIT 50000');
      
      for (const row of rows) {
        const reputation: UserReputation = {
          id: row.id,
          userId: row.user_id,
          workspaceId: row.workspace_id,
          score: row.score,
          trustLevel: row.trust_level,
          messageCount: row.message_count,
          spamCount: row.spam_count,
          lastActivity: row.last_activity,
          flags: row.flags || {
            frequentlyReported: false,
            suspiciousPattern: false,
            newAccount: false,
            verifiedIdentity: false
          },
          history: row.history || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.userReputations.has(reputation.workspaceId)) {
          this.userReputations.set(reputation.workspaceId, new Map());
        }
        this.userReputations.get(reputation.workspaceId)!.set(reputation.userId, reputation);
      }
      
      this.logger.info('anti-spam', `Loaded user reputations for ${this.userReputations.size} workspaces`);
    } catch (error) {
      this.logger.error('anti-spam', 'Failed to load user reputations', error as Error);
    }
  }

  private startSpamProcessing(): void {
    this.isProcessing = true;
    
    // Clean up old frequency data every 5 minutes
    setInterval(() => {
      this.cleanupFrequencyData();
    }, 5 * 60 * 1000);
  }

  // PUBLIC API METHODS
  async createSpamRule(config: {
    workspaceId: string;
    name: string;
    description?: string;
    type: SpamRule['type'];
    severity: SpamRule['severity'];
    conditions: SpamCondition[];
    actions: SpamAction[];
    weight?: number;
    cooldownPeriod?: number;
    createdBy: string;
  }): Promise<string> {
    const ruleId = `rule-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const rule: SpamRule = {
        id: ruleId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        type: config.type,
        isActive: true,
        severity: config.severity,
        conditions: config.conditions,
        actions: config.actions,
        weight: config.weight || 0.5,
        cooldownPeriod: config.cooldownPeriod || 60,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO spam_rules (
          id, workspace_id, name, description, type, is_active, severity, conditions,
          actions, weight, cooldown_period, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        rule.id,
        rule.workspaceId,
        rule.name,
        rule.description,
        rule.type,
        rule.isActive,
        rule.severity,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        rule.weight,
        rule.cooldownPeriod,
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
      this.logger.error('anti-spam', `Failed to create spam rule: ${ruleId}`, error as Error);
      throw error;
    }
  }

  async analyzeMessage(config: {
    workspaceId: string;
    messageId?: string;
    userId: string;
    content: string;
    metadata?: Record<string, any>;
  }): Promise<{
    isSpam: boolean;
    score: number;
    severity: SpamRule['severity'] | null;
    detections: SpamDetection[];
    actions: SpamAction[];
  }> {
    try {
      const workspaceRules = this.rules.get(config.workspaceId);
      if (!workspaceRules || workspaceRules.size === 0) {
        return {
          isSpam: false,
          score: 0,
          severity: null,
          detections: [],
          actions: []
        };
      }
      
      // Update message frequency
      this.updateMessageFrequency(config.userId);
      
      // Get user reputation
      const reputation = await this.getUserReputation(config.userId, config.workspaceId);
      
      const detections: SpamDetection[] = [];
      let totalScore = 0;
      let maxSeverity: SpamRule['severity'] | null = null;
      const allActions: SpamAction[] = [];
      
      // Evaluate each rule
      for (const rule of workspaceRules.values()) {
        if (!rule.isActive) continue;
        
        const ruleResult = await this.evaluateRule(rule, config, reputation);
        
        if (ruleResult.isMatch) {
          const detection: SpamDetection = {
            id: `detection-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
            workspaceId: config.workspaceId,
            messageId: config.messageId,
            userId: config.userId,
            ruleId: rule.id,
            score: ruleResult.score,
            severity: rule.severity,
            confidence: ruleResult.confidence,
            triggeredConditions: ruleResult.triggeredConditions,
            actionsTaken: [],
            status: 'pending',
            metadata: {
              messageContent: config.content,
              userBehavior: ruleResult.userBehavior,
              detectionDetails: ruleResult.details
            },
            detectedAt: new Date()
          };
          
          detections.push(detection);
          totalScore += ruleResult.score * rule.weight;
          
          if (!maxSeverity || this.getSeverityWeight(rule.severity) > this.getSeverityWeight(maxSeverity)) {
            maxSeverity = rule.severity;
          }
          
          allActions.push(...rule.actions);
        }
      }
      
      // Apply reputation adjustment
      const adjustedScore = this.adjustScoreByReputation(totalScore, reputation);
      
      const isSpam = adjustedScore >= 0.7; // Threshold for spam
      
      if (isSpam && detections.length > 0) {
        // Save detections and execute actions
        for (const detection of detections) {
          await this.saveDetection(detection);
          await this.executeActions(detection, allActions);
        }
        
        // Update user reputation
        await this.updateUserReputation(config.userId, config.workspaceId, -10, 'spam_detected');
      }
      
      return {
        isSpam,
        score: adjustedScore,
        severity: maxSeverity,
        detections,
        actions: allActions
      };
      
    } catch (error) {
      this.logger.error('anti-spam', 'Failed to analyze message', error as Error);
      return {
        isSpam: false,
        score: 0,
        severity: null,
        detections: [],
        actions: []
      };
    }
  }

  private async evaluateRule(rule: SpamRule, config: {
    workspaceId: string;
    messageId?: string;
    userId: string;
    content: string;
    metadata?: Record<string, any>;
  }, reputation: UserReputation): Promise<{
    isMatch: boolean;
    score: number;
    confidence: number;
    triggeredConditions: string[];
    userBehavior: Record<string, any>;
    details: Record<string, any>;
  }> {
    try {
      let isMatch = false;
      let score = 0;
      let confidence = 0;
      const triggeredConditions: string[] = [];
      const userBehavior: Record<string, any> = {};
      const details: Record<string, any> = {};
      
      for (const condition of rule.conditions) {
        const conditionResult = await this.evaluateCondition(condition, config, reputation);
        
        if (conditionResult.isMatch) {
          triggeredConditions.push(condition.type);
          score += conditionResult.score;
          confidence += conditionResult.confidence;
          
          if (condition.operator === 'OR') {
            isMatch = true;
            break;
          }
        } else if (condition.operator === 'AND') {
          isMatch = false;
          break;
        }
      }
      
      if (rule.conditions.length > 0 && rule.conditions[0].operator === 'AND') {
        isMatch = triggeredConditions.length === rule.conditions.length;
      }
      
      // Calculate average confidence
      if (triggeredConditions.length > 0) {
        confidence /= triggeredConditions.length;
      }
      
      return {
        isMatch,
        score: Math.min(score, 1),
        confidence: Math.min(confidence, 1),
        triggeredConditions,
        userBehavior,
        details
      };
      
    } catch (error) {
      this.logger.error('anti-spam', 'Failed to evaluate rule', error as Error);
      return {
        isMatch: false,
        score: 0,
        confidence: 0,
        triggeredConditions: [],
        userBehavior: {},
        details: {}
      };
    }
  }

  private async evaluateCondition(condition: SpamCondition, config: {
    workspaceId: string;
    messageId?: string;
    userId: string;
    content: string;
    metadata?: Record<string, any>;
  }, reputation: UserReputation): Promise<{
    isMatch: boolean;
    score: number;
    confidence: number;
  }> {
    try {
      switch (condition.type) {
        case 'keyword_match':
          return this.evaluateKeywordCondition(condition, config.content);
          
        case 'regex_pattern':
          return this.evaluatePatternCondition(condition, config.content);
          
        case 'message_frequency':
          return this.evaluateFrequencyCondition(condition, config.userId);
          
        case 'link_count':
          return this.evaluateLinkCountCondition(condition, config.content);
          
        case 'caps_ratio':
          return this.evaluateCapsRatioCondition(condition, config.content);
          
        case 'duplicate_content':
          return this.evaluateDuplicateContentCondition(condition, config.content, config.workspaceId);
          
        case 'new_account':
          return this.evaluateNewAccountCondition(condition, reputation);
          
        case 'suspicious_behavior':
          return this.evaluateSuspiciousBehaviorCondition(condition, reputation);
          
        default:
          return { isMatch: false, score: 0, confidence: 0 };
      }
      
    } catch (error) {
      this.logger.error('anti-spam', 'Failed to evaluate condition', error as Error);
      return { isMatch: false, score: 0, confidence: 0 };
    }
  }

  private evaluateKeywordCondition(condition: SpamCondition, content: string): {
    isMatch: boolean;
    score: number;
    confidence: number;
  } {
    if (!condition.parameters.keywords) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
    
    const contentLower = content.toLowerCase();
    const matchedKeywords = condition.parameters.keywords.filter(keyword =>
      contentLower.includes(keyword.toLowerCase())
    );
    
    if (matchedKeywords.length === 0) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
    
    const matchRatio = matchedKeywords.length / condition.parameters.keywords.length;
    const score = matchRatio * 0.8;
    const confidence = Math.min(matchRatio * 1.2, 1);
    
    return { isMatch: true, score, confidence };
  }

  private evaluatePatternCondition(condition: SpamCondition, content: string): {
    isMatch: boolean;
    score: number;
    confidence: number;
  } {
    if (!condition.parameters.pattern) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
    
    try {
      const regex = new RegExp(condition.parameters.pattern, 'i');
      const matches = content.match(regex);
      
      if (!matches) {
        return { isMatch: false, score: 0, confidence: 0 };
      }
      
      const matchCount = matches.length;
      const score = Math.min(matchCount * 0.3, 0.9);
      const confidence = Math.min(matchCount * 0.4, 1);
      
      return { isMatch: true, score, confidence };
      
    } catch (error) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
  }

  private evaluateFrequencyCondition(condition: SpamCondition, userId: string): {
    isMatch: boolean;
    score: number;
    confidence: number;
  } {
    if (!condition.parameters.maxMessagesPerMinute) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
    
    const userMessages = this.messageFrequency.get(userId) || [];
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    
    const recentMessages = userMessages.filter(msg => msg.timestamp > oneMinuteAgo);
    const messageCount = recentMessages.reduce((sum, msg) => sum + msg.count, 0);
    
    if (messageCount <= condition.parameters.maxMessagesPerMinute) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
    
    const excessRatio = messageCount / condition.parameters.maxMessagesPerMinute;
    const score = Math.min((excessRatio - 1) * 0.5, 0.9);
    const confidence = Math.min(excessRatio * 0.3, 1);
    
    return { isMatch: true, score, confidence };
  }

  private evaluateLinkCountCondition(condition: SpamCondition, content: string): {
    isMatch: boolean;
    score: number;
    confidence: number;
  } {
    if (!condition.parameters.maxLinksPerMessage) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
    
    const linkRegex = /https?:\/\/[^\s]+/gi;
    const links = content.match(linkRegex) || [];
    const linkCount = links.length;
    
    if (linkCount <= condition.parameters.maxLinksPerMessage) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
    
    const excessRatio = linkCount / condition.parameters.maxLinksPerMessage;
    const score = Math.min((excessRatio - 1) * 0.6, 0.9);
    const confidence = Math.min(excessRatio * 0.4, 1);
    
    return { isMatch: true, score, confidence };
  }

  private evaluateCapsRatioCondition(condition: SpamCondition, content: string): {
    isMatch: boolean;
    score: number;
    confidence: number;
  } {
    if (!condition.parameters.maxCapsRatio) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
    
    const letters = content.replace(/[^a-zA-Z]/g, '');
    const caps = content.replace(/[^A-Z]/g, '');
    
    if (letters.length === 0) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
    
    const capsRatio = caps.length / letters.length;
    
    if (capsRatio <= condition.parameters.maxCapsRatio) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
    
    const excessRatio = capsRatio / condition.parameters.maxCapsRatio;
    const score = Math.min((excessRatio - 1) * 0.4, 0.8);
    const confidence = Math.min(excessRatio * 0.5, 1);
    
    return { isMatch: true, score, confidence };
  }

  private async evaluateDuplicateContentCondition(condition: SpamCondition, content: string, workspaceId: string): Promise<{
    isMatch: boolean;
    score: number;
    confidence: number;
  }> {
    try {
      // Check for duplicate messages in the last hour
      const result = await this.database.query(`
        SELECT COUNT(*) as duplicate_count 
        FROM messages 
        WHERE workspace_id = $1 
        AND content = $2 
        AND created_at > NOW() - INTERVAL '1 hour'
      `, [workspaceId, content]);
      
      const duplicateCount = parseInt(result.rows[0].duplicate_count);
      
      if (duplicateCount <= 1) {
        return { isMatch: false, score: 0, confidence: 0 };
      }
      
      const score = Math.min((duplicateCount - 1) * 0.3, 0.8);
      const confidence = Math.min(duplicateCount * 0.2, 1);
      
      return { isMatch: true, score, confidence };
      
    } catch (error) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
  }

  private evaluateNewAccountCondition(condition: SpamCondition, reputation: UserReputation): {
    isMatch: boolean;
    score: number;
    confidence: number;
  } {
    if (!condition.parameters.minAccountAge) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
    
    const accountAge = (Date.now() - reputation.createdAt.getTime()) / (1000 * 60 * 60); // hours
    
    if (accountAge >= condition.parameters.minAccountAge) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
    
    const riskRatio = 1 - (accountAge / condition.parameters.minAccountAge);
    const score = riskRatio * 0.6;
    const confidence = 0.8;
    
    return { isMatch: true, score, confidence };
  }

  private evaluateSuspiciousBehaviorCondition(condition: SpamCondition, reputation: UserReputation): {
    isMatch: boolean;
    score: number;
    confidence: number;
  } {
    let suspiciousScore = 0;
    
    if (reputation.flags.frequentlyReported) suspiciousScore += 0.3;
    if (reputation.flags.suspiciousPattern) suspiciousScore += 0.4;
    if (reputation.spamCount > reputation.messageCount * 0.1) suspiciousScore += 0.3;
    if (reputation.score < -20) suspiciousScore += 0.2;
    
    if (suspiciousScore === 0) {
      return { isMatch: false, score: 0, confidence: 0 };
    }
    
    return { isMatch: true, score: suspiciousScore, confidence: 0.7 };
  }

  private getSeverityWeight(severity: SpamRule['severity']): number {
    const weights = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };
    return weights[severity];
  }

  private adjustScoreByReputation(score: number, reputation: UserReputation): number {
    const trustMultipliers = {
      'unknown': 1.0,
      'low': 1.2,
      'medium': 1.0,
      'high': 0.8,
      'trusted': 0.6
    };
    
    const multiplier = trustMultipliers[reputation.trustLevel];
    return Math.min(score * multiplier, 1);
  }

  private updateMessageFrequency(userId: string): void {
    const now = Date.now();
    
    if (!this.messageFrequency.has(userId)) {
      this.messageFrequency.set(userId, []);
    }
    
    const userMessages = this.messageFrequency.get(userId)!;
    userMessages.push({ timestamp: now, count: 1 });
  }

  private cleanupFrequencyData(): void {
    const cutoff = Date.now() - 5 * 60 * 1000; // Keep last 5 minutes
    
    for (const [userId, messages] of this.messageFrequency.entries()) {
      const filtered = messages.filter(msg => msg.timestamp > cutoff);
      
      if (filtered.length === 0) {
        this.messageFrequency.delete(userId);
      } else {
        this.messageFrequency.set(userId, filtered);
      }
    }
  }

  private async saveDetection(detection: SpamDetection): Promise<void> {
    try {
      await this.database.query(`
        INSERT INTO spam_detections (
          id, workspace_id, message_id, user_id, rule_id, score, severity,
          confidence, triggered_conditions, actions_taken, status, metadata, detected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        detection.id,
        detection.workspaceId,
        detection.messageId,
        detection.userId,
        detection.ruleId,
        detection.score,
        detection.severity,
        detection.confidence,
        detection.triggeredConditions,
        detection.actionsTaken,
        detection.status,
        JSON.stringify(detection.metadata),
        detection.detectedAt
      ]);
      
    } catch (error) {
      this.logger.error('anti-spam', 'Failed to save detection', error as Error);
    }
  }

  private async executeActions(detection: SpamDetection, actions: SpamAction[]): Promise<void> {
    try {
      for (const action of actions) {
        await this.executeAction(detection, action);
        detection.actionsTaken.push(action.type);
      }
      
      detection.status = 'processed';
      detection.processedAt = new Date();
      
      await this.database.query(
        'UPDATE spam_detections SET status = $1, processed_at = $2, actions_taken = $3 WHERE id = $4',
        [detection.status, detection.processedAt, detection.actionsTaken, detection.id]
      );
      
    } catch (error) {
      this.logger.error('anti-spam', 'Failed to execute actions', error as Error);
    }
  }

  private async executeAction(detection: SpamDetection, action: SpamAction): Promise<void> {
    try {
      switch (action.type) {
        case 'block':
          await this.executeBlockAction(detection, action);
          break;
          
        case 'quarantine':
          await this.executeQuarantineAction(detection, action);
          break;
          
        case 'flag':
          await this.executeFlagAction(detection, action);
          break;
          
        case 'rate_limit':
          await this.executeRateLimitAction(detection, action);
          break;
          
        case 'notify_admin':
          await this.executeNotifyAdminAction(detection, action);
          break;
          
        case 'require_verification':
          await this.executeRequireVerificationAction(detection, action);
          break;
      }
      
    } catch (error) {
      this.logger.error('anti-spam', `Failed to execute action: ${action.type}`, error as Error);
    }
  }

  private async executeBlockAction(detection: SpamDetection, action: SpamAction): Promise<void> {
    // Block user for specified duration
    const duration = action.parameters.blockDuration || 60;
    
    await this.accessControl.suspendUser(
      detection.userId,
      detection.workspaceId,
      duration,
      `Spam detection: ${detection.ruleId}`
    );
    
    this.emit('userBlocked', { userId: detection.userId, duration, reason: detection.ruleId });
  }

  private async executeQuarantineAction(detection: SpamDetection, action: SpamAction): Promise<void> {
    if (detection.messageId) {
      // Move message to quarantine
      await this.database.query(
        'UPDATE messages SET status = $1 WHERE id = $2',
        ['quarantined', detection.messageId]
      );
    }
    
    this.emit('messageQuarantined', { messageId: detection.messageId, reason: action.parameters.quarantineReason });
  }

  private async executeFlagAction(detection: SpamDetection, action: SpamAction): Promise<void> {
    if (detection.messageId) {
      // Flag message for review
      await this.database.query(
        'UPDATE messages SET flagged = TRUE, flag_reason = $1 WHERE id = $2',
        [action.parameters.flagReason || 'spam_detected', detection.messageId]
      );
    }
    
    this.emit('messageFlagged', { messageId: detection.messageId, reason: action.parameters.flagReason });
  }

  private async executeRateLimitAction(detection: SpamDetection, action: SpamAction): Promise<void> {
    // Apply rate limiting to user
    const limit = action.parameters.rateLimitPerMinute || 5;
    
    await this.accessControl.setRateLimit(
      detection.userId,
      detection.workspaceId,
      limit,
      60 // 1 minute window
    );
    
    this.emit('userRateLimited', { userId: detection.userId, limit });
  }

  private async executeNotifyAdminAction(detection: SpamDetection, action: SpamAction): Promise<void> {
    // Get admins to notify
    const admins = await this.database.query(
      `SELECT user_id FROM workspace_members WHERE role IN ('admin', 'super_admin') AND workspace_id = $1`,
      [detection.workspaceId]
    );
    
    for (const admin of admins.rows) {
      await this.notificationSystem.createNotification({
        userId: admin.user_id,
        workspaceId: detection.workspaceId,
        type: 'system',
        title: 'Spam Detection Alert',
        content: action.parameters.notificationMessage || `Spam detected from user ${detection.userId}`,
        data: {
          detectionId: detection.id,
          userId: detection.userId,
          severity: detection.severity,
          score: detection.score
        },
        priority: detection.severity === 'critical' ? 'urgent' : 'high'
      });
    }
    
    this.emit('adminNotified', { detection, adminsCount: admins.rows.length });
  }

  private async executeRequireVerificationAction(detection: SpamDetection, action: SpamAction): Promise<void> {
    // Require user verification
    await this.accessControl.requireVerification(
      detection.userId,
      detection.workspaceId,
      'spam_detected'
    );
    
    this.emit('verificationRequired', { userId: detection.userId, reason: 'spam_detected' });
  }

  private async getUserReputation(userId: string, workspaceId: string): Promise<UserReputation> {
    let reputation = this.userReputations.get(workspaceId)?.get(userId);
    
    if (!reputation) {
      // Create new reputation record
      reputation = {
        id: `rep-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
        userId,
        workspaceId,
        score: 0,
        trustLevel: 'unknown',
        messageCount: 0,
        spamCount: 0,
        lastActivity: new Date(),
        flags: {
          frequentlyReported: false,
          suspiciousPattern: false,
          newAccount: false,
          verifiedIdentity: false
        },
        history: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.saveUserReputation(reputation);
      
      if (!this.userReputations.has(workspaceId)) {
        this.userReputations.set(workspaceId, new Map());
      }
      this.userReputations.get(workspaceId)!.set(userId, reputation);
    }
    
    return reputation;
  }

  private async saveUserReputation(reputation: UserReputation): Promise<void> {
    try {
      await this.database.query(`
        INSERT INTO user_reputations (
          id, user_id, workspace_id, score, trust_level, message_count, spam_count,
          last_activity, flags, history, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (user_id, workspace_id) DO UPDATE SET
        score = EXCLUDED.score,
        trust_level = EXCLUDED.trust_level,
        message_count = EXCLUDED.message_count,
        spam_count = EXCLUDED.spam_count,
        last_activity = EXCLUDED.last_activity,
        flags = EXCLUDED.flags,
        history = EXCLUDED.history,
        updated_at = EXCLUDED.updated_at
      `, [
        reputation.id,
        reputation.userId,
        reputation.workspaceId,
        reputation.score,
        reputation.trustLevel,
        reputation.messageCount,
        reputation.spamCount,
        reputation.lastActivity,
        JSON.stringify(reputation.flags),
        JSON.stringify(reputation.history),
        reputation.createdAt,
        reputation.updatedAt
      ]);
      
    } catch (error) {
      this.logger.error('anti-spam', 'Failed to save user reputation', error as Error);
    }
  }

  private async updateUserReputation(userId: string, workspaceId: string, scoreChange: number, reason: string): Promise<void> {
    try {
      const reputation = await this.getUserReputation(userId, workspaceId);
      
      reputation.score += scoreChange;
      reputation.lastActivity = new Date();
      
      // Update trust level based on score
      if (reputation.score >= 50) {
        reputation.trustLevel = 'trusted';
      } else if (reputation.score >= 20) {
        reputation.trustLevel = 'high';
      } else if (reputation.score >= 0) {
        reputation.trustLevel = 'medium';
      } else if (reputation.score >= -20) {
        reputation.trustLevel = 'low';
      } else {
        reputation.trustLevel = 'unknown';
      }
      
      // Add to history
      reputation.history.push({
        type: scoreChange < 0 ? 'spam_detected' : 'positive_action',
        score: scoreChange,
        reason,
        timestamp: new Date()
      });
      
      // Keep only last 100 history entries
      if (reputation.history.length > 100) {
        reputation.history = reputation.history.slice(-100);
      }
      
      reputation.updatedAt = new Date();
      
      await this.saveUserReputation(reputation);
      
      // Update local cache
      if (!this.userReputations.has(workspaceId)) {
        this.userReputations.set(workspaceId, new Map());
      }
      this.userReputations.get(workspaceId)!.set(userId, reputation);
      
    } catch (error) {
      this.logger.error('anti-spam', 'Failed to update user reputation', error as Error);
    }
  }

  async getAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<SpamAnalytics[]> {
    try {
      let sql = 'SELECT * FROM spam_analytics WHERE workspace_id = $1';
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
        totalMessages: row.total_messages,
        spamMessages: row.spam_messages,
        spamRate: parseFloat(row.spam_rate) || 0,
        blockedAttempts: row.blocked_attempts,
        quarantinedMessages: row.quarantined_messages,
        falsePositives: row.false_positives,
        accuracyRate: parseFloat(row.accuracy_rate) || 0,
        topSpamPatterns: row.top_spam_patterns || [],
        userReputationDistribution: row.user_reputation_distribution || {
          unknown: 0,
          low: 0,
          medium: 0,
          high: 0,
          trusted: 0
        },
        detectionLatency: parseFloat(row.detection_latency) || 0
      }));
      
    } catch (error) {
      this.logger.error('anti-spam', 'Failed to get analytics', error as Error);
      return [];
    }
  }

  async createDefaultRules(workspaceId: string, createdBy: string): Promise<void> {
    const defaultRules = [
      {
        name: 'Excessive Links',
        description: 'Detect messages with too many links',
        type: 'pattern' as const,
        severity: 'medium' as const,
        conditions: [{
          type: 'link_count' as const,
          parameters: { maxLinksPerMessage: 3 },
          operator: 'AND' as const
        }],
        actions: [{
          type: 'flag' as const,
          parameters: { flagReason: 'Excessive links detected' }
        }]
      },
      {
        name: 'High Frequency Messaging',
        description: 'Detect users sending too many messages',
        type: 'frequency' as const,
        severity: 'high' as const,
        conditions: [{
          type: 'message_frequency' as const,
          parameters: { maxMessagesPerMinute: 10 },
          operator: 'AND' as const
        }],
        actions: [{
          type: 'rate_limit' as const,
          parameters: { rateLimitPerMinute: 5 }
        }, {
          type: 'notify_admin' as const,
          parameters: {}
        }]
      },
      {
        name: 'Spam Keywords',
        description: 'Detect common spam keywords',
        type: 'keyword' as const,
        severity: 'high' as const,
        conditions: [{
          type: 'keyword_match' as const,
          parameters: { 
            keywords: ['click here', 'free money', 'guaranteed', 'act now', 'limited time', 'winner', 'congratulations']
          },
          operator: 'OR' as const
        }],
        actions: [{
          type: 'quarantine' as const,
          parameters: { quarantineReason: 'Spam keywords detected' }
        }]
      }
    ];
    
    for (const ruleConfig of defaultRules) {
      try {
        await this.createSpamRule({
          workspaceId,
          ...ruleConfig,
          createdBy
        });
      } catch (error) {
        this.logger.debug('anti-spam', `Default rule ${ruleConfig.name} may already exist`);
      }
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    rulesCount: number;
    userReputationsCount: number;
    spamProcessingActive: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!this.isProcessing) {
      issues.push('Spam processing is not active');
    }
    
    return {
      healthy: issues.length === 0,
      rulesCount: Array.from(this.rules.values()).reduce((sum, rules) => sum + rules.length, 0),
      userReputationsCount: Array.from(this.userReputations.values()).reduce((sum, reps) => sum + reps.size, 0),
      spamProcessingActive: this.isProcessing,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isProcessing = false;
    
    this.logger.info('anti-spam', 'Anti-spam system shut down');
  }
}

export default UltraAntiSpam;
