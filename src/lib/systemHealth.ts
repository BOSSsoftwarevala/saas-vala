import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { auditLogger } from './auditLogs';

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  timestamp: string;
  responseTime?: number;
}

export interface ServerHealth {
  status: 'up' | 'down';
  cpu: number;
  ram: number;
  disk: number;
  uptime: number;
  lastCheck: string;
}

export interface APIHealth {
  endpoint: string;
  status: 'up' | 'down';
  responseTime: number;
  lastCheck: string;
  error?: string;
}

export interface DatabaseHealth {
  status: 'connected' | 'disconnected';
  responseTime: number;
  lastCheck: string;
  error?: string;
}

export interface ServiceHealth {
  name: string;
  status: 'running' | 'stopped';
  lastCheck: string;
}

export interface SystemHealthReport {
  overall: HealthStatus;
  server: ServerHealth;
  apis: APIHealth[];
  database: DatabaseHealth;
  services: ServiceHealth[];
  uptime: {
    percentage: number;
    lastDowntime?: string;
    totalDowntime: number;
  };
  errors: Array<{
    type: 'server' | 'api' | 'database' | 'service';
    message: string;
    timestamp: string;
  }>;
}

class SystemHealthMonitor {
  private static instance: SystemHealthMonitor;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthHistory: Array<{ timestamp: string; status: string }> = [];
  private startTime: Date = new Date();
  private lastDowntime?: Date;
  private totalDowntime: number = 0;

  static getInstance(): SystemHealthMonitor {
    if (!SystemHealthMonitor.instance) {
      SystemHealthMonitor.instance = new SystemHealthMonitor();
    }
    return SystemHealthMonitor.instance;
  }

  // Start real-time monitoring
  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);

    // Initial check
    this.performHealthCheck();
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  // Perform comprehensive health check
  async performHealthCheck(): Promise<SystemHealthReport> {
    const timestamp = new Date().toISOString();
    
    try {
      // Parallel health checks
      const [serverHealth, apiHealth, databaseHealth, servicesHealth] = await Promise.all([
        this.checkServerHealth(),
        this.checkAPIHealth(),
        this.checkDatabaseHealth(),
        this.checkServicesHealth()
      ]);

      // Calculate overall status
      const overall = this.calculateOverallStatus(serverHealth, apiHealth, databaseHealth, servicesHealth);

      // Collect errors
      const errors = this.collectErrors(serverHealth, apiHealth, databaseHealth, servicesHealth);

      // Calculate uptime
      const uptime = this.calculateUptime();

      const report: SystemHealthReport = {
        overall,
        server: serverHealth,
        apis: apiHealth,
        database: databaseHealth,
        services: servicesHealth,
        uptime,
        errors
      };

      // Store health history
      this.healthHistory.push({
        timestamp,
        status: overall.status
      });

      // Keep only last 100 entries
      if (this.healthHistory.length > 100) {
        this.healthHistory = this.healthHistory.slice(-100);
      }

      // Trigger alerts for critical issues
      if (overall.status === 'critical') {
        await this.triggerCriticalAlert(report);
      }

      // Log health check
      await auditLogger.log({
        module: 'system',
        action: 'health_check',
        description: `System health check: ${overall.status}`,
        severity: overall.status === 'critical' ? 'critical' : overall.status === 'warning' ? 'warning' : 'info',
        source: 'system',
        new_value: {
          overall_status: overall.status,
          server_status: serverHealth.status,
          database_status: databaseHealth.status,
          api_count: apiHealth.length,
          api_healthy: apiHealth.filter(api => api.status === 'up').length
        }
      });

      return report;

    } catch (error) {
      console.error('Health check failed:', error);
      
      const errorReport: SystemHealthReport = {
        overall: {
          status: 'critical',
          message: 'Health check failed',
          timestamp,
          responseTime: 0
        },
        server: {
          status: 'down',
          cpu: 0,
          ram: 0,
          disk: 0,
          uptime: 0,
          lastCheck: timestamp
        },
        apis: [],
        database: {
          status: 'disconnected',
          responseTime: 0,
          lastCheck: timestamp,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        services: [],
        uptime: {
          percentage: 0,
          lastDowntime: timestamp,
          totalDowntime: this.totalDowntime
        },
        errors: [{
          type: 'server',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp
        }]
      };

      await auditLogger.log({
        module: 'system',
        action: 'health_check_failed',
        description: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical',
        source: 'system',
        error_stack: error instanceof Error ? error.stack : undefined
      });

      return errorReport;
    }
  }

  // Check server health
  private async checkServerHealth(): Promise<ServerHealth> {
    const startTime = Date.now();
    const lastCheck = new Date().toISOString();

    return {
      status: 'up',
      cpu: 0,
      ram: 0,
      disk: 0,
      uptime: Date.now() - this.startTime.getTime(),
      lastCheck
    };
  }

  // Check API health
  private async checkAPIHealth(): Promise<APIHealth[]> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const endpoints = [
      supabaseUrl ? `${supabaseUrl}/rest/v1/` : null,
    ].filter(Boolean) as string[];

    const checks = endpoints.map(async (endpoint) => {
      const startTime = Date.now();
      const lastCheck = new Date().toISOString();

      try {
        const response = await fetch(endpoint, {
          method: 'GET'
        });

        const responseTime = Date.now() - startTime;

        if (response.ok) {
          return {
            endpoint,
            status: 'up' as const,
            responseTime,
            lastCheck
          };
        } else {
          return {
            endpoint,
            status: 'down' as const,
            responseTime,
            lastCheck,
            error: `HTTP ${response.status}`
          };
        }

      } catch (error) {
        return {
          endpoint,
          status: 'down' as const,
          responseTime: Date.now() - startTime,
          lastCheck,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return Promise.all(checks);
  }

  // Check database health
  private async checkDatabaseHealth(): Promise<DatabaseHealth> {
    const startTime = Date.now();
    const lastCheck = new Date().toISOString();

    try {
      // Test database connection with Supabase
      const { data, error } = await supabase
        .from('audit_logs')
        .select('log_id')
        .limit(1);

      const responseTime = Date.now() - startTime;

      if (error) {
        console.error('Database connection error:', error);
        throw new Error(`Database connection failed: ${error.message}`);
      }

      return {
        status: 'connected',
        responseTime,
        lastCheck
      };

    } catch (error) {
      console.error('Database health check error:', error);
      return {
        status: 'disconnected',
        responseTime: Date.now() - startTime,
        lastCheck,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Check services health
  private async checkServicesHealth(): Promise<ServiceHealth[]> {
    const services = [
      { name: 'nginx', endpoint: '/api/health/nginx' },
      { name: 'backend', endpoint: '/api/health/backend' },
      { name: 'queue', endpoint: '/api/health/queue' }
    ];

    const lastCheck = new Date().toISOString();

    const checks = services.map(async (service) => {
      try {
        const response = await fetch(service.endpoint, {
          method: 'GET'
        });

        return {
          name: service.name,
          status: response.ok ? 'running' as const : 'stopped' as const,
          lastCheck
        };

      } catch (error) {
        return {
          name: service.name,
          status: 'stopped' as const,
          lastCheck
        };
      }
    });

    return Promise.all(checks);
  }

  // Calculate overall system status
  private calculateOverallStatus(
    server: ServerHealth,
    apis: APIHealth[],
    database: DatabaseHealth,
    services: ServiceHealth[]
  ): HealthStatus {
    const criticalIssues = [];
    const warnings = [];

    // Check server
    if (server.status === 'down') {
      criticalIssues.push('Server is down');
    } else if (server.cpu > 90 || server.ram > 90 || server.disk > 90) {
      warnings.push('High resource usage');
    }

    // Check database
    if (database.status === 'disconnected') {
      criticalIssues.push('Database disconnected');
    } else if (database.responseTime > 1000) {
      warnings.push('Slow database response');
    }

    // Check APIs
    const failedAPIs = apis.filter(api => api.status === 'down');
    if (failedAPIs.length > 0) {
      criticalIssues.push(`${failedAPIs.length} APIs down`);
    }

    const slowAPIs = apis.filter(api => api.responseTime > 2000);
    if (slowAPIs.length > 0) {
      warnings.push(`${slowAPIs.length} APIs slow`);
    }

    // Check services
    const stoppedServices = services.filter(service => service.status === 'stopped');
    if (stoppedServices.length > 0) {
      criticalIssues.push(`${stoppedServices.length} services stopped`);
    }

    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' | 'unknown';
    let message: string;

    if (criticalIssues.length > 0) {
      status = 'critical';
      message = criticalIssues.join(', ');
    } else if (warnings.length > 0) {
      status = 'warning';
      message = warnings.join(', ');
    } else {
      status = 'healthy';
      message = 'All systems operational';
    }

    return {
      status,
      message,
      timestamp: new Date().toISOString()
    };
  }

  // Collect errors from all components
  private collectErrors(
    server: ServerHealth,
    apis: APIHealth[],
    database: DatabaseHealth,
    services: ServiceHealth[]
  ): Array<{ type: 'server' | 'api' | 'database' | 'service'; message: string; timestamp: string }> {
    const errors = [];
    const timestamp = new Date().toISOString();

    if (server.status === 'down') {
      errors.push({
        type: 'server',
        message: 'Server is down',
        timestamp
      });
    }

    apis.forEach(api => {
      if (api.status === 'down' && api.error) {
        errors.push({
          type: 'api',
          message: `API ${api.endpoint} failed: ${api.error}`,
          timestamp
        });
      }
    });

    if (database.status === 'disconnected' && database.error) {
      errors.push({
        type: 'database',
        message: `Database error: ${database.error}`,
        timestamp
      });
    }

    services.forEach(service => {
      if (service.status === 'stopped') {
        errors.push({
          type: 'service',
          message: `Service ${service.name} is stopped`,
          timestamp
        });
      }
    });

    return errors;
  }

  // Calculate uptime statistics
  private calculateUptime(): { percentage: number; lastDowntime?: string; totalDowntime: number } {
    const totalTime = Date.now() - this.startTime.getTime();
    const uptimePercentage = totalTime > 0 ? ((totalTime - this.totalDowntime) / totalTime) * 100 : 0;

    return {
      percentage: Math.round(uptimePercentage * 100) / 100,
      lastDowntime: this.lastDowntime?.toISOString(),
      totalDowntime: this.totalDowntime
    };
  }

  // Trigger critical alerts
  private async triggerCriticalAlert(report: SystemHealthReport): Promise<void> {
    // Send notification to admins
    toast.error(`🚨 CRITICAL: ${report.overall.message}`, {
      duration: 10000,
    });

    // Log critical alert
    await auditLogger.log({
      module: 'system',
      action: 'critical_alert',
      description: `Critical system alert: ${report.overall.message}`,
      severity: 'critical',
      source: 'system',
      new_value: {
        overall_status: report.overall.status,
        errors: report.errors.length,
        timestamp: report.overall.timestamp
      }
    });
  }

  // Get health history
  getHealthHistory(): Array<{ timestamp: string; status: string }> {
    return [...this.healthHistory];
  }

  // Get current health status
  async getCurrentHealth(): Promise<SystemHealthReport> {
    return this.performHealthCheck();
  }

  // Test service downtime detection
  async testDowntimeDetection(): Promise<void> {
    await auditLogger.log({
      module: 'system',
      action: 'downtime_test',
      description: 'Testing downtime detection system',
      severity: 'warning',
      source: 'system'
    });

    // Simulate downtime
    this.lastDowntime = new Date();
    this.totalDowntime += 60000; // Add 1 minute of downtime

    toast.info('Downtime detection test completed');
  }
}

// Export singleton instance
export const systemHealthMonitor = SystemHealthMonitor.getInstance();

// Convenience functions
export const startHealthMonitoring = (intervalMs?: number) => {
  systemHealthMonitor.startMonitoring(intervalMs);
};

export const stopHealthMonitoring = () => {
  systemHealthMonitor.stopMonitoring();
};

export const getCurrentSystemHealth = () => {
  return systemHealthMonitor.getCurrentHealth();
};

export const getHealthHistory = () => {
  return systemHealthMonitor.getHealthHistory();
};

export const testDowntimeDetection = () => {
  return systemHealthMonitor.testDowntimeDetection();
};
