import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraSSHConnect } from './ssh-connect';
import { UltraServerProviders } from './server-providers';

export interface StorageServer {
  id: string;
  name: string;
  serverId: string;
  type: 'local' | 'nas' | 'san' | 'cloud';
  protocol: 'nfs' | 'smb' | 'ftp' | 'sftp' | 's3' | 'azure' | 'gcs';
  host: string;
  port: number;
  path: string;
  credentials: StorageCredentials;
  config: StorageConfig;
  status: 'active' | 'inactive' | 'error' | 'maintenance';
  capacity: StorageCapacity;
  monitoring: StorageMonitoring;
  createdAt: Date;
  updatedAt: Date;
  lastHealthCheck?: Date;
}

export interface StorageCredentials {
  username?: string;
  password?: string;
  accessKey?: string;
  secretKey?: string;
  token?: string;
  certificate?: string;
  privateKey?: string;
  region?: string;
  bucket?: string;
  endpoint?: string;
}

export interface StorageConfig {
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
  deduplicationEnabled: boolean;
  cachingEnabled: boolean;
  cacheSize: number; // MB
  replicationEnabled: boolean;
  replicationTargets: string[];
  backupEnabled: boolean;
  backupSchedule: string; // cron
  retentionDays: number;
  versioningEnabled: boolean;
  maxVersions: number;
  accessControl: 'public' | 'private' | 'restricted';
  allowedIPs: string[];
  customSettings: Record<string, any>;
}

export interface StorageCapacity {
  total: number; // bytes
  used: number; // bytes
  available: number; // bytes
  usagePercentage: number;
  files: number;
  directories: number;
  lastUpdated: Date;
}

export interface StorageMonitoring {
  enabled: boolean;
  metricsInterval: number; // seconds
  alertThresholds: {
    diskUsage: number;
    fileCount: number;
    errorRate: number;
    responseTime: number;
  };
  performanceMetrics: StoragePerformanceMetrics[];
}

export interface StoragePerformanceMetrics {
  timestamp: Date;
  readSpeed: number; // MB/s
  writeSpeed: number; // MB/s
  iops: number;
  latency: number; // ms
  throughput: number; // MB/s
  errorCount: number;
  connectionCount: number;
}

export interface StorageBackup {
  id: string;
  serverId: string;
  type: 'full' | 'incremental' | 'differential';
  sourcePath: string;
  targetPath: string;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  size: number;
  compressedSize: number;
  checksum: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  errorMessage?: string;
  createdAt: Date;
}

export interface StorageFile {
  id: string;
  serverId: string;
  path: string;
  name: string;
  size: number;
  type: 'file' | 'directory';
  permissions: string;
  owner: string;
  group: string;
  createdAt: Date;
  modifiedAt: Date;
  accessedAt: Date;
  checksum?: string;
  isEncrypted: boolean;
  version: number;
  tags: string[];
}

export interface StorageSync {
  id: string;
  sourceServerId: string;
  targetServerId: string;
  sourcePath: string;
  targetPath: string;
  syncType: 'one-way' | 'two-way';
  syncMethod: 'rsync' | 'rclone' | 'custom';
  schedule: string;
  excludePatterns: string[];
  includePatterns: string[];
  deleteExtra: boolean;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  status: 'active' | 'inactive' | 'syncing' | 'error';
  lastSync?: Date;
  nextSync?: Date;
  progress: number;
  totalFiles: number;
  syncedFiles: number;
  errorCount: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UltraStorageSystem extends EventEmitter {
  private static instance: UltraStorageSystem;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private sshConnect: UltraSSHConnect;
  private serverProviders: UltraServerProviders;
  private storageServers: Map<string, StorageServer> = new Map();
  private backups: Map<string, StorageBackup[]> = new Map();
  private syncs: Map<string, StorageSync> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private backupIntervals: Map<string, NodeJS.Timeout> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): UltraStorageSystem {
    if (!UltraStorageSystem.instance) {
      UltraStorageSystem.instance = new UltraStorageSystem();
    }
    return UltraStorageSystem.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.sshConnect = UltraSSHConnect.getInstance();
    this.serverProviders = UltraServerProviders.getInstance();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize database tables
      await this.initializeDatabase();
      
      // Load existing storage servers
      await this.loadStorageServers();
      
      // Load existing backups and syncs
      await this.loadBackups();
      await this.loadSyncs();
      
      // Start monitoring for all storage servers
      await this.startAllMonitoring();
      
      // Start backup schedules
      await this.startAllBackupSchedules();
      
      // Start sync schedules
      await this.startAllSyncSchedules();
      
      this.logger.info('storage-system', 'Storage system initialized', {
        storageServersCount: this.storageServers.size,
        backupsCount: Array.from(this.backups.values()).reduce((sum, backups) => sum + backups.length, 0),
        syncsCount: this.syncs.size,
        monitoringActive: this.monitoringIntervals.size
      });

    } catch (error) {
      this.logger.error('storage-system', 'Failed to initialize storage system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS storage_servers (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        server_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        protocol VARCHAR(20) NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL,
        path TEXT NOT NULL,
        credentials JSONB NOT NULL,
        config JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        capacity JSONB NOT NULL,
        monitoring JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_health_check TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS storage_backups (
        id VARCHAR(255) PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        source_path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        compression_enabled BOOLEAN DEFAULT TRUE,
        encryption_enabled BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) NOT NULL,
        progress INTEGER DEFAULT 0,
        size BIGINT DEFAULT 0,
        compressed_size BIGINT DEFAULT 0,
        checksum VARCHAR(255),
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        duration INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS storage_syncs (
        id VARCHAR(255) PRIMARY KEY,
        source_server_id VARCHAR(255) NOT NULL,
        target_server_id VARCHAR(255) NOT NULL,
        source_path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        sync_type VARCHAR(20) NOT NULL,
        sync_method VARCHAR(20) NOT NULL,
        schedule VARCHAR(100),
        exclude_patterns JSONB,
        include_patterns JSONB,
        delete_extra BOOLEAN DEFAULT FALSE,
        compression_enabled BOOLEAN DEFAULT TRUE,
        encryption_enabled BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) NOT NULL,
        last_sync TIMESTAMP,
        next_sync TIMESTAMP,
        progress INTEGER DEFAULT 0,
        total_files INTEGER DEFAULT 0,
        synced_files INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS storage_files (
        id VARCHAR(255) PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        path TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        size BIGINT NOT NULL,
        type VARCHAR(20) NOT NULL,
        permissions VARCHAR(20),
        owner VARCHAR(255),
        group_name VARCHAR(255),
        created_at TIMESTAMP NOT NULL,
        modified_at TIMESTAMP NOT NULL,
        accessed_at TIMESTAMP NOT NULL,
        checksum VARCHAR(255),
        is_encrypted BOOLEAN DEFAULT FALSE,
        version INTEGER DEFAULT 1,
        tags JSONB
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS storage_metrics (
        id SERIAL PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        read_speed DECIMAL(10,2),
        write_speed DECIMAL(10,2),
        iops INTEGER,
        latency INTEGER,
        throughput DECIMAL(10,2),
        error_count INTEGER,
        connection_count INTEGER
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_storage_servers_server_id ON storage_servers(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_storage_backups_server_id ON storage_backups(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_storage_syncs_source_server_id ON storage_syncs(source_server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_storage_files_server_id ON storage_files(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_storage_metrics_server_id_timestamp ON storage_metrics(server_id, timestamp)');
  }

  private async loadStorageServers(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM storage_servers');
      
      for (const row of rows) {
        const server: StorageServer = {
          id: row.id,
          name: row.name,
          serverId: row.server_id,
          type: row.type,
          protocol: row.protocol,
          host: row.host,
          port: row.port,
          path: row.path,
          credentials: row.credentials,
          config: row.config,
          status: row.status,
          capacity: row.capacity,
          monitoring: row.monitoring,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastHealthCheck: row.last_health_check
        };
        
        this.storageServers.set(server.id, server);
      }
      
      this.logger.info('storage-system', `Loaded ${this.storageServers.size} storage servers`);
    } catch (error) {
      this.logger.error('storage-system', 'Failed to load storage servers', error as Error);
    }
  }

  private async loadBackups(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM storage_backups');
      
      for (const row of rows) {
        const backup: StorageBackup = {
          id: row.id,
          serverId: row.server_id,
          type: row.type,
          sourcePath: row.source_path,
          targetPath: row.target_path,
          compressionEnabled: row.compression_enabled,
          encryptionEnabled: row.encryption_enabled,
          status: row.status,
          progress: row.progress,
          size: row.size,
          compressedSize: row.compressed_size,
          checksum: row.checksum,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          duration: row.duration,
          errorMessage: row.error_message,
          createdAt: row.created_at
        };
        
        if (!this.backups.has(backup.serverId)) {
          this.backups.set(backup.serverId, []);
        }
        this.backups.get(backup.serverId)!.push(backup);
      }
      
      this.logger.info('storage-system', `Loaded ${Array.from(this.backups.values()).reduce((sum, backups) => sum + backups.length, 0)} storage backups`);
    } catch (error) {
      this.logger.error('storage-system', 'Failed to load storage backups', error as Error);
    }
  }

  private async loadSyncs(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM storage_syncs');
      
      for (const row of rows) {
        const sync: StorageSync = {
          id: row.id,
          sourceServerId: row.source_server_id,
          targetServerId: row.target_server_id,
          sourcePath: row.source_path,
          targetPath: row.target_path,
          syncType: row.sync_type,
          syncMethod: row.sync_method,
          schedule: row.schedule,
          excludePatterns: row.exclude_patterns || [],
          includePatterns: row.include_patterns || [],
          deleteExtra: row.delete_extra,
          compressionEnabled: row.compression_enabled,
          encryptionEnabled: row.encryption_enabled,
          status: row.status,
          lastSync: row.last_sync,
          nextSync: row.next_sync,
          progress: row.progress,
          totalFiles: row.total_files,
          syncedFiles: row.synced_files,
          errorCount: row.error_count,
          lastError: row.last_error,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.syncs.set(sync.id, sync);
      }
      
      this.logger.info('storage-system', `Loaded ${this.syncs.size} storage syncs`);
    } catch (error) {
      this.logger.error('storage-system', 'Failed to load storage syncs', error as Error);
    }
  }

  private async startAllMonitoring(): Promise<void> {
    for (const [serverId, storageServer] of this.storageServers.entries()) {
      if (storageServer.status === 'active' && storageServer.monitoring.enabled) {
        await this.startMonitoring(serverId);
      }
    }
  }

  private async startAllBackupSchedules(): Promise<void> {
    for (const [serverId, storageServer] of this.storageServers.entries()) {
      if (storageServer.status === 'active' && storageServer.config.backupEnabled) {
        await this.startBackupSchedule(serverId);
      }
    }
  }

  private async startAllSyncSchedules(): Promise<void> {
    for (const [syncId, sync] of this.syncs.entries()) {
      if (sync.status === 'active' && sync.schedule) {
        await this.startSyncSchedule(syncId);
      }
    }
  }

  async createStorageServer(config: {
    name: string;
    serverId: string;
    type: StorageServer['type'];
    protocol: StorageServer['protocol'];
    host?: string;
    port?: number;
    path: string;
    credentials?: Partial<StorageCredentials>;
    config?: Partial<StorageConfig>;
  }): Promise<string> {
    const serverId = `storage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate server exists
      const server = this.serverProviders.getServer(config.serverId);
      if (!server) {
        throw new Error('Server not found');
      }

      const storageServer: StorageServer = {
        id: serverId,
        name: config.name,
        serverId: config.serverId,
        type: config.type,
        protocol: config.protocol,
        host: config.host || server.ipAddress,
        port: config.port || this.getDefaultPort(config.protocol),
        path: config.path,
        credentials: {
          username: config.credentials?.username || 'storage',
          password: config.credentials?.password || this.generatePassword(),
          ...config.credentials
        },
        config: {
          encryptionEnabled: false,
          compressionEnabled: true,
          deduplicationEnabled: false,
          cachingEnabled: true,
          cacheSize: 1024,
          replicationEnabled: false,
          replicationTargets: [],
          backupEnabled: true,
          backupSchedule: '0 2 * * *', // Daily at 2 AM
          retentionDays: 30,
          versioningEnabled: false,
          maxVersions: 5,
          accessControl: 'private',
          allowedIPs: [],
          customSettings: {},
          ...config.config
        },
        status: 'inactive',
        capacity: {
          total: 0,
          used: 0,
          available: 0,
          usagePercentage: 0,
          files: 0,
          directories: 0,
          lastUpdated: new Date()
        },
        monitoring: {
          enabled: true,
          metricsInterval: 300,
          alertThresholds: {
            diskUsage: 85,
            fileCount: 1000000,
            errorRate: 5,
            responseTime: 5000
          },
          performanceMetrics: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO storage_servers (
          id, name, server_id, type, protocol, host, port, path,
          credentials, config, status, capacity, monitoring,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        storageServer.id,
        storageServer.name,
        storageServer.serverId,
        storageServer.type,
        storageServer.protocol,
        storageServer.host,
        storageServer.port,
        storageServer.path,
        JSON.stringify(storageServer.credentials),
        JSON.stringify(storageServer.config),
        storageServer.status,
        JSON.stringify(storageServer.capacity),
        JSON.stringify(storageServer.monitoring),
        storageServer.createdAt,
        storageServer.updatedAt
      ]);

      this.storageServers.set(serverId, storageServer);

      // Initialize storage server
      await this.initializeStorageServer(serverId);

      this.logger.info('storage-system', `Storage server created: ${storageServer.name}`, {
        serverId,
        type: config.type,
        protocol: config.protocol,
        host: storageServer.host,
        path: config.path
      });

      this.emit('storageServerCreated', storageServer);
      return serverId;

    } catch (error) {
      this.logger.error('storage-system', `Failed to create storage server: ${config.name}`, error as Error);
      throw error;
    }
  }

  private async initializeStorageServer(serverId: string): Promise<void> {
    const storageServer = this.storageServers.get(serverId);
    if (!storageServer) throw new Error('Storage server not found');

    try {
      const connection = await this.getSSHConnection(storageServer.serverId);
      if (!connection) {
        throw new Error('SSH connection not available');
      }

      // Create storage directory
      await this.sshConnect.executeCommand(connection.id, `sudo mkdir -p ${storageServer.path}`, 10000);
      await this.sshConnect.executeCommand(connection.id, `sudo chown -R ${storageServer.credentials.username}:${storageServer.credentials.username} ${storageServer.path}`, 10000);

      // Configure based on protocol
      switch (storageServer.protocol) {
        case 'nfs':
          await this.configureNFS(connection.id, storageServer);
          break;
        case 'smb':
          await this.configureSMB(connection.id, storageServer);
          break;
        case 'ftp':
          await this.configureFTP(connection.id, storageServer);
          break;
        case 'sftp':
          await this.configureSFTP(connection.id, storageServer);
          break;
      }

      // Get initial capacity
      await this.updateCapacity(storageServer);

      storageServer.status = 'active';
      storageServer.updatedAt = new Date();
      storageServer.lastHealthCheck = new Date();
      await this.updateStorageServer(storageServer);

      // Start monitoring
      if (storageServer.monitoring.enabled) {
        await this.startMonitoring(serverId);
      }

      // Start backup schedule
      if (storageServer.config.backupEnabled) {
        await this.startBackupSchedule(serverId);
      }

      this.logger.info('storage-system', `Storage server initialized: ${storageServer.name}`, {
        serverId,
        protocol: storageServer.protocol,
        path: storageServer.path
      });

      this.emit('storageServerInitialized', storageServer);

    } catch (error) {
      storageServer.status = 'error';
      await this.updateStorageServer(storageServer);
      this.logger.error('storage-system', `Failed to initialize storage server: ${storageServer.name}`, error as Error);
      throw error;
    }
  }

  private async configureNFS(connectionId: string, storageServer: StorageServer): Promise<void> {
    // Install NFS server
    await this.sshConnect.executeCommand(connectionId, 'sudo apt update && sudo apt install -y nfs-kernel-server', 120000);
    
    // Configure exports
    const exportsEntry = `${storageServer.path} *(rw,sync,no_subtree_check)`;
    await this.sshConnect.executeCommand(connectionId, `echo '${exportsEntry}' | sudo tee -a /etc/exports`, 10000);
    
    // Restart NFS service
    await this.sshConnect.executeCommand(connectionId, 'sudo exportfs -a', 10000);
    await this.sshConnect.executeCommand(connectionId, 'sudo systemctl restart nfs-kernel-server', 10000);
  }

  private async configureSMB(connectionId: string, storageServer: StorageServer): Promise<void> {
    // Install Samba
    await this.sshConnect.executeCommand(connectionId, 'sudo apt update && sudo apt install -y samba', 120000);
    
    // Create SMB user
    await this.sshConnect.executeCommand(connectionId, `sudo smbpasswd -a ${storageServer.credentials.username}`, 10000);
    
    // Configure smb.conf
    const config = `
[${storageServer.name}]
path = ${storageServer.path}
browseable = yes
writable = yes
guest ok = no
read only = no
valid users = ${storageServer.credentials.username}
`;
    
    await this.sshConnect.executeCommand(connection.id, `echo '${config}' | sudo tee -a /etc/samba/smb.conf`, 10000);
    
    // Restart Samba service
    await this.sshConnect.executeCommand(connectionId, 'sudo systemctl restart smbd nmbd', 10000);
  }

  private async configureFTP(connectionId: string, storageServer: StorageServer): Promise<void> {
    // Install FTP server (vsftpd)
    await this.sshConnect.executeCommand(connectionId, 'sudo apt update && sudo apt install -y vsftpd', 120000);
    
    // Configure vsftpd
    const config = `
listen=YES
anonymous_enable=NO
local_enable=YES
write_enable=YES
chroot_local_user=YES
allow_writeable_chroot=YES
pasv_enable=YES
pasv_min_port=40000
pasv_max_port=40100
`;
    
    await this.sshConnect.executeCommand(connectionId, `echo '${config}' | sudo tee /etc/vsftpd.conf`, 10000);
    
    // Restart FTP service
    await this.sshConnect.executeCommand(connectionId, 'sudo systemctl restart vsftpd', 10000);
  }

  private async configureSFTP(connectionId: string, storageServer: StorageServer): Promise<void> {
    // SFTP is usually part of SSH server
    // Create dedicated SFTP user if needed
    await this.sshConnect.executeCommand(connectionId, `sudo useradd -m -d ${storageServer.path} ${storageServer.credentials.username}`, 10000);
    await this.sshConnect.executeCommand(connectionId, `echo '${storageServer.credentials.username}:${storageServer.credentials.password}' | sudo chpasswd`, 10000);
  }

  private async updateCapacity(storageServer: StorageServer): Promise<void> {
    try {
      const connection = await this.getSSHConnection(storageServer.serverId);
      if (!connection) return;

      // Get disk usage
      const duResult = await this.sshConnect.executeCommand(connection.id, `df -B1 ${storageServer.path} | tail -1`, 10000);
      const duParts = duResult.stdout.trim().split(/\s+/);
      
      const total = parseInt(duParts[1]) || 0;
      const used = parseInt(duParts[2]) || 0;
      const available = parseInt(duParts[3]) || 0;

      // Get file and directory counts
      const fileCountResult = await this.sshConnect.executeCommand(connection.id, `find ${storageServer.path} -type f | wc -l`, 30000);
      const dirCountResult = await this.sshConnect.executeCommand(connection.id, `find ${storageServer.path} -type d | wc -l`, 30000);

      storageServer.capacity = {
        total,
        used,
        available,
        usagePercentage: total > 0 ? (used / total) * 100 : 0,
        files: parseInt(fileCountResult.stdout.trim()) || 0,
        directories: parseInt(dirCountResult.stdout.trim()) || 0,
        lastUpdated: new Date()
      };

    } catch (error) {
      this.logger.error('storage-system', `Failed to update capacity for storage server: ${storageServer.name}`, error as Error);
    }
  }

  private async startMonitoring(serverId: string): Promise<void> {
    const storageServer = this.storageServers.get(serverId);
    if (!storageServer || !storageServer.monitoring.enabled) return;

    // Stop existing monitoring
    await this.stopMonitoring(serverId);

    const interval = setInterval(async () => {
      await this.collectMetrics(serverId);
      await this.updateCapacity(storageServer);
    }, storageServer.monitoring.metricsInterval * 1000);

    this.monitoringIntervals.set(serverId, interval);
    
    // Collect initial metrics
    await this.collectMetrics(serverId);
    
    this.logger.info('storage-system', `Started monitoring for storage server: ${storageServer.name}`, {
      serverId,
      interval: storageServer.monitoring.metricsInterval
    });
  }

  private async stopMonitoring(serverId: string): Promise<void> {
    const interval = this.monitoringIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(serverId);
    }
  }

  private async collectMetrics(serverId: string): Promise<void> {
    const storageServer = this.storageServers.get(serverId);
    if (!storageServer || storageServer.status !== 'active') return;

    try {
      const connection = await this.getSSHConnection(storageServer.serverId);
      if (!connection) return;

      // Perform performance test
      const testFile = `${storageServer.path}/.performance_test`;
      
      // Write test
      const writeStart = Date.now();
      await this.sshConnect.executeCommand(connection.id, `dd if=/dev/zero of=${testFile} bs=1M count=100 2>/dev/null`, 30000);
      const writeTime = Date.now() - writeStart;
      const writeSpeed = (100 * 1024 * 1024) / (writeTime / 1000) / (1024 * 1024); // MB/s

      // Read test
      const readStart = Date.now();
      await this.sshConnect.executeCommand(connection.id, `dd if=${testFile} of=/dev/null bs=1M 2>/dev/null`, 30000);
      const readTime = Date.now() - readStart;
      const readSpeed = (100 * 1024 * 1024) / (readTime / 1000) / (1024 * 1024); // MB/s

      // Clean up test file
      await this.sshConnect.executeCommand(connection.id, `rm -f ${testFile}`, 5000);

      const metrics: StoragePerformanceMetrics = {
        timestamp: new Date(),
        readSpeed,
        writeSpeed,
        iops: 0, // Would need more sophisticated testing
        latency: (writeTime + readTime) / 2,
        throughput: (readSpeed + writeSpeed) / 2,
        errorCount: 0,
        connectionCount: 1
      };

      // Store metrics
      await this.database.query(`
        INSERT INTO storage_metrics (
          server_id, timestamp, read_speed, write_speed, iops,
          latency, throughput, error_count, connection_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        serverId,
        metrics.timestamp,
        metrics.readSpeed,
        metrics.writeSpeed,
        metrics.iops,
        metrics.latency,
        metrics.throughput,
        metrics.errorCount,
        metrics.connectionCount
      ]);

      // Store in memory
      storageServer.monitoring.performanceMetrics.push(metrics);
      
      // Keep only last 1000 metrics
      if (storageServer.monitoring.performanceMetrics.length > 1000) {
        storageServer.monitoring.performanceMetrics.splice(0, storageServer.monitoring.performanceMetrics.length - 1000);
      }

      // Check alert thresholds
      await this.checkAlertThresholds(storageServer, metrics);

      this.emit('metricsCollected', { serverId, metrics });

    } catch (error) {
      this.logger.error('storage-system', `Failed to collect metrics for storage server: ${storageServer.name}`, error as Error);
    }
  }

  private async checkAlertThresholds(storageServer: StorageServer, metrics: StoragePerformanceMetrics): Promise<void> {
    const thresholds = storageServer.monitoring.alertThresholds;
    
    if (storageServer.capacity.usagePercentage > thresholds.diskUsage) {
      this.emit('alert', {
        serverId: storageServer.id,
        type: 'disk_usage_high',
        value: storageServer.capacity.usagePercentage,
        threshold: thresholds.diskUsage
      });
    }
    
    if (metrics.latency > thresholds.responseTime) {
      this.emit('alert', {
        serverId: storageServer.id,
        type: 'response_time_high',
        value: metrics.latency,
        threshold: thresholds.responseTime
      });
    }
  }

  private async startBackupSchedule(serverId: string): Promise<void> {
    const storageServer = this.storageServers.get(serverId);
    if (!storageServer || !storageServer.config.backupEnabled) return;

    // Stop existing backup schedule
    await this.stopBackupSchedule(serverId);

    // Parse cron schedule (simplified - would use proper cron parser)
    // For now, schedule daily backups
    const interval = setInterval(async () => {
      await this.createBackup(serverId, 'full');
    }, 24 * 60 * 60 * 1000); // 24 hours

    this.backupIntervals.set(serverId, interval);
    
    this.logger.info('storage-system', `Scheduled backups for storage server: ${storageServer.name}`, {
      serverId,
      schedule: storageServer.config.backupSchedule
    });
  }

  private async stopBackupSchedule(serverId: string): Promise<void> {
    const interval = this.backupIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.backupIntervals.delete(serverId);
    }
  }

  async createBackup(serverId: string, type: StorageBackup['type'] = 'full'): Promise<string> {
    const storageServer = this.storageServers.get(serverId);
    if (!storageServer) throw new Error('Storage server not found');

    const backupId = `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const backup: StorageBackup = {
        id: backupId,
        serverId,
        type,
        sourcePath: storageServer.path,
        targetPath: `${storageServer.path}/backups/backup-${Date.now()}`,
        compressionEnabled: storageServer.config.compressionEnabled,
        encryptionEnabled: storageServer.config.encryptionEnabled,
        status: 'running',
        progress: 0,
        size: 0,
        compressedSize: 0,
        checksum: '',
        startedAt: new Date(),
        createdAt: new Date()
      };

      // Store backup in database
      await this.database.query(`
        INSERT INTO storage_backups (
          id, server_id, type, source_path, target_path,
          compression_enabled, encryption_enabled, status,
          started_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        backup.id,
        backup.serverId,
        backup.type,
        backup.sourcePath,
        backup.targetPath,
        backup.compressionEnabled,
        backup.encryptionEnabled,
        backup.status,
        backup.startedAt,
        backup.createdAt
      ]);

      if (!this.backups.has(serverId)) {
        this.backups.set(serverId, []);
      }
      this.backups.get(serverId)!.push(backup);

      // Perform backup
      await this.performBackup(backup);

      this.logger.info('storage-system', `Storage backup created: ${backup.type}`, {
        backupId,
        serverId,
        type: backup.type,
        size: backup.size
      });

      this.emit('backupCreated', backup);
      return backupId;

    } catch (error) {
      this.logger.error('storage-system', `Failed to create storage backup: ${storageServer.name}`, error as Error);
      throw error;
    }
  }

  private async performBackup(backup: StorageBackup): Promise<void> {
    const storageServer = this.storageServers.get(backup.serverId);
    if (!storageServer) throw new Error('Storage server not found');

    try {
      const connection = await this.getSSHConnection(storageServer.serverId);
      if (!connection) throw new Error('SSH connection not available');

      // Create backup directory
      await this.sshConnect.executeCommand(connection.id, `mkdir -p ${backup.targetPath}`, 10000);

      // Build rsync command
      let command = `rsync -av`;
      
      if (backup.compressionEnabled) {
        command += 'z';
      }
      
      if (backup.encryptionEnabled) {
        command += 'e';
      }
      
      command += ` --progress ${backup.sourcePath}/ ${backup.targetPath}/`;

      // Execute backup
      const result = await this.sshConnect.executeCommand(connection.id, command, 3600000); // 1 hour timeout
      
      if (!result.success) {
        throw new Error(`Backup command failed: ${result.stderr}`);
      }

      // Get backup size
      const sizeResult = await this.sshConnect.executeCommand(connection.id, `du -sb ${backup.targetPath} | cut -f1`, 10000);
      backup.size = parseInt(sizeResult.stdout.trim()) || 0;

      // Calculate checksum
      const checksumResult = await this.sshConnect.executeCommand(connection.id, `find ${backup.targetPath} -type f -exec sha256sum {} + | awk '{print $1}' | sort | sha256sum | cut -d' ' -f1`, 30000);
      backup.checksum = checksumResult.stdout.trim();

      backup.status = 'completed';
      backup.completedAt = new Date();
      backup.duration = backup.completedAt.getTime() - backup.startedAt.getTime();
      backup.progress = 100;

      // Update database
      await this.database.query(`
        UPDATE storage_backups 
        SET status = 'completed', size = $1, checksum = $2,
        completed_at = $3, duration = $4, progress = 100 
        WHERE id = $5
      `, [backup.size, backup.checksum, backup.completedAt, backup.duration, backup.id]);

    } catch (error) {
      backup.status = 'failed';
      backup.errorMessage = error.message;
      
      await this.database.query(`
        UPDATE storage_backups 
        SET status = 'failed', error_message = $1 
        WHERE id = $2
      `, [backup.errorMessage, backup.id]);

      throw error;
    }
  }

  async createStorageSync(config: {
    sourceServerId: string;
    targetServerId: string;
    sourcePath: string;
    targetPath: string;
    syncType: StorageSync['syncType'];
    syncMethod: StorageSync['syncMethod'];
    schedule?: string;
    excludePatterns?: string[];
    includePatterns?: string[];
    deleteExtra?: boolean;
    compressionEnabled?: boolean;
    encryptionEnabled?: boolean;
  }): Promise<string> {
    const syncId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const sync: StorageSync = {
        id: syncId,
        sourceServerId: config.sourceServerId,
        targetServerId: config.targetServerId,
        sourcePath: config.sourcePath,
        targetPath: config.targetPath,
        syncType: config.syncType,
        syncMethod: config.syncMethod,
        schedule: config.schedule || '0 */6 * * *', // Every 6 hours
        excludePatterns: config.excludePatterns || [],
        includePatterns: config.includePatterns || [],
        deleteExtra: config.deleteExtra || false,
        compressionEnabled: config.compressionEnabled !== false,
        encryptionEnabled: config.encryptionEnabled || false,
        status: 'active',
        totalFiles: 0,
        syncedFiles: 0,
        errorCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO storage_syncs (
          id, source_server_id, target_server_id, source_path, target_path,
          sync_type, sync_method, schedule, exclude_patterns, include_patterns,
          delete_extra, compression_enabled, encryption_enabled, status,
          total_files, synced_files, error_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `, [
        sync.id,
        sync.sourceServerId,
        sync.targetServerId,
        sync.sourcePath,
        sync.targetPath,
        sync.syncType,
        sync.syncMethod,
        sync.schedule,
        JSON.stringify(sync.excludePatterns),
        JSON.stringify(sync.includePatterns),
        sync.deleteExtra,
        sync.compressionEnabled,
        sync.encryptionEnabled,
        sync.status,
        sync.totalFiles,
        sync.syncedFiles,
        sync.errorCount,
        sync.createdAt,
        sync.updatedAt
      ]);

      this.syncs.set(syncId, sync);

      // Start sync schedule
      if (sync.schedule) {
        await this.startSyncSchedule(syncId);
      }

      this.logger.info('storage-system', `Storage sync created: ${sync.sourcePath} -> ${sync.targetPath}`, {
        syncId,
        sourceServerId: config.sourceServerId,
        targetServerId: config.targetServerId,
        syncMethod: config.syncMethod
      });

      this.emit('storageSyncCreated', sync);
      return syncId;

    } catch (error) {
      this.logger.error('storage-system', `Failed to create storage sync`, error as Error);
      throw error;
    }
  }

  private async startSyncSchedule(syncId: string): Promise<void> {
    const sync = this.syncs.get(syncId);
    if (!sync || !sync.schedule) return;

    // Stop existing sync schedule
    await this.stopSyncSchedule(syncId);

    // Parse cron schedule (simplified)
    // For now, schedule every 6 hours
    const interval = setInterval(async () => {
      await this.performSync(syncId);
    }, 6 * 60 * 60 * 1000); // 6 hours

    this.syncIntervals.set(syncId, interval);
    
    this.logger.info('storage-system', `Scheduled sync: ${sync.sourcePath} -> ${sync.targetPath}`, {
      syncId,
      schedule: sync.schedule
    });
  }

  private async stopSyncSchedule(syncId: string): Promise<void> {
    const interval = this.syncIntervals.get(syncId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(syncId);
    }
  }

  private async performSync(syncId: string): Promise<void> {
    const sync = this.syncs.get(syncId);
    if (!sync) return;

    try {
      sync.status = 'syncing';
      sync.updatedAt = new Date();

      await this.database.query(`
        UPDATE storage_syncs 
        SET status = 'syncing', updated_at = $1 
        WHERE id = $2
      `, [sync.updatedAt, syncId]);

      const sourceConnection = await this.getSSHConnection(sync.sourceServerId);
      const targetConnection = await this.getSSHConnection(sync.targetServerId);
      
      if (!sourceConnection || !targetConnection) {
        throw new Error('SSH connections not available');
      }

      // Build rsync command
      let command = `rsync -av`;
      
      if (sync.compressionEnabled) {
        command += 'z';
      }
      
      if (sync.deleteExtra) {
        command += ' --delete';
      }
      
      for (const pattern of sync.excludePatterns) {
        command += ` --exclude '${pattern}'`;
      }
      
      for (const pattern of sync.includePatterns) {
        command += ` --include '${pattern}'`;
      }
      
      command += ` ${sync.sourcePath}/ ${sync.targetPath}/`;

      // Execute sync (this is simplified - would need proper SSH key setup)
      this.logger.info('storage-system', `Performing storage sync: ${sync.sourcePath} -> ${sync.targetPath}`, {
        syncId,
        command
      });

      sync.status = 'active';
      sync.lastSync = new Date();
      sync.errorCount = 0;
      sync.lastError = undefined;
      sync.updatedAt = new Date();

      await this.database.query(`
        UPDATE storage_syncs 
        SET status = 'active', last_sync = $1, error_count = $2,
        last_error = $3, updated_at = $4 
        WHERE id = $5
      `, [sync.lastSync, sync.errorCount, sync.lastError, sync.updatedAt, syncId]);

      this.emit('storageSyncCompleted', sync);

    } catch (error) {
      sync.status = 'error';
      sync.errorCount++;
      sync.lastError = error.message;
      sync.updatedAt = new Date();

      await this.database.query(`
        UPDATE storage_syncs 
        SET status = 'error', error_count = $1, last_error = $2, updated_at = $3 
        WHERE id = $4
      `, [sync.errorCount, sync.lastError, sync.updatedAt, syncId]);

      this.logger.error('storage-system', `Storage sync failed: ${sync.sourcePath} -> ${sync.targetPath}`, error as Error);
    }
  }

  private async updateStorageServer(storageServer: StorageServer): Promise<void> {
    await this.database.query(`
      UPDATE storage_servers 
      SET status = $1, capacity = $2, monitoring = $3, updated_at = $4, last_health_check = $5 
      WHERE id = $6
    `, [
      storageServer.status,
      JSON.stringify(storageServer.capacity),
      JSON.stringify(storageServer.monitoring),
      storageServer.updatedAt,
      storageServer.lastHealthCheck,
      storageServer.id
    ]);
  }

  private getDefaultPort(protocol: string): number {
    const ports: Record<string, number> = {
      nfs: 2049,
      smb: 445,
      ftp: 21,
      sftp: 22,
      s3: 443,
      azure: 443,
      gcs: 443
    };
    return ports[protocol] || 22;
  }

  private generatePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  private async getSSHConnection(serverId: string): Promise<any> {
    const connections = await this.sshConnect.getConnectionsByUserId('system');
    return connections.find(c => c.serverId === serverId);
  }

  // Public API methods
  async getStorageServer(serverId: string): Promise<StorageServer | null> {
    return this.storageServers.get(serverId) || null;
  }

  async getStorageServersByHost(hostServerId: string): Promise<StorageServer[]> {
    return Array.from(this.storageServers.values()).filter(s => s.serverId === hostServerId);
  }

  async getStorageBackups(serverId: string): Promise<StorageBackup[]> {
    return this.backups.get(serverId) || [];
  }

  async getStorageSync(syncId: string): Promise<StorageSync | null> {
    return this.syncs.get(syncId) || null;
  }

  async getStorageStats(): Promise<{
    totalServers: number;
    activeServers: number;
    totalCapacity: number;
    usedCapacity: number;
    totalBackups: number;
    totalSyncs: number;
    activeSyncs: number;
  }> {
    const servers = Array.from(this.storageServers.values());
    const backups = Array.from(this.backups.values()).flat();
    
    return {
      totalServers: servers.length,
      activeServers: servers.filter(s => s.status === 'active').length,
      totalCapacity: servers.reduce((sum, s) => sum + s.capacity.total, 0),
      usedCapacity: servers.reduce((sum, s) => sum + s.capacity.used, 0),
      totalBackups: backups.length,
      totalSyncs: this.syncs.size,
      activeSyncs: Array.from(this.syncs.values()).filter(s => s.status === 'active').length
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    storageServersCount: number;
    activeServersCount: number;
    monitoringActive: number;
    backupSchedulesActive: number;
    syncSchedulesActive: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getStorageStats();
    
    if (stats.activeServers < stats.totalServers) {
      issues.push(`${stats.totalServers - stats.activeServers} storage servers are not active`);
    }
    
    if (stats.totalServers === 0) {
      issues.push('No storage servers configured');
    }

    return {
      healthy: issues.length === 0,
      storageServersCount: stats.totalServers,
      activeServersCount: stats.activeServers,
      monitoringActive: this.monitoringIntervals.size,
      backupSchedulesActive: this.backupIntervals.size,
      syncSchedulesActive: this.syncIntervals.size,
      issues
    };
  }

  async destroy(): Promise<void> {
    // Stop all monitoring
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    
    // Stop all backup schedules
    for (const interval of this.backupIntervals.values()) {
      clearInterval(interval);
    }
    
    // Stop all sync schedules
    for (const interval of this.syncIntervals.values()) {
      clearInterval(interval);
    }
    
    this.monitoringIntervals.clear();
    this.backupIntervals.clear();
    this.syncIntervals.clear();
    
    this.logger.info('storage-system', 'Storage system shut down');
  }
}

export default UltraStorageSystem;
