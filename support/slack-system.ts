import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

export interface Workspace {
  id: string;
  name: string;
  domain: string;
  description: string;
  logo?: string;
  plan: 'free' | 'pro' | 'enterprise';
  settings: WorkspaceSettings;
  owner: string; // userId
  members: WorkspaceMember[];
  channels: Channel[];
  dms: DirectMessage[];
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'suspended' | 'archived';
}

export interface WorkspaceSettings {
  allowGuestAccess: boolean;
  requireEmailVerification: boolean;
  messageRetention: number; // days
  fileUploadLimit: number; // MB
  allowExternalSharing: boolean;
  enforceMFA: boolean;
  customBranding: {
    enabled: boolean;
    primaryColor: string;
    secondaryColor: string;
    logo: string;
  };
  notifications: {
    emailEnabled: boolean;
    pushEnabled: boolean;
    soundEnabled: boolean;
  };
  security: {
    encryptMessages: boolean;
    auditLogEnabled: boolean;
    ipWhitelist: string[];
  };
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: UserRole;
  permissions: Permission[];
  status: 'active' | 'inactive' | 'suspended';
  joinedAt: Date;
  lastActive?: Date;
  timezone: string;
  language: string;
  preferences: UserPreferences;
}

export type UserRole = 'super_admin' | 'admin' | 'support_agent' | 'reseller' | 'customer';

export interface Permission {
  resource: string;
  actions: string[];
}

export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatar?: string;
  role: UserRole;
  preferences: UserPreferences;
  workspaces: string[]; // workspaceIds
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  isActive: boolean;
  metadata: Record<string, any>;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    sound: boolean;
    desktop: boolean;
  };
  language: string;
  timezone: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  doNotDisturb: boolean;
}

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  type: 'public' | 'private' | 'direct' | 'ticket';
  description?: string;
  purpose?: string;
  topic?: string;
  isArchived: boolean;
  members: ChannelMember[];
  messages: Message[];
  threads: Thread[];
  pins: Message[];
  integrations: ChannelIntegration[];
  settings: ChannelSettings;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelMember {
  id: string;
  userId: string;
  channelId: string;
  role: 'member' | 'admin' | 'moderator';
  joinedAt: Date;
  lastRead?: Date;
  notifications: 'all' | 'mentions' | 'none';
  isMuted: boolean;
}

export interface ChannelSettings {
  allowFileUploads: boolean;
  allowThreads: boolean;
  allowReactions: boolean;
  allowEditing: boolean;
  allowDeletion: boolean;
  retentionPolicy: number; // days
  guestAccess: boolean;
}

export interface DirectMessage {
  id: string;
  workspaceId: string;
  participants: string[]; // userIds
  type: 'direct' | 'group';
  name?: string; // for group DMs
  isArchived: boolean;
  messages: Message[];
  settings: DMSettings;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DMSettings {
  allowFileUploads: boolean;
  allowEditing: boolean;
  allowDeletion: boolean;
  retentionPolicy: number; // days
}

export interface Message {
  id: string;
  workspaceId: string;
  channelId?: string;
  dmId?: string;
  threadId?: string;
  senderId: string;
  type: MessageType;
  content: string;
  attachments: Attachment[];
  reactions: Reaction[];
  mentions: Mention[];
  replyCount: number;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  isPinned: boolean;
  pinnedAt?: Date;
  deliveredTo: string[]; // userIds
  readBy: string[]; // userIds
  metadata: MessageMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export type MessageType = 'text' | 'file' | 'image' | 'voice' | 'video' | 'system' | 'ticket' | 'alert';

export interface Attachment {
  id: string;
  messageId: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
  size: number;
  url: string;
  thumbnail?: string;
  metadata: FileMetadata;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface FileMetadata {
  mimeType: string;
  dimensions?: { width: number; height: number };
  duration?: number; // for audio/video
  pages?: number; // for documents
}

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface Mention {
  id: string;
  messageId: string;
  userId?: string;
  channelId?: string;
  type: 'user' | 'channel' | 'everyone' | 'here';
  createdAt: Date;
}

export interface MessageMetadata {
  ipAddress: string;
  userAgent: string;
  platform: string;
  edited: boolean;
  forwarded: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  tags: string[];
}

export interface Thread {
  id: string;
  messageId: string;
  channelId?: string;
  dmId?: string;
  messages: Message[];
  participants: string[];
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelIntegration {
  id: string;
  channelId: string;
  type: 'webhook' | 'bot' | 'api' | 'rss' | 'calendar' | 'ticket';
  name: string;
  config: IntegrationConfig;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationConfig {
  url?: string;
  token?: string;
  events: string[];
  filters: Record<string, any>;
  mappings: Record<string, string>;
}

export interface Ticket {
  id: string;
  workspaceId: string;
  channelId?: string;
  dmId?: string;
  messageId: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
  assignedTo?: string; // userId
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  tags: string[];
  attachments: Attachment[];
  notes: TicketNote[];
  metrics: TicketMetrics;
}

export interface TicketNote {
  id: string;
  ticketId: string;
  userId: string;
  content: string;
  type: 'internal' | 'public';
  createdAt: Date;
}

export interface TicketMetrics {
  firstResponseTime?: number; // minutes
  resolutionTime?: number; // minutes
  responseCount: number;
  satisfactionScore?: number;
  escalationCount: number;
}

export interface Notification {
  id: string;
  userId: string;
  workspaceId: string;
  type: 'message' | 'mention' | 'thread' | 'ticket' | 'system';
  title: string;
  content: string;
  data: any; // related data (messageId, channelId, etc.)
  isRead: boolean;
  isEmailSent: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface ActivityLog {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details: any;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export interface SearchQuery {
  query: string;
  workspaceId: string;
  userId: string;
  filters: {
    channelId?: string;
    dmId?: string;
    userId?: string;
    messageType?: MessageType;
    dateFrom?: Date;
    dateTo?: Date;
    hasAttachments?: boolean;
    isEdited?: boolean;
  };
  sort: {
    field: 'relevance' | 'date' | 'user';
    order: 'asc' | 'desc';
  };
  limit: number;
  offset: number;
}

export interface SearchResult {
  messages: Message[];
  total: number;
  took: number; // milliseconds
  suggestions: string[];
}

export interface OnlineUser {
  userId: string;
  workspaceId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  currentChannel?: string;
  currentDM?: string;
  isTyping: {
    channelId?: string;
    dmId?: string;
    timestamp: Date;
  };
}

export interface TypingIndicator {
  userId: string;
  workspaceId: string;
  channelId?: string;
  dmId?: string;
  isTyping: boolean;
  timestamp: Date;
}

export class UltraSlackSystem extends EventEmitter {
  private static instance: UltraSlackSystem;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private workspaces: Map<string, Workspace> = new Map();
  private channels: Map<string, Channel> = new Map();
  private dms: Map<string, DirectMessage> = new Map();
  private messages: Map<string, Message> = new Map();
  private tickets: Map<string, Ticket> = new Map();
  private onlineUsers: Map<string, OnlineUser> = new Map();
  private typingIndicators: Map<string, TypingIndicator> = new Map();
  private webSockets: Map<string, any> = new Map(); // userId -> WebSocket connection

  static getInstance(): UltraSlackSystem {
    if (!UltraSlackSystem.instance) {
      UltraSlackSystem.instance = new UltraSlackSystem();
    }
    return UltraSlackSystem.instance;
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
      await this.loadWorkspaces();
      await this.loadChannels();
      await this.loadDMs();
      await this.loadMessages();
      await this.loadTickets();
      this.startCleanupTasks();
      
      this.logger.info('slack-system', 'Slack-style support system initialized', {
        workspacesCount: this.workspaces.size,
        channelsCount: this.channels.size,
        dmsCount: this.dms.size,
        messagesCount: this.messages.size,
        ticketsCount: this.tickets.size
      });
    } catch (error) {
      this.logger.error('slack-system', 'Failed to initialize Slack system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        logo TEXT,
        plan VARCHAR(20) NOT NULL DEFAULT 'free',
        settings JSONB NOT NULL,
        owner VARCHAR(255) NOT NULL,
        members JSONB NOT NULL,
        channels JSONB NOT NULL,
        dms JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) NOT NULL DEFAULT 'active'
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        description TEXT,
        purpose TEXT,
        topic TEXT,
        is_archived BOOLEAN DEFAULT FALSE,
        members JSONB NOT NULL,
        messages JSONB NOT NULL,
        threads JSONB NOT NULL,
        pins JSONB NOT NULL,
        integrations JSONB NOT NULL,
        settings JSONB NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        participants JSONB NOT NULL,
        type VARCHAR(20) NOT NULL,
        name VARCHAR(255),
        is_archived BOOLEAN DEFAULT FALSE,
        messages JSONB NOT NULL,
        settings JSONB NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255),
        dm_id VARCHAR(255),
        thread_id VARCHAR(255),
        sender_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        attachments JSONB NOT NULL,
        reactions JSONB NOT NULL,
        mentions JSONB NOT NULL,
        reply_count INTEGER DEFAULT 0,
        is_edited BOOLEAN DEFAULT FALSE,
        edited_at TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE,
        deleted_at TIMESTAMP,
        is_pinned BOOLEAN DEFAULT FALSE,
        pinned_at TIMESTAMP,
        delivered_to JSONB NOT NULL,
        read_by JSONB NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id VARCHAR(255) PRIMARY KEY,
        message_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255),
        dm_id VARCHAR(255),
        messages JSONB NOT NULL,
        participants JSONB NOT NULL,
        is_resolved BOOLEAN DEFAULT FALSE,
        resolved_by VARCHAR(255),
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255),
        dm_id VARCHAR(255),
        message_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        priority VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        assigned_to VARCHAR(255),
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        tags JSONB NOT NULL,
        attachments JSONB NOT NULL,
        notes JSONB NOT NULL,
        metrics JSONB NOT NULL
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        data JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        is_email_sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        read_at TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255) NOT NULL,
        details JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_workspaces_domain ON workspaces(domain)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_channels_workspace_id ON channels(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON messages(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_messages_dm_id ON messages(dm_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_tickets_workspace_id ON tickets(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_id ON activity_logs(workspace_id)');
  }

  private async loadWorkspaces(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM workspaces');
      
      for (const row of rows) {
        const workspace: Workspace = {
          id: row.id,
          name: row.name,
          domain: row.domain,
          description: row.description,
          logo: row.logo,
          plan: row.plan,
          settings: row.settings,
          owner: row.owner,
          members: row.members || [],
          channels: row.channels || [],
          dms: row.dms || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          status: row.status
        };
        
        this.workspaces.set(workspace.id, workspace);
      }
      
      this.logger.info('slack-system', `Loaded ${this.workspaces.size} workspaces`);
    } catch (error) {
      this.logger.error('slack-system', 'Failed to load workspaces', error as Error);
    }
  }

  private async loadChannels(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM channels');
      
      for (const row of rows) {
        const channel: Channel = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          type: row.type,
          description: row.description,
          purpose: row.purpose,
          topic: row.topic,
          isArchived: row.is_archived,
          members: row.members || [],
          messages: row.messages || [],
          threads: row.threads || [],
          pins: row.pins || [],
          integrations: row.integrations || [],
          settings: row.settings,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.channels.set(channel.id, channel);
      }
      
      this.logger.info('slack-system', `Loaded ${this.channels.size} channels`);
    } catch (error) {
      this.logger.error('slack-system', 'Failed to load channels', error as Error);
    }
  }

  private async loadDMs(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM direct_messages');
      
      for (const row of rows) {
        const dm: DirectMessage = {
          id: row.id,
          workspaceId: row.workspace_id,
          participants: row.participants || [],
          type: row.type,
          name: row.name,
          isArchived: row.is_archived,
          messages: row.messages || [],
          settings: row.settings,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.dms.set(dm.id, dm);
      }
      
      this.logger.info('slack-system', `Loaded ${this.dms.size} direct messages`);
    } catch (error) {
      this.logger.error('slack-system', 'Failed to load direct messages', error as Error);
    }
  }

  private async loadMessages(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM messages ORDER BY created_at DESC LIMIT 10000');
      
      for (const row of rows) {
        const message: Message = {
          id: row.id,
          workspaceId: row.workspace_id,
          channelId: row.channel_id,
          dmId: row.dm_id,
          threadId: row.thread_id,
          senderId: row.sender_id,
          type: row.type,
          content: row.content,
          attachments: row.attachments || [],
          reactions: row.reactions || [],
          mentions: row.mentions || [],
          replyCount: row.reply_count,
          isEdited: row.is_edited,
          editedAt: row.edited_at,
          isDeleted: row.is_deleted,
          deletedAt: row.deleted_at,
          isPinned: row.is_pinned,
          pinnedAt: row.pinned_at,
          deliveredTo: row.delivered_to || [],
          readBy: row.read_by || [],
          metadata: row.metadata,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.messages.set(message.id, message);
      }
      
      this.logger.info('slack-system', `Loaded ${this.messages.size} messages`);
    } catch (error) {
      this.logger.error('slack-system', 'Failed to load messages', error as Error);
    }
  }

  private async loadTickets(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM tickets ORDER BY created_at DESC');
      
      for (const row of rows) {
        const ticket: Ticket = {
          id: row.id,
          workspaceId: row.workspace_id,
          channelId: row.channel_id,
          dmId: row.dm_id,
          messageId: row.message_id,
          title: row.title,
          description: row.description,
          category: row.category,
          priority: row.priority,
          status: row.status,
          assignedTo: row.assigned_to,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          resolvedAt: row.resolved_at,
          tags: row.tags || [],
          attachments: row.attachments || [],
          notes: row.notes || [],
          metrics: row.metrics
        };
        
        this.tickets.set(ticket.id, ticket);
      }
      
      this.logger.info('slack-system', `Loaded ${this.tickets.size} tickets`);
    } catch (error) {
      this.logger.error('slack-system', 'Failed to load tickets', error as Error);
    }
  }

  private startCleanupTasks(): void {
    // Clean up old typing indicators every minute
    setInterval(() => {
      this.cleanupTypingIndicators();
    }, 60000);

    // Clean up old notifications every hour
    setInterval(() => {
      this.cleanupOldNotifications();
    }, 3600000);

    // Update online user status every 5 minutes
    setInterval(() => {
      this.updateOnlineUserStatus();
    }, 300000);
  }

  private cleanupTypingIndicators(): void {
    const now = Date.now();
    const expired: string[] = [];
    
    for (const [key, indicator] of this.typingIndicators.entries()) {
      if (now - indicator.timestamp.getTime() > 10000) { // 10 seconds
        expired.push(key);
      }
    }
    
    for (const key of expired) {
      this.typingIndicators.delete(key);
    }
  }

  private async cleanupOldNotifications(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      await this.database.query(
        'DELETE FROM notifications WHERE created_at < $1 AND is_read = TRUE',
        [thirtyDaysAgo]
      );
    } catch (error) {
      this.logger.error('slack-system', 'Failed to cleanup old notifications', error as Error);
    }
  }

  private updateOnlineUserStatus(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    for (const [userId, user] of this.onlineUsers.entries()) {
      if (user.lastSeen.getTime() < fiveMinutesAgo && user.status !== 'offline') {
        user.status = 'offline';
        this.broadcastUserStatusChange(userId, user.workspaceId, 'offline');
      }
    }
  }

  // WORKSPACE MANAGEMENT
  async createWorkspace(config: {
    name: string;
    domain: string;
    description?: string;
    logo?: string;
    plan?: Workspace['plan'];
    owner: string;
    settings?: Partial<WorkspaceSettings>;
  }): Promise<string> {
    const workspaceId = `ws-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const workspace: Workspace = {
        id: workspaceId,
        name: config.name,
        domain: config.domain.toLowerCase(),
        description: config.description || '',
        logo: config.logo,
        plan: config.plan || 'free',
        settings: {
          allowGuestAccess: false,
          requireEmailVerification: true,
          messageRetention: 90,
          fileUploadLimit: 10,
          allowExternalSharing: false,
          enforceMFA: false,
          customBranding: {
            enabled: false,
            primaryColor: '#4A154B',
            secondaryColor: '#1264A3',
            logo: ''
          },
          notifications: {
            emailEnabled: true,
            pushEnabled: true,
            soundEnabled: true
          },
          security: {
            encryptMessages: false,
            auditLogEnabled: true,
            ipWhitelist: []
          },
          ...config.settings
        },
        owner: config.owner,
        members: [],
        channels: [],
        dms: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active'
      };

      // Add owner as super admin
      workspace.members.push({
        id: `member-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
        userId: config.owner,
        workspaceId: workspace.id,
        role: 'super_admin',
        permissions: this.getRolePermissions('super_admin'),
        status: 'active',
        joinedAt: new Date(),
        timezone: 'UTC',
        language: 'en',
        preferences: {
          theme: 'auto',
          notifications: {
            email: true,
            push: true,
            sound: true,
            desktop: true
          },
          language: 'en',
          timezone: 'UTC',
          status: 'online',
          doNotDisturb: false
        }
      });

      await this.database.query(`
        INSERT INTO workspaces (
          id, name, domain, description, logo, plan, settings,
          owner, members, channels, dms, created_at, updated_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        workspace.id,
        workspace.name,
        workspace.domain,
        workspace.description,
        workspace.logo,
        workspace.plan,
        JSON.stringify(workspace.settings),
        workspace.owner,
        JSON.stringify(workspace.members),
        JSON.stringify(workspace.channels),
        JSON.stringify(workspace.dms),
        workspace.createdAt,
        workspace.updatedAt,
        workspace.status
      ]);

      this.workspaces.set(workspaceId, workspace);

      // Create default channels
      await this.createDefaultChannels(workspaceId);

      this.logger.info('slack-system', `Workspace created: ${workspace.name}`, {
        workspaceId,
        domain: workspace.domain,
        owner: config.owner
      });

      this.emit('workspaceCreated', workspace);
      return workspaceId;

    } catch (error) {
      this.logger.error('slack-system', `Failed to create workspace: ${config.name}`, error as Error);
      throw error;
    }
  }

  private async createDefaultChannels(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return;

    const defaultChannels = [
      { name: 'general', type: 'public' as const, purpose: 'General discussion for everyone' },
      { name: 'random', type: 'public' as const, purpose: 'Random discussions and fun' },
      { name: 'support', type: 'public' as const, purpose: 'Customer support discussions' },
      { name: 'announcements', type: 'public' as const, purpose: 'Important announcements' }
    ];

    for (const channelConfig of defaultChannels) {
      await this.createChannel(workspaceId, {
        name: channelConfig.name,
        type: channelConfig.type,
        purpose: channelConfig.purpose,
        createdBy: workspace.owner
      });
    }
  }

  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    return this.workspaces.get(workspaceId) || null;
  }

  async getWorkspaceByDomain(domain: string): Promise<Workspace | null> {
    for (const workspace of this.workspaces.values()) {
      if (workspace.domain === domain.toLowerCase()) {
        return workspace;
      }
    }
    return null;
  }

  // CHANNEL MANAGEMENT
  async createChannel(workspaceId: string, config: {
    name: string;
    type: Channel['type'];
    description?: string;
    purpose?: string;
    topic?: string;
    createdBy: string;
  }): Promise<string> {
    const channelId = `ch-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const channel: Channel = {
        id: channelId,
        workspaceId,
        name: config.name.toLowerCase().replace(/\s+/g, '-'),
        type: config.type,
        description: config.description,
        purpose: config.purpose,
        topic: config.topic,
        isArchived: false,
        members: [],
        messages: [],
        threads: [],
        pins: [],
        integrations: [],
        settings: {
          allowFileUploads: true,
          allowThreads: true,
          allowReactions: true,
          allowEditing: true,
          allowDeletion: true,
          retentionPolicy: 90,
          guestAccess: false
        },
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO channels (
          id, workspace_id, name, type, description, purpose, topic,
          is_archived, members, messages, threads, pins, integrations,
          settings, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        channel.id,
        channel.workspaceId,
        channel.name,
        channel.type,
        channel.description,
        channel.purpose,
        channel.topic,
        channel.isArchived,
        JSON.stringify(channel.members),
        JSON.stringify(channel.messages),
        JSON.stringify(channel.threads),
        JSON.stringify(channel.pins),
        JSON.stringify(channel.integrations),
        JSON.stringify(channel.settings),
        channel.createdBy,
        channel.createdAt,
        channel.updatedAt
      ]);

      this.channels.set(channelId, channel);

      // Add creator as member
      await this.addChannelMember(channelId, config.createdBy, 'admin');

      this.logger.info('slack-system', `Channel created: ${channel.name}`, {
        channelId,
        workspaceId,
        type: config.type
      });

      this.emit('channelCreated', channel);
      return channelId;

    } catch (error) {
      this.logger.error('slack-system', `Failed to create channel: ${config.name}`, error as Error);
      throw error;
    }
  }

  async addChannelMember(channelId: string, userId: string, role: ChannelMember['role'] = 'member'): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (!channel) return false;

    // Check if user is already a member
    if (channel.members.some(m => m.userId === userId)) return false;

    try {
      const member: ChannelMember = {
        id: `cm-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
        userId,
        channelId,
        role,
        joinedAt: new Date(),
        notifications: 'all',
        isMuted: false
      };

      channel.members.push(member);
      channel.updatedAt = new Date();

      await this.database.query(`
        UPDATE channels 
        SET members = $1, updated_at = $2 
        WHERE id = $3
      `, [JSON.stringify(channel.members), channel.updatedAt, channel.id]);

      this.emit('channelMemberAdded', { channel, member });
      return true;

    } catch (error) {
      this.logger.error('slack-system', `Failed to add channel member: ${userId}`, error as Error);
      return false;
    }
  }

  async getChannel(channelId: string): Promise<Channel | null> {
    return this.channels.get(channelId) || null;
  }

  async getChannelsByWorkspace(workspaceId: string, userId?: string): Promise<Channel[]> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return [];

    let channels = Array.from(this.channels.values()).filter(c => c.workspaceId === workspaceId);

    // Filter by user access if userId provided
    if (userId) {
      channels = channels.filter(channel => {
        if (channel.type === 'public') return true;
        return channel.members.some(m => m.userId === userId);
      });
    }

    return channels;
  }

  // DIRECT MESSAGE MANAGEMENT
  async createDirectMessage(workspaceId: string, participants: string[], createdBy: string): Promise<string> {
    // Check if DM already exists
    const existingDM = Array.from(this.dms.values()).find(dm => 
      dm.workspaceId === workspaceId &&
      dm.participants.length === participants.length &&
      dm.participants.every(p => participants.includes(p)) &&
      dm.type === 'direct'
    );

    if (existingDM) return existingDM.id;

    const dmId = `dm-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const dm: DirectMessage = {
        id: dmId,
        workspaceId,
        participants: participants.sort(),
        type: participants.length === 2 ? 'direct' : 'group',
        isArchived: false,
        messages: [],
        settings: {
          allowFileUploads: true,
          allowEditing: true,
          allowDeletion: true,
          retentionPolicy: 90
        },
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO direct_messages (
          id, workspace_id, participants, type, is_archived,
          messages, settings, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        dm.id,
        dm.workspaceId,
        JSON.stringify(dm.participants),
        dm.type,
        dm.isArchived,
        JSON.stringify(dm.messages),
        JSON.stringify(dm.settings),
        dm.createdBy,
        dm.createdAt,
        dm.updatedAt
      ]);

      this.dms.set(dmId, dm);

      this.logger.info('slack-system', `Direct message created: ${dmId}`, {
        dmId,
        workspaceId,
        participants,
        type: dm.type
      });

      this.emit('directMessageCreated', dm);
      return dmId;

    } catch (error) {
      this.logger.error('slack-system', `Failed to create direct message`, error as Error);
      throw error;
    }
  }

  async getDirectMessage(dmId: string): Promise<DirectMessage | null> {
    return this.dms.get(dmId) || null;
  }

  async getDirectMessagesByUser(workspaceId: string, userId: string): Promise<DirectMessage[]> {
    return Array.from(this.dms.values()).filter(dm => 
      dm.workspaceId === workspaceId &&
      dm.participants.includes(userId) &&
      !dm.isArchived
    );
  }

  // MESSAGE MANAGEMENT
  async sendMessage(config: {
    workspaceId: string;
    channelId?: string;
    dmId?: string;
    senderId: string;
    type: MessageType;
    content: string;
    threadId?: string;
    attachments?: Omit<Attachment, 'id' | 'messageId' | 'uploadedAt'>[];
    mentions?: Omit<Mention, 'id' | 'createdAt'>[];
  }): Promise<string> {
    const messageId = `msg-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const message: Message = {
        id: messageId,
        workspaceId: config.workspaceId,
        channelId: config.channelId,
        dmId: config.dmId,
        threadId: config.threadId,
        senderId: config.senderId,
        type: config.type,
        content: config.content,
        attachments: config.attachments?.map(a => ({
          ...a,
          id: `att-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
          messageId,
          uploadedAt: new Date()
        })) || [],
        reactions: [],
        mentions: config.mentions?.map(m => ({
          ...m,
          id: `men-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
          createdAt: new Date()
        })) || [],
        replyCount: 0,
        isEdited: false,
        isDeleted: false,
        isPinned: false,
        deliveredTo: [],
        readBy: [config.senderId],
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'UltraSlack',
          platform: 'web',
          edited: false,
          forwarded: false,
          priority: 'normal',
          tags: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO messages (
          id, workspace_id, channel_id, dm_id, thread_id, sender_id,
          type, content, attachments, reactions, mentions, reply_count,
          is_edited, is_deleted, is_pinned, delivered_to, read_by,
          metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19, $20)
      `, [
        message.id,
        message.workspaceId,
        message.channelId,
        message.dmId,
        message.threadId,
        message.senderId,
        message.type,
        message.content,
        JSON.stringify(message.attachments),
        JSON.stringify(message.reactions),
        JSON.stringify(message.mentions),
        message.replyCount,
        message.isEdited,
        message.isDeleted,
        message.isPinned,
        JSON.stringify(message.deliveredTo),
        JSON.stringify(message.readBy),
        JSON.stringify(message.metadata),
        message.createdAt,
        message.updatedAt
      ]);

      this.messages.set(messageId, message);

      // Update channel or DM
      if (message.channelId) {
        const channel = this.channels.get(message.channelId);
        if (channel) {
          channel.messages.push(message);
          channel.updatedAt = new Date();
          await this.updateChannel(channel);
        }
      } else if (message.dmId) {
        const dm = this.dms.get(message.dmId);
        if (dm) {
          dm.messages.push(message);
          dm.updatedAt = new Date();
          await this.updateDirectMessage(dm);
        }
      }

      // Send real-time notifications
      await this.sendRealTimeMessage(message);

      // Log activity
      await this.logActivity(config.workspaceId, config.senderId, 'message_sent', 'message', messageId, {
        type: config.type,
        channelId: config.channelId,
        dmId: config.dmId
      });

      this.logger.info('slack-system', `Message sent: ${messageId}`, {
        messageId,
        workspaceId: config.workspaceId,
        channelId: config.channelId,
        dmId: config.dmId,
        senderId: config.senderId
      });

      this.emit('messageSent', message);
      return messageId;

    } catch (error) {
      this.logger.error('slack-system', `Failed to send message: ${messageId}`, error as Error);
      throw error;
    }
  }

  private async sendRealTimeMessage(message: Message): Promise<void> {
    // Get recipients
    let recipients: string[] = [];
    
    if (message.channelId) {
      const channel = this.channels.get(message.channelId);
      if (channel) {
        recipients = channel.members.map(m => m.userId).filter(id => id !== message.senderId);
      }
    } else if (message.dmId) {
      const dm = this.dms.get(message.dmId);
      if (dm) {
        recipients = dm.participants.filter(id => id !== message.senderId);
      }
    }

    // Send via WebSocket to online users
    for (const userId of recipients) {
      const ws = this.webSockets.get(userId);
      if (ws) {
        ws.send(JSON.stringify({
          type: 'message',
          data: message
        }));
      }
      
      // Mark as delivered
      message.deliveredTo.push(userId);
    }

    // Create notifications
    for (const userId of recipients) {
      await this.createNotification({
        userId,
        workspaceId: message.workspaceId,
        type: 'message',
        title: 'New Message',
        content: message.content.substring(0, 100),
        data: {
          messageId: message.id,
          channelId: message.channelId,
          dmId: message.dmId,
          senderId: message.senderId
        }
      });
    }
  }

  async getMessages(config: {
    workspaceId: string;
    channelId?: string;
    dmId?: string;
    threadId?: string;
    limit?: number;
    before?: string; // messageId
    after?: string; // messageId
  }): Promise<Message[]> {
    let messages: Message[] = [];

    if (config.threadId) {
      // Get thread messages
      const thread = await this.getThread(config.threadId);
      if (thread) {
        messages = thread.messages;
      }
    } else if (config.channelId) {
      const channel = this.channels.get(config.channelId);
      if (channel) {
        messages = channel.messages;
      }
    } else if (config.dmId) {
      const dm = this.dms.get(config.dmId);
      if (dm) {
        messages = dm.messages;
      }
    }

    // Filter by workspace
    messages = messages.filter(m => m.workspaceId === config.workspaceId && !m.isDeleted);

    // Apply pagination
    if (config.before) {
      const beforeMessage = this.messages.get(config.before);
      if (beforeMessage) {
        messages = messages.filter(m => m.createdAt < beforeMessage.createdAt);
      }
    }

    if (config.after) {
      const afterMessage = this.messages.get(config.after);
      if (afterMessage) {
        messages = messages.filter(m => m.createdAt > afterMessage.createdAt);
      }
    }

    // Sort by date (newest first)
    messages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply limit
    if (config.limit) {
      messages = messages.slice(0, config.limit);
    }

    return messages;
  }

  // THREAD MANAGEMENT
  async createThread(messageId: string): Promise<string> {
    const message = this.messages.get(messageId);
    if (!message) throw new Error('Message not found');

    const threadId = `thread-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const thread: Thread = {
        id: threadId,
        messageId,
        channelId: message.channelId,
        dmId: message.dmId,
        messages: [message],
        participants: [message.senderId],
        isResolved: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO threads (
          id, message_id, channel_id, dm_id, messages, participants,
          is_resolved, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        thread.id,
        thread.messageId,
        thread.channelId,
        thread.dmId,
        JSON.stringify(thread.messages),
        JSON.stringify(thread.participants),
        thread.isResolved,
        thread.createdAt,
        thread.updatedAt
      ]);

      // Update message with thread ID
      message.threadId = threadId;
      message.replyCount = 1;
      await this.updateMessage(message);

      this.emit('threadCreated', thread);
      return threadId;

    } catch (error) {
      this.logger.error('slack-system', `Failed to create thread: ${threadId}`, error as Error);
      throw error;
    }
  }

  async getThread(threadId: string): Promise<Thread | null> {
    try {
      const rows = await this.database.query('SELECT * FROM threads WHERE id = $1', [threadId]);
      
      if (rows.length === 0) return null;

      const row = rows[0];
      return {
        id: row.id,
        messageId: row.message_id,
        channelId: row.channel_id,
        dmId: row.dm_id,
        messages: row.messages || [],
        participants: row.participants || [],
        isResolved: row.is_resolved,
        resolvedBy: row.resolved_by,
        resolvedAt: row.resolved_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

    } catch (error) {
      this.logger.error('slack-system', `Failed to get thread: ${threadId}`, error as Error);
      return null;
    }
  }

  // TICKET MANAGEMENT
  async createTicket(config: {
    workspaceId: string;
    messageId: string;
    title: string;
    description: string;
    category: string;
    priority: Ticket['priority'];
    createdBy: string;
    tags?: string[];
  }): Promise<string> {
    const ticketId = `ticket-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const ticket: Ticket = {
        id: ticketId,
        workspaceId: config.workspaceId,
        messageId: config.messageId,
        title: config.title,
        description: config.description,
        category: config.category,
        priority: config.priority,
        status: 'open',
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: config.tags || [],
        attachments: [],
        notes: [],
        metrics: {
          responseCount: 0,
          escalationCount: 0
        }
      };

      await this.database.query(`
        INSERT INTO tickets (
          id, workspace_id, message_id, title, description, category,
          priority, status, created_by, created_at, updated_at,
          tags, attachments, notes, metrics
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        ticket.id,
        ticket.workspaceId,
        ticket.messageId,
        ticket.title,
        ticket.description,
        ticket.category,
        ticket.priority,
        ticket.status,
        ticket.createdBy,
        ticket.createdAt,
        ticket.updatedAt,
        JSON.stringify(ticket.tags),
        JSON.stringify(ticket.attachments),
        JSON.stringify(ticket.notes),
        JSON.stringify(ticket.metrics)
      ]);

      this.tickets.set(ticketId, ticket);

      // Auto-assign ticket based on category and priority
      await this.autoAssignTicket(ticket);

      this.emit('ticketCreated', ticket);
      return ticketId;

    } catch (error) {
      this.logger.error('slack-system', `Failed to create ticket: ${ticketId}`, error as Error);
      throw error;
    }
  }

  private async autoAssignTicket(ticket: Ticket): Promise<void> {
    try {
      // Find available support agents
      const workspace = this.workspaces.get(ticket.workspaceId);
      if (!workspace) return;

      const agents = workspace.members.filter(m => 
        m.role === 'support_agent' || m.role === 'admin'
      );

      if (agents.length === 0) return;

      // Simple round-robin assignment (could be enhanced with load balancing)
      const agent = agents[Math.floor(Math.random() * agents.length)];
      
      ticket.assignedTo = agent.userId;
      ticket.status = 'in_progress';
      ticket.updatedAt = new Date();

      await this.updateTicket(ticket);

      // Notify assigned agent
      await this.createNotification({
        userId: agent.userId,
        workspaceId: ticket.workspaceId,
        type: 'ticket',
        title: 'New Ticket Assigned',
        content: `Ticket "${ticket.title}" has been assigned to you`,
        data: {
          ticketId: ticket.id,
          priority: ticket.priority
        }
      });

    } catch (error) {
      this.logger.error('slack-system', `Failed to auto-assign ticket: ${ticket.id}`, error as Error);
    }
  }

  async getTicket(ticketId: string): Promise<Ticket | null> {
    return this.tickets.get(ticketId) || null;
  }

  async getTicketsByWorkspace(workspaceId: string, filters?: {
    status?: Ticket['status'];
    assignedTo?: string;
    category?: string;
    priority?: Ticket['priority'];
  }): Promise<Ticket[]> {
    let tickets = Array.from(this.tickets.values()).filter(t => t.workspaceId === workspaceId);

    if (filters) {
      if (filters.status) {
        tickets = tickets.filter(t => t.status === filters.status);
      }
      if (filters.assignedTo) {
        tickets = tickets.filter(t => t.assignedTo === filters.assignedTo);
      }
      if (filters.category) {
        tickets = tickets.filter(t => t.category === filters.category);
      }
      if (filters.priority) {
        tickets = tickets.filter(t => t.priority === filters.priority);
      }
    }

    return tickets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // SEARCH SYSTEM
  async searchMessages(query: SearchQuery): Promise<SearchResult> {
    try {
      const startTime = Date.now();
      
      // Build search query
      let sql = `
        SELECT * FROM messages 
        WHERE workspace_id = $1 
        AND is_deleted = FALSE 
        AND to_tsvector('english', content) @@ plainto_tsquery('english', $2)
      `;
      
      const params: any[] = [query.workspaceId, query.query];
      let paramIndex = 3;

      // Add filters
      if (query.filters.channelId) {
        sql += ` AND channel_id = $${paramIndex}`;
        params.push(query.filters.channelId);
        paramIndex++;
      }

      if (query.filters.dmId) {
        sql += ` AND dm_id = $${paramIndex}`;
        params.push(query.filters.dmId);
        paramIndex++;
      }

      if (query.filters.userId) {
        sql += ` AND sender_id = $${paramIndex}`;
        params.push(query.filters.userId);
        paramIndex++;
      }

      if (query.filters.messageType) {
        sql += ` AND type = $${paramIndex}`;
        params.push(query.filters.messageType);
        paramIndex++;
      }

      if (query.filters.dateFrom) {
        sql += ` AND created_at >= $${paramIndex}`;
        params.push(query.filters.dateFrom);
        paramIndex++;
      }

      if (query.filters.dateTo) {
        sql += ` AND created_at <= $${paramIndex}`;
        params.push(query.filters.dateTo);
        paramIndex++;
      }

      // Add sorting and pagination
      sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(query.limit, query.offset);

      const rows = await this.database.query(sql, params);
      
      const messages: Message[] = rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        channelId: row.channel_id,
        dmId: row.dm_id,
        threadId: row.thread_id,
        senderId: row.sender_id,
        type: row.type,
        content: row.content,
        attachments: row.attachments || [],
        reactions: row.reactions || [],
        mentions: row.mentions || [],
        replyCount: row.reply_count,
        isEdited: row.is_edited,
        editedAt: row.edited_at,
        isDeleted: row.is_deleted,
        deletedAt: row.deleted_at,
        isPinned: row.is_pinned,
        pinnedAt: row.pinned_at,
        deliveredTo: row.delivered_to || [],
        readBy: row.read_by || [],
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      // Get total count
      const countSql = sql.replace(/SELECT \* FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY.*$/, '');
      const countResult = await this.database.query(countSql, params.slice(0, -2));
      const total = parseInt(countResult.rows[0].count);

      const took = Date.now() - startTime;

      return {
        messages,
        total,
        took,
        suggestions: [] // Could implement suggestions based on common terms
      };

    } catch (error) {
      this.logger.error('slack-system', `Search failed: ${query.query}`, error as Error);
      return {
        messages: [],
        total: 0,
        took: 0,
        suggestions: []
      };
    }
  }

  // NOTIFICATION SYSTEM
  async createNotification(config: {
    userId: string;
    workspaceId: string;
    type: Notification['type'];
    title: string;
    content: string;
    data: any;
  }): Promise<string> {
    const notificationId = `notif-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const notification: Notification = {
        id: notificationId,
        userId: config.userId,
        workspaceId: config.workspaceId,
        type: config.type,
        title: config.title,
        content: config.content,
        data: config.data,
        isRead: false,
        isEmailSent: false,
        createdAt: new Date()
      };

      await this.database.query(`
        INSERT INTO notifications (
          id, user_id, workspace_id, type, title, content,
          data, is_read, is_email_sent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        notification.id,
        notification.userId,
        notification.workspaceId,
        notification.type,
        notification.title,
        notification.content,
        JSON.stringify(notification.data),
        notification.isRead,
        notification.isEmailSent,
        notification.createdAt
      ]);

      // Send real-time notification
      const ws = this.webSockets.get(config.userId);
      if (ws) {
        ws.send(JSON.stringify({
          type: 'notification',
          data: notification
        }));
      }

      this.emit('notificationCreated', notification);
      return notificationId;

    } catch (error) {
      this.logger.error('slack-system', `Failed to create notification: ${notificationId}`, error as Error);
      throw error;
    }
  }

  // USER STATUS AND TYPING INDICATORS
  async setUserOnline(userId: string, workspaceId: string, socket: any): Promise<void> {
    const onlineUser: OnlineUser = {
      userId,
      workspaceId,
      status: 'online',
      lastSeen: new Date()
    };

    this.onlineUsers.set(userId, onlineUser);
    this.webSockets.set(userId, socket);

    this.broadcastUserStatusChange(userId, workspaceId, 'online');
  }

  async setUserOffline(userId: string): Promise<void> {
    const user = this.onlineUsers.get(userId);
    if (user) {
      user.status = 'offline';
      user.lastSeen = new Date();
      
      this.broadcastUserStatusChange(userId, user.workspaceId, 'offline');
    }

    this.onlineUsers.delete(userId);
    this.webSockets.delete(userId);
  }

  async setTypingIndicator(config: {
    userId: string;
    workspaceId: string;
    channelId?: string;
    dmId?: string;
    isTyping: boolean;
  }): Promise<void> {
    const key = `${config.userId}-${config.channelId || config.dmId}`;
    
    if (config.isTyping) {
      this.typingIndicators.set(key, {
        userId: config.userId,
        workspaceId: config.workspaceId,
        channelId: config.channelId,
        dmId: config.dmId,
        isTyping: true,
        timestamp: new Date()
      });
    } else {
      this.typingIndicators.delete(key);
    }

    // Broadcast typing indicator
    this.broadcastTypingIndicator(config);
  }

  private broadcastUserStatusChange(userId: string, workspaceId: string, status: OnlineUser['status']): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return;

    const message = {
      type: 'user_status',
      data: {
        userId,
        status,
        timestamp: new Date()
      }
    };

    // Send to all online users in workspace
    for (const [onlineUserId, ws] of this.webSockets.entries()) {
      if (onlineUserId !== userId) {
        const onlineUser = this.onlineUsers.get(onlineUserId);
        if (onlineUser && onlineUser.workspaceId === workspaceId) {
          ws.send(JSON.stringify(message));
        }
      }
    }
  }

  private broadcastTypingIndicator(config: {
    userId: string;
    workspaceId: string;
    channelId?: string;
    dmId?: string;
    isTyping: boolean;
  }): void {
    const message = {
      type: 'typing_indicator',
      data: {
        userId: config.userId,
        channelId: config.channelId,
        dmId: config.dmId,
        isTyping: config.isTyping,
        timestamp: new Date()
      }
    };

    // Send to relevant users
    if (config.channelId) {
      const channel = this.channels.get(config.channelId);
      if (channel) {
        for (const member of channel.members) {
          if (member.userId !== config.userId) {
            const ws = this.webSockets.get(member.userId);
            if (ws) {
              ws.send(JSON.stringify(message));
            }
          }
        }
      }
    } else if (config.dmId) {
      const dm = this.dms.get(config.dmId);
      if (dm) {
        for (const participant of dm.participants) {
          if (participant !== config.userId) {
            const ws = this.webSockets.get(participant);
            if (ws) {
              ws.send(JSON.stringify(message));
            }
          }
        }
      }
    }
  }

  // HELPER METHODS
  private getRolePermissions(role: UserRole): Permission[] {
    const permissions: Record<UserRole, Permission[]> = {
      super_admin: [
        { resource: '*', actions: ['*'] }
      ],
      admin: [
        { resource: 'workspace', actions: ['read', 'update'] },
        { resource: 'channels', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'users', actions: ['read', 'update', 'delete'] },
        { resource: 'messages', actions: ['read', 'send', 'delete'] },
        { resource: 'tickets', actions: ['read', 'update', 'delete'] }
      ],
      support_agent: [
        { resource: 'channels', actions: ['read'] },
        { resource: 'messages', actions: ['read', 'send'] },
        { resource: 'tickets', actions: ['read', 'update'] },
        { resource: 'users', actions: ['read'] }
      ],
      reseller: [
        { resource: 'channels', actions: ['read'] },
        { resource: 'messages', actions: ['read', 'send'] },
        { resource: 'tickets', actions: ['read', 'create'] }
      ],
      customer: [
        { resource: 'channels', actions: ['read'] },
        { resource: 'messages', actions: ['read', 'send'] },
        { resource: 'tickets', actions: ['read', 'create'] }
      ]
    };

    return permissions[role] || [];
  }

  private async updateChannel(channel: Channel): Promise<void> {
    await this.database.query(`
      UPDATE channels 
      SET members = $1, messages = $2, updated_at = $3 
      WHERE id = $4
    `, [
      JSON.stringify(channel.members),
      JSON.stringify(channel.messages),
      channel.updatedAt,
      channel.id
    ]);
  }

  private async updateDirectMessage(dm: DirectMessage): Promise<void> {
    await this.database.query(`
      UPDATE direct_messages 
      SET messages = $1, updated_at = $2 
      WHERE id = $3
    `, [
      JSON.stringify(dm.messages),
      dm.updatedAt,
      dm.id
    ]);
  }

  private async updateMessage(message: Message): Promise<void> {
    await this.database.query(`
      UPDATE messages 
      SET thread_id = $1, reply_count = $2, updated_at = $3 
      WHERE id = $4
    `, [message.threadId, message.replyCount, message.updatedAt, message.id]);
  }

  private async updateTicket(ticket: Ticket): Promise<void> {
    await this.database.query(`
      UPDATE tickets 
      SET assigned_to = $1, status = $2, updated_at = $3 
      WHERE id = $4
    `, [ticket.assignedTo, ticket.status, ticket.updatedAt, ticket.id]);
  }

  private async logActivity(workspaceId: string, userId: string, action: string, resource: string, resourceId: string, details: any): Promise<void> {
    try {
      await this.database.query(`
        INSERT INTO activity_logs (
          workspace_id, user_id, action, resource, resource_id, details,
          ip_address, user_agent, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        workspaceId,
        userId,
        action,
        resource,
        resourceId,
        JSON.stringify(details),
        '127.0.0.1',
        'UltraSlack',
        new Date()
      ]);
    } catch (error) {
      this.logger.error('slack-system', 'Failed to log activity', error as Error);
    }
  }

  // PUBLIC API METHODS
  async getStats(workspaceId: string): Promise<{
    totalUsers: number;
    totalChannels: number;
    totalMessages: number;
    totalTickets: number;
    activeUsers: number;
    openTickets: number;
  }> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const channels = await this.getChannelsByWorkspace(workspaceId);
    const tickets = await this.getTicketsByWorkspace(workspaceId);
    const activeUsers = Array.from(this.onlineUsers.values())
      .filter(u => u.workspaceId === workspaceId).length;

    return {
      totalUsers: workspace.members.length,
      totalChannels: channels.length,
      totalMessages: channels.reduce((sum, ch) => sum + ch.messages.length, 0),
      totalTickets: tickets.length,
      activeUsers,
      openTickets: tickets.filter(t => t.status === 'open').length
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    workspacesCount: number;
    onlineUsersCount: number;
    activeConnections: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (this.workspaces.size === 0) {
      issues.push('No workspaces found');
    }

    return {
      healthy: issues.length === 0,
      workspacesCount: this.workspaces.size,
      onlineUsersCount: this.onlineUsers.size,
      activeConnections: this.webSockets.size,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.logger.info('slack-system', 'Slack-style support system shut down');
  }
}

export default UltraSlackSystem;
