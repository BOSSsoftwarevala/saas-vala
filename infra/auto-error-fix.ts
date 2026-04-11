import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraSSHConnect } from './ssh-connect';
import { UltraServerProviders } from './server-providers';
import { UltraRealTimeMonitoring } from './real-time-monitoring';
import { UltraDomainSystem } from './domain-system';
import { UltraSSLSystem } from './ssl-system';

export interface ErrorPattern {
  id: string;
  name: string;
  description: string;
  category: 'service' | 'config' | 'network' | 'ssl' | 'dns' | 'disk' | 'memory' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  patterns: string[];
  fixCommands: FixCommand[];
  conditions: ErrorCondition[];
  autoFix: boolean;
  requiresRestart: boolean;
  estimatedDowntime: number; // seconds
  successRate: number; // percentage
  createdAt: Date;
  updatedAt: Date;
}

export interface FixCommand {
  id: string;
  name: string;
  command: string;
  description: string;
  timeout: number;
  retryCount: number;
  rollbackCommand?: string;
  verifyCommand?: string;
  prerequisites: string[];
}

export interface ErrorCondition {
  type: 'log_contains' | 'service_status' | 'port_check' | 'disk_usage' | 'memory_usage' | 'ssl_expiry' | 'dns_resolution';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'not_equals';
  value: string | number;
  threshold?: number;
}

export interface ErrorDetection {
  id: string;
  serverId: string;
  patternId: string;
  detectedAt: Date;
  severity: ErrorPattern['severity'];
  message: string;
  details: any;
  status: 'detected' | 'fixing' | 'fixed' | 'failed' | 'ignored';
  autoFixAttempted: boolean;
  fixAttempts: number;
  maxFixAttempts: number;
  nextFixAttempt?: Date;
  resolvedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FixAttempt {
  id: string;
  detectionId: string;
  patternId: string;
  serverId: string;
  commandId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  output?: string;
  error?: string;
  rollbackTriggered: boolean;
  createdAt: Date;
}

export interface SystemHealth {
  serverId: string;
  timestamp: Date;
  services: ServiceHealth[];
  resources: ResourceHealth;
  network: NetworkHealth;
  ssl: SSLHealth;
  dns: DNSHealth;
  overall: 'healthy' | 'warning' | 'critical';
}

export interface ServiceHealth {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  port?: number;
  lastRestart?: Date;
}

export interface ResourceHealth {
  diskUsage: number;
  memoryUsage: number;
  cpuUsage: number;
  loadAverage: number[];
  processes: number;
}

export interface NetworkHealth {
  connectivity: boolean;
  latency: number;
  packetLoss: number;
  openPorts: number[];
  dnsResolution: boolean;
}

export interface SSLHealth {
  certificates: SSLCertificate[];
  overall: 'valid' | 'expiring' | 'expired' | 'error';
}

export interface SSLCertificate {
  domain: string;
  issuer: string;
  expiresAt: Date;
  daysUntilExpiry: number;
  isValid: boolean;
  errors: string[];
}

export interface DNSHealth {
  domains: DNSRecord[];
  overall: 'healthy' | 'warning' | 'error';
}

export interface DNSRecord {
  domain: string;
  type: string;
  value: string;
  ttl: number;
  isCorrect: boolean;
  expectedValue?: string;
}

export class UltraAutoErrorFix extends EventEmitter {
  private static instance: UltraAutoErrorFix;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private sshConnect: UltraSSHConnect;
  private serverProviders: UltraServerProviders;
  private realTimeMonitoring: UltraRealTimeMonitoring;
  private domainSystem: UltraDomainSystem;
  private sslSystem: UltraSSLSystem;
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private errorDetections: Map<string, ErrorDetection[]> = new Map();
  private fixAttempts: Map<string, FixAttempt[]> = new Map();
  private systemHealth: Map<string, SystemHealth> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private fixInProgress: Set<string> = new Set();

  static getInstance(): UltraAutoErrorFix {
    if (!UltraAutoErrorFix.instance) {
      UltraAutoErrorFix.instance = new UltraAutoErrorFix();
    }
    return UltraAutoErrorFix.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.sshConnect = UltraSSHConnect.getInstance();
    this.serverProviders = UltraServerProviders.getInstance();
    this.realTimeMonitoring = UltraRealTimeMonitoring.getInstance();
    this.domainSystem = UltraDomainSystem.getInstance();
    this.sslSystem = UltraSSLSystem.getInstance();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize database tables
      await this.initializeDatabase();
      
      // Load error patterns
      await this.loadErrorPatterns();
      
      // Load existing error detections
      await this.loadErrorDetections();
      
      // Load fix attempts
      await this.loadFixAttempts();
      
      // Setup default error patterns
      await this.setupDefaultPatterns();
      
      // Start monitoring for all servers
      await this.startAllMonitoring();
      
      this.logger.info('auto-error-fix', 'Auto error fix system initialized', {
        errorPatternsCount: this.errorPatterns.size,
        errorDetectionsCount: Array.from(this.errorDetections.values()).reduce((sum, detections) => sum + detections.length, 0),
        fixAttemptsCount: Array.from(this.fixAttempts.values()).reduce((sum, attempts) => sum + attempts.length, 0),
        monitoringActive: this.monitoringIntervals.size
      });

    } catch (error) {
      this.logger.error('auto-error-fix', 'Failed to initialize auto error fix system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS error_patterns (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(20) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        patterns JSONB NOT NULL,
        fix_commands JSONB NOT NULL,
        conditions JSONB NOT NULL,
        auto_fix BOOLEAN DEFAULT TRUE,
        requires_restart BOOLEAN DEFAULT FALSE,
        estimated_downtime INTEGER DEFAULT 0,
        success_rate DECIMAL(5,2) DEFAULT 100.0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS error_detections (
        id VARCHAR(255) PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        pattern_id VARCHAR(255) NOT NULL,
        detected_at TIMESTAMP NOT NULL,
        severity VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        details JSONB,
        status VARCHAR(20) NOT NULL,
        auto_fix_attempted BOOLEAN DEFAULT FALSE,
        fix_attempts INTEGER DEFAULT 0,
        max_fix_attempts INTEGER DEFAULT 3,
        next_fix_attempt TIMESTAMP,
        resolved_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS fix_attempts (
        id VARCHAR(255) PRIMARY KEY,
        detection_id VARCHAR(255) NOT NULL,
        pattern_id VARCHAR(255) NOT NULL,
        server_id VARCHAR(255) NOT NULL,
        command_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTEGER,
        output TEXT,
        error TEXT,
        rollback_triggered BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS system_health (
        id SERIAL PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        services JSONB NOT NULL,
        resources JSONB NOT NULL,
        network JSONB NOT NULL,
        ssl JSONB NOT NULL,
        dns JSONB NOT NULL,
        overall VARCHAR(20) NOT NULL
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_error_patterns_category ON error_patterns(category)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_error_detections_server_id ON error_detections(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_error_detections_status ON error_detections(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_fix_attempts_detection_id ON fix_attempts(detection_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_system_health_server_id_timestamp ON system_health(server_id, timestamp)');
  }

  private async loadErrorPatterns(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM error_patterns');
      
      for (const row of rows) {
        const pattern: ErrorPattern = {
          id: row.id,
          name: row.name,
          description: row.description,
          category: row.category,
          severity: row.severity,
          patterns: row.patterns,
          fixCommands: row.fix_commands,
          conditions: row.conditions,
          autoFix: row.auto_fix,
          requiresRestart: row.requires_restart,
          estimatedDowntime: row.estimated_downtime,
          successRate: row.success_rate,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.errorPatterns.set(pattern.id, pattern);
      }
      
      this.logger.info('auto-error-fix', `Loaded ${this.errorPatterns.size} error patterns`);
    } catch (error) {
      this.logger.error('auto-error-fix', 'Failed to load error patterns', error as Error);
    }
  }

  private async loadErrorDetections(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM error_detections ORDER BY detected_at DESC');
      
      for (const row of rows) {
        const detection: ErrorDetection = {
          id: row.id,
          serverId: row.server_id,
          patternId: row.pattern_id,
          detectedAt: row.detected_at,
          severity: row.severity,
          message: row.message,
          details: row.details,
          status: row.status,
          autoFixAttempted: row.auto_fix_attempted,
          fixAttempts: row.fix_attempts,
          maxFixAttempts: row.max_fix_attempts,
          nextFixAttempt: row.next_fix_attempt,
          resolvedAt: row.resolved_at,
          errorMessage: row.error_message,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.errorDetections.has(detection.serverId)) {
          this.errorDetections.set(detection.serverId, []);
        }
        this.errorDetections.get(detection.serverId)!.push(detection);
      }
      
      this.logger.info('auto-error-fix', `Loaded ${Array.from(this.errorDetections.values()).reduce((sum, detections) => sum + detections.length, 0)} error detections`);
    } catch (error) {
      this.logger.error('auto-error-fix', 'Failed to load error detections', error as Error);
    }
  }

  private async loadFixAttempts(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM fix_attempts ORDER BY created_at DESC');
      
      for (const row of rows) {
        const attempt: FixAttempt = {
          id: row.id,
          detectionId: row.detection_id,
          patternId: row.pattern_id,
          serverId: row.server_id,
          commandId: row.command_id,
          status: row.status,
          startTime: row.start_time,
          endTime: row.end_time,
          duration: row.duration,
          output: row.output,
          error: row.error,
          rollbackTriggered: row.rollback_triggered,
          createdAt: row.created_at
        };
        
        if (!this.fixAttempts.has(attempt.serverId)) {
          this.fixAttempts.set(attempt.serverId, []);
        }
        this.fixAttempts.get(attempt.serverId)!.push(attempt);
      }
      
      this.logger.info('auto-error-fix', `Loaded ${Array.from(this.fixAttempts.values()).reduce((sum, attempts) => sum + attempts.length, 0)} fix attempts`);
    } catch (error) {
      this.logger.error('auto-error-fix', 'Failed to load fix attempts', error as Error);
    }
  }

  private async setupDefaultPatterns(): Promise<void> {
    if (this.errorPatterns.size > 0) return; // Already has patterns

    const defaultPatterns: Omit<ErrorPattern, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Nginx Service Down',
        description: 'Nginx web server is not running',
        category: 'service',
        severity: 'critical',
        patterns: ['nginx: service not found', 'nginx: dead', 'nginx failed to start'],
        fixCommands: [
          {
            id: 'nginx-restart',
            name: 'Restart Nginx',
            command: 'sudo systemctl restart nginx',
            description: 'Restart nginx service',
            timeout: 30000,
            retryCount: 3,
            verifyCommand: 'sudo systemctl is-active nginx',
            prerequisites: []
          }
        ],
        conditions: [
          {
            type: 'service_status',
            operator: 'equals',
            value: 'inactive'
          }
        ],
        autoFix: true,
        requiresRestart: false,
        estimatedDowntime: 10,
        successRate: 95.0
      },
      {
        name: 'Apache Service Down',
        description: 'Apache web server is not running',
        category: 'service',
        severity: 'critical',
        patterns: ['apache2: service not found', 'apache2: dead', 'apache2 failed to start'],
        fixCommands: [
          {
            id: 'apache-restart',
            name: 'Restart Apache',
            command: 'sudo systemctl restart apache2',
            description: 'Restart apache2 service',
            timeout: 30000,
            retryCount: 3,
            verifyCommand: 'sudo systemctl is-active apache2',
            prerequisites: []
          }
        ],
        conditions: [
          {
            type: 'service_status',
            operator: 'equals',
            value: 'inactive'
          }
        ],
        autoFix: true,
        requiresRestart: false,
        estimatedDowntime: 10,
        successRate: 95.0
      },
      {
        name: 'MySQL Service Down',
        description: 'MySQL database server is not running',
        category: 'service',
        severity: 'high',
        patterns: ['mysql: service not found', 'mysql: dead', 'mysql failed to start'],
        fixCommands: [
          {
            id: 'mysql-restart',
            name: 'Restart MySQL',
            command: 'sudo systemctl restart mysql',
            description: 'Restart mysql service',
            timeout: 60000,
            retryCount: 3,
            verifyCommand: 'sudo systemctl is-active mysql',
            prerequisites: []
          }
        ],
        conditions: [
          {
            type: 'service_status',
            operator: 'equals',
            value: 'inactive'
          }
        ],
        autoFix: true,
        requiresRestart: false,
        estimatedDowntime: 30,
        successRate: 90.0
      },
      {
        name: 'High Disk Usage',
        description: 'Disk usage is above critical threshold',
        category: 'disk',
        severity: 'high',
        patterns: ['No space left on device', 'disk full', 'filesystem full'],
        fixCommands: [
          {
            id: 'cleanup-logs',
            name: 'Clean Log Files',
            command: 'sudo find /var/log -name "*.log" -type f -mtime +7 -delete',
            description: 'Remove old log files',
            timeout: 30000,
            retryCount: 1,
            prerequisites: []
          },
          {
            id: 'cleanup-cache',
            name: 'Clean Cache',
            command: 'sudo apt-get clean && sudo rm -rf /tmp/*',
            description: 'Clean package cache and temp files',
            timeout: 60000,
            retryCount: 1,
            prerequisites: []
          }
        ],
        conditions: [
          {
            type: 'disk_usage',
            operator: 'greater_than',
            value: 90
          }
        ],
        autoFix: true,
        requiresRestart: false,
        estimatedDowntime: 0,
        successRate: 85.0
      },
      {
        name: 'SSL Certificate Expiring',
        description: 'SSL certificate is expiring soon',
        category: 'ssl',
        severity: 'medium',
        patterns: ['certificate expiring', 'ssl certificate expiry'],
        fixCommands: [
          {
            id: 'renew-ssl',
            name: 'Renew SSL Certificate',
            command: 'sudo certbot renew --quiet',
            description: 'Renew SSL certificates using certbot',
            timeout: 120000,
            retryCount: 3,
            verifyCommand: 'sudo certbot certificates',
            prerequisites: []
          }
        ],
        conditions: [
          {
            type: 'ssl_expiry',
            operator: 'less_than',
            value: 7
          }
        ],
        autoFix: true,
        requiresRestart: false,
        estimatedDowntime: 0,
        successRate: 98.0
      },
      {
        name: 'DNS Resolution Failed',
        description: 'DNS resolution is failing for domains',
        category: 'dns',
        severity: 'high',
        patterns: ['dns resolution failed', 'name resolution failed', 'host not found'],
        fixCommands: [
          {
            id: 'restart-dns',
            name: 'Restart DNS Service',
            command: 'sudo systemctl restart systemd-resolved',
            description: 'Restart DNS resolver service',
            timeout: 30000,
            retryCount: 2,
            verifyCommand: 'nslookup google.com',
            prerequisites: []
          },
          {
            id: 'flush-dns',
            name: 'Flush DNS Cache',
            command: 'sudo systemd-resolve --flush-caches',
            description: 'Flush DNS cache',
            timeout: 10000,
            retryCount: 1,
            prerequisites: []
          }
        ],
        conditions: [
          {
            type: 'dns_resolution',
            operator: 'equals',
            value: false
          }
        ],
        autoFix: true,
        requiresRestart: false,
        estimatedDowntime: 5,
        successRate: 92.0
      }
    ];

    for (const pattern of defaultPatterns) {
      await this.createErrorPattern(pattern);
    }
  }

  private async startAllMonitoring(): Promise<void> {
    const servers = this.serverProviders.getServersByUserId('system');
    
    for (const server of servers) {
      await this.startMonitoring(server.id);
    }
  }

  private async startMonitoring(serverId: string): Promise<void> {
    // Stop existing monitoring
    await this.stopMonitoring(serverId);

    const interval = setInterval(async () => {
      await this.performHealthCheck(serverId);
    }, 60000); // 1 minute

    this.monitoringIntervals.set(serverId, interval);
    
    // Perform initial health check
    await this.performHealthCheck(serverId);
    
    this.logger.info('auto-error-fix', `Started monitoring for server: ${serverId}`, {
      serverId
    });
  }

  private async stopMonitoring(serverId: string): Promise<void> {
    const interval = this.monitoringIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(serverId);
    }
  }

  private async performHealthCheck(serverId: string): Promise<void> {
    try {
      const health = await this.collectSystemHealth(serverId);
      this.systemHealth.set(serverId, health);

      // Store health in database
      await this.storeSystemHealth(health);

      // Check for error patterns
      await this.checkErrorPatterns(serverId, health);

      // Check for scheduled fix attempts
      await this.checkScheduledFixes(serverId);

    } catch (error) {
      this.logger.error('auto-error-fix', `Health check failed for server: ${serverId}`, error as Error);
    }
  }

  private async collectSystemHealth(serverId: string): Promise<SystemHealth> {
    try {
      const connection = await this.getSSHConnection(serverId);
      if (!connection) {
        throw new Error('SSH connection not available');
      }

      // Collect service health
      const services = await this.collectServiceHealth(connection.id);
      
      // Collect resource health
      const resources = await this.collectResourceHealth(connection.id);
      
      // Collect network health
      const network = await this.collectNetworkHealth(connection.id);
      
      // Collect SSL health
      const ssl = await this.collectSSLHealth(serverId);
      
      // Collect DNS health
      const dns = await this.collectDNSHealth(serverId);

      // Determine overall health
      const overall = this.determineOverallHealth(services, resources, network, ssl, dns);

      return {
        serverId,
        timestamp: new Date(),
        services,
        resources,
        network,
        ssl,
        dns,
        overall
      };

    } catch (error) {
      this.logger.error('auto-error-fix', `Failed to collect system health for server: ${serverId}`, error as Error);
      
      return {
        serverId,
        timestamp: new Date(),
        services: [],
        resources: {
          diskUsage: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          loadAverage: [0, 0, 0],
          processes: 0
        },
        network: {
          connectivity: false,
          latency: 0,
          packetLoss: 100,
          openPorts: [],
          dnsResolution: false
        },
        ssl: {
          certificates: [],
          overall: 'error'
        },
        dns: {
          domains: [],
          overall: 'error'
        },
        overall: 'critical'
      };
    }
  }

  private async collectServiceHealth(connectionId: string): Promise<ServiceHealth[]> {
    const services: ServiceHealth[] = [];
    const serviceNames = ['nginx', 'apache2', 'mysql', 'postgresql', 'redis-server', 'mongod'];

    for (const serviceName of serviceNames) {
      try {
        // Check service status
        const statusResult = await this.sshConnect.executeCommand(connectionId, `systemctl is-active ${serviceName}`, 5000);
        const status = statusResult.success && statusResult.stdout.trim() === 'active' ? 'running' : 'stopped';

        // Get service details if running
        let uptime = 0, memoryUsage = 0, cpuUsage = 0;
        if (status === 'running') {
          try {
            const detailsResult = await this.sshConnect.executeCommand(connectionId, `systemctl show ${serviceName} --property=ActiveEnterTimestamp,MemoryCurrent,CPUUsageNSec`, 5000);
            // Parse details (simplified)
            uptime = Math.floor(Math.random() * 86400); // Random uptime for demo
            memoryUsage = Math.random() * 100; // Random memory usage
            cpuUsage = Math.random() * 100; // Random CPU usage
          } catch (error) {
            // Ignore errors in getting details
          }
        }

        services.push({
          name: serviceName,
          status,
          uptime,
          memoryUsage,
          cpuUsage,
          lastRestart: new Date(Date.now() - uptime * 1000)
        });

      } catch (error) {
        services.push({
          name: serviceName,
          status: 'unknown',
          uptime: 0,
          memoryUsage: 0,
          cpuUsage: 0
        });
      }
    }

    return services;
  }

  private async collectResourceHealth(connectionId: string): Promise<ResourceHealth> {
    try {
      // Get disk usage
      const diskResult = await this.sshConnect.executeCommand(connectionId, "df -h / | tail -1 | awk '{print $5}' | sed 's/%//'", 5000);
      const diskUsage = parseInt(diskResult.stdout.trim()) || 0;

      // Get memory usage
      const memResult = await this.sshConnect.executeCommand(connectionId, "free | grep Mem | awk '{printf \"%.2f\", $3/$2 * 100.0}'", 5000);
      const memoryUsage = parseFloat(memResult.stdout.trim()) || 0;

      // Get CPU usage
      const cpuResult = await this.sshConnect.executeCommand(connectionId, "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1", 5000);
      const cpuUsage = parseFloat(cpuResult.stdout.trim()) || 0;

      // Get load average
      const loadResult = await this.sshConnect.executeCommand(connectionId, "uptime | awk -F'load average:' '{print $2}'", 5000);
      const loadAverage = loadResult.stdout.trim().split(',').map(s => parseFloat(s.trim()) || 0);

      // Get process count
      const procResult = await this.sshConnect.executeCommand(connectionId, "ps aux | wc -l", 5000);
      const processes = parseInt(procResult.stdout.trim()) || 0;

      return {
        diskUsage,
        memoryUsage,
        cpuUsage,
        loadAverage,
        processes
      };

    } catch (error) {
      return {
        diskUsage: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        loadAverage: [0, 0, 0],
        processes: 0
      };
    }
  }

  private async collectNetworkHealth(connectionId: string): Promise<NetworkHealth> {
    try {
      // Test connectivity
      const pingResult = await this.sshConnect.executeCommand(connectionId, "ping -c 1 8.8.8.8 | grep 'time=' | awk '{print $4}' | cut -d'=' -f2", 10000);
      const latency = parseFloat(pingResult.stdout.trim()) || 0;

      // Test DNS resolution
      const dnsResult = await this.sshConnect.executeCommand(connectionId, "nslookup google.com | grep -q 'Address:' && echo 'success' || echo 'failed'", 5000);
      const dnsResolution = dnsResult.success && dnsResult.stdout.includes('success');

      // Get open ports (simplified)
      const portsResult = await this.sshConnect.executeCommand(connectionId, "netstat -tuln | grep LISTEN | awk '{print $4}' | cut -d':' -f2 | sort -n | head -10", 5000);
      const openPorts = portsResult.stdout.trim().split('\n').filter(p => p).map(p => parseInt(p)).filter(p => !isNaN(p));

      return {
        connectivity: latency > 0,
        latency,
        packetLoss: 0, // Simplified
        openPorts,
        dnsResolution
      };

    } catch (error) {
      return {
        connectivity: false,
        latency: 0,
        packetLoss: 100,
        openPorts: [],
        dnsResolution: false
      };
    }
  }

  private async collectSSLHealth(serverId: string): Promise<SSLHealth> {
    try {
      // Get SSL certificates from SSL system
      const certificates: SSLCertificate[] = [];
      
      // This would integrate with the SSL system to get actual certificates
      // For now, simulate certificate checks
      const domains = ['example.com', 'www.example.com'];
      
      for (const domain of domains) {
        const daysUntilExpiry = Math.floor(Math.random() * 365);
        certificates.push({
          domain,
          issuer: 'Let\'s Encrypt',
          expiresAt: new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000),
          daysUntilExpiry,
          isValid: daysUntilExpiry > 0,
          errors: daysUntilExpiry <= 0 ? ['Certificate expired'] : []
        });
      }

      const overall = certificates.some(c => !c.isValid) ? 'error' :
                     certificates.some(c => c.daysUntilExpiry < 7) ? 'expiring' : 'valid';

      return { certificates, overall };

    } catch (error) {
      return {
        certificates: [],
        overall: 'error'
      };
    }
  }

  private async collectDNSHealth(serverId: string): Promise<DNSHealth> {
    try {
      // Get DNS records from domain system
      const records: DNSRecord[] = [];
      
      // This would integrate with the domain system to get actual DNS records
      // For now, simulate DNS checks
      const domains = ['example.com', 'www.example.com'];
      
      for (const domain of domains) {
        records.push({
          domain,
          type: 'A',
          value: '192.168.1.1',
          ttl: 300,
          isCorrect: Math.random() > 0.1, // 90% chance of being correct
          expectedValue: '192.168.1.1'
        });
      }

      const overall = records.some(r => !r.isCorrect) ? 'error' : 'healthy';

      return { domains: records, overall };

    } catch (error) {
      return {
        domains: [],
        overall: 'error'
      };
    }
  }

  private determineOverallHealth(
    services: ServiceHealth[],
    resources: ResourceHealth,
    network: NetworkHealth,
    ssl: SSLHealth,
    dns: DNSHealth
  ): SystemHealth['overall'] {
    // Critical issues
    if (!network.connectivity || !network.dnsResolution) return 'critical';
    if (resources.diskUsage > 95 || resources.memoryUsage > 95) return 'critical';
    if (services.some(s => s.name === 'nginx' && s.status === 'stopped')) return 'critical';
    if (ssl.overall === 'error' || dns.overall === 'error') return 'critical';

    // Warning issues
    if (resources.diskUsage > 85 || resources.memoryUsage > 85) return 'warning';
    if (services.some(s => s.status === 'stopped')) return 'warning';
    if (ssl.overall === 'expiring') return 'warning';

    return 'healthy';
  }

  private async storeSystemHealth(health: SystemHealth): Promise<void> {
    try {
      await this.database.query(`
        INSERT INTO system_health (
          server_id, timestamp, services, resources, network, ssl, dns, overall
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        health.serverId,
        health.timestamp,
        JSON.stringify(health.services),
        JSON.stringify(health.resources),
        JSON.stringify(health.network),
        JSON.stringify(health.ssl),
        JSON.stringify(health.dns),
        health.overall
      ]);
    } catch (error) {
      this.logger.error('auto-error-fix', 'Failed to store system health', error as Error);
    }
  }

  private async checkErrorPatterns(serverId: string, health: SystemHealth): Promise<void> {
    for (const [patternId, pattern] of this.errorPatterns.entries()) {
      try {
        const isMatch = await this.evaluatePattern(pattern, health);
        
        if (isMatch) {
          await this.createErrorDetection(serverId, patternId, health);
        }
      } catch (error) {
        this.logger.error('auto-error-fix', `Failed to evaluate pattern: ${pattern.name}`, error as Error);
      }
    }
  }

  private async evaluatePattern(pattern: ErrorPattern, health: SystemHealth): Promise<boolean> {
    for (const condition of pattern.conditions) {
      const isMet = await this.evaluateCondition(condition, health);
      if (!isMet) return false;
    }

    // Check log patterns (simplified - would integrate with log system)
    for (const logPattern of pattern.patterns) {
      // This would check actual logs
      if (Math.random() < 0.01) { // 1% chance of matching for demo
        return true;
      }
    }

    return false;
  }

  private async evaluateCondition(condition: ErrorCondition, health: SystemHealth): Promise<boolean> {
    switch (condition.type) {
      case 'service_status':
        const service = health.services.find(s => s.name === condition.value);
        return service ? service.status !== 'running' : false;

      case 'disk_usage':
        return health.resources.diskUsage > (condition.value as number);

      case 'memory_usage':
        return health.resources.memoryUsage > (condition.value as number);

      case 'ssl_expiry':
        const expiringCert = health.ssl.certificates.find(c => c.daysUntilExpiry < (condition.value as number));
        return !!expiringCert;

      case 'dns_resolution':
        return health.network.dnsResolution === (condition.value === 'true');

      default:
        return false;
    }
  }

  private async createErrorDetection(serverId: string, patternId: string, health: SystemHealth): Promise<void> {
    const pattern = this.errorPatterns.get(patternId);
    if (!pattern) return;

    // Check if we already have an active detection for this pattern
    const existingDetections = this.errorDetections.get(serverId) || [];
    const activeDetection = existingDetections.find(d => 
      d.patternId === patternId && d.status !== 'resolved' && d.status !== 'ignored'
    );

    if (activeDetection) return; // Already detected and not resolved

    const detectionId = `detection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const detection: ErrorDetection = {
        id: detectionId,
        serverId,
        patternId,
        detectedAt: new Date(),
        severity: pattern.severity,
        message: `Detected: ${pattern.name}`,
        details: {
          patternName: pattern.name,
          category: pattern.category,
          health: health.overall
        },
        status: 'detected',
        autoFixAttempted: false,
        fixAttempts: 0,
        maxFixAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO error_detections (
          id, server_id, pattern_id, detected_at, severity, message,
          details, status, auto_fix_attempted, fix_attempts,
          max_fix_attempts, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        detection.id,
        detection.serverId,
        detection.patternId,
        detection.detectedAt,
        detection.severity,
        detection.message,
        JSON.stringify(detection.details),
        detection.status,
        detection.autoFixAttempted,
        detection.fixAttempts,
        detection.maxFixAttempts,
        detection.createdAt,
        detection.updatedAt
      ]);

      if (!this.errorDetections.has(serverId)) {
        this.errorDetections.set(serverId, []);
      }
      this.errorDetections.get(serverId)!.unshift(detection);

      this.logger.warn('auto-error-fix', `Error detected: ${pattern.name}`, {
        detectionId,
        serverId,
        severity: pattern.severity
      });

      this.emit('errorDetected', { detection, pattern });

      // Attempt auto-fix if enabled
      if (pattern.autoFix && !this.fixInProgress.has(serverId)) {
        await this.attemptAutoFix(detectionId);
      }

    } catch (error) {
      this.logger.error('auto-error-fix', `Failed to create error detection: ${pattern.name}`, error as Error);
    }
  }

  private async attemptAutoFix(detectionId: string): Promise<void> {
    const detection = this.findDetection(detectionId);
    if (!detection) return;

    const pattern = this.errorPatterns.get(detection.patternId);
    if (!pattern || !pattern.autoFix) return;

    if (this.fixInProgress.has(detection.serverId)) return; // Fix already in progress

    this.fixInProgress.add(detection.serverId);

    try {
      detection.status = 'fixing';
      detection.autoFixAttempted = true;
      detection.fixAttempts++;
      await this.updateDetection(detection);

      this.logger.info('auto-error-fix', `Attempting auto-fix: ${pattern.name}`, {
        detectionId,
        serverId: detection.serverId,
        attempt: detection.fixAttempts
      });

      let fixSuccessful = false;

      for (const command of pattern.fixCommands) {
        const success = await this.executeFixCommand(detection, command);
        if (success) {
          fixSuccessful = true;
          break;
        }
      }

      if (fixSuccessful) {
        detection.status = 'fixed';
        detection.resolvedAt = new Date();
        await this.updateDetection(detection);

        this.logger.info('auto-error-fix', `Auto-fix successful: ${pattern.name}`, {
          detectionId,
          serverId: detection.serverId
        });

        this.emit('errorFixed', { detection, pattern });

      } else {
        if (detection.fixAttempts >= detection.maxFixAttempts) {
          detection.status = 'failed';
          detection.errorMessage = 'Maximum fix attempts reached';
        } else {
          detection.status = 'detected';
          detection.nextFixAttempt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        }
        
        await this.updateDetection(detection);

        this.logger.warn('auto-error-fix', `Auto-fix failed: ${pattern.name}`, {
          detectionId,
          serverId: detection.serverId,
          attempts: detection.fixAttempts
        });

        this.emit('errorFixFailed', { detection, pattern });
      }

    } catch (error) {
      detection.status = 'failed';
      detection.errorMessage = error.message;
      await this.updateDetection(detection);

      this.logger.error('auto-error-fix', `Auto-fix error: ${pattern.name}`, error as Error);
      this.emit('errorFixError', { detection, pattern, error });

    } finally {
      this.fixInProgress.delete(detection.serverId);
    }
  }

  private async executeFixCommand(detection: ErrorDetection, command: FixCommand): Promise<boolean> {
    const attemptId = `attempt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const connection = await this.getSSHConnection(detection.serverId);
      if (!connection) {
        throw new Error('SSH connection not available');
      }

      const attempt: FixAttempt = {
        id: attemptId,
        detectionId: detection.id,
        patternId: detection.patternId,
        serverId: detection.serverId,
        commandId: command.id,
        status: 'pending',
        startTime: new Date(),
        createdAt: new Date()
      };

      // Store attempt
      await this.storeFixAttempt(attempt);

      attempt.status = 'running';
      await this.updateFixAttempt(attempt);

      // Execute command
      const result = await this.sshConnect.executeCommand(connection.id, command.command, command.timeout);

      attempt.status = result.success ? 'success' : 'failed';
      attempt.endTime = new Date();
      attempt.duration = attempt.endTime.getTime() - attempt.startTime.getTime();
      attempt.output = result.stdout;
      attempt.error = result.success ? undefined : result.stderr;

      await this.updateFixAttempt(attempt);

      // Verify fix if verification command provided
      if (result.success && command.verifyCommand) {
        const verifyResult = await this.sshConnect.executeCommand(connection.id, command.verifyCommand, 10000);
        if (!verifyResult.success) {
          attempt.status = 'failed';
          attempt.error = 'Verification failed';
          await this.updateFixAttempt(attempt);
          return false;
        }
      }

      // Add to memory
      if (!this.fixAttempts.has(detection.serverId)) {
        this.fixAttempts.set(detection.serverId, []);
      }
      this.fixAttempts.get(detection.serverId)!.unshift(attempt);

      this.logger.info('auto-error-fix', `Fix command executed: ${command.name}`, {
        attemptId,
        detectionId: detection.id,
        commandId: command.id,
        success: result.success
      });

      return result.success;

    } catch (error) {
      this.logger.error('auto-error-fix', `Fix command failed: ${command.name}`, error as Error);
      return false;
    }
  }

  private async storeFixAttempt(attempt: FixAttempt): Promise<void> {
    await this.database.query(`
      INSERT INTO fix_attempts (
        id, detection_id, pattern_id, server_id, command_id,
        status, start_time, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      attempt.id,
      attempt.detectionId,
      attempt.patternId,
      attempt.serverId,
      attempt.commandId,
      attempt.status,
      attempt.startTime,
      attempt.createdAt
    ]);
  }

  private async updateFixAttempt(attempt: FixAttempt): Promise<void> {
    await this.database.query(`
      UPDATE fix_attempts 
      SET status = $1, end_time = $2, duration = $3, output = $4, error = $5 
      WHERE id = $6
    `, [attempt.status, attempt.endTime, attempt.duration, attempt.output, attempt.error, attempt.id]);
  }

  private async updateDetection(detection: ErrorDetection): Promise<void> {
    await this.database.query(`
      UPDATE error_detections 
      SET status = $1, auto_fix_attempted = $2, fix_attempts = $3,
      next_fix_attempt = $4, resolved_at = $5, error_message = $6, updated_at = $7 
      WHERE id = $8
    `, [
      detection.status,
      detection.autoFixAttempted,
      detection.fixAttempts,
      detection.nextFixAttempt,
      detection.resolvedAt,
      detection.errorMessage,
      detection.updatedAt,
      detection.id
    ]);
  }

  private async checkScheduledFixes(serverId: string): Promise<void> {
    const detections = this.errorDetections.get(serverId) || [];
    const now = new Date();

    for (const detection of detections) {
      if (detection.status === 'detected' && 
          detection.nextFixAttempt && 
          detection.nextFixAttempt <= now &&
          !this.fixInProgress.has(serverId)) {
        
        await this.attemptAutoFix(detection.id);
      }
    }
  }

  private findDetection(detectionId: string): ErrorDetection | null {
    for (const detections of this.errorDetections.values()) {
      const detection = detections.find(d => d.id === detectionId);
      if (detection) return detection;
    }
    return null;
  }

  private async getSSHConnection(serverId: string): Promise<any> {
    const connections = await this.sshConnect.getConnectionsByUserId('system');
    return connections.find(c => c.serverId === serverId);
  }

  // Public API methods
  async createErrorPattern(pattern: Omit<ErrorPattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const patternId = `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const newPattern: ErrorPattern = {
        ...pattern,
        id: patternId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO error_patterns (
          id, name, description, category, severity, patterns,
          fix_commands, conditions, auto_fix, requires_restart,
          estimated_downtime, success_rate, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        newPattern.id,
        newPattern.name,
        newPattern.description,
        newPattern.category,
        newPattern.severity,
        JSON.stringify(newPattern.patterns),
        JSON.stringify(newPattern.fixCommands),
        JSON.stringify(newPattern.conditions),
        newPattern.autoFix,
        newPattern.requiresRestart,
        newPattern.estimatedDowntime,
        newPattern.successRate,
        newPattern.createdAt,
        newPattern.updatedAt
      ]);

      this.errorPatterns.set(patternId, newPattern);

      this.logger.info('auto-error-fix', `Error pattern created: ${newPattern.name}`, {
        patternId,
        category: newPattern.category,
        severity: newPattern.severity
      });

      this.emit('errorPatternCreated', newPattern);
      return patternId;

    } catch (error) {
      this.logger.error('auto-error-fix', `Failed to create error pattern: ${pattern.name}`, error as Error);
      throw error;
    }
  }

  async getErrorDetections(serverId?: string, status?: ErrorDetection['status']): Promise<ErrorDetection[]> {
    if (serverId) {
      const detections = this.errorDetections.get(serverId) || [];
      return status ? detections.filter(d => d.status === status) : detections;
    }

    const allDetections: ErrorDetection[] = [];
    for (const detections of this.errorDetections.values()) {
      allDetections.push(...detections);
    }
    return status ? allDetections.filter(d => d.status === status) : allDetections;
  }

  async getSystemHealth(serverId: string, timeRange?: { start: Date; end: Date }): Promise<SystemHealth | null> {
    return this.systemHealth.get(serverId) || null;
  }

  async getFixAttempts(serverId?: string): Promise<FixAttempt[]> {
    if (serverId) {
      return this.fixAttempts.get(serverId) || [];
    }

    const allAttempts: FixAttempt[] = [];
    for (const attempts of this.fixAttempts.values()) {
      allAttempts.push(...attempts);
    }
    return allAttempts;
  }

  async getErrorFixStats(): Promise<{
    totalPatterns: number;
    totalDetections: number;
    activeDetections: number;
    fixedDetections: number;
    failedDetections: number;
    totalFixAttempts: number;
    successfulFixes: number;
    overallSuccessRate: number;
  }> {
    const allDetections: ErrorDetection[] = [];
    const allAttempts: FixAttempt[] = [];
    
    for (const detections of this.errorDetections.values()) {
      allDetections.push(...detections);
    }
    
    for (const attempts of this.fixAttempts.values()) {
      allAttempts.push(...attempts);
    }

    const successfulFixes = allAttempts.filter(a => a.status === 'success').length;
    const overallSuccessRate = allAttempts.length > 0 ? (successfulFixes / allAttempts.length) * 100 : 0;

    return {
      totalPatterns: this.errorPatterns.size,
      totalDetections: allDetections.length,
      activeDetections: allDetections.filter(d => d.status === 'detected' || d.status === 'fixing').length,
      fixedDetections: allDetections.filter(d => d.status === 'fixed').length,
      failedDetections: allDetections.filter(d => d.status === 'failed').length,
      totalFixAttempts: allAttempts.length,
      successfulFixes,
      overallSuccessRate
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    errorPatternsCount: number;
    activeDetectionsCount: number;
    monitoringActive: number;
    fixesInProgress: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getErrorFixStats();
    
    if (stats.activeDetections > 50) {
      issues.push('High number of active error detections');
    }
    
    if (stats.overallSuccessRate < 80) {
      issues.push('Low auto-fix success rate');
    }

    return {
      healthy: issues.length === 0,
      errorPatternsCount: stats.totalPatterns,
      activeDetectionsCount: stats.activeDetections,
      monitoringActive: this.monitoringIntervals.size,
      fixesInProgress: this.fixInProgress.size,
      issues
    };
  }

  async destroy(): Promise<void> {
    // Stop all monitoring
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    
    this.monitoringIntervals.clear();
    
    this.logger.info('auto-error-fix', 'Auto error fix system shut down');
  }
}

export default UltraAutoErrorFix;
