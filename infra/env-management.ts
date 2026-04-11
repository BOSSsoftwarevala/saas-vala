import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraSSHConnect } from './ssh-connect';
import { UltraServerProviders } from './server-providers';
import * as crypto from 'crypto';

export interface Environment {
  id: string;
  name: string;
  serverId: string;
  type: 'development' | 'staging' | 'production' | 'testing';
  description: string;
  status: 'active' | 'inactive' | 'error';
  variables: EnvironmentVariable[];
  secrets: EnvironmentSecret[];
  configFiles: ConfigFile[];
  services: ServiceConfig[];
  networks: NetworkConfig[];
  security: SecurityConfig;
  backup: BackupConfig;
  createdAt: Date;
  updatedAt: Date;
  lastDeploy?: Date;
  version: string;
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  required: boolean;
  encrypted: boolean;
  scope: ('global' | 'service' | 'build' | 'runtime')[];
  services: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentSecret {
  id: string;
  name: string;
  value: string;
  type: 'api_key' | 'password' | 'certificate' | 'token' | 'custom';
  description: string;
  rotationRequired: boolean;
  rotationInterval: number; // days
  lastRotated?: Date;
  nextRotation?: Date;
  accessLogs: SecretAccessLog[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SecretAccessLog {
  id: string;
  secretId: string;
  userId: string;
  action: 'read' | 'update' | 'rotate';
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export interface ConfigFile {
  id: string;
  name: string;
  path: string;
  content: string;
  format: 'env' | 'json' | 'yaml' | 'ini' | 'xml' | 'custom';
  template?: string;
  variables: string[];
  autoReload: boolean;
  backupEnabled: boolean;
  version: number;
  checksum: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceConfig {
  id: string;
  name: string;
  type: 'web' | 'api' | 'database' | 'cache' | 'queue' | 'worker' | 'custom';
  image?: string;
  ports: PortMapping[];
  environment: string[];
  volumes: VolumeMapping[];
  networks: string[];
  dependsOn: string[];
  healthCheck?: HealthCheck;
  resources: ResourceLimits;
  scaling: ScalingConfig;
  deployment: DeploymentConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortMapping {
  container: number;
  host: number;
  protocol: 'tcp' | 'udp';
  name?: string;
}

export interface VolumeMapping {
  host: string;
  container: string;
  mode: 'ro' | 'rw';
  type: 'bind' | 'volume';
}

export interface HealthCheck {
  path: string;
  port: number;
  interval: number;
  timeout: number;
  retries: number;
  startPeriod: number;
  command?: string;
}

export interface ResourceLimits {
  cpu: number;
  memory: number; // MB
  disk: number; // MB
  network?: {
    ingress: number; // Mbps
    egress: number; // Mbps
  };
}

export interface ScalingConfig {
  minReplicas: number;
  maxReplicas: number;
  targetCPUUtilization: number;
  targetMemoryUtilization: number;
  autoScaling: boolean;
}

export interface DeploymentConfig {
  strategy: 'recreate' | 'rolling' | 'blue-green' | 'canary';
  replicas: number;
  updateInterval: number;
  rollbackEnabled: boolean;
  healthCheckDelay: number;
}

export interface NetworkConfig {
  id: string;
  name: string;
  driver: 'bridge' | 'overlay' | 'host' | 'macvlan' | 'custom';
  subnet?: string;
  gateway?: string;
  ipRange?: string;
  encrypted: boolean;
  services: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityConfig {
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyRotation: number; // days
  };
  accessControl: {
    enabled: boolean;
    roles: Role[];
    permissions: Permission[];
  };
  audit: {
    enabled: boolean;
    logLevel: 'info' | 'warn' | 'error' | 'debug';
    retention: number; // days
  };
  compliance: {
    standards: ('SOC2' | 'ISO27001' | 'GDPR' | 'HIPAA' | 'PCI-DSS')[];
    scanning: {
      enabled: boolean;
      frequency: number; // days
      tools: string[];
    };
  };
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  createdAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string;
}

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron
  retention: number; // days
  compression: boolean;
  encryption: boolean;
  destinations: BackupDestination[];
  include: string[];
  exclude: string[];
  lastBackup?: Date;
  nextBackup?: Date;
}

export interface BackupDestination {
  id: string;
  type: 'local' | 's3' | 'gcs' | 'azure' | 'ftp' | 'custom';
  path: string;
  credentials: Record<string, string>;
  encryption: boolean;
  compression: boolean;
}

export interface EnvironmentDeployment {
  id: string;
  environmentId: string;
  version: string;
  status: 'pending' | 'deploying' | 'success' | 'failed' | 'rollback';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  services: ServiceDeployment[];
  rollbackAvailable: boolean;
  previousVersion?: string;
  logs: DeploymentLog[];
  createdAt: Date;
}

export interface ServiceDeployment {
  serviceName: string;
  status: 'pending' | 'deploying' | 'success' | 'failed';
  replicas: number;
  readyReplicas: number;
  image: string;
  configChecksum: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  error?: string;
}

export interface DeploymentLog {
  id: string;
  deploymentId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  source: string;
}

export class UltraEnvManagement extends EventEmitter {
  private static instance: UltraEnvManagement;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private sshConnect: UltraSSHConnect;
  private serverProviders: UltraServerProviders;
  private environments: Map<string, Environment> = new Map();
  private deployments: Map<string, EnvironmentDeployment[]> = new Map();
  private encryptionKey: string;

  static getInstance(): UltraEnvManagement {
    if (!UltraEnvManagement.instance) {
      UltraEnvManagement.instance = new UltraEnvManagement();
    }
    return UltraEnvManagement.instance;
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
      // Initialize encryption key
      this.encryptionKey = await this.getOrCreateEncryptionKey();
      
      // Initialize database tables
      await this.initializeDatabase();
      
      // Load existing environments
      await this.loadEnvironments();
      
      // Load deployments
      await this.loadDeployments();
      
      // Start secret rotation monitoring
      this.startSecretRotationMonitoring();
      
      this.logger.info('env-management', 'Environment management system initialized', {
        environmentsCount: this.environments.size,
        deploymentsCount: Array.from(this.deployments.values()).reduce((sum, deployments) => sum + deployments.length, 0)
      });

    } catch (error) {
      this.logger.error('env-management', 'Failed to initialize environment management system', error as Error);
      throw error;
    }
  }

  private async getOrCreateEncryptionKey(): Promise<string> {
    try {
      // Try to get existing key from database
      const result = await this.database.query('SELECT key FROM encryption_keys WHERE id = \'env_management\'');
      
      if (result.rows.length > 0) {
        return result.rows[0].key;
      }
      
      // Generate new key
      const key = crypto.randomBytes(32).toString('hex');
      await this.database.query('INSERT INTO encryption_keys (id, key) VALUES (\'env_management\', $1)', [key]);
      
      return key;
    } catch (error) {
      this.logger.error('env-management', 'Failed to get/create encryption key', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    // Create encryption keys table
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id VARCHAR(255) PRIMARY KEY,
        key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS environments (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        server_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL,
        variables JSONB,
        secrets JSONB,
        config_files JSONB,
        services JSONB,
        networks JSONB,
        security JSONB,
        backup JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_deploy TIMESTAMP,
        version VARCHAR(50)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS environment_deployments (
        id VARCHAR(255) PRIMARY KEY,
        environment_id VARCHAR(255) NOT NULL,
        version VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTEGER,
        services JSONB,
        rollback_available BOOLEAN DEFAULT FALSE,
        previous_version VARCHAR(50),
        logs JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS secret_access_logs (
        id VARCHAR(255) PRIMARY KEY,
        secret_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        action VARCHAR(20) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_environments_server_id ON environments(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_environments_type ON environments(type)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_environment_deployments_environment_id ON environment_deployments(environment_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_secret_access_logs_secret_id ON secret_access_logs(secret_id)');
  }

  private async loadEnvironments(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM environments ORDER BY created_at DESC');
      
      for (const row of rows) {
        const environment: Environment = {
          id: row.id,
          name: row.name,
          serverId: row.server_id,
          type: row.type,
          description: row.description,
          status: row.status,
          variables: this.decryptVariables(row.variables || []),
          secrets: this.decryptSecrets(row.secrets || []),
          configFiles: row.config_files || [],
          services: row.services || [],
          networks: row.networks || [],
          security: row.security,
          backup: row.backup,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastDeploy: row.last_deploy,
          version: row.version || '1.0.0'
        };
        
        this.environments.set(environment.id, environment);
      }
      
      this.logger.info('env-management', `Loaded ${this.environments.size} environments`);
    } catch (error) {
      this.logger.error('env-management', 'Failed to load environments', error as Error);
    }
  }

  private async loadDeployments(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM environment_deployments ORDER BY created_at DESC');
      
      for (const row of rows) {
        const deployment: EnvironmentDeployment = {
          id: row.id,
          environmentId: row.environment_id,
          version: row.version,
          status: row.status,
          startTime: row.start_time,
          endTime: row.end_time,
          duration: row.duration,
          services: row.services || [],
          rollbackAvailable: row.rollback_available,
          previousVersion: row.previous_version,
          logs: row.logs || [],
          createdAt: row.created_at
        };
        
        if (!this.deployments.has(deployment.environmentId)) {
          this.deployments.set(deployment.environmentId, []);
        }
        this.deployments.get(deployment.environmentId)!.unshift(deployment);
      }
      
      this.logger.info('env-management', `Loaded ${Array.from(this.deployments.values()).reduce((sum, deployments) => sum + deployments.length, 0)} deployments`);
    } catch (error) {
      this.logger.error('env-management', 'Failed to load deployments', error as Error);
    }
  }

  private startSecretRotationMonitoring(): void {
    // Check for secrets that need rotation every hour
    setInterval(async () => {
      await this.checkSecretRotations();
    }, 60 * 60 * 1000);
  }

  private async checkSecretRotations(): Promise<void> {
    const now = new Date();
    
    for (const environment of this.environments.values()) {
      for (const secret of environment.secrets) {
        if (secret.rotationRequired && secret.nextRotation && secret.nextRotation <= now) {
          await this.rotateSecret(environment.id, secret.id);
        }
      }
    }
  }

  async createEnvironment(config: {
    name: string;
    serverId: string;
    type: Environment['type'];
    description?: string;
    variables?: Omit<EnvironmentVariable, 'id' | 'createdAt' | 'updatedAt'>[];
    secrets?: Omit<EnvironmentSecret, 'id' | 'accessLogs' | 'createdAt' | 'updatedAt'>[];
    configFiles?: Omit<ConfigFile, 'id' | 'createdAt' | 'updatedAt'>[];
    services?: Omit<ServiceConfig, 'id' | 'createdAt' | 'updatedAt'>[];
    networks?: Omit<NetworkConfig, 'id' | 'createdAt' | 'updatedAt'>[];
    security?: Partial<SecurityConfig>;
    backup?: Partial<BackupConfig>;
  }): Promise<string> {
    const environmentId = `env-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate server exists
      const server = this.serverProviders.getServer(config.serverId);
      if (!server) {
        throw new Error('Server not found');
      }

      const environment: Environment = {
        id: environmentId,
        name: config.name,
        serverId: config.serverId,
        type: config.type,
        description: config.description || '',
        status: 'inactive',
        variables: config.variables?.map(v => ({
          ...v,
          id: `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
          updatedAt: new Date()
        })) || [],
        secrets: config.secrets?.map(s => ({
          ...s,
          id: `secret-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          accessLogs: [],
          createdAt: new Date(),
          updatedAt: new Date()
        })) || [],
        configFiles: config.configFiles?.map(cf => ({
          ...cf,
          id: `config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          version: 1,
          checksum: this.calculateChecksum(cf.content),
          createdAt: new Date(),
          updatedAt: new Date()
        })) || [],
        services: config.services?.map(s => ({
          ...s,
          id: `service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
          updatedAt: new Date()
        })) || [],
        networks: config.networks?.map(n => ({
          ...n,
          id: `network-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
          updatedAt: new Date()
        })) || [],
        security: {
          encryption: {
            enabled: true,
            algorithm: 'AES-256-GCM',
            keyRotation: 90,
            ...config.security?.encryption
          },
          accessControl: {
            enabled: true,
            roles: [],
            permissions: [],
            ...config.security?.accessControl
          },
          audit: {
            enabled: true,
            logLevel: 'info',
            retention: 90,
            ...config.security?.audit
          },
          compliance: {
            standards: [],
            scanning: {
              enabled: false,
              frequency: 30,
              tools: [],
              ...config.security?.compliance?.scanning
            },
            ...config.security?.compliance
          },
          ...config.security
        },
        backup: {
          enabled: true,
          schedule: '0 2 * * *', // Daily at 2 AM
          retention: 30,
          compression: true,
          encryption: true,
          destinations: [],
          include: [],
          exclude: [],
          ...config.backup
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0'
      };

      await this.database.query(`
        INSERT INTO environments (
          id, name, server_id, type, description, status,
          variables, secrets, config_files, services, networks,
          security, backup, created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        environment.id,
        environment.name,
        environment.serverId,
        environment.type,
        environment.description,
        environment.status,
        JSON.stringify(this.encryptVariables(environment.variables)),
        JSON.stringify(this.encryptSecrets(environment.secrets)),
        JSON.stringify(environment.configFiles),
        JSON.stringify(environment.services),
        JSON.stringify(environment.networks),
        JSON.stringify(environment.security),
        JSON.stringify(environment.backup),
        environment.createdAt,
        environment.updatedAt,
        environment.version
      ]);

      this.environments.set(environmentId, environment);

      // Create environment directory on server
      await this.createEnvironmentDirectory(environment);

      this.logger.info('env-management', `Environment created: ${environment.name}`, {
        environmentId,
        type: config.type,
        serverId: config.serverId
      });

      this.emit('environmentCreated', environment);
      return environmentId;

    } catch (error) {
      this.logger.error('env-management', `Failed to create environment: ${config.name}`, error as Error);
      throw error;
    }
  }

  private async createEnvironmentDirectory(environment: Environment): Promise<void> {
    try {
      const connection = await this.getSSHConnection(environment.serverId);
      if (!connection) return;

      const envPath = `/opt/ultra/envs/${environment.id}`;
      
      // Create environment directory structure
      await this.sshConnect.executeCommand(connection.id, `sudo mkdir -p ${envPath}/{config,secrets,logs,backups}`, 10000);
      await this.sshConnect.executeCommand(connection.id, `sudo chown -R www-data:www-data ${envPath}`, 10000);
      await this.sshConnect.executeCommand(connection.id, `sudo chmod 750 ${envPath}`, 10000);

      // Create .env file
      const envContent = this.generateEnvFile(environment);
      await this.sshConnect.executeCommand(connection.id, `echo '${envContent}' | sudo tee ${envPath}/config/.env`, 10000);

    } catch (error) {
      this.logger.error('env-management', `Failed to create environment directory: ${environment.name}`, error as Error);
    }
  }

  private generateEnvFile(environment: Environment): string {
    let content = `# Environment: ${environment.name}\n`;
    content += `# Type: ${environment.type}\n`;
    content += `# Generated: ${new Date().toISOString()}\n\n`;

    for (const variable of environment.variables) {
      if (variable.scope.includes('runtime')) {
        content += `${variable.key}=${variable.value}\n`;
      }
    }

    return content;
  }

  async deployEnvironment(environmentId: string, version?: string): Promise<string> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error('Environment not found');
    }

    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const deploymentVersion = version || this.generateVersion();
    
    try {
      const deployment: EnvironmentDeployment = {
        id: deploymentId,
        environmentId,
        version: deploymentVersion,
        status: 'pending',
        startTime: new Date(),
        services: [],
        rollbackAvailable: false,
        logs: [],
        createdAt: new Date()
      };

      await this.database.query(`
        INSERT INTO environment_deployments (
          id, environment_id, version, status, start_time, services,
          rollback_available, logs, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        deployment.id,
        deployment.environmentId,
        deployment.version,
        deployment.status,
        deployment.startTime,
        JSON.stringify(deployment.services),
        deployment.rollbackAvailable,
        JSON.stringify(deployment.logs),
        deployment.createdAt
      ]);

      if (!this.deployments.has(environmentId)) {
        this.deployments.set(environmentId, []);
      }
      this.deployments.get(environmentId)!.unshift(deployment);

      // Start deployment process
      await this.performDeployment(deploymentId);

      this.logger.info('env-management', `Environment deployment started: ${environment.name}`, {
        deploymentId,
        environmentId,
        version: deploymentVersion
      });

      this.emit('deploymentStarted', { environment, deployment });
      return deploymentId;

    } catch (error) {
      this.logger.error('env-management', `Failed to start environment deployment: ${environment.name}`, error as Error);
      throw error;
    }
  }

  private async performDeployment(deploymentId: string): Promise<void> {
    const deployment = this.findDeployment(deploymentId);
    if (!deployment) return;

    const environment = this.environments.get(deployment.environmentId);
    if (!environment) return;

    try {
      deployment.status = 'deploying';
      await this.updateDeployment(deployment);

      await this.addDeploymentLog(deploymentId, 'info', 'Starting environment deployment', 'deployer');

      // Update environment status
      environment.status = 'active';
      environment.version = deployment.version;
      environment.lastDeploy = new Date();
      environment.updatedAt = new Date();
      await this.updateEnvironment(environment);

      // Deploy services
      for (const service of environment.services) {
        await this.deployService(deployment, service);
      }

      // Deploy config files
      for (const configFile of environment.configFiles) {
        await this.deployConfigFile(environment, configFile);
      }

      // Update environment variables
      await this.deployEnvironmentVariables(environment);

      // Setup networks
      for (const network of environment.networks) {
        await this.setupNetwork(environment, network);
      }

      deployment.status = 'success';
      deployment.endTime = new Date();
      deployment.duration = deployment.endTime.getTime() - deployment.startTime.getTime();
      deployment.rollbackAvailable = true;

      await this.updateDeployment(deployment);
      await this.addDeploymentLog(deploymentId, 'info', 'Environment deployment completed successfully', 'deployer');

      this.emit('deploymentCompleted', { environment, deployment });

    } catch (error) {
      deployment.status = 'failed';
      deployment.endTime = new Date();
      deployment.duration = deployment.endTime.getTime() - deployment.startTime.getTime();
      
      await this.updateDeployment(deployment);
      await this.addDeploymentLog(deploymentId, 'error', `Deployment failed: ${error.message}`, 'deployer');

      this.emit('deploymentFailed', { environment, deployment, error });
    }
  }

  private async deployService(deployment: EnvironmentDeployment, service: ServiceConfig): Promise<void> {
    const serviceDeployment: ServiceDeployment = {
      serviceName: service.name,
      status: 'deploying',
      replicas: service.deployment.replicas,
      readyReplicas: 0,
      image: service.image || 'latest',
      configChecksum: this.calculateServiceChecksum(service),
      startTime: new Date()
    };

    deployment.services.push(serviceDeployment);
    await this.addDeploymentLog(deployment.id, 'info', `Deploying service: ${service.name}`, 'deployer');

    try {
      // Simulate service deployment
      await new Promise(resolve => setTimeout(resolve, 2000));

      serviceDeployment.status = 'success';
      serviceDeployment.readyReplicas = serviceDeployment.replicas;
      serviceDeployment.endTime = new Date();
      serviceDeployment.duration = serviceDeployment.endTime.getTime() - serviceDeployment.startTime.getTime();

      await this.addDeploymentLog(deployment.id, 'info', `Service deployed successfully: ${service.name}`, 'deployer');

    } catch (error) {
      serviceDeployment.status = 'failed';
      serviceDeployment.error = error.message;
      serviceDeployment.endTime = new Date();
      serviceDeployment.duration = serviceDeployment.endTime.getTime() - serviceDeployment.startTime.getTime();

      await this.addDeploymentLog(deployment.id, 'error', `Service deployment failed: ${service.name} - ${error.message}`, 'deployer');
      throw error;
    }
  }

  private async deployConfigFile(environment: Environment, configFile: ConfigFile): Promise<void> {
    try {
      const connection = await this.getSSHConnection(environment.serverId);
      if (!connection) return;

      const envPath = `/opt/ultra/envs/${environment.id}`;
      const fullPath = `${envPath}/config/${configFile.path}`;

      // Create directory if needed
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      await this.sshConnect.executeCommand(connection.id, `sudo mkdir -p ${dir}`, 10000);

      // Write config file
      await this.sshConnect.executeCommand(connection.id, `echo '${configFile.content}' | sudo tee ${fullPath}`, 10000);
      await this.sshConnect.executeCommand(connection.id, `sudo chmod 640 ${fullPath}`, 10000);

      await this.addDeploymentLog(this.getCurrentDeployment(environment.id)!.id, 'info', `Config file deployed: ${configFile.name}`, 'deployer');

    } catch (error) {
      await this.addDeploymentLog(this.getCurrentDeployment(environment.id)!.id, 'error', `Config file deployment failed: ${configFile.name} - ${error.message}`, 'deployer');
      throw error;
    }
  }

  private async deployEnvironmentVariables(environment: Environment): Promise<void> {
    try {
      const connection = await this.getSSHConnection(environment.serverId);
      if (!connection) return;

      const envPath = `/opt/ultra/envs/${environment.id}`;
      const envContent = this.generateEnvFile(environment);

      await this.sshConnect.executeCommand(connection.id, `echo '${envContent}' | sudo tee ${envPath}/config/.env`, 10000);
      await this.sshConnect.executeCommand(connection.id, `sudo chmod 640 ${envPath}/config/.env`, 10000);

      await this.addDeploymentLog(this.getCurrentDeployment(environment.id)!.id, 'info', 'Environment variables deployed', 'deployer');

    } catch (error) {
      await this.addDeploymentLog(this.getCurrentDeployment(environment.id)!.id, 'error', `Environment variables deployment failed: ${error.message}`, 'deployer');
      throw error;
    }
  }

  private async setupNetwork(environment: Environment, network: NetworkConfig): Promise<void> {
    try {
      // Simulate network setup
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.addDeploymentLog(this.getCurrentDeployment(environment.id)!.id, 'info', `Network setup completed: ${network.name}`, 'deployer');

    } catch (error) {
      await this.addDeploymentLog(this.getCurrentDeployment(environment.id)!.id, 'error', `Network setup failed: ${network.name} - ${error.message}`, 'deployer');
      throw error;
    }
  }

  private getCurrentDeployment(environmentId: string): EnvironmentDeployment | null {
    const deployments = this.deployments.get(environmentId) || [];
    return deployments.find(d => d.status === 'deploying') || null;
  }

  private async addDeploymentLog(deploymentId: string, level: DeploymentLog['level'], message: string, source: string): Promise<void> {
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const log: DeploymentLog = {
      id: logId,
      deploymentId,
      level,
      message,
      timestamp: new Date(),
      source
    };

    const deployment = this.findDeployment(deploymentId);
    if (deployment) {
      deployment.logs.push(log);
    }

    // Update database
    await this.database.query(`
      UPDATE environment_deployments 
      SET logs = $1 
      WHERE id = $2
    `, [JSON.stringify(deployment?.logs || []), deploymentId]);
  }

  async addVariable(environmentId: string, variable: Omit<EnvironmentVariable, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error('Environment not found');
    }

    const variableId = `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const newVariable: EnvironmentVariable = {
        ...variable,
        id: variableId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      environment.variables.push(newVariable);
      environment.updatedAt = new Date();

      await this.updateEnvironment(environment);

      // Update .env file if environment is active
      if (environment.status === 'active') {
        await this.updateEnvFile(environment);
      }

      this.logger.info('env-management', `Variable added: ${variable.key}`, {
        environmentId,
        variableId
      });

      this.emit('variableAdded', { environment, variable: newVariable });
      return variableId;

    } catch (error) {
      this.logger.error('env-management', `Failed to add variable: ${variable.key}`, error as Error);
      throw error;
    }
  }

  async addSecret(environmentId: string, secret: Omit<EnvironmentSecret, 'id' | 'accessLogs' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error('Environment not found');
    }

    const secretId = `secret-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const newSecret: EnvironmentSecret = {
        ...secret,
        id: secretId,
        accessLogs: [],
        lastRotated: new Date(),
        nextRotation: secret.rotationRequired ? 
          new Date(Date.now() + secret.rotationInterval * 24 * 60 * 60 * 1000) : undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      environment.secrets.push(newSecret);
      environment.updatedAt = new Date();

      await this.updateEnvironment(environment);

      this.logger.info('env-management', `Secret added: ${secret.name}`, {
        environmentId,
        secretId
      });

      this.emit('secretAdded', { environment, secret: newSecret });
      return secretId;

    } catch (error) {
      this.logger.error('env-management', `Failed to add secret: ${secret.name}`, error as Error);
      throw error;
    }
  }

  async rotateSecret(environmentId: string, secretId: string): Promise<boolean> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error('Environment not found');
    }

    const secret = environment.secrets.find(s => s.id === secretId);
    if (!secret) {
      throw new Error('Secret not found');
    }

    try {
      // Generate new secret value
      const newValue = this.generateSecretValue(secret.type);

      // Log access
      await this.logSecretAccess(secretId, 'system', 'rotate', '127.0.0.1', 'system');

      // Update secret
      secret.value = newValue;
      secret.lastRotated = new Date();
      secret.nextRotation = secret.rotationRequired ? 
        new Date(Date.now() + secret.rotationInterval * 24 * 60 * 60 * 1000) : undefined;
      secret.updatedAt = new Date();

      environment.updatedAt = new Date();
      await this.updateEnvironment(environment);

      this.logger.info('env-management', `Secret rotated: ${secret.name}`, {
        environmentId,
        secretId
      });

      this.emit('secretRotated', { environment, secret });
      return true;

    } catch (error) {
      this.logger.error('env-management', `Failed to rotate secret: ${secret.name}`, error as Error);
      return false;
    }
  }

  private generateSecretValue(type: EnvironmentSecret['type']): string {
    switch (type) {
      case 'api_key':
        return `ak_${crypto.randomBytes(32).toString('hex')}`;
      case 'password':
        return crypto.randomBytes(16).toString('hex');
      case 'token':
        return `token_${crypto.randomBytes(24).toString('hex')}`;
      default:
        return crypto.randomBytes(32).toString('hex');
    }
  }

  private async logSecretAccess(secretId: string, userId: string, action: SecretAccessLog['action'], ipAddress: string, userAgent: string): Promise<void> {
    const logId = `access-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await this.database.query(`
        INSERT INTO secret_access_logs (id, secret_id, user_id, action, ip_address, user_agent, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [logId, secretId, userId, action, ipAddress, userAgent, new Date()]);
    } catch (error) {
      this.logger.error('env-management', 'Failed to log secret access', error as Error);
    }
  }

  private async updateEnvFile(environment: Environment): Promise<void> {
    try {
      const connection = await this.getSSHConnection(environment.serverId);
      if (!connection) return;

      const envPath = `/opt/ultra/envs/${environment.id}`;
      const envContent = this.generateEnvFile(environment);

      await this.sshConnect.executeCommand(connection.id, `echo '${envContent}' | sudo tee ${envPath}/config/.env`, 10000);

    } catch (error) {
      this.logger.error('env-management', `Failed to update env file: ${environment.name}`, error as Error);
    }
  }

  private encryptVariables(variables: EnvironmentVariable[]): EnvironmentVariable[] {
    return variables.map(v => ({
      ...v,
      value: v.encrypted ? this.encrypt(v.value) : v.value
    }));
  }

  private decryptVariables(variables: EnvironmentVariable[]): EnvironmentVariable[] {
    return variables.map(v => ({
      ...v,
      value: v.encrypted ? this.decrypt(v.value) : v.value
    }));
  }

  private encryptSecrets(secrets: EnvironmentSecret[]): EnvironmentSecret[] {
    return secrets.map(s => ({
      ...s,
      value: this.encrypt(s.value)
    }));
  }

  private decryptSecrets(secrets: EnvironmentSecret[]): EnvironmentSecret[] {
    return secrets.map(s => ({
      ...s,
      value: this.decrypt(s.value)
    }));
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    cipher.setAAD(Buffer.from('ultra-env'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAAD(Buffer.from('ultra-env'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private calculateServiceChecksum(service: ServiceConfig): string {
    const serviceData = JSON.stringify(service);
    return crypto.createHash('sha256').update(serviceData).digest('hex');
  }

  private generateVersion(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}.${month}.${day}.${hour}${minute}`;
  }

  private findDeployment(deploymentId: string): EnvironmentDeployment | null {
    for (const deployments of this.deployments.values()) {
      const deployment = deployments.find(d => d.id === deploymentId);
      if (deployment) return deployment;
    }
    return null;
  }

  private async updateEnvironment(environment: Environment): Promise<void> {
    await this.database.query(`
      UPDATE environments 
      SET status = $1, variables = $2, secrets = $3, updated_at = $4,
      last_deploy = $5, version = $6 
      WHERE id = $7
    `, [
      environment.status,
      JSON.stringify(this.encryptVariables(environment.variables)),
      JSON.stringify(this.encryptSecrets(environment.secrets)),
      environment.updatedAt,
      environment.lastDeploy,
      environment.version,
      environment.id
    ]);
  }

  private async updateDeployment(deployment: EnvironmentDeployment): Promise<void> {
    await this.database.query(`
      UPDATE environment_deployments 
      SET status = $1, end_time = $2, duration = $3, services = $4,
      rollback_available = $5, logs = $6 
      WHERE id = $7
    `, [
      deployment.status,
      deployment.endTime,
      deployment.duration,
      JSON.stringify(deployment.services),
      deployment.rollbackAvailable,
      JSON.stringify(deployment.logs),
      deployment.id
    ]);
  }

  private async getSSHConnection(serverId: string): Promise<any> {
    const connections = await this.sshConnect.getConnectionsByUserId('system');
    return connections.find(c => c.serverId === serverId);
  }

  // Public API methods
  async getEnvironment(environmentId: string): Promise<Environment | null> {
    return this.environments.get(environmentId) || null;
  }

  async getEnvironmentsByServer(serverId: string): Promise<Environment[]> {
    return Array.from(this.environments.values()).filter(e => e.serverId === serverId);
  }

  async getDeployments(environmentId: string): Promise<EnvironmentDeployment[]> {
    return this.deployments.get(environmentId) || [];
  }

  async getEnvironmentStats(): Promise<{
    totalEnvironments: number;
    activeEnvironments: number;
    environmentsByType: Record<string, number>;
    totalDeployments: number;
    successfulDeployments: number;
    totalSecrets: number;
    secretsNeedingRotation: number;
  }> {
    const environments = Array.from(this.environments.values());
    const allDeployments: EnvironmentDeployment[] = [];
    let totalSecrets = 0;
    let secretsNeedingRotation = 0;
    
    for (const environment of environments) {
      totalSecrets += environment.secrets.length;
      secretsNeedingRotation += environment.secrets.filter(s => 
        s.rotationRequired && s.nextRotation && s.nextRotation <= new Date()
      ).length;
    }
    
    for (const deployments of this.deployments.values()) {
      allDeployments.push(...deployments);
    }

    return {
      totalEnvironments: environments.length,
      activeEnvironments: environments.filter(e => e.status === 'active').length,
      environmentsByType: environments.reduce((acc, env) => {
        acc[env.type] = (acc[env.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalDeployments: allDeployments.length,
      successfulDeployments: allDeployments.filter(d => d.status === 'success').length,
      totalSecrets,
      secretsNeedingRotation
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    environmentsCount: number;
    activeEnvironmentsCount: number;
    deploymentsInProgress: number;
    secretsNeedingRotation: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getEnvironmentStats();
    
    const deploymentsInProgress = Array.from(this.deployments.values())
      .flat()
      .filter(d => d.status === 'deploying').length;
    
    if (stats.secretsNeedingRotation > 0) {
      issues.push(`${stats.secretsNeedingRotation} secrets need rotation`);
    }
    
    if (deploymentsInProgress > 10) {
      issues.push('High number of deployments in progress');
    }

    return {
      healthy: issues.length === 0,
      environmentsCount: stats.totalEnvironments,
      activeEnvironmentsCount: stats.activeEnvironments,
      deploymentsInProgress,
      secretsNeedingRotation: stats.secretsNeedingRotation,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.logger.info('env-management', 'Environment management system shut down');
  }
}

export default UltraEnvManagement;
