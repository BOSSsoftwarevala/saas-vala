export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  responseTime?: number;
  lastChecked: Date;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: HealthCheck[];
  uptime: number;
  version: string;
  timestamp: Date;
  alerts: HealthAlert[];
}

export interface HealthAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  component: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface HealthCheckConfig {
  interval: number; // Check interval in milliseconds
  timeout: number; // Timeout in milliseconds
  retries: number; // Number of retries before marking as unhealthy
  alertThreshold?: number; // Number of consecutive failures before alerting
}

export class HealthMonitor {
  private static instance: HealthMonitor;
  private checks: Map<string, HealthCheck> = new Map();
  private alerts: HealthAlert[] = [];
  private checkConfigs: Map<string, HealthCheckConfig> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private startTime = Date.now();
  private systemVersion = '1.0.0';

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  constructor() {
    this.initializeDefaultChecks();
  }

  registerCheck(
    name: string,
    checkFunction: () => Promise<HealthCheck>,
    config: HealthCheckConfig = { interval: 60000, timeout: 5000, retries: 3 }
  ): void {
    this.checkConfigs.set(name, config);
    
    // Run initial check
    this.runCheck(name, checkFunction);
    
    // Schedule recurring checks
    const interval = setInterval(() => {
      this.runCheck(name, checkFunction);
    }, config.interval);
    
    this.intervals.set(name, interval);
  }

  async runCheck(name: string, checkFunction: () => Promise<HealthCheck>): Promise<void> {
    const config = this.checkConfigs.get(name);
    if (!config) return;

    let lastError: Error | null = null;
    let consecutiveFailures = 0;

    for (let attempt = 0; attempt <= config.retries; attempt++) {
      try {
        const result = await this.withTimeout(checkFunction(), config.timeout);
        result.lastChecked = new Date();
        this.checks.set(name, result);
        
        // If we get here, the check passed
        if (consecutiveFailures > 0) {
          this.createAlert('info', `Health check '${name}' recovered`, name);
        }
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        consecutiveFailures++;
        
        if (attempt < config.retries) {
          await this.sleep(1000 * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed
    const failedCheck: HealthCheck = {
      name,
      status: 'unhealthy',
      message: lastError?.message || 'Check failed',
      lastChecked: new Date(),
    };
    
    this.checks.set(name, failedCheck);
    
    // Create alert if threshold reached
    const threshold = config.alertThreshold || 1;
    if (consecutiveFailures >= threshold) {
      this.createAlert('error', `Health check '${name}' failed: ${lastError?.message}`, name);
    }
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const allChecks = Array.from(this.checks.values());
    const overallStatus = this.calculateOverallStatus(allChecks);
    
    return {
      status: overallStatus,
      checks: allChecks,
      uptime: Date.now() - this.startTime,
      version: this.systemVersion,
      timestamp: new Date(),
      alerts: this.alerts.filter(a => !a.acknowledged),
    };
  }

  async getHealthHistory(checkName?: string, hours: number = 24): Promise<HealthCheck[]> {
    // Implement database fetch for historical health data
    return [];
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
    }
  }

  createAlert(type: HealthAlert['type'], message: string, component: string): void {
    const alert: HealthAlert = {
      id: this.generateAlertId(),
      type,
      message,
      component,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.alerts.push(alert);
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Send notification (implement webhook/email notification)
    this.sendAlertNotification(alert);
  }

  getAlerts(filters: {
    type?: HealthAlert['type'];
    acknowledged?: boolean;
    component?: string;
    limit?: number;
  } = {}): HealthAlert[] {
    let filteredAlerts = [...this.alerts];

    if (filters.type) {
      filteredAlerts = filteredAlerts.filter(a => a.type === filters.type);
    }
    if (filters.acknowledged !== undefined) {
      filteredAlerts = filteredAlerts.filter(a => a.acknowledged === filters.acknowledged);
    }
    if (filters.component) {
      filteredAlerts = filteredAlerts.filter(a => a.component === filters.component);
    }

    // Sort by timestamp (newest first)
    filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters.limit) {
      filteredAlerts = filteredAlerts.slice(0, filters.limit);
    }

    return filteredAlerts;
  }

  private initializeDefaultChecks(): void {
    // Database health check
    this.registerCheck('database', async () => {
      const startTime = Date.now();
      try {
        // Implement database ping
        await this.checkDatabase();
        const responseTime = Date.now() - startTime;
        
        return {
          name: 'database',
          status: 'healthy',
          responseTime,
          lastChecked: new Date(),
          metadata: { connection_pool: 'active' },
        };
      } catch (error) {
        throw new Error(`Database connection failed: ${error}`);
      }
    }, { interval: 30000, timeout: 5000, retries: 2 });

    // API health check
    this.registerCheck('api', async () => {
      const startTime = Date.now();
      try {
        // Implement API health check
        await this.checkAPI();
        const responseTime = Date.now() - startTime;
        
        return {
          name: 'api',
          status: 'healthy',
          responseTime,
          lastChecked: new Date(),
          metadata: { endpoint: '/health' },
        };
      } catch (error) {
        throw new Error(`API health check failed: ${error}`);
      }
    }, { interval: 60000, timeout: 3000, retries: 2 });

    // Disk space check
    this.registerCheck('disk_space', async () => {
      try {
        const diskUsage = await this.checkDiskSpace();
        const usagePercent = (diskUsage.used / diskUsage.total) * 100;
        
        let status: HealthCheck['status'] = 'healthy';
        if (usagePercent > 90) status = 'unhealthy';
        else if (usagePercent > 80) status = 'degraded';
        
        return {
          name: 'disk_space',
          status,
          lastChecked: new Date(),
          metadata: { 
            usage_percent: usagePercent.toFixed(2),
            used_gb: (diskUsage.used / (1024 * 1024 * 1024)).toFixed(2),
            total_gb: (diskUsage.total / (1024 * 1024 * 1024)).toFixed(2),
          },
        };
      } catch (error) {
        throw new Error(`Disk space check failed: ${error}`);
      }
    }, { interval: 300000, timeout: 5000, retries: 1 });

    // Memory usage check
    this.registerCheck('memory', async () => {
      try {
        const memoryUsage = await this.checkMemoryUsage();
        const usagePercent = (memoryUsage.used / memoryUsage.total) * 100;
        
        let status: HealthCheck['status'] = 'healthy';
        if (usagePercent > 95) status = 'unhealthy';
        else if (usagePercent > 85) status = 'degraded';
        
        return {
          name: 'memory',
          status,
          lastChecked: new Date(),
          metadata: { 
            usage_percent: usagePercent.toFixed(2),
            used_mb: (memoryUsage.used / (1024 * 1024)).toFixed(2),
            total_mb: (memoryUsage.total / (1024 * 1024)).toFixed(2),
          },
        };
      } catch (error) {
        throw new Error(`Memory check failed: ${error}`);
      }
    }, { interval: 60000, timeout: 3000, retries: 1 });
  }

  private calculateOverallStatus(checks: HealthCheck[]): SystemHealth['status'] {
    if (checks.length === 0) return 'healthy';
    
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;
    
    if (unhealthyCount > 0) return 'unhealthy';
    if (degradedCount > 0) return 'degraded';
    return 'healthy';
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async checkDatabase(): Promise<void> {
    // Implement database health check
    // Example: SELECT 1
  }

  private async checkAPI(): Promise<void> {
    // Implement API health check
    // Example: GET /health
  }

  private async checkDiskSpace(): Promise<{ used: number; total: number }> {
    // Implement disk space check
    return { used: 0, total: 0 };
  }

  private async checkMemoryUsage(): Promise<{ used: number; total: number }> {
    // Implement memory usage check
    return { used: 0, total: 0 };
  }

  private async sendAlertNotification(alert: HealthAlert): Promise<void> {
    // Implement alert notification (webhook, email, etc.)
    console.log(`ALERT [${alert.type.toUpperCase()}]: ${alert.message}`);
  }

  stopMonitoring(checkName?: string): void {
    if (checkName) {
      const interval = this.intervals.get(checkName);
      if (interval) {
        clearInterval(interval);
        this.intervals.delete(checkName);
      }
    } else {
      // Stop all monitoring
      this.intervals.forEach(interval => clearInterval(interval));
      this.intervals.clear();
    }
  }
}
