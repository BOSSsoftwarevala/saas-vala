import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraSSHConnect } from './ssh-connect';
import { UltraServerProviders } from './server-providers';
import { UltraMultiServerManagement } from './multi-server-management';

const execAsync = promisify(exec);

export interface MonitoringMetrics {
  serverId: string;
  timestamp: Date;
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
    swapTotal?: number;
    swapUsed?: number;
    swapFree?: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
    readSpeed?: number;
    writeSpeed?: number;
    iops?: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    connections: number;
    activeConnections: number;
  };
  processes: {
    total: number;
    running: number;
    sleeping: number;
    zombie: number;
  };
  uptime: number;
  bootTime?: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  serverId?: string;
  clusterId?: string;
  metric: keyof MonitoringMetrics;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  duration: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  actions: AlertAction[];
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'slack' | 'sms' | 'log';
  target: string;
  template?: string;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  serverId?: string;
  clusterId?: string;
  metric: string;
  value: number;
  threshold: number;
  severity: string;
  status: 'active' | 'resolved' | 'acknowledged';
  message: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  actions: AlertAction[];
}

export interface MonitoringDashboard {
  id: string;
  name: string;
  userId: string;
  serverIds: string[];
  clusterIds: string[];
  widgets: DashboardWidget[];
  refreshInterval: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'gauge' | 'table' | 'alert';
  title: string;
  metric: keyof MonitoringMetrics;
  serverId?: string;
  clusterId?: string;
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
  refreshInterval: number;
  position: { x: number; y: number; w: number; h: number };
  config: any;
}

export class UltraRealTimeMonitoring extends EventEmitter {
  private static instance: UltraRealTimeMonitoring;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private sshConnect: UltraSSHConnect;
  private serverProviders: UltraServerProviders;
  private multiServerManagement: UltraMultiServerManagement;
  private metrics: Map<string, MonitoringMetrics[]> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private dashboards: Map<string, MonitoringDashboard> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private alertCheckInterval?: NodeJS.Timeout;

  static getInstance(): UltraRealTimeMonitoring {
    if (!UltraRealTimeMonitoring.instance) {
      UltraRealTimeMonitoring.instance = new UltraRealTimeMonitoring();
    }
    return UltraRealTimeMonitoring.instance;
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
      
      // Load existing configurations
      await this.loadAlertRules();
      await this.loadDashboards();
      
      // Start monitoring for all servers
      await this.startAllMonitoring();
      
      // Start alert checking
      this.startAlertChecking();
      
      this.logger.info('real-time-monitoring', 'Real-time monitoring system initialized', {
        alertRulesCount: this.alertRules.size,
        dashboardsCount: this.dashboards.size,
        monitoringServersCount: this.monitoringIntervals.size
      });

    } catch (error) {
      this.logger.error('real-time-monitoring', 'Failed to initialize real-time monitoring', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS monitoring_metrics (
        id SERIAL PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        cpu_usage DECIMAL(5,2),
        cpu_cores INTEGER,
        cpu_load_average JSONB,
        cpu_temperature DECIMAL(5,2),
        memory_total BIGINT,
        memory_used BIGINT,
        memory_free BIGINT,
        memory_usage DECIMAL(5,2),
        memory_swap_total BIGINT,
        memory_swap_used BIGINT,
        memory_swap_free BIGINT,
        disk_total BIGINT,
        disk_used BIGINT,
        disk_free BIGINT,
        disk_usage DECIMAL(5,2),
        disk_read_speed BIGINT,
        disk_write_speed BIGINT,
        disk_iops INTEGER,
        network_bytes_in BIGINT,
        network_bytes_out BIGINT,
        network_packets_in BIGINT,
        network_packets_out BIGINT,
        network_connections INTEGER,
        network_active_connections INTEGER,
        processes_total INTEGER,
        processes_running INTEGER,
        processes_sleeping INTEGER,
        processes_zombie INTEGER,
        uptime BIGINT,
        boot_time TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS alert_rules (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        server_id VARCHAR(255),
        cluster_id VARCHAR(255),
        metric VARCHAR(50) NOT NULL,
        condition VARCHAR(20) NOT NULL,
        threshold DECIMAL(10,2) NOT NULL,
        duration INTEGER NOT NULL,
        severity VARCHAR(20) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        actions JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_triggered TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id VARCHAR(255) PRIMARY KEY,
        rule_id VARCHAR(255) NOT NULL,
        server_id VARCHAR(255),
        cluster_id VARCHAR(255),
        metric VARCHAR(50) NOT NULL,
        value DECIMAL(10,2) NOT NULL,
        threshold DECIMAL(10,2) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        triggered_at TIMESTAMP NOT NULL,
        resolved_at TIMESTAMP,
        acknowledged_at TIMESTAMP,
        acknowledged_by VARCHAR(255),
        actions JSONB
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS monitoring_dashboards (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        server_ids JSONB,
        cluster_ids JSONB,
        widgets JSONB NOT NULL,
        refresh_interval INTEGER NOT NULL,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for performance
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_server_id_timestamp ON monitoring_metrics(server_id, timestamp)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_alert_rules_server_id ON alert_rules(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_alert_rules_cluster_id ON alert_rules(cluster_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_alerts_rule_id ON alerts(rule_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_monitoring_dashboards_user_id ON monitoring_dashboards(user_id)');
  }

  private async loadAlertRules(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM alert_rules WHERE enabled = true');
      
      for (const row of rows) {
        const rule: AlertRule = {
          id: row.id,
          name: row.name,
          description: row.description,
          serverId: row.server_id,
          clusterId: row.cluster_id,
          metric: row.metric as keyof MonitoringMetrics,
          condition: row.condition,
          threshold: row.threshold,
          duration: row.duration,
          severity: row.severity,
          enabled: row.enabled,
          actions: row.actions || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastTriggered: row.last_triggered
        };
        
        this.alertRules.set(rule.id, rule);
      }
      
      this.logger.info('real-time-monitoring', `Loaded ${this.alertRules.size} alert rules`);
    } catch (error) {
      this.logger.error('real-time-monitoring', 'Failed to load alert rules', error as Error);
    }
  }

  private async loadDashboards(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM monitoring_dashboards');
      
      for (const row of rows) {
        const dashboard: MonitoringDashboard = {
          id: row.id,
          name: row.name,
          userId: row.user_id,
          serverIds: row.server_ids || [],
          clusterIds: row.cluster_ids || [],
          widgets: row.widgets || [],
          refreshInterval: row.refresh_interval,
          isPublic: row.is_public,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.dashboards.set(dashboard.id, dashboard);
      }
      
      this.logger.info('real-time-monitoring', `Loaded ${this.dashboards.size} monitoring dashboards`);
    } catch (error) {
      this.logger.error('real-time-monitoring', 'Failed to load monitoring dashboards', error as Error);
    }
  }

  private async startAllMonitoring(): Promise<void> {
    try {
      // Get all servers
      const servers = this.serverProviders.getServersByUserId('system'); // System user for all servers
      
      for (const server of servers) {
        await this.startServerMonitoring(server.id);
      }
      
      this.logger.info('real-time-monitoring', `Started monitoring for ${servers.length} servers`);
    } catch (error) {
      this.logger.error('real-time-monitoring', 'Failed to start all monitoring', error as Error);
    }
  }

  async startServerMonitoring(serverId: string, interval: number = 30): Promise<void> {
    // Stop existing monitoring if any
    await this.stopServerMonitoring(serverId);
    
    const monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics(serverId);
      } catch (error) {
        this.logger.error('real-time-monitoring', `Failed to collect metrics for server: ${serverId}`, error as Error);
      }
    }, interval * 1000);

    this.monitoringIntervals.set(serverId, monitoringInterval);
    
    // Collect initial metrics
    await this.collectMetrics(serverId);
    
    this.logger.info('real-time-monitoring', `Started monitoring for server: ${serverId}`, {
      interval
    });
  }

  async stopServerMonitoring(serverId: string): Promise<void> {
    const interval = this.monitoringIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(serverId);
      
      this.logger.info('real-time-monitoring', `Stopped monitoring for server: ${serverId}`);
    }
  }

  private async collectMetrics(serverId: string): Promise<void> {
    try {
      const server = this.serverProviders.getServer(serverId);
      if (!server) {
        throw new Error('Server not found');
      }

      // Find SSH connection for this server
      const connections = await this.sshConnect.getConnectionsByUserId('system');
      const connection = connections.find(c => c.serverId === serverId);
      
      if (!connection) {
        throw new Error('No SSH connection found for server');
      }

      // Collect metrics via SSH
      const metrics = await this.collectServerMetrics(connection.id);
      metrics.serverId = serverId;
      metrics.timestamp = new Date();

      // Store metrics in memory (keep last 1000 data points per server)
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

      // Emit metrics event
      this.emit('metricsCollected', { serverId, metrics });

    } catch (error) {
      this.logger.error('real-time-monitoring', `Failed to collect metrics for server: ${serverId}`, error as Error);
    }
  }

  private async collectServerMetrics(connectionId: string): Promise<MonitoringMetrics> {
    try {
      // CPU metrics
      const cpuResult = await this.sshConnect.executeCommand(connectionId, "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1", 5000);
      const cpuCoresResult = await this.sshConnect.executeCommand(connectionId, "nproc", 5000);
      const loadAvgResult = await this.sshConnect.executeCommand(connectionId, "cat /proc/loadavg", 5000);

      // Memory metrics
      const memResult = await this.sshConnect.executeCommand(connectionId, "free -b | grep Mem", 5000);
      const swapResult = await this.sshConnect.executeCommand(connectionId, "free -b | grep Swap", 5000);

      // Disk metrics
      const diskResult = await this.sshConnect.executeCommand(connectionId, "df -B1 / | tail -1", 5000);
      const diskIoResult = await this.sshConnect.executeCommand(connectionId, "iostat -dx 1 1 | grep -E 'Device|sda|vda' | tail -1", 5000);

      // Network metrics
      const netResult = await this.sshConnect.executeCommand(connectionId, "cat /proc/net/dev | grep -E '(eth|ens|enp)' | head -1", 5000);
      const netConnectionsResult = await this.sshConnect.executeCommand(connectionId, "ss -s | grep 'TCP:' | awk '{print $2}'", 5000);

      // Process metrics
      const procResult = await this.sshConnect.executeCommand(connectionId, "ps aux | awk 'NR>1{count[$8]++} END{print count[\"R\"]+0, count[\"S\"]+0, count[\"Z\"]+0, NR-1}'", 5000);

      // Uptime
      const uptimeResult = await this.sshConnect.executeCommand(connectionId, "cat /proc/uptime", 5000);

      // Parse metrics
      const cpuUsage = parseFloat(cpuResult.stdout.trim()) || 0;
      const cpuCores = parseInt(cpuCoresResult.stdout.trim()) || 1;
      const loadAvg = loadAvgResult.stdout.trim().split(/\s+/).slice(0, 3).map(Number);

      const memParts = memResult.stdout.trim().split(/\s+/);
      const memoryTotal = parseInt(memParts[1]) || 0;
      const memoryUsed = parseInt(memParts[2]) || 0;
      const memoryFree = parseInt(memParts[3]) || 0;

      const swapParts = swapResult.stdout.trim().split(/\s+/);
      const swapTotal = parseInt(swapParts[1]) || 0;
      const swapUsed = parseInt(swapParts[2]) || 0;
      const swapFree = parseInt(swapParts[3]) || 0;

      const diskParts = diskResult.stdout.trim().split(/\s+/);
      const diskTotal = parseInt(diskParts[1]) || 0;
      const diskUsed = parseInt(diskParts[2]) || 0;
      const diskFree = parseInt(diskParts[3]) || 0;

      const netParts = netResult.stdout.trim().split(/\s+/);
      const bytesIn = parseInt(netParts[1]) || 0;
      const packetsIn = parseInt(netParts[2]) || 0;
      const bytesOut = parseInt(netParts[9]) || 0;
      const packetsOut = parseInt(netParts[10]) || 0;

      const netConnections = parseInt(netConnectionsResult.stdout.trim()) || 0;

      const procParts = procResult.stdout.trim().split(/\s+/);
      const processesRunning = parseInt(procParts[0]) || 0;
      const processesSleeping = parseInt(procParts[1]) || 0;
      const processesZombie = parseInt(procParts[2]) || 0;
      const processesTotal = parseInt(procParts[3]) || 0;

      const uptimeParts = uptimeResult.stdout.trim().split(/\s+/);
      const uptime = parseFloat(uptimeParts[0]) || 0;

      return {
        serverId: '', // Will be set by caller
        timestamp: new Date(),
        cpu: {
          usage: cpuUsage,
          cores: cpuCores,
          loadAverage: loadAvg
        },
        memory: {
          total: memoryTotal,
          used: memoryUsed,
          free: memoryFree,
          usage: (memoryUsed / memoryTotal) * 100,
          swapTotal,
          swapUsed,
          swapFree
        },
        disk: {
          total: diskTotal,
          used: diskUsed,
          free: diskFree,
          usage: (diskUsed / diskTotal) * 100
        },
        network: {
          bytesIn,
          bytesOut,
          packetsIn,
          packetsOut,
          connections: netConnections,
          activeConnections: netConnections
        },
        processes: {
          total: processesTotal,
          running: processesRunning,
          sleeping: processesSleeping,
          zombie: processesZombie
        },
        uptime
      };

    } catch (error) {
      this.logger.error('real-time-monitoring', 'Failed to collect server metrics', error as Error);
      throw error;
    }
  }

  private async storeMetricsInDB(metrics: MonitoringMetrics): Promise<void> {
    try {
      await this.database.query(`
        INSERT INTO monitoring_metrics (
          server_id, timestamp, cpu_usage, cpu_cores, cpu_load_average,
          memory_total, memory_used, memory_free, memory_usage,
          memory_swap_total, memory_swap_used, memory_swap_free,
          disk_total, disk_used, disk_free, disk_usage,
          network_bytes_in, network_bytes_out, network_packets_in, network_packets_out,
          network_connections, network_active_connections,
          processes_total, processes_running, processes_sleeping, processes_zombie,
          uptime
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      `, [
        metrics.serverId,
        metrics.timestamp,
        metrics.cpu.usage,
        metrics.cpu.cores,
        JSON.stringify(metrics.cpu.loadAverage),
        metrics.memory.total,
        metrics.memory.used,
        metrics.memory.free,
        metrics.memory.usage,
        metrics.memory.swapTotal,
        metrics.memory.swapUsed,
        metrics.memory.swapFree,
        metrics.disk.total,
        metrics.disk.used,
        metrics.disk.free,
        metrics.disk.usage,
        metrics.network.bytesIn,
        metrics.network.bytesOut,
        metrics.network.packetsIn,
        metrics.network.packetsOut,
        metrics.network.connections,
        metrics.network.activeConnections,
        metrics.processes.total,
        metrics.processes.running,
        metrics.processes.sleeping,
        metrics.processes.zombie,
        metrics.uptime
      ]);
    } catch (error) {
      this.logger.error('real-time-monitoring', 'Failed to store metrics in database', error as Error);
    }
  }

  private startAlertChecking(): void {
    // Check alerts every 30 seconds
    this.alertCheckInterval = setInterval(async () => {
      await this.checkAlerts();
    }, 30000);
  }

  private async checkAlerts(): Promise<void> {
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue;

      try {
        await this.evaluateAlertRule(rule);
      } catch (error) {
        this.logger.error('real-time-monitoring', `Failed to evaluate alert rule: ${rule.name}`, error as Error);
      }
    }
  }

  private async evaluateAlertRule(rule: AlertRule): Promise<void> {
    let serversToCheck: string[] = [];

    if (rule.serverId) {
      serversToCheck = [rule.serverId];
    } else if (rule.clusterId) {
      const cluster = await this.multiServerManagement.getCluster(rule.clusterId);
      if (cluster) {
        serversToCheck = cluster.servers;
      }
    } else {
      // Check all servers
      serversToCheck = Array.from(this.metrics.keys());
    }

    for (const serverId of serversToCheck) {
      const serverMetrics = this.metrics.get(serverId);
      if (!serverMetrics || serverMetrics.length === 0) continue;

      const latestMetrics = serverMetrics[serverMetrics.length - 1];
      const metricValue = this.getMetricValue(latestMetrics, rule.metric);

      if (metricValue === null) continue;

      const isTriggered = this.evaluateCondition(metricValue, rule.condition, rule.threshold);

      if (isTriggered) {
        await this.triggerAlert(rule, serverId, metricValue);
      } else {
        await this.resolveAlert(rule, serverId);
      }
    }
  }

  private getMetricValue(metrics: MonitoringMetrics, metricPath: keyof MonitoringMetrics): number | null {
    try {
      const parts = metricPath.split('.');
      let value: any = metrics;

      for (const part of parts) {
        value = value[part];
        if (value === undefined) return null;
      }

      return typeof value === 'number' ? value : null;
    } catch {
      return null;
    }
  }

  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule, serverId: string, value: number): Promise<void> {
    const alertId = `${rule.id}-${serverId}`;
    const existingAlert = this.activeAlerts.get(alertId);

    if (existingAlert && existingAlert.status === 'active') {
      return; // Alert already active
    }

    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      serverId,
      clusterId: rule.clusterId,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      severity: rule.severity,
      status: 'active',
      message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.threshold})`,
      triggeredAt: new Date(),
      actions: rule.actions
    };

    // Store alert
    await this.database.query(`
      INSERT INTO alerts (
        id, rule_id, server_id, cluster_id, metric, value, threshold,
        severity, status, message, triggered_at, actions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        triggered_at = EXCLUDED.triggered_at,
        value = EXCLUDED.value,
        message = EXCLUDED.message
    `, [
      alert.id,
      alert.ruleId,
      alert.serverId,
      alert.clusterId,
      alert.metric,
      alert.value,
      alert.threshold,
      alert.severity,
      alert.status,
      alert.message,
      alert.triggeredAt,
      JSON.stringify(alert.actions)
    ]);

    this.activeAlerts.set(alertId, alert);

    // Execute alert actions
    await this.executeAlertActions(alert);

    // Update rule last triggered
    rule.lastTriggered = new Date();
    await this.database.query('UPDATE alert_rules SET last_triggered = $1 WHERE id = $2', [rule.lastTriggered, rule.id]);

    this.emit('alertTriggered', alert);
    this.logger.warn('real-time-monitoring', `Alert triggered: ${alert.message}`, {
      alertId,
      serverId,
      severity: rule.severity
    });
  }

  private async resolveAlert(rule: AlertRule, serverId: string): Promise<void> {
    const alertId = `${rule.id}-${serverId}`;
    const existingAlert = this.activeAlerts.get(alertId);

    if (!existingAlert || existingAlert.status !== 'active') {
      return;
    }

    existingAlert.status = 'resolved';
    existingAlert.resolvedAt = new Date();

    await this.database.query(`
      UPDATE alerts 
      SET status = 'resolved', resolved_at = $1 
      WHERE id = $2
    `, [existingAlert.resolvedAt, existingAlert.id]);

    this.activeAlerts.delete(alertId);

    this.emit('alertResolved', existingAlert);
    this.logger.info('real-time-monitoring', `Alert resolved: ${existingAlert.message}`, {
      alertId,
      serverId
    });
  }

  private async executeAlertActions(alert: Alert): Promise<void> {
    for (const action of alert.actions) {
      if (!action.enabled) continue;

      try {
        switch (action.type) {
          case 'email':
            await this.sendEmailAlert(action.target, alert);
            break;
          case 'webhook':
            await this.sendWebhookAlert(action.target, alert);
            break;
          case 'slack':
            await this.sendSlackAlert(action.target, alert);
            break;
          case 'log':
            this.logger.warn('real-time-monitoring', `ALERT: ${alert.message}`, alert);
            break;
        }
      } catch (error) {
        this.logger.error('real-time-monitoring', `Failed to execute alert action: ${action.type}`, error as Error);
      }
    }
  }

  private async sendEmailAlert(email: string, alert: Alert): Promise<void> {
    // Email implementation would go here
    this.logger.info('real-time-monitoring', `Email alert sent to ${email}: ${alert.message}`);
  }

  private async sendWebhookAlert(webhook: string, alert: Alert): Promise<void> {
    // Webhook implementation would go here
    this.logger.info('real-time-monitoring', `Webhook alert sent to ${webhook}: ${alert.message}`);
  }

  private async sendSlackAlert(webhook: string, alert: Alert): Promise<void> {
    // Slack implementation would go here
    this.logger.info('real-time-monitoring', `Slack alert sent to ${webhook}: ${alert.message}`);
  }

  // Public API methods
  async createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ruleId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const alertRule: AlertRule = {
      ...rule,
      id: ruleId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.database.query(`
      INSERT INTO alert_rules (
        id, name, description, server_id, cluster_id, metric, condition,
        threshold, duration, severity, enabled, actions, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      alertRule.id,
      alertRule.name,
      alertRule.description,
      alertRule.serverId,
      alertRule.clusterId,
      alertRule.metric,
      alertRule.condition,
      alertRule.threshold,
      alertRule.duration,
      alertRule.severity,
      alertRule.enabled,
      JSON.stringify(alertRule.actions),
      alertRule.createdAt,
      alertRule.updatedAt
    ]);

    this.alertRules.set(ruleId, alertRule);

    this.emit('alertRuleCreated', alertRule);
    return ruleId;
  }

  async getServerMetrics(serverId: string, timeRange?: { start: Date; end: Date }): Promise<MonitoringMetrics[]> {
    const metrics = this.metrics.get(serverId) || [];
    
    if (!timeRange) {
      return metrics;
    }

    return metrics.filter(m => 
      m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.activeAlerts.values());
  }

  async getAlertHistory(serverId?: string, limit: number = 100): Promise<Alert[]> {
    try {
      let query = 'SELECT * FROM alerts ORDER BY triggered_at DESC LIMIT $1';
      const params = [limit];

      if (serverId) {
        query = 'SELECT * FROM alerts WHERE server_id = $2 ORDER BY triggered_at DESC LIMIT $1';
        params.push(serverId);
      }

      const rows = await this.database.query(query, params);
      
      return rows.map(row => ({
        id: row.id,
        ruleId: row.rule_id,
        serverId: row.server_id,
        clusterId: row.cluster_id,
        metric: row.metric,
        value: row.value,
        threshold: row.threshold,
        severity: row.severity,
        status: row.status,
        message: row.message,
        triggeredAt: row.triggered_at,
        resolvedAt: row.resolved_at,
        acknowledgedAt: row.acknowledged_at,
        acknowledgedBy: row.acknowledged_by,
        actions: row.actions || []
      }));

    } catch (error) {
      this.logger.error('real-time-monitoring', 'Failed to get alert history', error as Error);
      return [];
    }
  }

  async createDashboard(dashboard: Omit<MonitoringDashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const dashboardId = `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newDashboard: MonitoringDashboard = {
      ...dashboard,
      id: dashboardId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.database.query(`
      INSERT INTO monitoring_dashboards (
        id, name, user_id, server_ids, cluster_ids, widgets,
        refresh_interval, is_public, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      newDashboard.id,
      newDashboard.name,
      newDashboard.userId,
      JSON.stringify(newDashboard.serverIds),
      JSON.stringify(newDashboard.clusterIds),
      JSON.stringify(newDashboard.widgets),
      newDashboard.refreshInterval,
      newDashboard.isPublic,
      newDashboard.createdAt,
      newDashboard.updatedAt
    ]);

    this.dashboards.set(dashboardId, newDashboard);

    this.emit('dashboardCreated', newDashboard);
    return dashboardId;
  }

  async getMonitoringStats(): Promise<{
    totalServers: number;
    monitoredServers: number;
    alertRules: number;
    activeAlerts: number;
    dashboards: number;
    metricsCollected: number;
  }> {
    return {
      totalServers: this.serverProviders.getServersByUserId('system').length,
      monitoredServers: this.monitoringIntervals.size,
      alertRules: this.alertRules.size,
      activeAlerts: this.activeAlerts.size,
      dashboards: this.dashboards.size,
      metricsCollected: Array.from(this.metrics.values()).reduce((sum, metrics) => sum + metrics.length, 0)
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    monitoredServers: number;
    alertRulesCount: number;
    activeAlertsCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getMonitoringStats();
    
    if (stats.monitoredServers === 0) {
      issues.push('No servers are being monitored');
    }
    
    if (stats.activeAlerts > 0) {
      issues.push(`${stats.activeAlerts} active alerts`);
    }

    return {
      healthy: issues.length === 0,
      monitoredServers: stats.monitoredServers,
      alertRulesCount: stats.alertRules,
      activeAlertsCount: stats.activeAlerts,
      issues
    };
  }

  async destroy(): Promise<void> {
    // Stop all monitoring intervals
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }
    
    this.monitoringIntervals.clear();
    
    this.logger.info('real-time-monitoring', 'Real-time monitoring system shut down');
  }
}

export default UltraRealTimeMonitoring;
