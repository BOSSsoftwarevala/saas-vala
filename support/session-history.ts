import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { Message, User, Workspace, Channel } from './slack-system';
import * as crypto from 'crypto';

export interface SessionHistory {
  id: string;
  workspaceId: string;
  sessionId: string;
  userId: string;
  participantIds: string[];
  channelIds: string[];
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'ended' | 'archived';
  messageCount: number;
  fileCount: number;
  tags: string[];
  metadata: {
    title?: string;
    description?: string;
    category?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    agentId?: string;
    ticketId?: string;
    customerId?: string;
    satisfaction?: number;
    resolutionTime?: number;
    escalationLevel?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface HistorySearchFilter {
  workspaceId: string;
  userId?: string;
  participantIds?: string[];
  channelIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: SessionHistory['status'];
  tags?: string[];
  messageTypes?: string[];
  hasAttachments?: boolean;
  minMessageCount?: number;
  maxMessageCount?: number;
  category?: string;
  priority?: string;
  agentId?: string;
  ticketId?: string;
  searchText?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'startTime' | 'endTime' | 'messageCount' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface SessionSummary {
  sessionId: string;
  title: string;
  participantCount: number;
  messageCount: number;
  fileCount: number;
  duration: number; // minutes
  keyTopics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  resolutionStatus: 'resolved' | 'pending' | 'escalated' | 'unresolved';
  agentPerformance?: {
    responseTime: number;
    satisfactionScore: number;
    resolutionRate: number;
  };
  tags: string[];
  lastActivity: Date;
}

export interface HistoryExport {
  id: string;
  workspaceId: string;
  requestedBy: string;
  filters: HistorySearchFilter;
  format: 'json' | 'csv' | 'pdf' | 'html';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  filePath?: string;
  downloadUrl?: string;
  expiresAt: Date;
  metadata: {
    totalSessions?: number;
    totalMessages?: number;
    fileSize?: number;
    processingTime?: number;
  };
  createdAt: Date;
  completedAt?: Date;
}

export interface HistoryAnalytics {
  workspaceId: string;
  date: Date;
  totalSessions: number;
  activeSessions: number;
  averageSessionDuration: number; // minutes
  totalMessages: number;
  averageMessagesPerSession: number;
  sessionsByCategory: Record<string, number>;
  sessionsByPriority: Record<string, number>;
  sessionsByAgent: Record<string, number>;
  resolutionRates: {
    resolved: number;
    pending: number;
    escalated: number;
    unresolved: number;
  };
  topParticipants: Array<{
    userId: string;
    sessionCount: number;
    messageCount: number;
  }>;
  fileAttachments: {
    totalFiles: number;
    totalSize: number;
    averageSize: number;
  };
  searchQueries: Array<{
    query: string;
    count: number;
    avgResults: number;
  }>;
}

export class UltraSessionHistory extends EventEmitter {
  private static instance: UltraSessionHistory;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  
  private activeSessions: Map<string, SessionHistory> = new Map(); // sessionId -> session
  private sessionCache: Map<string, SessionHistory[]> = new Map(); // workspaceId -> sessions
  private searchCache: Map<string, { results: SessionHistory[]; timestamp: number }> = new Map();

  static getInstance(): UltraSessionHistory {
    if (!UltraSessionHistory.instance) {
      UltraSessionHistory.instance = new UltraSessionHistory();
    }
    return UltraSessionHistory.instance;
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
      await this.loadActiveSessions();
      this.startCacheCleanup();
      
      this.logger.info('session-history', 'Session history system initialized', {
        activeSessionsCount: this.activeSessions.size,
        cachedWorkspacesCount: this.sessionCache.size
      });
    } catch (error) {
      this.logger.error('session-history', 'Failed to initialize session history system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS session_histories (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        session_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        participant_ids TEXT[] NOT NULL,
        channel_ids TEXT[] NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        status VARCHAR(20) NOT NULL,
        message_count INTEGER DEFAULT 0,
        file_count INTEGER DEFAULT 0,
        tags TEXT[] NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, session_id)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS session_summaries (
        id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        participant_count INTEGER NOT NULL,
        message_count INTEGER NOT NULL,
        file_count INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        key_topics TEXT[] NOT NULL,
        sentiment VARCHAR(10) NOT NULL,
        resolution_status VARCHAR(20) NOT NULL,
        agent_performance JSONB,
        tags TEXT[] NOT NULL,
        last_activity TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(session_id)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS history_exports (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        requested_by VARCHAR(255) NOT NULL,
        filters JSONB NOT NULL,
        format VARCHAR(10) NOT NULL,
        status VARCHAR(20) NOT NULL,
        file_path TEXT,
        download_url TEXT,
        expires_at TIMESTAMP NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS history_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_sessions INTEGER DEFAULT 0,
        active_sessions INTEGER DEFAULT 0,
        average_session_duration DECIMAL(8,2),
        total_messages INTEGER DEFAULT 0,
        average_messages_per_session DECIMAL(8,2),
        sessions_by_category JSONB NOT NULL,
        sessions_by_priority JSONB NOT NULL,
        sessions_by_agent JSONB NOT NULL,
        resolution_rates JSONB NOT NULL,
        top_participants JSONB NOT NULL,
        file_attachments JSONB NOT NULL,
        search_queries JSONB NOT NULL,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_session_histories_workspace_id ON session_histories(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_session_histories_user_id ON session_histories(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_session_histories_session_id ON session_histories(session_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_session_histories_status ON session_histories(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_session_histories_start_time ON session_histories(start_time)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_session_histories_tags ON session_histories USING GIN(tags)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_session_summaries_workspace_id ON session_summaries(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_history_exports_workspace_id ON history_exports(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_history_exports_status ON history_exports(status)');
  }

  private async loadActiveSessions(): Promise<void> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM session_histories WHERE status = \'active\' ORDER BY start_time DESC'
      );
      
      for (const row of rows) {
        const session: SessionHistory = {
          id: row.id,
          workspaceId: row.workspace_id,
          sessionId: row.session_id,
          userId: row.user_id,
          participantIds: row.participant_ids || [],
          channelIds: row.channel_ids || [],
          startTime: row.start_time,
          endTime: row.end_time,
          status: row.status,
          messageCount: row.message_count,
          fileCount: row.file_count,
          tags: row.tags || [],
          metadata: row.metadata || {},
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.activeSessions.set(session.sessionId, session);
      }
      
      this.logger.info('session-history', `Loaded ${this.activeSessions.size} active sessions`);
    } catch (error) {
      this.logger.error('session-history', 'Failed to load active sessions', error as Error);
    }
  }

  private startCacheCleanup(): void {
    // Clean up search cache every 30 minutes
    setInterval(() => {
      const now = Date.now();
      const cacheTimeout = 30 * 60 * 1000; // 30 minutes
      
      for (const [key, entry] of this.searchCache.entries()) {
        if (now - entry.timestamp > cacheTimeout) {
          this.searchCache.delete(key);
        }
      }
    }, 30 * 60 * 1000);
  }

  // PUBLIC API METHODS
  async createSession(config: {
    workspaceId: string;
    sessionId: string;
    userId: string;
    participantIds?: string[];
    channelIds?: string[];
    metadata?: SessionHistory['metadata'];
    tags?: string[];
  }): Promise<string> {
    const historyId = `history-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const session: SessionHistory = {
        id: historyId,
        workspaceId: config.workspaceId,
        sessionId: config.sessionId,
        userId: config.userId,
        participantIds: config.participantIds || [config.userId],
        channelIds: config.channelIds || [],
        startTime: new Date(),
        status: 'active',
        messageCount: 0,
        fileCount: 0,
        tags: config.tags || [],
        metadata: config.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO session_histories (
          id, workspace_id, session_id, user_id, participant_ids, channel_ids,
          start_time, status, message_count, file_count, tags, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        session.id,
        session.workspaceId,
        session.sessionId,
        session.userId,
        session.participantIds,
        session.channelIds,
        session.startTime,
        session.status,
        session.messageCount,
        session.fileCount,
        session.tags,
        JSON.stringify(session.metadata),
        session.createdAt,
        session.updatedAt
      ]);
      
      this.activeSessions.set(session.sessionId, session);
      
      // Clear workspace cache
      this.sessionCache.delete(config.workspaceId);
      
      this.emit('sessionCreated', session);
      return historyId;
      
    } catch (error) {
      this.logger.error('session-history', `Failed to create session: ${historyId}`, error as Error);
      throw error;
    }
  }

  async updateSession(sessionId: string, updates: {
    participantIds?: string[];
    channelIds?: string[];
    status?: SessionHistory['status'];
    endTime?: Date;
    messageCount?: number;
    fileCount?: number;
    tags?: string[];
    metadata?: Partial<SessionHistory['metadata']>;
  }): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        // Try to load from database
        const dbSession = await this.getSessionBySessionId(sessionId);
        if (!dbSession) {
          return false;
        }
        this.activeSessions.set(sessionId, dbSession);
      }
      
      const currentSession = this.activeSessions.get(sessionId)!;
      
      // Update fields
      if (updates.participantIds) currentSession.participantIds = updates.participantIds;
      if (updates.channelIds) currentSession.channelIds = updates.channelIds;
      if (updates.status) currentSession.status = updates.status;
      if (updates.endTime) currentSession.endTime = updates.endTime;
      if (updates.messageCount !== undefined) currentSession.messageCount = updates.messageCount;
      if (updates.fileCount !== undefined) currentSession.fileCount = updates.fileCount;
      if (updates.tags) currentSession.tags = updates.tags;
      if (updates.metadata) {
        currentSession.metadata = { ...currentSession.metadata, ...updates.metadata };
      }
      
      currentSession.updatedAt = new Date();
      
      // Update database
      await this.database.query(`
        UPDATE session_histories SET
          participant_ids = $1,
          channel_ids = $2,
          status = $3,
          end_time = $4,
          message_count = $5,
          file_count = $6,
          tags = $7,
          metadata = $8,
          updated_at = $9
        WHERE session_id = $10
      `, [
        currentSession.participantIds,
        currentSession.channelIds,
        currentSession.status,
        currentSession.endTime,
        currentSession.messageCount,
        currentSession.fileCount,
        currentSession.tags,
        JSON.stringify(currentSession.metadata),
        currentSession.updatedAt,
        sessionId
      ]);
      
      // Clear workspace cache
      this.sessionCache.delete(currentSession.workspaceId);
      
      // Remove from active sessions if ended
      if (currentSession.status === 'ended' || currentSession.status === 'archived') {
        this.activeSessions.delete(sessionId);
      }
      
      this.emit('sessionUpdated', currentSession);
      return true;
      
    } catch (error) {
      this.logger.error('session-history', `Failed to update session: ${sessionId}`, error as Error);
      return false;
    }
  }

  async endSession(sessionId: string, metadata?: Partial<SessionHistory['metadata']>): Promise<boolean> {
    return this.updateSession(sessionId, {
      status: 'ended',
      endTime: new Date(),
      metadata
    });
  }

  async searchSessions(filters: HistorySearchFilter): Promise<{
    sessions: SessionHistory[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(filters);
      const cached = this.searchCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minutes cache
        const sessions = cached.results.slice(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50));
        return {
          sessions,
          totalCount: cached.results.length,
          hasMore: sessions.length === (filters.limit || 50)
        };
      }
      
      let sql = `
        SELECT sh.* FROM session_histories sh
        WHERE sh.workspace_id = $1
      `;
      const params: any[] = [filters.workspaceId];
      
      // Add filters
      if (filters.userId) {
        sql += ' AND sh.user_id = $' + (params.length + 1);
        params.push(filters.userId);
      }
      
      if (filters.participantIds && filters.participantIds.length > 0) {
        sql += ' AND sh.participant_ids && $' + (params.length + 1);
        params.push(filters.participantIds);
      }
      
      if (filters.channelIds && filters.channelIds.length > 0) {
        sql += ' AND sh.channel_ids && $' + (params.length + 1);
        params.push(filters.channelIds);
      }
      
      if (filters.dateRange) {
        sql += ' AND sh.start_time >= $' + (params.length + 1) + ' AND sh.start_time <= $' + (params.length + 2);
        params.push(filters.dateRange.start, filters.dateRange.end);
      }
      
      if (filters.status) {
        sql += ' AND sh.status = $' + (params.length + 1);
        params.push(filters.status);
      }
      
      if (filters.tags && filters.tags.length > 0) {
        sql += ' AND sh.tags && $' + (params.length + 1);
        params.push(filters.tags);
      }
      
      if (filters.minMessageCount) {
        sql += ' AND sh.message_count >= $' + (params.length + 1);
        params.push(filters.minMessageCount);
      }
      
      if (filters.maxMessageCount) {
        sql += ' AND sh.message_count <= $' + (params.length + 1);
        params.push(filters.maxMessageCount);
      }
      
      if (filters.category) {
        sql += ' AND sh.metadata->>\'category\' = $' + (params.length + 1);
        params.push(filters.category);
      }
      
      if (filters.priority) {
        sql += ' AND sh.metadata->>\'priority\' = $' + (params.length + 1);
        params.push(filters.priority);
      }
      
      if (filters.agentId) {
        sql += ' AND sh.metadata->>\'agentId\' = $' + (params.length + 1);
        params.push(filters.agentId);
      }
      
      if (filters.ticketId) {
        sql += ' AND sh.metadata->>\'ticketId\' = $' + (params.length + 1);
        params.push(filters.ticketId);
      }
      
      if (filters.searchText) {
        sql += ' AND (sh.metadata->>\'title\' ILIKE $' + (params.length + 1) + ' OR sh.metadata->>\'description\' ILIKE $' + (params.length + 2) + ')';
        const searchTerm = `%${filters.searchText}%`;
        params.push(searchTerm, searchTerm);
      }
      
      // Get total count
      const countSql = sql.replace('SELECT sh.*', 'SELECT COUNT(*)');
      const countResult = await this.database.query(countSql, params);
      const totalCount = parseInt(countResult.rows[0].count);
      
      // Add sorting
      const sortBy = filters.sortBy || 'startTime';
      const sortOrder = filters.sortOrder || 'desc';
      sql += ` ORDER BY sh.${sortBy} ${sortOrder.toUpperCase()}`;
      
      // Add pagination
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      const rows = await this.database.query(sql, params);
      
      const sessions: SessionHistory[] = rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        sessionId: row.session_id,
        userId: row.user_id,
        participantIds: row.participant_ids || [],
        channelIds: row.channel_ids || [],
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        messageCount: row.message_count,
        fileCount: row.file_count,
        tags: row.tags || [],
        metadata: row.metadata || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      // Cache results if no pagination
      if (!filters.offset && !filters.limit) {
        this.searchCache.set(cacheKey, { results: sessions, timestamp: Date.now() });
      }
      
      return {
        sessions,
        totalCount,
        hasMore: sessions.length === limit && (offset + sessions.length) < totalCount
      };
      
    } catch (error) {
      this.logger.error('session-history', 'Failed to search sessions', error as Error);
      return { sessions: [], totalCount: 0, hasMore: false };
    }
  }

  async getSessionDetails(sessionId: string, workspaceId: string): Promise<{
    session: SessionHistory | null;
    messages: Message[];
    participants: User[];
    channels: Channel[];
    summary?: SessionSummary;
  }> {
    try {
      // Get session
      const session = await this.getSessionBySessionId(sessionId);
      if (!session || session.workspaceId !== workspaceId) {
        return { session: null, messages: [], participants: [], channels: [] };
      }
      
      // Get messages for the session
      const messages = await this.getSessionMessages(sessionId, workspaceId);
      
      // Get participants
      const participants = await this.getSessionParticipants(session.participantIds);
      
      // Get channels
      const channels = await this.getSessionChannels(session.channelIds);
      
      // Get summary if exists
      const summary = await this.getSessionSummary(sessionId);
      
      return {
        session,
        messages,
        participants,
        channels,
        summary
      };
      
    } catch (error) {
      this.logger.error('session-history', 'Failed to get session details', error as Error);
      return { session: null, messages: [], participants: [], channels: [] };
    }
  }

  async generateSessionSummary(sessionId: string): Promise<SessionSummary | null> {
    try {
      const session = await this.getSessionBySessionId(sessionId);
      if (!session) {
        return null;
      }
      
      // Get messages for analysis
      const messages = await this.getSessionMessages(sessionId, session.workspaceId);
      
      // Calculate duration
      const endTime = session.endTime || new Date();
      const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / (1000 * 60));
      
      // Extract key topics (simple implementation)
      const keyTopics = this.extractKeyTopics(messages);
      
      // Analyze sentiment (simple implementation)
      const sentiment = this.analyzeSentiment(messages);
      
      // Determine resolution status
      const resolutionStatus = this.determineResolutionStatus(session, messages);
      
      // Get agent performance if applicable
      let agentPerformance;
      if (session.metadata.agentId) {
        agentPerformance = await this.calculateAgentPerformance(session.metadata.agentId, sessionId);
      }
      
      const summary: SessionSummary = {
        sessionId,
        title: session.metadata.title || `Session ${sessionId}`,
        participantCount: session.participantIds.length,
        messageCount: session.messageCount,
        fileCount: session.fileCount,
        duration,
        keyTopics,
        sentiment,
        resolutionStatus,
        agentPerformance,
        tags: session.tags,
        lastActivity: session.updatedAt
      };
      
      // Save summary
      await this.saveSessionSummary(summary);
      
      return summary;
      
    } catch (error) {
      this.logger.error('session-history', 'Failed to generate session summary', error as Error);
      return null;
    }
  }

  async exportHistory(filters: HistorySearchFilter, format: HistoryExport['format'], requestedBy: string): Promise<string> {
    const exportId = `export-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const exportRecord: HistoryExport = {
        id: exportId,
        workspaceId: filters.workspaceId,
        requestedBy,
        filters,
        format,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        metadata: {},
        createdAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO history_exports (
          id, workspace_id, requested_by, filters, format, status, expires_at, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        exportRecord.id,
        exportRecord.workspaceId,
        exportRecord.requestedBy,
        JSON.stringify(exportRecord.filters),
        exportRecord.format,
        exportRecord.status,
        exportRecord.expiresAt,
        JSON.stringify(exportRecord.metadata),
        exportRecord.createdAt
      ]);
      
      // Start processing export asynchronously
      this.processExport(exportId);
      
      this.emit('exportRequested', exportRecord);
      return exportId;
      
    } catch (error) {
      this.logger.error('session-history', `Failed to create export: ${exportId}`, error as Error);
      throw error;
    }
  }

  private async processExport(exportId: string): Promise<void> {
    try {
      // Update status to processing
      await this.database.query(
        'UPDATE history_exports SET status = $1 WHERE id = $2',
        ['processing', exportId]
      );
      
      // Get export details
      const exportResult = await this.database.query('SELECT * FROM history_exports WHERE id = $1', [exportId]);
      if (exportResult.rows.length === 0) return;
      
      const exportRecord: HistoryExport = {
        ...exportResult.rows[0],
        filters: exportResult.rows[0].filters,
        metadata: exportResult.rows[0].metadata
      };
      
      // Get sessions
      const searchResult = await this.searchSessions(exportRecord.filters);
      const sessions = searchResult.sessions;
      
      // Process export based on format
      let filePath: string;
      let fileSize: number;
      
      switch (exportRecord.format) {
        case 'json':
          ({ filePath, fileSize } = await this.exportToJSON(sessions, exportId));
          break;
        case 'csv':
          ({ filePath, fileSize } = await this.exportToCSV(sessions, exportId));
          break;
        case 'pdf':
          ({ filePath, fileSize } = await this.exportToPDF(sessions, exportId));
          break;
        case 'html':
          ({ filePath, fileSize } = await this.exportToHTML(sessions, exportId));
          break;
        default:
          throw new Error(`Unsupported export format: ${exportRecord.format}`);
      }
      
      // Update export record
      await this.database.query(`
        UPDATE history_exports SET 
          status = $1, 
          file_path = $2, 
          metadata = $3, 
          completed_at = $4
        WHERE id = $5
      `, [
        'completed',
        filePath,
        JSON.stringify({
          ...exportRecord.metadata,
          totalSessions: sessions.length,
          fileSize
        }),
        new Date(),
        exportId
      ]);
      
      this.emit('exportCompleted', { exportId, filePath, fileSize });
      
    } catch (error) {
      this.logger.error('session-history', `Failed to process export: ${exportId}`, error as Error);
      
      // Update status to failed
      await this.database.query(
        'UPDATE history_exports SET status = $1 WHERE id = $2',
        ['failed', exportId]
      );
      
      this.emit('exportFailed', { exportId, error: error.message });
    }
  }

  private async exportToJSON(sessions: SessionHistory[], exportId: string): Promise<{ filePath: string; fileSize: number }> {
    const filePath = `/exports/${exportId}.json`;
    const jsonData = JSON.stringify(sessions, null, 2);
    const fileSize = Buffer.byteLength(jsonData, 'utf8');
    
    // In a real implementation, this would save to file storage
    // For now, we'll just return the path
    return { filePath, fileSize };
  }

  private async exportToCSV(sessions: SessionHistory[], exportId: string): Promise<{ filePath: string; fileSize: number }> {
    const filePath = `/exports/${exportId}.csv`;
    
    // Simple CSV generation
    const headers = [
      'Session ID', 'User ID', 'Start Time', 'End Time', 'Status',
      'Message Count', 'File Count', 'Tags', 'Category', 'Priority'
    ];
    
    const rows = sessions.map(session => [
      session.sessionId,
      session.userId,
      session.startTime.toISOString(),
      session.endTime?.toISOString() || '',
      session.status,
      session.messageCount,
      session.fileCount,
      session.tags.join(';'),
      session.metadata.category || '',
      session.metadata.priority || ''
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const fileSize = Buffer.byteLength(csvContent, 'utf8');
    
    return { filePath, fileSize };
  }

  private async exportToPDF(sessions: SessionHistory[], exportId: string): Promise<{ filePath: string; fileSize: number }> {
    const filePath = `/exports/${exportId}.pdf`;
    
    // In a real implementation, this would use a PDF library
    // For now, we'll just return a placeholder
    const fileSize = 1024; // placeholder
    
    return { filePath, fileSize };
  }

  private async exportToHTML(sessions: SessionHistory[], exportId: string): Promise<{ filePath: string; fileSize: number }> {
    const filePath = `/exports/${exportId}.html`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Session History Export</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Session History Export</h1>
        <p>Generated: ${new Date().toISOString()}</p>
        <p>Total Sessions: ${sessions.length}</p>
        <table>
          <thead>
            <tr>
              <th>Session ID</th>
              <th>User ID</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Status</th>
              <th>Messages</th>
              <th>Files</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            ${sessions.map(session => `
              <tr>
                <td>${session.sessionId}</td>
                <td>${session.userId}</td>
                <td>${session.startTime.toISOString()}</td>
                <td>${session.endTime?.toISOString() || ''}</td>
                <td>${session.status}</td>
                <td>${session.messageCount}</td>
                <td>${session.fileCount}</td>
                <td>${session.tags.join(', ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    const fileSize = Buffer.byteLength(htmlContent, 'utf8');
    
    return { filePath, fileSize };
  }

  private async getSessionBySessionId(sessionId: string): Promise<SessionHistory | null> {
    try {
      const result = await this.database.query('SELECT * FROM session_histories WHERE session_id = $1', [sessionId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        sessionId: row.session_id,
        userId: row.user_id,
        participantIds: row.participant_ids || [],
        channelIds: row.channel_ids || [],
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        messageCount: row.message_count,
        fileCount: row.file_count,
        tags: row.tags || [],
        metadata: row.metadata || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
      
    } catch (error) {
      this.logger.error('session-history', 'Failed to get session by ID', error as Error);
      return null;
    }
  }

  private async getSessionMessages(sessionId: string, workspaceId: string): Promise<Message[]> {
    try {
      const result = await this.database.query(`
        SELECT m.* FROM messages m
        JOIN session_histories sh ON m.workspace_id = sh.workspace_id
        WHERE sh.session_id = $1 AND sh.workspace_id = $2
        AND m.created_at >= sh.start_time
        AND (sh.end_time IS NULL OR m.created_at <= sh.end_time)
        ORDER BY m.created_at ASC
      `, [sessionId, workspaceId]);
      
      return result.rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        channelId: row.channel_id,
        userId: row.user_id,
        content: row.content,
        type: row.type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: row.metadata || {}
      }));
      
    } catch (error) {
      this.logger.error('session-history', 'Failed to get session messages', error as Error);
      return [];
    }
  }

  private async getSessionParticipants(participantIds: string[]): Promise<User[]> {
    if (participantIds.length === 0) return [];
    
    try {
      const result = await this.database.query(
        'SELECT * FROM users WHERE id = ANY($1)',
        [participantIds]
      );
      
      return result.rows.map(row => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        avatar: row.avatar,
        status: row.status,
        lastSeen: row.last_seen,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: row.metadata || {}
      }));
      
    } catch (error) {
      this.logger.error('session-history', 'Failed to get session participants', error as Error);
      return [];
    }
  }

  private async getSessionChannels(channelIds: string[]): Promise<Channel[]> {
    if (channelIds.length === 0) return [];
    
    try {
      const result = await this.database.query(
        'SELECT * FROM channels WHERE id = ANY($1)',
        [channelIds]
      );
      
      return result.rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        type: row.type,
        description: row.description,
        isPrivate: row.is_private,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: row.metadata || {}
      }));
      
    } catch (error) {
      this.logger.error('session-history', 'Failed to get session channels', error as Error);
      return [];
    }
  }

  private async getSessionSummary(sessionId: string): Promise<SessionSummary | null> {
    try {
      const result = await this.database.query('SELECT * FROM session_summaries WHERE session_id = $1', [sessionId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        sessionId: row.session_id,
        title: row.title,
        participantCount: row.participant_count,
        messageCount: row.message_count,
        fileCount: row.file_count,
        duration: row.duration,
        keyTopics: row.key_topics || [],
        sentiment: row.sentiment,
        resolutionStatus: row.resolution_status,
        agentPerformance: row.agent_performance,
        tags: row.tags || [],
        lastActivity: row.last_activity
      };
      
    } catch (error) {
      this.logger.error('session-history', 'Failed to get session summary', error as Error);
      return null;
    }
  }

  private async saveSessionSummary(summary: SessionSummary): Promise<void> {
    try {
      await this.database.query(`
        INSERT INTO session_summaries (
          id, session_id, workspace_id, title, participant_count, message_count,
          file_count, duration, key_topics, sentiment, resolution_status,
          agent_performance, tags, last_activity, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        ON CONFLICT (session_id) DO UPDATE SET
        title = EXCLUDED.title,
        participant_count = EXCLUDED.participant_count,
        message_count = EXCLUDED.message_count,
        file_count = EXCLUDED.file_count,
        duration = EXCLUDED.duration,
        key_topics = EXCLUDED.key_topics,
        sentiment = EXCLUDED.sentiment,
        resolution_status = EXCLUDED.resolution_status,
        agent_performance = EXCLUDED.agent_performance,
        tags = EXCLUDED.tags,
        last_activity = EXCLUDED.last_activity,
        updated_at = NOW()
      `, [
        `summary-${summary.sessionId}`,
        summary.sessionId,
        '', // workspace_id would be derived from session
        summary.title,
        summary.participantCount,
        summary.messageCount,
        summary.fileCount,
        summary.duration,
        summary.keyTopics,
        summary.sentiment,
        summary.resolutionStatus,
        JSON.stringify(summary.agentPerformance),
        summary.tags,
        summary.lastActivity
      ]);
      
    } catch (error) {
      this.logger.error('session-history', 'Failed to save session summary', error as Error);
    }
  }

  private extractKeyTopics(messages: Message[]): string[] {
    // Simple keyword extraction - in production would use NLP
    const topics = new Set<string>();
    const keywords = ['issue', 'problem', 'bug', 'help', 'question', 'payment', 'billing', 'technical', 'support'];
    
    for (const message of messages) {
      const content = message.content.toLowerCase();
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          topics.add(keyword);
        }
      }
    }
    
    return Array.from(topics).slice(0, 5);
  }

  private analyzeSentiment(messages: Message[]): SessionSummary['sentiment'] {
    // Simple sentiment analysis - in production would use NLP
    let positiveCount = 0;
    let negativeCount = 0;
    
    const positiveWords = ['thank', 'thanks', 'great', 'good', 'excellent', 'perfect', 'resolved', 'fixed'];
    const negativeWords = ['issue', 'problem', 'broken', 'error', 'fail', 'wrong', 'bad', 'terrible'];
    
    for (const message of messages) {
      const content = message.content.toLowerCase();
      
      for (const word of positiveWords) {
        if (content.includes(word)) {
          positiveCount++;
          break;
        }
      }
      
      for (const word of negativeWords) {
        if (content.includes(word)) {
          negativeCount++;
          break;
        }
      }
    }
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private determineResolutionStatus(session: SessionHistory, messages: Message[]): SessionSummary['resolutionStatus'] {
    if (session.status === 'ended' && session.metadata.satisfaction && session.metadata.satisfaction >= 4) {
      return 'resolved';
    }
    
    if (session.metadata.escalationLevel && session.metadata.escalationLevel > 0) {
      return 'escalated';
    }
    
    if (session.status === 'ended') {
      return 'pending';
    }
    
    return 'unresolved';
  }

  private async calculateAgentPerformance(agentId: string, sessionId: string): Promise<SessionSummary['agentPerformance']> {
    // This would calculate actual performance metrics
    return {
      responseTime: 15, // minutes
      satisfactionScore: 4.2,
      resolutionRate: 85 // percentage
    };
  }

  private generateCacheKey(filters: HistorySearchFilter): string {
    return JSON.stringify({
      workspaceId: filters.workspaceId,
      userId: filters.userId,
      participantIds: filters.participantIds,
      channelIds: filters.channelIds,
      dateRange: filters.dateRange,
      status: filters.status,
      tags: filters.tags,
      category: filters.category,
      priority: filters.priority,
      agentId: filters.agentId,
      ticketId: filters.ticketId,
      searchText: filters.searchText,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder
    });
  }

  async getExportStatus(exportId: string, workspaceId: string): Promise<HistoryExport | null> {
    try {
      const result = await this.database.query(
        'SELECT * FROM history_exports WHERE id = $1 AND workspace_id = $2',
        [exportId, workspaceId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        requestedBy: row.requested_by,
        filters: row.filters,
        format: row.format,
        status: row.status,
        filePath: row.file_path,
        downloadUrl: row.download_url,
        expiresAt: row.expires_at,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        completedAt: row.completed_at
      };
      
    } catch (error) {
      this.logger.error('session-history', 'Failed to get export status', error as Error);
      return null;
    }
  }

  async getAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<HistoryAnalytics[]> {
    try {
      let sql = 'SELECT * FROM history_analytics WHERE workspace_id = $1';
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
        totalSessions: row.total_sessions,
        activeSessions: row.active_sessions,
        averageSessionDuration: parseFloat(row.average_session_duration) || 0,
        totalMessages: row.total_messages,
        averageMessagesPerSession: parseFloat(row.average_messages_per_session) || 0,
        sessionsByCategory: row.sessions_by_category || {},
        sessionsByPriority: row.sessions_by_priority || {},
        sessionsByAgent: row.sessions_by_agent || {},
        resolutionRates: row.resolution_rates || {
          resolved: 0,
          pending: 0,
          escalated: 0,
          unresolved: 0
        },
        topParticipants: row.top_participants || [],
        fileAttachments: row.file_attachments || {
          totalFiles: 0,
          totalSize: 0,
          averageSize: 0
        },
        searchQueries: row.search_queries || []
      }));
      
    } catch (error) {
      this.logger.error('session-history', 'Failed to get analytics', error as Error);
      return [];
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    activeSessionsCount: number;
    cachedSearchesCount: number;
    pendingExportsCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      const pendingExports = await this.database.query(
        'SELECT COUNT(*) as count FROM history_exports WHERE status IN (\'pending\', \'processing\')'
      );
      
      return {
        healthy: issues.length === 0,
        activeSessionsCount: this.activeSessions.size,
        cachedSearchesCount: this.searchCache.size,
        pendingExportsCount: parseInt(pendingExports.rows[0].count),
        issues
      };
      
    } catch (error) {
      this.logger.error('session-history', 'Health check failed', error as Error);
      return {
        healthy: false,
        activeSessionsCount: this.activeSessions.size,
        cachedSearchesCount: this.searchCache.size,
        pendingExportsCount: 0,
        issues: ['Database connection failed']
      };
    }
  }

  async destroy(): Promise<void> {
    this.activeSessions.clear();
    this.sessionCache.clear();
    this.searchCache.clear();
    
    this.logger.info('session-history', 'Session history system shut down');
  }
}

export default UltraSessionHistory;
