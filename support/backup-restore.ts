import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraSlackSystem } from './slack-system';
import { UltraFileSystem } from './file-system';
import { Message, Channel, DirectMessage, Workspace, User } from './slack-system';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import * as tar from 'tar';

export interface BackupConfig {
  id: string;
  workspaceId: string;
  name: string;
  schedule: string; // cron expression
  retention: number; // days
  compression: boolean;
  encryption: boolean;
  destinations: BackupDestination[];
  include: BackupInclude;
  exclude: BackupExclude;
  isActive: boolean;
  lastBackup?: Date;
  nextBackup?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackupDestination {
  id: string;
  type: 'local' | 's3' | 'gcs' | 'azure' | 'ftp' | 'custom';
  path: string;
  credentials: Record<string, string>;
  encryption: boolean;
  compression: boolean;
  maxStorage?: number; // MB
  isActive: boolean;
}

export interface BackupInclude {
  messages: boolean;
  channels: boolean;
  users: boolean;
  files: boolean;
  tickets: boolean;
  settings: boolean;
  analytics: boolean;
  customData: string[];
}

export interface BackupExclude {
  dateBefore?: Date;
  dateAfter?: Date;
  channels: string[];
  users: string[];
  fileTypes: string[];
  messageTypes: string[];
}

export interface Backup {
  id: string;
  workspaceId: string;
  configId: string;
  type: 'manual' | 'scheduled' | 'auto';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  size: number; // bytes
  compressedSize: number; // bytes
  filePath: string;
  checksum: string;
  included: {
    messages: number;
    channels: number;
    users: number;
    files: number;
    tickets: number;
  };
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RestoreJob {
  id: string;
  workspaceId: string;
  backupId: string;
  type: 'full' | 'partial';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  options: RestoreOptions;
  conflicts: 'skip' | 'overwrite' | 'merge';
  preview: RestorePreview;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RestoreOptions {
  messages: boolean;
  channels: boolean;
  users: boolean;
  files: boolean;
  tickets: boolean;
  settings: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  channels?: string[];
  users?: string[];
}

export interface RestorePreview {
  messages: number;
  channels: number;
  users: number;
  files: number;
  tickets: number;
  conflicts: {
    messages: number;
    channels: number;
    users: number;
    files: number;
  };
  estimatedTime: number; // minutes
  estimatedSize: number; // bytes
}

export interface BackupAnalytics {
  workspaceId: string;
  date: Date;
  totalBackups: number;
  successfulBackups: number;
  failedBackups: number;
  totalSize: number;
  averageSize: number;
  averageDuration: number; // minutes
  storageUsed: number;
  destinations: Record<string, {
    backups: number;
    size: number;
  }>;
}

export class UltraBackupRestore extends EventEmitter {
  private static instance: UltraBackupRestore;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private slackSystem: UltraSlackSystem;
  private fileSystem: UltraFileSystem;
  private backupConfigs: Map<string, BackupConfig> = new Map();
  private backups: Map<string, Backup> = new Map();
  private restoreJobs: Map<string, RestoreJob> = new Map();
  private activeBackups: Map<string, any> = new Map(); // backupId -> process/operation
  private activeRestores: Map<string, any> = new Map(); // restoreJobId -> process/operation
  private backupPath: string;
  private encryptionKey: string;

  static getInstance(): UltraBackupRestore {
    if (!UltraBackupRestore.instance) {
      UltraBackupRestore.instance = new UltraBackupRestore();
    }
    return UltraBackupRestore.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.slackSystem = UltraSlackSystem.getInstance();
    this.fileSystem = UltraFileSystem.getInstance();
    this.backupPath = process.env.BACKUP_PATH || './backups';
    this.encryptionKey = process.env.BACKUP_ENCRYPTION_KEY || 'ultra-backup-key';
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.ensureBackupDirectory();
      await this.initializeDatabase();
      await this.loadBackupConfigs();
      await this.loadBackups();
      await this.loadRestoreJobs();
      this.startScheduledBackups();
      this.startCleanupTasks();
      
      this.logger.info('backup-restore', 'Backup and restore system initialized', {
        backupPath: this.backupPath,
        configsCount: this.backupConfigs.size,
        backupsCount: this.backups.size,
        restoreJobsCount: this.restoreJobs.size
      });
    } catch (error) {
      this.logger.error('backup-restore', 'Failed to initialize backup and restore system', error as Error);
      throw error;
    }
  }

  private async ensureBackupDirectory(): Promise<void> {
    const dirs = [
      this.backupPath,
      path.join(this.backupPath, 'temp'),
      path.join(this.backupPath, 'archives'),
      path.join(this.backupPath, 'restores')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS backup_configs (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        schedule VARCHAR(100),
        retention INTEGER NOT NULL,
        compression BOOLEAN DEFAULT TRUE,
        encryption BOOLEAN DEFAULT TRUE,
        destinations JSONB NOT NULL,
        include JSONB NOT NULL,
        exclude JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_backup TIMESTAMP,
        next_backup TIMESTAMP,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS backups (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        config_id VARCHAR(255),
        type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        progress INTEGER DEFAULT 0,
        size BIGINT DEFAULT 0,
        compressed_size BIGINT DEFAULT 0,
        file_path TEXT NOT NULL,
        checksum VARCHAR(64),
        included JSONB NOT NULL,
        error TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS restore_jobs (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        backup_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        progress INTEGER DEFAULT 0,
        options JSONB NOT NULL,
        conflicts VARCHAR(20) NOT NULL,
        preview JSONB NOT NULL,
        error TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS backup_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_backups INTEGER DEFAULT 0,
        successful_backups INTEGER DEFAULT 0,
        failed_backups INTEGER DEFAULT 0,
        total_size BIGINT DEFAULT 0,
        average_size BIGINT DEFAULT 0,
        average_duration DECIMAL(10,2),
        storage_used BIGINT DEFAULT 0,
        destinations JSONB NOT NULL,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_backup_configs_workspace_id ON backup_configs(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_backups_workspace_id ON backups(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_restore_jobs_workspace_id ON restore_jobs(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_restore_jobs_status ON restore_jobs(status)');
  }

  private async loadBackupConfigs(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM backup_configs WHERE is_active = TRUE');
      
      for (const row of rows) {
        const config: BackupConfig = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          schedule: row.schedule,
          retention: row.retention,
          compression: row.compression,
          encryption: row.encryption,
          destinations: row.destinations || [],
          include: row.include,
          exclude: row.exclude,
          isActive: row.is_active,
          lastBackup: row.last_backup,
          nextBackup: row.next_backup,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.backupConfigs.set(config.id, config);
      }
      
      this.logger.info('backup-restore', `Loaded ${this.backupConfigs.size} backup configurations`);
    } catch (error) {
      this.logger.error('backup-restore', 'Failed to load backup configurations', error as Error);
    }
  }

  private async loadBackups(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM backups ORDER BY created_at DESC');
      
      for (const row of rows) {
        const backup: Backup = {
          id: row.id,
          workspaceId: row.workspace_id,
          configId: row.config_id,
          type: row.type,
          status: row.status,
          progress: row.progress,
          size: row.size,
          compressedSize: row.compressed_size,
          filePath: row.file_path,
          checksum: row.checksum,
          included: row.included,
          error: row.error,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.backups.set(backup.id, backup);
      }
      
      this.logger.info('backup-restore', `Loaded ${this.backups.size} backups`);
    } catch (error) {
      this.logger.error('backup-restore', 'Failed to load backups', error as Error);
    }
  }

  private async loadRestoreJobs(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM restore_jobs ORDER BY created_at DESC');
      
      for (const row of rows) {
        const job: RestoreJob = {
          id: row.id,
          workspaceId: row.workspace_id,
          backupId: row.backup_id,
          type: row.type,
          status: row.status,
          progress: row.progress,
          options: row.options,
          conflicts: row.conflicts,
          preview: row.preview,
          error: row.error,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.restoreJobs.set(job.id, job);
      }
      
      this.logger.info('backup-restore', `Loaded ${this.restoreJobs.size} restore jobs`);
    } catch (error) {
      this.logger.error('backup-restore', 'Failed to load restore jobs', error as Error);
    }
  }

  private startScheduledBackups(): void {
    // Check for scheduled backups every minute
    setInterval(async () => {
      await this.checkScheduledBackups();
    }, 60 * 1000);
  }

  private async checkScheduledBackups(): Promise<void> {
    try {
      const now = new Date();
      
      for (const config of this.backupConfigs.values()) {
        if (config.isActive && config.nextBackup && config.nextBackup <= now) {
          await this.createBackup(config.workspaceId, config.id, 'scheduled');
          
          // Calculate next backup time (simplified - would use cron parser)
          const nextBackup = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day
          config.nextBackup = nextBackup;
          await this.updateBackupConfig(config);
        }
      }
      
    } catch (error) {
      this.logger.error('backup-restore', 'Failed to check scheduled backups', error as Error);
    }
  }

  private startCleanupTasks(): void {
    // Clean up old backups and temp files every hour
    setInterval(async () => {
      await this.cleanupOldBackups();
      await this.cleanupTempFiles();
    }, 60 * 60 * 1000);
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const now = new Date();
      
      for (const config of this.backupConfigs.values()) {
        const cutoffDate = new Date(now.getTime() - config.retention * 24 * 60 * 60 * 1000);
        
        const oldBackups = Array.from(this.backups.values())
          .filter(b => b.workspaceId === config.workspaceId && 
                     b.status === 'completed' && 
                     b.completedAt && 
                     b.completedAt < cutoffDate);
        
        for (const backup of oldBackups) {
          await this.deleteBackup(backup.id);
        }
      }
      
    } catch (error) {
      this.logger.error('backup-restore', 'Failed to cleanup old backups', error as Error);
    }
  }

  private async cleanupTempFiles(): Promise<void> {
    try {
      const tempDir = path.join(this.backupPath, 'temp');
      const files = fs.readdirSync(tempDir);
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        
        // Delete files older than 1 hour
        if (Date.now() - stats.mtime.getTime() > 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
        }
      }
      
    } catch (error) {
      this.logger.error('backup-restore', 'Failed to cleanup temp files', error as Error);
    }
  }

  // BACKUP METHODS
  async createBackup(workspaceId: string, configId?: string, type: Backup['type'] = 'manual', createdBy?: string): Promise<string> {
    const backupId = `backup-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const config = configId ? this.backupConfigs.get(configId) : null;
      
      const backup: Backup = {
        id: backupId,
        workspaceId,
        configId: configId || '',
        type,
        status: 'pending',
        progress: 0,
        size: 0,
        compressedSize: 0,
        filePath: '',
        checksum: '',
        included: {
          messages: 0,
          channels: 0,
          users: 0,
          files: 0,
          tickets: 0
        },
        createdBy: createdBy || 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO backups (
          id, workspace_id, config_id, type, status, progress, size,
          compressed_size, file_path, checksum, included, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        backup.id,
        backup.workspaceId,
        backup.configId,
        backup.type,
        backup.status,
        backup.progress,
        backup.size,
        backup.compressedSize,
        backup.filePath,
        backup.checksum,
        JSON.stringify(backup.included),
        backup.createdBy,
        backup.createdAt,
        backup.updatedAt
      ]);
      
      this.backups.set(backupId, backup);
      
      // Start backup process
      this.performBackup(backupId, config);
      
      this.emit('backupCreated', backup);
      return backupId;
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to create backup: ${backupId}`, error as Error);
      throw error;
    }
  }

  private async performBackup(backupId: string, config?: BackupConfig): Promise<void> {
    const backup = this.backups.get(backupId);
    if (!backup) return;
    
    try {
      backup.status = 'running';
      backup.startedAt = new Date();
      await this.updateBackup(backup);
      
      const tempDir = path.join(this.backupPath, 'temp', backupId);
      fs.mkdirSync(tempDir, { recursive: true });
      
      // Include configuration
      const include = config ? config.include : {
        messages: true,
        channels: true,
        users: true,
        files: true,
        tickets: true,
        settings: true,
        analytics: true,
        customData: []
      };
      
      const exclude = config ? config.exclude : {
        channels: [],
        users: [],
        fileTypes: [],
        messageTypes: []
      };
      
      // Backup data
      if (include.messages) {
        await this.backupMessages(backup, tempDir, exclude);
        backup.progress += 20;
        await this.updateBackup(backup);
      }
      
      if (include.channels) {
        await this.backupChannels(backup, tempDir, exclude);
        backup.progress += 20;
        await this.updateBackup(backup);
      }
      
      if (include.users) {
        await this.backupUsers(backup, tempDir, exclude);
        backup.progress += 20;
        await this.updateBackup(backup);
      }
      
      if (include.files) {
        await this.backupFiles(backup, tempDir, exclude);
        backup.progress += 20;
        await this.updateBackup(backup);
      }
      
      if (include.tickets) {
        await this.backupTickets(backup, tempDir, exclude);
        backup.progress += 10;
        await this.updateBackup(backup);
      }
      
      if (include.settings) {
        await this.backupSettings(backup, tempDir);
        backup.progress += 10;
        await this.updateBackup(backup);
      }
      
      // Create archive
      const archivePath = await this.createArchive(backup, tempDir, config);
      backup.filePath = archivePath;
      backup.progress = 90;
      await this.updateBackup(backup);
      
      // Calculate checksum and size
      backup.checksum = await this.calculateChecksum(archivePath);
      backup.size = fs.statSync(archivePath).size;
      backup.progress = 100;
      await this.updateBackup(backup);
      
      // Upload to destinations
      if (config) {
        await this.uploadToDestinations(backup, config);
      }
      
      backup.status = 'completed';
      backup.completedAt = new Date();
      await this.updateBackup(backup);
      
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      // Update config last backup time
      if (config) {
        config.lastBackup = backup.completedAt;
        await this.updateBackupConfig(config);
      }
      
      this.logger.info('backup-restore', `Backup completed: ${backupId}`, {
        workspaceId: backup.workspaceId,
        size: backup.size,
        duration: backup.completedAt.getTime() - backup.startedAt!.getTime()
      });
      
      this.emit('backupCompleted', backup);
      
    } catch (error) {
      backup.status = 'failed';
      backup.error = error.message;
      backup.completedAt = new Date();
      await this.updateBackup(backup);
      
      this.logger.error('backup-restore', `Backup failed: ${backupId}`, error as Error);
      this.emit('backupFailed', backup);
    }
  }

  private async backupMessages(backup: Backup, tempDir: string, exclude: BackupExclude): Promise<void> {
    try {
      let sql = 'SELECT * FROM messages WHERE workspace_id = $1 AND is_deleted = FALSE';
      const params: any[] = [backup.workspaceId];
      
      if (exclude.dateBefore) {
        sql += ' AND created_at >= $2';
        params.push(exclude.dateBefore);
      }
      
      if (exclude.dateAfter) {
        sql += ' AND created_at <= $' + (params.length + 1);
        params.push(exclude.dateAfter);
      }
      
      const messages = await this.database.query(sql, params);
      
      const messagesData = {
        messages: messages.rows,
        exportedAt: new Date(),
        version: '1.0'
      };
      
      fs.writeFileSync(
        path.join(tempDir, 'messages.json'),
        JSON.stringify(messagesData, null, 2)
      );
      
      backup.included.messages = messages.rows.length;
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to backup messages: ${backup.id}`, error as Error);
      throw error;
    }
  }

  private async backupChannels(backup: Backup, tempDir: string, exclude: BackupExclude): Promise<void> {
    try {
      let sql = 'SELECT * FROM channels WHERE workspace_id = $1';
      const params: any[] = [backup.workspaceId];
      
      if (exclude.channels.length > 0) {
        sql += ' AND id NOT IN (' + exclude.channels.map(() => '?').join(',') + ')';
        params.push(...exclude.channels);
      }
      
      const channels = await this.database.query(sql, params);
      
      const channelsData = {
        channels: channels.rows,
        exportedAt: new Date(),
        version: '1.0'
      };
      
      fs.writeFileSync(
        path.join(tempDir, 'channels.json'),
        JSON.stringify(channelsData, null, 2)
      );
      
      backup.included.channels = channels.rows.length;
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to backup channels: ${backup.id}`, error as Error);
      throw error;
    }
  }

  private async backupUsers(backup: Backup, tempDir: string, exclude: BackupExclude): Promise<void> {
    try {
      const workspace = await this.slackSystem.getWorkspace(backup.workspaceId);
      if (!workspace) return;
      
      let users = workspace.members;
      
      if (exclude.users.length > 0) {
        users = users.filter(user => !exclude.users.includes(user.userId));
      }
      
      const usersData = {
        users: users,
        exportedAt: new Date(),
        version: '1.0'
      };
      
      fs.writeFileSync(
        path.join(tempDir, 'users.json'),
        JSON.stringify(usersData, null, 2)
      );
      
      backup.included.users = users.length;
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to backup users: ${backup.id}`, error as Error);
      throw error;
    }
  }

  private async backupFiles(backup: Backup, tempDir: string, exclude: BackupExclude): Promise<void> {
    try {
      const files = await this.fileSystem.getFilesByWorkspace(backup.workspaceId);
      
      let filteredFiles = files;
      if (exclude.fileTypes.length > 0) {
        filteredFiles = files.filter(file => 
          !exclude.fileTypes.some(type => file.mimeType.includes(type))
        );
      }
      
      const filesDir = path.join(tempDir, 'files');
      fs.mkdirSync(filesDir, { recursive: true });
      
      const filesData = {
        files: filteredFiles.map(file => ({
          ...file,
          path: `files/${file.fileName}`
        })),
        exportedAt: new Date(),
        version: '1.0'
      };
      
      fs.writeFileSync(
        path.join(tempDir, 'files.json'),
        JSON.stringify(filesData, null, 2)
      );
      
      // Copy files (simplified - would use actual file copying)
      for (const file of filteredFiles.slice(0, 100)) { // Limit to 100 files for demo
        const destPath = path.join(filesDir, file.fileName);
        // In real implementation, would copy from file.path to destPath
        fs.writeFileSync(destPath, `File content for ${file.fileName}`);
      }
      
      backup.included.files = filteredFiles.length;
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to backup files: ${backup.id}`, error as Error);
      throw error;
    }
  }

  private async backupTickets(backup: Backup, tempDir: string, exclude: BackupExclude): Promise<void> {
    try {
      const tickets = await this.slackSystem.getTicketsByWorkspace(backup.workspaceId);
      
      const ticketsData = {
        tickets: tickets,
        exportedAt: new Date(),
        version: '1.0'
      };
      
      fs.writeFileSync(
        path.join(tempDir, 'tickets.json'),
        JSON.stringify(ticketsData, null, 2)
      );
      
      backup.included.tickets = tickets.length;
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to backup tickets: ${backup.id}`, error as Error);
      throw error;
    }
  }

  private async backupSettings(backup: Backup, tempDir: string): Promise<void> {
    try {
      const workspace = await this.slackSystem.getWorkspace(backup.workspaceId);
      if (!workspace) return;
      
      const settingsData = {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          domain: workspace.domain,
          settings: workspace.settings
        },
        exportedAt: new Date(),
        version: '1.0'
      };
      
      fs.writeFileSync(
        path.join(tempDir, 'settings.json'),
        JSON.stringify(settingsData, null, 2)
      );
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to backup settings: ${backup.id}`, error as Error);
      throw error;
    }
  }

  private async createArchive(backup: Backup, tempDir: string, config?: BackupConfig): Promise<string> {
    try {
      const archiveName = `backup-${backup.workspaceId}-${backup.id}.tar`;
      let archivePath = path.join(this.backupPath, 'archives', archiveName);
      
      // Create tar archive
      await tar.create(
        {
          file: archivePath,
          cwd: tempDir
        },
        fs.readdirSync(tempDir)
      );
      
      // Compress if enabled
      if (config?.compression !== false) {
        const compressedPath = archivePath + '.gz';
        const gzip = zlib.createGzip();
        const input = fs.createReadStream(archivePath);
        const output = fs.createWriteStream(compressedPath);
        
        await new Promise((resolve, reject) => {
          input.pipe(gzip).pipe(output)
            .on('finish', resolve)
            .on('error', reject);
        });
        
        fs.unlinkSync(archivePath);
        archivePath = compressedPath;
      }
      
      // Encrypt if enabled
      if (config?.encryption !== false) {
        const encryptedPath = archivePath + '.enc';
        const encrypted = await this.encryptFile(archivePath);
        fs.writeFileSync(encryptedPath, encrypted);
        fs.unlinkSync(archivePath);
        archivePath = encryptedPath;
      }
      
      return archivePath;
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to create archive: ${backup.id}`, error as Error);
      throw error;
    }
  }

  private async encryptFile(filePath: string): Promise<Buffer> {
    const fileContent = fs.readFileSync(filePath);
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    
    let encrypted = cipher.update(fileContent);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const fileContent = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileContent).digest('hex');
  }

  private async uploadToDestinations(backup: Backup, config: BackupConfig): Promise<void> {
    try {
      for (const destination of config.destinations) {
        if (!destination.isActive) continue;
        
        switch (destination.type) {
          case 'local':
            // Already handled - file is in local storage
            break;
          case 's3':
            await this.uploadToS3(backup, destination);
            break;
          case 'gcs':
            await this.uploadToGCS(backup, destination);
            break;
          case 'azure':
            await this.uploadToAzure(backup, destination);
            break;
          default:
            this.logger.warn('backup-restore', `Unsupported destination type: ${destination.type}`);
        }
      }
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to upload to destinations: ${backup.id}`, error as Error);
    }
  }

  private async uploadToS3(backup: Backup, destination: BackupDestination): Promise<void> {
    // Simplified S3 upload - would use AWS SDK
    this.logger.info('backup-restore', `Uploading backup to S3: ${backup.id}`, {
      destination: destination.path
    });
  }

  private async uploadToGCS(backup: Backup, destination: BackupDestination): Promise<void> {
    // Simplified GCS upload - would use Google Cloud SDK
    this.logger.info('backup-restore', `Uploading backup to GCS: ${backup.id}`, {
      destination: destination.path
    });
  }

  private async uploadToAzure(backup: Backup, destination: BackupDestination): Promise<void> {
    // Simplified Azure upload - would use Azure SDK
    this.logger.info('backup-restore', `Uploading backup to Azure: ${backup.id}`, {
      destination: destination.path
    });
  }

  // RESTORE METHODS
  async createRestoreJob(config: {
    workspaceId: string;
    backupId: string;
    type: RestoreJob['type'];
    options: RestoreOptions;
    conflicts: RestoreJob['conflicts'];
    createdBy: string;
  }): Promise<string> {
    const jobId = `restore-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const backup = this.backups.get(config.backupId);
      if (!backup) {
        throw new Error('Backup not found');
      }
      
      const preview = await this.generateRestorePreview(config.backupId, config.options);
      
      const job: RestoreJob = {
        id: jobId,
        workspaceId: config.workspaceId,
        backupId: config.backupId,
        type: config.type,
        status: 'pending',
        progress: 0,
        options: config.options,
        conflicts: config.conflicts,
        preview,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO restore_jobs (
          id, workspace_id, backup_id, type, status, progress,
          options, conflicts, preview, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        job.id,
        job.workspaceId,
        job.backupId,
        job.type,
        job.status,
        job.progress,
        JSON.stringify(job.options),
        job.conflicts,
        JSON.stringify(job.preview),
        job.createdBy,
        job.createdAt,
        job.updatedAt
      ]);
      
      this.restoreJobs.set(jobId, job);
      
      this.emit('restoreJobCreated', job);
      return jobId;
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to create restore job: ${jobId}`, error as Error);
      throw error;
    }
  }

  async startRestoreJob(jobId: string): Promise<void> {
    const job = this.restoreJobs.get(jobId);
    if (!job) throw new Error('Restore job not found');
    
    try {
      job.status = 'running';
      job.startedAt = new Date();
      await this.updateRestoreJob(job);
      
      await this.performRestore(jobId);
      
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
      await this.updateRestoreJob(job);
      
      this.logger.error('backup-restore', `Restore job failed: ${jobId}`, error as Error);
      this.emit('restoreJobFailed', job);
    }
  }

  private async performRestore(jobId: string): Promise<void> {
    const job = this.restoreJobs.get(jobId);
    if (!job) return;
    
    try {
      const backup = this.backups.get(job.backupId);
      if (!backup) throw new Error('Backup not found');
      
      // Extract backup
      const tempDir = await this.extractBackup(backup);
      
      // Restore data based on options
      if (job.options.messages) {
        await this.restoreMessages(job, tempDir);
        job.progress += 25;
        await this.updateRestoreJob(job);
      }
      
      if (job.options.channels) {
        await this.restoreChannels(job, tempDir);
        job.progress += 25;
        await this.updateRestoreJob(job);
      }
      
      if (job.options.users) {
        await this.restoreUsers(job, tempDir);
        job.progress += 25;
        await this.updateRestoreJob(job);
      }
      
      if (job.options.files) {
        await this.restoreFiles(job, tempDir);
        job.progress += 15;
        await this.updateRestoreJob(job);
      }
      
      if (job.options.tickets) {
        await this.restoreTickets(job, tempDir);
        job.progress += 10;
        await this.updateRestoreJob(job);
      }
      
      job.status = 'completed';
      job.completedAt = new Date();
      job.progress = 100;
      await this.updateRestoreJob(job);
      
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      this.logger.info('backup-restore', `Restore completed: ${jobId}`, {
        workspaceId: job.workspaceId,
        duration: job.completedAt.getTime() - job.startedAt!.getTime()
      });
      
      this.emit('restoreJobCompleted', job);
      
    } catch (error) {
      this.logger.error('backup-restore', `Restore failed: ${jobId}`, error as Error);
      throw error;
    }
  }

  private async extractBackup(backup: Backup): Promise<string> {
    try {
      const tempDir = path.join(this.backupPath, 'temp', `restore-${backup.id}`);
      fs.mkdirSync(tempDir, { recursive: true });
      
      let filePath = backup.filePath;
      
      // Decrypt if needed
      if (filePath.endsWith('.enc')) {
        const decryptedPath = filePath.replace('.enc', '');
        const decrypted = await this.decryptFile(filePath);
        fs.writeFileSync(decryptedPath, decrypted);
        filePath = decryptedPath;
      }
      
      // Decompress if needed
      if (filePath.endsWith('.gz')) {
        const decompressedPath = filePath.replace('.gz', '');
        const gunzip = zlib.createGunzip();
        const input = fs.createReadStream(filePath);
        const output = fs.createWriteStream(decompressedPath);
        
        await new Promise((resolve, reject) => {
          input.pipe(gunzip).pipe(output)
            .on('finish', resolve)
            .on('error', reject);
        });
        
        filePath = decompressedPath;
      }
      
      // Extract tar archive
      await tar.extract({
        file: filePath,
        cwd: tempDir
      });
      
      return tempDir;
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to extract backup: ${backup.id}`, error as Error);
      throw error;
    }
  }

  private async decryptFile(filePath: string): Promise<Buffer> {
    const fileContent = fs.readFileSync(filePath);
    const algorithm = 'aes-256-gcm';
    
    const iv = fileContent.slice(0, 16);
    const authTag = fileContent.slice(16, 32);
    const encrypted = fileContent.slice(32);
    
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  private async generateRestorePreview(backupId: string, options: RestoreOptions): Promise<RestorePreview> {
    try {
      const backup = this.backups.get(backupId);
      if (!backup) throw new Error('Backup not found');
      
      // For now, return basic preview based on backup included data
      return {
        messages: backup.included.messages,
        channels: backup.included.channels,
        users: backup.included.users,
        files: backup.included.files,
        tickets: backup.included.tickets,
        conflicts: {
          messages: 0,
          channels: 0,
          users: 0,
          files: 0
        },
        estimatedTime: Math.ceil(backup.included.messages / 1000), // Rough estimate
        estimatedSize: backup.size
      };
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to generate restore preview: ${backupId}`, error as Error);
      throw error;
    }
  }

  private async restoreMessages(job: RestoreJob, tempDir: string): Promise<void> {
    try {
      const messagesPath = path.join(tempDir, 'messages.json');
      if (!fs.existsSync(messagesPath)) return;
      
      const messagesData = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
      
      for (const message of messagesData.messages) {
        // Handle conflicts based on job.conflicts setting
        if (job.conflicts === 'skip') {
          const existing = await this.database.query(
            'SELECT id FROM messages WHERE id = $1', [message.id]
          );
          if (existing.rows.length > 0) continue;
        }
        
        // Restore message (simplified)
        await this.database.query(`
          INSERT INTO messages (
            id, workspace_id, channel_id, dm_id, thread_id, sender_id,
            type, content, attachments, reactions, mentions, reply_count,
            is_edited, is_deleted, is_pinned, delivered_to, read_by,
            metadata, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17, $18, $19, $20)
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            updated_at = EXCLUDED.updated_at
        `, [
          message.id,
          message.workspace_id,
          message.channel_id,
          message.dm_id,
          message.thread_id,
          message.sender_id,
          message.type,
          message.content,
          JSON.stringify(message.attachments),
          JSON.stringify(message.reactions),
          JSON.stringify(message.mentions),
          message.reply_count,
          message.is_edited,
          message.is_deleted,
          message.is_pinned,
          JSON.stringify(message.delivered_to),
          JSON.stringify(message.read_by),
          JSON.stringify(message.metadata),
          message.created_at,
          message.updated_at
        ]);
      }
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to restore messages: ${job.id}`, error as Error);
      throw error;
    }
  }

  private async restoreChannels(job: RestoreJob, tempDir: string): Promise<void> {
    try {
      const channelsPath = path.join(tempDir, 'channels.json');
      if (!fs.existsSync(channelsPath)) return;
      
      const channelsData = JSON.parse(fs.readFileSync(channelsPath, 'utf8'));
      
      for (const channel of channelsData.channels) {
        if (job.conflicts === 'skip') {
          const existing = await this.database.query(
            'SELECT id FROM channels WHERE id = $1', [channel.id]
          );
          if (existing.rows.length > 0) continue;
        }
        
        // Restore channel
        await this.database.query(`
          INSERT INTO channels (
            id, workspace_id, name, type, description, purpose, topic,
            is_archived, members, messages, threads, pins, integrations,
            settings, created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            updated_at = EXCLUDED.updated_at
        `, [
          channel.id,
          channel.workspace_id,
          channel.name,
          channel.type,
          channel.description,
          channel.purpose,
          channel.topic,
          channel.is_archived,
          JSON.stringify(channel.members),
          JSON.stringify(channel.messages),
          JSON.stringify(channel.threads),
          JSON.stringify(channel.pins),
          JSON.stringify(channel.integrations),
          JSON.stringify(channel.settings),
          channel.created_by,
          channel.created_at,
          channel.updated_at
        ]);
      }
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to restore channels: ${job.id}`, error as Error);
      throw error;
    }
  }

  private async restoreUsers(job: RestoreJob, tempDir: string): Promise<void> {
    try {
      const usersPath = path.join(tempDir, 'users.json');
      if (!fs.existsSync(usersPath)) return;
      
      const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      
      // Users would be restored to the workspace members
      // This is simplified - would need proper user management integration
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to restore users: ${job.id}`, error as Error);
      throw error;
    }
  }

  private async restoreFiles(job: RestoreJob, tempDir: string): Promise<void> {
    try {
      const filesPath = path.join(tempDir, 'files.json');
      if (!fs.existsSync(filesPath)) return;
      
      const filesData = JSON.parse(fs.readFileSync(filesPath, 'utf8'));
      
      // Restore file metadata and copy files
      // This is simplified - would integrate with the file system
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to restore files: ${job.id}`, error as Error);
      throw error;
    }
  }

  private async restoreTickets(job: RestoreJob, tempDir: string): Promise<void> {
    try {
      const ticketsPath = path.join(tempDir, 'tickets.json');
      if (!fs.existsSync(ticketsPath)) return;
      
      const ticketsData = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
      
      for (const ticket of ticketsData.tickets) {
        if (job.conflicts === 'skip') {
          const existing = await this.database.query(
            'SELECT id FROM tickets WHERE id = $1', [ticket.id]
          );
          if (existing.rows.length > 0) continue;
        }
        
        // Restore ticket
        await this.database.query(`
          INSERT INTO tickets (
            id, workspace_id, channel_id, dm_id, message_id, title,
            description, category, priority, status, assigned_to, created_by,
            created_at, updated_at, resolved_at, tags, attachments, notes, metrics
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17, $18, $19)
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at
        `, [
          ticket.id,
          ticket.workspace_id,
          ticket.channel_id,
          ticket.dm_id,
          ticket.message_id,
          ticket.title,
          ticket.description,
          ticket.category,
          ticket.priority,
          ticket.status,
          ticket.assigned_to,
          ticket.created_by,
          ticket.created_at,
          ticket.updated_at,
          ticket.resolved_at,
          JSON.stringify(ticket.tags),
          JSON.stringify(ticket.attachments),
          JSON.stringify(ticket.notes),
          JSON.stringify(ticket.metrics)
        ]);
      }
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to restore tickets: ${job.id}`, error as Error);
      throw error;
    }
  }

  // CONFIG MANAGEMENT
  async createBackupConfig(config: {
    workspaceId: string;
    name: string;
    schedule?: string;
    retention: number;
    compression?: boolean;
    encryption?: boolean;
    destinations: BackupDestination[];
    include: BackupInclude;
    exclude: BackupExclude;
    createdBy: string;
  }): Promise<string> {
    const configId = `config-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const backupConfig: BackupConfig = {
        id: configId,
        workspaceId: config.workspaceId,
        name: config.name,
        schedule: config.schedule || '0 2 * * *', // Daily at 2 AM
        retention: config.retention,
        compression: config.compression !== false,
        encryption: config.encryption !== false,
        destinations: config.destinations,
        include: config.include,
        exclude: config.exclude,
        isActive: true,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO backup_configs (
          id, workspace_id, name, schedule, retention, compression, encryption,
          destinations, include, exclude, is_active, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        backupConfig.id,
        backupConfig.workspaceId,
        backupConfig.name,
        backupConfig.schedule,
        backupConfig.retention,
        backupConfig.compression,
        backupConfig.encryption,
        JSON.stringify(backupConfig.destinations),
        JSON.stringify(backupConfig.include),
        JSON.stringify(backupConfig.exclude),
        backupConfig.isActive,
        backupConfig.createdBy,
        backupConfig.createdAt,
        backupConfig.updatedAt
      ]);
      
      this.backupConfigs.set(configId, backupConfig);
      
      this.emit('backupConfigCreated', backupConfig);
      return configId;
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to create backup config: ${configId}`, error as Error);
      throw error;
    }
  }

  // UTILITY METHODS
  private async updateBackup(backup: Backup): Promise<void> {
    await this.database.query(`
      UPDATE backups 
      SET status = $1, progress = $2, size = $3, compressed_size = $4,
      file_path = $5, checksum = $6, included = $7, error = $8,
      started_at = $9, completed_at = $10, updated_at = $11
      WHERE id = $12
    `, [
      backup.status,
      backup.progress,
      backup.size,
      backup.compressedSize,
      backup.filePath,
      backup.checksum,
      JSON.stringify(backup.included),
      backup.error,
      backup.startedAt,
      backup.completedAt,
      backup.updatedAt,
      backup.id
    ]);
  }

  private async updateRestoreJob(job: RestoreJob): Promise<void> {
    await this.database.query(`
      UPDATE restore_jobs 
      SET status = $1, progress = $2, error = $3, started_at = $4,
      completed_at = $5, updated_at = $6
      WHERE id = $7
    `, [
      job.status,
      job.progress,
      job.error,
      job.startedAt,
      job.completedAt,
      job.updatedAt,
      job.id
    ]);
  }

  private async updateBackupConfig(config: BackupConfig): Promise<void> {
    await this.database.query(`
      UPDATE backup_configs 
      SET last_backup = $1, next_backup = $2, updated_at = $3
      WHERE id = $4
    `, [config.lastBackup, config.nextBackup, config.updatedAt, config.id]);
  }

  async deleteBackup(backupId: string): Promise<boolean> {
    const backup = this.backups.get(backupId);
    if (!backup) return false;
    
    try {
      // Delete file
      if (fs.existsSync(backup.filePath)) {
        fs.unlinkSync(backup.filePath);
      }
      
      // Delete from database
      await this.database.query('DELETE FROM backups WHERE id = $1', [backupId]);
      
      this.backups.delete(backupId);
      
      this.emit('backupDeleted', backup);
      return true;
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to delete backup: ${backupId}`, error as Error);
      return false;
    }
  }

  async getBackups(workspaceId: string, filters?: {
    status?: Backup['status'];
    type?: Backup['type'];
    limit?: number;
    offset?: number;
  }): Promise<Backup[]> {
    let backups = Array.from(this.backups.values())
      .filter(b => b.workspaceId === workspaceId);
    
    if (filters?.status) {
      backups = backups.filter(b => b.status === filters.status);
    }
    
    if (filters?.type) {
      backups = backups.filter(b => b.type === filters.type);
    }
    
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (filters?.limit) {
      const start = filters.offset || 0;
      backups = backups.slice(start, start + filters.limit);
    }
    
    return backups;
  }

  async getRestoreJobs(workspaceId: string, filters?: {
    status?: RestoreJob['status'];
    type?: RestoreJob['type'];
    limit?: number;
    offset?: number;
  }): Promise<RestoreJob[]> {
    let jobs = Array.from(this.restoreJobs.values())
      .filter(j => j.workspaceId === workspaceId);
    
    if (filters?.status) {
      jobs = jobs.filter(j => j.status === filters.status);
    }
    
    if (filters?.type) {
      jobs = jobs.filter(j => j.type === filters.type);
    }
    
    jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (filters?.limit) {
      const start = filters.offset || 0;
      jobs = jobs.slice(start, start + filters.limit);
    }
    
    return jobs;
  }

  async getBackupAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<BackupAnalytics[]> {
    try {
      let sql = 'SELECT * FROM backup_analytics WHERE workspace_id = $1';
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
        totalBackups: row.total_backups,
        successfulBackups: row.successful_backups,
        failedBackups: row.failed_backups,
        totalSize: row.total_size,
        averageSize: row.average_size,
        averageDuration: parseFloat(row.average_duration) || 0,
        storageUsed: row.storage_used,
        destinations: row.destinations || {}
      }));
      
    } catch (error) {
      this.logger.error('backup-restore', `Failed to get backup analytics: ${workspaceId}`, error as Error);
      return [];
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    configsCount: number;
    backupsCount: number;
    restoreJobsCount: number;
    activeBackupsCount: number;
    activeRestoresCount: number;
    storagePath: string;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!fs.existsSync(this.backupPath)) {
      issues.push('Backup directory does not exist');
    }
    
    const activeBackups = Array.from(this.backups.values()).filter(b => b.status === 'running').length;
    const activeRestores = Array.from(this.restoreJobs.values()).filter(j => j.status === 'running').length;
    
    if (activeBackups > 5) {
      issues.push('High number of active backups');
    }
    
    return {
      healthy: issues.length === 0,
      configsCount: this.backupConfigs.size,
      backupsCount: this.backups.size,
      restoreJobsCount: this.restoreJobs.size,
      activeBackupsCount: activeBackups,
      activeRestoresCount: activeRestores,
      storagePath: this.backupPath,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.logger.info('backup-restore', 'Backup and restore system shut down');
  }
}

export default UltraBackupRestore;
