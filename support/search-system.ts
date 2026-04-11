import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { Message, SearchQuery, SearchResult } from './slack-system';
import * as crypto from 'crypto';

export interface SearchIndex {
  id: string;
  workspaceId: string;
  messageId: string;
  content: string;
  tokens: string[];
  metadata: SearchMetadata;
  indexedAt: Date;
  updatedAt: Date;
}

export interface SearchMetadata {
  channelId?: string;
  dmId?: string;
  threadId?: string;
  senderId: string;
  messageType: string;
  attachments: string[];
  mentions: string[];
  tags: string[];
  timestamp: Date;
  priority: string;
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'user' | 'channel' | 'hashtag';
  count: number;
  lastUsed: Date;
}

export interface SearchHistory {
  id: string;
  userId: string;
  workspaceId: string;
  query: string;
  filters: any;
  resultCount: number;
  timestamp: Date;
}

export interface SearchAnalytics {
  workspaceId: string;
  date: Date;
  totalSearches: number;
  uniqueUsers: number;
  topQueries: Array<{
    query: string;
    count: number;
  }>;
  averageResultCount: number;
  zeroResultQueries: number;
  popularFilters: Array<{
    filter: string;
    count: number;
  }>;
}

export interface SavedSearch {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  query: string;
  filters: any;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UltraSearchSystem extends EventEmitter {
  private static instance: UltraSearchSystem;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private searchIndex: Map<string, SearchIndex> = new Map();
  private suggestions: Map<string, SearchSuggestion[]> = new Map(); // workspaceId -> suggestions
  private searchHistory: Map<string, SearchHistory[]> = new Map(); // userId -> history
  private savedSearches: Map<string, SavedSearch[]> = new Map(); // userId -> saved searches
  private stopWords: Set<string> = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'into',
    'is', 'it', 'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then',
    'there', 'these', 'they', 'this', 'to', 'was', 'will', 'with', 'i', 'you', 'me',
    'my', 'your', 'our', 'we', 'us', 'them', 'their', 'his', 'her', 'its', 'who',
    'what', 'when', 'where', 'why', 'how', 'can', 'could', 'should', 'would', 'may',
    'might', 'must', 'shall', 'do', 'does', 'did', 'have', 'has', 'had', 'am', 'is',
    'are', 'was', 'were', 'being', 'been'
  ]);

  static getInstance(): UltraSearchSystem {
    if (!UltraSearchSystem.instance) {
      UltraSearchSystem.instance = new UltraSearchSystem();
    }
    return UltraSearchSystem.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadSearchIndex();
      await this.loadSuggestions();
      await this.loadSearchHistory();
      await this.loadSavedSearches();
      this.startAnalyticsProcessor();
      
      this.logger.info('search-system', 'Search system initialized', {
        indexedMessagesCount: this.searchIndex.size,
        suggestionsCount: Array.from(this.suggestions.values()).reduce((sum, s) => sum + s.length, 0),
        historyCount: Array.from(this.searchHistory.values()).reduce((sum, h) => sum + h.length, 0),
        savedSearchesCount: Array.from(this.savedSearches.values()).reduce((sum, s) => sum + s.length, 0)
      });
    } catch (error) {
      this.logger.error('search-system', 'Failed to initialize search system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS search_index (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        tokens TEXT[] NOT NULL,
        metadata JSONB NOT NULL,
        indexed_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS search_suggestions (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        text VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        count INTEGER DEFAULT 0,
        last_used TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, text, type)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS search_history (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        query TEXT NOT NULL,
        filters JSONB,
        result_count INTEGER DEFAULT 0,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS search_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_searches INTEGER DEFAULT 0,
        unique_users INTEGER DEFAULT 0,
        top_queries JSONB NOT NULL,
        average_result_count DECIMAL(10,2),
        zero_result_queries INTEGER DEFAULT 0,
        popular_filters JSONB NOT NULL,
        UNIQUE(workspace_id, date)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS saved_searches (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        query TEXT NOT NULL,
        filters JSONB,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for better search performance
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_search_index_workspace_id ON search_index(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_search_index_message_id ON search_index(message_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_search_index_tokens ON search_index USING GIN(tokens)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_search_index_metadata ON search_index USING GIN(metadata)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_search_suggestions_workspace_id ON search_suggestions(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id)');
  }

  private async loadSearchIndex(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM search_index ORDER BY indexed_at DESC LIMIT 100000');
      
      for (const row of rows) {
        const index: SearchIndex = {
          id: row.id,
          workspaceId: row.workspace_id,
          messageId: row.message_id,
          content: row.content,
          tokens: row.tokens || [],
          metadata: row.metadata,
          indexedAt: row.indexed_at,
          updatedAt: row.updated_at
        };
        
        this.searchIndex.set(index.id, index);
      }
      
      this.logger.info('search-system', `Loaded ${this.searchIndex.size} search index entries`);
    } catch (error) {
      this.logger.error('search-system', 'Failed to load search index', error as Error);
    }
  }

  private async loadSuggestions(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM search_suggestions ORDER BY count DESC, last_used DESC');
      
      for (const row of rows) {
        const suggestion: SearchSuggestion = {
          text: row.text,
          type: row.type,
          count: row.count,
          lastUsed: row.last_used
        };
        
        if (!this.suggestions.has(row.workspace_id)) {
          this.suggestions.set(row.workspace_id, []);
        }
        this.suggestions.get(row.workspace_id)!.push(suggestion);
      }
      
      this.logger.info('search-system', `Loaded suggestions for ${this.suggestions.size} workspaces`);
    } catch (error) {
      this.logger.error('search-system', 'Failed to load search suggestions', error as Error);
    }
  }

  private async loadSearchHistory(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM search_history ORDER BY timestamp DESC');
      
      for (const row of rows) {
        const history: SearchHistory = {
          id: row.id,
          userId: row.user_id,
          workspaceId: row.workspace_id,
          query: row.query,
          filters: row.filters,
          resultCount: row.result_count,
          timestamp: row.timestamp
        };
        
        if (!this.searchHistory.has(history.userId)) {
          this.searchHistory.set(history.userId, []);
        }
        this.searchHistory.get(history.userId)!.push(history);
      }
      
      this.logger.info('search-system', `Loaded search history for ${this.searchHistory.size} users`);
    } catch (error) {
      this.logger.error('search-system', 'Failed to load search history', error as Error);
    }
  }

  private async loadSavedSearches(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM saved_searches ORDER BY updated_at DESC');
      
      for (const row of rows) {
        const savedSearch: SavedSearch = {
          id: row.id,
          userId: row.user_id,
          workspaceId: row.workspace_id,
          name: row.name,
          query: row.query,
          filters: row.filters,
          isPublic: row.is_public,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.savedSearches.has(savedSearch.userId)) {
          this.savedSearches.set(savedSearch.userId, []);
        }
        this.savedSearches.get(savedSearch.userId)!.push(savedSearch);
      }
      
      this.logger.info('search-system', `Loaded saved searches for ${this.savedSearches.size} users`);
    } catch (error) {
      this.logger.error('search-system', 'Failed to load saved searches', error as Error);
    }
  }

  private startAnalyticsProcessor(): void {
    // Update analytics every hour
    setInterval(async () => {
      await this.updateAnalytics();
    }, 60 * 60 * 1000);
  }

  private async updateAnalytics(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      // Get all workspaces
      const workspaces = await this.database.query('SELECT DISTINCT workspace_id FROM search_history WHERE timestamp >= $1', [yesterday]);
      
      for (const workspace of workspaces.rows) {
        await this.calculateWorkspaceAnalytics(workspace.workspace_id, yesterday);
      }
      
    } catch (error) {
      this.logger.error('search-system', 'Failed to update analytics', error as Error);
    }
  }

  private async calculateWorkspaceAnalytics(workspaceId: string, date: Date): Promise<void> {
    try {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Get search history for the day
      const history = await this.database.query(`
        SELECT * FROM search_history 
        WHERE workspace_id = $1 AND timestamp >= $2 AND timestamp < $3
      `, [workspaceId, date, nextDay]);
      
      const uniqueUsers = new Set(history.rows.map((h: any) => h.user_id)).size;
      const totalSearches = history.rows.length;
      const averageResultCount = history.rows.length > 0 ? 
        history.rows.reduce((sum: number, h: any) => sum + h.result_count, 0) / totalSearches : 0;
      const zeroResultQueries = history.rows.filter((h: any) => h.result_count === 0).length;
      
      // Calculate top queries
      const queryCounts = new Map<string, number>();
      for (const h of history.rows) {
        const query = h.query.toLowerCase();
        queryCounts.set(query, (queryCounts.get(query) || 0) + 1);
      }
      
      const topQueries = Array.from(queryCounts.entries())
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // Calculate popular filters
      const filterCounts = new Map<string, number>();
      for (const h of history.rows) {
        if (h.filters) {
          for (const [key, value] of Object.entries(h.filters)) {
            if (value !== undefined && value !== null) {
              const filterKey = `${key}:${value}`;
              filterCounts.set(filterKey, (filterCounts.get(filterKey) || 0) + 1);
            }
          }
        }
      }
      
      const popularFilters = Array.from(filterCounts.entries())
        .map(([filter, count]) => ({ filter, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // Store analytics
      await this.database.query(`
        INSERT INTO search_analytics (
          workspace_id, date, total_searches, unique_users, top_queries,
          average_result_count, zero_result_queries, popular_filters
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (workspace_id, date) DO UPDATE SET
        total_searches = EXCLUDED.total_searches,
        unique_users = EXCLUDED.unique_users,
        top_queries = EXCLUDED.top_queries,
        average_result_count = EXCLUDED.average_result_count,
        zero_result_queries = EXCLUDED.zero_result_queries,
        popular_filters = EXCLUDED.popular_filters
      `, [
        workspaceId,
        date,
        totalSearches,
        uniqueUsers,
        JSON.stringify(topQueries),
        averageResultCount,
        zeroResultQueries,
        JSON.stringify(popularFilters)
      ]);
      
    } catch (error) {
      this.logger.error('search-system', `Failed to calculate analytics for workspace: ${workspaceId}`, error as Error);
    }
  }

  // INDEXING METHODS
  async indexMessage(message: Message): Promise<void> {
    try {
      const indexId = `idx-${message.workspaceId}-${message.id}`;
      
      // Tokenize content
      const tokens = this.tokenizeContent(message.content);
      
      const index: SearchIndex = {
        id: indexId,
        workspaceId: message.workspaceId,
        messageId: message.id,
        content: message.content,
        tokens,
        metadata: {
          channelId: message.channelId,
          dmId: message.dmId,
          threadId: message.threadId,
          senderId: message.senderId,
          messageType: message.type,
          attachments: message.attachments.map(a => a.name),
          mentions: message.mentions.map(m => m.type),
          tags: message.metadata.tags,
          timestamp: message.createdAt,
          priority: message.metadata.priority
        },
        indexedAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO search_index (
          id, workspace_id, message_id, content, tokens, metadata, indexed_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        tokens = EXCLUDED.tokens,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
      `, [
        index.id,
        index.workspaceId,
        index.messageId,
        index.content,
        index.tokens,
        JSON.stringify(index.metadata),
        index.indexedAt,
        index.updatedAt
      ]);
      
      this.searchIndex.set(indexId, index);
      
      // Update suggestions
      await this.updateSuggestions(message.workspaceId, tokens);
      
    } catch (error) {
      this.logger.error('search-system', `Failed to index message: ${message.id}`, error as Error);
    }
  }

  private tokenizeContent(content: string): string[] {
    // Convert to lowercase and split into words
    const words = content.toLowerCase()
      .replace(/[^\w\s#@]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    // Remove stop words and filter
    return words
      .filter(word => !this.stopWords.has(word))
      .filter(word => word.length > 1)
      .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates
  }

  private async updateSuggestions(workspaceId: string, tokens: string[]): Promise<void> {
    try {
      for (const token of tokens.slice(0, 10)) { // Limit to top 10 tokens
        await this.database.query(`
          INSERT INTO search_suggestions (workspace_id, text, type, count, last_used)
          VALUES ($1, $2, $3, 1, NOW())
          ON CONFLICT (workspace_id, text, type) DO UPDATE SET
          count = search_suggestions.count + 1,
          last_used = EXCLUDED.last_used
        `, [workspaceId, token, 'query']);
      }
      
      // Update in-memory suggestions
      const workspaceSuggestions = this.suggestions.get(workspaceId) || [];
      for (const token of tokens.slice(0, 10)) {
        const existing = workspaceSuggestions.find(s => s.text === token && s.type === 'query');
        if (existing) {
          existing.count++;
          existing.lastUsed = new Date();
        } else {
          workspaceSuggestions.push({
            text: token,
            type: 'query',
            count: 1,
            lastUsed: new Date()
          });
        }
      }
      
      // Sort and keep top 100 suggestions
      workspaceSuggestions.sort((a, b) => b.count - a.count);
      this.suggestions.set(workspaceId, workspaceSuggestions.slice(0, 100));
      
    } catch (error) {
      this.logger.error('search-system', `Failed to update suggestions: ${workspaceId}`, error as Error);
    }
  }

  async removeMessageFromIndex(messageId: string, workspaceId: string): Promise<void> {
    try {
      const indexId = `idx-${workspaceId}-${messageId}`;
      
      await this.database.query('DELETE FROM search_index WHERE id = $1', [indexId]);
      this.searchIndex.delete(indexId);
      
      this.logger.debug('search-system', `Message removed from index: ${messageId}`);
      
    } catch (error) {
      this.logger.error('search-system', `Failed to remove message from index: ${messageId}`, error as Error);
    }
  }

  // SEARCH METHODS
  async search(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      // Record search in history
      await this.recordSearchHistory(query);
      
      // Build search query
      let sql = `
        SELECT si.*, m.content, m.sender_id, m.channel_id, m.dm_id, m.thread_id,
               m.type, m.created_at, m.attachments, m.mentions, m.metadata
        FROM search_index si
        JOIN messages m ON si.message_id = m.id
        WHERE si.workspace_id = $1 AND m.is_deleted = FALSE
      `;
      
      const params: any[] = [query.workspaceId];
      let paramIndex = 2;
      
      // Add text search
      if (query.query.trim()) {
        const searchTokens = this.tokenizeContent(query.query);
        if (searchTokens.length > 0) {
          sql += ` AND si.tokens && $${paramIndex}`;
          params.push(searchTokens);
          paramIndex++;
        }
      }
      
      // Add filters
      if (query.filters.channelId) {
        sql += ` AND si.metadata->>'channelId' = $${paramIndex}`;
        params.push(query.filters.channelId);
        paramIndex++;
      }
      
      if (query.filters.dmId) {
        sql += ` AND si.metadata->>'dmId' = $${paramIndex}`;
        params.push(query.filters.dmId);
        paramIndex++;
      }
      
      if (query.filters.userId) {
        sql += ` AND si.metadata->>'senderId' = $${paramIndex}`;
        params.push(query.filters.userId);
        paramIndex++;
      }
      
      if (query.filters.messageType) {
        sql += ` AND si.metadata->>'messageType' = $${paramIndex}`;
        params.push(query.filters.messageType);
        paramIndex++;
      }
      
      if (query.filters.hasAttachments) {
        if (query.filters.hasAttachments) {
          sql += ` AND jsonb_array_length(si.metadata->'attachments') > 0`;
        } else {
          sql += ` AND jsonb_array_length(si.metadata->'attachments') = 0`;
        }
      }
      
      if (query.filters.isEdited) {
        sql += ` AND m.is_edited = $${paramIndex}`;
        params.push(query.filters.isEdited);
        paramIndex++;
      }
      
      if (query.filters.dateFrom) {
        sql += ` AND m.created_at >= $${paramIndex}`;
        params.push(query.filters.dateFrom);
        paramIndex++;
      }
      
      if (query.filters.dateTo) {
        sql += ` AND m.created_at <= $${paramIndex}`;
        params.push(query.filters.dateTo);
        paramIndex++;
      }
      
      // Add sorting
      switch (query.sort.field) {
        case 'relevance':
          // Add relevance scoring based on token matches
          sql += ` ORDER BY (CASE WHEN si.content ILIKE $${paramIndex} THEN 3 WHEN si.content ILIKE $${paramIndex + 1} THEN 2 ELSE 1 END) DESC, m.created_at DESC`;
          params.push(`%${query.query}%`, `%${query.query.split(' ').join('%')}%`);
          paramIndex += 2;
          break;
        case 'date':
          sql += query.sort.order === 'asc' ? ' ORDER BY m.created_at ASC' : ' ORDER BY m.created_at DESC';
          break;
        case 'user':
          sql += ` ORDER BY m.sender_id ${query.sort.order === 'asc' ? 'ASC' : 'DESC'}, m.created_at DESC`;
          break;
        default:
          sql += ' ORDER BY m.created_at DESC';
      }
      
      // Add pagination
      sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(query.limit, query.offset);
      
      const rows = await this.database.query(sql, params);
      
      const messages: Message[] = rows.map(row => ({
        id: row.message_id,
        workspaceId: query.workspaceId,
        channelId: row.channel_id,
        dmId: row.dm_id,
        threadId: row.thread_id,
        senderId: row.sender_id,
        type: row.type,
        content: row.content,
        attachments: row.attachments || [],
        reactions: [],
        mentions: row.mentions || [],
        replyCount: 0,
        isEdited: false,
        isDeleted: false,
        isPinned: false,
        deliveredTo: [],
        readBy: [],
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.created_at
      }));
      
      // Get total count
      const countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY.*LIMIT.*$/, '');
      const countResult = await this.database.query(countSql, params.slice(0, -2));
      const total = parseInt(countResult.rows[0].count);
      
      const took = Date.now() - startTime;
      
      // Generate suggestions
      const suggestions = await this.generateSuggestions(query.workspaceId, query.query);
      
      const result: SearchResult = {
        messages,
        total,
        took,
        suggestions
      };
      
      this.emit('searchPerformed', { query, result });
      return result;
      
    } catch (error) {
      this.logger.error('search-system', `Search failed: ${query.query}`, error as Error);
      
      return {
        messages: [],
        total: 0,
        took: Date.now() - startTime,
        suggestions: []
      };
    }
  }

  private async generateSuggestions(workspaceId: string, query: string): Promise<string[]> {
    try {
      const workspaceSuggestions = this.suggestions.get(workspaceId) || [];
      const queryLower = query.toLowerCase();
      
      // Find suggestions that start with the query
      const matches = workspaceSuggestions
        .filter(s => s.text.toLowerCase().startsWith(queryLower) && s.type === 'query')
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(s => s.text);
      
      return matches;
      
    } catch (error) {
      this.logger.error('search-system', `Failed to generate suggestions: ${query}`, error as Error);
      return [];
    }
  }

  private async recordSearchHistory(query: SearchQuery): Promise<void> {
    try {
      const historyId = `hist-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      
      // We'll update the result count after the search is performed
      await this.database.query(`
        INSERT INTO search_history (
          id, user_id, workspace_id, query, filters, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        historyId,
        'system', // This would be the actual user ID
        query.workspaceId,
        query.query,
        JSON.stringify(query.filters),
        new Date()
      ]);
      
      // Update in-memory history (simplified)
      const history: SearchHistory = {
        id: historyId,
        userId: 'system',
        workspaceId: query.workspaceId,
        query: query.query,
        filters: query.filters,
        resultCount: 0, // Will be updated after search
        timestamp: new Date()
      };
      
      if (!this.searchHistory.has(history.userId)) {
        this.searchHistory.set(history.userId, []);
      }
      this.searchHistory.get(history.userId)!.unshift(history);
      
      // Keep only last 100 searches per user
      const userHistory = this.searchHistory.get(history.userId)!;
      if (userHistory.length > 100) {
        userHistory.splice(100);
      }
      
    } catch (error) {
      this.logger.error('search-system', 'Failed to record search history', error as Error);
    }
  }

  // SAVED SEARCHES
  async saveSearch(config: {
    userId: string;
    workspaceId: string;
    name: string;
    query: string;
    filters: any;
    isPublic?: boolean;
  }): Promise<string> {
    const savedSearchId = `saved-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const savedSearch: SavedSearch = {
        id: savedSearchId,
        userId: config.userId,
        workspaceId: config.workspaceId,
        name: config.name,
        query: config.query,
        filters: config.filters,
        isPublic: config.isPublic || false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO saved_searches (
          id, user_id, workspace_id, name, query, filters, is_public, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        savedSearch.id,
        savedSearch.userId,
        savedSearch.workspaceId,
        savedSearch.name,
        savedSearch.query,
        JSON.stringify(savedSearch.filters),
        savedSearch.isPublic,
        savedSearch.createdAt,
        savedSearch.updatedAt
      ]);
      
      if (!this.savedSearches.has(savedSearch.userId)) {
        this.savedSearches.set(savedSearch.userId, []);
      }
      this.savedSearches.get(savedSearch.userId)!.push(savedSearch);
      
      this.emit('searchSaved', savedSearch);
      return savedSearchId;
      
    } catch (error) {
      this.logger.error('search-system', `Failed to save search: ${config.name}`, error as Error);
      throw error;
    }
  }

  async getSavedSearches(userId: string, workspaceId: string): Promise<SavedSearch[]> {
    const userSavedSearches = this.savedSearches.get(userId) || [];
    
    // Get user's saved searches plus public ones from other users
    const allSavedSearches = userSavedSearches.filter(s => s.workspaceId === workspaceId);
    
    // Add public searches from other users (simplified)
    for (const [otherUserId, searches] of this.savedSearches.entries()) {
      if (otherUserId !== userId) {
        const publicSearches = searches.filter(s => 
          s.workspaceId === workspaceId && s.isPublic
        );
        allSavedSearches.push(...publicSearches);
      }
    }
    
    return allSavedSearches.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async deleteSavedSearch(savedSearchId: string, userId: string): Promise<boolean> {
    const userSavedSearches = this.savedSearches.get(userId) || [];
    const searchIndex = userSavedSearches.findIndex(s => s.id === savedSearchId);
    
    if (searchIndex === -1) return false;
    
    try {
      await this.database.query('DELETE FROM saved_searches WHERE id = $1 AND user_id = $2', [savedSearchId, userId]);
      
      userSavedSearches.splice(searchIndex, 1);
      
      this.emit('searchDeleted', { savedSearchId, userId });
      return true;
      
    } catch (error) {
      this.logger.error('search-system', `Failed to delete saved search: ${savedSearchId}`, error as Error);
      return false;
    }
  }

  // SEARCH HISTORY
  async getSearchHistory(userId: string, workspaceId: string, limit: number = 50): Promise<SearchHistory[]> {
    const userHistory = this.searchHistory.get(userId) || [];
    return userHistory
      .filter(h => h.workspaceId === workspaceId)
      .slice(0, limit);
  }

  async clearSearchHistory(userId: string, workspaceId?: string): Promise<boolean> {
    try {
      let sql = 'DELETE FROM search_history WHERE user_id = $1';
      const params: any[] = [userId];
      
      if (workspaceId) {
        sql += ' AND workspace_id = $2';
        params.push(workspaceId);
      }
      
      await this.database.query(sql, params);
      
      // Update in-memory history
      const userHistory = this.searchHistory.get(userId) || [];
      if (workspaceId) {
        const filtered = userHistory.filter(h => h.workspaceId !== workspaceId);
        this.searchHistory.set(userId, filtered);
      } else {
        this.searchHistory.delete(userId);
      }
      
      return true;
      
    } catch (error) {
      this.logger.error('search-system', `Failed to clear search history: ${userId}`, error as Error);
      return false;
    }
  }

  // ANALYTICS
  async getSearchAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<SearchAnalytics[]> {
    try {
      let sql = 'SELECT * FROM search_analytics WHERE workspace_id = $1';
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
        totalSearches: row.total_searches,
        uniqueUsers: row.unique_users,
        topQueries: row.top_queries || [],
        averageResultCount: parseFloat(row.average_result_count) || 0,
        zeroResultQueries: row.zero_result_queries,
        popularFilters: row.popular_filters || []
      }));
      
    } catch (error) {
      this.logger.error('search-system', `Failed to get search analytics: ${workspaceId}`, error as Error);
      return [];
    }
  }

  async getSuggestions(workspaceId: string, type?: SearchSuggestion['type'], limit: number = 20): Promise<SearchSuggestion[]> {
    const workspaceSuggestions = this.suggestions.get(workspaceId) || [];
    
    let filtered = workspaceSuggestions;
    if (type) {
      filtered = workspaceSuggestions.filter(s => s.type === type);
    }
    
    return filtered
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // UTILITY METHODS
  async reindexWorkspace(workspaceId: string): Promise<void> {
    try {
      this.logger.info('search-system', `Starting reindex for workspace: ${workspaceId}`);
      
      // Clear existing index
      await this.database.query('DELETE FROM search_index WHERE workspace_id = $1', [workspaceId]);
      
      // Get all messages for workspace
      const messages = await this.database.query(`
        SELECT * FROM messages 
        WHERE workspace_id = $1 AND is_deleted = FALSE 
        ORDER BY created_at ASC
      `, [workspaceId]);
      
      // Index messages in batches
      const batchSize = 1000;
      for (let i = 0; i < messages.rows.length; i += batchSize) {
        const batch = messages.rows.slice(i, i + batchSize);
        
        for (const messageRow of batch) {
          const message: Message = {
            id: messageRow.id,
            workspaceId: messageRow.workspace_id,
            channelId: messageRow.channel_id,
            dmId: messageRow.dm_id,
            threadId: messageRow.thread_id,
            senderId: messageRow.sender_id,
            type: messageRow.type,
            content: messageRow.content,
            attachments: messageRow.attachments || [],
            reactions: [],
            mentions: messageRow.mentions || [],
            replyCount: messageRow.reply_count,
            isEdited: messageRow.is_edited,
            isDeleted: messageRow.is_deleted,
            isPinned: messageRow.is_pinned,
            deliveredTo: messageRow.delivered_to || [],
            readBy: messageRow.read_by || [],
            metadata: messageRow.metadata,
            createdAt: messageRow.created_at,
            updatedAt: messageRow.updated_at
          };
          
          await this.indexMessage(message);
        }
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.logger.info('search-system', `Reindex completed for workspace: ${workspaceId}`);
      
    } catch (error) {
      this.logger.error('search-system', `Failed to reindex workspace: ${workspaceId}`, error as Error);
      throw error;
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    indexedMessagesCount: number;
    suggestionsCount: number;
    searchHistoryCount: number;
    savedSearchesCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (this.searchIndex.size === 0) {
      issues.push('No indexed messages found');
    }
    
    return {
      healthy: issues.length === 0,
      indexedMessagesCount: this.searchIndex.size,
      suggestionsCount: Array.from(this.suggestions.values()).reduce((sum, s) => sum + s.length, 0),
      searchHistoryCount: Array.from(this.searchHistory.values()).reduce((sum, h) => sum + h.length, 0),
      savedSearchesCount: Array.from(this.savedSearches.values()).reduce((sum, s) => sum + s.length, 0),
      issues
    };
  }

  async destroy(): Promise<void> {
    this.logger.info('search-system', 'Search system shut down');
  }
}

export default UltraSearchSystem;
