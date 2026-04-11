import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { UltraLogger } from './logger';
import { UltraHealthMonitor } from './health-monitor';
import { UltraDatabase } from './database';

const execAsync = promisify(exec);

export interface FailoverConfig {
  primaryServer: {
    host: string;
    port: number;
    healthEndpoint: string;
  };
  backupServer: {
    host: string;
    port: number;
    healthEndpoint: string;
  };
  failoverThreshold: number; // Number of consecutive failures before failover
  healthCheckInterval: number; // milliseconds
  maxFailoverTime: number; // Maximum time to complete failover
  autoFailback: boolean; // Automatically switch back when primary is healthy
  failbackDelay: number; // Delay before attempting failback
  dataSyncInterval: number; // Interval for data synchronization
}

export interface FailoverStatus {
  isActive: boolean;
  currentServer: 'primary' | 'backup';
  lastFailover?: Date;
  lastFailback?: Date;
  failoverCount: number;
  consecutiveFailures: number;
  isHealthy: boolean;
  lastHealthCheck: Date;
  dataSyncStatus: 'syncing' | 'synced' | 'error';
}

export class UltraFailover extends EventEmitter {
  private static instance: UltraFailover;
  private config: FailoverConfig;
  private logger: UltraLogger;
  private healthMonitor: UltraHealthMonitor;
  private database: UltraDatabase;
  private status: FailoverStatus;
  private healthCheckInterval?: NodeJS.Timeout;
  private dataSyncInterval?: NodeJS.Timeout;
  private isFailoverInProgress: boolean = false;
  private lastHealthCheckResult: boolean = true;

  static getInstance(config?: FailoverConfig): UltraFailover {
    if (!UltraFailover.instance) {
      UltraFailover.instance = new UltraFailover(config);
    }
    return UltraFailover.instance;
  }

  constructor(config?: FailoverConfig) {
    super();
    this.logger = UltraLogger.getInstance();
    this.healthMonitor = UltraHealthMonitor.getInstance();
    this.database = UltraDatabase.getInstance();
    
    this.config = {
      primaryServer: {
        host: process.env.PRIMARY_SERVER_HOST || 'localhost',
        port: parseInt(process.env.PRIMARY_SERVER_PORT || '3000'),
        healthEndpoint: process.env.PRIMARY_HEALTH_ENDPOINT || '/health'
      },
      backupServer: {
        host: process.env.BACKUP_SERVER_HOST || 'backup.localhost',
        port: parseInt(process.env.BACKUP_SERVER_PORT || '3000'),
        healthEndpoint: process.env.BACKUP_HEALTH_ENDPOINT || '/health'
      },
      failoverThreshold: parseInt(process.env.FAILOVER_THRESHOLD || '3'),
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '10000'),
      maxFailoverTime: parseInt(process.env.MAX_FAILOVER_TIME || '30000'),
      autoFailback: process.env.AUTO_FAILBACK !== 'false',
      failbackDelay: parseInt(process.env.FAILBACK_DELAY || '300000'), // 5 minutes
      dataSyncInterval: parseInt(process.env.DATA_SYNC_INTERVAL || '60000'), // 1 minute
      ...config
    };

    this.status = {
      isActive: false,
      currentServer: 'primary',
      failoverCount: 0,
      consecutiveFailures: 0,
      isHealthy: true,
      lastHealthCheck: new Date(),
      dataSyncStatus: 'synced'
    };
  }

  async startFailoverMonitoring(): Promise<void> {
    this.logger.info('failover', 'Starting failover monitoring system');
    
    // Start health monitoring
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Start data synchronization
    this.dataSyncInterval = setInterval(async () => {
      await this.synchronizeData();
    }, this.config.dataSyncInterval);

    // Initial health check
    await this.performHealthCheck();
    
    this.logger.info('failover', 'Failover monitoring started', {
      primaryServer: this.config.primaryServer,
      backupServer: this.config.backupServer,
      threshold: this.config.failoverThreshold
    });
  }

  async stopFailoverMonitoring(): Promise<void> {
    this.logger.info('failover', 'Stopping failover monitoring');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.dataSyncInterval) {
      clearInterval(this.dataSyncInterval);
    }
    
    this.logger.info('failover', 'Failover monitoring stopped');
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const isHealthy = await this.checkServerHealth(this.config.primaryServer);
      this.lastHealthCheckResult = isHealthy;
      this.status.lastHealthCheck = new Date();
      this.status.isHealthy = isHealthy;

      if (isHealthy) {
        this.status.consecutiveFailures = 0;
        
        // Check if we should failback to primary
        if (this.config.autoFailback && this.status.currentServer === 'backup') {
          await this.attemptFailback();
        }
      } else {
        this.status.consecutiveFailures++;
        this.logger.warn('failover', `Primary server health check failed (${this.status.consecutiveFailures}/${this.config.failoverThreshold})`);
        
        if (this.status.consecutiveFailures >= this.config.failoverThreshold && !this.isFailoverInProgress) {
          await this.initiateFailover();
        }
      }

      this.emit('healthCheck', {
        server: 'primary',
        healthy: isHealthy,
        consecutiveFailures: this.status.consecutiveFailures
      });

    } catch (error) {
      this.logger.error('failover', 'Health check failed', error as Error);
      this.status.consecutiveFailures++;
      
      if (this.status.consecutiveFailures >= this.config.failoverThreshold && !this.isFailoverInProgress) {
        await this.initiateFailover();
      }
    }
  }

  private async checkServerHealth(server: { host: string; port: number; healthEndpoint: string }): Promise<boolean> {
    try {
      const url = `http://${server.host}:${server.port}${server.healthEndpoint}`;
      const { stdout } = await execAsync(`curl -f -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}"`);
      return stdout.trim() === '200';
    } catch (error) {
      return false;
    }
  }

  private async initiateFailover(): Promise<void> {
    if (this.isFailoverInProgress) {
      this.logger.warn('failover', 'Failover already in progress');
      return;
    }

    this.isFailoverInProgress = true;
    this.logger.critical('failover', 'Initiating failover to backup server');

    try {
      const startTime = Date.now();
      
      // Step 1: Verify backup server is healthy
      const backupHealthy = await this.checkServerHealth(this.config.backupServer);
      if (!backupHealthy) {
        throw new Error('Backup server is not healthy');
      }

      // Step 2: Synchronize data to backup
      await this.performFinalDataSync();

      // Step 3: Update DNS/load balancer to point to backup
      await this.updateTrafficRouting('backup');

      // Step 4: Verify failover is working
      const failoverVerified = await this.verifyFailover();
      if (!failoverVerified) {
        throw new Error('Failover verification failed');
      }

      // Step 5: Update status
      this.status.isActive = true;
      this.status.currentServer = 'backup';
      this.status.lastFailover = new Date();
      this.status.failoverCount++;
      this.status.consecutiveFailures = 0;

      const duration = Date.now() - startTime;
      this.logger.info('failover', `Failover completed successfully in ${duration}ms`);

      this.emit('failover', {
        from: 'primary',
        to: 'backup',
        duration,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.critical('failover', 'Failover failed', error as Error);
      
      // Try to revert to primary if possible
      try {
        await this.updateTrafficRouting('primary');
      } catch (revertError) {
        this.logger.critical('failover', 'Failed to revert to primary', revertError as Error);
      }

      this.emit('failoverFailed', {
        error: error.message,
        timestamp: new Date()
      });

    } finally {
      this.isFailoverInProgress = false;
    }
  }

  private async attemptFailback(): Promise<void> {
    if (!this.status.lastFailover) {
      return;
    }

    const timeSinceFailover = Date.now() - this.status.lastFailover.getTime();
    if (timeSinceFailover < this.config.failbackDelay) {
      return; // Not enough time has passed
    }

    this.logger.info('failover', 'Attempting failback to primary server');

    try {
      // Verify primary is healthy
      const primaryHealthy = await this.checkServerHealth(this.config.primaryServer);
      if (!primaryHealthy) {
        this.logger.warn('failover', 'Primary server not healthy, postponing failback');
        return;
      }

      // Synchronize data back to primary
      await this.synchronizeDataToPrimary();

      // Update routing to primary
      await this.updateTrafficRouting('primary');

      // Verify failback
      const failbackVerified = await this.verifyFailback();
      if (!failbackVerified) {
        throw new Error('Failback verification failed');
      }

      // Update status
      this.status.isActive = false;
      this.status.currentServer = 'primary';
      this.status.lastFailback = new Date();

      this.logger.info('failover', 'Failback to primary server completed');

      this.emit('failback', {
        from: 'backup',
        to: 'primary',
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error('failover', 'Failback failed', error as Error);
    }
  }

  private async synchronizeData(): Promise<void> {
    if (this.status.currentServer === 'primary') {
      await this.synchronizeDataToBackup();
    } else {
      await this.synchronizeDataToPrimary();
    }
  }

  private async synchronizeDataToBackup(): Promise<void> {
    try {
      this.status.dataSyncStatus = 'syncing';
      
      // Database synchronization
      await this.syncDatabaseToBackup();
      
      // File synchronization
      await this.syncFilesToBackup();
      
      // Configuration synchronization
      await this.syncConfigurationToBackup();
      
      this.status.dataSyncStatus = 'synced';
      this.logger.debug('failover', 'Data synchronized to backup');
      
    } catch (error) {
      this.status.dataSyncStatus = 'error';
      this.logger.error('failover', 'Data synchronization to backup failed', error as Error);
    }
  }

  private async synchronizeDataToPrimary(): Promise<void> {
    try {
      this.status.dataSyncStatus = 'syncing';
      
      // Database synchronization from backup to primary
      await this.syncDatabaseToPrimary();
      
      // File synchronization from backup to primary
      await this.syncFilesToPrimary();
      
      // Configuration synchronization from backup to primary
      await this.syncConfigurationToPrimary();
      
      this.status.dataSyncStatus = 'synced';
      this.logger.debug('failover', 'Data synchronized to primary');
      
    } catch (error) {
      this.status.dataSyncStatus = 'error';
      this.logger.error('failover', 'Data synchronization to primary failed', error as Error);
    }
  }

  private async performFinalDataSync(): Promise<void> {
    this.logger.info('failover', 'Performing final data sync before failover');
    
    // Ensure all pending transactions are completed
    await this.database.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = \'idle in transaction\' AND datname = current_database()');
    
    // Wait for any ongoing operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Perform final sync
    await this.synchronizeDataToBackup();
  }

  private async syncDatabaseToBackup(): Promise<void> {
    try {
      // Create database backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `/tmp/failover-db-backup-${timestamp}.sql`;
      
      await execAsync(`PGPASSWORD="${process.env.DB_PASSWORD}" pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} > ${backupFile}`);
      
      // Transfer to backup server
      await execAsync(`scp ${backupFile} ${this.config.backupServer.host}:/tmp/`);
      
      // Restore on backup server
      await execAsync(`ssh ${this.config.backupServer.host} "PGPASSWORD=${process.env.DB_PASSWORD} psql -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} < /tmp/failover-db-backup-${timestamp}.sql"`);
      
      // Cleanup
      await execAsync(`rm ${backupFile}`);
      await execAsync(`ssh ${this.config.backupServer.host} "rm /tmp/failover-db-backup-${timestamp}.sql"`);
      
    } catch (error) {
      throw new Error(`Database sync to backup failed: ${error.message}`);
    }
  }

  private async syncDatabaseToPrimary(): Promise<void> {
    try {
      // Similar process but from backup to primary
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `/tmp/failover-db-restore-${timestamp}.sql`;
      
      await execAsync(`ssh ${this.config.backupServer.host} "PGPASSWORD=${process.env.DB_PASSWORD} pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME}" > ${backupFile}`);
      
      await execAsync(`PGPASSWORD="${process.env.DB_PASSWORD}" psql -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} < ${backupFile}`);
      
      await execAsync(`rm ${backupFile}`);
      
    } catch (error) {
      throw new Error(`Database sync to primary failed: ${error.message}`);
    }
  }

  private async syncFilesToBackup(): Promise<void> {
    try {
      // Sync application files
      await execAsync(`rsync -avz --delete /var/www/saasvala-site/ ${this.config.backupServer.host}:/var/www/saasvala-site/`);
      
      // Sync uploaded files
      await execAsync(`rsync -avz --delete /var/uploads/ ${this.config.backupServer.host}:/var/uploads/`);
      
    } catch (error) {
      throw new Error(`File sync to backup failed: ${error.message}`);
    }
  }

  private async syncFilesToPrimary(): Promise<void> {
    try {
      // Sync files from backup to primary
      await execAsync(`rsync -avz --delete ${this.config.backupServer.host}:/var/www/saasvala-site/ /var/www/saasvala-site/`);
      await execAsync(`rsync -avz --delete ${this.config.backupServer.host}:/var/uploads/ /var/uploads/`);
      
    } catch (error) {
      throw new Error(`File sync to primary failed: ${error.message}`);
    }
  }

  private async syncConfigurationToBackup(): Promise<void> {
    try {
      // Sync configuration files
      await execAsync(`scp /etc/nginx/sites-available/saasvala.conf ${this.config.backupServer.host}:/etc/nginx/sites-available/`);
      await execAsync(`scp .env ${this.config.backupServer.host}:/var/www/saasvala-site/`);
      
    } catch (error) {
      throw new Error(`Configuration sync to backup failed: ${error.message}`);
    }
  }

  private async syncConfigurationToPrimary(): Promise<void> {
    try {
      // Sync configuration from backup to primary
      await execAsync(`scp ${this.config.backupServer.host}:/etc/nginx/sites-available/saasvala.conf /etc/nginx/sites-available/`);
      await execAsync(`scp ${this.config.backupServer.host}:/var/www/saasvala-site/.env /var/www/saasvala-site/`);
      
    } catch (error) {
      throw new Error(`Configuration sync to primary failed: ${error.message}`);
    }
  }

  private async updateTrafficRouting(targetServer: 'primary' | 'backup'): Promise<void> {
    try {
      const server = targetServer === 'primary' ? this.config.primaryServer : this.config.backupServer;
      
      // Update load balancer configuration
      if (process.env.LOAD_BALANCER_TYPE === 'nginx') {
        await this.updateNginxLoadBalancer(server);
      } else if (process.env.LOAD_BALANCER_TYPE === 'haproxy') {
        await this.updateHAProxyLoadBalancer(server);
      }
      
      // Update DNS if configured
      if (process.env.DNS_PROVIDER) {
        await this.updateDNSRecord(server);
      }
      
      this.logger.info('failover', `Traffic routing updated to ${targetServer} server`);
      
    } catch (error) {
      throw new Error(`Traffic routing update failed: ${error.message}`);
    }
  }

  private async updateNginxLoadBalancer(server: { host: string; port: number }): Promise<void> {
    const config = `
upstream saasvala_backend {
    server ${server.host}:${server.port};
}

server {
    listen 80;
    server_name saasvala.com www.saasvala.com;
    
    location / {
        proxy_pass http://saasvala_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
    
    fs.writeFileSync('/etc/nginx/sites-available/saasvala-lb.conf', config);
    await execAsync('nginx -t && systemctl reload nginx');
  }

  private async updateHAProxyLoadBalancer(server: { host: string; port: number }): Promise<void> {
    const config = `
backend saasvala_backend
    server primary ${server.host}:${server.port} check
`;
    
    fs.writeFileSync('/etc/haproxy/haproxy.cfg', config);
    await execAsync('systemctl reload haproxy');
  }

  private async updateDNSRecord(server: { host: string; port: number }): Promise<void> {
    // Implementation depends on DNS provider
    // This is a placeholder for DNS API calls
    this.logger.info('failover', `DNS record would be updated to ${server.host}`);
  }

  private async verifyFailover(): Promise<boolean> {
    try {
      // Wait a moment for routing to propagate
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Test the main endpoint through the load balancer
      const { stdout } = await execAsync('curl -f -s -o /dev/null -w "%{http_code}" http://saasvala.com/health');
      
      return stdout.trim() === '200';
      
    } catch (error) {
      return false;
    }
  }

  private async verifyFailback(): Promise<boolean> {
    // Similar to verifyFailover but for failback
    return await this.verifyFailover();
  }

  // Manual failover control
  async manualFailover(): Promise<void> {
    if (this.isFailoverInProgress) {
      throw new Error('Failover already in progress');
    }
    
    this.logger.info('failover', 'Manual failover initiated');
    await this.initiateFailover();
  }

  async manualFailback(): Promise<void> {
    if (this.status.currentServer !== 'backup') {
      throw new Error('Not currently failed over');
    }
    
    this.logger.info('failover', 'Manual failback initiated');
    await this.attemptFailback();
  }

  // Status and monitoring
  getFailoverStatus(): FailoverStatus {
    return { ...this.status };
  }

  async getFailoverHealth(): Promise<{
    primaryHealthy: boolean;
    backupHealthy: boolean;
    currentServer: string;
    dataSyncStatus: string;
    lastHealthCheck: Date;
  }> {
    const primaryHealthy = await this.checkServerHealth(this.config.primaryServer);
    const backupHealthy = await this.checkServerHealth(this.config.backupServer);
    
    return {
      primaryHealthy,
      backupHealthy,
      currentServer: this.status.currentServer,
      dataSyncStatus: this.status.dataSyncStatus,
      lastHealthCheck: this.status.lastHealthCheck
    };
  }

  // Configuration updates
  updateConfig(newConfig: Partial<FailoverConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('failover', 'Failover configuration updated', newConfig);
  }

  // Testing
  async testFailover(): Promise<boolean> {
    this.logger.info('failover', 'Starting failover test');
    
    try {
      const originalServer = this.status.currentServer;
      
      // Simulate failover
      await this.manualFailover();
      
      // Verify it worked
      const testResult = await this.verifyFailover();
      
      // Failback if needed
      if (originalServer === 'primary') {
        await this.manualFailback();
      }
      
      return testResult;
      
    } catch (error) {
      this.logger.error('failover', 'Failover test failed', error as Error);
      return false;
    }
  }
}

export default UltraFailover;
