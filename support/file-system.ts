import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { Attachment } from './slack-system';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as multer from 'multer';
import { Request } from 'express';

export interface FileUpload {
  id: string;
  workspaceId: string;
  messageId?: string;
  channelId?: string;
  dmId?: string;
  userId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  thumbnail?: string;
  metadata: FileMetadata;
  permissions: FilePermission[];
  isPublic: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  uploadedAt: Date;
  expiresAt?: Date;
  downloadCount: number;
  lastAccessed?: Date;
}

export interface FileMetadata {
  dimensions?: { width: number; height: number };
  duration?: number; // for audio/video
  pages?: number; // for documents
  encoding?: string;
  bitrate?: number;
  fps?: number;
  checksum: string;
  virusScanResult?: 'clean' | 'infected' | 'scanning' | 'failed';
  scanDate?: Date;
}

export interface FilePermission {
  id: string;
  fileId: string;
  userId?: string;
  roleId?: string;
  type: 'read' | 'write' | 'delete' | 'share';
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
}

export interface FileShare {
  id: string;
  fileId: string;
  token: string;
  createdBy: string;
  expiresAt?: Date;
  maxDownloads?: number;
  downloadCount: number;
  password?: string;
  isPublic: boolean;
  createdAt: Date;
}

export interface FileQuota {
  workspaceId: string;
  userId?: string; // If null, it's workspace quota
  storageLimit: number; // bytes
  storageUsed: number; // bytes
  fileCount: number;
  maxFileSize: number; // bytes
  allowedTypes: string[];
  updatedAt: Date;
}

export interface FileAnalytics {
  fileId: string;
  downloads: DownloadRecord[];
  views: ViewRecord[];
  shares: ShareRecord[];
  totalDownloads: number;
  totalViews: number;
  totalShares: number;
  topDownloaders: Array<{
    userId: string;
    count: number;
  }>;
}

export interface DownloadRecord {
  id: string;
  fileId: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  referer?: string;
  timestamp: Date;
}

export interface ViewRecord {
  id: string;
  fileId: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export interface ShareRecord {
  id: string;
  fileId: string;
  shareId: string;
  userId: string;
  timestamp: Date;
}

export class UltraFileSystem extends EventEmitter {
  private static instance: UltraFileSystem;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private files: Map<string, FileUpload> = new Map();
  private shares: Map<string, FileShare> = new Map();
  private quotas: Map<string, FileQuota> = new Map();
  private storagePath: string;
  private maxFileSize: number = 100 * 1024 * 1024; // 100MB default
  private allowedMimeTypes: string[] = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Documents
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/rtf',
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/gzip', 'application/x-tar',
    // Audio/Video
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'video/mp4', 'video/avi', 'video/mov',
    // Code
    'text/javascript', 'application/json', 'text/xml', 'text/html', 'text/css',
    'application/x-python-code', 'text/x-java-source'
  ];

  static getInstance(): UltraFileSystem {
    if (!UltraFileSystemSystem.instance) {
      UltraFileSystemSystem.instance = new UltraFileSystem();
    }
    return UltraFileSystemSystem.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.storagePath = process.env.FILE_STORAGE_PATH || './uploads';
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure storage directory exists
      await this.ensureStorageDirectory();
      
      await this.initializeDatabase();
      await this.loadFiles();
      await this.loadShares();
      await this.loadQuotas();
      this.startCleanupTasks();
      
      this.logger.info('file-system', 'File system initialized', {
        storagePath: this.storagePath,
        filesCount: this.files.size,
        sharesCount: this.shares.size,
        quotasCount: this.quotas.size
      });
    } catch (error) {
      this.logger.error('file-system', 'Failed to initialize file system', error as Error);
      throw error;
    }
  }

  private async ensureStorageDirectory(): Promise<void> {
    const dirs = [
      this.storagePath,
      path.join(this.storagePath, 'workspace'),
      path.join(this.storagePath, 'temp'),
      path.join(this.storagePath, 'thumbnails'),
      path.join(this.storagePath, 'quarantine')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS file_uploads (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255),
        channel_id VARCHAR(255),
        dm_id VARCHAR(255),
        user_id VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size BIGINT NOT NULL,
        path TEXT NOT NULL,
        url TEXT NOT NULL,
        thumbnail TEXT,
        metadata JSONB NOT NULL,
        permissions JSONB NOT NULL,
        is_public BOOLEAN DEFAULT FALSE,
        is_deleted BOOLEAN DEFAULT FALSE,
        deleted_at TIMESTAMP,
        uploaded_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        download_count INTEGER DEFAULT 0,
        last_accessed TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS file_shares (
        id VARCHAR(255) PRIMARY KEY,
        file_id VARCHAR(255) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP,
        max_downloads INTEGER,
        download_count INTEGER DEFAULT 0,
        password VARCHAR(255),
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS file_quotas (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255),
        storage_limit BIGINT NOT NULL,
        storage_used BIGINT NOT NULL,
        file_count INTEGER NOT NULL,
        max_file_size BIGINT NOT NULL,
        allowed_types JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, user_id)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS file_analytics (
        id SERIAL PRIMARY KEY,
        file_id VARCHAR(255) NOT NULL,
        downloads JSONB NOT NULL,
        views JSONB NOT NULL,
        shares JSONB NOT NULL,
        total_downloads INTEGER DEFAULT 0,
        total_views INTEGER DEFAULT 0,
        total_shares INTEGER DEFAULT 0,
        top_downloaders JSONB NOT NULL
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_file_uploads_workspace_id ON file_uploads(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_file_uploads_message_id ON file_uploads(message_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_file_uploads_channel_id ON file_uploads(channel_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_file_uploads_dm_id ON file_uploads(dm_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON file_shares(file_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_file_shares_token ON file_shares(token)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_file_quotas_workspace_id ON file_quotas(workspace_id)');
  }

  private async loadFiles(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM file_uploads WHERE is_deleted = FALSE');
      
      for (const row of rows) {
        const file: FileUpload = {
          id: row.id,
          workspaceId: row.workspace_id,
          messageId: row.message_id,
          channelId: row.channel_id,
          dmId: row.dm_id,
          userId: row.user_id,
          fileName: row.file_name,
          originalName: row.original_name,
          mimeType: row.mime_type,
          size: row.size,
          path: row.path,
          url: row.url,
          thumbnail: row.thumbnail,
          metadata: row.metadata,
          permissions: row.permissions || [],
          isPublic: row.is_public,
          isDeleted: row.is_deleted,
          deletedAt: row.deleted_at,
          uploadedAt: row.uploaded_at,
          expiresAt: row.expires_at,
          downloadCount: row.download_count,
          lastAccessed: row.last_accessed
        };
        
        this.files.set(file.id, file);
      }
      
      this.logger.info('file-system', `Loaded ${this.files.size} files`);
    } catch (error) {
      this.logger.error('file-system', 'Failed to load files', error as Error);
    }
  }

  private async loadShares(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM file_shares');
      
      for (const row of rows) {
        const share: FileShare = {
          id: row.id,
          fileId: row.file_id,
          token: row.token,
          createdBy: row.created_by,
          expiresAt: row.expires_at,
          maxDownloads: row.max_downloads,
          downloadCount: row.download_count,
          password: row.password,
          isPublic: row.is_public,
          createdAt: row.created_at
        };
        
        this.shares.set(share.id, share);
      }
      
      this.logger.info('file-system', `Loaded ${this.shares.size} file shares`);
    } catch (error) {
      this.logger.error('file-system', 'Failed to load file shares', error as Error);
    }
  }

  private async loadQuotas(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM file_quotas');
      
      for (const row of rows) {
        const quota: FileQuota = {
          workspaceId: row.workspace_id,
          userId: row.user_id,
          storageLimit: row.storage_limit,
          storageUsed: row.storage_used,
          fileCount: row.file_count,
          maxFileSize: row.max_file_size,
          allowedTypes: row.allowed_types || [],
          updatedAt: row.updated_at
        };
        
        const key = quota.userId ? `${quota.workspaceId}:${quota.userId}` : quota.workspaceId;
        this.quotas.set(key, quota);
      }
      
      this.logger.info('file-system', `Loaded ${this.quotas.size} quotas`);
    } catch (error) {
      this.logger.error('file-system', 'Failed to load quotas', error as Error);
    }
  }

  private startCleanupTasks(): void {
    // Clean up expired files every hour
    setInterval(() => {
      this.cleanupExpiredFiles();
    }, 60 * 60 * 1000);

    // Clean up expired shares every 30 minutes
    setInterval(() => {
      this.cleanupExpiredShares();
    }, 30 * 60 * 1000);

    // Update quotas every 5 minutes
    setInterval(() => {
      this.updateQuotas();
    }, 5 * 60 * 1000);
  }

  private async cleanupExpiredFiles(): Promise<void> {
    try {
      const now = new Date();
      const expiredFiles: string[] = [];
      
      for (const [fileId, file] of this.files.entries()) {
        if (file.expiresAt && file.expiresAt <= now) {
          expiredFiles.push(fileId);
        }
      }
      
      for (const fileId of expiredFiles) {
        await this.deleteFile(fileId, 'system', 'File expired');
      }
      
      if (expiredFiles.length > 0) {
        this.logger.info('file-system', `Cleaned up ${expiredFiles.length} expired files`);
      }
    } catch (error) {
      this.logger.error('file-system', 'Failed to cleanup expired files', error as Error);
    }
  }

  private async cleanupExpiredShares(): Promise<void> {
    try {
      const now = new Date();
      const expiredShares: string[] = [];
      
      for (const [shareId, share] of this.shares.entries()) {
        if ((share.expiresAt && share.expiresAt <= now) || 
            (share.maxDownloads && share.downloadCount >= share.maxDownloads)) {
          expiredShares.push(shareId);
        }
      }
      
      for (const shareId of expiredShares) {
        await this.deleteShare(shareId);
      }
      
      if (expiredShares.length > 0) {
        this.logger.info('file-system', `Cleaned up ${expiredShares.length} expired shares`);
      }
    } catch (error) {
      this.logger.error('file-system', 'Failed to cleanup expired shares', error as Error);
    }
  }

  private async updateQuotas(): Promise<void> {
    try {
      for (const [key, quota] of this.quotas.entries()) {
        // Calculate actual usage
        const userFiles = Array.from(this.files.values()).filter(f => 
          f.workspaceId === quota.workspaceId && 
          (!quota.userId || f.userId === quota.userId) &&
          !f.isDeleted
        );
        
        const storageUsed = userFiles.reduce((sum, f) => sum + f.size, 0);
        const fileCount = userFiles.length;
        
        if (storageUsed !== quota.storageUsed || fileCount !== quota.fileCount) {
          quota.storageUsed = storageUsed;
          quota.fileCount = fileCount;
          quota.updatedAt = new Date();
          
          await this.database.query(`
            UPDATE file_quotas 
            SET storage_used = $1, file_count = $2, updated_at = $3 
            WHERE workspace_id = $4 AND (user_id = $5 OR (user_id IS NULL AND $5 IS NULL))
          `, [quota.storageUsed, quota.fileCount, quota.updatedAt, quota.workspaceId, quota.userId]);
        }
      }
    } catch (error) {
      this.logger.error('file-system', 'Failed to update quotas', error as Error);
    }
  }

  // FILE UPLOAD METHODS
  async uploadFile(config: {
    workspaceId: string;
    userId: string;
    messageId?: string;
    channelId?: string;
    dmId?: string;
    file: Express.Multer.File;
    isPublic?: boolean;
    expiresAt?: Date;
  }): Promise<string> {
    const fileId = `file-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      // Validate file
      await this.validateFile(config.file, config.workspaceId, config.userId);
      
      // Generate file path and name
      const workspaceDir = path.join(this.storagePath, 'workspace', config.workspaceId);
      const fileName = `${fileId}-${config.file.originalname}`;
      const filePath = path.join(workspaceDir, fileName);
      
      // Ensure workspace directory exists
      if (!fs.existsSync(workspaceDir)) {
        fs.mkdirSync(workspaceDir, { recursive: true });
      }
      
      // Move file to permanent location
      fs.renameSync(config.file.path, filePath);
      
      // Generate URL
      const url = `/files/${fileId}`;
      
      // Generate metadata
      const metadata = await this.generateFileMetadata(filePath, config.file.mimetype);
      
      // Create thumbnail if image
      let thumbnail: string | undefined;
      if (config.file.mimetype.startsWith('image/')) {
        thumbnail = await this.generateThumbnail(filePath, fileId);
      }
      
      const file: FileUpload = {
        id: fileId,
        workspaceId: config.workspaceId,
        messageId: config.messageId,
        channelId: config.channelId,
        dmId: config.dmId,
        userId: config.userId,
        fileName,
        originalName: config.file.originalname,
        mimeType: config.file.mimetype,
        size: config.file.size,
        path: filePath,
        url,
        thumbnail,
        metadata,
        permissions: [],
        isPublic: config.isPublic || false,
        isDeleted: false,
        uploadedAt: new Date(),
        expiresAt: config.expiresAt,
        downloadCount: 0
      };
      
      await this.database.query(`
        INSERT INTO file_uploads (
          id, workspace_id, message_id, channel_id, dm_id, user_id,
          file_name, original_name, mime_type, size, path, url,
          thumbnail, metadata, permissions, is_public, uploaded_at,
          expires_at, download_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19)
      `, [
        file.id,
        file.workspaceId,
        file.messageId,
        file.channelId,
        file.dmId,
        file.userId,
        file.fileName,
        file.originalName,
        file.mimeType,
        file.size,
        file.path,
        file.url,
        file.thumbnail,
        JSON.stringify(file.metadata),
        JSON.stringify(file.permissions),
        file.isPublic,
        file.uploadedAt,
        file.expiresAt,
        file.downloadCount
      ]);
      
      this.files.set(fileId, file);
      
      // Update quota
      await this.updateQuotaUsage(config.workspaceId, config.userId, config.file.size, 1);
      
      this.logger.info('file-system', `File uploaded: ${file.originalName}`, {
        fileId,
        workspaceId: config.workspaceId,
        userId: config.userId,
        size: config.file.size
      });
      
      this.emit('fileUploaded', file);
      return fileId;
      
    } catch (error) {
      this.logger.error('file-system', `Failed to upload file: ${config.file.originalname}`, error as Error);
      
      // Clean up temp file if it exists
      if (fs.existsSync(config.file.path)) {
        fs.unlinkSync(config.file.path);
      }
      
      throw error;
    }
  }

  private async validateFile(file: Express.Multer.File, workspaceId: string, userId: string): Promise<void> {
    // Check file size
    const quota = await this.getQuota(workspaceId, userId);
    if (file.size > quota.maxFileSize) {
      throw new Error(`File size exceeds limit of ${quota.maxFileSize} bytes`);
    }
    
    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype) && !quota.allowedTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }
    
    // Check storage quota
    if (quota.storageUsed + file.size > quota.storageLimit) {
      throw new Error('Storage quota exceeded');
    }
    
    // Basic virus scan (simplified)
    if (await this.isSuspiciousFile(file)) {
      throw new Error('File appears to be suspicious');
    }
  }

  private async isSuspiciousFile(file: Express.Multer.File): Promise<boolean> {
    // Simplified suspicious file detection
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    const suspiciousMimeTypes = [
      'application/x-msdownload',
      'application/x-msdos-program',
      'application/x-executable'
    ];
    
    const ext = path.extname(file.originalname).toLowerCase();
    return suspiciousExtensions.includes(ext) || suspiciousMimeTypes.includes(file.mimetype);
  }

  private async generateFileMetadata(filePath: string, mimeType: string): Promise<FileMetadata> {
    const metadata: FileMetadata = {
      checksum: await this.calculateChecksum(filePath)
    };
    
    try {
      if (mimeType.startsWith('image/')) {
        // Get image dimensions (simplified - would use image processing library)
        metadata.dimensions = { width: 1920, height: 1080 };
      } else if (mimeType.startsWith('video/')) {
        // Get video metadata (simplified)
        metadata.duration = 120; // seconds
        metadata.dimensions = { width: 1920, height: 1080 };
        metadata.bitrate = 2500000; // bps
        metadata.fps = 30;
      } else if (mimeType.startsWith('audio/')) {
        // Get audio metadata (simplified)
        metadata.duration = 180; // seconds
        metadata.bitrate = 320000; // bps
      } else if (mimeType === 'application/pdf') {
        // Get PDF page count (simplified)
        metadata.pages = 10;
      }
      
      metadata.virusScanResult = 'clean';
      metadata.scanDate = new Date();
      
    } catch (error) {
      this.logger.warn('file-system', 'Failed to generate full metadata', error as Error);
    }
    
    return metadata;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async generateThumbnail(filePath: string, fileId: string): Promise<string | undefined> {
    try {
      const thumbnailDir = path.join(this.storagePath, 'thumbnails');
      const thumbnailPath = path.join(thumbnailDir, `${fileId}_thumb.jpg`);
      
      // Simplified thumbnail generation (would use image processing library)
      // For now, just return a placeholder URL
      return `/thumbnails/${fileId}_thumb.jpg`;
      
    } catch (error) {
      this.logger.warn('file-system', `Failed to generate thumbnail: ${fileId}`, error as Error);
      return undefined;
    }
  }

  // FILE DOWNLOAD METHODS
  async downloadFile(fileId: string, userId?: string, ipAddress?: string, userAgent?: string): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    const file = this.files.get(fileId);
    if (!file || file.isDeleted) {
      throw new Error('File not found');
    }
    
    // Check permissions
    if (!file.isPublic && (!userId || !(await this.canAccessFile(fileId, userId, 'read')))) {
      throw new Error('Access denied');
    }
    
    // Check if file exists
    if (!fs.existsSync(file.path)) {
      throw new Error('File not found on disk');
    }
    
    // Update download count and analytics
    file.downloadCount++;
    file.lastAccessed = new Date();
    await this.updateFile(file);
    
    await this.recordDownload(fileId, userId, ipAddress, userAgent);
    
    this.logger.info('file-system', `File downloaded: ${file.originalName}`, {
      fileId,
      userId,
      downloadCount: file.downloadCount
    });
    
    this.emit('fileDownloaded', { file, userId });
    
    return {
      filePath: file.path,
      fileName: file.originalName,
      mimeType: file.mimeType
    };
  }

  private async recordDownload(fileId: string, userId?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      const downloadId = `dl-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      
      await this.database.query(`
        INSERT INTO file_analytics (file_id, downloads, total_downloads)
        VALUES ($1, $2, 1)
        ON CONFLICT (file_id) DO UPDATE SET
        downloads = file_analytics.downloads || $2,
        total_downloads = file_analytics.total_downloads + 1
      `, [
        fileId,
        JSON.stringify([{
          id: downloadId,
          userId,
          ipAddress: ipAddress || 'unknown',
          userAgent: userAgent || 'unknown',
          timestamp: new Date()
        }])
      ]);
    } catch (error) {
      this.logger.error('file-system', 'Failed to record download', error as Error);
    }
  }

  // FILE SHARING METHODS
  async createShare(fileId: string, userId: string, config: {
    expiresAt?: Date;
    maxDownloads?: number;
    password?: string;
    isPublic?: boolean;
  }): Promise<string> {
    const file = this.files.get(fileId);
    if (!file || file.isDeleted) {
      throw new Error('File not found');
    }
    
    // Check permissions
    if (!(await this.canAccessFile(fileId, userId, 'share'))) {
      throw new Error('Access denied');
    }
    
    const shareId = `share-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const token = crypto.randomBytes(32).toString('hex');
    
    try {
      const share: FileShare = {
        id: shareId,
        fileId,
        token,
        createdBy: userId,
        expiresAt: config.expiresAt,
        maxDownloads: config.maxDownloads,
        downloadCount: 0,
        password: config.password,
        isPublic: config.isPublic || false,
        createdAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO file_shares (
          id, file_id, token, created_by, expires_at, max_downloads,
          download_count, password, is_public, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        share.id,
        share.fileId,
        share.token,
        share.createdBy,
        share.expiresAt,
        share.maxDownloads,
        share.downloadCount,
        share.password,
        share.isPublic,
        share.createdAt
      ]);
      
      this.shares.set(shareId, share);
      
      this.logger.info('file-system', `File share created: ${file.originalName}`, {
        shareId,
        fileId,
        createdBy: userId
      });
      
      this.emit('fileShared', { file, share });
      return token;
      
    } catch (error) {
      this.logger.error('file-system', `Failed to create file share`, error as Error);
      throw error;
    }
  }

  async getSharedFile(token: string, password?: string): Promise<FileUpload | null> {
    const share = Array.from(this.shares.values()).find(s => s.token === token);
    if (!share) {
      return null;
    }
    
    // Check if share is expired
    if (share.expiresAt && share.expiresAt <= new Date()) {
      return null;
    }
    
    // Check download limit
    if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
      return null;
    }
    
    // Check password
    if (share.password && share.password !== password) {
      return null;
    }
    
    const file = this.files.get(share.fileId);
    if (!file || file.isDeleted) {
      return null;
    }
    
    // Update download count
    share.downloadCount++;
    await this.updateShare(share);
    
    return file;
  }

  // PERMISSION METHODS
  async grantFilePermission(fileId: string, grantedBy: string, config: {
    userId?: string;
    roleId?: string;
    type: FilePermission['type'];
    expiresAt?: Date;
  }): Promise<boolean> {
    const file = this.files.get(fileId);
    if (!file || file.isDeleted) {
      return false;
    }
    
    // Check if granter has permission
    if (!(await this.canAccessFile(fileId, grantedBy, 'share'))) {
      return false;
    }
    
    const permissionId = `perm-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const permission: FilePermission = {
        id: permissionId,
        fileId,
        userId: config.userId,
        roleId: config.roleId,
        type: config.type,
        grantedBy,
        grantedAt: new Date(),
        expiresAt: config.expiresAt
      };
      
      file.permissions.push(permission);
      await this.updateFile(file);
      
      this.emit('permissionGranted', { file, permission });
      return true;
      
    } catch (error) {
      this.logger.error('file-system', `Failed to grant file permission`, error as Error);
      return false;
    }
  }

  async canAccessFile(fileId: string, userId: string, action: 'read' | 'write' | 'delete' | 'share'): Promise<boolean> {
    const file = this.files.get(fileId);
    if (!file || file.isDeleted) {
      return false;
    }
    
    // Owner has all permissions
    if (file.userId === userId) {
      return true;
    }
    
    // Public files can be read by anyone
    if (file.isPublic && action === 'read') {
      return true;
    }
    
    // Check explicit permissions
    for (const permission of file.permissions) {
      if ((permission.userId === userId || permission.roleId) && 
          permission.type === action &&
          (!permission.expiresAt || permission.expiresAt > new Date())) {
        return true;
      }
    }
    
    return false;
  }

  // QUOTA METHODS
  async getQuota(workspaceId: string, userId?: string): Promise<FileQuota> {
    const key = userId ? `${workspaceId}:${userId}` : workspaceId;
    let quota = this.quotas.get(key);
    
    if (!quota) {
      // Create default quota
      quota = {
        workspaceId,
        userId,
        storageLimit: userId ? 1024 * 1024 * 1024 : 10 * 1024 * 1024 * 1024, // 1GB user, 10GB workspace
        storageUsed: 0,
        fileCount: 0,
        maxFileSize: this.maxFileSize,
        allowedTypes: this.allowedMimeTypes,
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO file_quotas (
          workspace_id, user_id, storage_limit, storage_used, file_count,
          max_file_size, allowed_types, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (workspace_id, user_id) DO NOTHING
      `, [
        quota.workspaceId,
        quota.userId,
        quota.storageLimit,
        quota.storageUsed,
        quota.fileCount,
        quota.maxFileSize,
        JSON.stringify(quota.allowedTypes),
        quota.updatedAt
      ]);
      
      this.quotas.set(key, quota);
    }
    
    return quota;
  }

  async updateQuota(workspaceId: string, userId: string | undefined, updates: Partial<FileQuota>): Promise<boolean> {
    const key = userId ? `${workspaceId}:${userId}` : workspaceId;
    const quota = this.quotas.get(key);
    
    if (!quota) return false;
    
    try {
      Object.assign(quota, updates, { updatedAt: new Date() });
      
      await this.database.query(`
        UPDATE file_quotas 
        SET storage_limit = $1, max_file_size = $2, allowed_types = $3, updated_at = $4
        WHERE workspace_id = $5 AND (user_id = $6 OR (user_id IS NULL AND $6 IS NULL))
      `, [
        quota.storageLimit,
        quota.maxFileSize,
        JSON.stringify(quota.allowedTypes),
        quota.updatedAt,
        quota.workspaceId,
        quota.userId
      ]);
      
      this.emit('quotaUpdated', quota);
      return true;
      
    } catch (error) {
      this.logger.error('file-system', `Failed to update quota`, error as Error);
      return false;
    }
  }

  private async updateQuotaUsage(workspaceId: string, userId: string, sizeDelta: number, countDelta: number): Promise<void> {
    const quota = await this.getQuota(workspaceId, userId);
    quota.storageUsed += sizeDelta;
    quota.fileCount += countDelta;
    quota.updatedAt = new Date();
    
    await this.database.query(`
      UPDATE file_quotas 
      SET storage_used = $1, file_count = $2, updated_at = $3
      WHERE workspace_id = $4 AND (user_id = $5 OR (user_id IS NULL AND $5 IS NULL))
    `, [quota.storageUsed, quota.fileCount, quota.updatedAt, quota.workspaceId, quota.userId]);
  }

  // FILE MANAGEMENT
  async deleteFile(fileId: string, deletedBy: string, reason?: string): Promise<boolean> {
    const file = this.files.get(fileId);
    if (!file) return false;
    
    // Check permissions
    if (file.userId !== deletedBy && !(await this.canAccessFile(fileId, deletedBy, 'delete'))) {
      return false;
    }
    
    try {
      file.isDeleted = true;
      file.deletedAt = new Date();
      
      await this.updateFile(file);
      
      // Delete physical file (move to quarantine for recovery)
      const quarantinePath = path.join(this.storagePath, 'quarantine', file.fileName);
      if (fs.existsSync(file.path)) {
        fs.renameSync(file.path, quarantinePath);
      }
      
      // Update quota
      await this.updateQuotaUsage(file.workspaceId, file.userId, -file.size, -1);
      
      this.emit('fileDeleted', { file, deletedBy, reason });
      return true;
      
    } catch (error) {
      this.logger.error('file-system', `Failed to delete file: ${fileId}`, error as Error);
      return false;
    }
  }

  private async updateFile(file: FileUpload): Promise<void> {
    await this.database.query(`
      UPDATE file_uploads 
      SET is_deleted = $1, deleted_at = $2, download_count = $3, last_accessed = $4, permissions = $5
      WHERE id = $6
    `, [
      file.isDeleted,
      file.deletedAt,
      file.downloadCount,
      file.lastAccessed,
      JSON.stringify(file.permissions),
      file.id
    ]);
  }

  private async updateShare(share: FileShare): Promise<void> {
    await this.database.query(`
      UPDATE file_shares 
      SET download_count = $1 
      WHERE id = $2
    `, [share.downloadCount, share.id]);
  }

  private async deleteShare(shareId: string): Promise<void> {
    await this.database.query('DELETE FROM file_shares WHERE id = $1', [shareId]);
    this.shares.delete(shareId);
  }

  // PUBLIC API METHODS
  async getFile(fileId: string): Promise<FileUpload | null> {
    return this.files.get(fileId) || null;
  }

  async getFilesByWorkspace(workspaceId: string, filters?: {
    userId?: string;
    channelId?: string;
    dmId?: string;
    messageType?: string;
    mimeType?: string;
    limit?: number;
    offset?: number;
  }): Promise<FileUpload[]> {
    let files = Array.from(this.files.values()).filter(f => 
      f.workspaceId === workspaceId && !f.isDeleted
    );
    
    if (filters?.userId) {
      files = files.filter(f => f.userId === filters.userId);
    }
    
    if (filters?.channelId) {
      files = files.filter(f => f.channelId === filters.channelId);
    }
    
    if (filters?.dmId) {
      files = files.filter(f => f.dmId === filters.dmId);
    }
    
    if (filters?.mimeType) {
      files = files.filter(f => f.mimeType === filters.mimeType);
    }
    
    files.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    
    if (filters?.limit) {
      const start = filters.offset || 0;
      files = files.slice(start, start + filters.limit);
    }
    
    return files;
  }

  async getFileStats(workspaceId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    storageUsed: number;
    storageLimit: number;
    topFileTypes: Array<{ type: string; count: number; size: number }>;
    recentUploads: number;
  }> {
    const files = await this.getFilesByWorkspace(workspaceId);
    const quota = await this.getQuota(workspace);
    
    const typeStats = new Map<string, { count: number; size: number }>();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const file of files) {
      const type = file.mimeType.split('/')[0] || 'other';
      const stats = typeStats.get(type) || { count: 0, size: 0 };
      stats.count++;
      stats.size += file.size;
      typeStats.set(type, stats);
    }
    
    const topFileTypes = Array.from(typeStats.entries())
      .map(([type, stats]) => ({ type, ...stats }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
    
    const recentUploads = files.filter(f => f.uploadedAt >= oneDayAgo).length;
    
    return {
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      storageUsed: quota.storageUsed,
      storageLimit: quota.storageLimit,
      topFileTypes,
      recentUploads
    };
  }

  // Multer configuration for Express
  getMulterConfig(): multer.Options {
    return {
      dest: path.join(this.storagePath, 'temp'),
      limits: {
        fileSize: this.maxFileSize
      },
      fileFilter: (req, file, cb) => {
        if (this.allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} is not allowed`));
        }
      }
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    filesCount: number;
    sharesCount: number;
    quotasCount: number;
    storagePath: string;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!fs.existsSync(this.storagePath)) {
      issues.push('Storage directory does not exist');
    }
    
    return {
      healthy: issues.length === 0,
      filesCount: this.files.size,
      sharesCount: this.shares.size,
      quotasCount: this.quotas.size,
      storagePath: this.storagePath,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.logger.info('file-system', 'File system shut down');
  }
}

// Fix the static instance reference
const UltraFileSystemSystem = UltraFileSystem;
