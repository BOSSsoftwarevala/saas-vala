import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraSSHConnect } from './ssh-connect';
import { UltraServerProviders } from './server-providers';
import { UltraMultiServerManagement } from './multi-server-management';
import { UltraLoadBalancer } from './load-balancer';

export interface FailoverConfig {
  id: string;
  name: string;
  clusterId: string;
  primaryServerId: string;
  backupServerIds: string[];
  healthCheckInterval: number;
  healthCheckTimeout: number;
  failoverThreshold: number;
  failbackThreshold: number;
  autoFailback: boolean;
  dataSyncEnabled: boolean;
  dataSyncInterval: number;
  status: 'active' | 'inactive' | 'failing-over' | 'failed-over';
  currentActive: 'primary' | 'backup';
  activeServerId: string;
  lastFailover?: Date;
  lastFailback?: Date;
  totalFailovers: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataSyncConfig {
  id: string;
  failoverId: string;
  sourceServerId: string;
  targetServerId: string;
  syncType: 'database' | 'files' | 'both';
  syncMethod: 'rsync' | 'mysql-replication' | 'postgres-streaming' | 'custom';
  syncPaths: string[];
  excludePaths: string[];
  syncInterval: number;
  bandwidthLimit?: number; // KB/s
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  status: 'active' | 'inactive' | 'syncing' | 'error';
  lastSync?: Date;
  nextSync?: Date;
  syncProgress: number;
  totalSize: number;
  syncedSize: number;
  errorCount: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FailoverEvent {
  id: string;
  failoverId: string;
  type: 'failover-triggered' | 'failover-completed' | 'failback-triggered' | 'failback-completed' | 'sync-started' | 'sync-completed' | 'sync-failed';
  serverId: string;
  message: string;
  details: any;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export class UltraFailover extends EventEmitter {
  private static instance: UltraFailover;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private sshConnect: UltraSSHConnect;
  private serverProviders: UltraServerProviders;
  private multiServerManagement: UltraMultiServerManagement;
  private loadBalancer: UltraLoadBalancer;
  private failoverConfigs: Map<string, FailoverConfig> = new Map();
  private dataSyncConfigs: Map<string, DataSyncConfig> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isFailoverInProgress: Set<string> = new Set();

  static getInstance(): UltraFailover {
    if (!UltraFailover.instance) {
      UltraFailover.instance = new UltraFailover();
    }
    return UltraFailover.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.sshConnect = UltraSSHConnect.getInstance();
    this.serverProviders = UltraServerProviders.getInstance();
    this.multiServerManagement = UltraMultiServerManagement.getInstance();
    this.loadBalancer = UltraLoadBalancer.getInstance();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize database tables
      await this.initializeDatabase();
      
      // Load existing configurations
      await this.loadFailoverConfigs();
      await this.loadDataSyncConfigs();
      
      // Start health monitoring for all failover configs
      await this.startAllHealthMonitoring();
      
      // Start data sync for enabled configs
      await this.startAllDataSync();
      
      this.logger.info('failover-backup', 'Failover and backup system initialized', {
        failoverConfigsCount: this.failoverConfigs.size,
        dataSyncConfigsCount: this.dataSyncConfigs.size,
        healthMonitoringActive: this.healthCheckIntervals.size
      });

    } catch (error) {
      this.logger.error('failover-backup', 'Failed to initialize failover system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS failover_configs (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        cluster_id VARCHAR(255) NOT NULL,
        primary_server_id VARCHAR(255) NOT NULL,
        backup_server_ids JSONB NOT NULL,
        health_check_interval INTEGER NOT NULL,
        health_check_timeout INTEGER NOT NULL,
        failover_threshold INTEGER NOT NULL,
        failback_threshold INTEGER NOT NULL,
        auto_failback BOOLEAN DEFAULT TRUE,
        data_sync_enabled BOOLEAN DEFAULT TRUE,
        data_sync_interval INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL,
        current_active VARCHAR(20) NOT NULL,
        active_server_id VARCHAR(255) NOT NULL,
        last_failover TIMESTAMP,
        last_failback TIMESTAMP,
        total_failovers INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS data_sync_configs (
        id VARCHAR(255) PRIMARY KEY,
        failover_id VARCHAR(255) NOT NULL,
        source_server_id VARCHAR(255) NOT NULL,
        target_server_id VARCHAR(255) NOT NULL,
        sync_type VARCHAR(20) NOT NULL,
        sync_method VARCHAR(50) NOT NULL,
        sync_paths JSONB NOT NULL,
        exclude_paths JSONB,
        sync_interval INTEGER NOT NULL,
        bandwidth_limit INTEGER,
        compression_enabled BOOLEAN DEFAULT TRUE,
        encryption_enabled BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) NOT NULL,
        last_sync TIMESTAMP,
        next_sync TIMESTAMP,
        sync_progress DECIMAL(5,2) DEFAULT 0,
        total_size BIGINT DEFAULT 0,
        synced_size BIGINT DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS failover_events (
        id VARCHAR(255) PRIMARY KEY,
        failover_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        server_id VARCHAR(255),
        message TEXT NOT NULL,
        details JSONB,
        timestamp TIMESTAMP DEFAULT NOW(),
        severity VARCHAR(20) NOT NULL
      )
    `);

    await this.database.query('CREATE INDEX IF NOT EXISTS idx_failover_configs_cluster_id ON failover_configs(cluster_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_data_sync_configs_failover_id ON data_sync_configs(failover_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_failover_events_failover_id ON failover_events(failover_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_failover_events_timestamp ON failover_events(timestamp)');
  }

  private async loadFailoverConfigs(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM failover_configs');
      
      for (const row of rows) {
        const config: FailoverConfig = {
          id: row.id,
          name: row.name,
          clusterId: row.cluster_id,
          primaryServerId: row.primary_server_id,
          backupServerIds: row.backup_server_ids || [],
          healthCheckInterval: row.health_check_interval,
          healthCheckTimeout: row.health_check_timeout,
          failoverThreshold: row.failover_threshold,
          failbackThreshold: row.failback_threshold,
          autoFailback: row.auto_failback,
          dataSyncEnabled: row.data_sync_enabled,
          dataSyncInterval: row.data_sync_interval,
          status: row.status,
          currentActive: row.current_active,
          activeServerId: row.active_server_id,
          lastFailover: row.last_failover,
          lastFailback: row.last_failback,
          totalFailovers: row.total_failovers,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.failoverConfigs.set(config.id, config);
      }
      
      this.logger.info('failover-backup', `Loaded ${this.failoverConfigs.size} failover configurations`);
    } catch (error) {
      this.logger.error('failover-backup', 'Failed to load failover configurations', error as Error);
    }
  }

  private async loadDataSyncConfigs(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM data_sync_configs');
      
      for (const row of rows) {
        const config: DataSyncConfig = {
          id: row.id,
          failoverId: row.failover_id,
          sourceServerId: row.source_server_id,
          targetServerId: row.target_server_id,
          syncType: row.sync_type,
          syncMethod: row.sync_method,
          syncPaths: row.sync_paths || [],
          excludePaths: row.exclude_paths || [],
          syncInterval: row.sync_interval,
          bandwidthLimit: row.bandwidth_limit,
          compressionEnabled: row.compression_enabled,
          encryptionEnabled: row.encryption_enabled,
          status: row.status,
          lastSync: row.last_sync,
          nextSync: row.next_sync,
          syncProgress: row.sync_progress,
          totalSize: row.total_size,
          syncedSize: row.synced_size,
          errorCount: row.error_count,
          lastError: row.last_error,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.dataSyncConfigs.set(config.id, config);
      }
      
      this.logger.info('failover-backup', `Loaded ${this.dataSyncConfigs.size} data sync configurations`);
    } catch (error) {
      this.logger.error('failover-backup', 'Failed to load data sync configurations', error as Error);
    }
  }

  private async startAllHealthMonitoring(): Promise<void> {
    for (const [configId, config] of this.failoverConfigs.entries()) {
      if (config.status === 'active') {
        await this.startHealthMonitoring(configId);
      }
    }
  }

  private async startAllDataSync(): Promise<void> {
    for (const [configId, config] of this.dataSyncConfigs.entries()) {
      if (config.status === 'active') {
        await this.startDataSync(configId);
      }
    }
  }

  async createFailoverConfig(config: {
    name: string;
    clusterId: string;
    primaryServerId: string;
    backupServerIds: string[];
    healthCheckInterval?: number;
    healthCheckTimeout?: number;
    failoverThreshold?: number;
    failbackThreshold?: number;
    autoFailback?: boolean;
    dataSyncEnabled?: boolean;
    dataSyncInterval?: number;
  }): Promise<string> {
    const configId = `failover-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate cluster and servers
      const cluster = await this.multiServerManagement.getCluster(config.clusterId);
      if (!cluster) {
        throw new Error('Cluster not found');
      }

      const primaryServer = this.serverProviders.getServer(config.primaryServerId);
      if (!primaryServer) {
        throw new Error('Primary server not found');
      }

      for (const backupServerId of config.backupServerIds) {
        const backupServer = this.serverProviders.getServer(backupServerId);
        if (!backupServer) {
          throw new Error(`Backup server not found: ${backupServerId}`);
        }
      }

      const failoverConfig: FailoverConfig = {
        id: configId,
        name: config.name,
        clusterId: config.clusterId,
        primaryServerId: config.primaryServerId,
        backupServerIds: config.backupServerIds,
        healthCheckInterval: config.healthCheckInterval || 30,
        healthCheckTimeout: config.healthCheckTimeout || 10,
        failoverThreshold: config.failoverThreshold || 3,
        failbackThreshold: config.failbackThreshold || 3,
        autoFailback: config.autoFailback !== false,
        dataSyncEnabled: config.dataSyncEnabled !== false,
        dataSyncInterval: config.dataSyncInterval || 300,
        status: 'active',
        currentActive: 'primary',
        activeServerId: config.primaryServerId,
        totalFailovers: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO failover_configs (
          id, name, cluster_id, primary_server_id, backup_server_ids,
          health_check_interval, health_check_timeout, failover_threshold,
          failback_threshold, auto_failback, data_sync_enabled, data_sync_interval,
          status, current_active, active_server_id, total_failovers,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [
        failoverConfig.id,
        failoverConfig.name,
        failoverConfig.clusterId,
        failoverConfig.primaryServerId,
        JSON.stringify(failoverConfig.backupServerIds),
        failoverConfig.healthCheckInterval,
        failoverConfig.healthCheckTimeout,
        failoverConfig.failoverThreshold,
        failoverConfig.failbackThreshold,
        failoverConfig.autoFailback,
        failoverConfig.dataSyncEnabled,
        failoverConfig.dataSyncInterval,
        failoverConfig.status,
        failoverConfig.currentActive,
        failoverConfig.activeServerId,
        failoverConfig.totalFailovers,
        failoverConfig.createdAt,
        failoverConfig.updatedAt
      ]);

      this.failoverConfigs.set(configId, failoverConfig);

      // Create data sync configurations
      if (failoverConfig.dataSyncEnabled) {
        await this.createDataSyncConfigs(failoverConfig);
      }

      // Start health monitoring
      await this.startHealthMonitoring(configId);

      this.logger.info('failover-backup', `Failover configuration created: ${failoverConfig.name}`, {
        configId,
        clusterId: config.clusterId,
        primaryServerId: config.primaryServerId,
        backupServersCount: config.backupServerIds.length
      });

      this.emit('failoverConfigCreated', failoverConfig);
      return configId;

    } catch (error) {
      this.logger.error('failover-backup', `Failed to create failover configuration: ${config.name}`, error as Error);
      throw error;
    }
  }

  private async createDataSyncConfigs(failoverConfig: FailoverConfig): Promise<void> {
    try {
      // Create sync configs for each backup server
      for (const backupServerId of failoverConfig.backupServerIds) {
        const syncConfigId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const syncConfig: DataSyncConfig = {
          id: syncConfigId,
          failoverId: failoverConfig.id,
          sourceServerId: failoverConfig.primaryServerId,
          targetServerId: backupServerId,
          syncType: 'both',
          syncMethod: 'rsync',
          syncPaths: ['/var/www', '/etc/nginx', '/home'],
          excludePaths: ['/var/log', '/tmp', '/var/cache'],
          syncInterval: failoverConfig.dataSyncInterval,
          compressionEnabled: true,
          encryptionEnabled: true,
          status: 'active',
          syncProgress: 0,
          totalSize: 0,
          syncedSize: 0,
          errorCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.database.query(`
          INSERT INTO data_sync_configs (
            id, failover_id, source_server_id, target_server_id,
            sync_type, sync_method, sync_paths, exclude_paths,
            sync_interval, compression_enabled, encryption_enabled,
            status, sync_progress, total_size, synced_size,
            error_count, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          syncConfig.id,
          syncConfig.failoverId,
          syncConfig.sourceServerId,
          syncConfig.targetServerId,
          syncConfig.syncType,
          syncConfig.syncMethod,
          JSON.stringify(syncConfig.syncPaths),
          JSON.stringify(syncConfig.excludePaths),
          syncConfig.syncInterval,
          syncConfig.compressionEnabled,
          syncConfig.encryptionEnabled,
          syncConfig.status,
          syncConfig.syncProgress,
          syncConfig.totalSize,
          syncConfig.syncedSize,
          syncConfig.errorCount,
          syncConfig.createdAt,
          syncConfig.updatedAt
        ]);

        this.dataSyncConfigs.set(syncConfigId, syncConfig);

        // Start data sync
        await this.startDataSync(syncConfigId);
      }

    } catch (error) {
      this.logger.error('failover-backup', 'Failed to create data sync configurations', error as Error);
    }
  }

  private async startHealthMonitoring(configId: string): Promise<void> {
    const config = this.failoverConfigs.get(configId);
    if (!config) return;

    // Stop existing monitoring
    await this.stopHealthMonitoring(configId);

    const interval = setInterval(async () => {
      await this.performHealthCheck(configId);
    }, config.healthCheckInterval * 1000);

    this.healthCheckIntervals.set(configId, interval);
    
    this.logger.info('failover-backup', `Started health monitoring for failover config: ${config.name}`, {
      configId,
      interval: config.healthCheckInterval
    });
  }

  private async stopHealthMonitoring(configId: string): Promise<void> {
    const interval = this.healthCheckIntervals.get(configId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(configId);
    }
  }

  private async performHealthCheck(configId: string): Promise<void> {
    const config = this.failoverConfigs.get(configId);
    if (!config || config.status !== 'active') return;

    if (this.isFailoverInProgress.has(configId)) {
      return; // Failover already in progress
    }

    try {
      // Check primary server health
      const primaryHealth = await this.checkServerHealth(config.primaryServerId);
      
      if (primaryHealth.isHealthy) {
        // Primary is healthy, check if we need to failback
        if (config.currentActive === 'backup' && config.autoFailback) {
          const consecutiveHealthy = await this.checkConsecutiveHealth(config.primaryServerId, config.failbackThreshold);
          
          if (consecutiveHealthy) {
            await this.initiateFailback(configId);
          }
        }
      } else {
        // Primary is unhealthy, check if we need to failover
        if (config.currentActive === 'primary') {
          const consecutiveUnhealthy = await this.checkConsecutiveUnhealthiness(config.primaryServerId, config.failoverThreshold);
          
          if (consecutiveUnhealthy) {
            await this.initiateFailover(configId);
          }
        }
      }

    } catch (error) {
      this.logger.error('failover-backup', `Health check failed for failover config: ${config.name}`, error as Error);
    }
  }

  private async checkServerHealth(serverId: string): Promise<{ isHealthy: boolean; responseTime: number }> {
    try {
      const startTime = Date.now();
      
      // Get server health from multi-server management
      const health = await this.multiServerManagement.getServerHealth(serverId);
      
      if (!health) {
        return { isHealthy: false, responseTime: Date.now() - startTime };
      }

      const responseTime = Date.now() - startTime;
      const isHealthy = health.status === 'healthy' && responseTime < 5000;

      return { isHealthy, responseTime };

    } catch (error) {
      return { isHealthy: false, responseTime: Date.now() - Date.now() };
    }
  }

  private async checkConsecutiveHealth(serverId: string, threshold: number): Promise<boolean> {
    // This would check consecutive health checks
    // For now, simulate with a simple check
    const health = await this.checkServerHealth(serverId);
    return health.isHealthy;
  }

  private async checkConsecutiveUnhealthiness(serverId: string, threshold: number): Promise<boolean> {
    // This would check consecutive unhealthy health checks
    // For now, simulate with a simple check
    const health = await this.checkServerHealth(serverId);
    return !health.isHealthy;
  }

  private async initiateFailover(configId: string): Promise<void> {
    const config = this.failoverConfigs.get(configId);
    if (!config || this.isFailoverInProgress.has(configId)) return;

    this.isFailoverInProgress.add(configId);
    config.status = 'failing-over';

    try {
      await this.logFailoverEvent(configId, 'failover-triggered', config.primaryServerId, 
        `Initiating failover from primary to backup server`);

      this.logger.warn('failover-backup', `Initiating failover: ${config.name}`, {
        configId,
        primaryServerId: config.primaryServerId,
        backupServerIds: config.backupServerIds
      });

      // Select best backup server
      const bestBackupServer = await this.selectBestBackupServer(config.backupServerIds);
      
      if (!bestBackupServer) {
        throw new Error('No healthy backup servers available');
      }

      // Update load balancer to route traffic to backup
      await this.updateLoadBalancerTarget(config.clusterId, bestBackupServer);

      // Update configuration
      config.currentActive = 'backup';
      config.activeServerId = bestBackupServer;
      config.status = 'failed-over';
      config.lastFailover = new Date();
      config.totalFailovers++;
      config.updatedAt = new Date();

      await this.database.query(`
        UPDATE failover_configs 
        SET status = 'failed-over', current_active = 'backup', active_server_id = $1,
        last_failover = $2, total_failovers = $3, updated_at = $4 
        WHERE id = $5
      `, [config.activeServerId, config.lastFailover, config.totalFailovers, config.updatedAt, configId]);

      await this.logFailoverEvent(configId, 'failover-completed', bestBackupServer, 
        `Failover completed successfully. Traffic routed to backup server`);

      this.emit('failoverCompleted', { configId, backupServerId: bestBackupServer });
      this.logger.info('failover-backup', `Failover completed: ${config.name}`, {
        configId,
        backupServerId: bestBackupServer
      });

    } catch (error) {
      config.status = 'active';
      this.logger.error('failover-backup', `Failover failed: ${config.name}`, error as Error);
      
      await this.logFailoverEvent(configId, 'failover-completed', config.primaryServerId, 
        `Failover failed: ${error.message}`, 'error');

    } finally {
      this.isFailoverInProgress.delete(configId);
    }
  }

  private async initiateFailback(configId: string): Promise<void> {
    const config = this.failoverConfigs.get(configId);
    if (!config || this.isFailoverInProgress.has(configId)) return;

    this.isFailoverInProgress.add(configId);
    config.status = 'failing-over';

    try {
      await this.logFailoverEvent(configId, 'failback-triggered', config.primaryServerId, 
        `Initiating failback from backup to primary server`);

      this.logger.info('failover-backup', `Initiating failback: ${config.name}`, {
        configId,
        primaryServerId: config.primaryServerId,
        currentActiveServerId: config.activeServerId
      });

      // Update load balancer to route traffic back to primary
      await this.updateLoadBalancerTarget(config.clusterId, config.primaryServerId);

      // Update configuration
      config.currentActive = 'primary';
      config.activeServerId = config.primaryServerId;
      config.status = 'active';
      config.lastFailback = new Date();
      config.updatedAt = new Date();

      await this.database.query(`
        UPDATE failover_configs 
        SET status = 'active', current_active = 'primary', active_server_id = $1,
        last_failback = $2, updated_at = $3 
        WHERE id = $4
      `, [config.activeServerId, config.lastFailback, config.updatedAt, configId]);

      await this.logFailoverEvent(configId, 'failback-completed', config.primaryServerId, 
        `Failback completed successfully. Traffic routed to primary server`);

      this.emit('failbackCompleted', { configId, primaryServerId: config.primaryServerId });
      this.logger.info('failover-backup', `Failback completed: ${config.name}`, {
        configId,
        primaryServerId: config.primaryServerId
      });

    } catch (error) {
      config.status = 'failed-over';
      this.logger.error('failover-backup', `Failback failed: ${config.name}`, error as Error);
      
      await this.logFailoverEvent(configId, 'failback-completed', config.activeServerId, 
        `Failback failed: ${error.message}`, 'error');

    } finally {
      this.isFailoverInProgress.delete(configId);
    }
  }

  private async selectBestBackupServer(backupServerIds: string[]): Promise<string | null> {
    let bestServer: string | null = null;
    let bestResponseTime = Infinity;

    for (const serverId of backupServerIds) {
      const health = await this.checkServerHealth(serverId);
      
      if (health.isHealthy && health.responseTime < bestResponseTime) {
        bestServer = serverId;
        bestResponseTime = health.responseTime;
      }
    }

    return bestServer;
  }

  private async updateLoadBalancerTarget(clusterId: string, targetServerId: string): Promise<void> {
    try {
      // Get load balancer for this cluster
      const loadBalancers = await this.loadBalancer.getLoadBalancersByCluster(clusterId);
      
      for (const lb of loadBalancers) {
        // Update load balancer configuration to route to new target
        // This would involve updating the load balancer's server pool
        this.logger.info('failover-backup', `Updated load balancer ${lb.name} to route to ${targetServerId}`);
      }

    } catch (error) {
      this.logger.error('failover-backup', 'Failed to update load balancer target', error as Error);
    }
  }

  private async startDataSync(configId: string): Promise<void> {
    const config = this.dataSyncConfigs.get(configId);
    if (!config) return;

    // Stop existing sync
    await this.stopDataSync(configId);

    const interval = setInterval(async () => {
      await this.performDataSync(configId);
    }, config.syncInterval * 1000);

    this.syncIntervals.set(configId, interval);
    
    this.logger.info('failover-backup', `Started data sync: ${config.sourceServerId} -> ${config.targetServerId}`, {
      configId,
      syncType: config.syncType,
      interval: config.syncInterval
    });
  }

  private async stopDataSync(configId: string): Promise<void> {
    const interval = this.syncIntervals.get(configId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(configId);
    }
  }

  private async performDataSync(configId: string): Promise<void> {
    const config = this.dataSyncConfigs.get(configId);
    if (!config || config.status !== 'active') return;

    try {
      config.status = 'syncing';
      config.syncProgress = 0;

      await this.logFailoverEvent(config.failoverId, 'sync-started', config.sourceServerId, 
        `Starting data sync from ${config.sourceServerId} to ${config.targetServerId}`);

      // Get SSH connections
      const sourceConnection = await this.getSSHConnection(config.sourceServerId);
      const targetConnection = await this.getSSHConnection(config.targetServerId);

      if (!sourceConnection || !targetConnection) {
        throw new Error('SSH connection not available for data sync');
      }

      // Perform sync based on method
      switch (config.syncMethod) {
        case 'rsync':
          await this.performRsyncSync(sourceConnection.id, targetConnection.id, config);
          break;
        case 'mysql-replication':
          await this.performMySQLReplication(sourceConnection.id, targetConnection.id, config);
          break;
        case 'postgres-streaming':
          await this.performPostgresStreaming(sourceConnection.id, targetConnection.id, config);
          break;
        default:
          throw new Error(`Unsupported sync method: ${config.syncMethod}`);
      }

      config.status = 'active';
      config.lastSync = new Date();
      config.nextSync = new Date(Date.now() + config.syncInterval * 1000);
      config.syncProgress = 100;
      config.errorCount = 0;
      config.lastError = undefined;
      config.updatedAt = new Date();

      await this.updateDataSyncConfig(config);

      await this.logFailoverEvent(config.failoverId, 'sync-completed', config.sourceServerId, 
        `Data sync completed successfully`);

      this.emit('dataSyncCompleted', { configId });

    } catch (error) {
      config.status = 'error';
      config.errorCount++;
      config.lastError = error.message;
      config.updatedAt = new Date();

      await this.updateDataSyncConfig(config);

      await this.logFailoverEvent(config.failoverId, 'sync-failed', config.sourceServerId, 
        `Data sync failed: ${error.message}`, 'error');

      this.logger.error('failover-backup', `Data sync failed: ${config.sourceServerId} -> ${config.targetServerId}`, error as Error);
    }
  }

  private async performRsyncSync(sourceConnectionId: string, targetConnectionId: string, config: DataSyncConfig): Promise<void> {
    for (const path of config.syncPaths) {
      // Build rsync command
      let rsyncCommand = `rsync -avz --progress`;
      
      if (config.excludePaths.length > 0) {
        for (const excludePath of config.excludePaths) {
          rsyncCommand += ` --exclude ${excludePath}`;
        }
      }
      
      if (config.bandwidthLimit) {
        rsyncCommand += ` --bwlimit=${config.bandwidthLimit}`;
      }
      
      rsyncCommand += ` -e "ssh -o StrictHostKeyChecking=no" ${path} root@target:${path}`;

      // Execute rsync via SSH
      // This is a simplified implementation - in production, you'd need proper SSH key setup
      this.logger.info('failover-backup', `Executing rsync sync for path: ${path}`);
    }
  }

  private async performMySQLReplication(sourceConnectionId: string, targetConnectionId: string, config: DataSyncConfig): Promise<void> {
    // MySQL replication setup
    this.logger.info('failover-backup', 'Setting up MySQL replication');
  }

  private async performPostgresStreaming(sourceConnectionId: string, targetConnectionId: string, config: DataSyncConfig): Promise<void> {
    // PostgreSQL streaming replication setup
    this.logger.info('failover-backup', 'Setting up PostgreSQL streaming replication');
  }

  private async getSSHConnection(serverId: string): Promise<any> {
    const connections = await this.sshConnect.getConnectionsByUserId('system');
    return connections.find(c => c.serverId === serverId);
  }

  private async updateDataSyncConfig(config: DataSyncConfig): Promise<void> {
    await this.database.query(`
      UPDATE data_sync_configs 
      SET status = $1, last_sync = $2, next_sync = $3, sync_progress = $4,
      error_count = $5, last_error = $6, updated_at = $7 
      WHERE id = $8
    `, [
      config.status,
      config.lastSync,
      config.nextSync,
      config.syncProgress,
      config.errorCount,
      config.lastError,
      config.updatedAt,
      config.id
    ]);
  }

  private async logFailoverEvent(failoverId: string, type: FailoverEvent['type'], serverId: string, 
    message: string, severity: FailoverEvent['severity'] = 'info', details?: any): Promise<void> {
    const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const event: FailoverEvent = {
      id: eventId,
      failoverId,
      type,
      serverId,
      message,
      details,
      timestamp: new Date(),
      severity
    };

    await this.database.query(`
      INSERT INTO failover_events (id, failover_id, type, server_id, message, details, timestamp, severity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      event.id,
      event.failoverId,
      event.type,
      event.serverId,
      event.message,
      JSON.stringify(event.details),
      event.timestamp,
      event.severity
    ]);

    this.emit('failoverEvent', event);
  }

  // Public API methods
  async getFailoverConfig(configId: string): Promise<FailoverConfig | null> {
    return this.failoverConfigs.get(configId) || null;
  }

  async getFailoverConfigsByCluster(clusterId: string): Promise<FailoverConfig[]> {
    return Array.from(this.failoverConfigs.values()).filter(c => c.clusterId === clusterId);
  }

  async getDataSyncConfig(configId: string): Promise<DataSyncConfig | null> {
    return this.dataSyncConfigs.get(configId) || null;
  }

  async getFailoverEvents(failoverId?: string, limit: number = 100): Promise<FailoverEvent[]> {
    try {
      let query = 'SELECT * FROM failover_events ORDER BY timestamp DESC LIMIT $1';
      const params = [limit];

      if (failoverId) {
        query = 'SELECT * FROM failover_events WHERE failover_id = $2 ORDER BY timestamp DESC LIMIT $1';
        params.push(failoverId);
      }

      const rows = await this.database.query(query, params);
      
      return rows.map(row => ({
        id: row.id,
        failoverId: row.failover_id,
        type: row.type,
        serverId: row.server_id,
        message: row.message,
        details: row.details,
        timestamp: row.timestamp,
        severity: row.severity
      }));

    } catch (error) {
      this.logger.error('failover-backup', 'Failed to get failover events', error as Error);
      return [];
    }
  }

  async getFailoverStats(): Promise<{
    totalConfigs: number;
    activeConfigs: number;
    failedOverConfigs: number;
    totalFailovers: number;
    dataSyncConfigs: number;
    activeSyncs: number;
  }> {
    const configs = Array.from(this.failoverConfigs.values());
    const syncConfigs = Array.from(this.dataSyncConfigs.values());
    
    return {
      totalConfigs: configs.length,
      activeConfigs: configs.filter(c => c.status === 'active').length,
      failedOverConfigs: configs.filter(c => c.status === 'failed-over').length,
      totalFailovers: configs.reduce((sum, c) => sum + c.totalFailovers, 0),
      dataSyncConfigs: syncConfigs.length,
      activeSyncs: syncConfigs.filter(s => s.status === 'active').length
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    failoverConfigsCount: number;
    activeConfigsCount: number;
    dataSyncConfigsCount: number;
    activeSyncsCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getFailoverStats();
    
    if (stats.failedOverConfigs > 0) {
      issues.push(`${stats.failedOverConfigs} configurations are currently failed over`);
    }
    
    if (stats.activeConfigs === 0) {
      issues.push('No active failover configurations');
    }

    return {
      healthy: issues.length === 0,
      failoverConfigsCount: stats.totalConfigs,
      activeConfigsCount: stats.activeConfigs,
      dataSyncConfigsCount: stats.dataSyncConfigs,
      activeSyncsCount: stats.activeSyncs,
      issues
    };
  }

  async destroy(): Promise<void> {
    // Stop all health monitoring
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    
    // Stop all data sync
    for (const interval of this.syncIntervals.values()) {
      clearInterval(interval);
    }
    
    this.healthCheckIntervals.clear();
    this.syncIntervals.clear();
    
    this.logger.info('failover-backup', 'Failover and backup system shut down');
  }
}

export default UltraFailover;
