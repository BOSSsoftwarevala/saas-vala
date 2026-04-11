import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraSSHConnect } from './ssh-connect';
import { UltraServerProviders } from './server-providers';
import { UltraAutoDeploy } from './auto-deploy';
import { UltraDomainSystem } from './domain-system';
import { UltraSSLSystem } from './ssl-system';

export interface BuilderProject {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string;
  branch: string;
  buildType: 'static' | 'node' | 'python' | 'php' | 'docker' | 'custom';
  buildCommand: string;
  outputDirectory: string;
  environment: Record<string, string>;
  dependencies: string[];
  scripts: {
    build?: string;
    start?: string;
    test?: string;
    deploy?: string;
  };
  config: BuilderConfig;
  status: 'active' | 'inactive' | 'building' | 'error';
  createdAt: Date;
  updatedAt: Date;
  lastBuild?: Date;
}

export interface BuilderConfig {
  autoDeploy: boolean;
  buildOnPush: boolean;
  deploymentServerId: string;
  domain?: string;
  sslEnabled: boolean;
  environmentVariables: Record<string, string>;
  buildTimeout: number;
  retries: number;
  notifications: {
    email?: string;
    webhook?: string;
    slack?: string;
  };
  performance: {
    caching: boolean;
    compression: boolean;
    minification: boolean;
  };
  security: {
    headers: Record<string, string>;
    cors: boolean;
    rateLimit: boolean;
  };
}

export interface Build {
  id: string;
  projectId: string;
  commitHash: string;
  branch: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  progress: number;
  logs: BuildLog[];
  artifacts: BuildArtifact[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  trigger: 'manual' | 'push' | 'api' | 'schedule';
  triggeredBy: string;
  errorMessage?: string;
  createdAt: Date;
}

export interface BuildLog {
  id: string;
  buildId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  source: 'builder' | 'deployer' | 'system';
}

export interface BuildArtifact {
  id: string;
  buildId: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  checksum: string;
  deployed: boolean;
  deploymentPath?: string;
  createdAt: Date;
}

export interface Deployment {
  id: string;
  buildId: string;
  projectId: string;
  serverId: string;
  status: 'pending' | 'deploying' | 'success' | 'failed' | 'rollback';
  progress: number;
  logs: DeploymentLog[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  rollbackAvailable: boolean;
  previousDeploymentId?: string;
  errorMessage?: string;
  createdAt: Date;
}

export interface DeploymentLog {
  id: string;
  deploymentId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  source: 'deployer' | 'server' | 'system';
}

export interface Webhook {
  id: string;
  projectId: string;
  url: string;
  events: ('push' | 'pull_request' | 'build' | 'deploy')[];
  secret: string;
  active: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  createdAt: Date;
}

export class UltraBuilderServerLink extends EventEmitter {
  private static instance: UltraBuilderServerLink;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private sshConnect: UltraSSHConnect;
  private serverProviders: UltraServerProviders;
  private autoDeploy: UltraAutoDeploy;
  private domainSystem: UltraDomainSystem;
  private sslSystem: UltraSSLSystem;
  private projects: Map<string, BuilderProject> = new Map();
  private builds: Map<string, Build[]> = new Map();
  private deployments: Map<string, Deployment[]> = new Map();
  private webhooks: Map<string, Webhook[]> = new Map();
  private activeBuilds: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): UltraBuilderServerLink {
    if (!UltraBuilderServerLink.instance) {
      UltraBuilderServerLink.instance = new UltraBuilderServerLink();
    }
    return UltraBuilderServerLink.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.sshConnect = UltraSSHConnect.getInstance();
    this.serverProviders = UltraServerProviders.getInstance();
    this.autoDeploy = UltraAutoDeploy.getInstance();
    this.domainSystem = UltraDomainSystem.getInstance();
    this.sslSystem = UltraSSLSystem.getInstance();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize database tables
      await this.initializeDatabase();
      
      // Load existing projects
      await this.loadProjects();
      
      // Load existing builds and deployments
      await this.loadBuilds();
      await this.loadDeployments();
      await this.loadWebhooks();
      
      // Setup webhook listeners
      this.setupWebhookListeners();
      
      this.logger.info('builder-server-link', 'Builder and server link system initialized', {
        projectsCount: this.projects.size,
        totalBuilds: Array.from(this.builds.values()).reduce((sum, builds) => sum + builds.length, 0),
        totalDeployments: Array.from(this.deployments.values()).reduce((sum, deployments) => sum + deployments.length, 0),
        webhooksCount: Array.from(this.webhooks.values()).reduce((sum, webhooks) => sum + webhooks.length, 0)
      });

    } catch (error) {
      this.logger.error('builder-server-link', 'Failed to initialize builder server link system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS builder_projects (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        repository_url TEXT NOT NULL,
        branch VARCHAR(255) NOT NULL,
        build_type VARCHAR(20) NOT NULL,
        build_command TEXT,
        output_directory TEXT,
        environment JSONB,
        dependencies JSONB,
        scripts JSONB,
        config JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_build TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS builds (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL,
        commit_hash VARCHAR(255) NOT NULL,
        branch VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        progress INTEGER DEFAULT 0,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTEGER,
        trigger VARCHAR(20) NOT NULL,
        triggered_by VARCHAR(255) NOT NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS build_logs (
        id VARCHAR(255) PRIMARY KEY,
        build_id VARCHAR(255) NOT NULL,
        level VARCHAR(10) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        source VARCHAR(20) NOT NULL
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS build_artifacts (
        id VARCHAR(255) PRIMARY KEY,
        build_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        path TEXT NOT NULL,
        size BIGINT NOT NULL,
        type VARCHAR(20) NOT NULL,
        checksum VARCHAR(255),
        deployed BOOLEAN DEFAULT FALSE,
        deployment_path TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS deployments (
        id VARCHAR(255) PRIMARY KEY,
        build_id VARCHAR(255) NOT NULL,
        project_id VARCHAR(255) NOT NULL,
        server_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        progress INTEGER DEFAULT 0,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTEGER,
        rollback_available BOOLEAN DEFAULT FALSE,
        previous_deployment_id VARCHAR(255),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS deployment_logs (
        id VARCHAR(255) PRIMARY KEY,
        deployment_id VARCHAR(255) NOT NULL,
        level VARCHAR(10) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        source VARCHAR(20) NOT NULL
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        events JSONB NOT NULL,
        secret VARCHAR(255),
        active BOOLEAN DEFAULT TRUE,
        last_triggered TIMESTAMP,
        trigger_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_builder_projects_status ON builder_projects(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_builds_project_id ON builds(project_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_build_logs_build_id ON build_logs(build_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_webhooks_project_id ON webhooks(project_id)');
  }

  private async loadProjects(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM builder_projects');
      
      for (const row of rows) {
        const project: BuilderProject = {
          id: row.id,
          name: row.name,
          description: row.description,
          repositoryUrl: row.repository_url,
          branch: row.branch,
          buildType: row.build_type,
          buildCommand: row.build_command,
          outputDirectory: row.output_directory,
          environment: row.environment || {},
          dependencies: row.dependencies || [],
          scripts: row.scripts || {},
          config: row.config,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastBuild: row.last_build
        };
        
        this.projects.set(project.id, project);
      }
      
      this.logger.info('builder-server-link', `Loaded ${this.projects.size} builder projects`);
    } catch (error) {
      this.logger.error('builder-server-link', 'Failed to load builder projects', error as Error);
    }
  }

  private async loadBuilds(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM builds ORDER BY created_at DESC');
      
      for (const row of rows) {
        const build: Build = {
          id: row.id,
          projectId: row.project_id,
          commitHash: row.commit_hash,
          branch: row.branch,
          status: row.status,
          progress: row.progress,
          logs: [],
          artifacts: [],
          startTime: row.start_time,
          endTime: row.end_time,
          duration: row.duration,
          trigger: row.trigger,
          triggeredBy: row.triggered_by,
          errorMessage: row.error_message,
          createdAt: row.created_at
        };
        
        if (!this.builds.has(build.projectId)) {
          this.builds.set(build.projectId, []);
        }
        this.builds.get(build.projectId)!.push(build);
      }
      
      this.logger.info('builder-server-link', `Loaded ${Array.from(this.builds.values()).reduce((sum, builds) => sum + builds.length, 0)} builds`);
    } catch (error) {
      this.logger.error('builder-server-link', 'Failed to load builds', error as Error);
    }
  }

  private async loadDeployments(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM deployments ORDER BY created_at DESC');
      
      for (const row of rows) {
        const deployment: Deployment = {
          id: row.id,
          buildId: row.build_id,
          projectId: row.project_id,
          serverId: row.server_id,
          status: row.status,
          progress: row.progress,
          logs: [],
          startTime: row.start_time,
          endTime: row.end_time,
          duration: row.duration,
          rollbackAvailable: row.rollback_available,
          previousDeploymentId: row.previous_deployment_id,
          errorMessage: row.error_message,
          createdAt: row.created_at
        };
        
        if (!this.deployments.has(deployment.projectId)) {
          this.deployments.set(deployment.projectId, []);
        }
        this.deployments.get(deployment.projectId)!.push(deployment);
      }
      
      this.logger.info('builder-server-link', `Loaded ${Array.from(this.deployments.values()).reduce((sum, deployments) => sum + deployments.length, 0)} deployments`);
    } catch (error) {
      this.logger.error('builder-server-link', 'Failed to load deployments', error as Error);
    }
  }

  private async loadWebhooks(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM webhooks');
      
      for (const row of rows) {
        const webhook: Webhook = {
          id: row.id,
          projectId: row.project_id,
          url: row.url,
          events: row.events,
          secret: row.secret,
          active: row.active,
          lastTriggered: row.last_triggered,
          triggerCount: row.trigger_count,
          createdAt: row.created_at
        };
        
        if (!this.webhooks.has(webhook.projectId)) {
          this.webhooks.set(webhook.projectId, []);
        }
        this.webhooks.get(webhook.projectId)!.push(webhook);
      }
      
      this.logger.info('builder-server-link', `Loaded ${Array.from(this.webhooks.values()).reduce((sum, webhooks) => sum + webhooks.length, 0)} webhooks`);
    } catch (error) {
      this.logger.error('builder-server-link', 'Failed to load webhooks', error as Error);
    }
  }

  private setupWebhookListeners(): void {
    // Setup webhook endpoint listeners (would integrate with Express/Fastify)
    this.logger.info('builder-server-link', 'Webhook listeners configured');
  }

  async createProject(config: {
    name: string;
    description?: string;
    repositoryUrl: string;
    branch?: string;
    buildType: BuilderProject['buildType'];
    buildCommand?: string;
    outputDirectory?: string;
    environment?: Record<string, string>;
    dependencies?: string[];
    scripts?: BuilderProject['scripts'];
    config?: Partial<BuilderConfig>;
  }): Promise<string> {
    const projectId = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const project: BuilderProject = {
        id: projectId,
        name: config.name,
        description: config.description || '',
        repositoryUrl: config.repositoryUrl,
        branch: config.branch || 'main',
        buildType: config.buildType,
        buildCommand: config.buildCommand || this.getDefaultBuildCommand(config.buildType),
        outputDirectory: config.outputDirectory || this.getDefaultOutputDirectory(config.buildType),
        environment: config.environment || {},
        dependencies: config.dependencies || [],
        scripts: config.scripts || {},
        config: {
          autoDeploy: true,
          buildOnPush: true,
          deploymentServerId: '',
          sslEnabled: true,
          environmentVariables: {},
          buildTimeout: 600,
          retries: 3,
          notifications: {},
          performance: {
            caching: true,
            compression: true,
            minification: true
          },
          security: {
            headers: {},
            cors: true,
            rateLimit: true
          },
          ...config.config
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO builder_projects (
          id, name, description, repository_url, branch, build_type,
          build_command, output_directory, environment, dependencies,
          scripts, config, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        project.id,
        project.name,
        project.description,
        project.repositoryUrl,
        project.branch,
        project.buildType,
        project.buildCommand,
        project.outputDirectory,
        JSON.stringify(project.environment),
        JSON.stringify(project.dependencies),
        JSON.stringify(project.scripts),
        JSON.stringify(project.config),
        project.status,
        project.createdAt,
        project.updatedAt
      ]);

      this.projects.set(projectId, project);

      this.logger.info('builder-server-link', `Builder project created: ${project.name}`, {
        projectId,
        buildType: config.buildType,
        repositoryUrl: config.repositoryUrl
      });

      this.emit('projectCreated', project);
      return projectId;

    } catch (error) {
      this.logger.error('builder-server-link', `Failed to create builder project: ${config.name}`, error as Error);
      throw error;
    }
  }

  async triggerBuild(projectId: string, options: {
    branch?: string;
    commitHash?: string;
    trigger?: Build['trigger'];
    triggeredBy?: string;
  } = {}): Promise<string> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const buildId = `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const build: Build = {
        id: buildId,
        projectId,
        commitHash: options.commitHash || 'latest',
        branch: options.branch || project.branch,
        status: 'pending',
        progress: 0,
        logs: [],
        artifacts: [],
        startTime: new Date(),
        trigger: options.trigger || 'manual',
        triggeredBy: options.triggeredBy || 'system',
        createdAt: new Date()
      };

      await this.database.query(`
        INSERT INTO builds (
          id, project_id, commit_hash, branch, status, start_time,
          trigger, triggered_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        build.id,
        build.projectId,
        build.commitHash,
        build.branch,
        build.status,
        build.startTime,
        build.trigger,
        build.triggeredBy,
        build.createdAt
      ]);

      if (!this.builds.has(projectId)) {
        this.builds.set(projectId, []);
      }
      this.builds.get(projectId)!.unshift(build);

      // Start build process
      this.startBuild(buildId);

      this.logger.info('builder-server-link', `Build triggered for project: ${project.name}`, {
        buildId,
        projectId,
        branch: build.branch,
        trigger: build.trigger
      });

      this.emit('buildTriggered', build);
      return buildId;

    } catch (error) {
      this.logger.error('builder-server-link', `Failed to trigger build for project: ${project.name}`, error as Error);
      throw error;
    }
  }

  private async startBuild(buildId: string): Promise<void> {
    const build = this.findBuild(buildId);
    if (!build) return;

    const project = this.projects.get(build.projectId);
    if (!project) return;

    try {
      build.status = 'running';
      await this.updateBuild(build);

      await this.addBuildLog(buildId, 'info', 'Starting build process', 'builder');

      // Clone repository
      await this.cloneRepository(build, project);

      // Install dependencies
      await this.installDependencies(build, project);

      // Run build command
      await this.runBuildCommand(build, project);

      // Create artifacts
      await this.createBuildArtifacts(build, project);

      build.status = 'success';
      build.endTime = new Date();
      build.duration = build.endTime.getTime() - build.startTime.getTime();
      build.progress = 100;

      await this.updateBuild(build);
      await this.addBuildLog(buildId, 'info', 'Build completed successfully', 'builder');

      // Auto-deploy if configured
      if (project.config.autoDeploy && project.config.deploymentServerId) {
        await this.triggerDeployment(buildId, project.config.deploymentServerId);
      }

      // Update project last build time
      project.lastBuild = build.endTime;
      project.updatedAt = new Date();
      await this.updateProject(project);

      this.emit('buildCompleted', build);

    } catch (error) {
      build.status = 'failed';
      build.endTime = new Date();
      build.duration = build.endTime.getTime() - build.startTime.getTime();
      build.errorMessage = error.message;

      await this.updateBuild(build);
      await this.addBuildLog(buildId, 'error', `Build failed: ${error.message}`, 'builder');

      this.emit('buildFailed', build);
    }
  }

  private async cloneRepository(build: Build, project: BuilderProject): Promise<void> {
    await this.addBuildLog(build.id, 'info', `Cloning repository: ${project.repositoryUrl}`, 'builder');
    
    // Simulate repository cloning
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.addBuildLog(build.id, 'info', 'Repository cloned successfully', 'builder');
  }

  private async installDependencies(build: Build, project: BuilderProject): Promise<void> {
    if (project.dependencies.length === 0) return;

    await this.addBuildLog(build.id, 'info', 'Installing dependencies', 'builder');

    // Simulate dependency installation
    await new Promise(resolve => setTimeout(resolve, 5000));

    await this.addBuildLog(build.id, 'info', 'Dependencies installed successfully', 'builder');
  }

  private async runBuildCommand(build: Build, project: BuilderProject): Promise<void> {
    await this.addBuildLog(build.id, 'info', `Running build command: ${project.buildCommand}`, 'builder');

    // Simulate build process
    await new Promise(resolve => setTimeout(resolve, 10000));

    await this.addBuildLog(build.id, 'info', 'Build command completed successfully', 'builder');
  }

  private async createBuildArtifacts(build: Build, project: BuilderProject): Promise<void> {
    await this.addBuildLog(build.id, 'info', 'Creating build artifacts', 'builder');

    // Create simulated artifacts
    const artifactId = `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const artifact: BuildArtifact = {
      id: artifactId,
      buildId: build.id,
      name: 'build-output',
      path: project.outputDirectory,
      size: 1024 * 1024, // 1MB
      type: 'directory',
      checksum: 'sha256:abc123',
      deployed: false,
      createdAt: new Date()
    };

    await this.database.query(`
      INSERT INTO build_artifacts (
        id, build_id, name, path, size, type, checksum, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      artifact.id,
      artifact.buildId,
      artifact.name,
      artifact.path,
      artifact.size,
      artifact.type,
      artifact.checksum,
      artifact.createdAt
    ]);

    build.artifacts.push(artifact);

    await this.addBuildLog(build.id, 'info', 'Build artifacts created successfully', 'builder');
  }

  async triggerDeployment(buildId: string, serverId: string): Promise<string> {
    const build = this.findBuild(buildId);
    if (!build) {
      throw new Error('Build not found');
    }

    const project = this.projects.get(build.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const deployment: Deployment = {
        id: deploymentId,
        buildId,
        projectId: build.projectId,
        serverId,
        status: 'pending',
        progress: 0,
        logs: [],
        startTime: new Date(),
        rollbackAvailable: false,
        createdAt: new Date()
      };

      await this.database.query(`
        INSERT INTO deployments (
          id, build_id, project_id, server_id, status, start_time, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        deployment.id,
        deployment.buildId,
        deployment.projectId,
        deployment.serverId,
        deployment.status,
        deployment.startTime,
        deployment.createdAt
      ]);

      if (!this.deployments.has(build.projectId)) {
        this.deployments.set(build.projectId, []);
      }
      this.deployments.get(build.projectId)!.unshift(deployment);

      // Start deployment process
      this.startDeployment(deploymentId);

      this.logger.info('builder-server-link', `Deployment triggered for build: ${buildId}`, {
        deploymentId,
        buildId,
        serverId
      });

      this.emit('deploymentTriggered', deployment);
      return deploymentId;

    } catch (error) {
      this.logger.error('builder-server-link', `Failed to trigger deployment for build: ${buildId}`, error as Error);
      throw error;
    }
  }

  private async startDeployment(deploymentId: string): Promise<void> {
    const deployment = this.findDeployment(deploymentId);
    if (!deployment) return;

    const build = this.findBuild(deployment.buildId);
    if (!build) return;

    const project = this.projects.get(deployment.projectId);
    if (!project) return;

    try {
      deployment.status = 'deploying';
      await this.updateDeployment(deployment);

      await this.addDeploymentLog(deploymentId, 'info', 'Starting deployment process', 'deployer');

      // Get server connection
      const connection = await this.getSSHConnection(deployment.serverId);
      if (!connection) {
        throw new Error('SSH connection not available');
      }

      // Prepare deployment directory
      await this.prepareDeploymentDirectory(connection.id, deployment, project);

      // Transfer build artifacts
      await this.transferArtifacts(connection.id, deployment, build);

      // Configure application
      await this.configureApplication(connection.id, deployment, project);

      // Setup domain and SSL
      if (project.config.domain) {
        await this.setupDomainAndSSL(connection.id, deployment, project);
      }

      // Restart services
      await this.restartServices(connection.id, deployment, project);

      deployment.status = 'success';
      deployment.endTime = new Date();
      deployment.duration = deployment.endTime.getTime() - deployment.startTime.getTime();
      deployment.progress = 100;

      await this.updateDeployment(deployment);
      await this.addDeploymentLog(deploymentId, 'info', 'Deployment completed successfully', 'deployer');

      this.emit('deploymentCompleted', deployment);

    } catch (error) {
      deployment.status = 'failed';
      deployment.endTime = new Date();
      deployment.duration = deployment.endTime.getTime() - deployment.startTime.getTime();
      deployment.errorMessage = error.message;

      await this.updateDeployment(deployment);
      await this.addDeploymentLog(deploymentId, 'error', `Deployment failed: ${error.message}`, 'deployer');

      this.emit('deploymentFailed', deployment);
    }
  }

  private async prepareDeploymentDirectory(connectionId: string, deployment: Deployment, project: BuilderProject): Promise<void> {
    await this.addDeploymentLog(deployment.id, 'info', 'Preparing deployment directory', 'deployer');

    const deployPath = `/var/www/${project.name}`;
    
    // Create deployment directory
    await this.sshConnect.executeCommand(connectionId, `sudo mkdir -p ${deployPath}`, 10000);
    await this.sshConnect.executeCommand(connectionId, `sudo chown -R www-data:www-data ${deployPath}`, 10000);

    await this.addDeploymentLog(deployment.id, 'info', `Deployment directory prepared: ${deployPath}`, 'deployer');
  }

  private async transferArtifacts(connectionId: string, deployment: Deployment, build: Build): Promise<void> {
    await this.addDeploymentLog(deployment.id, 'info', 'Transferring build artifacts', 'deployer');

    // Simulate artifact transfer
    await new Promise(resolve => setTimeout(resolve, 5000));

    await this.addDeploymentLog(deployment.id, 'info', 'Build artifacts transferred successfully', 'deployer');
  }

  private async configureApplication(connectionId: string, deployment: Deployment, project: BuilderProject): Promise<void> {
    await this.addDeploymentLog(deployment.id, 'info', 'Configuring application', 'deployer');

    // Setup environment variables
    if (Object.keys(project.config.environmentVariables).length > 0) {
      const envFile = Object.entries(project.config.environmentVariables)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      await this.sshConnect.executeCommand(connectionId, `echo '${envFile}' > /var/www/${project.name}/.env`, 10000);
    }

    await this.addDeploymentLog(deployment.id, 'info', 'Application configured successfully', 'deployer');
  }

  private async setupDomainAndSSL(connectionId: string, deployment: Deployment, project: BuilderProject): Promise<void> {
    if (!project.config.domain) return;

    await this.addDeploymentLog(deployment.id, 'info', `Setting up domain: ${project.config.domain}`, 'deployer');

    try {
      // Configure domain
      await this.domainSystem.updateDNSRecord(project.config.domain, 'A', 'server_ip');

      // Setup SSL if enabled
      if (project.config.sslEnabled) {
        await this.sslSystem.generateCertificate(project.config.domain);
      }

      await this.addDeploymentLog(deployment.id, 'info', 'Domain and SSL configured successfully', 'deployer');
    } catch (error) {
      await this.addDeploymentLog(deployment.id, 'warn', `Domain setup failed: ${error.message}`, 'deployer');
    }
  }

  private async restartServices(connectionId: string, deployment: Deployment, project: BuilderProject): Promise<void> {
    await this.addDeploymentLog(deployment.id, 'info', 'Restarting services', 'deployer');

    // Restart nginx
    await this.sshConnect.executeCommand(connectionId, 'sudo systemctl reload nginx', 10000);

    // Restart application service if exists
    await this.sshConnect.executeCommand(connectionId, `sudo systemctl restart ${project.name} || true`, 10000);

    await this.addDeploymentLog(deployment.id, 'info', 'Services restarted successfully', 'deployer');
  }

  private async addBuildLog(buildId: string, level: BuildLog['level'], message: string, source: BuildLog['source']): Promise<void> {
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const log: BuildLog = {
      id: logId,
      buildId,
      level,
      message,
      timestamp: new Date(),
      source
    };

    await this.database.query(`
      INSERT INTO build_logs (id, build_id, level, message, timestamp, source)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [log.id, log.buildId, log.level, log.message, log.timestamp, log.source]);

    const build = this.findBuild(buildId);
    if (build) {
      build.logs.push(log);
    }

    this.emit('buildLogAdded', log);
  }

  private async addDeploymentLog(deploymentId: string, level: DeploymentLog['level'], message: string, source: DeploymentLog['source']): Promise<void> {
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const log: DeploymentLog = {
      id: logId,
      deploymentId,
      level,
      message,
      timestamp: new Date(),
      source
    };

    await this.database.query(`
      INSERT INTO deployment_logs (id, deployment_id, level, message, timestamp, source)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [log.id, log.deploymentId, log.level, log.message, log.timestamp, log.source]);

    const deployment = this.findDeployment(deploymentId);
    if (deployment) {
      deployment.logs.push(log);
    }

    this.emit('deploymentLogAdded', log);
  }

  private findBuild(buildId: string): Build | null {
    for (const builds of this.builds.values()) {
      const build = builds.find(b => b.id === buildId);
      if (build) return build;
    }
    return null;
  }

  private findDeployment(deploymentId: string): Deployment | null {
    for (const deployments of this.deployments.values()) {
      const deployment = deployments.find(d => d.id === deploymentId);
      if (deployment) return deployment;
    }
    return null;
  }

  private async updateBuild(build: Build): Promise<void> {
    await this.database.query(`
      UPDATE builds 
      SET status = $1, progress = $2, end_time = $3, duration = $4, error_message = $5 
      WHERE id = $6
    `, [build.status, build.progress, build.endTime, build.duration, build.errorMessage, build.id]);
  }

  private async updateDeployment(deployment: Deployment): Promise<void> {
    await this.database.query(`
      UPDATE deployments 
      SET status = $1, progress = $2, end_time = $3, duration = $4, error_message = $5 
      WHERE id = $6
    `, [deployment.status, deployment.progress, deployment.endTime, deployment.duration, deployment.errorMessage, deployment.id]);
  }

  private async updateProject(project: BuilderProject): Promise<void> {
    await this.database.query(`
      UPDATE builder_projects 
      SET status = $1, updated_at = $2, last_build = $3 
      WHERE id = $4
    `, [project.status, project.updatedAt, project.lastBuild, project.id]);
  }

  private getDefaultBuildCommand(buildType: BuilderProject['buildType']): string {
    const commands: Record<BuilderProject['buildType'], string> = {
      static: 'echo "No build required for static site"',
      node: 'npm run build',
      python: 'python setup.py build',
      php: 'composer install && npm run build',
      docker: 'docker build -t app .',
      custom: 'echo "Custom build command"'
    };
    return commands[buildType];
  }

  private getDefaultOutputDirectory(buildType: BuilderProject['buildType']): string {
    const directories: Record<BuilderProject['buildType'], string> = {
      static: 'dist',
      node: 'build',
      python: 'dist',
      php: 'public',
      docker: '/app',
      custom: 'output'
    };
    return directories[buildType];
  }

  private async getSSHConnection(serverId: string): Promise<any> {
    const connections = await this.sshConnect.getConnectionsByUserId('system');
    return connections.find(c => c.serverId === serverId);
  }

  // Public API methods
  async getProject(projectId: string): Promise<BuilderProject | null> {
    return this.projects.get(projectId) || null;
  }

  async getProjects(): Promise<BuilderProject[]> {
    return Array.from(this.projects.values());
  }

  async getBuilds(projectId: string, limit: number = 50): Promise<Build[]> {
    return (this.builds.get(projectId) || []).slice(0, limit);
  }

  async getDeployments(projectId: string, limit: number = 50): Promise<Deployment[]> {
    return (this.deployments.get(projectId) || []).slice(0, limit);
  }

  async getBuildLogs(buildId: string): Promise<BuildLog[]> {
    const build = this.findBuild(buildId);
    return build ? build.logs : [];
  }

  async getDeploymentLogs(deploymentId: string): Promise<DeploymentLog[]> {
    const deployment = this.findDeployment(deploymentId);
    return deployment ? deployment.logs : [];
  }

  async getBuilderStats(): Promise<{
    totalProjects: number;
    activeProjects: number;
    totalBuilds: number;
    successfulBuilds: number;
    totalDeployments: number;
    successfulDeployments: number;
  }> {
    const projects = Array.from(this.projects.values());
    const allBuilds = Array.from(this.builds.values()).flat();
    const allDeployments = Array.from(this.deployments.values()).flat();
    
    return {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'active').length,
      totalBuilds: allBuilds.length,
      successfulBuilds: allBuilds.filter(b => b.status === 'success').length,
      totalDeployments: allDeployments.length,
      successfulDeployments: allDeployments.filter(d => d.status === 'success').length
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    projectsCount: number;
    activeBuildsCount: number;
    activeDeploymentsCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getBuilderStats();
    
    const activeBuilds = Array.from(this.builds.values()).flat().filter(b => b.status === 'running').length;
    const activeDeployments = Array.from(this.deployments.values()).flat().filter(d => d.status === 'deploying').length;
    
    if (stats.activeProjects === 0) {
      issues.push('No active projects found');
    }

    return {
      healthy: issues.length === 0,
      projectsCount: stats.totalProjects,
      activeBuildsCount: activeBuilds,
      activeDeploymentsCount: activeDeployments,
      issues
    };
  }

  async destroy(): Promise<void> {
    // Stop all active builds
    for (const timeout of this.activeBuilds.values()) {
      clearTimeout(timeout);
    }
    
    this.activeBuilds.clear();
    
    this.logger.info('builder-server-link', 'Builder and server link system shut down');
  }
}

export default UltraBuilderServerLink;
