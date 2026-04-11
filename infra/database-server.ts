import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraSSHConnect } from './ssh-connect';
import { UltraServerProviders } from './server-providers';
import { UltraMultiServerManagement } from './multi-server-management';

export interface DatabaseServer {
  id: string;
  name: string;
  serverId: string;
  databaseType: 'mysql' | 'postgresql' | 'mongodb' | 'redis' | 'elasticsearch';
  version: string;
  host: string;
  port: number;
  status: 'running' | 'stopped' | 'error' | 'installing' | 'configuring';
  config: DatabaseConfig;
  credentials: DatabaseCredentials;
  replication: ReplicationConfig;
  backup: BackupConfig;
  monitoring: MonitoringConfig;
  createdAt: Date;
  updatedAt: Date;
  lastHealthCheck?: Date;
}

export interface DatabaseConfig {
  maxConnections: number;
  bufferSize: number;
  cacheSize: number;
  timeout: number;
  logLevel: string;
  dataDirectory: string;
  configDirectory: string;
  customSettings: Record<string, any>;
}

export interface DatabaseCredentials {
  rootUsername: string;
  rootPassword: string;
  users: DatabaseUser[];
}

export interface DatabaseUser {
  username: string;
  password: string;
  database?: string;
  privileges: string[];
  host?: string;
}

export interface ReplicationConfig {
  enabled: boolean;
  mode: 'master-slave' | 'master-master' | 'cluster';
  masterServerId?: string;
  slaveServerIds: string[];
  replicationUser: string;
  replicationPassword: string;
  status: 'active' | 'inactive' | 'error';
  lagTime?: number;
}

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron expression
  retentionDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  backupPath: string;
  remoteBackup: {
    enabled: boolean;
    provider: 'aws' | 'gcp' | 'azure' | 'custom';
    bucket: string;
    region: string;
    credentials: Record<string, string>;
  };
  lastBackup?: Date;
  nextBackup?: Date;
  backupSize: number;
  backupCount: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  slowQueryThreshold: number;
  alertThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    connectionCount: number;
    queryTime: number;
  };
}

export interface DatabaseMetrics {
  serverId: string;
  timestamp: Date;
  connections: {
    active: number;
    total: number;
    max: number;
  };
  performance: {
    queriesPerSecond: number;
    slowQueries: number;
    averageQueryTime: number;
    cacheHitRatio: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    diskIO: {
      reads: number;
      writes: number;
    };
    networkIO: {
      bytesIn: number;
      bytesOut: number;
    };
  };
  replication: {
    status: string;
    lagTime: number;
    behind: boolean;
  };
}

export interface DatabaseBackup {
  id: string;
  serverId: string;
  type: 'full' | 'incremental' | 'differential';
  status: 'pending' | 'running' | 'completed' | 'failed';
  size: number;
  compressedSize: number;
  checksum: string;
  path: string;
  remotePath?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  errorMessage?: string;
  createdAt: Date;
}

export class UltraDatabaseServer extends EventEmitter {
  private static instance: UltraDatabaseServer;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private sshConnect: UltraSSHConnect;
  private serverProviders: UltraServerProviders;
  private multiServerManagement: UltraMultiServerManagement;
  private databaseServers: Map<string, DatabaseServer> = new Map();
  private metrics: Map<string, DatabaseMetrics[]> = new Map();
  private backups: Map<string, DatabaseBackup[]> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private backupIntervals: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): UltraDatabaseServer {
    if (!UltraDatabaseServer.instance) {
      UltraDatabaseServer.instance = new UltraDatabaseServer();
    }
    return UltraDatabaseServer.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.sshConnect = UltraSSHConnect.getInstance();
    this.serverProviders = UltraServerProviders.getInstance();
    this.multiServerManagement = UltraMultiServerManagement.getInstance();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize database tables
      await this.initializeDatabase();
      
      // Load existing database servers
      await this.loadDatabaseServers();
      
      // Start monitoring for all database servers
      await this.startAllMonitoring();
      
      // Start backup schedules
      await this.startAllBackups();
      
      this.logger.info('database-server', 'Database server system initialized', {
        databaseServersCount: this.databaseServers.size,
        monitoringActive: this.monitoringIntervals.size,
        backupSchedulesActive: this.backupIntervals.size
      });

    } catch (error) {
      this.logger.error('database-server', 'Failed to initialize database server system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS database_servers (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        server_id VARCHAR(255) NOT NULL,
        database_type VARCHAR(50) NOT NULL,
        version VARCHAR(50),
        host VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL,
        config JSONB NOT NULL,
        credentials JSONB NOT NULL,
        replication JSONB NOT NULL,
        backup JSONB NOT NULL,
        monitoring JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_health_check TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS database_metrics (
        id SERIAL PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        connections JSONB NOT NULL,
        performance JSONB NOT NULL,
        resources JSONB NOT NULL,
        replication JSONB NOT NULL
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS database_backups (
        id VARCHAR(255) PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        size BIGINT,
        compressed_size BIGINT,
        checksum VARCHAR(255),
        path TEXT NOT NULL,
        remote_path TEXT,
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        duration INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS database_users (
        id VARCHAR(255) PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        database_name VARCHAR(255),
        privileges JSONB,
        host VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_database_servers_server_id ON database_servers(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_database_metrics_server_id_timestamp ON database_metrics(server_id, timestamp)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_database_backups_server_id ON database_backups(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_database_users_server_id ON database_users(server_id)');
  }

  private async loadDatabaseServers(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM database_servers');
      
      for (const row of rows) {
        const server: DatabaseServer = {
          id: row.id,
          name: row.name,
          serverId: row.server_id,
          databaseType: row.database_type,
          version: row.version,
          host: row.host,
          port: row.port,
          status: row.status,
          config: row.config,
          credentials: row.credentials,
          replication: row.replication,
          backup: row.backup,
          monitoring: row.monitoring,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastHealthCheck: row.last_health_check
        };
        
        this.databaseServers.set(server.id, server);
      }
      
      this.logger.info('database-server', `Loaded ${this.databaseServers.size} database servers`);
    } catch (error) {
      this.logger.error('database-server', 'Failed to load database servers', error as Error);
    }
  }

  private async startAllMonitoring(): Promise<void> {
    for (const [serverId, dbServer] of this.databaseServers.entries()) {
      if (dbServer.status === 'running' && dbServer.monitoring.enabled) {
        await this.startMonitoring(serverId);
      }
    }
  }

  private async startAllBackups(): Promise<void> {
    for (const [serverId, dbServer] of this.databaseServers.entries()) {
      if (dbServer.backup.enabled) {
        await this.scheduleBackups(serverId);
      }
    }
  }

  async createDatabaseServer(config: {
    name: string;
    serverId: string;
    databaseType: DatabaseServer['databaseType'];
    version?: string;
    host?: string;
    port?: number;
    rootPassword?: string;
    config?: Partial<DatabaseConfig>;
    backupEnabled?: boolean;
    monitoringEnabled?: boolean;
  }): Promise<string> {
    const serverId = `db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate server exists
      const server = this.serverProviders.getServer(config.serverId);
      if (!server) {
        throw new Error('Server not found');
      }

      const dbServer: DatabaseServer = {
        id: serverId,
        name: config.name,
        serverId: config.serverId,
        databaseType: config.databaseType,
        version: config.version || this.getDefaultVersion(config.databaseType),
        host: config.host || server.ipAddress,
        port: config.port || this.getDefaultPort(config.databaseType),
        status: 'installing',
        config: {
          maxConnections: 100,
          bufferSize: 256,
          cacheSize: 512,
          timeout: 30,
          logLevel: 'info',
          dataDirectory: '/var/lib/' + config.databaseType,
          configDirectory: '/etc/' + config.databaseType,
          customSettings: {},
          ...config.config
        },
        credentials: {
          rootUsername: 'root',
          rootPassword: config.rootPassword || this.generatePassword(),
          users: []
        },
        replication: {
          enabled: false,
          mode: 'master-slave',
          slaveServerIds: [],
          replicationUser: 'replicator',
          replicationPassword: this.generatePassword(),
          status: 'inactive'
        },
        backup: {
          enabled: config.backupEnabled !== false,
          schedule: '0 2 * * *', // Daily at 2 AM
          retentionDays: 7,
          compressionEnabled: true,
          encryptionEnabled: true,
          backupPath: '/var/backups/' + config.databaseType,
          remoteBackup: {
            enabled: false,
            provider: 'aws',
            bucket: '',
            region: '',
            credentials: {}
          },
          backupSize: 0,
          backupCount: 0
        },
        monitoring: {
          enabled: config.monitoringEnabled !== false,
          metricsInterval: 60,
          slowQueryThreshold: 1000,
          alertThresholds: {
            cpuUsage: 80,
            memoryUsage: 85,
            diskUsage: 90,
            connectionCount: 80,
            queryTime: 5000
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO database_servers (
          id, name, server_id, database_type, version, host, port,
          status, config, credentials, replication, backup, monitoring,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        dbServer.id,
        dbServer.name,
        dbServer.serverId,
        dbServer.databaseType,
        dbServer.version,
        dbServer.host,
        dbServer.port,
        dbServer.status,
        JSON.stringify(dbServer.config),
        JSON.stringify(dbServer.credentials),
        JSON.stringify(dbServer.replication),
        JSON.stringify(dbServer.backup),
        JSON.stringify(dbServer.monitoring),
        dbServer.createdAt,
        dbServer.updatedAt
      ]);

      this.databaseServers.set(serverId, dbServer);

      // Install database server
      await this.installDatabaseServer(serverId);

      this.logger.info('database-server', `Database server created: ${dbServer.name}`, {
        serverId,
        databaseType: config.databaseType,
        host: dbServer.host,
        port: dbServer.port
      });

      this.emit('databaseServerCreated', dbServer);
      return serverId;

    } catch (error) {
      this.logger.error('database-server', `Failed to create database server: ${config.name}`, error as Error);
      throw error;
    }
  }

  private async installDatabaseServer(serverId: string): Promise<void> {
    const dbServer = this.databaseServers.get(serverId);
    if (!dbServer) throw new Error('Database server not found');

    try {
      dbServer.status = 'installing';
      await this.updateDatabaseServer(dbServer);

      const connection = await this.getSSHConnection(dbServer.serverId);
      if (!connection) {
        throw new Error('SSH connection not available');
      }

      // Update package lists
      await this.sshConnect.executeCommand(connection.id, 'sudo apt update', 60000);

      // Install database based on type
      switch (dbServer.databaseType) {
        case 'mysql':
          await this.installMySQL(connection.id, dbServer);
          break;
        case 'postgresql':
          await this.installPostgreSQL(connection.id, dbServer);
          break;
        case 'mongodb':
          await this.installMongoDB(connection.id, dbServer);
          break;
        case 'redis':
          await this.installRedis(connection.id, dbServer);
          break;
        case 'elasticsearch':
          await this.installElasticsearch(connection.id, dbServer);
          break;
      }

      // Configure database
      await this.configureDatabase(connection.id, dbServer);

      // Start database service
      await this.startDatabaseService(connection.id, dbServer);

      // Create initial backup directory
      await this.sshConnect.executeCommand(connection.id, `sudo mkdir -p ${dbServer.backup.backupPath}`, 10000);

      dbServer.status = 'running';
      dbServer.updatedAt = new Date();
      dbServer.lastHealthCheck = new Date();
      await this.updateDatabaseServer(dbServer);

      // Start monitoring
      if (dbServer.monitoring.enabled) {
        await this.startMonitoring(serverId);
      }

      // Schedule backups
      if (dbServer.backup.enabled) {
        await this.scheduleBackups(serverId);
      }

      this.logger.info('database-server', `Database server installed and running: ${dbServer.name}`, {
        serverId,
        databaseType: dbServer.databaseType,
        host: dbServer.host,
        port: dbServer.port
      });

      this.emit('databaseServerInstalled', dbServer);

    } catch (error) {
      dbServer.status = 'error';
      await this.updateDatabaseServer(dbServer);
      this.logger.error('database-server', `Failed to install database server: ${dbServer.name}`, error as Error);
      throw error;
    }
  }

  private async installMySQL(connectionId: string, dbServer: DatabaseServer): Promise<void> {
    // Install MySQL
    await this.sshConnect.executeCommand(connectionId, 'sudo DEBIAN_FRONTEND=noninteractive apt install -y mysql-server', 300000);
    
    // Secure installation
    await this.sshConnect.executeCommand(connectionId, `sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${dbServer.credentials.rootPassword}';"`, 10000);
    await this.sshConnect.executeCommand(connectionId, 'sudo mysql -e "DELETE FROM mysql.user WHERE User=\'\';"', 10000);
    await this.sshConnect.executeCommand(connection.id, 'sudo mysql -e "DELETE FROM mysql.user WHERE User=\'root\' AND Host NOT IN (\'localhost\', \'127.0.0.1\', \'::1\');"', 10000);
    await this.sshConnect.executeCommand(connectionId, 'sudo mysql -e "DROP DATABASE IF EXISTS test;"', 10000);
    await this.sshConnect.executeCommand(connectionId, 'sudo mysql -e "DELETE FROM mysql.db WHERE Db=\'test\' OR Db=\'test\\_%\';"', 10000);
    await this.sshConnect.executeCommand(connection.id, 'sudo mysql -e "FLUSH PRIVILEGES;"', 10000);
  }

  private async installPostgreSQL(connectionId: string, dbServer: DatabaseServer): Promise<void> {
    // Install PostgreSQL
    await this.sshConnect.executeCommand(connectionId, 'sudo DEBIAN_FRONTEND=noninteractive apt install -y postgresql postgresql-contrib', 300000);
    
    // Set password for postgres user
    await this.sshConnect.executeCommand(connection.id, `sudo -u postgres psql -c "ALTER USER postgres PASSWORD '${dbServer.credentials.rootPassword}';"`, 10000);
  }

  private async installMongoDB(connectionId: string, dbServer: DatabaseServer): Promise<void> {
    // Add MongoDB repository
    await this.sshConnect.executeCommand(connectionId, 'wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -', 30000);
    await this.sshConnect.executeCommand(connection.id, 'echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list', 10000);
    await this.sshConnect.executeCommand(connection.id, 'sudo apt update', 60000);
    
    // Install MongoDB
    await this.sshConnect.executeCommand(connectionId, 'sudo DEBIAN_FRONTEND=noninteractive apt install -y mongodb-org', 300000);
  }

  private async installRedis(connectionId: string, dbServer: DatabaseServer): Promise<void> {
    // Install Redis
    await this.sshConnect.executeCommand(connectionId, 'sudo DEBIAN_FRONTEND=noninteractive apt install -y redis-server', 300000);
  }

  private async installElasticsearch(connectionId: string, dbServer: DatabaseServer): Promise<void> {
    // Add Elasticsearch repository
    await this.sshConnect.executeCommand(connectionId, 'wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -', 30000);
    await this.sshConnect.executeCommand(connectionId, 'echo "deb https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list', 10000);
    await this.sshConnect.executeCommand(connectionId, 'sudo apt update', 60000);
    
    // Install Elasticsearch
    await this.sshConnect.executeCommand(connectionId, 'sudo DEBIAN_FRONTEND=noninteractive apt install -y elasticsearch', 300000);
  }

  private async configureDatabase(connectionId: string, dbServer: DatabaseServer): Promise<void> {
    // Configure based on database type
    switch (dbServer.databaseType) {
      case 'mysql':
        await this.configureMySQL(connectionId, dbServer);
        break;
      case 'postgresql':
        await this.configurePostgreSQL(connectionId, dbServer);
        break;
      case 'mongodb':
        await this.configureMongoDB(connectionId, dbServer);
        break;
      case 'redis':
        await this.configureRedis(connectionId, dbServer);
        break;
      case 'elasticsearch':
        await this.configureElasticsearch(connectionId, dbServer);
        break;
    }
  }

  private async configureMySQL(connectionId: string, dbServer: DatabaseServer): Promise<void> {
    const config = `
[mysqld]
bind-address = ${dbServer.host}
port = ${dbServer.port}
max_connections = ${dbServer.config.maxConnections}
innodb_buffer_pool_size = ${dbServer.config.cacheSize}M
log_error = /var/log/mysql/error.log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = ${dbServer.monitoring.slowQueryThreshold / 1000}
`;

    await this.sshConnect.executeCommand(connection.id, `echo '${config}' | sudo tee /etc/mysql/mysql.conf.d/mysqld.cnf`, 10000);
  }

  private async configurePostgreSQL(connectionId: string, dbServer: DatabaseServer): Promise<void> {
    // Update postgresql.conf
    await this.sshConnect.executeCommand(connection.id, `sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '${dbServer.host}'/" /etc/postgresql/*/main/postgresql.conf`, 10000);
    await this.sshConnect.executeCommand(connection.id, `sudo sed -i "s/#port = 5432/port = ${dbServer.port}/" /etc/postgresql/*/main/postgresql.conf`, 10000);
    
    // Update pg_hba.conf for remote connections
    await this.sshConnect.executeCommand(connection.id, `echo "host all all 0.0.0.0/0 md5" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf`, 10000);
  }

  private async configureMongoDB(connectionId: string, dbServer: DatabaseServer): Promise<void> {
    const config = `
net:
  port: ${dbServer.port}
  bindIp: ${dbServer.host}
storage:
  dbPath: ${dbServer.config.dataDirectory}
  journal:
    enabled: true
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod.pid
`;

    await this.sshConnect.executeCommand(connection.id, `echo '${config}' | sudo tee /etc/mongod.conf`, 10000);
  }

  private async configureRedis(connectionId: string, dbServer: DatabaseServer): Promise<void> {
    await this.sshConnect.executeCommand(connection.id, `sudo sed -i "s/bind 127.0.0.1 ::1/bind ${dbServer.host}/" /etc/redis/redis.conf`, 10000);
    await this.sshConnect.executeCommand(connection.id, `sudo sed -i "s/#port 6379/port ${dbServer.port}/" /etc/redis/redis.conf`, 10000);
  }

  private async configureElasticsearch(connectionId: string, dbServer: DatabaseServer): Promise<void> {
    await this.sshConnect.executeCommand(connection.id, `sudo sed -i "s/#network.host: localhost/network.host: ${dbServer.host}/" /etc/elasticsearch/elasticsearch.yml`, 10000);
    await this.sshConnect.executeCommand(connection.id, `sudo sed -i "s/#http.port: 9200/http.port: ${dbServer.port}/" /etc/elasticsearch/elasticsearch.yml`, 10000);
  }

  private async startDatabaseService(connectionId: string, dbServer: DatabaseServer): Promise<void> {
    const serviceName = this.getServiceName(dbServer.databaseType);
    
    await this.sshConnect.executeCommand(connection.id, `sudo systemctl enable ${serviceName}`, 10000);
    await this.sshConnect.executeCommand(connection.id, `sudo systemctl start ${serviceName}`, 10000);
    
    // Wait for service to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if service is running
    const result = await this.sshConnect.executeCommand(connection.id, `sudo systemctl is-active ${serviceName}`, 5000);
    if (!result.success || !result.stdout.includes('active')) {
      throw new Error(`Failed to start ${serviceName} service`);
    }
  }

  private async startMonitoring(serverId: string): Promise<void> {
    const dbServer = this.databaseServers.get(serverId);
    if (!dbServer || !dbServer.monitoring.enabled) return;

    // Stop existing monitoring
    await this.stopMonitoring(serverId);

    const interval = setInterval(async () => {
      await this.collectMetrics(serverId);
    }, dbServer.monitoring.metricsInterval * 1000);

    this.monitoringIntervals.set(serverId, interval);
    
    // Collect initial metrics
    await this.collectMetrics(serverId);
    
    this.logger.info('database-server', `Started monitoring for database server: ${dbServer.name}`, {
      serverId,
      interval: dbServer.monitoring.metricsInterval
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
    const dbServer = this.databaseServers.get(serverId);
    if (!dbServer || dbServer.status !== 'running') return;

    try {
      const connection = await this.getSSHConnection(dbServer.serverId);
      if (!connection) return;

      const metrics = await this.collectDatabaseMetrics(connection.id, dbServer);
      metrics.serverId = serverId;
      metrics.timestamp = new Date();

      // Store metrics in memory (keep last 1000 data points)
      if (!this.metrics.has(serverId)) {
        this.metrics.set(serverId, []);
      }
      
      const serverMetrics = this.metrics.get(serverId)!;
      serverMetrics.push(metrics);
      
      // Keep only last 1000 data points
      if (serverMetrics.length > 1000) {
        serverMetrics.splice(0, serverMetrics.length - 1000);
      }

      // Store in database
      await this.storeMetricsInDB(metrics);

      // Check alert thresholds
      await this.checkAlertThresholds(dbServer, metrics);

      this.emit('metricsCollected', { serverId, metrics });

    } catch (error) {
      this.logger.error('database-server', `Failed to collect metrics for database server: ${dbServer.name}`, error as Error);
    }
  }

  private async collectDatabaseMetrics(connectionId: string, dbServer: DatabaseServer): Promise<DatabaseMetrics> {
    try {
      let metrics: DatabaseMetrics = {
        serverId: '',
        timestamp: new Date(),
        connections: { active: 0, total: 0, max: 0 },
        performance: { queriesPerSecond: 0, slowQueries: 0, averageQueryTime: 0, cacheHitRatio: 0 },
        resources: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, diskIO: { reads: 0, writes: 0 }, networkIO: { bytesIn: 0, bytesOut: 0 } },
        replication: { status: 'disabled', lagTime: 0, behind: false }
      };

      switch (dbServer.databaseType) {
        case 'mysql':
          metrics = await this.collectMySQLMetrics(connectionId, dbServer);
          break;
        case 'postgresql':
          metrics = await this.collectPostgreSQLMetrics(connectionId, dbServer);
          break;
        case 'mongodb':
          metrics = await this.collectMongoDBMetrics(connectionId, dbServer);
          break;
        case 'redis':
          metrics = await this.collectRedisMetrics(connectionId, dbServer);
          break;
        case 'elasticsearch':
          metrics = await this.collectElasticsearchMetrics(connectionId, dbServer);
          break;
      }

      return metrics;

    } catch (error) {
      this.logger.error('database-server', 'Failed to collect database metrics', error as Error);
      throw error;
    }
  }

  private async collectMySQLMetrics(connectionId: string, dbServer: DatabaseServer): Promise<DatabaseMetrics> {
    const passwordOption = `-p${dbServer.credentials.rootPassword}`;
    
    // Get connection metrics
    const connResult = await this.sshConnect.executeCommand(connection.id, `mysql -u root ${passwordOption} -e "SHOW STATUS LIKE 'Threads_connected';" | tail -1`, 5000);
    const maxConnResult = await this.sshConnect.executeCommand(connectionId, `mysql -u root ${passwordOption} -e "SHOW VARIABLES LIKE 'max_connections';" | tail -1`, 5000);
    
    const activeConnections = parseInt(connResult.stdout.split('\t')[1]) || 0;
    const maxConnections = parseInt(maxConnResult.stdout.split('\t')[1]) || 0;

    // Get performance metrics
    const queriesResult = await this.sshConnect.executeCommand(connectionId, `mysql -u root ${passwordOption} -e "SHOW GLOBAL STATUS LIKE 'Queries';" | tail -1`, 5000);
    const slowQueriesResult = await this.sshConnect.executeCommand(connectionId, `mysql -u root ${passwordOption} -e "SHOW GLOBAL STATUS LIKE 'Slow_queries';" | tail -1`, 5000);
    
    const totalQueries = parseInt(queriesResult.stdout.split('\t')[1]) || 0;
    const slowQueries = parseInt(slowQueriesResult.stdout.split('\t')[1]) || 0;

    // Get resource metrics
    const cpuResult = await this.sshConnect.executeCommand(connection.id, "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1", 5000);
    const memResult = await this.sshConnect.executeCommand(connection.id, "free | grep Mem | awk '{printf \"%.2f\", $3/$2 * 100.0}'", 5000);
    const diskResult = await this.sshConnect.executeCommand(connection.id, "df -h / | awk 'NR==2{printf \"%.2f\", $5}'", 5000);

    return {
      serverId: '',
      timestamp: new Date(),
      connections: {
        active: activeConnections,
        total: activeConnections,
        max: maxConnections
      },
      performance: {
        queriesPerSecond: 0, // Would need to calculate over time
        slowQueries,
        averageQueryTime: 0,
        cacheHitRatio: 0
      },
      resources: {
        cpuUsage: parseFloat(cpuResult.stdout.trim()) || 0,
        memoryUsage: parseFloat(memResult.stdout.trim()) || 0,
        diskUsage: parseFloat(diskResult.stdout.trim()) || 0,
        diskIO: { reads: 0, writes: 0 },
        networkIO: { bytesIn: 0, bytesOut: 0 }
      },
      replication: {
        status: 'disabled',
        lagTime: 0,
        behind: false
      }
    };
  }

  private async collectPostgreSQLMetrics(connectionId: string, dbServer: DatabaseServer): Promise<DatabaseMetrics> {
    // PostgreSQL metrics collection implementation
    return {
      serverId: '',
      timestamp: new Date(),
      connections: { active: 0, total: 0, max: 0 },
      performance: { queriesPerSecond: 0, slowQueries: 0, averageQueryTime: 0, cacheHitRatio: 0 },
      resources: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, diskIO: { reads: 0, writes: 0 }, networkIO: { bytesIn: 0, bytesOut: 0 } },
      replication: { status: 'disabled', lagTime: 0, behind: false }
    };
  }

  private async collectMongoDBMetrics(connectionId: string, dbServer: DatabaseServer): Promise<DatabaseMetrics> {
    // MongoDB metrics collection implementation
    return {
      serverId: '',
      timestamp: new Date(),
      connections: { active: 0, total: 0, max: 0 },
      performance: { queriesPerSecond: 0, slowQueries: 0, averageQueryTime: 0, cacheHitRatio: 0 },
      resources: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, diskIO: { reads: 0, writes: 0 }, networkIO: { bytesIn: 0, bytesOut: 0 } },
      replication: { status: 'disabled', lagTime: 0, behind: false }
    };
  }

  private async collectRedisMetrics(connectionId: string, dbServer: DatabaseServer): Promise<DatabaseMetrics> {
    // Redis metrics collection implementation
    return {
      serverId: '',
      timestamp: new Date(),
      connections: { active: 0, total: 0, max: 0 },
      performance: { queriesPerSecond: 0, slowQueries: 0, averageQueryTime: 0, cacheHitRatio: 0 },
      resources: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, diskIO: { reads: 0, writes: 0 }, networkIO: { bytesIn: 0, bytesOut: 0 } },
      replication: { status: 'disabled', lagTime: 0, behind: false }
    };
  }

  private async collectElasticsearchMetrics(connectionId: string, dbServer: DatabaseServer): Promise<DatabaseMetrics> {
    // Elasticsearch metrics collection implementation
    return {
      serverId: '',
      timestamp: new Date(),
      connections: { active: 0, total: 0, max: 0 },
      performance: { queriesPerSecond: 0, slowQueries: 0, averageQueryTime: 0, cacheHitRatio: 0 },
      resources: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, diskIO: { reads: 0, writes: 0 }, networkIO: { bytesIn: 0, bytesOut: 0 } },
      replication: { status: 'disabled', lagTime: 0, behind: false }
    };
  }

  private async storeMetricsInDB(metrics: DatabaseMetrics): Promise<void> {
    try {
      await this.database.query(`
        INSERT INTO database_metrics (
          server_id, timestamp, connections, performance, resources, replication
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        metrics.serverId,
        metrics.timestamp,
        JSON.stringify(metrics.connections),
        JSON.stringify(metrics.performance),
        JSON.stringify(metrics.resources),
        JSON.stringify(metrics.replication)
      ]);
    } catch (error) {
      this.logger.error('database-server', 'Failed to store metrics in database', error as Error);
    }
  }

  private async checkAlertThresholds(dbServer: DatabaseServer, metrics: DatabaseMetrics): Promise<void> {
    const thresholds = dbServer.monitoring.alertThresholds;
    
    if (metrics.resources.cpuUsage > thresholds.cpuUsage) {
      this.emit('alert', {
        serverId: dbServer.id,
        type: 'cpu_high',
        value: metrics.resources.cpuUsage,
        threshold: thresholds.cpuUsage
      });
    }
    
    if (metrics.resources.memoryUsage > thresholds.memoryUsage) {
      this.emit('alert', {
        serverId: dbServer.id,
        type: 'memory_high',
        value: metrics.resources.memoryUsage,
        threshold: thresholds.memoryUsage
      });
    }
    
    if (metrics.resources.diskUsage > thresholds.diskUsage) {
      this.emit('alert', {
        serverId: dbServer.id,
        type: 'disk_high',
        value: metrics.resources.diskUsage,
        threshold: thresholds.diskUsage
      });
    }
  }

  private async scheduleBackups(serverId: string): Promise<void> {
    const dbServer = this.databaseServers.get(serverId);
    if (!dbServer || !dbServer.backup.enabled) return;

    // Stop existing backup schedule
    await this.stopBackupSchedule(serverId);

    // Parse cron schedule (simplified - would use a proper cron parser in production)
    // For now, schedule daily backups
    const interval = setInterval(async () => {
      await this.createBackup(serverId, 'full');
    }, 24 * 60 * 60 * 1000); // 24 hours

    this.backupIntervals.set(serverId, interval);
    
    this.logger.info('database-server', `Scheduled backups for database server: ${dbServer.name}`, {
      serverId,
      schedule: dbServer.backup.schedule
    });
  }

  private async stopBackupSchedule(serverId: string): Promise<void> {
    const interval = this.backupIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.backupIntervals.delete(serverId);
    }
  }

  async createBackup(serverId: string, type: DatabaseBackup['type'] = 'full'): Promise<string> {
    const dbServer = this.databaseServers.get(serverId);
    if (!dbServer) throw new Error('Database server not found');

    const backupId = `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const backup: DatabaseBackup = {
        id: backupId,
        serverId,
        type,
        status: 'running',
        size: 0,
        compressedSize: 0,
        checksum: '',
        path: `${dbServer.backup.backupPath}/backup-${Date.now()}.sql`,
        startedAt: new Date(),
        createdAt: new Date()
      };

      // Store backup in database
      await this.database.query(`
        INSERT INTO database_backups (
          id, server_id, type, status, path, started_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [backup.id, backup.serverId, backup.type, backup.status, backup.path, backup.startedAt, backup.createdAt]);

      if (!this.backups.has(serverId)) {
        this.backups.set(serverId, []);
      }
      this.backups.get(serverId)!.push(backup);

      // Perform backup
      await this.performBackup(backup);

      this.logger.info('database-server', `Database backup created: ${backup.type}`, {
        backupId,
        serverId,
        type: backup.type,
        size: backup.size
      });

      this.emit('backupCreated', backup);
      return backupId;

    } catch (error) {
      this.logger.error('database-server', `Failed to create database backup: ${dbServer.name}`, error as Error);
      throw error;
    }
  }

  private async performBackup(backup: DatabaseBackup): Promise<void> {
    const dbServer = this.databaseServers.get(backup.serverId);
    if (!dbServer) throw new Error('Database server not found');

    try {
      const connection = await this.getSSHConnection(dbServer.serverId);
      if (!connection) throw new Error('SSH connection not available');

      let command = '';
      
      switch (dbServer.databaseType) {
        case 'mysql':
          command = `mysqldump -u root -p${dbServer.credentials.rootPassword} --single-transaction --routines --triggers --all-databases > ${backup.path}`;
          break;
        case 'postgresql':
          command = `sudo -u postgres pg_dumpall > ${backup.path}`;
          break;
        case 'mongodb':
          command = `mongodump --host ${dbServer.host}:${dbServer.port} --out ${backup.path}`;
          break;
        default:
          throw new Error(`Backup not supported for database type: ${dbServer.databaseType}`);
      }

      // Execute backup
      const result = await this.sshConnect.executeCommand(connection.id, command, 600000); // 10 minutes timeout
      
      if (!result.success) {
        throw new Error(`Backup command failed: ${result.stderr}`);
      }

      // Get backup size
      const sizeResult = await this.sshConnect.executeCommand(connection.id, `du -b ${backup.path} | cut -f1`, 10000);
      backup.size = parseInt(sizeResult.stdout.trim()) || 0;

      // Compress if enabled
      if (dbServer.backup.compressionEnabled) {
        await this.sshConnect.executeCommand(connection.id, `gzip ${backup.path}`, 300000);
        backup.path += '.gz';
        
        const compressedSizeResult = await this.sshConnect.executeCommand(connection.id, `du -b ${backup.path} | cut -f1`, 10000);
        backup.compressedSize = parseInt(compressedSizeResult.stdout.trim()) || 0;
      }

      // Calculate checksum
      const checksumResult = await this.sshConnect.executeCommand(connection.id, `sha256sum ${backup.path} | cut -d' ' -f1`, 10000);
      backup.checksum = checksumResult.stdout.trim();

      backup.status = 'completed';
      backup.completedAt = new Date();
      backup.duration = backup.completedAt.getTime() - backup.startedAt.getTime();

      // Update database
      await this.database.query(`
        UPDATE database_backups 
        SET status = 'completed', size = $1, compressed_size = $2, checksum = $3,
        completed_at = $4, duration = $5 
        WHERE id = $6
      `, [backup.size, backup.compressedSize, backup.checksum, backup.completedAt, backup.duration, backup.id]);

      // Update server backup info
      dbServer.backup.lastBackup = backup.completedAt;
      dbServer.backup.backupSize += backup.size;
      dbServer.backup.backupCount++;
      await this.updateDatabaseServer(dbServer);

    } catch (error) {
      backup.status = 'failed';
      backup.errorMessage = error.message;
      
      await this.database.query(`
        UPDATE database_backups 
        SET status = 'failed', error_message = $1 
        WHERE id = $2
      `, [backup.errorMessage, backup.id]);

      throw error;
    }
  }

  private async updateDatabaseServer(dbServer: DatabaseServer): Promise<void> {
    await this.database.query(`
      UPDATE database_servers 
      SET status = $1, config = $2, credentials = $3, replication = $4,
      backup = $5, monitoring = $6, updated_at = $7, last_health_check = $8 
      WHERE id = $9
    `, [
      dbServer.status,
      JSON.stringify(dbServer.config),
      JSON.stringify(dbServer.credentials),
      JSON.stringify(dbServer.replication),
      JSON.stringify(dbServer.backup),
      JSON.stringify(dbServer.monitoring),
      dbServer.updatedAt,
      dbServer.lastHealthCheck,
      dbServer.id
    ]);
  }

  private getDefaultVersion(databaseType: string): string {
    const versions: Record<string, string> = {
      mysql: '8.0',
      postgresql: '14',
      mongodb: '6.0',
      redis: '7.0',
      elasticsearch: '8.0'
    };
    return versions[databaseType] || 'latest';
  }

  private getDefaultPort(databaseType: string): number {
    const ports: Record<string, number> = {
      mysql: 3306,
      postgresql: 5432,
      mongodb: 27017,
      redis: 6379,
      elasticsearch: 9200
    };
    return ports[databaseType] || 3306;
  }

  private generatePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  private getServiceName(databaseType: string): string {
    const services: Record<string, string> = {
      mysql: 'mysql',
      postgresql: 'postgresql',
      mongodb: 'mongod',
      redis: 'redis-server',
      elasticsearch: 'elasticsearch'
    };
    return services[databaseType] || databaseType;
  }

  private async getSSHConnection(serverId: string): Promise<any> {
    const connections = await this.sshConnect.getConnectionsByUserId('system');
    return connections.find(c => c.serverId === serverId);
  }

  // Public API methods
  async getDatabaseServer(serverId: string): Promise<DatabaseServer | null> {
    return this.databaseServers.get(serverId) || null;
  }

  async getDatabaseServersByHost(hostServerId: string): Promise<DatabaseServer[]> {
    return Array.from(this.databaseServers.values()).filter(db => db.serverId === hostServerId);
  }

  async getDatabaseMetrics(serverId: string, timeRange?: { start: Date; end: Date }): Promise<DatabaseMetrics[]> {
    const metrics = this.metrics.get(serverId) || [];
    
    if (!timeRange) {
      return metrics;
    }

    return metrics.filter(m => 
      m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }

  async getDatabaseBackups(serverId: string): Promise<DatabaseBackup[]> {
    return this.backups.get(serverId) || [];
  }

  async createDatabaseUser(serverId: string, user: Omit<DatabaseUser, 'host'>): Promise<boolean> {
    const dbServer = this.databaseServers.get(serverId);
    if (!dbServer) throw new Error('Database server not found');

    try {
      const connection = await this.getSSHConnection(dbServer.serverId);
      if (!connection) throw new Error('SSH connection not available');

      let command = '';
      
      switch (dbServer.databaseType) {
        case 'mysql':
          command = `mysql -u root -p${dbServer.credentials.rootPassword} -e "CREATE USER '${user.username}'@'%' IDENTIFIED BY '${user.password}';"`;
          if (user.database) {
            command += ` mysql -u root -p${dbServer.credentials.rootPassword} -e "GRANT ${user.privileges.join(',')} ON ${user.database}.* TO '${user.username}'@'%';"`;
          }
          command += ` mysql -u root -p${dbServer.credentials.rootPassword} -e "FLUSH PRIVILEGES;"`;
          break;
        case 'postgresql':
          command = `sudo -u postgres createuser ${user.username};`;
          command += ` sudo -u postgres psql -c "ALTER USER ${user.username} PASSWORD '${user.password}';"`;
          break;
        default:
          throw new Error(`User creation not supported for database type: ${dbServer.databaseType}`);
      }

      await this.sshConnect.executeCommand(connection.id, command, 30000);

      // Store user in database
      const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await this.database.query(`
        INSERT INTO database_users (id, server_id, username, password, database_name, privileges, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [userId, serverId, user.username, user.password, user.database, JSON.stringify(user.privileges), new Date()]);

      this.logger.info('database-server', `Database user created: ${user.username}`, {
        serverId,
        database: user.database
      });

      return true;

    } catch (error) {
      this.logger.error('database-server', `Failed to create database user: ${user.username}`, error as Error);
      return false;
    }
  }

  async getDatabaseServerStats(): Promise<{
    totalServers: number;
    runningServers: number;
    serversByType: Record<string, number>;
    totalBackups: number;
    totalBackupSize: number;
  }> {
    const servers = Array.from(this.databaseServers.values());
    const backups = Array.from(this.backups.values()).flat();
    
    return {
      totalServers: servers.length,
      runningServers: servers.filter(s => s.status === 'running').length,
      serversByType: servers.reduce((acc, server) => {
        acc[server.databaseType] = (acc[server.databaseType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalBackups: backups.length,
      totalBackupSize: backups.reduce((sum, backup) => sum + backup.size, 0)
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    databaseServersCount: number;
    runningServersCount: number;
    monitoringActive: number;
    backupSchedulesActive: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getDatabaseServerStats();
    
    if (stats.runningServers < stats.totalServers) {
      issues.push(`${stats.totalServers - stats.runningServers} database servers are not running`);
    }
    
    if (stats.totalServers === 0) {
      issues.push('No database servers configured');
    }

    return {
      healthy: issues.length === 0,
      databaseServersCount: stats.totalServers,
      runningServersCount: stats.runningServers,
      monitoringActive: this.monitoringIntervals.size,
      backupSchedulesActive: this.backupIntervals.size,
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
    
    this.monitoringIntervals.clear();
    this.backupIntervals.clear();
    
    this.logger.info('database-server', 'Database server system shut down');
  }
}

export default UltraDatabaseServer;
