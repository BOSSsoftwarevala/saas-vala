import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { UltraNotificationSystem } from './notification-system';
import { Message, User, Workspace, Channel } from './slack-system';
import * as crypto from 'crypto';

export interface OfflineConfig {
  id: string;
  workspaceId: string;
  isEnabled: boolean;
  storage: {
    type: 'indexeddb' | 'localstorage' | 'memory';
    maxSize: number; // MB
    encryptionEnabled: boolean;
    compressionEnabled: boolean;
  };
  sync: {
    autoSync: boolean;
    syncInterval: number; // minutes
    retryAttempts: number;
    batch_size: number;
  };
  notifications: {
    enableOfflineAlerts: boolean;
    enableSyncNotifications: boolean;
    enableStorageWarnings: boolean;
  };
  behavior: {
    queueMessages: boolean;
    allowReadOffline: boolean;
    allowWriteOffline: boolean;
    cacheMedia: boolean;
  };
  limits: {
    maxOfflineMessages: number;
    maxOfflineFiles: number;
    maxFileSize: number; // MB
    retentionDays: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineMessage {
  id: string;
  workspaceId: string;
  userId: string;
  channelId?: string;
  sessionId?: string;
  type: 'text' | 'file' | 'image' | 'voice' | 'system';
  content: string;
  metadata: {
    fileName?: string;
    fileSize?: number;
    fileUrl?: string;
    duration?: number;
    language?: string;
    priority: 'low' | 'medium' | 'high';
  };
  status: 'pending' | 'synced' | 'failed' | 'conflict';
  createdAt: Date;
  syncedAt?: Date;
  retryCount: number;
  localId: string; // For client-side tracking
}

export interface OfflineFile {
  id: string;
  workspaceId: string;
  userId: string;
  messageId: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64 encoded
  url?: string; // Remote URL when synced
  status: 'pending' | 'synced' | 'failed';
  createdAt: Date;
  syncedAt?: Date;
  localPath: string; // IndexedDB key
}

export interface SyncSession {
  id: string;
  workspaceId: string;
  userId: string;
  status: 'active' | 'completed' | 'failed' | 'paused';
  startTime: Date;
  endTime?: Date;
  stats: {
    messagesSynced: number;
    filesSynced: number;
    messagesFailed: number;
    filesFailed: number;
    bytesTransferred: number;
    duration: number; // seconds
  };
  config: {
    batchSize: number;
    retryAttempts: number;
    timeout: number;
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineAnalytics {
  workspaceId: string;
  userId: string;
  date: Date;
  storage: {
    usedSpace: number; // MB
    availableSpace: number; // MB
    messageCount: number;
    fileCount: number;
  };
  sync: {
    lastSyncTime: Date;
    syncDuration: number;
    messagesSynced: number;
    filesSynced: number;
    successRate: number;
  };
  usage: {
    messagesCreated: number;
    filesUploaded: number;
    timeSpentOffline: number; // minutes
    dataTransferred: number; // MB
  };
  performance: {
    averageSyncTime: number;
    averageUploadSpeed: number; // KB/s
    compressionRatio: number;
    cacheHitRate: number;
  };
}

export interface ConflictResolution {
  id: string;
  workspaceId: string;
  userId: string;
  itemType: 'message' | 'file';
  itemId: string;
  conflictType: 'duplicate' | 'version_mismatch' | 'data_corruption';
  localVersion: any;
  remoteVersion: any;
  resolution: 'local' | 'remote' | 'merge' | 'manual';
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UltraOfflineMode extends EventEmitter {
  private static instance: UltraOfflineMode;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  private notificationSystem: UltraNotificationSystem;
  
  private configs: Map<string, Map<string, OfflineConfig>> = new Map(); // workspaceId -> configId -> config
  private activeSyncs: Map<string, SyncSession> = new Map(); // userId -> sync session
  private isOnline = true;
  private syncInterval: NodeJS.Timeout;

  static getInstance(): UltraOfflineMode {
    if (!UltraOfflineMode.instance) {
      UltraOfflineMode.instance = new UltraOfflineMode();
    }
    return UltraOfflineMode.instance;
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
      await this.loadConfigs();
      this.startNetworkMonitoring();
      this.startAutoSync();
      
      this.logger.info('offline-mode', 'Offline mode system initialized', {
        configsCount: Array.from(this.configs.values()).reduce((sum, configs) => sum + configs.size, 0),
        activeSyncsCount: this.activeSyncs.size,
        isOnline: this.isOnline
      });
    } catch (error) {
      this.logger.error('offline-mode', 'Failed to initialize offline mode system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS offline_configs (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        is_enabled BOOLEAN DEFAULT TRUE,
        storage JSONB NOT NULL,
        sync JSONB NOT NULL,
        notifications JSONB NOT NULL,
        behavior JSONB NOT NULL,
        limits JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS offline_messages (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255),
        session_id VARCHAR(255),
        type VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        synced_at TIMESTAMP,
        retry_count INTEGER DEFAULT 0,
        local_id VARCHAR(255) NOT NULL
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS offline_files (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        size INTEGER NOT NULL,
        data TEXT NOT NULL,
        url TEXT,
        status VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        synced_at TIMESTAMP,
        local_path VARCHAR(255) NOT NULL
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS sync_sessions (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        start_time TIMESTAMP DEFAULT NOW(),
        end_time TIMESTAMP,
        stats JSONB NOT NULL,
        config JSONB NOT NULL,
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS offline_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        storage JSONB NOT NULL,
        sync JSONB NOT NULL,
        usage JSONB NOT NULL,
        performance JSONB NOT NULL,
        UNIQUE(workspace_id, user_id, date)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS conflict_resolutions (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        item_type VARCHAR(20) NOT NULL,
        item_id VARCHAR(255) NOT NULL,
        conflict_type VARCHAR(30) NOT NULL,
        local_version JSONB NOT NULL,
        remote_version JSONB NOT NULL,
        resolution VARCHAR(20) NOT NULL,
        resolved_at TIMESTAMP,
        resolved_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_offline_configs_workspace_id ON offline_configs(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_offline_messages_user_id ON offline_messages(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_offline_messages_status ON offline_messages(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_offline_files_user_id ON offline_files(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_sync_sessions_user_id ON sync_sessions(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_conflict_resolutions_user_id ON conflict_resolutions(user_id)');
  }

  private async loadConfigs(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM offline_configs ORDER BY created_at DESC');
      
      for (const row of rows) {
        const config: OfflineConfig = {
          id: row.id,
          workspaceId: row.workspace_id,
          isEnabled: row.is_enabled,
          storage: row.storage || {},
          sync: row.sync || {},
          notifications: row.notifications || {},
          behavior: row.behavior || {},
          limits: row.limits || {},
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.configs.has(config.workspaceId)) {
          this.configs.set(config.workspaceId, new Map());
        }
        this.configs.get(config.workspaceId)!.set(config.id, config);
      }
      
      this.logger.info('offline-mode', `Loaded configs for ${this.configs.size} workspaces`);
    } catch (error) {
      this.logger.error('offline-mode', 'Failed to load configs', error as Error);
    }
  }

  private startNetworkMonitoring(): void {
    // Monitor network status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.emit('online');
        this.resumeAllSyncs();
      });
      
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.emit('offline');
        this.pauseAllSyncs();
      });
    }
  }

  private startAutoSync(): void {
    this.syncInterval = setInterval(async () => {
      if (this.isOnline) {
        await this.processAutoSyncs();
      }
    }, 60 * 1000); // Check every minute
  }

  // PUBLIC API METHODS
  async createConfig(config: {
    workspaceId: string;
    storage?: OfflineConfig['storage'];
    sync?: OfflineConfig['sync'];
    notifications?: OfflineConfig['notifications'];
    behavior?: OfflineConfig['behavior'];
    limits?: OfflineConfig['limits'];
  }): Promise<string> {
    const configId = `config-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const offlineConfig: OfflineConfig = {
        id: configId,
        workspaceId: config.workspaceId,
        isEnabled: true,
        storage: config.storage || {
          type: 'indexeddb',
          maxSize: 100,
          encryptionEnabled: true,
          compressionEnabled: true
        },
        sync: config.sync || {
          autoSync: true,
          syncInterval: 5,
          retryAttempts: 3,
          batch_size: 50
        },
        notifications: config.notifications || {
          enableOfflineAlerts: true,
          enableSyncNotifications: true,
          enableStorageWarnings: true
        },
        behavior: config.behavior || {
          queueMessages: true,
          allowReadOffline: true,
          allowWriteOffline: true,
          cacheMedia: true
        },
        limits: config.limits || {
          maxOfflineMessages: 1000,
          maxOfflineFiles: 100,
          maxFileSize: 10,
          retentionDays: 30
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO offline_configs (
          id, workspace_id, is_enabled, storage, sync, notifications, behavior, limits, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        offlineConfig.id,
        offlineConfig.workspaceId,
        offlineConfig.isEnabled,
        JSON.stringify(offlineConfig.storage),
        JSON.stringify(offlineConfig.sync),
        JSON.stringify(offlineConfig.notifications),
        JSON.stringify(offlineConfig.behavior),
        JSON.stringify(offlineConfig.limits),
        offlineConfig.createdAt,
        offlineConfig.updatedAt
      ]);
      
      if (!this.configs.has(offlineConfig.workspaceId)) {
        this.configs.set(offlineConfig.workspaceId, new Map());
      }
      this.configs.get(offlineConfig.workspaceId)!.set(offlineConfig.id, offlineConfig);
      
      this.emit('configCreated', offlineConfig);
      return configId;
      
    } catch (error) {
      this.logger.error('offline-mode', `Failed to create config: ${configId}`, error as Error);
      throw error;
    }
  }

  async storeOfflineMessage(config: {
    workspaceId: string;
    userId: string;
    channelId?: string;
    sessionId?: string;
    type: OfflineMessage['type'];
    content: string;
    metadata?: OfflineMessage['metadata'];
    localId: string;
  }): Promise<string> {
    const messageId = `offline-msg-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const workspaceConfig = await this.getWorkspaceConfig(config.workspaceId);
      if (!workspaceConfig || !workspaceConfig.isEnabled || !workspaceConfig.behavior.queueMessages) {
        throw new Error('Offline mode not enabled or message queuing disabled');
      }
      
      const message: OfflineMessage = {
        id: messageId,
        workspaceId: config.workspaceId,
        userId: config.userId,
        channelId: config.channelId,
        sessionId: config.sessionId,
        type: config.type,
        content: config.content,
        metadata: config.metadata || { priority: 'medium' },
        status: 'pending',
        createdAt: new Date(),
        retryCount: 0,
        localId: config.localId
      };
      
      await this.database.query(`
        INSERT INTO offline_messages (
          id, workspace_id, user_id, channel_id, session_id, type, content,
          metadata, status, created_at, retry_count, local_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        message.id,
        message.workspaceId,
        message.userId,
        message.channelId,
        message.sessionId,
        message.type,
        message.content,
        JSON.stringify(message.metadata),
        message.status,
        message.createdAt,
        message.retryCount,
        message.localId
      ]);
      
      this.emit('messageStored', message);
      
      // Trigger sync if online and auto-sync enabled
      if (this.isOnline && workspaceConfig.sync.autoSync) {
        await this.startSync(config.userId, config.workspaceId);
      }
      
      return messageId;
      
    } catch (error) {
      this.logger.error('offline-mode', `Failed to store offline message: ${messageId}`, error as Error);
      throw error;
    }
  }

  async storeOfflineFile(config: {
    workspaceId: string;
    userId: string;
    messageId: string;
    name: string;
    type: string;
    size: number;
    data: string; // Base64 encoded
    localPath: string;
  }): Promise<string> {
    const fileId = `offline-file-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const workspaceConfig = await this.getWorkspaceConfig(config.workspaceId);
      if (!workspaceConfig || !workspaceConfig.isEnabled) {
        throw new Error('Offline mode not enabled');
      }
      
      const file: OfflineFile = {
        id: fileId,
        workspaceId: config.workspaceId,
        userId: config.userId,
        messageId: config.messageId,
        name: config.name,
        type: config.type,
        size: config.size,
        data: config.data,
        status: 'pending',
        createdAt: new Date(),
        localPath: config.localPath
      };
      
      await this.database.query(`
        INSERT INTO offline_files (
          id, workspace_id, user_id, message_id, name, type, size, data,
          status, created_at, local_path
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        file.id,
        file.workspaceId,
        file.userId,
        file.messageId,
        file.name,
        file.type,
        file.size,
        file.data,
        file.status,
        file.createdAt,
        file.localPath
      ]);
      
      this.emit('fileStored', file);
      return fileId;
      
    } catch (error) {
      this.logger.error('offline-mode', `Failed to store offline file: ${fileId}`, error as Error);
      throw error;
    }
  }

  async startSync(userId: string, workspaceId: string): Promise<string> {
    const sessionId = `sync-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const workspaceConfig = await this.getWorkspaceConfig(workspaceId);
      if (!workspaceConfig || !workspaceConfig.isEnabled) {
        throw new Error('Offline mode not enabled');
      }
      
      // Check if sync already active
      if (this.activeSyncs.has(userId)) {
        return this.activeSyncs.get(userId)!.id;
      }
      
      const syncSession: SyncSession = {
        id: sessionId,
        workspaceId,
        userId,
        status: 'active',
        startTime: new Date(),
        stats: {
          messagesSynced: 0,
          filesSynced: 0,
          messagesFailed: 0,
          filesFailed: 0,
          bytesTransferred: 0,
          duration: 0
        },
        config: {
          batchSize: workspaceConfig.sync.batch_size,
          retryAttempts: workspaceConfig.sync.retryAttempts,
          timeout: 30000
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO sync_sessions (
          id, workspace_id, user_id, status, start_time, stats, config, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        syncSession.id,
        syncSession.workspaceId,
        syncSession.userId,
        syncSession.status,
        syncSession.startTime,
        JSON.stringify(syncSession.stats),
        JSON.stringify(syncSession.config),
        syncSession.createdAt,
        syncSession.updatedAt
      ]);
      
      this.activeSyncs.set(userId, syncSession);
      
      // Start sync process
      this.processSync(userId);
      
      this.emit('syncStarted', syncSession);
      return sessionId;
      
    } catch (error) {
      this.logger.error('offline-mode', `Failed to start sync: ${sessionId}`, error as Error);
      throw error;
    }
  }

  async getOfflineMessages(userId: string, workspaceId: string, status?: OfflineMessage['status']): Promise<OfflineMessage[]> {
    try {
      let sql = 'SELECT * FROM offline_messages WHERE user_id = $1 AND workspace_id = $2';
      const params: any[] = [userId, workspaceId];
      
      if (status) {
        sql += ' AND status = $3';
        params.push(status);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      const rows = await this.database.query(sql, params);
      
      return rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        userId: row.user_id,
        channelId: row.channel_id,
        sessionId: row.session_id,
        type: row.type,
        content: row.content,
        metadata: row.metadata || {},
        status: row.status,
        createdAt: row.created_at,
        syncedAt: row.synced_at,
        retryCount: row.retry_count,
        localId: row.local_id
      }));
      
    } catch (error) {
      this.logger.error('offline-mode', 'Failed to get offline messages', error as Error);
      return [];
    }
  }

  async getOfflineFiles(userId: string, workspaceId: string): Promise<OfflineFile[]> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM offline_files WHERE user_id = $1 AND workspace_id = $2 ORDER BY created_at DESC',
        [userId, workspaceId]
      );
      
      return rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        userId: row.user_id,
        messageId: row.message_id,
        name: row.name,
        type: row.type,
        size: row.size,
        data: row.data,
        url: row.url,
        status: row.status,
        createdAt: row.created_at,
        syncedAt: row.synced_at,
        localPath: row.local_path
      }));
      
    } catch (error) {
      this.logger.error('offline-mode', 'Failed to get offline files', error as Error);
      return [];
    }
  }

  async getSyncStatus(userId: string): Promise<SyncSession | null> {
    return this.activeSyncs.get(userId) || null;
  }

  async getStorageUsage(userId: string, workspaceId: string): Promise<{
    messagesCount: number;
    filesCount: number;
    totalSize: number; // MB
    usedSpace: number; // MB
    availableSpace: number; // MB
  }> {
    try {
      const workspaceConfig = await this.getWorkspaceConfig(workspaceId);
      if (!workspaceConfig) {
        throw new Error('Workspace config not found');
      }
      
      const messageRows = await this.database.query(
        'SELECT COUNT(*) as count, OCTET_LENGTH(content) as size FROM offline_messages WHERE user_id = $1 AND workspace_id = $2',
        [userId, workspaceId]
      );
      
      const fileRows = await this.database.query(
        'SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as size FROM offline_files WHERE user_id = $1 AND workspace_id = $2',
        [userId, workspaceId]
      );
      
      const messagesCount = parseInt(messageRows.rows[0].count);
      const messagesSize = parseInt(messageRows.rows[0].size) || 0;
      const filesCount = parseInt(fileRows.rows[0].count);
      const filesSize = parseInt(fileRows.rows[0].size) || 0;
      
      const totalSize = (messagesSize + filesSize) / (1024 * 1024); // Convert to MB
      const maxSize = workspaceConfig.storage.maxSize;
      
      return {
        messagesCount,
        filesCount,
        totalSize,
        usedSpace: totalSize,
        availableSpace: Math.max(0, maxSize - totalSize)
      };
      
    } catch (error) {
      this.logger.error('offline-mode', 'Failed to get storage usage', error as Error);
      return {
        messagesCount: 0,
        filesCount: 0,
        totalSize: 0,
        usedSpace: 0,
        availableSpace: 0
      };
    }
  }

  async clearOfflineData(userId: string, workspaceId: string, type?: 'messages' | 'files' | 'all'): Promise<boolean> {
    try {
      if (!type || type === 'all' || type === 'messages') {
        await this.database.query(
          'DELETE FROM offline_messages WHERE user_id = $1 AND workspace_id = $2',
          [userId, workspaceId]
        );
      }
      
      if (!type || type === 'all' || type === 'files') {
        await this.database.query(
          'DELETE FROM offline_files WHERE user_id = $1 AND workspace_id = $2',
          [userId, workspaceId]
        );
      }
      
      this.emit('dataCleared', { userId, workspaceId, type });
      return true;
      
    } catch (error) {
      this.logger.error('offline-mode', 'Failed to clear offline data', error as Error);
      return false;
    }
  }

  async resolveConflict(config: {
    workspaceId: string;
    userId: string;
    conflictId: string;
    resolution: ConflictResolution['resolution'];
    resolvedBy?: string;
  }): Promise<boolean> {
    try {
      await this.database.query(
        'UPDATE conflict_resolutions SET resolution = $1, resolved_at = $2, resolved_by = $3, updated_at = $4 WHERE id = $5',
        [config.resolution, new Date(), config.resolvedBy, new Date(), config.conflictId]
      );
      
      this.emit('conflictResolved', { conflictId: config.conflictId, resolution: config.resolution });
      return true;
      
    } catch (error) {
      this.logger.error('offline-mode', 'Failed to resolve conflict', error as Error);
      return false;
    }
  }

  // Private helper methods
  private async getWorkspaceConfig(workspaceId: string): Promise<OfflineConfig | null> {
    const workspaceConfigs = this.configs.get(workspaceId);
    if (!workspaceConfigs || workspaceConfigs.size === 0) {
      return null;
    }
    
    // Return the first (and typically only) config for the workspace
    return Array.from(workspaceConfigs.values())[0];
  }

  private async processSync(userId: string): Promise<void> {
    const syncSession = this.activeSyncs.get(userId);
    if (!syncSession || syncSession.status !== 'active') {
      return;
    }
    
    try {
      // Get pending messages
      const messages = await this.getPendingMessages(userId, syncSession.workspaceId);
      const files = await this.getPendingFiles(userId, syncSession.workspaceId);
      
      // Process messages in batches
      for (let i = 0; i < messages.length; i += syncSession.config.batchSize) {
        const batch = messages.slice(i, i + syncSession.config.batchSize);
        await this.syncMessageBatch(batch, syncSession);
      }
      
      // Process files
      for (const file of files) {
        await this.syncFile(file, syncSession);
      }
      
      // Complete sync
      syncSession.status = 'completed';
      syncSession.endTime = new Date();
      syncSession.stats.duration = Math.floor((syncSession.endTime.getTime() - syncSession.startTime.getTime()) / 1000);
      
      await this.database.query(
        'UPDATE sync_sessions SET status = $1, end_time = $2, stats = $3, updated_at = $4 WHERE id = $5',
        [syncSession.status, syncSession.endTime, JSON.stringify(syncSession.stats), new Date(), syncSession.id]
      );
      
      this.activeSyncs.delete(userId);
      
      this.emit('syncCompleted', syncSession);
      
    } catch (error) {
      this.logger.error('offline-mode', `Sync failed for user: ${userId}`, error as Error);
      
      syncSession.status = 'failed';
      syncSession.error = error.message;
      syncSession.endTime = new Date();
      
      await this.database.query(
        'UPDATE sync_sessions SET status = $1, error = $2, end_time = $3, updated_at = $4 WHERE id = $5',
        [syncSession.status, syncSession.error, syncSession.endTime, new Date(), syncSession.id]
      );
      
      this.activeSyncs.delete(userId);
      
      this.emit('syncFailed', syncSession);
    }
  }

  private async getPendingMessages(userId: string, workspaceId: string): Promise<OfflineMessage[]> {
    const rows = await this.database.query(
      'SELECT * FROM offline_messages WHERE user_id = $1 AND workspace_id = $2 AND status = $3 ORDER BY created_at ASC',
      [userId, workspaceId, 'pending']
    );
    
    return rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      channelId: row.channel_id,
      sessionId: row.session_id,
      type: row.type,
      content: row.content,
      metadata: row.metadata || {},
      status: row.status,
      createdAt: row.created_at,
      syncedAt: row.synced_at,
      retryCount: row.retry_count,
      localId: row.local_id
    }));
  }

  private async getPendingFiles(userId: string, workspaceId: string): Promise<OfflineFile[]> {
    const rows = await this.database.query(
      'SELECT * FROM offline_files WHERE user_id = $1 AND workspace_id = $2 AND status = $3 ORDER BY created_at ASC',
      [userId, workspaceId, 'pending']
    );
    
    return rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      messageId: row.message_id,
      name: row.name,
      type: row.type,
      size: row.size,
      data: row.data,
      url: row.url,
      status: row.status,
      createdAt: row.created_at,
      syncedAt: row.synced_at,
      localPath: row.local_path
    }));
  }

  private async syncMessageBatch(messages: OfflineMessage[], syncSession: SyncSession): Promise<void> {
    for (const message of messages) {
      try {
        // Mock sync process - in production would integrate with actual messaging system
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update message status
        await this.database.query(
          'UPDATE offline_messages SET status = $1, synced_at = $2 WHERE id = $3',
          ['synced', new Date(), message.id]
        );
        
        syncSession.stats.messagesSynced++;
        syncSession.stats.bytesTransferred += message.content.length;
        
      } catch (error) {
        this.logger.error('offline-mode', `Failed to sync message: ${message.id}`, error as Error);
        
        message.retryCount++;
        if (message.retryCount >= syncSession.config.retryAttempts) {
          await this.database.query(
            'UPDATE offline_messages SET status = $1, retry_count = $2 WHERE id = $3',
            ['failed', message.retryCount, message.id]
          );
          syncSession.stats.messagesFailed++;
        }
      }
    }
  }

  private async syncFile(file: OfflineFile, syncSession: SyncSession): Promise<void> {
    try {
      // Mock file sync - in production would upload to storage service
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update file status
      await this.database.query(
        'UPDATE offline_files SET status = $1, synced_at = $2, url = $3 WHERE id = $4',
        ['synced', new Date(), `https://storage.example.com/files/${file.id}`, file.id]
      );
      
      syncSession.stats.filesSynced++;
      syncSession.stats.bytesTransferred += file.size;
      
    } catch (error) {
      this.logger.error('offline-mode', `Failed to sync file: ${file.id}`, error as Error);
      syncSession.stats.filesFailed++;
    }
  }

  private async processAutoSyncs(): Promise<void> {
    for (const [userId, config] of Array.from(this.configs.values()).flatMap(workspaceConfigs => 
      Array.from(workspaceConfigs.values()).map(config => [config.workspaceId, config] as [string, OfflineConfig])
    )) {
      if (config.isEnabled && config.sync.autoSync && this.isOnline) {
        // Check if user has pending items and no active sync
        const hasPending = await this.hasPendingItems(userId, config.workspaceId);
        if (hasPending && !this.activeSyncs.has(userId)) {
          await this.startSync(userId, config.workspaceId);
        }
      }
    }
  }

  private async hasPendingItems(userId: string, workspaceId: string): Promise<boolean> {
    const messageResult = await this.database.query(
      'SELECT COUNT(*) as count FROM offline_messages WHERE user_id = $1 AND workspace_id = $2 AND status = $3',
      [userId, workspaceId, 'pending']
    );
    
    const fileResult = await this.database.query(
      'SELECT COUNT(*) as count FROM offline_files WHERE user_id = $1 AND workspace_id = $2 AND status = $3',
      [userId, workspaceId, 'pending']
    );
    
    return parseInt(messageResult.rows[0].count) > 0 || parseInt(fileResult.rows[0].count) > 0;
  }

  private pauseAllSyncs(): void {
    for (const [userId, syncSession] of this.activeSyncs.entries()) {
      syncSession.status = 'paused';
      this.emit('syncPaused', syncSession);
    }
  }

  private resumeAllSyncs(): void {
    for (const [userId, syncSession] of this.activeSyncs.entries()) {
      if (syncSession.status === 'paused') {
        syncSession.status = 'active';
        this.processSync(userId);
        this.emit('syncResumed', syncSession);
      }
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    isOnline: boolean;
    configsCount: number;
    activeSyncsCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    return {
      healthy: issues.length === 0,
      isOnline: this.isOnline,
      configsCount: Array.from(this.configs.values()).reduce((sum, configs) => sum + configs.size, 0),
      activeSyncsCount: this.activeSyncs.size,
      issues
    };
  }

  async destroy(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.configs.clear();
    this.activeSyncs.clear();
    
    this.logger.info('offline-mode', 'Offline mode system shut down');
  }
}

export default UltraOfflineMode;
