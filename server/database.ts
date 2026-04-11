import { Pool, PoolClient, PoolConfig } from 'pg';
import { UltraLogger } from './logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  retentionDays: number;
  backupPath: string;
  compress: boolean;
}

export interface QueryStats {
  query: string;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export class UltraDatabase {
  private static instance: UltraDatabase;
  private pool: Pool;
  private config: DatabaseConfig;
  private logger: UltraLogger;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000;
  private queryStats: QueryStats[] = [];
  private backupInterval?: NodeJS.Timeout;

  static getInstance(config?: DatabaseConfig): UltraDatabase {
    if (!UltraDatabase.instance) {
      UltraDatabase.instance = new UltraDatabase(config);
    }
    return UltraDatabase.instance;
  }

  constructor(config?: DatabaseConfig) {
    this.logger = UltraLogger.getInstance();
    
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'saasvala',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
      ...config
    };

    this.initializePool();
    this.setupConnectionHandling();
  }

  private initializePool(): void {
    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      max: this.config.maxConnections,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
    };

    this.pool = new Pool(poolConfig);

    this.pool.on('connect', () => {
      this.logger.debug('database', 'New database connection established');
    });

    this.pool.on('error', (err) => {
      this.logger.error('database', 'Database pool error', err);
      this.isConnected = false;
      this.handleConnectionLoss();
    });

    this.pool.on('remove', () => {
      this.logger.debug('database', 'Database connection removed');
    });
  }

  private setupConnectionHandling(): void {
    // Test initial connection
    this.testConnection()
      .then(() => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.info('database', 'Database connected successfully');
      })
      .catch((error) => {
        this.logger.error('database', 'Failed to connect to database', error);
        this.handleConnectionLoss();
      });

    // Set up periodic connection checks
    setInterval(() => {
      if (this.isConnected) {
        this.testConnection().catch(() => {
          this.handleConnectionLoss();
        });
      }
    }, 30000); // Check every 30 seconds
  }

  private async testConnection(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  private async handleConnectionLoss(): Promise<void> {
    if (this.isConnected) {
      this.logger.warn('database', 'Database connection lost, attempting to reconnect...');
      this.isConnected = false;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.critical('database', 'Max reconnection attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    this.logger.info('database', `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    setTimeout(async () => {
      try {
        await this.testConnection();
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.info('database', 'Database reconnected successfully');
      } catch (error) {
        this.logger.error('database', `Reconnection attempt ${this.reconnectAttempts} failed`, error);
        this.handleConnectionLoss();
      }
    }, this.reconnectDelay);
  }

  // Query execution with logging and stats
  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const startTime = Date.now();
    let client: PoolClient | null = null;

    try {
      if (!this.isConnected) {
        throw new Error('Database not connected');
      }

      client = await this.pool.connect();
      const result = await client.query(text, params);
      const duration = Date.now() - startTime;

      this.recordQueryStats(text, duration, true);
      this.logger.debug('database', 'Query executed', { query: text, duration, rowCount: result.rowCount });

      return result.rows;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryStats(text, duration, false, error.message);
      this.logger.error('database', 'Query failed', error as Error, { query: text, duration });
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // Transaction support
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Prepared statements for better performance
  private preparedStatements: Map<string, string> = new Map();

  async prepareStatement(name: string, query: string): Promise<void> {
    if (!this.preparedStatements.has(name)) {
      const client = await this.pool.connect();
      try {
        await client.query({ name, text: query });
        this.preparedStatements.set(name, query);
        this.logger.debug('database', `Prepared statement created: ${name}`);
      } finally {
        client.release();
      }
    }
  }

  async executePrepared<T = any>(name: string, params?: any[]): Promise<T[]> {
    const startTime = Date.now();
    let client: PoolClient | null = null;

    try {
      if (!this.isConnected) {
        throw new Error('Database not connected');
      }

      client = await this.pool.connect();
      const result = await client.query({ name, text: this.preparedStatements.get(name)!, values: params });
      const duration = Date.now() - startTime;

      this.recordQueryStats(`PREPARED: ${name}`, duration, true);
      this.logger.debug('database', 'Prepared statement executed', { name, duration, rowCount: result.rowCount });

      return result.rows;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryStats(`PREPARED: ${name}`, duration, false, error.message);
      this.logger.error('database', 'Prepared statement failed', error as Error, { name, duration });
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // Database health check
  async healthCheck(): Promise<{
    connected: boolean;
    poolStats: any;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await this.testConnection();
      const responseTime = Date.now() - startTime;
      const poolStats = this.getPoolStats();

      return {
        connected: true,
        poolStats,
        responseTime
      };
    } catch (error) {
      return {
        connected: false,
        poolStats: this.getPoolStats(),
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private getPoolStats(): any {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  // Backup system
  async setupBackup(backupConfig: BackupConfig): Promise<void> {
    if (!backupConfig.enabled) {
      this.logger.info('database', 'Database backup is disabled');
      return;
    }

    // Create backup directory
    await execAsync(`mkdir -p ${backupConfig.backupPath}`);

    // Set up scheduled backups
    this.scheduleBackup(backupConfig);
    this.logger.info('database', `Database backup scheduled: ${backupConfig.schedule}`);
  }

  private scheduleBackup(config: BackupConfig): void {
    // Simple implementation - backup every day at 2 AM
    const scheduleBackup = async () => {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${timestamp}.sql`;
        const filepath = `${config.backupPath}/${filename}`;
        
        let command = `PGPASSWORD="${this.config.password}" pg_dump -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} > ${filepath}`;
        
        if (config.compress) {
          command += ` && gzip ${filepath}`;
        }

        await execAsync(command);
        
        this.logger.info('database', `Database backup created: ${filename}`);
        
        // Clean up old backups
        await this.cleanupOldBackups(config);
        
      } catch (error) {
        this.logger.error('database', 'Database backup failed', error as Error);
      }
    };

    // Schedule daily backup at 2 AM
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);
    
    const msUntilTomorrow = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      scheduleBackup();
      // Run daily
      this.backupInterval = setInterval(scheduleBackup, 24 * 60 * 60 * 1000);
    }, msUntilTomorrow);
  }

  private async cleanupOldBackups(config: BackupConfig): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - config.retentionDays * 24 * 60 * 60 * 1000);
      const command = `find ${config.backupPath} -name "backup-*.sql*" -mtime +${config.retentionDays} -delete`;
      await execAsync(command);
      this.logger.debug('database', 'Old database backups cleaned up');
    } catch (error) {
      this.logger.error('database', 'Failed to cleanup old backups', error as Error);
    }
  }

  // Restore database
  async restoreDatabase(backupFile: string): Promise<void> {
    try {
      this.logger.info('database', `Starting database restore from: ${backupFile}`);
      
      let command = `PGPASSWORD="${this.config.password}" psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} < ${backupFile}`;
      
      if (backupFile.endsWith('.gz')) {
        command = `gunzip -c ${backupFile} | PGPASSWORD="${this.config.password}" psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database}`;
      }

      await execAsync(command);
      
      this.logger.info('database', 'Database restore completed successfully');
    } catch (error) {
      this.logger.error('database', 'Database restore failed', error as Error);
      throw error;
    }
  }

  // Data integrity checks
  async checkDataIntegrity(): Promise<{
    valid: boolean;
    issues: Array<{ table: string; issue: string; count: number }>;
  }> {
    const issues: Array<{ table: string; issue: string; count: number }> = [];

    try {
      // Check for duplicate users
      const duplicateUsers = await this.query(`
        SELECT email, COUNT(*) as count 
        FROM users 
        GROUP BY email 
        HAVING COUNT(*) > 1
      `);

      if (duplicateUsers.length > 0) {
        issues.push({
          table: 'users',
          issue: 'Duplicate email addresses',
          count: duplicateUsers.length
        });
      }

      // Check for orphaned records
      const orphanedApiKeys = await this.query(`
        SELECT COUNT(*) as count 
        FROM api_keys ak 
        LEFT JOIN users u ON ak.user_id = u.id 
        WHERE u.id IS NULL
      `);

      if (parseInt(orphanedApiKeys[0]?.count || '0') > 0) {
        issues.push({
          table: 'api_keys',
          issue: 'Orphaned API keys',
          count: parseInt(orphanedApiKeys[0].count)
        });
      }

      // Check for invalid foreign keys
      const invalidProducts = await this.query(`
        SELECT COUNT(*) as count 
        FROM products p 
        LEFT JOIN users u ON p.created_by = u.id 
        WHERE p.created_by IS NOT NULL AND u.id IS NULL
      `);

      if (parseInt(invalidProducts[0]?.count || '0') > 0) {
        issues.push({
          table: 'products',
          issue: 'Invalid created_by reference',
          count: parseInt(invalidProducts[0].count)
        });
      }

      return {
        valid: issues.length === 0,
        issues
      };

    } catch (error) {
      this.logger.error('database', 'Data integrity check failed', error as Error);
      return {
        valid: false,
        issues: [{ table: 'all', issue: 'Integrity check failed', count: 1 }]
      };
    }
  }

  // Performance optimization
  async optimizeDatabase(): Promise<void> {
    try {
      this.logger.info('database', 'Starting database optimization...');

      // Update statistics
      await this.query('ANALYZE');
      
      // Reindex tables
      const tables = await this.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
      `);

      for (const table of tables) {
        await this.query(`REINDEX TABLE ${table.tablename}`);
      }

      // Vacuum analyze
      await this.query('VACUUM ANALYZE');

      this.logger.info('database', 'Database optimization completed');
    } catch (error) {
      this.logger.error('database', 'Database optimization failed', error as Error);
      throw error;
    }
  }

  private recordQueryStats(query: string, duration: number, success: boolean, error?: string): void {
    const stat: QueryStats = {
      query: query.length > 200 ? query.substring(0, 200) + '...' : query,
      duration,
      success,
      error,
      timestamp: new Date()
    };

    this.queryStats.push(stat);

    // Keep only last 1000 queries
    if (this.queryStats.length > 1000) {
      this.queryStats = this.queryStats.slice(-1000);
    }
  }

  // Get database statistics
  getDatabaseStats(): {
    connected: boolean;
    poolStats: any;
    queryStats: {
      totalQueries: number;
      averageDuration: number;
      slowQueries: number;
      errorQueries: number;
    };
  } {
    const totalQueries = this.queryStats.length;
    const averageDuration = totalQueries > 0 
      ? this.queryStats.reduce((sum, stat) => sum + stat.duration, 0) / totalQueries 
      : 0;
    const slowQueries = this.queryStats.filter(stat => stat.duration > 1000).length;
    const errorQueries = this.queryStats.filter(stat => !stat.success).length;

    return {
      connected: this.isConnected,
      poolStats: this.getPoolStats(),
      queryStats: {
        totalQueries,
        averageDuration,
        slowQueries,
        errorQueries
      }
    };
  }

  // Get slow queries
  getSlowQueries(limit: number = 10): QueryStats[] {
    return this.queryStats
      .filter(stat => stat.duration > 1000)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  // Close database connection
  async close(): Promise<void> {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    await this.pool.end();
    this.isConnected = false;
    this.logger.info('database', 'Database connection closed');
  }

  // Force reconnection
  async forceReconnect(): Promise<void> {
    this.logger.info('database', 'Forcing database reconnection...');
    
    await this.close();
    this.initializePool();
    this.setupConnectionHandling();
    
    await this.testConnection();
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    this.logger.info('database', 'Database reconnected successfully');
  }
}

export default UltraDatabase;
