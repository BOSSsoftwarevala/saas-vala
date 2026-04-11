import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { UltraHealthMonitor, HealthCheck } from './health-monitor';

const execAsync = promisify(exec);

export interface HealingAction {
  name: string;
  condition: (health: HealthCheck) => boolean;
  action: () => Promise<boolean>;
  priority: number;
  maxRetries: number;
  retryDelay: number;
}

export interface HealingRecord {
  timestamp: Date;
  serviceName: string;
  issue: string;
  action: string;
  success: boolean;
  retryCount: number;
  duration: number;
}

export class UltraAutoHealer {
  private static instance: UltraAutoHealer;
  private healthMonitor: UltraHealthMonitor;
  private healingActions: Map<string, HealingAction[]> = new Map();
  private healingHistory: HealingRecord[] = [];
  private isHealing = false;
  private healingLocks: Set<string> = new Set();

  static getInstance(): UltraAutoHealer {
    if (!UltraAutoHealer.instance) {
      UltraAutoHealer.instance = new UltraAutoHealer();
    }
    return UltraAutoHealer.instance;
  }

  constructor() {
    this.healthMonitor = UltraHealthMonitor.getInstance();
    this.setupHealingActions();
    this.setupHealthAlerts();
  }

  private setupHealingActions(): void {
    // Nginx healing actions
    this.addHealingAction('nginx', {
      name: 'restart_nginx',
      condition: (health) => health.status === 'unhealthy',
      action: async () => {
        console.log('🔧 Attempting to restart nginx...');
        try {
          await execAsync('systemctl restart nginx');
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for restart
          
          // Verify nginx is running
          const { stdout } = await execAsync('systemctl is-active nginx');
          return stdout.trim() === 'active';
        } catch (error) {
          console.error('Failed to restart nginx:', error.message);
          return false;
        }
      },
      priority: 1,
      maxRetries: 3,
      retryDelay: 5000
    });

    this.addHealingAction('nginx', {
      name: 'reload_nginx_config',
      condition: (health) => health.status === 'unhealthy' && health.error?.includes('configuration'),
      action: async () => {
        console.log('🔧 Attempting to reload nginx configuration...');
        try {
          // Test configuration first
          await execAsync('nginx -t');
          await execAsync('systemctl reload nginx');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Verify nginx is running
          const { stdout } = await execAsync('systemctl is-active nginx');
          return stdout.trim() === 'active';
        } catch (error) {
          console.error('Failed to reload nginx config:', error.message);
          return false;
        }
      },
      priority: 2,
      maxRetries: 2,
      retryDelay: 3000
    });

    this.addHealingAction('nginx', {
      name: 'restore_nginx_backup',
      condition: (health) => health.status === 'unhealthy' && health.error?.includes('configuration'),
      action: async () => {
        console.log('🔧 Attempting to restore nginx backup configuration...');
        try {
          const backupPath = '/etc/nginx/sites-available/saasvala.conf.backup';
          const configPath = '/etc/nginx/sites-available/saasvala.conf';
          
          if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, configPath);
            await execAsync('systemctl reload nginx');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify nginx is running
            const { stdout } = await execAsync('systemctl is-active nginx');
            return stdout.trim() === 'active';
          } else {
            console.log('No nginx backup found');
            return false;
          }
        } catch (error) {
          console.error('Failed to restore nginx backup:', error.message);
          return false;
        }
      },
      priority: 3,
      maxRetries: 1,
      retryDelay: 1000
    });

    // Backend healing actions
    this.addHealingAction('backend', {
      name: 'restart_backend',
      condition: (health) => health.status === 'unhealthy',
      action: async () => {
        console.log('🔧 Attempting to restart backend...');
        try {
          // Kill any existing processes
          await execAsync('pkill -f "vite\\|npm.*dev" || true');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Start backend
          await execAsync('cd /var/www/saasvala-site && npm run dev > /dev/null 2>&1 &');
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for startup
          
          // Verify backend is responding
          const { stdout } = await execAsync('curl -f -s -o /dev/null -w "%{http_code}" http://localhost:5173');
          return stdout.trim() === '200';
        } catch (error) {
          console.error('Failed to restart backend:', error.message);
          return false;
        }
      },
      priority: 1,
      maxRetries: 3,
      retryDelay: 10000
    });

    this.addHealingAction('backend', {
      name: 'rebuild_backend',
      condition: (health) => health.status === 'unhealthy',
      action: async () => {
        console.log('🔧 Attempting to rebuild backend...');
        try {
          await execAsync('cd /var/www/saasvala-site && npm run build');
          await execAsync('pkill -f "vite\\|npm.*dev" || true');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          await execAsync('cd /var/www/saasvala-site && npm run dev > /dev/null 2>&1 &');
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Verify backend is responding
          const { stdout } = await execAsync('curl -f -s -o /dev/null -w "%{http_code}" http://localhost:5173');
          return stdout.trim() === '200';
        } catch (error) {
          console.error('Failed to rebuild backend:', error.message);
          return false;
        }
      },
      priority: 2,
      maxRetries: 2,
      retryDelay: 30000
    });

    // Database healing actions
    this.addHealingAction('database', {
      name: 'restart_database',
      condition: (health) => health.status === 'unhealthy',
      action: async () => {
        console.log('🔧 Attempting to restart database...');
        try {
          await execAsync('systemctl restart postgresql');
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for PostgreSQL startup
          
          // Verify database is ready
          const { stdout } = await execAsync('pg_isready -h localhost -p 5432');
          return stdout.includes('accepting connections');
        } catch (error) {
          console.error('Failed to restart database:', error.message);
          return false;
        }
      },
      priority: 1,
      maxRetries: 2,
      retryDelay: 15000
    });

    this.addHealingAction('database', {
      name: 'check_disk_space',
      condition: (health) => health.status === 'unhealthy',
      action: async () => {
        console.log('🔧 Checking disk space for database...');
        try {
          const { stdout } = await execAsync('df -h /');
          const lines = stdout.split('\n');
          const data = lines[1].split(/\s+/);
          const usedPercent = parseInt(data[4]);
          
          if (usedPercent > 90) {
            // Clean up temporary files and logs
            await execAsync('find /tmp -type f -mtime +1 -delete');
            await execAsync('find /var/log -name "*.log.*" -mtime +7 -delete');
            await execAsync('postgresql-check-db --vacuum --analyze saasvala');
            
            console.log('Cleaned up disk space for database');
            return true;
          }
          
          return true;
        } catch (error) {
          console.error('Failed to check disk space:', error.message);
          return false;
        }
      },
      priority: 2,
      maxRetries: 1,
      retryDelay: 5000
    });

    // Redis healing actions
    this.addHealingAction('redis', {
      name: 'restart_redis',
      condition: (health) => health.status === 'unhealthy',
      action: async () => {
        console.log('🔧 Attempting to restart Redis...');
        try {
          await execAsync('systemctl restart redis');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Verify Redis is responding
          const { stdout } = await execAsync('redis-cli ping');
          return stdout.trim() === 'PONG';
        } catch (error) {
          console.error('Failed to restart Redis:', error.message);
          return false;
        }
      },
      priority: 1,
      maxRetries: 2,
      retryDelay: 5000
    });

    // SSL healing actions
    this.addHealingAction('ssl', {
      name: 'renew_ssl_certificate',
      condition: (health) => health.status === 'degraded' || health.status === 'unhealthy',
      action: async () => {
        console.log('🔧 Attempting to renew SSL certificate...');
        try {
          await execAsync('certbot renew --quiet --no-self-upgrade');
          await execAsync('systemctl reload nginx');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Verify certificate is valid
          const { stdout } = await execAsync('openssl x509 -checkend 2592000 -noout -in /etc/letsencrypt/live/saasvala.com/fullchain.pem');
          return stdout.includes('Certificate will not expire');
        } catch (error) {
          console.error('Failed to renew SSL certificate:', error.message);
          return false;
        }
      },
      priority: 1,
      maxRetries: 2,
      retryDelay: 60000
    });

    // Disk healing actions
    this.addHealingAction('disk', {
      name: 'cleanup_disk_space',
      condition: (health) => health.status === 'degraded' || health.status === 'unhealthy',
      action: async () => {
        console.log('🔧 Attempting to clean up disk space...');
        try {
          // Clean up various temporary and old files
          await execAsync('find /tmp -type f -mtime +1 -delete');
          await execAsync('find /var/tmp -type f -mtime +7 -delete');
          await execAsync('find /var/log -name "*.log.*" -mtime +7 -delete');
          await execAsync('apt-get clean');
          await execAsync('npm cache clean --force');
          
          // Clean up old backups (keep last 5)
          await execAsync('ls -t /var/backups/saasvala-*.sql | tail -n +6 | xargs -r rm');
          
          console.log('Disk space cleanup completed');
          return true;
        } catch (error) {
          console.error('Failed to clean up disk space:', error.message);
          return false;
        }
      },
      priority: 1,
      maxRetries: 1,
      retryDelay: 5000
    });
  }

  private setupHealthAlerts(): void {
    this.healthMonitor.onAlert(async (systemHealth) => {
      if (!this.isHealing) {
        await this.healSystem(systemHealth);
      }
    });
  }

  private async healSystem(systemHealth: any): Promise<void> {
    if (this.isHealing) {
      console.log('🔄 Healing already in progress, skipping...');
      return;
    }

    this.isHealing = true;
    console.log('🚨 Starting auto-healing process...');

    try {
      const unhealthyServices = systemHealth.services.filter((s: HealthCheck) => s.status !== 'healthy');
      
      for (const service of unhealthyServices) {
        await this.healService(service);
      }
    } catch (error) {
      console.error('Error during healing process:', error);
    } finally {
      this.isHealing = false;
      console.log('✅ Auto-healing process completed');
    }
  }

  private async healService(serviceHealth: HealthCheck): Promise<void> {
    const serviceName = serviceHealth.name;
    
    // Prevent concurrent healing of the same service
    if (this.healingLocks.has(serviceName)) {
      console.log(`🔄 Service ${serviceName} is already being healed`);
      return;
    }

    this.healingLocks.add(serviceName);
    
    try {
      console.log(`🔧 Healing service: ${serviceName} - ${serviceHealth.error || serviceHealth.status}`);
      
      const actions = this.healingActions.get(serviceName) || [];
      const sortedActions = actions.sort((a, b) => a.priority - b.priority);
      
      for (const action of sortedActions) {
        if (action.condition(serviceHealth)) {
          const success = await this.executeHealingAction(serviceName, action);
          if (success) {
            break; // Stop on first successful action
          }
        }
      }
    } finally {
      this.healingLocks.delete(serviceName);
    }
  }

  private async executeHealingAction(serviceName: string, action: HealingAction): Promise<boolean> {
    const startTime = Date.now();
    let retryCount = 0;
    
    while (retryCount <= action.maxRetries) {
      try {
        console.log(`🔧 Executing ${action.name} for ${serviceName} (attempt ${retryCount + 1}/${action.maxRetries + 1})`);
        
        const success = await action.action();
        const duration = Date.now() - startTime;
        
        // Record healing attempt
        this.recordHealing({
          timestamp: new Date(),
          serviceName,
          issue: action.name,
          action: action.name,
          success,
          retryCount,
          duration
        });
        
        if (success) {
          console.log(`✅ Successfully healed ${serviceName} with ${action.name}`);
          
          // Force health check to verify
          await this.healthMonitor.forceHealthCheck(serviceName);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for verification
          
          return true;
        } else {
          console.log(`❌ Failed to heal ${serviceName} with ${action.name}`);
        }
      } catch (error) {
        console.error(`Error executing ${action.name} for ${serviceName}:`, error.message);
      }
      
      retryCount++;
      if (retryCount <= action.maxRetries) {
        console.log(`⏳ Waiting ${action.retryDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, action.retryDelay));
      }
    }
    
    console.log(`💀 All healing attempts failed for ${serviceName}`);
    return false;
  }

  private recordHealing(record: HealingRecord): void {
    this.healingHistory.push(record);
    
    // Keep only last 1000 records
    if (this.healingHistory.length > 1000) {
      this.healingHistory = this.healingHistory.slice(-1000);
    }
    
    // Log to file
    const logFile = '/var/log/saasvala-healing.log';
    const logEntry = `${record.timestamp.toISOString()} [${record.serviceName}] ${record.action}: ${record.success ? 'SUCCESS' : 'FAILED'} (${record.duration}ms, retry ${record.retryCount})\n`;
    
    try {
      fs.appendFileSync(logFile, logEntry);
    } catch (error) {
      console.error('Failed to write healing log:', error);
    }
  }

  addHealingAction(serviceName: string, action: HealingAction): void {
    if (!this.healingActions.has(serviceName)) {
      this.healingActions.set(serviceName, []);
    }
    this.healingActions.get(serviceName)!.push(action);
  }

  getHealingHistory(limit?: number): HealingRecord[] {
    if (limit) {
      return this.healingHistory.slice(-limit);
    }
    return [...this.healingHistory];
  }

  getHealingStats(): {
    totalAttempts: number;
    successfulHealings: number;
    failedHealings: number;
    averageDuration: number;
    mostHealedServices: Array<{ service: string; count: number }>;
  } {
    const totalAttempts = this.healingHistory.length;
    const successfulHealings = this.healingHistory.filter(r => r.success).length;
    const failedHealings = totalAttempts - successfulHealings;
    
    const averageDuration = totalAttempts > 0 
      ? this.healingHistory.reduce((sum, r) => sum + r.duration, 0) / totalAttempts 
      : 0;
    
    const serviceCounts = this.healingHistory.reduce((acc, record) => {
      acc[record.serviceName] = (acc[record.serviceName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostHealedServices = Object.entries(serviceCounts)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalAttempts,
      successfulHealings,
      failedHealings,
      averageDuration,
      mostHealedServices
    };
  }

  async forceHealService(serviceName: string): Promise<boolean> {
    const health = await this.healthMonitor.getServiceHealth(serviceName);
    if (!health) {
      console.log(`Service ${serviceName} not found`);
      return false;
    }
    
    await this.healService(health);
    
    // Check if healing was successful
    const updatedHealth = await this.healthMonitor.getServiceHealth(serviceName);
    return updatedHealth?.status === 'healthy' || false;
  }

  isCurrentlyHealing(): boolean {
    return this.isHealing;
  }

  getHealingLocks(): string[] {
    return Array.from(this.healingLocks);
  }
}

export default UltraAutoHealer;
