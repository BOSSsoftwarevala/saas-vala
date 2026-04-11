import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { UltraLogger } from './logger';
import { UltraHealthMonitor } from './health-monitor';
import { UltraDatabase } from './database';

const execAsync = promisify(exec);

export interface DeploymentConfig {
  projectPath: string;
  backupPath: string;
  maxRollbacks: number;
  healthCheckTimeout: number;
  deploymentTimeout: number;
  zeroDowntime: boolean;
}

export interface DeploymentStep {
  name: string;
  action: () => Promise<boolean>;
  rollback?: () => Promise<boolean>;
  critical: boolean;
  timeout: number;
}

export interface Deployment {
  id: string;
  version: string;
  status: 'pending' | 'deploying' | 'success' | 'failed' | 'rolling_back';
  startTime: Date;
  endTime?: Date;
  steps: DeploymentStep[];
  currentStep: number;
  logs: string[];
  rollbackData?: any;
}

export class UltraDeployment {
  private static instance: UltraDeployment;
  private config: DeploymentConfig;
  private logger: UltraLogger;
  private healthMonitor: UltraHealthMonitor;
  private database: UltraDatabase;
  private deployments: Map<string, Deployment> = new Map();
  private currentDeployment?: Deployment;

  static getInstance(config?: DeploymentConfig): UltraDeployment {
    if (!UltraDeployment.instance) {
      UltraDeployment.instance = new UltraDeployment(config);
    }
    return UltraDeployment.instance;
  }

  constructor(config?: DeploymentConfig) {
    this.logger = UltraLogger.getInstance();
    this.healthMonitor = UltraHealthMonitor.getInstance();
    this.database = UltraDatabase.getInstance();
    
    this.config = {
      projectPath: process.env.PROJECT_PATH || '/var/www/saasvala-site',
      backupPath: process.env.BACKUP_PATH || '/var/backups/saasvala',
      maxRollbacks: parseInt(process.env.MAX_ROLLBACKS || '5'),
      healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '30000'),
      deploymentTimeout: parseInt(process.env.DEPLOYMENT_TIMEOUT || '300000'),
      zeroDowntime: process.env.ZERO_DOWNTIME !== 'false',
      ...config
    };

    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [this.config.backupPath, path.join(this.config.backupPath, 'rollbacks')];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async deploy(version: string, force: boolean = false): Promise<string> {
    if (this.currentDeployment && !force) {
      throw new Error('Deployment already in progress');
    }

    const deploymentId = `deploy-${Date.now()}`;
    const deployment: Deployment = {
      id: deploymentId,
      version,
      status: 'pending',
      startTime: new Date(),
      steps: this.createDeploymentSteps(version),
      currentStep: 0,
      logs: []
    };

    this.deployments.set(deploymentId, deployment);
    this.currentDeployment = deployment;

    this.logger.info('deployment', `Starting deployment ${deploymentId} for version ${version}`);

    try {
      await this.executeDeployment(deployment);
      return deploymentId;
    } catch (error) {
      this.logger.error('deployment', `Deployment ${deploymentId} failed`, error as Error);
      if (deployment.rollbackData) {
        await this.rollback(deploymentId);
      }
      throw error;
    }
  }

  private createDeploymentSteps(version: string): DeploymentStep[] {
    return [
      {
        name: 'pre_deployment_health_check',
        action: async () => await this.preDeploymentHealthCheck(),
        critical: true,
        timeout: this.config.healthCheckTimeout
      },
      {
        name: 'create_backup',
        action: async () => await this.createBackup(),
        critical: true,
        timeout: 60000
      },
      {
        name: 'pull_latest_code',
        action: async () => await this.pullLatestCode(),
        critical: true,
        timeout: 120000
      },
      {
        name: 'install_dependencies',
        action: async () => await this.installDependencies(),
        critical: true,
        timeout: 300000
      },
      {
        name: 'build_application',
        action: async () => await this.buildApplication(),
        critical: true,
        timeout: 300000
      },
      {
        name: 'run_tests',
        action: async () => await this.runTests(),
        critical: false,
        timeout: 180000
      },
      {
        name: 'database_migrations',
        action: async () => await this.runDatabaseMigrations(),
        rollback: async () => await this.rollbackDatabaseMigrations(),
        critical: true,
        timeout: 120000
      },
      {
        name: 'update_static_files',
        action: async () => await this.updateStaticFiles(),
        critical: true,
        timeout: 60000
      },
      {
        name: 'restart_services',
        action: async () => await this.restartServices(),
        critical: true,
        timeout: 120000
      },
      {
        name: 'post_deployment_health_check',
        action: async () => await this.postDeploymentHealthCheck(),
        critical: true,
        timeout: this.config.healthCheckTimeout
      }
    ];
  }

  private async executeDeployment(deployment: Deployment): Promise<void> {
    deployment.status = 'deploying';

    for (let i = 0; i < deployment.steps.length; i++) {
      const step = deployment.steps[i];
      deployment.currentStep = i;

      this.logger.info('deployment', `Executing step: ${step.name}`);
      deployment.logs.push(`[${new Date().toISOString()}] Starting step: ${step.name}`);

      try {
        const success = await this.executeStep(step, deployment);
        if (!success) {
          throw new Error(`Step ${step.name} failed`);
        }
        deployment.logs.push(`[${new Date().toISOString()}] Completed step: ${step.name}`);
      } catch (error) {
        deployment.logs.push(`[${new Date().toISOString()}] Failed step: ${step.name} - ${error.message}`);
        
        if (step.critical) {
          throw error;
        } else {
          this.logger.warn('deployment', `Non-critical step failed: ${step.name}`, error as Error);
        }
      }
    }

    deployment.status = 'success';
    deployment.endTime = new Date();
    deployment.logs.push(`[${new Date().toISOString()}] Deployment completed successfully`);

    this.logger.info('deployment', `Deployment ${deployment.id} completed successfully`);
    this.currentDeployment = undefined;
  }

  private async executeStep(step: DeploymentStep, deployment: Deployment): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Step ${step.name} timed out after ${step.timeout}ms`));
      }, step.timeout);

      step.action()
        .then((success) => {
          clearTimeout(timeout);
          if (success) {
            resolve(true);
          } else {
            reject(new Error(`Step ${step.name} returned false`));
          }
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private async preDeploymentHealthCheck(): Promise<boolean> {
    const health = await this.healthMonitor.getSystemHealth();
    
    if (health.overall !== 'healthy') {
      throw new Error(`System not healthy: ${health.overall}`);
    }

    // Check if critical services are running
    const criticalServices = ['nginx', 'backend', 'database'];
    for (const serviceName of criticalServices) {
      const service = health.services.find(s => s.name === serviceName);
      if (!service || service.status !== 'healthy') {
        throw new Error(`Critical service ${serviceName} not healthy`);
      }
    }

    return true;
  }

  private async createBackup(): Promise<boolean> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.config.backupPath, `backup-${timestamp}`);
    
    try {
      // Create backup directory
      fs.mkdirSync(backupDir, { recursive: true });

      // Backup application files
      await execAsync(`cp -r ${this.config.projectPath} ${backupDir}/app`);
      
      // Backup database
      const dbBackupFile = path.join(backupDir, 'database.sql');
      await execAsync(`PGPASSWORD="${process.env.DB_PASSWORD}" pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} > ${dbBackupFile}`);

      // Store backup info for rollback
      if (this.currentDeployment) {
        this.currentDeployment.rollbackData = {
          backupDir,
          timestamp,
          dbBackupFile
        };
      }

      this.logger.info('deployment', `Backup created at ${backupDir}`);
      return true;
    } catch (error) {
      this.logger.error('deployment', 'Backup creation failed', error as Error);
      throw error;
    }
  }

  private async pullLatestCode(): Promise<boolean> {
    try {
      await execAsync(`cd ${this.config.projectPath} && git fetch origin`);
      await execAsync(`cd ${this.config.projectPath} && git reset --hard origin/main`);
      
      this.logger.info('deployment', 'Latest code pulled successfully');
      return true;
    } catch (error) {
      this.logger.error('deployment', 'Failed to pull latest code', error as Error);
      throw error;
    }
  }

  private async installDependencies(): Promise<boolean> {
    try {
      await execAsync(`cd ${this.config.projectPath} && npm ci --production`);
      
      this.logger.info('deployment', 'Dependencies installed successfully');
      return true;
    } catch (error) {
      this.logger.error('deployment', 'Failed to install dependencies', error as Error);
      throw error;
    }
  }

  private async buildApplication(): Promise<boolean> {
    try {
      await execAsync(`cd ${this.config.projectPath} && npm run build`);
      
      this.logger.info('deployment', 'Application built successfully');
      return true;
    } catch (error) {
      this.logger.error('deployment', 'Failed to build application', error as Error);
      throw error;
    }
  }

  private async runTests(): Promise<boolean> {
    try {
      await execAsync(`cd ${this.config.projectPath} && npm test -- --run --reporter=verbose`);
      
      this.logger.info('deployment', 'Tests passed successfully');
      return true;
    } catch (error) {
      this.logger.error('deployment', 'Tests failed', error as Error);
      // Don't throw error for tests as they're non-critical
      return false;
    }
  }

  private async runDatabaseMigrations(): Promise<boolean> {
    try {
      // Check for migration files
      const migrationDir = path.join(this.config.projectPath, 'supabase/migrations');
      if (!fs.existsSync(migrationDir)) {
        this.logger.info('deployment', 'No migration directory found, skipping migrations');
        return true;
      }

      // Run migrations using Supabase CLI
      await execAsync(`cd ${this.config.projectPath} && npx supabase db push`);
      
      this.logger.info('deployment', 'Database migrations completed successfully');
      return true;
    } catch (error) {
      this.logger.error('deployment', 'Database migrations failed', error as Error);
      throw error;
    }
  }

  private async rollbackDatabaseMigrations(): Promise<boolean> {
    try {
      // Rollback migrations using Supabase CLI
      await execAsync(`cd ${this.config.projectPath} && npx supabase db reset`);
      
      this.logger.info('deployment', 'Database migrations rolled back successfully');
      return true;
    } catch (error) {
      this.logger.error('deployment', 'Failed to rollback database migrations', error as Error);
      return false;
    }
  }

  private async updateStaticFiles(): Promise<boolean> {
    try {
      // Copy built files to web root
      const buildDir = path.join(this.config.projectPath, 'dist');
      const webRoot = '/var/www/saasvala-site';
      
      if (fs.existsSync(buildDir)) {
        await execAsync(`cp -r ${buildDir}/* ${webRoot}/`);
      }

      this.logger.info('deployment', 'Static files updated successfully');
      return true;
    } catch (error) {
      this.logger.error('deployment', 'Failed to update static files', error as Error);
      throw error;
    }
  }

  private async restartServices(): Promise<boolean> {
    try {
      if (this.config.zeroDowntime) {
        // Zero-downtime restart
        await execAsync('systemctl reload nginx');
        await execAsync('pkill -USR1 node'); // Graceful restart for Node.js
      } else {
        // Standard restart
        await execAsync('systemctl restart nginx');
        await execAsync('systemctl restart saasvala-backend');
      }

      // Wait for services to start
      await new Promise(resolve => setTimeout(resolve, 5000));

      this.logger.info('deployment', 'Services restarted successfully');
      return true;
    } catch (error) {
      this.logger.error('deployment', 'Failed to restart services', error as Error);
      throw error;
    }
  }

  private async postDeploymentHealthCheck(): Promise<boolean> {
    // Wait a bit for services to fully start
    await new Promise(resolve => setTimeout(resolve, 10000));

    const health = await this.healthMonitor.getSystemHealth();
    
    if (health.overall !== 'healthy') {
      throw new Error(`System not healthy after deployment: ${health.overall}`);
    }

    // Additional checks
    try {
      // Test main endpoint
      await execAsync('curl -f -s -o /dev/null -w "%{http_code}" https://saasvala.com');
      
      // Test API endpoint
      await execAsync('curl -f -s -o /dev/null -w "%{http_code}" https://saasvala.com/api/health');
      
      this.logger.info('deployment', 'Post-deployment health checks passed');
      return true;
    } catch (error) {
      throw new Error('Post-deployment health checks failed');
    }
  }

  async rollback(deploymentId: string): Promise<boolean> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    if (!deployment.rollbackData) {
      throw new Error(`No rollback data available for deployment ${deploymentId}`);
    }

    this.logger.info('deployment', `Starting rollback for deployment ${deploymentId}`);
    deployment.status = 'rolling_back';

    try {
      // Restore application files
      const backupAppDir = path.join(deployment.rollbackData.backupDir, 'app');
      await execAsync(`rm -rf ${this.config.projectPath}/*`);
      await execAsync(`cp -r ${backupAppDir}/* ${this.config.projectPath}/`);

      // Restore database
      if (deployment.rollbackData.dbBackupFile) {
        await execAsync(`PGPASSWORD="${process.env.DB_PASSWORD}" psql -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} < ${deployment.rollbackData.dbBackupFile}`);
      }

      // Restart services
      await this.restartServices();

      // Verify rollback
      await this.postDeploymentHealthCheck();

      deployment.status = 'failed'; // Mark as failed since rollback occurred
      deployment.endTime = new Date();
      deployment.logs.push(`[${new Date().toISOString()}] Rollback completed successfully`);

      this.logger.info('deployment', `Rollback completed for deployment ${deploymentId}`);
      return true;
    } catch (error) {
      this.logger.error('deployment', `Rollback failed for deployment ${deploymentId}`, error as Error);
      deployment.logs.push(`[${new Date().toISOString()}] Rollback failed: ${error.message}`);
      throw error;
    }
  }

  getDeployment(deploymentId: string): Deployment | undefined {
    return this.deployments.get(deploymentId);
  }

  getDeployments(limit?: number): Deployment[] {
    const deployments = Array.from(this.deployments.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    
    return limit ? deployments.slice(0, limit) : deployments;
  }

  getCurrentDeployment(): Deployment | undefined {
    return this.currentDeployment;
  }

  async cleanupOldDeployments(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    // Clean up deployment records
    for (const [id, deployment] of this.deployments.entries()) {
      if (deployment.startTime < cutoffDate) {
        this.deployments.delete(id);
      }
    }

    // Clean up backup directories
    try {
      const { stdout } = await execAsync(`find ${this.config.backupPath} -maxdepth 1 -type d -name "backup-*" -mtime +${daysToKeep}`);
      const backupDirs = stdout.trim().split('\n').filter(dir => dir);
      
      for (const dir of backupDirs) {
        await execAsync(`rm -rf ${dir}`);
      }
      
      this.logger.info('deployment', `Cleaned up ${backupDirs.length} old backup directories`);
    } catch (error) {
      this.logger.error('deployment', 'Failed to cleanup old deployments', error as Error);
    }
  }

  getDeploymentStats(): {
    totalDeployments: number;
    successfulDeployments: number;
    failedDeployments: number;
    averageDeploymentTime: number;
    currentDeployment?: string;
  } {
    const deployments = Array.from(this.deployments.values());
    const totalDeployments = deployments.length;
    const successfulDeployments = deployments.filter(d => d.status === 'success').length;
    const failedDeployments = deployments.filter(d => d.status === 'failed').length;
    
    const completedDeployments = deployments.filter(d => d.endTime);
    const averageDeploymentTime = completedDeployments.length > 0
      ? completedDeployments.reduce((sum, d) => sum + (d.endTime.getTime() - d.startTime.getTime()), 0) / completedDeployments.length
      : 0;

    return {
      totalDeployments,
      successfulDeployments,
      failedDeployments,
      averageDeploymentTime,
      currentDeployment: this.currentDeployment?.id
    };
  }
}

export default UltraDeployment;
