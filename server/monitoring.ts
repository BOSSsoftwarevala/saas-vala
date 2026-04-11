import { EventEmitter } from 'events';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { UltraLogger } from './logger';
import { UltraHealthMonitor } from './health-monitor';
import { UltraDatabase } from './database';
import { UltraPerformance } from './performance';

const execAsync = promisify(exec);

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  service: string;
  message: string;
  details: any;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  resolvedAt?: Date;
}

export interface MonitoringMetrics {
  timestamp: Date;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  diskUsage: number;
  networkIO: {
    bytesIn: number;
    bytesOut: number;
  };
  responseTime: number;
  errorRate: number;
  activeConnections: number;
  requestRate: number;
}

export interface Threshold {
  metric: keyof MonitoringMetrics;
  warning: number;
  critical: number;
  operator: '>' | '<' | '=' | '>=' | '<=';
}

export class UltraMonitoring extends EventEmitter {
  private static instance: UltraMonitoring;
  private logger: UltraLogger;
  private healthMonitor: UltraHealthMonitor;
  private database: UltraDatabase;
  private performance: UltraPerformance;
  private alerts: Map<string, Alert> = new Map();
  private metrics: MonitoringMetrics[] = [];
  private thresholds: Map<string, Threshold> = new Map();
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private alertCheckInterval?: NodeJS.Timeout;

  static getInstance(): UltraMonitoring {
    if (!UltraMonitoring.instance) {
      UltraMonitoring.instance = new UltraMonitoring();
    }
    return UltraMonitoring.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.healthMonitor = UltraHealthMonitor.getInstance();
    this.database = UltraDatabase.getInstance();
    this.performance = UltraPerformance.getInstance();
    
    this.setupDefaultThresholds();
  }

  private setupDefaultThresholds(): void {
    // CPU usage thresholds
    this.thresholds.set('cpuUsage', {
      metric: 'cpuUsage',
      warning: 70,
      critical: 90,
      operator: '>='
    });

    // Memory usage thresholds
    this.thresholds.set('memoryUsage', {
      metric: 'memoryUsage',
      warning: 80,
      critical: 95,
      operator: '>='
    });

    // Disk usage thresholds
    this.thresholds.set('diskUsage', {
      metric: 'diskUsage',
      warning: 80,
      critical: 95,
      operator: '>='
    });

    // Response time thresholds
    this.thresholds.set('responseTime', {
      metric: 'responseTime',
      warning: 1000,
      critical: 5000,
      operator: '>='
    });

    // Error rate thresholds
    this.thresholds.set('errorRate', {
      metric: 'errorRate',
      warning: 5,
      critical: 15,
      operator: '>='
    });

    // Uptime threshold (only warning)
    this.thresholds.set('uptime', {
      metric: 'uptime',
      warning: 0,
      critical: 0,
      operator: '<'
    });
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      this.logger.warn('monitoring', 'Monitoring already started');
      return;
    }

    this.logger.info('monitoring', 'Starting ultra monitoring system');
    this.isMonitoring = true;

    // Start metrics collection
    this.startMetricsCollection();

    // Start health monitoring
    this.healthMonitor.startMonitoring(30000);

    // Start alert checking
    this.startAlertChecking();

    // Log initial system state
    await this.collectMetrics();
    this.logger.info('monitoring', 'Monitoring system started successfully');
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.logger.info('monitoring', 'Stopping ultra monitoring system');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }

    await this.healthMonitor.stopMonitoring();
    this.logger.info('monitoring', 'Monitoring system stopped');
  }

  private startMetricsCollection(): void {
    // Collect metrics every 30 seconds
    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 30000);

    // Store metrics history (keep last 1000 entries)
    setInterval(() => {
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }
    }, 60000);
  }

  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = new Date();
      const memUsage = process.memoryUsage();
      
      // Get CPU usage
      const cpuUsage = await this.getCPUUsage();
      
      // Get disk usage
      const diskUsage = await this.getDiskUsage();
      
      // Get network I/O
      const networkIO = await this.getNetworkIO();
      
      // Get performance metrics
      const perfStats = this.performance.getPerformanceStats();
      
      // Get database stats
      const dbStats = this.database.getDatabaseStats();
      
      const metrics: MonitoringMetrics = {
        timestamp,
        uptime: process.uptime(),
        memoryUsage: memUsage,
        cpuUsage,
        diskUsage,
        networkIO,
        responseTime: perfStats.metrics.responseTime,
        errorRate: perfStats.metrics.errorRate,
        activeConnections: dbStats.poolStats.totalCount,
        requestRate: perfStats.metrics.requestCount / 30 // Requests per second over last 30s
      };

      this.metrics.push(metrics);
      this.emit('metrics', metrics);

    } catch (error) {
      this.logger.error('monitoring', 'Failed to collect metrics', error as Error);
    }
  }

  private async getCPUUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
      return parseFloat(stdout);
    } catch {
      return 0;
    }
  }

  private async getDiskUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync('df -h /');
      const lines = stdout.split('\n');
      const data = lines[1].split(/\s+/);
      return parseInt(data[4]);
    } catch {
      return 0;
    }
  }

  private async getNetworkIO(): Promise<{ bytesIn: number; bytesOut: number }> {
    try {
      const { stdout } = await execAsync('cat /proc/net/dev | grep eth0');
      const data = stdout.trim().split(/\s+/);
      return {
        bytesIn: parseInt(data[1]),
        bytesOut: parseInt(data[9])
      };
    } catch {
      return { bytesIn: 0, bytesOut: 0 };
    }
  }

  private startAlertChecking(): void {
    this.alertCheckInterval = setInterval(async () => {
      await this.checkAlerts();
    }, 60000); // Check alerts every minute
  }

  private async checkAlerts(): Promise<void> {
    if (this.metrics.length === 0) {
      return;
    }

    const latestMetrics = this.metrics[this.metrics.length - 1];

    for (const [name, threshold] of this.thresholds.entries()) {
      const value = (latestMetrics as any)[threshold.metric];
      
      if (value === undefined) {
        continue;
      }

      const isWarning = this.compareValues(value, threshold.warning, threshold.operator);
      const isCritical = this.compareValues(value, threshold.critical, threshold.operator);

      if (isCritical) {
        await this.createAlert('critical', name, `${name} is critical: ${value}`, {
          threshold: threshold.critical,
          currentValue: value,
          metric: threshold.metric
        });
      } else if (isWarning) {
        await this.createAlert('warning', name, `${name} is elevated: ${value}`, {
          threshold: threshold.warning,
          currentValue: value,
          metric: threshold.metric
        });
      }
    }

    // Check for service health issues
    const health = await this.healthMonitor.getSystemHealth();
    for (const service of health.services) {
      if (service.status === 'unhealthy') {
        await this.createAlert('critical', service.name, `Service ${service.name} is unhealthy`, {
          error: service.error,
          responseTime: service.responseTime
        });
      } else if (service.status === 'degraded') {
        await this.createAlert('warning', service.name, `Service ${service.name} is degraded`, {
          error: service.error,
          responseTime: service.responseTime
        });
      }
    }
  }

  private compareValues(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '=': return value === threshold;
      default: return false;
    }
  }

  private async createAlert(type: Alert['type'], service: string, message: string, details: any): Promise<void> {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if similar alert already exists and is not acknowledged
    const existingAlert = Array.from(this.alerts.values()).find(alert => 
      alert.service === service && 
      alert.type === type && 
      !alert.acknowledged && 
      !alert.resolvedAt
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: Alert = {
      id: alertId,
      type,
      service,
      message,
      details,
      timestamp: new Date(),
      acknowledged: false
    };

    this.alerts.set(alertId, alert);
    this.emit('alert', alert);

    // Log the alert
    this.logger.warn('monitoring', `Alert created: ${message}`, details);

    // Send notifications (could integrate with email, Slack, etc.)
    await this.sendNotification(alert);
  }

  private async sendNotification(alert: Alert): Promise<void> {
    // Log notification
    this.logger.info('monitoring', `Notification sent for alert ${alert.id}`, {
      type: alert.type,
      service: alert.service,
      message: alert.message
    });

    // Could integrate with various notification channels here:
    // - Email notifications
    // - Slack/webhook notifications
    // - SMS notifications
    // - Push notifications
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    
    this.logger.info('monitoring', `Alert ${alertId} acknowledged by ${acknowledgedBy}`);
    this.emit('alertAcknowledged', alert);
    
    return true;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolvedAt = new Date();
    
    this.logger.info('monitoring', `Alert ${alertId} resolved`);
    this.emit('alertResolved', alert);
    
    return true;
  }

  // Custom alert creation
  createCustomAlert(type: Alert['type'], service: string, message: string, details?: any): string {
    const alertId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: Alert = {
      id: alertId,
      type,
      service,
      message,
      details: details || {},
      timestamp: new Date(),
      acknowledged: false
    };

    this.alerts.set(alertId, alert);
    this.emit('alert', alert);
    
    this.logger.warn('monitoring', `Custom alert created: ${message}`, details);
    return alertId;
  }

  // Get monitoring data
  getMetrics(limit?: number): MonitoringMetrics[] {
    if (limit) {
      return this.metrics.slice(-limit);
    }
    return [...this.metrics];
  }

  getAlerts(filter?: { type?: Alert['type']; service?: string; acknowledged?: boolean; resolved?: boolean }): Alert[] {
    let alerts = Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filter) {
      if (filter.type) {
        alerts = alerts.filter(alert => alert.type === filter.type);
      }
      if (filter.service) {
        alerts = alerts.filter(alert => alert.service === filter.service);
      }
      if (filter.acknowledged !== undefined) {
        alerts = alerts.filter(alert => alert.acknowledged === filter.acknowledged);
      }
      if (filter.resolved !== undefined) {
        alerts = alerts.filter(alert => (alert.resolvedAt ? true : false) === filter.resolved);
      }
    }

    return alerts;
  }

  getActiveAlerts(): Alert[] {
    return this.getAlerts({ resolved: false });
  }

  getThresholds(): Map<string, Threshold> {
    return new Map(this.thresholds);
  }

  updateThreshold(name: string, threshold: Partial<Threshold>): void {
    const existing = this.thresholds.get(name);
    if (existing) {
      this.thresholds.set(name, { ...existing, ...threshold });
      this.logger.info('monitoring', `Threshold ${name} updated`, threshold);
    }
  }

  // System overview
  async getSystemOverview(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    metrics: MonitoringMetrics;
    alerts: {
      total: number;
      active: number;
      critical: number;
      warning: number;
    };
    services: any;
  }> {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    const alerts = this.getActiveAlerts();
    const health = await this.healthMonitor.getSystemHealth();

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (alerts.some(a => a.type === 'critical')) {
      status = 'critical';
    } else if (alerts.some(a => a.type === 'warning')) {
      status = 'warning';
    }

    return {
      status,
      uptime: process.uptime(),
      metrics: latestMetrics || {} as MonitoringMetrics,
      alerts: {
        total: this.alerts.size,
        active: alerts.length,
        critical: alerts.filter(a => a.type === 'critical').length,
        warning: alerts.filter(a => a.type === 'warning').length
      },
      services: health
    };
  }

  // Export monitoring data
  exportData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      metrics: this.metrics,
      alerts: Array.from(this.alerts.values()),
      thresholds: Array.from(this.thresholds.entries()).map(([name, threshold]) => ({ name, ...threshold }))
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // CSV format
      const lines = ['timestamp,uptime,cpuUsage,memoryUsage,diskUsage,responseTime,errorRate'];
      for (const metric of this.metrics) {
        lines.push(`${metric.timestamp.toISOString()},${metric.uptime},${metric.cpuUsage},${metric.memoryUsage.heapUsed},${metric.diskUsage},${metric.responseTime},${metric.errorRate}`);
      }
      return lines.join('\n');
    }
  }

  // Cleanup old data
  cleanup(): void {
    // Clean up old metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Clean up old resolved alerts (older than 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolvedAt && alert.resolvedAt < weekAgo) {
        this.alerts.delete(id);
      }
    }

    this.logger.debug('monitoring', 'Cleanup completed');
  }
}

export default UltraMonitoring;
