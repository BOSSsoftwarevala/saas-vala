import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { UltraSmartQueue } from './smart-queue';
import { UltraAISupport } from './ai-support';
import { Message, User, Workspace } from './slack-system';
import * as crypto from 'crypto';

export interface AgentProfile {
  id: string;
  userId: string;
  workspaceId: string;
  skills: AgentSkill[];
  languages: string[];
  specialties: string[];
  experienceLevel: 'junior' | 'intermediate' | 'senior' | 'expert';
  maxConcurrentChats: number;
  currentChats: number;
  availabilityStatus: 'online' | 'busy' | 'offline' | 'away';
  timezone: string;
  workingHours: {
    start: string; // "09:00"
    end: string; // "17:00"
    days: number[]; // 1-7 (Monday-Sunday)
  };
  performanceMetrics: {
    averageResponseTime: number; // minutes
    averageResolutionTime: number; // minutes
    customerSatisfaction: number; // 1-5
    resolutionRate: number; // percentage
    handledTickets: number;
    escalationRate: number; // percentage
  };
  preferences: {
    preferredCategories: string[];
    avoidedCategories: string[];
    maxUrgentTickets: number;
    languagePriority: string[];
  };
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentSkill {
  name: string;
  category: 'technical' | 'communication' | 'language' | 'domain' | 'soft';
  level: number; // 1-10
  certifications?: string[];
  lastUsed?: Date;
}

export interface AssignmentRequest {
  id: string;
  workspaceId: string;
  ticketId?: string;
  messageId?: string;
  userId: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: string;
  language: string;
  tags: string[];
  estimatedComplexity: number; // 1-10
  requiredSkills: string[];
  preferredSkills: string[];
  customerTier: 'basic' | 'premium' | 'enterprise';
  previousAgentId?: string;
  escalationLevel: number;
  metadata: Record<string, any>;
  requestedAt: Date;
}

export interface AssignmentResult {
  requestId: string;
  assignedAgentId: string;
  confidence: number; // 0-1
  assignmentReason: string;
  matchScore: number;
  factors: {
    skillMatch: number;
    languageMatch: number;
    availabilityMatch: number;
    workloadMatch: number;
    performanceMatch: number;
    preferenceMatch: number;
  };
  assignedAt: Date;
  estimatedResponseTime: number; // minutes
}

export interface AssignmentAnalytics {
  workspaceId: string;
  date: Date;
  totalAssignments: number;
  assignmentsByCategory: Record<string, number>;
  assignmentsByPriority: Record<string, number>;
  assignmentsByAgent: Record<string, number>;
  averageAssignmentTime: number; // minutes
  assignmentAccuracy: number; // percentage of successful assignments
  agentUtilization: number; // percentage
  customerSatisfactionByAssignment: number; // 1-5
  escalationRate: number; // percentage
  reassignmentRate: number; // percentage
}

export class UltraSmartAssignment extends EventEmitter {
  private static instance: UltraSmartAssignment;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  private smartQueue: UltraSmartQueue;
  private aiSupport: UltraAISupport;
  
  private agentProfiles: Map<string, Map<string, AgentProfile>> = new Map(); // workspaceId -> userId -> profile
  private assignmentRequests: Map<string, AssignmentRequest> = new Map();
  private assignmentResults: Map<string, AssignmentResult[]> = new Map(); // requestId -> results
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout;

  static getInstance(): UltraSmartAssignment {
    if (!UltraSmartAssignment.instance) {
      UltraSmartAssignment.instance = new UltraSmartAssignment();
    }
    return UltraSmartAssignment.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.accessControl = UltraAccessControl.getInstance();
    this.smartQueue = UltraSmartQueue.getInstance();
    this.aiSupport = UltraAISupport.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadAgentProfiles();
      await this.loadAssignmentRequests();
      this.startAssignmentProcessing();
      
      this.logger.info('smart-assignment', 'Smart assignment system initialized', {
        workspacesCount: this.agentProfiles.size,
        totalAgentsCount: Array.from(this.agentProfiles.values()).reduce((sum, profiles) => sum + profiles.size, 0),
        pendingRequestsCount: this.assignmentRequests.size
      });
    } catch (error) {
      this.logger.error('smart-assignment', 'Failed to initialize smart assignment system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS agent_profiles (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        skills JSONB NOT NULL,
        languages TEXT[] NOT NULL,
        specialties TEXT[] NOT NULL,
        experience_level VARCHAR(20) NOT NULL,
        max_concurrent_chats INTEGER DEFAULT 5,
        current_chats INTEGER DEFAULT 0,
        availability_status VARCHAR(20) DEFAULT 'offline',
        timezone VARCHAR(50) NOT NULL,
        working_hours JSONB NOT NULL,
        performance_metrics JSONB NOT NULL,
        preferences JSONB NOT NULL,
        last_activity TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, workspace_id)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS assignment_requests (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        ticket_id VARCHAR(255),
        message_id VARCHAR(255),
        user_id VARCHAR(255) NOT NULL,
        priority VARCHAR(10) NOT NULL,
        category VARCHAR(100) NOT NULL,
        language VARCHAR(10) NOT NULL,
        tags TEXT[] NOT NULL,
        estimated_complexity INTEGER DEFAULT 5,
        required_skills TEXT[] NOT NULL,
        preferred_skills TEXT[] NOT NULL,
        customer_tier VARCHAR(20) NOT NULL,
        previous_agent_id VARCHAR(255),
        escalation_level INTEGER DEFAULT 0,
        metadata JSONB NOT NULL,
        requested_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS assignment_results (
        id VARCHAR(255) PRIMARY KEY,
        request_id VARCHAR(255) NOT NULL,
        assigned_agent_id VARCHAR(255) NOT NULL,
        confidence DECIMAL(3,2) NOT NULL,
        assignment_reason TEXT NOT NULL,
        match_score DECIMAL(3,2) NOT NULL,
        factors JSONB NOT NULL,
        assigned_at TIMESTAMP DEFAULT NOW(),
        estimated_response_time INTEGER NOT NULL
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS assignment_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_assignments INTEGER DEFAULT 0,
        assignments_by_category JSONB NOT NULL,
        assignments_by_priority JSONB NOT NULL,
        assignments_by_agent JSONB NOT NULL,
        average_assignment_time DECIMAL(8,2),
        assignment_accuracy DECIMAL(5,2),
        agent_utilization DECIMAL(5,2),
        customer_satisfaction_by_assignment DECIMAL(3,2),
        escalation_rate DECIMAL(5,2),
        reassignment_rate DECIMAL(5,2),
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_agent_profiles_workspace_id ON agent_profiles(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_agent_profiles_availability ON agent_profiles(availability_status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_agent_profiles_skills ON agent_profiles USING GIN(skills)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_assignment_requests_workspace_id ON assignment_requests(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_assignment_requests_status ON assignment_requests(priority)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_assignment_results_request_id ON assignment_results(request_id)');
  }

  private async loadAgentProfiles(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM agent_profiles ORDER BY updated_at DESC');
      
      for (const row of rows) {
        const profile: AgentProfile = {
          id: row.id,
          userId: row.user_id,
          workspaceId: row.workspace_id,
          skills: row.skills || [],
          languages: row.languages || [],
          specialties: row.specialties || [],
          experienceLevel: row.experience_level,
          maxConcurrentChats: row.max_concurrent_chats,
          currentChats: row.current_chats,
          availabilityStatus: row.availability_status,
          timezone: row.timezone,
          workingHours: row.working_hours,
          performanceMetrics: row.performance_metrics || {
            averageResponseTime: 15,
            averageResolutionTime: 60,
            customerSatisfaction: 4.0,
            resolutionRate: 85,
            handledTickets: 0,
            escalationRate: 10
          },
          preferences: row.preferences || {
            preferredCategories: [],
            avoidedCategories: [],
            maxUrgentTickets: 3,
            languagePriority: []
          },
          lastActivity: row.last_activity,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.agentProfiles.has(profile.workspaceId)) {
          this.agentProfiles.set(profile.workspaceId, new Map());
        }
        this.agentProfiles.get(profile.workspaceId)!.set(profile.userId, profile);
      }
      
      this.logger.info('smart-assignment', `Loaded agent profiles for ${this.agentProfiles.size} workspaces`);
    } catch (error) {
      this.logger.error('smart-assignment', 'Failed to load agent profiles', error as Error);
    }
  }

  private async loadAssignmentRequests(): Promise<void> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM assignment_requests WHERE requested_at > NOW() - INTERVAL \'24 hours\' ORDER BY requested_at DESC LIMIT 1000'
      );
      
      for (const row of rows) {
        const request: AssignmentRequest = {
          id: row.id,
          workspaceId: row.workspace_id,
          ticketId: row.ticket_id,
          messageId: row.message_id,
          userId: row.user_id,
          priority: row.priority,
          category: row.category,
          language: row.language,
          tags: row.tags || [],
          estimatedComplexity: row.estimated_complexity,
          requiredSkills: row.required_skills || [],
          preferredSkills: row.preferred_skills || [],
          customerTier: row.customer_tier,
          previousAgentId: row.previous_agent_id,
          escalationLevel: row.escalation_level,
          metadata: row.metadata || {},
          requestedAt: row.requested_at
        };
        
        this.assignmentRequests.set(request.id, request);
      }
      
      this.logger.info('smart-assignment', `Loaded ${this.assignmentRequests.size} assignment requests`);
    } catch (error) {
      this.logger.error('smart-assignment', 'Failed to load assignment requests', error as Error);
    }
  }

  private startAssignmentProcessing(): void {
    this.isProcessing = true;
    
    // Process assignments every 30 seconds
    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) {
        await this.processPendingAssignments();
      }
    }, 30000);
  }

  // PUBLIC API METHODS
  async createAgentProfile(config: {
    userId: string;
    workspaceId: string;
    skills: AgentSkill[];
    languages: string[];
    specialties?: string[];
    experienceLevel: AgentProfile['experienceLevel'];
    maxConcurrentChats?: number;
    timezone: string;
    workingHours: AgentProfile['workingHours'];
    preferences?: AgentProfile['preferences'];
  }): Promise<string> {
    const profileId = `profile-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const profile: AgentProfile = {
        id: profileId,
        userId: config.userId,
        workspaceId: config.workspaceId,
        skills: config.skills,
        languages: config.languages,
        specialties: config.specialties || [],
        experienceLevel: config.experienceLevel,
        maxConcurrentChats: config.maxConcurrentChats || 5,
        currentChats: 0,
        availabilityStatus: 'offline',
        timezone: config.timezone,
        workingHours: config.workingHours,
        performanceMetrics: {
          averageResponseTime: 15,
          averageResolutionTime: 60,
          customerSatisfaction: 4.0,
          resolutionRate: 85,
          handledTickets: 0,
          escalationRate: 10
        },
        preferences: config.preferences || {
          preferredCategories: [],
          avoidedCategories: [],
          maxUrgentTickets: 3,
          languagePriority: []
        },
        lastActivity: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO agent_profiles (
          id, user_id, workspace_id, skills, languages, specialties, experience_level,
          max_concurrent_chats, current_chats, availability_status, timezone, working_hours,
          performance_metrics, preferences, last_activity, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        profile.id,
        profile.userId,
        profile.workspaceId,
        JSON.stringify(profile.skills),
        profile.languages,
        profile.specialties,
        profile.experienceLevel,
        profile.maxConcurrentChats,
        profile.currentChats,
        profile.availabilityStatus,
        profile.timezone,
        JSON.stringify(profile.working_hours),
        JSON.stringify(profile.performanceMetrics),
        JSON.stringify(profile.preferences),
        profile.lastActivity,
        profile.createdAt,
        profile.updatedAt
      ]);
      
      if (!this.agentProfiles.has(profile.workspaceId)) {
        this.agentProfiles.set(profile.workspaceId, new Map());
      }
      this.agentProfiles.get(profile.workspaceId)!.set(profile.userId, profile);
      
      this.emit('agentProfileCreated', profile);
      return profileId;
      
    } catch (error) {
      this.logger.error('smart-assignment', `Failed to create agent profile: ${profileId}`, error as Error);
      throw error;
    }
  }

  async requestAssignment(config: {
    workspaceId: string;
    ticketId?: string;
    messageId?: string;
    userId: string;
    priority: AssignmentRequest['priority'];
    category: string;
    language: string;
    tags?: string[];
    estimatedComplexity?: number;
    requiredSkills?: string[];
    preferredSkills?: string[];
    customerTier?: AssignmentRequest['customerTier'];
    previousAgentId?: string;
    escalationLevel?: number;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const requestId = `req-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const request: AssignmentRequest = {
        id: requestId,
        workspaceId: config.workspaceId,
        ticketId: config.ticketId,
        messageId: config.messageId,
        userId: config.userId,
        priority: config.priority,
        category: config.category,
        language: config.language,
        tags: config.tags || [],
        estimatedComplexity: config.estimatedComplexity || 5,
        requiredSkills: config.requiredSkills || [],
        preferredSkills: config.preferredSkills || [],
        customerTier: config.customerTier || 'basic',
        previousAgentId: config.previousAgentId,
        escalationLevel: config.escalationLevel || 0,
        metadata: config.metadata || {},
        requestedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO assignment_requests (
          id, workspace_id, ticket_id, message_id, user_id, priority, category, language,
          tags, estimated_complexity, required_skills, preferred_skills, customer_tier,
          previous_agent_id, escalation_level, metadata, requested_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        request.id,
        request.workspaceId,
        request.ticketId,
        request.messageId,
        request.userId,
        request.priority,
        request.category,
        request.language,
        request.tags,
        request.estimatedComplexity,
        request.requiredSkills,
        request.preferredSkills,
        request.customerTier,
        request.previousAgentId,
        request.escalationLevel,
        JSON.stringify(request.metadata),
        request.requestedAt
      ]);
      
      this.assignmentRequests.set(requestId, request);
      
      // Process assignment immediately
      await this.processAssignment(requestId);
      
      return requestId;
      
    } catch (error) {
      this.logger.error('smart-assignment', `Failed to request assignment: ${requestId}`, error as Error);
      throw error;
    }
  }

  private async processAssignment(requestId: string): Promise<void> {
    try {
      const request = this.assignmentRequests.get(requestId);
      if (!request) return;
      
      const workspaceProfiles = this.agentProfiles.get(request.workspaceId);
      if (!workspaceProfiles || workspaceProfiles.size === 0) {
        this.logger.warn('smart-assignment', `No agent profiles available for workspace: ${request.workspaceId}`);
        return;
      }
      
      // Find available agents
      const availableAgents = Array.from(workspaceProfiles.values())
        .filter(agent => this.isAgentAvailable(agent, request));
      
      if (availableAgents.length === 0) {
        this.logger.warn('smart-assignment', `No available agents for request: ${requestId}`);
        this.emit('noAgentsAvailable', request);
        return;
      }
      
      // Calculate match scores for each agent
      const agentScores: Array<{ agent: AgentProfile; score: number; factors: any }> = [];
      
      for (const agent of availableAgents) {
        const score = await this.calculateMatchScore(agent, request);
        agentScores.push(score);
      }
      
      // Sort by score (highest first)
      agentScores.sort((a, b) => b.score - a.score);
      
      if (agentScores.length === 0) {
        this.logger.warn('smart-assignment', `No suitable agents found for request: ${requestId}`);
        return;
      }
      
      // Select best agent
      const bestMatch = agentScores[0];
      
      // Create assignment result
      const result: AssignmentResult = {
        requestId: request.id,
        assignedAgentId: bestMatch.agent.userId,
        confidence: bestMatch.score,
        assignmentReason: this.generateAssignmentReason(bestMatch),
        matchScore: bestMatch.score,
        factors: bestMatch.factors,
        assignedAt: new Date(),
        estimatedResponseTime: bestMatch.agent.performanceMetrics.averageResponseTime
      };
      
      // Save assignment result
      await this.saveAssignmentResult(result);
      
      // Update agent current chats
      await this.updateAgentWorkload(bestMatch.agent.userId, request.workspaceId, 1);
      
      // Assign to queue item if ticket exists
      if (request.ticketId) {
        await this.smartQueue.assignToAgent(request.ticketId, bestMatch.agent.userId);
      }
      
      // Store result
      if (!this.assignmentResults.has(requestId)) {
        this.assignmentResults.set(requestId, []);
      }
      this.assignmentResults.get(requestId)!.push(result);
      
      // Remove request from pending
      this.assignmentRequests.delete(requestId);
      
      this.emit('assignmentCompleted', { request, result, agent: bestMatch.agent });
      this.logger.info('smart-assignment', `Assignment completed: ${requestId} -> ${bestMatch.agent.userId}`, {
        confidence: bestMatch.score,
        category: request.category,
        priority: request.priority
      });
      
    } catch (error) {
      this.logger.error('smart-assignment', `Failed to process assignment: ${requestId}`, error as Error);
    }
  }

  private isAgentAvailable(agent: AgentProfile, request: AssignmentRequest): boolean {
    // Check availability status
    if (agent.availabilityStatus !== 'online' && agent.availabilityStatus !== 'busy') {
      return false;
    }
    
    // Check working hours
    if (!this.isWithinWorkingHours(agent)) {
      return false;
    }
    
    // Check concurrent chat limit
    if (agent.currentChats >= agent.maxConcurrentChats) {
      return false;
    }
    
    // Check urgent ticket limit
    if (request.priority === 'urgent' && agent.preferences.maxUrgentTickets) {
      const currentUrgentChats = this.getCurrentUrgentChats(agent.userId, agent.workspaceId);
      if (currentUrgentChats >= agent.preferences.maxUrgentTickets) {
        return false;
      }
    }
    
    // Check avoided categories
    if (agent.preferences.avoidedCategories.includes(request.category)) {
      return false;
    }
    
    return true;
  }

  private isWithinWorkingHours(agent: AgentProfile): boolean {
    const now = new Date();
    const agentTime = new Date(now.toLocaleString("en-US", { timeZone: agent.timezone }));
    
    const dayOfWeek = agentTime.getDay() || 7; // Convert Sunday (0) to 7
    const currentTime = agentTime.getHours() * 60 + agentTime.getMinutes();
    
    const isWorkingDay = agent.workingHours.days.includes(dayOfWeek);
    if (!isWorkingDay) return false;
    
    const [startHour, startMin] = agent.workingHours.start.split(':').map(Number);
    const [endHour, endMin] = agent.workingHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    
    return currentTime >= startTime && currentTime <= endTime;
  }

  private getCurrentUrgentChats(agentId: string, workspaceId: string): number {
    // This would query the queue for current urgent chats
    // For now, return a placeholder
    return 0;
  }

  private async calculateMatchScore(agent: AgentProfile, request: AssignmentRequest): Promise<{
    agent: AgentProfile;
    score: number;
    factors: {
      skillMatch: number;
      languageMatch: number;
      availabilityMatch: number;
      workloadMatch: number;
      performanceMatch: number;
      preferenceMatch: number;
    };
  }> {
    const factors = {
      skillMatch: await this.calculateSkillMatch(agent, request),
      languageMatch: this.calculateLanguageMatch(agent, request),
      availabilityMatch: this.calculateAvailabilityMatch(agent, request),
      workloadMatch: this.calculateWorkloadMatch(agent, request),
      performanceMatch: this.calculatePerformanceMatch(agent, request),
      preferenceMatch: this.calculatePreferenceMatch(agent, request)
    };
    
    // Weighted score calculation
    const weights = {
      skillMatch: 0.3,
      languageMatch: 0.2,
      availabilityMatch: 0.15,
      workloadMatch: 0.15,
      performanceMatch: 0.1,
      preferenceMatch: 0.1
    };
    
    const score = Object.entries(factors).reduce((total, [factor, value]) => {
      return total + (value * weights[factor as keyof typeof weights]);
    }, 0);
    
    return { agent, score, factors };
  }

  private async calculateSkillMatch(agent: AgentProfile, request: AssignmentRequest): Promise<number> {
    let score = 0;
    let totalWeight = 0;
    
    // Required skills (higher weight)
    for (const requiredSkill of request.requiredSkills) {
      totalWeight += 2;
      const agentSkill = agent.skills.find(skill => skill.name.toLowerCase() === requiredSkill.toLowerCase());
      if (agentSkill) {
        score += (agentSkill.level / 10) * 2;
      }
    }
    
    // Preferred skills (lower weight)
    for (const preferredSkill of request.preferredSkills) {
      totalWeight += 1;
      const agentSkill = agent.skills.find(skill => skill.name.toLowerCase() === preferredSkill.toLowerCase());
      if (agentSkill) {
        score += (agentSkill.level / 10);
      }
    }
    
    // Category specialty
    if (agent.specialties.includes(request.category)) {
      totalWeight += 1;
      score += 1;
    }
    
    // Experience level bonus
    const experienceBonus = {
      'junior': 0.2,
      'intermediate': 0.4,
      'senior': 0.7,
      'expert': 1.0
    };
    
    totalWeight += 1;
    score += experienceBonus[agent.experienceLevel];
    
    return totalWeight > 0 ? Math.min(score / totalWeight, 1) : 0;
  }

  private calculateLanguageMatch(agent: AgentProfile, request: AssignmentRequest): number {
    // Exact language match
    if (agent.languages.includes(request.language)) {
      return 1.0;
    }
    
    // Check language priority
    const languagePriority = agent.preferences.languagePriority || [];
    const languageIndex = languagePriority.indexOf(request.language);
    
    if (languageIndex !== -1) {
      return 1.0 - (languageIndex * 0.2);
    }
    
    return 0.0;
  }

  private calculateAvailabilityMatch(agent: AgentProfile, request: AssignmentRequest): number {
    let score = 0;
    
    // Availability status
    if (agent.availabilityStatus === 'online') {
      score += 0.5;
    } else if (agent.availabilityStatus === 'busy') {
      score += 0.3;
    }
    
    // Workload availability
    const workloadRatio = agent.currentChats / agent.maxConcurrentChats;
    score += (1 - workloadRatio) * 0.5;
    
    return Math.min(score, 1);
  }

  private calculateWorkloadMatch(agent: AgentProfile, request: AssignmentRequest): number {
    const workloadRatio = agent.currentChats / agent.maxConcurrentChats;
    
    // Prefer agents with lower workload
    if (workloadRatio < 0.5) return 1.0;
    if (workloadRatio < 0.8) return 0.7;
    if (workloadRatio < 1.0) return 0.4;
    return 0.1;
  }

  private calculatePerformanceMatch(agent: AgentProfile, request: AssignmentRequest): number {
    const metrics = agent.performanceMetrics;
    
    // Customer satisfaction (40% weight)
    const satisfactionScore = metrics.customerSatisfaction / 5;
    
    // Resolution rate (30% weight)
    const resolutionScore = metrics.resolutionRate / 100;
    
    // Response time (20% weight)
    // Lower response time is better
    const responseScore = Math.max(0, 1 - (metrics.averageResponseTime / 60)); // Normalize to 0-1
    
    // Escalation rate (10% weight)
    // Lower escalation rate is better
    const escalationScore = Math.max(0, 1 - (metrics.escalationRate / 50)); // Normalize to 0-1
    
    return (satisfactionScore * 0.4) + (resolutionScore * 0.3) + (responseScore * 0.2) + (escalationScore * 0.1);
  }

  private calculatePreferenceMatch(agent: AgentProfile, request: AssignmentRequest): number {
    let score = 0.5; // Base score
    
    // Preferred categories
    if (agent.preferences.preferredCategories.includes(request.category)) {
      score += 0.3;
    }
    
    // Customer tier preference
    if (request.customerTier === 'enterprise' && agent.experienceLevel === 'expert') {
      score += 0.2;
    }
    
    return Math.min(score, 1);
  }

  private generateAssignmentReason(match: { agent: AgentProfile; score: number; factors: any }): string {
    const reasons: string[] = [];
    
    if (match.factors.skillMatch > 0.8) {
      reasons.push('Strong skill match');
    }
    
    if (match.factors.languageMatch === 1.0) {
      reasons.push('Language match');
    }
    
    if (match.factors.performanceMatch > 0.8) {
      reasons.push('High performance rating');
    }
    
    if (match.factors.availabilityMatch > 0.8) {
      reasons.push('Good availability');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'Best available match';
  }

  private async saveAssignmentResult(result: AssignmentResult): Promise<void> {
    try {
      await this.database.query(`
        INSERT INTO assignment_results (
          id, request_id, assigned_agent_id, confidence, assignment_reason, match_score,
          factors, assigned_at, estimated_response_time
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        `result-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
        result.requestId,
        result.assignedAgentId,
        result.confidence,
        result.assignmentReason,
        result.matchScore,
        JSON.stringify(result.factors),
        result.assignedAt,
        result.estimatedResponseTime
      ]);
      
    } catch (error) {
      this.logger.error('smart-assignment', 'Failed to save assignment result', error as Error);
    }
  }

  private async updateAgentWorkload(agentId: string, workspaceId: string, delta: number): Promise<void> {
    try {
      await this.database.query(
        'UPDATE agent_profiles SET current_chats = current_chats + $1, last_activity = NOW() WHERE user_id = $2 AND workspace_id = $3',
        [delta, agentId, workspaceId]
      );
      
      // Update local cache
      const workspaceProfiles = this.agentProfiles.get(workspaceId);
      if (workspaceProfiles && workspaceProfiles.has(agentId)) {
        const profile = workspaceProfiles.get(agentId)!;
        profile.currentChats += delta;
        profile.lastActivity = new Date();
      }
      
    } catch (error) {
      this.logger.error('smart-assignment', 'Failed to update agent workload', error as Error);
    }
  }

  private async processPendingAssignments(): Promise<void> {
    try {
      const requests = Array.from(this.assignmentRequests.values())
        .filter(request => Date.now() - request.requestedAt.getTime() < 5 * 60 * 1000); // Process requests less than 5 minutes old
      
      for (const request of requests) {
        if (this.assignmentRequests.has(request.id)) {
          await this.processAssignment(request.id);
        }
      }
      
    } catch (error) {
      this.logger.error('smart-assignment', 'Failed to process pending assignments', error as Error);
    }
  }

  async updateAgentAvailability(agentId: string, workspaceId: string, status: AgentProfile['availabilityStatus']): Promise<boolean> {
    try {
      await this.database.query(
        'UPDATE agent_profiles SET availability_status = $1, last_activity = NOW() WHERE user_id = $2 AND workspace_id = $3',
        [status, agentId, workspaceId]
      );
      
      // Update local cache
      const workspaceProfiles = this.agentProfiles.get(workspaceId);
      if (workspaceProfiles && workspaceProfiles.has(agentId)) {
        const profile = workspaceProfiles.get(agentId)!;
        profile.availabilityStatus = status;
        profile.lastActivity = new Date();
      }
      
      this.emit('agentAvailabilityUpdated', { agentId, workspaceId, status });
      return true;
      
    } catch (error) {
      this.logger.error('smart-assignment', 'Failed to update agent availability', error as Error);
      return false;
    }
  }

  async getAgentProfile(userId: string, workspaceId: string): Promise<AgentProfile | null> {
    const workspaceProfiles = this.agentProfiles.get(workspaceId);
    return workspaceProfiles ? workspaceProfiles.get(userId) || null : null;
  }

  async getAvailableAgents(workspaceId: string): Promise<AgentProfile[]> {
    const workspaceProfiles = this.agentProfiles.get(workspaceId);
    if (!workspaceProfiles) return [];
    
    return Array.from(workspaceProfiles.values())
      .filter(agent => agent.availabilityStatus === 'online' || agent.availabilityStatus === 'busy')
      .filter(agent => agent.currentChats < agent.maxConcurrentChats)
      .filter(agent => this.isWithinWorkingHours(agent));
  }

  async getAssignmentAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<AssignmentAnalytics[]> {
    try {
      let sql = 'SELECT * FROM assignment_analytics WHERE workspace_id = $1';
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
        totalAssignments: row.total_assignments,
        assignmentsByCategory: row.assignments_by_category || {},
        assignmentsByPriority: row.assignments_by_priority || {},
        assignmentsByAgent: row.assignments_by_agent || {},
        averageAssignmentTime: parseFloat(row.average_assignment_time) || 0,
        assignmentAccuracy: parseFloat(row.assignment_accuracy) || 0,
        agentUtilization: parseFloat(row.agent_utilization) || 0,
        customerSatisfactionByAssignment: parseFloat(row.customer_satisfaction_by_assignment) || 0,
        escalationRate: parseFloat(row.escalation_rate) || 0,
        reassignmentRate: parseFloat(row.reassignment_rate) || 0
      }));
      
    } catch (error) {
      this.logger.error('smart-assignment', 'Failed to get assignment analytics', error as Error);
      return [];
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    totalAgentsCount: number;
    availableAgentsCount: number;
    pendingRequestsCount: number;
    assignmentProcessingActive: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!this.isProcessing) {
      issues.push('Assignment processing is not active');
    }
    
    const totalAgents = Array.from(this.agentProfiles.values()).reduce((sum, profiles) => sum + profiles.size, 0);
    const availableAgents = Array.from(this.agentProfiles.values())
      .reduce((sum, profiles) => sum + profiles.size, 0); // Would filter for available agents
    
    if (totalAgents === 0) {
      issues.push('No agent profiles configured');
    }
    
    return {
      healthy: issues.length === 0,
      totalAgentsCount: totalAgents,
      availableAgentsCount: availableAgents,
      pendingRequestsCount: this.assignmentRequests.size,
      assignmentProcessingActive: this.isProcessing,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.logger.info('smart-assignment', 'Smart assignment system shut down');
  }
}

export default UltraSmartAssignment;
