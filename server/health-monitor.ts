import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  responseTime: number;
  error?: string;
  details?: any;
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  services: HealthCheck[];
  lastUpdate: Date;
}

export class UltraHealthMonitor {
  private static instance: UltraHealthMonitor;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private alertCallbacks: Array<(health: SystemHealth) => void> = [];

  static getInstance(): UltraHealthMonitor {
    if (!UltraHealthMonitor.instance) {
      UltraHealthMonitor.instance = new UltraHealthMonitor();
    }
    return UltraHealthMonitor.instance;
  }

  constructor() {
    this.setupHealthChecks();
  }

  async startMonitoring(intervalMs: number = 15000): Promise<void> {
    if (this.isMonitoring) {
      console.log('Health monitoring already running');
      return;
    }

    console.log(`Starting health monitoring with ${intervalMs}ms interval`);
    this.isMonitoring = true;
    
    // Run initial check
    await this.runAllHealthChecks();
    
    // Set up recurring checks
    this.monitoringInterval = setInterval(async () => {
      await this.runAllHealthChecks();
    }, intervalMs);
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;
    
    console.log('Stopping health monitoring');
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  private setupHealthChecks(): void {
    // Nginx health check
    this.addHealthCheck('nginx', async () => {
      const start = Date.now();
      try {
        const { stdout } = await execAsync('systemctl is-active nginx');
        const responseTime = Date.now() - start;
        
        if (stdout.trim() === 'active') {
          // Test nginx response
          await execAsync('curl -f -s -o /dev/null -w "%{http_code}" http://localhost');
          return { status: 'healthy', responseTime };
        } else {
          return { status: 'unhealthy', responseTime, error: 'Nginx not active' };
        }
      } catch (error) {
        return { status: 'unhealthy', responseTime: Date.now() - start, error: error.message };
      }
    });

    // Backend health check
    this.addHealthCheck('backend', async () => {
      const start = Date.now();
      try {
        const { stdout } = await execAsync('curl -f -s -o /dev/null -w "%{http_code}" http://localhost:5173');
        const responseTime = Date.now() - start;
        
        if (stdout.trim() === '200') {
          return { status: 'healthy', responseTime };
        } else {
          return { status: 'unhealthy', responseTime, error: `Backend returned ${stdout}` };
        }
      } catch (error) {
        return { status: 'unhealthy', responseTime: Date.now() - start, error: error.message };
      }
    });

    // Database health check
    this.addHealthCheck('database', async () => {
      const start = Date.now();
      try {
        // Check PostgreSQL
        const { stdout } = await execAsync('pg_isready -h localhost -p 5432');
        const responseTime = Date.now() - start;
        
        if (stdout.includes('accepting connections')) {
          // Test actual connection
          await execAsync('psql -h localhost -U postgres -d saasvala -c "SELECT 1;"');
          return { status: 'healthy', responseTime };
        } else {
          return { status: 'unhealthy', responseTime, error: 'Database not ready' };
        }
      } catch (error) {
        return { status: 'unhealthy', responseTime: Date.now() - start, error: error.message };
      }
    });

    // Redis health check
    this.addHealthCheck('redis', async () => {
      const start = Date.now();
      try {
        const { stdout } = await execAsync('redis-cli ping');
        const responseTime = Date.now() - start;
        
        if (stdout.trim() === 'PONG') {
          return { status: 'healthy', responseTime };
        } else {
          return { status: 'unhealthy', responseTime, error: 'Redis not responding' };
        }
      } catch (error) {
        return { status: 'unhealthy', responseTime: Date.now() - start, error: error.message };
      }
    });

    // SSL certificate check
    this.addHealthCheck('ssl', async () => {
      const start = Date.now();
      try {
        const { stdout } = await execAsync('openssl x509 -checkend 2592000 -noout -in /etc/letsencrypt/live/saasvala.com/fullchain.pem');
        const responseTime = Date.now() - start;
        
        if (stdout.includes('Certificate will not expire')) {
          return { status: 'healthy', responseTime };
        } else {
          return { status: 'degraded', responseTime, error: 'SSL certificate expiring soon' };
        }
      } catch (error) {
        return { status: 'unhealthy', responseTime: Date.now() - start, error: error.message };
      }
    });

    // Disk space check
    this.addHealthCheck('disk', async () => {
      const start = Date.now();
      try {
        const { stdout } = await execAsync('df -h /');
        const responseTime = Date.now() - start;
        
        const lines = stdout.split('\n');
        const data = lines[1].split(/\s+/);
        const usedPercent = parseInt(data[4]);
        
        if (usedPercent < 80) {
          return { status: 'healthy', responseTime, details: { usedPercent } };
        } else if (usedPercent < 90) {
          return { status: 'degraded', responseTime, error: `Disk usage ${usedPercent}%`, details: { usedPercent } };
        } else {
          return { status: 'unhealthy', responseTime, error: `Disk usage critical: ${usedPercent}%`, details: { usedPercent } };
        }
      } catch (error) {
        return { status: 'unhealthy', responseTime: Date.now() - start, error: error.message };
      }
    });
  }

  addHealthCheck(name: string, checkFn: () => Promise<{ status: 'healthy' | 'unhealthy' | 'degraded', responseTime: number, error?: string, details?: any }>): void {
    this.healthChecks.set(name, {
      name,
      status: 'unhealthy',
      lastCheck: new Date(),
      responseTime: 0,
      error: 'Not checked yet'
    });

    // Store the check function
    (this as any)[`${name}CheckFn`] = checkFn;
  }

  private async runAllHealthChecks(): Promise<void> {
    const promises = Array.from(this.healthChecks.keys()).map(async (name) => {
      try {
        const checkFn = (this as any)[`${name}CheckFn`];
        if (checkFn) {
          const result = await checkFn();
          this.healthChecks.set(name, {
            name,
            ...result,
            lastCheck: new Date()
          });
        }
      } catch (error) {
        this.healthChecks.set(name, {
          name,
          status: 'unhealthy',
          lastCheck: new Date(),
          responseTime: 0,
          error: error.message
        });
      }
    });

    await Promise.all(promises);

    // Get system metrics
    const systemHealth = await this.getSystemHealth();
    
    // Trigger alerts if needed
    if (systemHealth.overall !== 'healthy') {
      this.triggerAlerts(systemHealth);
    }

    // Log health status
    this.logHealthStatus(systemHealth);
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const services = Array.from(this.healthChecks.values());
    
    // Calculate overall health
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;
    
    let overall: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    }

    // Get system metrics
    const memory = await this.getMemoryUsage();
    const cpu = await this.getCpuUsage();
    const disk = await this.getDiskUsage();

    return {
      overall,
      uptime: process.uptime(),
      memory,
      cpu,
      disk,
      services,
      lastUpdate: new Date()
    };
  }

  private async getMemoryUsage(): Promise<{ used: number; total: number; percentage: number }> {
    try {
      const { stdout } = await execAsync('free -m');
      const lines = stdout.split('\n');
      const memLine = lines[1].split(/\s+/);
      const total = parseInt(memLine[1]);
      const used = parseInt(memLine[2]);
      
      return {
        used: used * 1024 * 1024, // Convert to bytes
        total: total * 1024 * 1024,
        percentage: (used / total) * 100
      };
    } catch (error) {
      return { used: 0, total: 0, percentage: 0 };
    }
  }

  private async getCpuUsage(): Promise<{ usage: number; loadAverage: number[] }> {
    try {
      const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
      const usage = parseFloat(stdout);
      
      const { stdout: loadAvg } = await execAsync('cat /proc/loadavg');
      const loadAverage = loadAvg.split(' ').slice(0, 3).map(parseFloat);
      
      return { usage, loadAverage };
    } catch (error) {
      return { usage: 0, loadAverage: [0, 0, 0] };
    }
  }

  private async getDiskUsage(): Promise<{ used: number; total: number; percentage: number }> {
    try {
      const { stdout } = await execAsync('df -B1 /');
      const lines = stdout.split('\n');
      const data = lines[1].split(/\s+/);
      const total = parseInt(data[1]);
      const used = parseInt(data[2]);
      
      return {
        used,
        total,
        percentage: (used / total) * 100
      };
    } catch (error) {
      return { used: 0, total: 0, percentage: 0 };
    }
  }

  private triggerAlerts(health: SystemHealth): void {
    console.error(`🚨 SYSTEM HEALTH ALERT: ${health.overall.toUpperCase()}`);
    
    health.services.filter(s => s.status !== 'healthy').forEach(service => {
      console.error(`❌ ${service.name}: ${service.error || service.status}`);
    });

    // Call alert callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(health);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    });
  }

  private logHealthStatus(health: SystemHealth): void {
    const status = health.overall === 'healthy' ? '✅' : health.overall === 'degraded' ? '⚠️' : '❌';
    console.log(`${status} System Health: ${health.overall.toUpperCase()}`);
    console.log(`   Memory: ${health.memory.percentage.toFixed(1)}%`);
    console.log(`   CPU: ${health.cpu.usage.toFixed(1)}%`);
    console.log(`   Disk: ${health.disk.percentage.toFixed(1)}%`);
    
    health.services.forEach(service => {
      const icon = service.status === 'healthy' ? '✅' : service.status === 'degraded' ? '⚠️' : '❌';
      console.log(`   ${icon} ${service.name}: ${service.responseTime}ms${service.error ? ` - ${service.error}` : ''}`);
    });
  }

  onAlert(callback: (health: SystemHealth) => void): void {
    this.alertCallbacks.push(callback);
  }

  async getServiceHealth(serviceName: string): Promise<HealthCheck | null> {
    return this.healthChecks.get(serviceName) || null;
  }

  async forceHealthCheck(serviceName: string): Promise<void> {
    const checkFn = (this as any)[`${serviceName}CheckFn`];
    if (checkFn) {
      try {
        const result = await checkFn();
        this.healthChecks.set(serviceName, {
          name: serviceName,
          ...result,
          lastCheck: new Date()
        });
      } catch (error) {
        this.healthChecks.set(serviceName, {
          name: serviceName,
          status: 'unhealthy',
          lastCheck: new Date(),
          responseTime: 0,
          error: error.message
        });
      }
    }
  }

  getHealthHistory(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }
}

export default UltraHealthMonitor;
