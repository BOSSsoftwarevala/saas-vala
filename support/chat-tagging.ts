import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { Message, User, Workspace, Channel } from './slack-system';
import * as crypto from 'crypto';

export interface ChatTag {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color: string; // hex color code
  category: 'bug' | 'payment' | 'technical' | 'reseller' | 'feature' | 'urgent' | 'question' | 'feedback' | 'custom';
  isActive: boolean;
  isSystem: boolean; // system-generated vs user-created
  autoTagRules: AutoTagRule[];
  permissions: {
    canCreate: string[]; // roles that can create this tag
    canAssign: string[]; // roles that can assign this tag
    canView: string[]; // roles that can view this tag
  };
  usageCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoTagRule {
  id: string;
  condition: 'keyword' | 'pattern' | 'sender_role' | 'channel_type' | 'message_type' | 'custom';
  parameters: {
    keywords?: string[];
    pattern?: string; // regex
    senderRole?: string[];
    channelType?: string[];
    messageType?: string[];
    customCondition?: string;
  };
  confidence: number; // 0-1
  isActive: boolean;
}

export interface MessageTag {
  id: string;
  workspaceId: string;
  messageId: string;
  tagId: string;
  assignedBy: string;
  assignedAt: Date;
  confidence?: number; // for auto-tagged
  isAutoTagged: boolean;
  metadata?: Record<string, any>;
}

export interface TagAnalytics {
  workspaceId: string;
  date: Date;
  totalTags: number;
  tagsByCategory: Record<string, number>;
  topTags: Array<{
    tagId: string;
    tagName: string;
    count: number;
  }>;
  autoTaggedVsManual: {
    auto: number;
    manual: number;
  };
  tagAccuracy: {
    correct: number;
    incorrect: number;
    accuracy: number;
  };
  tagTrends: Array<{
    tagId: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
  }>;
}

export interface TagFilter {
  categories?: string[];
  tags?: string[];
  assignedBy?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  isAutoTagged?: boolean;
}

export class UltraChatTagging extends EventEmitter {
  private static instance: UltraChatTagging;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  
  private tags: Map<string, Map<string, ChatTag>> = new Map(); // workspaceId -> tagId -> tag
  private messageTags: Map<string, MessageTag[]> = new Map(); // messageId -> tags
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout;

  static getInstance(): UltraChatTagging {
    if (!UltraChatTagging.instance) {
      UltraChatTagging.instance = new UltraChatTagging();
    }
    return UltraChatTagging.instance;
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
      await this.loadTags();
      await this.loadMessageTags();
      this.startAutoTagging();
      
      this.logger.info('chat-tagging', 'Chat tagging system initialized', {
        workspacesCount: this.tags.size,
        totalTagsCount: Array.from(this.tags.values()).reduce((sum, tags) => sum + tags.size, 0),
        messageTagsCount: this.messageTags.size
      });
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to initialize chat tagging system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS chat_tags (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        color VARCHAR(7) NOT NULL,
        category VARCHAR(20) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        is_system BOOLEAN DEFAULT FALSE,
        auto_tag_rules JSONB NOT NULL,
        permissions JSONB NOT NULL,
        usage_count INTEGER DEFAULT 0,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, name)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS message_tags (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        tag_id VARCHAR(255) NOT NULL,
        assigned_by VARCHAR(255) NOT NULL,
        assigned_at TIMESTAMP DEFAULT NOW(),
        confidence DECIMAL(3,2),
        is_auto_tagged BOOLEAN DEFAULT FALSE,
        metadata JSONB,
        UNIQUE(message_id, tag_id)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS tag_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_tags INTEGER DEFAULT 0,
        tags_by_category JSONB NOT NULL,
        top_tags JSONB NOT NULL,
        auto_tagged_vs_manual JSONB NOT NULL,
        tag_accuracy JSONB NOT NULL,
        tag_trends JSONB NOT NULL,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_chat_tags_workspace_id ON chat_tags(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_chat_tags_category ON chat_tags(category)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_message_tags_workspace_id ON message_tags(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_message_tags_message_id ON message_tags(message_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_message_tags_tag_id ON message_tags(tag_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_message_tags_assigned_at ON message_tags(assigned_at)');
  }

  private async loadTags(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM chat_tags WHERE is_active = TRUE');
      
      for (const row of rows) {
        const tag: ChatTag = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          color: row.color,
          category: row.category,
          isActive: row.is_active,
          isSystem: row.is_system,
          autoTagRules: row.auto_tag_rules || [],
          permissions: row.permissions || {
            canCreate: ['admin', 'super_admin'],
            canAssign: ['admin', 'super_admin', 'support_agent'],
            canView: ['user', 'reseller', 'support_agent', 'admin', 'super_admin']
          },
          usageCount: row.usage_count,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.tags.has(tag.workspaceId)) {
          this.tags.set(tag.workspaceId, new Map());
        }
        this.tags.get(tag.workspaceId)!.set(tag.id, tag);
      }
      
      this.logger.info('chat-tagging', `Loaded tags for ${this.tags.size} workspaces`);
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to load tags', error as Error);
    }
  }

  private async loadMessageTags(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM message_tags ORDER BY assigned_at DESC LIMIT 50000');
      
      for (const row of rows) {
        const messageTag: MessageTag = {
          id: row.id,
          workspaceId: row.workspace_id,
          messageId: row.message_id,
          tagId: row.tag_id,
          assignedBy: row.assigned_by,
          assignedAt: row.assigned_at,
          confidence: row.confidence ? parseFloat(row.confidence) : undefined,
          isAutoTagged: row.is_auto_tagged,
          metadata: row.metadata
        };
        
        if (!this.messageTags.has(messageTag.messageId)) {
          this.messageTags.set(messageTag.messageId, []);
        }
        this.messageTags.get(messageTag.messageId)!.push(messageTag);
      }
      
      this.logger.info('chat-tagging', `Loaded ${this.messageTags.size} message tags`);
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to load message tags', error as Error);
    }
  }

  private startAutoTagging(): void {
    this.isProcessing = true;
    
    // Process auto-tagging every 30 seconds
    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) {
        await this.processAutoTagging();
      }
    }, 30000);
  }

  // PUBLIC API METHODS
  async createTag(config: {
    workspaceId: string;
    name: string;
    description?: string;
    color: string;
    category: ChatTag['category'];
    autoTagRules?: AutoTagRule[];
    permissions?: ChatTag['permissions'];
    createdBy: string;
    isSystem?: boolean;
  }): Promise<string> {
    const tagId = `tag-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const tag: ChatTag = {
        id: tagId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        color: config.color,
        category: config.category,
        isActive: true,
        isSystem: config.isSystem || false,
        autoTagRules: config.autoTagRules || [],
        permissions: config.permissions || {
          canCreate: ['admin', 'super_admin'],
          canAssign: ['admin', 'super_admin', 'support_agent'],
          canView: ['user', 'reseller', 'support_agent', 'admin', 'super_admin']
        },
        usageCount: 0,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO chat_tags (
          id, workspace_id, name, description, color, category, is_active, is_system,
          auto_tag_rules, permissions, usage_count, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        tag.id,
        tag.workspaceId,
        tag.name,
        tag.description,
        tag.color,
        tag.category,
        tag.isActive,
        tag.isSystem,
        JSON.stringify(tag.autoTagRules),
        JSON.stringify(tag.permissions),
        tag.usageCount,
        tag.createdBy,
        tag.createdAt,
        tag.updatedAt
      ]);
      
      if (!this.tags.has(tag.workspaceId)) {
        this.tags.set(tag.workspaceId, new Map());
      }
      this.tags.get(tag.workspaceId)!.set(tag.id, tag);
      
      this.emit('tagCreated', tag);
      return tagId;
      
    } catch (error) {
      this.logger.error('chat-tagging', `Failed to create tag: ${tagId}`, error as Error);
      throw error;
    }
  }

  async assignTag(config: {
    workspaceId: string;
    messageId: string;
    tagId: string;
    assignedBy: string;
    confidence?: number;
    isAutoTagged?: boolean;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const messageTagId = `msgtag-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      // Check permissions
      const hasPermission = await this.checkTagPermission(config.workspaceId, config.tagId, config.assignedBy, 'canAssign');
      if (!hasPermission) {
        throw new Error('User does not have permission to assign this tag');
      }
      
      // Check if tag already exists
      const existingTag = await this.database.query(
        'SELECT id FROM message_tags WHERE message_id = $1 AND tag_id = $2',
        [config.messageId, config.tagId]
      );
      
      if (existingTag.rows.length > 0) {
        return existingTag.rows[0].id;
      }
      
      const messageTag: MessageTag = {
        id: messageTagId,
        workspaceId: config.workspaceId,
        messageId: config.messageId,
        tagId: config.tagId,
        assignedBy: config.assignedBy,
        assignedAt: new Date(),
        confidence: config.confidence,
        isAutoTagged: config.isAutoTagged || false,
        metadata: config.metadata
      };
      
      await this.database.query(`
        INSERT INTO message_tags (
          id, workspace_id, message_id, tag_id, assigned_by, assigned_at, confidence, is_auto_tagged, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        messageTag.id,
        messageTag.workspaceId,
        messageTag.messageId,
        messageTag.tagId,
        messageTag.assignedBy,
        messageTag.assignedAt,
        messageTag.confidence,
        messageTag.isAutoTagged,
        JSON.stringify(messageTag.metadata)
      ]);
      
      // Update tag usage count
      await this.database.query(
        'UPDATE chat_tags SET usage_count = usage_count + 1 WHERE id = $1',
        [config.tagId]
      );
      
      // Update local cache
      if (!this.messageTags.has(messageTag.messageId)) {
        this.messageTags.set(messageTag.messageId, []);
      }
      this.messageTags.get(messageTag.messageId)!.push(messageTag);
      
      const workspaceTags = this.tags.get(config.workspaceId);
      if (workspaceTags && workspaceTags.has(config.tagId)) {
        const tag = workspaceTags.get(config.tagId)!;
        tag.usageCount++;
      }
      
      this.emit('tagAssigned', messageTag);
      return messageTagId;
      
    } catch (error) {
      this.logger.error('chat-tagging', `Failed to assign tag: ${messageTagId}`, error as Error);
      throw error;
    }
  }

  async removeTag(messageId: string, tagId: string, removedBy: string): Promise<boolean> {
    try {
      // Check permissions
      const hasPermission = await this.checkTagPermission(
        (await this.getMessageWorkspaceId(messageId)) || '',
        tagId,
        removedBy,
        'canAssign'
      );
      
      if (!hasPermission) {
        throw new Error('User does not have permission to remove this tag');
      }
      
      const result = await this.database.query(
        'DELETE FROM message_tags WHERE message_id = $1 AND tag_id = $2 RETURNING id',
        [messageId, tagId]
      );
      
      if (result.rows.length === 0) {
        return false;
      }
      
      // Update tag usage count
      await this.database.query(
        'UPDATE chat_tags SET usage_count = usage_count - 1 WHERE id = $1',
        [tagId]
      );
      
      // Update local cache
      const messageTags = this.messageTags.get(messageId);
      if (messageTags) {
        const index = messageTags.findIndex(mt => mt.tagId === tagId);
        if (index !== -1) {
          messageTags.splice(index, 1);
        }
      }
      
      this.emit('tagRemoved', { messageId, tagId, removedBy });
      return true;
      
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to remove tag', error as Error);
      return false;
    }
  }

  async getTags(workspaceId: string, filters?: {
    category?: ChatTag['category'];
    isActive?: boolean;
    isSystem?: boolean;
  }): Promise<ChatTag[]> {
    try {
      const workspaceTags = this.tags.get(workspaceId);
      if (!workspaceTags) return [];
      
      let tags = Array.from(workspaceTags.values());
      
      if (filters?.category) {
        tags = tags.filter(tag => tag.category === filters.category);
      }
      
      if (filters?.isActive !== undefined) {
        tags = tags.filter(tag => tag.isActive === filters.isActive);
      }
      
      if (filters?.isSystem !== undefined) {
        tags = tags.filter(tag => tag.isSystem === filters.isSystem);
      }
      
      return tags.sort((a, b) => b.usageCount - a.usageCount);
      
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to get tags', error as Error);
      return [];
    }
  }

  async getMessageTags(messageId: string): Promise<MessageTag[]> {
    return this.messageTags.get(messageId) || [];
  }

  async getMessagesByTag(workspaceId: string, tagId: string, filters?: {
    limit?: number;
    offset?: number;
    dateRange?: {
      start: Date;
      end: Date;
    };
  }): Promise<{ message: Message; tag: MessageTag }[]> {
    try {
      let sql = `
        SELECT mt.*, m.* FROM message_tags mt
        JOIN messages m ON mt.message_id = m.id
        WHERE mt.workspace_id = $1 AND mt.tag_id = $2
      `;
      const params: any[] = [workspaceId, tagId];
      
      if (filters?.dateRange) {
        sql += ' AND m.created_at >= $3 AND m.created_at <= $4';
        params.push(filters.dateRange.start, filters.dateRange.end);
      }
      
      sql += ' ORDER BY mt.assigned_at DESC';
      
      if (filters?.limit) {
        sql += ' LIMIT $' + (params.length + 1);
        params.push(filters.limit);
      }
      
      const rows = await this.database.query(sql, params);
      
      return rows.map(row => ({
        message: {
          id: row.message_id,
          workspaceId: row.workspace_id,
          channelId: row.channel_id,
          userId: row.user_id,
          content: row.content,
          type: row.type,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          metadata: row.metadata
        } as Message,
        tag: {
          id: row.id,
          workspaceId: row.workspace_id,
          messageId: row.message_id,
          tagId: row.tag_id,
          assignedBy: row.assigned_by,
          assignedAt: row.assigned_at,
          confidence: row.confidence,
          isAutoTagged: row.is_auto_tagged,
          metadata: row.metadata
        } as MessageTag
      }));
      
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to get messages by tag', error as Error);
      return [];
    }
  }

  async searchByTags(workspaceId: string, filter: TagFilter): Promise<Message[]> {
    try {
      let sql = `
        SELECT DISTINCT m.* FROM messages m
        JOIN message_tags mt ON m.id = mt.message_id
        JOIN chat_tags ct ON mt.tag_id = ct.id
        WHERE m.workspace_id = $1
      `;
      const params: any[] = [workspaceId];
      
      if (filter.categories && filter.categories.length > 0) {
        sql += ' AND ct.category = ANY($' + (params.length + 1) + ')';
        params.push(filter.categories);
      }
      
      if (filter.tags && filter.tags.length > 0) {
        sql += ' AND ct.id = ANY($' + (params.length + 1) + ')';
        params.push(filter.tags);
      }
      
      if (filter.assignedBy) {
        sql += ' AND mt.assigned_by = $' + (params.length + 1);
        params.push(filter.assignedBy);
      }
      
      if (filter.isAutoTagged !== undefined) {
        sql += ' AND mt.is_auto_tagged = $' + (params.length + 1);
        params.push(filter.isAutoTagged);
      }
      
      if (filter.dateRange) {
        sql += ' AND m.created_at >= $' + (params.length + 1) + ' AND m.created_at <= $' + (params.length + 2);
        params.push(filter.dateRange.start, filter.dateRange.end);
      }
      
      sql += ' ORDER BY m.created_at DESC';
      
      const rows = await this.database.query(sql, params);
      
      return rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        channelId: row.channel_id,
        userId: row.user_id,
        content: row.content,
        type: row.type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: row.metadata
      } as Message));
      
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to search by tags', error as Error);
      return [];
    }
  }

  private async processAutoTagging(): Promise<void> {
    try {
      // Get recent messages without tags
      const untaggedMessages = await this.database.query(`
        SELECT m.*, u.role as user_role, c.type as channel_type
        FROM messages m
        LEFT JOIN message_tags mt ON m.id = mt.message_id
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN channels c ON m.channel_id = c.id
        WHERE mt.message_id IS NULL 
        AND m.created_at > NOW() - INTERVAL '1 hour'
        ORDER BY m.created_at ASC
        LIMIT 100
      `);
      
      for (const message of untaggedMessages.rows) {
        await this.autoTagMessage(message);
      }
      
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to process auto-tagging', error as Error);
    }
  }

  private async autoTagMessage(message: any): Promise<void> {
    try {
      const workspaceTags = this.tags.get(message.workspace_id);
      if (!workspaceTags) return;
      
      const applicableTags: Array<{ tag: ChatTag; confidence: number }> = [];
      
      for (const tag of workspaceTags.values()) {
        if (!tag.isActive || tag.autoTagRules.length === 0) continue;
        
        for (const rule of tag.autoTagRules) {
          if (!rule.isActive) continue;
          
          const confidence = await this.evaluateAutoTagRule(rule, message);
          if (confidence > 0.7) { // High confidence threshold
            applicableTags.push({ tag, confidence });
            break; // Use first matching rule per tag
          }
        }
      }
      
      // Apply tags with highest confidence
      applicableTags.sort((a, b) => b.confidence - a.confidence);
      
      for (const { tag, confidence } of applicableTags.slice(0, 3)) { // Max 3 auto-tags per message
        await this.assignTag({
          workspaceId: message.workspace_id,
          messageId: message.id,
          tagId: tag.id,
          assignedBy: 'system',
          confidence,
          isAutoTagged: true,
          metadata: {
            autoTagged: true,
            ruleMatched: true,
            timestamp: new Date()
          }
        });
      }
      
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to auto-tag message', error as Error);
    }
  }

  private async evaluateAutoTagRule(rule: AutoTagRule, message: any): Promise<number> {
    try {
      switch (rule.condition) {
        case 'keyword':
          if (rule.parameters.keywords) {
            const content = (message.content || '').toLowerCase();
            const matchedKeywords = rule.parameters.keywords.filter((keyword: string) => 
              content.includes(keyword.toLowerCase())
            );
            return matchedKeywords.length / rule.parameters.keywords.length;
          }
          break;
          
        case 'pattern':
          if (rule.parameters.pattern) {
            const regex = new RegExp(rule.parameters.pattern, 'i');
            return regex.test(message.content || '') ? 1.0 : 0.0;
          }
          break;
          
        case 'sender_role':
          if (rule.parameters.senderRole) {
            return rule.parameters.senderRole.includes(message.user_role) ? 1.0 : 0.0;
          }
          break;
          
        case 'channel_type':
          if (rule.parameters.channelType) {
            return rule.parameters.channelType.includes(message.channel_type) ? 1.0 : 0.0;
          }
          break;
          
        case 'message_type':
          if (rule.parameters.messageType) {
            return rule.parameters.messageType.includes(message.type) ? 1.0 : 0.0;
          }
          break;
          
        case 'custom':
          // Custom condition evaluation would be implemented here
          return 0.0;
          
        default:
          return 0.0;
      }
      
      return 0.0;
      
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to evaluate auto-tag rule', error as Error);
      return 0.0;
    }
  }

  private async checkTagPermission(workspaceId: string, tagId: string, userId: string, permission: keyof ChatTag['permissions']): Promise<boolean> {
    try {
      const workspaceTags = this.tags.get(workspaceId);
      if (!workspaceTags) return false;
      
      const tag = workspaceTags.get(tagId);
      if (!tag) return false;
      
      const userRole = await this.accessControl.getUserRole(userId, workspaceId);
      if (!userRole) return false;
      
      return tag.permissions[permission].includes(userRole);
      
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to check tag permission', error as Error);
      return false;
    }
  }

  private async getMessageWorkspaceId(messageId: string): Promise<string | null> {
    try {
      const result = await this.database.query('SELECT workspace_id FROM messages WHERE id = $1', [messageId]);
      return result.rows[0]?.workspace_id || null;
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to get message workspace ID', error as Error);
      return null;
    }
  }

  async getTagAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<TagAnalytics[]> {
    try {
      let sql = 'SELECT * FROM tag_analytics WHERE workspace_id = $1';
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
        totalTags: row.total_tags,
        tagsByCategory: row.tags_by_category || {},
        topTags: row.top_tags || [],
        autoTaggedVsManual: row.auto_tagged_vs_manual || { auto: 0, manual: 0 },
        tagAccuracy: row.tag_accuracy || { correct: 0, incorrect: 0, accuracy: 0 },
        tagTrends: row.tag_trends || []
      }));
      
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to get tag analytics', error as Error);
      return [];
    }
  }

  async updateTagAnalytics(): Promise<void> {
    try {
      const workspaces = Array.from(this.tags.keys());
      
      for (const workspaceId of workspaces) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const today = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000);
        
        // Calculate analytics for the period
        const messageTagsResult = await this.database.query(`
          SELECT mt.*, ct.name as tag_name, ct.category
          FROM message_tags mt
          JOIN chat_tags ct ON mt.tag_id = ct.id
          WHERE mt.workspace_id = $1 
          AND mt.assigned_at >= $2 
          AND mt.assigned_at < $3
        `, [workspaceId, yesterday, today]);
        
        const messageTags = messageTagsResult.rows;
        
        const totalTags = messageTags.length;
        const tagsByCategory: Record<string, number> = {};
        const tagCounts: Record<string, { name: string; count: number }> = {};
        let autoCount = 0;
        let manualCount = 0;
        
        for (const mt of messageTags) {
          tagsByCategory[mt.category] = (tagsByCategory[mt.category] || 0) + 1;
          
          if (!tagCounts[mt.tag_id]) {
            tagCounts[mt.tag_id] = { name: mt.tag_name, count: 0 };
          }
          tagCounts[mt.tag_id].count++;
          
          if (mt.is_auto_tagged) {
            autoCount++;
          } else {
            manualCount++;
          }
        }
        
        const topTags = Object.entries(tagCounts)
          .map(([tagId, data]) => ({ tagId, tagName: data.name, count: data.count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
        
        const analytics: TagAnalytics = {
          workspaceId,
          date: yesterday,
          totalTags,
          tagsByCategory,
          topTags,
          autoTaggedVsManual: { auto: autoCount, manual: manualCount },
          tagAccuracy: { correct: 0, incorrect: 0, accuracy: 0 }, // Would be calculated from feedback
          tagTrends: [] // Would be calculated from historical data
        };
        
        await this.database.query(`
          INSERT INTO tag_analytics (
            workspace_id, date, total_tags, tags_by_category, top_tags,
            auto_tagged_vs_manual, tag_accuracy, tag_trends
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (workspace_id, date) DO UPDATE SET
          total_tags = EXCLUDED.total_tags,
          tags_by_category = EXCLUDED.tags_by_category,
          top_tags = EXCLUDED.top_tags,
          auto_tagged_vs_manual = EXCLUDED.auto_tagged_vs_manual
        `, [
          analytics.workspaceId,
          analytics.date,
          analytics.totalTags,
          JSON.stringify(analytics.tagsByCategory),
          JSON.stringify(analytics.topTags),
          JSON.stringify(analytics.autoTaggedVsManual),
          JSON.stringify(analytics.tagAccuracy),
          JSON.stringify(analytics.tagTrends)
        ]);
      }
      
    } catch (error) {
      this.logger.error('chat-tagging', 'Failed to update tag analytics', error as Error);
    }
  }

  async createDefaultTags(workspaceId: string, createdBy: string): Promise<void> {
    const defaultTags = [
      {
        name: 'Bug',
        description: 'Software bug or issue report',
        color: '#FF4444',
        category: 'bug' as const,
        autoTagRules: [{
          id: 'bug-keyword',
          condition: 'keyword' as const,
          parameters: { keywords: ['bug', 'error', 'issue', 'broken', 'crash', 'problem'] },
          confidence: 0.8,
          isActive: true
        }]
      },
      {
        name: 'Payment',
        description: 'Payment or billing related issue',
        color: '#FFA500',
        category: 'payment' as const,
        autoTagRules: [{
          id: 'payment-keyword',
          condition: 'keyword' as const,
          parameters: { keywords: ['payment', 'billing', 'invoice', 'charge', 'refund', 'credit card'] },
          confidence: 0.9,
          isActive: true
        }]
      },
      {
        name: 'Technical',
        description: 'Technical support request',
        color: '#4169E1',
        category: 'technical' as const,
        autoTagRules: [{
          id: 'technical-keyword',
          condition: 'keyword' as const,
          parameters: { keywords: ['technical', 'server', 'database', 'api', 'configuration', 'setup'] },
          confidence: 0.7,
          isActive: true
        }]
      },
      {
        name: 'Reseller',
        description: 'Reseller related inquiry',
        color: '#32CD32',
        category: 'reseller' as const,
        autoTagRules: [{
          id: 'reseller-role',
          condition: 'sender_role' as const,
          parameters: { senderRole: ['reseller'] },
          confidence: 1.0,
          isActive: true
        }]
      },
      {
        name: 'Urgent',
        description: 'Urgent matter requiring immediate attention',
        color: '#DC143C',
        category: 'urgent' as const,
        autoTagRules: [{
          id: 'urgent-keyword',
          condition: 'keyword' as const,
          parameters: { keywords: ['urgent', 'emergency', 'critical', 'asap', 'immediate'] },
          confidence: 0.8,
          isActive: true
        }]
      }
    ];
    
    for (const tagConfig of defaultTags) {
      try {
        await this.createTag({
          workspaceId,
          ...tagConfig,
          createdBy,
          isSystem: true
        });
      } catch (error) {
        // Tag might already exist
        this.logger.debug('chat-tagging', `Default tag ${tagConfig.name} may already exist`);
      }
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    totalTagsCount: number;
    messageTagsCount: number;
    autoTaggingActive: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!this.isProcessing) {
      issues.push('Auto-tagging is not active');
    }
    
    return {
      healthy: issues.length === 0,
      totalTagsCount: Array.from(this.tags.values()).reduce((sum, tags) => sum + tags.size, 0),
      messageTagsCount: this.messageTags.size,
      autoTaggingActive: this.isProcessing,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.logger.info('chat-tagging', 'Chat tagging system shut down');
  }
}

export default UltraChatTagging;
