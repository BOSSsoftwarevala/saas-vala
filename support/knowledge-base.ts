import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { UltraAISupport } from './ai-support';
import { Message, User, Workspace } from './slack-system';
import * as crypto from 'crypto';

export interface KnowledgeArticle {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  tags: string[];
  language: string;
  status: 'draft' | 'published' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  author: string;
  lastUpdatedBy: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  searchTerms: string[];
  relatedArticles: string[];
  attachments: KnowledgeAttachment[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface KnowledgeAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface SuggestionRule {
  id: string;
  workspaceId: string;
  name: string;
  isActive: boolean;
  conditions: SuggestionCondition[];
  filters: SuggestionFilter[];
  maxSuggestions: number;
  confidenceThreshold: number;
  cooldownPeriod: number; // minutes
  priority: number;
}

export interface SuggestionCondition {
  type: 'keyword' | 'category' | 'intent' | 'language' | 'user_role' | 'custom';
  parameters: {
    keywords?: string[];
    category?: string[];
    intent?: string[];
    language?: string[];
    userRole?: string[];
    customCondition?: string;
  };
  weight: number; // 0-1
}

export interface SuggestionFilter {
  type: 'category' | 'tags' | 'language' | 'date_range' | 'popularity' | 'custom';
  parameters: {
    categories?: string[];
    tags?: string[];
    languages?: string[];
    dateRange?: { start: Date; end: Date };
    minPopularity?: number;
    customFilter?: string;
  };
}

export interface ArticleSuggestion {
  articleId: string;
  title: string;
  summary: string;
  relevanceScore: number;
  matchReasons: string[];
  confidence: number;
  suggestedAt: Date;
  messageId: string;
  userId: string;
  viewed: boolean;
  helpful?: boolean;
}

export interface KnowledgeAnalytics {
  workspaceId: string;
  date: Date;
  totalViews: number;
  uniqueViewers: number;
  topArticles: Array<{
    articleId: string;
    title: string;
    views: number;
    helpfulRating: number;
  }>;
  searchQueries: Array<{
    query: string;
    count: number;
    avgRelevanceScore: number;
  }>;
  suggestions: {
    totalSuggestions: number;
    clickedSuggestions: number;
    ctr: number; // click-through rate
    avgConfidence: number;
  };
  contentGaps: Array<{
    topic: string;
    searchCount: number;
    noResultsCount: number;
    suggestedArticles: number;
  }>;
}

export class UltraKnowledgeBase extends EventEmitter {
  private static instance: UltraKnowledgeBase;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  private aiSupport: UltraAISupport;
  
  private articles: Map<string, Map<string, KnowledgeArticle>> = new Map(); // workspaceId -> articleId -> article
  private suggestionRules: Map<string, SuggestionRule[]> = new Map(); // workspaceId -> rules
  private activeSuggestions: Map<string, ArticleSuggestion[]> = new Map(); // messageId -> suggestions
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout;

  static getInstance(): UltraKnowledgeBase {
    if (!UltraKnowledgeBase.instance) {
      UltraKnowledgeBase.instance = new UltraKnowledgeBase();
    }
    return UltraKnowledgeBase.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.accessControl = UltraAccessControl.getInstance();
    this.aiSupport = UltraAISupport.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadArticles();
      await this.loadSuggestionRules();
      await this.loadActiveSuggestions();
      this.startSuggestionProcessing();
      
      this.logger.info('knowledge-base', 'Knowledge base system initialized', {
        workspacesCount: this.articles.size,
        totalArticlesCount: Array.from(this.articles.values()).reduce((sum, articles) => sum + articles.size, 0),
        suggestionRulesCount: Array.from(this.suggestionRules.values()).reduce((sum, rules) => sum + rules.length, 0)
      });
    } catch (error) {
      this.logger.error('knowledge-base', 'Failed to initialize knowledge base system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS knowledge_articles (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        category VARCHAR(100),
        tags TEXT[],
        language VARCHAR(10) DEFAULT 'en',
        status VARCHAR(20) DEFAULT 'draft',
        priority VARCHAR(10) DEFAULT 'medium',
        author VARCHAR(255) NOT NULL,
        last_updated_by VARCHAR(255) NOT NULL,
        view_count INTEGER DEFAULT 0,
        helpful_count INTEGER DEFAULT 0,
        not_helpful_count INTEGER DEFAULT 0,
        search_terms TEXT[],
        related_articles TEXT[],
        attachments JSONB NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        published_at TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS suggestion_rules (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        conditions JSONB NOT NULL,
        filters JSONB NOT NULL,
        max_suggestions INTEGER DEFAULT 3,
        confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
        cooldown_period INTEGER DEFAULT 30,
        priority INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS article_suggestions (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        article_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        summary TEXT,
        relevance_score DECIMAL(3,2) NOT NULL,
        match_reasons TEXT[],
        confidence DECIMAL(3,2) NOT NULL,
        suggested_at TIMESTAMP DEFAULT NOW(),
        viewed BOOLEAN DEFAULT FALSE,
        helpful BOOLEAN,
        UNIQUE(article_id, message_id, user_id)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS knowledge_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_views INTEGER DEFAULT 0,
        unique_viewers INTEGER DEFAULT 0,
        top_articles JSONB NOT NULL,
        search_queries JSONB NOT NULL,
        suggestions JSONB NOT NULL,
        content_gaps JSONB NOT NULL,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_knowledge_articles_workspace_id ON knowledge_articles(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_knowledge_articles_status ON knowledge_articles(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON knowledge_articles(category)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_knowledge_articles_tags ON knowledge_articles USING GIN(tags)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_article_suggestions_message_id ON article_suggestions(message_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_article_suggestions_user_id ON article_suggestions(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_article_suggestions_suggested_at ON article_suggestions(suggested_at)');
  }

  private async loadArticles(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM knowledge_articles WHERE status = \'published\' ORDER BY created_at DESC');
      
      for (const row of rows) {
        const article: KnowledgeArticle = {
          id: row.id,
          workspaceId: row.workspace_id,
          title: row.title,
          content: row.content,
          summary: row.summary,
          category: row.category,
          tags: row.tags || [],
          language: row.language,
          status: row.status,
          priority: row.priority,
          author: row.author,
          lastUpdatedBy: row.last_updated_by,
          viewCount: row.view_count,
          helpfulCount: row.helpful_count,
          notHelpfulCount: row.not_helpful_count,
          searchTerms: row.search_terms || [],
          relatedArticles: row.related_articles || [],
          attachments: row.attachments || [],
          metadata: row.metadata || {},
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          publishedAt: row.published_at
        };
        
        if (!this.articles.has(article.workspaceId)) {
          this.articles.set(article.workspaceId, new Map());
        }
        this.articles.get(article.workspaceId)!.set(article.id, article);
      }
      
      this.logger.info('knowledge-base', `Loaded articles for ${this.articles.size} workspaces`);
    } catch (error) {
      this.logger.error('knowledge-base', 'Failed to load articles', error as Error);
    }
  }

  private async loadSuggestionRules(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM suggestion_rules WHERE is_active = TRUE ORDER BY priority DESC');
      
      for (const row of rows) {
        const rule: SuggestionRule = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          isActive: row.is_active,
          conditions: row.conditions || [],
          filters: row.filters || [],
          maxSuggestions: row.max_suggestions,
          confidenceThreshold: parseFloat(row.confidence_threshold),
          cooldownPeriod: row.cooldown_period,
          priority: row.priority
        };
        
        if (!this.suggestionRules.has(rule.workspaceId)) {
          this.suggestionRules.set(rule.workspaceId, []);
        }
        this.suggestionRules.get(rule.workspaceId)!.push(rule);
      }
      
      this.logger.info('knowledge-base', `Loaded suggestion rules for ${this.suggestionRules.size} workspaces`);
    } catch (error) {
      this.logger.error('knowledge-base', 'Failed to load suggestion rules', error as Error);
    }
  }

  private async loadActiveSuggestions(): Promise<void> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM article_suggestions WHERE suggested_at > NOW() - INTERVAL \'24 hours\' ORDER BY suggested_at DESC LIMIT 10000'
      );
      
      for (const row of rows) {
        const suggestion: ArticleSuggestion = {
          articleId: row.article_id,
          title: row.title,
          summary: row.summary,
          relevanceScore: parseFloat(row.relevance_score),
          matchReasons: row.match_reasons || [],
          confidence: parseFloat(row.confidence),
          suggestedAt: row.suggested_at,
          messageId: row.message_id,
          userId: row.user_id,
          viewed: row.viewed,
          helpful: row.helpful
        };
        
        if (!this.activeSuggestions.has(suggestion.messageId)) {
          this.activeSuggestions.set(suggestion.messageId, []);
        }
        this.activeSuggestions.get(suggestion.messageId)!.push(suggestion);
      }
      
      this.logger.info('knowledge-base', `Loaded ${this.activeSuggestions.size} active suggestion sets`);
    } catch (error) {
      this.logger.error('knowledge-base', 'Failed to load active suggestions', error as Error);
    }
  }

  private startSuggestionProcessing(): void {
    this.isProcessing = true;
    
    // Process suggestions every 60 seconds
    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) {
        await this.processPendingSuggestions();
      }
    }, 60000);
  }

  // PUBLIC API METHODS
  async createArticle(config: {
    workspaceId: string;
    title: string;
    content: string;
    summary?: string;
    category?: string;
    tags?: string[];
    language?: string;
    priority?: KnowledgeArticle['priority'];
    author: string;
    attachments?: KnowledgeAttachment[];
    metadata?: Record<string, any>;
  }): Promise<string> {
    const articleId = `article-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const article: KnowledgeArticle = {
        id: articleId,
        workspaceId: config.workspaceId,
        title: config.title,
        content: config.content,
        summary: config.summary || this.generateSummary(config.content),
        category: config.category || 'general',
        tags: config.tags || [],
        language: config.language || 'en',
        status: 'draft',
        priority: config.priority || 'medium',
        author: config.author,
        lastUpdatedBy: config.author,
        viewCount: 0,
        helpfulCount: 0,
        notHelpfulCount: 0,
        searchTerms: this.extractSearchTerms(config.title, config.content, config.tags),
        relatedArticles: [],
        attachments: config.attachments || [],
        metadata: config.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO knowledge_articles (
          id, workspace_id, title, content, summary, category, tags, language,
          status, priority, author, last_updated_by, search_terms, attachments, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        article.id,
        article.workspaceId,
        article.title,
        article.content,
        article.summary,
        article.category,
        article.tags,
        article.language,
        article.status,
        article.priority,
        article.author,
        article.lastUpdatedBy,
        article.searchTerms,
        JSON.stringify(article.attachments),
        JSON.stringify(article.metadata),
        article.createdAt,
        article.updatedAt
      ]);
      
      if (!this.articles.has(article.workspaceId)) {
        this.articles.set(article.workspaceId, new Map());
      }
      this.articles.get(article.workspaceId)!.set(article.id, article);
      
      this.emit('articleCreated', article);
      return articleId;
      
    } catch (error) {
      this.logger.error('knowledge-base', `Failed to create article: ${articleId}`, error as Error);
      throw error;
    }
  }

  async publishArticle(articleId: string, publishedBy: string): Promise<boolean> {
    try {
      const result = await this.database.query(
        'UPDATE knowledge_articles SET status = \'published\', published_at = NOW(), last_updated_by = $1 WHERE id = $2 RETURNING workspace_id',
        [publishedBy, articleId]
      );
      
      if (result.rows.length === 0) {
        return false;
      }
      
      const workspaceId = result.rows[0].workspace_id;
      const workspaceArticles = this.articles.get(workspaceId);
      
      if (workspaceArticles && workspaceArticles.has(articleId)) {
        const article = workspaceArticles.get(articleId)!;
        article.status = 'published';
        article.publishedAt = new Date();
        article.lastUpdatedBy = publishedBy;
      }
      
      this.emit('articlePublished', { articleId, publishedBy });
      return true;
      
    } catch (error) {
      this.logger.error('knowledge-base', `Failed to publish article: ${articleId}`, error as Error);
      return false;
    }
  }

  async searchArticles(workspaceId: string, query: string, filters?: {
    category?: string;
    tags?: string[];
    language?: string;
    limit?: number;
  }): Promise<Array<KnowledgeArticle & { relevanceScore: number }>> {
    try {
      const workspaceArticles = this.articles.get(workspaceId);
      if (!workspaceArticles) return [];
      
      let articles = Array.from(workspaceArticles.values()).filter(article => article.status === 'published');
      
      // Apply filters
      if (filters?.category) {
        articles = articles.filter(article => article.category === filters.category);
      }
      
      if (filters?.tags && filters.tags.length > 0) {
        articles = articles.filter(article => 
          filters.tags!.some(tag => article.tags.includes(tag))
        );
      }
      
      if (filters?.language) {
        articles = articles.filter(article => article.language === filters.language);
      }
      
      // Calculate relevance scores
      const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
      
      const scoredArticles = articles.map(article => {
        let score = 0;
        const titleLower = article.title.toLowerCase();
        const contentLower = article.content.toLowerCase();
        const summaryLower = (article.summary || '').toLowerCase();
        
        // Title matches (highest weight)
        queryTerms.forEach(term => {
          if (titleLower.includes(term)) {
            score += 3;
          }
        });
        
        // Summary matches (medium weight)
        queryTerms.forEach(term => {
          if (summaryLower.includes(term)) {
            score += 2;
          }
        });
        
        // Content matches (lower weight)
        queryTerms.forEach(term => {
          if (contentLower.includes(term)) {
            score += 1;
          }
        });
        
        // Tag matches
        article.tags.forEach(tag => {
          if (tag.toLowerCase().includes(query.toLowerCase())) {
            score += 2;
          }
        });
        
        // Category match
        if (article.category && article.category.toLowerCase().includes(query.toLowerCase())) {
          score += 2;
        }
        
        // Search terms match
        article.searchTerms.forEach(term => {
          if (term.toLowerCase().includes(query.toLowerCase())) {
            score += 1;
          }
        });
        
        // Normalize score
        const maxPossibleScore = queryTerms.length * 5;
        const relevanceScore = maxPossibleScore > 0 ? score / maxPossibleScore : 0;
        
        return { ...article, relevanceScore };
      });
      
      // Sort by relevance score and limit results
      scoredArticles.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      if (filters?.limit) {
        return scoredArticles.slice(0, filters.limit);
      }
      
      return scoredArticles;
      
    } catch (error) {
      this.logger.error('knowledge-base', 'Failed to search articles', error as Error);
      return [];
    }
  }

  async getSuggestions(messageId: string, userId: string, workspaceId: string, messageContent: string): Promise<ArticleSuggestion[]> {
    try {
      // Check if suggestions already exist for this message
      const existingSuggestions = this.activeSuggestions.get(messageId);
      if (existingSuggestions && existingSuggestions.length > 0) {
        return existingSuggestions;
      }
      
      // Get applicable suggestion rules
      const rules = this.suggestionRules.get(workspaceId) || [];
      if (rules.length === 0) {
        return [];
      }
      
      const suggestions: ArticleSuggestion[] = [];
      
      for (const rule of rules) {
        if (!rule.isActive) continue;
        
        // Check if rule conditions match
        const conditionsMet = await this.evaluateSuggestionConditions(rule.conditions, {
          messageContent,
          userId,
          workspaceId
        });
        
        if (!conditionsMet) continue;
        
        // Find matching articles
        const matchingArticles = await this.findMatchingArticles(rule, workspaceId, messageContent);
        
        // Create suggestions
        for (const { article, relevanceScore, matchReasons } of matchingArticles.slice(0, rule.maxSuggestions)) {
          if (relevanceScore >= rule.confidenceThreshold) {
            const suggestion: ArticleSuggestion = {
              articleId: article.id,
              title: article.title,
              summary: article.summary,
              relevanceScore,
              matchReasons,
              confidence: Math.min(relevanceScore, 1.0),
              suggestedAt: new Date(),
              messageId,
              userId,
              viewed: false
            };
            
            suggestions.push(suggestion);
            
            // Save to database
            await this.saveSuggestion(suggestion);
          }
        }
      }
      
      // Store in memory
      this.activeSuggestions.set(messageId, suggestions);
      
      // Emit suggestions event
      if (suggestions.length > 0) {
        this.emit('suggestionsGenerated', { messageId, userId, suggestions });
      }
      
      return suggestions;
      
    } catch (error) {
      this.logger.error('knowledge-base', 'Failed to get suggestions', error as Error);
      return [];
    }
  }

  private async evaluateSuggestionConditions(conditions: SuggestionCondition[], context: {
    messageContent: string;
    userId: string;
    workspaceId: string;
  }): Promise<boolean> {
    try {
      for (const condition of conditions) {
        let met = false;
        
        switch (condition.type) {
          case 'keyword':
            if (condition.parameters.keywords) {
              met = condition.parameters.keywords.some(keyword => 
                context.messageContent.toLowerCase().includes(keyword.toLowerCase())
              );
            }
            break;
            
          case 'intent':
            // Would use AI to detect intent
            met = false;
            break;
            
          case 'language':
            // Would detect message language
            met = false;
            break;
            
          case 'user_role':
            if (condition.parameters.userRole) {
              const userRole = await this.accessControl.getUserRole(context.userId, context.workspaceId);
              met = userRole ? condition.parameters.userRole.includes(userRole) : false;
            }
            break;
            
          default:
            met = false;
        }
        
        if (met && condition.weight > 0.5) {
          return true;
        }
      }
      
      return false;
      
    } catch (error) {
      this.logger.error('knowledge-base', 'Failed to evaluate suggestion conditions', error as Error);
      return false;
    }
  }

  private async findMatchingArticles(rule: SuggestionRule, workspaceId: string, messageContent: string): Promise<Array<{
    article: KnowledgeArticle;
    relevanceScore: number;
    matchReasons: string[];
  }>> {
    try {
      const workspaceArticles = this.articles.get(workspaceId);
      if (!workspaceArticles) return [];
      
      const articles = Array.from(workspaceArticles.values()).filter(article => article.status === 'published');
      const matches: Array<{ article: KnowledgeArticle; relevanceScore: number; matchReasons: string[] }> = [];
      
      for (const article of articles) {
        let relevanceScore = 0;
        const matchReasons: string[] = [];
        
        // Apply filters
        let passesFilters = true;
        
        for (const filter of rule.filters) {
          switch (filter.type) {
            case 'category':
              if (filter.parameters.categories && !filter.parameters.categories.includes(article.category)) {
                passesFilters = false;
              }
              break;
              
            case 'tags':
              if (filter.parameters.tags && filter.parameters.tags.length > 0) {
                const hasMatchingTag = filter.parameters.tags.some(tag => article.tags.includes(tag));
                if (!hasMatchingTag) passesFilters = false;
              }
              break;
              
            case 'language':
              if (filter.parameters.languages && !filter.parameters.languages.includes(article.language)) {
                passesFilters = false;
              }
              break;
              
            case 'popularity':
              if (filter.parameters.minPopularity && article.viewCount < filter.parameters.minPopularity) {
                passesFilters = false;
              }
              break;
          }
          
          if (!passesFilters) break;
        }
        
        if (!passesFilters) continue;
        
        // Calculate relevance
        const messageLower = messageContent.toLowerCase();
        const titleLower = article.title.toLowerCase();
        const contentLower = article.content.toLowerCase();
        
        // Title matches
        if (titleLower.includes(messageLower) || messageLower.includes(titleLower)) {
          relevanceScore += 0.8;
          matchReasons.push('Title match');
        }
        
        // Content matches
        const words = messageLower.split(' ').filter(word => word.length > 3);
        const contentMatches = words.filter(word => contentLower.includes(word)).length;
        if (contentMatches > 0) {
          relevanceScore += (contentMatches / words.length) * 0.5;
          matchReasons.push(`Content match (${contentMatches} words)`);
        }
        
        // Tag matches
        const tagMatches = article.tags.filter(tag => 
          messageLower.includes(tag.toLowerCase())
        ).length;
        if (tagMatches > 0) {
          relevanceScore += tagMatches * 0.2;
          matchReasons.push(`Tag match (${tagMatches} tags)`);
        }
        
        // Category match
        if (article.category.toLowerCase().includes(messageLower)) {
          relevanceScore += 0.3;
          matchReasons.push('Category match');
        }
        
        // Search terms match
        const searchTermMatches = article.searchTerms.filter(term => 
          messageLower.includes(term.toLowerCase())
        ).length;
        if (searchTermMatches > 0) {
          relevanceScore += searchTermMatches * 0.1;
          matchReasons.push(`Search term match (${searchTermMatches} terms)`);
        }
        
        if (relevanceScore > 0) {
          matches.push({ article, relevanceScore: Math.min(relevanceScore, 1.0), matchReasons });
        }
      }
      
      // Sort by relevance score
      matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      return matches;
      
    } catch (error) {
      this.logger.error('knowledge-base', 'Failed to find matching articles', error as Error);
      return [];
    }
  }

  private async saveSuggestion(suggestion: ArticleSuggestion): Promise<void> {
    try {
      await this.database.query(`
        INSERT INTO article_suggestions (
          id, workspace_id, article_id, message_id, user_id, title, summary,
          relevance_score, match_reasons, confidence, suggested_at, viewed, helpful
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (article_id, message_id, user_id) DO UPDATE SET
        relevance_score = EXCLUDED.relevance_score,
        confidence = EXCLUDED.confidence,
        suggested_at = EXCLUDED.suggested_at
      `, [
        `suggestion-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
        suggestion.articleId.substring(0, 8), // Extract workspace from article (simplified)
        suggestion.articleId,
        suggestion.messageId,
        suggestion.userId,
        suggestion.title,
        suggestion.summary,
        suggestion.relevanceScore,
        suggestion.matchReasons,
        suggestion.confidence,
        suggestion.suggestedAt,
        suggestion.viewed,
        suggestion.helpful
      ]);
      
    } catch (error) {
      this.logger.error('knowledge-base', 'Failed to save suggestion', error as Error);
    }
  }

  async markSuggestionViewed(suggestionId: string, userId: string): Promise<boolean> {
    try {
      await this.database.query(
        'UPDATE article_suggestions SET viewed = TRUE WHERE article_id = $1 AND user_id = $2',
        [suggestionId, userId]
      );
      
      // Increment article view count
      await this.database.query(
        'UPDATE knowledge_articles SET view_count = view_count + 1 WHERE id = $1',
        [suggestionId]
      );
      
      // Update local cache
      for (const [messageId, suggestions] of this.activeSuggestions.entries()) {
        const suggestion = suggestions.find(s => s.articleId === suggestionId && s.userId === userId);
        if (suggestion) {
          suggestion.viewed = true;
        }
      }
      
      // Update article view count in cache
      for (const [workspaceId, articles] of this.articles.entries()) {
        const article = articles.get(suggestionId);
        if (article) {
          article.viewCount++;
        }
      }
      
      this.emit('suggestionViewed', { suggestionId, userId });
      return true;
      
    } catch (error) {
      this.logger.error('knowledge-base', 'Failed to mark suggestion as viewed', error as Error);
      return false;
    }
  }

  async rateSuggestion(suggestionId: string, userId: string, helpful: boolean): Promise<boolean> {
    try {
      await this.database.query(
        'UPDATE article_suggestions SET helpful = $1 WHERE article_id = $2 AND user_id = $3',
        [helpful, suggestionId, userId]
      );
      
      // Update article helpful count
      const field = helpful ? 'helpful_count' : 'not_helpful_count';
      await this.database.query(
        `UPDATE knowledge_articles SET ${field} = ${field} + 1 WHERE id = $1`,
        [suggestionId]
      );
      
      // Update local cache
      for (const [messageId, suggestions] of this.activeSuggestions.entries()) {
        const suggestion = suggestions.find(s => s.articleId === suggestionId && s.userId === userId);
        if (suggestion) {
          suggestion.helpful = helpful;
        }
      }
      
      // Update article counts in cache
      for (const [workspaceId, articles] of this.articles.entries()) {
        const article = articles.get(suggestionId);
        if (article) {
          if (helpful) {
            article.helpfulCount++;
          } else {
            article.notHelpfulCount++;
          }
        }
      }
      
      this.emit('suggestionRated', { suggestionId, userId, helpful });
      return true;
      
    } catch (error) {
      this.logger.error('knowledge-base', 'Failed to rate suggestion', error as Error);
      return false;
    }
  }

  private generateSummary(content: string): string {
    // Simple summary generation - would use AI in production
    const sentences = content.split('.').filter(s => s.trim().length > 0);
    return sentences.slice(0, 2).join('. ').trim() + (sentences.length > 2 ? '...' : '');
  }

  private extractSearchTerms(title: string, content: string, tags: string[]): string[] {
    const terms = new Set<string>();
    
    // Extract from title
    title.toLowerCase().split(' ').forEach(word => {
      if (word.length > 3) terms.add(word);
    });
    
    // Extract from content (first 200 chars)
    content.substring(0, 200).toLowerCase().split(' ').forEach(word => {
      if (word.length > 3) terms.add(word);
    });
    
    // Add tags
    tags.forEach(tag => terms.add(tag.toLowerCase()));
    
    return Array.from(terms);
  }

  private async processPendingSuggestions(): Promise<void> {
    try {
      // This would process any pending suggestion requests
      // For now, we'll just clean up old suggestions
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      for (const [messageId, suggestions] of this.activeSuggestions.entries()) {
        const recentSuggestions = suggestions.filter(s => s.suggestedAt > cutoff);
        
        if (recentSuggestions.length === 0) {
          this.activeSuggestions.delete(messageId);
        } else {
          this.activeSuggestions.set(messageId, recentSuggestions);
        }
      }
      
    } catch (error) {
      this.logger.error('knowledge-base', 'Failed to process pending suggestions', error as Error);
    }
  }

  async createSuggestionRule(config: {
    workspaceId: string;
    name: string;
    conditions: SuggestionCondition[];
    filters: SuggestionFilter[];
    maxSuggestions?: number;
    confidenceThreshold?: number;
    cooldownPeriod?: number;
    priority?: number;
  }): Promise<string> {
    const ruleId = `rule-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const rule: SuggestionRule = {
        id: ruleId,
        workspaceId: config.workspaceId,
        name: config.name,
        isActive: true,
        conditions: config.conditions,
        filters: config.filters,
        maxSuggestions: config.maxSuggestions || 3,
        confidenceThreshold: config.confidenceThreshold || 0.7,
        cooldownPeriod: config.cooldownPeriod || 30,
        priority: config.priority || 0
      };
      
      await this.database.query(`
        INSERT INTO suggestion_rules (
          id, workspace_id, name, is_active, conditions, filters,
          max_suggestions, confidence_threshold, cooldown_period, priority, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      `, [
        rule.id,
        rule.workspaceId,
        rule.name,
        rule.isActive,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.filters),
        rule.maxSuggestions,
        rule.confidenceThreshold,
        rule.cooldownPeriod,
        rule.priority
      ]);
      
      if (!this.suggestionRules.has(rule.workspaceId)) {
        this.suggestionRules.set(rule.workspaceId, []);
      }
      this.suggestionRules.get(rule.workspaceId)!.push(rule);
      
      this.emit('suggestionRuleCreated', rule);
      return ruleId;
      
    } catch (error) {
      this.logger.error('knowledge-base', `Failed to create suggestion rule: ${ruleId}`, error as Error);
      throw error;
    }
  }

  async getAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<KnowledgeAnalytics[]> {
    try {
      let sql = 'SELECT * FROM knowledge_analytics WHERE workspace_id = $1';
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
        totalViews: row.total_views,
        uniqueViewers: row.unique_viewers,
        topArticles: row.top_articles || [],
        searchQueries: row.search_queries || [],
        suggestions: row.suggestions || { totalSuggestions: 0, clickedSuggestions: 0, ctr: 0, avgConfidence: 0 },
        contentGaps: row.content_gaps || []
      }));
      
    } catch (error) {
      this.logger.error('knowledge-base', 'Failed to get analytics', error as Error);
      return [];
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    totalArticlesCount: number;
    suggestionRulesCount: number;
    activeSuggestionsCount: number;
    suggestionProcessingActive: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!this.isProcessing) {
      issues.push('Suggestion processing is not active');
    }
    
    return {
      healthy: issues.length === 0,
      totalArticlesCount: Array.from(this.articles.values()).reduce((sum, articles) => sum + articles.size, 0),
      suggestionRulesCount: Array.from(this.suggestionRules.values()).reduce((sum, rules) => sum + rules.length, 0),
      activeSuggestionsCount: this.activeSuggestions.size,
      suggestionProcessingActive: this.isProcessing,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.logger.info('knowledge-base', 'Knowledge base system shut down');
  }
}

export default UltraKnowledgeBase;
