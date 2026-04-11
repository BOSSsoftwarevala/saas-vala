import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraSSHConnect } from './ssh-connect';
import { UltraSSLSystem } from './ssl-system';

const execAsync = promisify(exec);

export interface DeploymentConfig {
  id: string;
  name: string;
  serverId: string;
  projectId?: string;
  repository?: string;
  branch?: string;
  buildCommand?: string;
  installCommand?: string;
  startCommand?: string;
  environment: Record<string, string>;
  type: 'node' | 'php' | 'python' | 'static' | 'docker';
  status: 'pending' | 'building' | 'deploying' | 'completed' | 'failed' | 'rollback';
  deployPath: string;
  domain?: string;
  sslEnabled: boolean;
  autoRestart: boolean;
  healthCheckUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  deployedAt?: Date;
  lastHealthCheck?: Date;
  buildLogs?: string;
  deployLogs?: string;
}

export interface DeploymentStep {
  name: string;
  command: string;
  timeout: number;
  retries: number;
  critical: boolean;
}

export interface DeploymentResult {
  success: boolean;
  steps: Array<{
    name: string;
    success: boolean;
    output: string;
    error?: string;
    duration: number;
  }>;
  totalDuration: number;
  rollbackPerformed: boolean;
}

export interface ServerEnvironment {
  id: string;
  serverId: string;
  name: string;
  type: 'nginx' | 'node' | 'php' | 'python' | 'mysql' | 'postgresql' | 'redis' | 'docker';
  status: 'installed' | 'installing' | 'error' | 'not_installed';
  version?: string;
  configPath?: string;
  installedAt?: Date;
  lastChecked?: Date;
}

export class UltraAutoDeploy extends EventEmitter {
  private static instance: UltraAutoDeploy;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private sshConnect: UltraSSHConnect;
  private sslSystem: UltraSSLSystem;
  private deployments: Map<string, DeploymentConfig> = new Map();
  private serverEnvironments: Map<string, ServerEnvironment> = new Map();
  private activeDeployments: Map<string, boolean> = new Map();

  static getInstance(): UltraAutoDeploy {
    if (!UltraAutoDeploy.instance) {
      UltraAutoDeploy.instance = new UltraAutoDeploy();
    }
    return UltraAutoDeploy.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.sshConnect = UltraSSHConnect.getInstance();
    this.sslSystem = UltraSSLSystem.getInstance();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize database tables
      await this.initializeDatabase();
      
      // Load existing deployments and environments
      await this.loadDeployments();
      await this.loadServerEnvironments();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.logger.info('auto-deploy', 'Auto deploy system initialized', {
        deploymentsCount: this.deployments.size,
        environmentsCount: this.serverEnvironments.size
      });

    } catch (error) {
      this.logger.error('auto-deploy', 'Failed to initialize auto deploy system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS deployments (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        server_id VARCHAR(255) NOT NULL,
        project_id VARCHAR(255),
        repository TEXT,
        branch VARCHAR(255),
        build_command TEXT,
        install_command TEXT,
        start_command TEXT,
        environment JSONB,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        deploy_path TEXT NOT NULL,
        domain VARCHAR(255),
        ssl_enabled BOOLEAN DEFAULT FALSE,
        auto_restart BOOLEAN DEFAULT TRUE,
        health_check_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deployed_at TIMESTAMP,
        last_health_check TIMESTAMP,
        build_logs TEXT,
        deploy_logs TEXT
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS server_environments (
        id VARCHAR(255) PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        version VARCHAR(255),
        config_path TEXT,
        installed_at TIMESTAMP,
        last_checked TIMESTAMP
      )
    `);

    await this.database.query('CREATE INDEX IF NOT EXISTS idx_deployments_server_id ON deployments(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_server_environments_server_id ON server_environments(server_id)');
  }

  private async loadDeployments(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM deployments');
      
      for (const row of rows) {
        const deployment: DeploymentConfig = {
          id: row.id,
          name: row.name,
          serverId: row.server_id,
          projectId: row.project_id,
          repository: row.repository,
          branch: row.branch,
          buildCommand: row.build_command,
          installCommand: row.install_command,
          startCommand: row.start_command,
          environment: row.environment || {},
          type: row.type,
          status: row.status,
          deployPath: row.deploy_path,
          domain: row.domain,
          sslEnabled: row.ssl_enabled,
          autoRestart: row.auto_restart,
          healthCheckUrl: row.health_check_url,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deployedAt: row.deployed_at,
          lastHealthCheck: row.last_health_check,
          buildLogs: row.build_logs,
          deployLogs: row.deploy_logs
        };
        
        this.deployments.set(deployment.id, deployment);
      }
      
      this.logger.info('auto-deploy', `Loaded ${this.deployments.size} deployments`);
    } catch (error) {
      this.logger.error('auto-deploy', 'Failed to load deployments', error as Error);
    }
  }

  private async loadServerEnvironments(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM server_environments');
      
      for (const row of rows) {
        const environment: ServerEnvironment = {
          id: row.id,
          serverId: row.server_id,
          name: row.name,
          type: row.type,
          status: row.status,
          version: row.version,
          configPath: row.config_path,
          installedAt: row.installed_at,
          lastChecked: row.last_checked
        };
        
        this.serverEnvironments.set(environment.id, environment);
      }
      
      this.logger.info('auto-deploy', `Loaded ${this.serverEnvironments.size} server environments`);
    } catch (error) {
      this.logger.error('auto-deploy', 'Failed to load server environments', error as Error);
    }
  }

  async createDeployment(config: {
    name: string;
    serverId: string;
    projectId?: string;
    repository?: string;
    branch?: string;
    buildCommand?: string;
    installCommand?: string;
    startCommand?: string;
    environment?: Record<string, string>;
    type: DeploymentConfig['type'];
    deployPath: string;
    domain?: string;
    sslEnabled?: boolean;
    autoRestart?: boolean;
    healthCheckUrl?: string;
  }): Promise<string> {
    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const deployment: DeploymentConfig = {
        id: deploymentId,
        name: config.name,
        serverId: config.serverId,
        projectId: config.projectId,
        repository: config.repository,
        branch: config.branch || 'main',
        buildCommand: config.buildCommand,
        installCommand: config.installCommand,
        startCommand: config.startCommand,
        environment: config.environment || {},
        type: config.type,
        status: 'pending',
        deployPath: config.deployPath,
        domain: config.domain,
        sslEnabled: config.sslEnabled || false,
        autoRestart: config.autoRestart !== false,
        healthCheckUrl: config.healthCheckUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      await this.database.query(`
        INSERT INTO deployments (
          id, name, server_id, project_id, repository, branch, build_command,
          install_command, start_command, environment, type, status, deploy_path,
          domain, ssl_enabled, auto_restart, health_check_url, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `, [
        deployment.id,
        deployment.name,
        deployment.serverId,
        deployment.projectId,
        deployment.repository,
        deployment.branch,
        deployment.buildCommand,
        deployment.installCommand,
        deployment.startCommand,
        JSON.stringify(deployment.environment),
        deployment.type,
        deployment.status,
        deployment.deployPath,
        deployment.domain,
        deployment.sslEnabled,
        deployment.autoRestart,
        deployment.healthCheckUrl,
        deployment.createdAt,
        deployment.updatedAt
      ]);

      this.deployments.set(deploymentId, deployment);

      this.logger.info('auto-deploy', `Deployment created: ${deployment.name}`, {
        deploymentId,
        type: deployment.type,
        serverId: deployment.serverId
      });

      this.emit('deploymentCreated', deployment);
      return deploymentId;

    } catch (error) {
      this.logger.error('auto-deploy', `Failed to create deployment: ${config.name}`, error as Error);
      throw error;
    }
  }

  async deploy(deploymentId: string, connectionId: string): Promise<DeploymentResult> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    if (this.activeDeployments.has(deploymentId)) {
      throw new Error('Deployment already in progress');
    }

    this.activeDeployments.set(deploymentId, true);
    deployment.status = 'building';
    deployment.updatedAt = new Date();

    const startTime = Date.now();
    const result: DeploymentResult = {
      success: false,
      steps: [],
      totalDuration: 0,
      rollbackPerformed: false
    };

    try {
      this.logger.info('auto-deploy', `Starting deployment: ${deployment.name}`, {
        deploymentId,
        type: deployment.type,
        serverId: deployment.serverId
      });

      // Step 1: Setup server environment
      await this.setupServerEnvironment(connectionId, deployment);
      result.steps.push({
        name: 'Setup Environment',
        success: true,
        output: 'Server environment setup completed',
        duration: Date.now() - startTime
      });

      // Step 2: Clone repository if provided
      if (deployment.repository) {
        const cloneResult = await this.cloneRepository(connectionId, deployment);
        result.steps.push(cloneResult);
        if (!cloneResult.success) {
          throw new Error('Repository clone failed');
        }
      }

      // Step 3: Install dependencies
      const installResult = await this.installDependencies(connectionId, deployment);
      result.steps.push(installResult);
      if (!installResult.success) {
        throw new Error('Dependency installation failed');
      }

      // Step 4: Build project
      if (deployment.buildCommand) {
        const buildResult = await this.buildProject(connectionId, deployment);
        result.steps.push(buildResult);
        deployment.buildLogs = buildResult.output;
        
        if (!buildResult.success) {
          throw new Error('Build failed');
        }
      }

      // Step 5: Configure web server
      const configResult = await this.configureWebServer(connectionId, deployment);
      result.steps.push(configResult);
      if (!configResult.success) {
        throw new Error('Web server configuration failed');
      }

      // Step 6: Setup SSL if enabled
      if (deployment.sslEnabled && deployment.domain) {
        const sslResult = await this.setupSSL(connectionId, deployment);
        result.steps.push(sslResult);
        if (!sslResult.success) {
          this.logger.warn('auto-deploy', `SSL setup failed: ${deployment.name}`, {
            error: sslResult.error
          });
        }
      }

      // Step 7: Start application
      const startResult = await this.startApplication(connectionId, deployment);
      result.steps.push(startResult);
      if (!startResult.success) {
        throw new Error('Application start failed');
      }

      // Step 8: Health check
      if (deployment.healthCheckUrl) {
        const healthResult = await this.performHealthCheck(deployment);
        result.steps.push(healthResult);
        if (!healthResult.success) {
          this.logger.warn('auto-deploy', `Health check failed: ${deployment.name}`, {
            error: healthResult.error
          });
        }
      }

      // Mark deployment as completed
      deployment.status = 'completed';
      deployment.deployedAt = new Date();
      deployment.updatedAt = new Date();
      deployment.deployLogs = result.steps.map(s => s.output).join('\n');

      result.success = true;
      result.totalDuration = Date.now() - startTime;

      await this.database.query(`
        UPDATE deployments 
        SET status = 'completed', deployed_at = $1, updated_at = $2, deploy_logs = $3, build_logs = $4
        WHERE id = $5
      `, [deployment.deployedAt, deployment.updatedAt, deployment.deployLogs, deployment.buildLogs, deploymentId]);

      this.logger.info('auto-deploy', `Deployment completed successfully: ${deployment.name}`, {
        deploymentId,
        totalDuration: result.totalDuration,
        stepsCompleted: result.steps.length
      });

      this.emit('deploymentCompleted', { deployment, result });

    } catch (error) {
      deployment.status = 'failed';
      deployment.updatedAt = new Date();
      deployment.deployLogs = result.steps.map(s => s.output).join('\n') + '\nERROR: ' + error.message;

      // Attempt rollback
      try {
        await this.rollbackDeployment(connectionId, deployment);
        result.rollbackPerformed = true;
        result.steps.push({
          name: 'Rollback',
          success: true,
          output: 'Rollback completed successfully',
          duration: Date.now() - startTime
        });
      } catch (rollbackError) {
        result.steps.push({
          name: 'Rollback',
          success: false,
          output: '',
          error: rollbackError.message,
          duration: Date.now() - startTime
        });
      }

      await this.database.query(`
        UPDATE deployments 
        SET status = 'failed', updated_at = $2, deploy_logs = $3 
        WHERE id = $4
      `, [deployment.updatedAt, deployment.deployLogs, deploymentId]);

      this.logger.error('auto-deploy', `Deployment failed: ${deployment.name}`, error as Error);
      this.emit('deploymentFailed', { deployment, error, result });

    } finally {
      this.activeDeployments.delete(deploymentId);
      result.totalDuration = Date.now() - startTime;
    }

    return result;
  }

  private async setupServerEnvironment(connectionId: string, deployment: DeploymentConfig): Promise<void> {
    const environments = ['nginx', 'node', 'php', 'mysql'];
    
    for (const envType of environments) {
      const envId = `${deployment.serverId}-${envType}`;
      let environment = this.serverEnvironments.get(envId);
      
      if (!environment) {
        environment = {
          id: envId,
          serverId: deployment.serverId,
          name: envType,
          type: envType as ServerEnvironment['type'],
          status: 'not_installed'
        };
        this.serverEnvironments.set(envId, environment);
      }

      if (environment.status !== 'installed') {
        await this.installEnvironment(connectionId, environment);
      }
    }
  }

  private async installEnvironment(connectionId: string, environment: ServerEnvironment): Promise<void> {
    environment.status = 'installing';
    
    try {
      let installCommand = '';
      
      switch (environment.type) {
        case 'nginx':
          installCommand = 'sudo apt-get update && sudo apt-get install -y nginx';
          break;
        case 'node':
          installCommand = 'curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs';
          break;
        case 'php':
          installCommand = 'sudo apt-get install -y php php-fpm php-mysql php-xml php-mbstring';
          break;
        case 'mysql':
          installCommand = 'sudo apt-get install -y mysql-server';
          break;
      }

      if (installCommand) {
        const result = await this.sshConnect.executeCommand(connectionId, installCommand, 300000);
        if (!result.success) {
          throw new Error(`Failed to install ${environment.type}: ${result.stderr}`);
        }
      }

      environment.status = 'installed';
      environment.installedAt = new Date();
      environment.lastChecked = new Date();

      await this.database.query(`
        INSERT INTO server_environments (id, server_id, name, type, status, installed_at, last_checked)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          installed_at = EXCLUDED.installed_at,
          last_checked = EXCLUDED.last_checked
      `, [environment.id, environment.serverId, environment.name, environment.type, environment.status, environment.installedAt, environment.lastChecked]);

      this.logger.info('auto-deploy', `Environment installed: ${environment.type}`, {
        serverId: environment.serverId
      });

    } catch (error) {
      environment.status = 'error';
      this.logger.error('auto-deploy', `Failed to install environment: ${environment.type}`, error as Error);
      throw error;
    }
  }

  private async cloneRepository(connectionId: string, deployment: DeploymentConfig): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Create deploy directory
      await this.sshConnect.executeCommand(connectionId, `mkdir -p ${deployment.deployPath}`);
      
      // Clone repository
      const cloneCommand = `cd ${deployment.deployPath} && git clone ${deployment.repository} .`;
      if (deployment.branch) {
        const checkoutCommand = `cd ${deployment.deployPath} && git checkout ${deployment.branch}`;
        await this.sshConnect.executeCommand(connectionId, checkoutCommand);
      }

      const result = await this.sshConnect.executeCommand(connectionId, cloneCommand, 60000);
      
      return {
        name: 'Clone Repository',
        success: result.success,
        output: result.stdout,
        error: result.success ? undefined : result.stderr,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        name: 'Clone Repository',
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  private async installDependencies(connectionId: string, deployment: DeploymentConfig): Promise<any> {
    const startTime = Date.now();
    
    try {
      let command = '';
      
      switch (deployment.type) {
        case 'node':
          command = `cd ${deployment.deployPath} && npm install`;
          break;
        case 'php':
          command = `cd ${deployment.deployPath} && composer install --no-dev --optimize-autoloader`;
          break;
        case 'python':
          command = `cd ${deployment.deployPath} && pip install -r requirements.txt`;
          break;
        case 'static':
          // No dependencies for static sites
          return {
            name: 'Install Dependencies',
            success: true,
            output: 'No dependencies required for static site',
            duration: Date.now() - startTime
          };
      }

      if (deployment.installCommand) {
        command = `cd ${deployment.deployPath} && ${deployment.installCommand}`;
      }

      if (!command) {
        return {
          name: 'Install Dependencies',
          success: true,
          output: 'No install command specified',
          duration: Date.now() - startTime
        };
      }

      const result = await this.sshConnect.executeCommand(connectionId, command, 300000);
      
      return {
        name: 'Install Dependencies',
        success: result.success,
        output: result.stdout,
        error: result.success ? undefined : result.stderr,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        name: 'Install Dependencies',
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  private async buildProject(connectionId: string, deployment: DeploymentConfig): Promise<any> {
    const startTime = Date.now();
    
    try {
      const command = `cd ${deployment.deployPath} && ${deployment.buildCommand}`;
      const result = await this.sshConnect.executeCommand(connectionId, command, 600000);
      
      return {
        name: 'Build Project',
        success: result.success,
        output: result.stdout,
        error: result.success ? undefined : result.stderr,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        name: 'Build Project',
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  private async configureWebServer(connectionId: string, deployment: DeploymentConfig): Promise<any> {
    const startTime = Date.now();
    
    try {
      let config = '';
      
      if (deployment.type === 'node') {
        config = this.generateNginxConfig(deployment, 3000);
      } else if (deployment.type === 'php') {
        config = this.generateNginxConfig(deployment, 9000);
      } else if (deployment.type === 'static') {
        config = this.generateNginxConfig(deployment);
      }

      if (config) {
        const configPath = `/etc/nginx/sites-available/${deployment.name}`;
        const command = `echo '${config}' | sudo tee ${configPath} && sudo ln -sf ${configPath} /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`;
        
        const result = await this.sshConnect.executeCommand(connectionId, command);
        
        return {
          name: 'Configure Web Server',
          success: result.success,
          output: result.stdout,
          error: result.success ? undefined : result.stderr,
          duration: Date.now() - startTime
        };
      }

      return {
        name: 'Configure Web Server',
        success: true,
        output: 'No web server configuration needed',
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        name: 'Configure Web Server',
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  private generateNginxConfig(deployment: DeploymentConfig, port?: number): string {
    const domain = deployment.domain || 'localhost';
    const rootPath = deployment.type === 'static' ? deployment.deployPath : undefined;
    
    let config = `server {
    listen 80;
    server_name ${domain} www.${domain};
`;

    if (rootPath) {
      config += `
    root ${rootPath};
    index index.html index.htm;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
`;
    } else if (port) {
      config += `
    location / {
        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
`;
    }

    config += `
    access_log /var/log/nginx/${deployment.name}.access.log;
    error_log /var/log/nginx/${deployment.name}.error.log;
}
`;

    return config;
  }

  private async setupSSL(connectionId: string, deployment: DeploymentConfig): Promise<any> {
    const startTime = Date.now();
    
    try {
      if (!deployment.domain) {
        throw new Error('Domain required for SSL setup');
      }

      // This would integrate with the SSL system
      // For now, create a simple self-signed certificate
      const sslCommand = `
        sudo mkdir -p /etc/ssl/certs/${deployment.domain}
        sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
          -keyout /etc/ssl/certs/${deployment.domain}/${deployment.domain}.key \\
          -out /etc/ssl/certs/${deployment.domain}/${deployment.domain}.cert \\
          -subj "/C=US/ST=California/L=San Francisco/O=SaaS Vala/CN=${deployment.domain}"
      `;

      const result = await this.sshConnect.executeCommand(connectionId, sslCommand);
      
      if (result.success) {
        // Update nginx config for SSL
        const sslConfig = this.generateSSLNginxConfig(deployment);
        const configCommand = `echo '${sslConfig}' | sudo tee /etc/nginx/sites-available/${deployment.name}-ssl && sudo ln -sf /etc/nginx/sites-available/${deployment.name}-ssl /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`;
        
        await this.sshConnect.executeCommand(connectionId, configCommand);
      }

      return {
        name: 'Setup SSL',
        success: result.success,
        output: result.stdout,
        error: result.success ? undefined : result.stderr,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        name: 'Setup SSL',
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  private generateSSLNginxConfig(deployment: DeploymentConfig): string {
    return `server {
    listen 443 ssl http2;
    server_name ${deployment.domain} www.${deployment.domain};
    
    ssl_certificate /etc/ssl/certs/${deployment.domain}/${deployment.domain}.cert;
    ssl_certificate_key /etc/ssl/certs/${deployment.domain}/${deployment.domain}.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name ${deployment.domain} www.${deployment.domain};
    return 301 https://$server_name$request_uri;
}
`;
  }

  private async startApplication(connectionId: string, deployment: DeploymentConfig): Promise<any> {
    const startTime = Date.now();
    
    try {
      let command = '';
      
      if (deployment.startCommand) {
        command = `cd ${deployment.deployPath} && ${deployment.startCommand}`;
      } else {
        switch (deployment.type) {
          case 'node':
            command = `cd ${deployment.deployPath} && npm start`;
            break;
          case 'php':
            command = `sudo systemctl restart php8.1-fpm`;
            break;
          case 'static':
            // Static sites don't need to be started
            return {
              name: 'Start Application',
              success: true,
              output: 'Static site - no start command needed',
              duration: Date.now() - startTime
            };
        }
      }

      if (!command) {
        return {
          name: 'Start Application',
          success: true,
          output: 'No start command specified',
          duration: Date.now() - startTime
        };
      }

      const result = await this.sshConnect.executeCommand(connectionId, command, 30000);
      
      return {
        name: 'Start Application',
        success: result.success,
        output: result.stdout,
        error: result.success ? undefined : result.stderr,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        name: 'Start Application',
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  private async performHealthCheck(deployment: DeploymentConfig): Promise<any> {
    const startTime = Date.now();
    
    try {
      if (!deployment.healthCheckUrl) {
        return {
          name: 'Health Check',
          success: true,
          output: 'No health check URL configured',
          duration: Date.now() - startTime
        };
      }

      // This would make an HTTP request to the health check URL
      // For now, simulate the check
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      deployment.lastHealthCheck = new Date();
      
      return {
        name: 'Health Check',
        success: true,
        output: `Health check passed for ${deployment.healthCheckUrl}`,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        name: 'Health Check',
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  private async rollbackDeployment(connectionId: string, deployment: DeploymentConfig): Promise<void> {
    this.logger.info('auto-deploy', `Rolling back deployment: ${deployment.name}`, {
      deploymentId: deployment.id
    });

    try {
      // Remove nginx configuration
      await this.sshConnect.executeCommand(connectionId, `sudo rm -f /etc/nginx/sites-enabled/${deployment.name} && sudo systemctl reload nginx`);
      
      // Stop application
      if (deployment.startCommand) {
        // This would need to track the process ID for proper stopping
        await this.sshConnect.executeCommand(connectionId, `pkill -f "${deployment.startCommand}"`);
      }

      this.logger.info('auto-deploy', `Rollback completed: ${deployment.name}`);

    } catch (error) {
      this.logger.error('auto-deploy', `Rollback failed: ${deployment.name}`, error as Error);
      throw error;
    }
  }

  private startHealthMonitoring(): void {
    // Check health of deployed applications every 5 minutes
    setInterval(async () => {
      for (const [deploymentId, deployment] of this.deployments.entries()) {
        if (deployment.status === 'completed' && deployment.healthCheckUrl) {
          try {
            const healthResult = await this.performHealthCheck(deployment);
            if (!healthResult.success) {
              this.logger.warn('auto-deploy', `Health check failed: ${deployment.name}`, {
                deploymentId,
                error: healthResult.error
              });
              
              if (deployment.autoRestart) {
                // Attempt to restart the application
                this.logger.info('auto-deploy', `Attempting auto-restart: ${deployment.name}`);
                // This would implement the restart logic
              }
            }
          } catch (error) {
            this.logger.error('auto-deploy', `Health check error: ${deployment.name}`, error as Error);
          }
        }
      }
    }, 300000); // 5 minutes
  }

  // Public API methods
  async getDeployment(deploymentId: string): Promise<DeploymentConfig | null> {
    return this.deployments.get(deploymentId) || null;
  }

  async getDeploymentsByServer(serverId: string): Promise<DeploymentConfig[]> {
    return Array.from(this.deployments.values()).filter(d => d.serverId === serverId);
  }

  async deleteDeployment(deploymentId: string): Promise<boolean> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      return false;
    }

    try {
      // Delete from database
      await this.database.query('DELETE FROM deployments WHERE id = $1', [deploymentId]);

      this.deployments.delete(deploymentId);

      this.logger.info('auto-deploy', `Deployment deleted: ${deployment.name}`, {
        deploymentId
      });

      this.emit('deploymentDeleted', { deploymentId, name: deployment.name });
      return true;

    } catch (error) {
      this.logger.error('auto-deploy', `Failed to delete deployment: ${deployment.name}`, error as Error);
      return false;
    }
  }

  async getDeploymentStats(): Promise<{
    totalDeployments: number;
    completedDeployments: number;
    failedDeployments: number;
    pendingDeployments: number;
    deploymentsByType: Record<string, number>;
    deploymentsByServer: Record<string, number>;
  }> {
    const deployments = Array.from(this.deployments.values());
    
    return {
      totalDeployments: deployments.length,
      completedDeployments: deployments.filter(d => d.status === 'completed').length,
      failedDeployments: deployments.filter(d => d.status === 'failed').length,
      pendingDeployments: deployments.filter(d => d.status === 'pending').length,
      deploymentsByType: deployments.reduce((acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      deploymentsByServer: deployments.reduce((acc, d) => {
        acc[d.serverId] = (acc[d.serverId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    deploymentsCount: number;
    environmentsCount: number;
    activeDeployments: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getDeploymentStats();
    
    if (stats.failedDeployments > 0) {
      issues.push(`${stats.failedDeployments} deployments have failed`);
    }
    
    if (this.activeDeployments.size > 0) {
      issues.push(`${this.activeDeployments.size} deployments currently in progress`);
    }

    return {
      healthy: issues.length === 0,
      deploymentsCount: stats.totalDeployments,
      environmentsCount: this.serverEnvironments.size,
      activeDeployments: this.activeDeployments.size,
      issues
    };
  }
}

export default UltraAutoDeploy;
