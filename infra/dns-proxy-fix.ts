import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraSSHConnect } from './ssh-connect';
import { UltraServerProviders } from './server-providers';
import { UltraDomainSystem } from './domain-system';
import { UltraSSLSystem } from './ssl-system';
import { UltraLoadBalancer } from './load-balancer';

export interface DNSProxyIssue {
  id: string;
  domain: string;
  serverId: string;
  issueType: 'cloudflare_522' | 'cloudflare_526' | 'dns_propagation' | 'proxy_error' | 'ssl_mismatch' | 'origin_timeout' | 'connection_refused';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'diagnosing' | 'fixing' | 'fixed' | 'failed' | 'ignored';
  errorMessage: string;
  errorCode: string;
  detectedAt: Date;
  resolvedAt?: Date;
  fixAttempts: number;
  maxFixAttempts: number;
  nextFixAttempt?: Date;
  diagnostics: DiagnosticResult[];
  fixes: FixAttempt[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DiagnosticResult {
  id: string;
  issueId: string;
  test: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error';
  result: any;
  message: string;
  duration: number;
  timestamp: Date;
}

export interface FixAttempt {
  id: string;
  issueId: string;
  fixType: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  commands: string[];
  output?: string;
  error?: string;
  rollbackAvailable: boolean;
  rollbackExecuted: boolean;
  createdAt: Date;
}

export interface DNSProxyConfig {
  id: string;
  domain: string;
  serverId: string;
  proxyProvider: 'cloudflare' | 'aws' | 'azure' | 'custom';
  originProtocol: 'http' | 'https' | 'auto';
  originPort: number;
  sslMode: 'flexible' | 'full' | 'strict';
  caching: {
    enabled: boolean;
    ttl: number;
    bypassRules: string[];
  };
  security: {
    ddosProtection: boolean;
    wafEnabled: boolean;
    rateLimiting: boolean;
    rateLimitRpm: number;
  };
  performance: {
    minification: boolean;
    compression: boolean;
    brotli: boolean;
    webp: boolean;
  };
  monitoring: {
    enabled: boolean;
    alertThresholds: {
      responseTime: number;
      errorRate: number;
      availability: number;
    };
  };
  healthChecks: HealthCheck[];
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthCheck {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'HEAD';
  expectedStatus: number;
  timeout: number;
  interval: number;
  retries: number;
  active: boolean;
  lastCheck?: Date;
  lastStatus?: 'healthy' | 'unhealthy';
}

export interface ProxyMetrics {
  configId: string;
  timestamp: Date;
  requests: {
    total: number;
    cached: number;
    uncached: number;
    errors: number;
  };
  responseTime: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  bandwidth: {
    total: number;
    cached: number;
    uncached: number;
  };
  errorRate: number;
  availability: number;
  threatsBlocked: number;
  topCountries: Array<{
    country: string;
    requests: number;
    bandwidth: number;
  }>;
}

export class UltraDNSProxyFix extends EventEmitter {
  private static instance: UltraDNSProxyFix;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private sshConnect: UltraSSHConnect;
  private serverProviders: UltraServerProviders;
  private domainSystem: UltraDomainSystem;
  private sslSystem: UltraSSLSystem;
  private loadBalancer: UltraLoadBalancer;
  private issues: Map<string, DNSProxyIssue[]> = new Map();
  private configs: Map<string, DNSProxyConfig> = new Map();
  private metrics: Map<string, ProxyMetrics[]> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private fixInProgress: Set<string> = new Set();

  static getInstance(): UltraDNSProxyFix {
    if (!UltraDNSProxyFix.instance) {
      UltraDNSProxyFix.instance = new UltraDNSProxyFix();
    }
    return UltraDNSProxyFix.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.sshConnect = UltraSSHConnect.getInstance();
    this.serverProviders = UltraServerProviders.getInstance();
    this.domainSystem = UltraDomainSystem.getInstance();
    this.sslSystem = UltraSSLSystem.getInstance();
    this.loadBalancer = UltraLoadBalancer.getInstance();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize database tables
      await this.initializeDatabase();
      
      // Load existing issues and configs
      await this.loadIssues();
      await this.loadConfigs();
      await this.loadMetrics();
      
      // Start monitoring for all configs
      await this.startAllMonitoring();
      
      // Start health checks
      await this.startAllHealthChecks();
      
      this.logger.info('dns-proxy-fix', 'DNS and proxy fix system initialized', {
        issuesCount: Array.from(this.issues.values()).reduce((sum, issues) => sum + issues.length, 0),
        configsCount: this.configs.size,
        monitoringActive: this.monitoringIntervals.size,
        healthChecksActive: this.healthCheckIntervals.size
      });

    } catch (error) {
      this.logger.error('dns-proxy-fix', 'Failed to initialize DNS proxy fix system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS dns_proxy_issues (
        id VARCHAR(255) PRIMARY KEY,
        domain VARCHAR(255) NOT NULL,
        server_id VARCHAR(255) NOT NULL,
        issue_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        error_message TEXT NOT NULL,
        error_code VARCHAR(50),
        detected_at TIMESTAMP NOT NULL,
        resolved_at TIMESTAMP,
        fix_attempts INTEGER DEFAULT 0,
        max_fix_attempts INTEGER DEFAULT 3,
        next_fix_attempt TIMESTAMP,
        diagnostics JSONB,
        fixes JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS dns_proxy_configs (
        id VARCHAR(255) PRIMARY KEY,
        domain VARCHAR(255) NOT NULL,
        server_id VARCHAR(255) NOT NULL,
        proxy_provider VARCHAR(20) NOT NULL,
        origin_protocol VARCHAR(20) NOT NULL,
        origin_port INTEGER NOT NULL,
        ssl_mode VARCHAR(20) NOT NULL,
        caching JSONB NOT NULL,
        security JSONB NOT NULL,
        performance JSONB NOT NULL,
        monitoring JSONB NOT NULL,
        health_checks JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS proxy_metrics (
        id SERIAL PRIMARY KEY,
        config_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        requests JSONB NOT NULL,
        response_time JSONB NOT NULL,
        bandwidth JSONB NOT NULL,
        error_rate DECIMAL(5,2),
        availability DECIMAL(5,2),
        threats_blocked INTEGER,
        top_countries JSONB
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS diagnostic_results (
        id VARCHAR(255) PRIMARY KEY,
        issue_id VARCHAR(255) NOT NULL,
        test VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        result JSONB,
        message TEXT NOT NULL,
        duration INTEGER,
        timestamp TIMESTAMP NOT NULL
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS fix_attempts (
        id VARCHAR(255) PRIMARY KEY,
        issue_id VARCHAR(255) NOT NULL,
        fix_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTEGER,
        commands JSONB,
        output TEXT,
        error TEXT,
        rollback_available BOOLEAN DEFAULT FALSE,
        rollback_executed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_dns_proxy_issues_domain ON dns_proxy_issues(domain)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_dns_proxy_issues_status ON dns_proxy_issues(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_dns_proxy_configs_domain ON dns_proxy_configs(domain)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_proxy_metrics_config_id_timestamp ON proxy_metrics(config_id, timestamp)');
  }

  private async loadIssues(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM dns_proxy_issues ORDER BY detected_at DESC');
      
      for (const row of rows) {
        const issue: DNSProxyIssue = {
          id: row.id,
          domain: row.domain,
          serverId: row.server_id,
          issueType: row.issue_type,
          severity: row.severity,
          status: row.status,
          errorMessage: row.error_message,
          errorCode: row.error_code,
          detectedAt: row.detected_at,
          resolvedAt: row.resolved_at,
          fixAttempts: row.fix_attempts,
          maxFixAttempts: row.max_fix_attempts,
          nextFixAttempt: row.next_fix_attempt,
          diagnostics: row.diagnostics || [],
          fixes: row.fixes || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.issues.has(issue.domain)) {
          this.issues.set(issue.domain, []);
        }
        this.issues.get(issue.domain)!.push(issue);
      }
      
      this.logger.info('dns-proxy-fix', `Loaded ${Array.from(this.issues.values()).reduce((sum, issues) => sum + issues.length, 0)} DNS proxy issues`);
    } catch (error) {
      this.logger.error('dns-proxy-fix', 'Failed to load DNS proxy issues', error as Error);
    }
  }

  private async loadConfigs(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM dns_proxy_configs');
      
      for (const row of rows) {
        const config: DNSProxyConfig = {
          id: row.id,
          domain: row.domain,
          serverId: row.server_id,
          proxyProvider: row.proxy_provider,
          originProtocol: row.origin_protocol,
          originPort: row.origin_port,
          sslMode: row.ssl_mode,
          caching: row.caching,
          security: row.security,
          performance: row.performance,
          monitoring: row.monitoring,
          healthChecks: row.health_checks || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.configs.set(config.id, config);
      }
      
      this.logger.info('dns-proxy-fix', `Loaded ${this.configs.size} DNS proxy configs`);
    } catch (error) {
      this.logger.error('dns-proxy-fix', 'Failed to load DNS proxy configs', error as Error);
    }
  }

  private async loadMetrics(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM proxy_metrics ORDER BY timestamp DESC LIMIT 1000');
      
      for (const row of rows) {
        const metrics: ProxyMetrics = {
          configId: row.config_id,
          timestamp: row.timestamp,
          requests: row.requests,
          responseTime: row.response_time,
          bandwidth: row.bandwidth,
          errorRate: row.error_rate,
          availability: row.availability,
          threatsBlocked: row.threats_blocked,
          topCountries: row.top_countries || []
        };
        
        if (!this.metrics.has(metrics.configId)) {
          this.metrics.set(metrics.configId, []);
        }
        this.metrics.get(metrics.configId)!.push(metrics);
      }
      
      this.logger.info('dns-proxy-fix', `Loaded ${Array.from(this.metrics.values()).reduce((sum, metrics) => sum + metrics.length, 0)} proxy metrics`);
    } catch (error) {
      this.logger.error('dns-proxy-fix', 'Failed to load proxy metrics', error as Error);
    }
  }

  private async startAllMonitoring(): Promise<void> {
    for (const [configId, config] of this.configs.entries()) {
      if (config.monitoring.enabled) {
        await this.startMonitoring(configId);
      }
    }
  }

  private async startAllHealthChecks(): Promise<void> {
    for (const [configId, config] of this.configs.entries()) {
      for (const healthCheck of config.healthChecks) {
        if (healthCheck.active) {
          await this.startHealthCheck(configId, healthCheck.id);
        }
      }
    }
  }

  async createConfig(config: {
    domain: string;
    serverId: string;
    proxyProvider: DNSProxyConfig['proxyProvider'];
    originProtocol?: DNSProxyConfig['originProtocol'];
    originPort?: number;
    sslMode?: DNSProxyConfig['sslMode'];
    caching?: Partial<DNSProxyConfig['caching']>;
    security?: Partial<DNSProxyConfig['security']>;
    performance?: Partial<DNSProxyConfig['performance']>;
    monitoring?: Partial<DNSProxyConfig['monitoring']>;
  }): Promise<string> {
    const configId = `config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const newConfig: DNSProxyConfig = {
        id: configId,
        domain: config.domain,
        serverId: config.serverId,
        proxyProvider: config.proxyProvider,
        originProtocol: config.originProtocol || 'https',
        originPort: config.originPort || 443,
        sslMode: config.sslMode || 'full',
        caching: {
          enabled: true,
          ttl: 3600,
          bypassRules: [],
          ...config.caching
        },
        security: {
          ddosProtection: true,
          wafEnabled: true,
          rateLimiting: false,
          rateLimitRpm: 1000,
          ...config.security
        },
        performance: {
          minification: true,
          compression: true,
          brotli: true,
          webp: true,
          ...config.performance
        },
        monitoring: {
          enabled: true,
          alertThresholds: {
            responseTime: 5000,
            errorRate: 5,
            availability: 99.9,
            ...config.monitoring?.alertThresholds
          },
          ...config.monitoring
        },
        healthChecks: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO dns_proxy_configs (
          id, domain, server_id, proxy_provider, origin_protocol, origin_port,
          ssl_mode, caching, security, performance, monitoring,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        newConfig.id,
        newConfig.domain,
        newConfig.serverId,
        newConfig.proxyProvider,
        newConfig.originProtocol,
        newConfig.originPort,
        newConfig.sslMode,
        JSON.stringify(newConfig.caching),
        JSON.stringify(newConfig.security),
        JSON.stringify(newConfig.performance),
        JSON.stringify(newConfig.monitoring),
        newConfig.createdAt,
        newConfig.updatedAt
      ]);

      this.configs.set(configId, newConfig);

      // Start monitoring
      if (newConfig.monitoring.enabled) {
        await this.startMonitoring(configId);
      }

      this.logger.info('dns-proxy-fix', `DNS proxy config created: ${newConfig.domain}`, {
        configId,
        domain: config.domain,
        proxyProvider: config.proxyProvider
      });

      this.emit('configCreated', newConfig);
      return configId;

    } catch (error) {
      this.logger.error('dns-proxy-fix', `Failed to create DNS proxy config: ${config.domain}`, error as Error);
      throw error;
    }
  }

  async detectIssue(config: {
    domain: string;
    serverId: string;
    issueType: DNSProxyIssue['issueType'];
    errorMessage: string;
    errorCode?: string;
    severity?: DNSProxyIssue['severity'];
  }): Promise<string> {
    const issueId = `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const issue: DNSProxyIssue = {
        id: issueId,
        domain: config.domain,
        serverId: config.serverId,
        issueType: config.issueType,
        severity: config.severity || this.getDefaultSeverity(config.issueType),
        status: 'detected',
        errorMessage: config.errorMessage,
        errorCode: config.errorCode,
        detectedAt: new Date(),
        fixAttempts: 0,
        maxFixAttempts: 3,
        diagnostics: [],
        fixes: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO dns_proxy_issues (
          id, domain, server_id, issue_type, severity, status,
          error_message, error_code, detected_at, fix_attempts,
          max_fix_attempts, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        issue.id,
        issue.domain,
        issue.serverId,
        issue.issueType,
        issue.severity,
        issue.status,
        issue.errorMessage,
        issue.errorCode,
        issue.detectedAt,
        issue.fixAttempts,
        issue.maxFixAttempts,
        issue.createdAt,
        issue.updatedAt
      ]);

      if (!this.issues.has(issue.domain)) {
        this.issues.set(issue.domain, []);
      }
      this.issues.get(issue.domain)!.unshift(issue);

      // Start diagnosis
      await this.diagnoseIssue(issueId);

      this.logger.warn('dns-proxy-fix', `DNS proxy issue detected: ${config.issueType}`, {
        issueId,
        domain: config.domain,
        serverId: config.serverId,
        errorMessage: config.errorMessage
      });

      this.emit('issueDetected', issue);
      return issueId;

    } catch (error) {
      this.logger.error('dns-proxy-fix', `Failed to create DNS proxy issue: ${config.issueType}`, error as Error);
      throw error;
    }
  }

  private getDefaultSeverity(issueType: DNSProxyIssue['issueType']): DNSProxyIssue['severity'] {
    const severityMap: Record<DNSProxyIssue['issueType'], DNSProxyIssue['severity']> = {
      'cloudflare_522': 'critical',
      'cloudflare_526': 'high',
      'dns_propagation': 'medium',
      'proxy_error': 'high',
      'ssl_mismatch': 'high',
      'origin_timeout': 'medium',
      'connection_refused': 'critical'
    };
    return severityMap[issueType] || 'medium';
  }

  private async diagnoseIssue(issueId: string): Promise<void> {
    const issue = this.findIssue(issueId);
    if (!issue) return;

    try {
      issue.status = 'diagnosing';
      await this.updateIssue(issue);

      const diagnostics = await this.runDiagnostics(issue);
      issue.diagnostics = diagnostics;

      // Determine if auto-fix should be attempted
      const shouldAutoFix = await this.shouldAttemptAutoFix(issue);
      
      if (shouldAutoFix && !this.fixInProgress.has(issue.domain)) {
        await this.attemptFix(issueId);
      } else {
        issue.status = 'detected';
        await this.updateIssue(issue);
      }

    } catch (error) {
      issue.status = 'detected';
      issue.errorMessage += ` | Diagnosis failed: ${error.message}`;
      await this.updateIssue(issue);
      this.logger.error('dns-proxy-fix', `Issue diagnosis failed: ${issueId}`, error as Error);
    }
  }

  private async runDiagnostics(issue: DNSProxyIssue): Promise<DiagnosticResult[]> {
    const diagnostics: DiagnosticResult[] = [];
    
    // DNS resolution test
    diagnostics.push(await this.runDiagnostic(issue.id, 'dns_resolution', async () => {
      const connection = await this.getSSHConnection(issue.serverId);
      if (!connection) throw new Error('SSH connection not available');
      
      const result = await this.sshConnect.executeCommand(connection.id, `nslookup ${issue.domain}`, 10000);
      return {
        success: result.success,
        output: result.stdout,
        error: result.stderr
      };
    }));

    // Origin connectivity test
    diagnostics.push(await this.runDiagnostic(issue.id, 'origin_connectivity', async () => {
      const config = Array.from(this.configs.values()).find(c => c.domain === issue.domain);
      if (!config) throw new Error('Config not found');
      
      const originUrl = `${config.originProtocol}://${issue.domain}:${config.originPort}`;
      const connection = await this.getSSHConnection(issue.serverId);
      if (!connection) throw new Error('SSH connection not available');
      
      const result = await this.sshConnect.executeCommand(connection.id, `curl -I --connect-timeout 10 ${originUrl}`, 15000);
      return {
        success: result.success,
        output: result.stdout,
        error: result.stderr,
        statusCode: this.extractStatusCode(result.stdout)
      };
    }));

    // SSL certificate test
    diagnostics.push(await this.runDiagnostic(issue.id, 'ssl_certificate', async () => {
      const connection = await this.getSSHConnection(issue.serverId);
      if (!connection) throw new Error('SSH connection not available');
      
      const result = await this.sshConnect.executeCommand(connection.id, `openssl s_client -connect ${issue.domain}:443 -servername ${issue.domain} < /dev/null 2>/dev/null | openssl x509 -noout -dates`, 10000);
      return {
        success: result.success,
        output: result.stdout,
        error: result.stderr
      };
    }));

    // Port availability test
    diagnostics.push(await this.runDiagnostic(issue.id, 'port_availability', async () => {
      const config = Array.from(this.configs.values()).find(c => c.domain === issue.domain);
      if (!config) throw new Error('Config not found');
      
      const connection = await this.getSSHConnection(issue.serverId);
      if (!connection) throw new Error('SSH connection not available');
      
      const result = await this.sshConnect.executeCommand(connection.id, `nc -zv ${issue.domain} ${config.originPort}`, 10000);
      return {
        success: result.success,
        output: result.stdout,
        error: result.stderr
      };
    }));

    return diagnostics;
  }

  private async runDiagnostic(issueId: string, testName: string, testFn: () => Promise<any>): Promise<DiagnosticResult> {
    const diagnosticId = `diag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    try {
      const result: DiagnosticResult = {
        id: diagnosticId,
        issueId,
        test: testName,
        status: 'running',
        result: null,
        message: 'Running diagnostic...',
        duration: 0,
        timestamp: new Date()
      };

      // Store initial state
      await this.storeDiagnosticResult(result);

      // Run the test
      const testResult = await testFn();
      const duration = Date.now() - startTime;

      result.status = testResult.success ? 'passed' : 'failed';
      result.result = testResult;
      result.message = testResult.success ? 'Test passed' : `Test failed: ${testResult.error || 'Unknown error'}`;
      result.duration = duration;

      await this.updateDiagnosticResult(result);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const result: DiagnosticResult = {
        id: diagnosticId,
        issueId,
        test: testName,
        status: 'error',
        result: null,
        message: `Diagnostic error: ${error.message}`,
        duration,
        timestamp: new Date()
      };

      await this.storeDiagnosticResult(result);
      return result;
    }
  }

  private async storeDiagnosticResult(result: DiagnosticResult): Promise<void> {
    await this.database.query(`
      INSERT INTO diagnostic_results (id, issue_id, test, status, result, message, duration, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [result.id, result.issueId, result.test, result.status, JSON.stringify(result.result), result.message, result.duration, result.timestamp]);
  }

  private async updateDiagnosticResult(result: DiagnosticResult): Promise<void> {
    await this.database.query(`
      UPDATE diagnostic_results 
      SET status = $1, result = $2, message = $3, duration = $4 
      WHERE id = $5
    `, [result.status, JSON.stringify(result.result), result.message, result.duration, result.id]);
  }

  private extractStatusCode(output: string): number {
    const match = output.match(/HTTP\/\d\.\d (\d{3})/);
    return match ? parseInt(match[1]) : 0;
  }

  private async shouldAttemptAutoFix(issue: DNSProxyIssue): Promise<boolean> {
    // Check if diagnostics indicate a fixable issue
    const dnsResult = issue.diagnostics.find(d => d.test === 'dns_resolution');
    const connectivityResult = issue.diagnostics.find(d => d.test === 'origin_connectivity');
    const sslResult = issue.diagnostics.find(d => d.test === 'ssl_certificate');
    const portResult = issue.diagnostics.find(d => d.test === 'port_availability');

    switch (issue.issueType) {
      case 'cloudflare_522':
        // 522 = Connection timed out - fixable if origin is reachable
        return connectivityResult?.status === 'passed' && portResult?.status === 'passed';
      
      case 'cloudflare_526':
        // 526 = Invalid SSL certificate - fixable if SSL can be renewed
        return sslResult?.status === 'failed';
      
      case 'dns_propagation':
        // DNS propagation issues - fixable if DNS can be updated
        return dnsResult?.status === 'passed';
      
      case 'ssl_mismatch':
        // SSL mismatch - fixable if certificate can be renewed
        return sslResult?.status === 'failed';
      
      case 'origin_timeout':
        // Origin timeout - fixable if service can be restarted
        return connectivityResult?.status === 'failed';
      
      case 'connection_refused':
        // Connection refused - fixable if service can be restarted
        return portResult?.status === 'failed';
      
      default:
        return false;
    }
  }

  private async attemptFix(issueId: string): Promise<void> {
    const issue = this.findIssue(issueId);
    if (!issue) return;

    if (this.fixInProgress.has(issue.domain)) return; // Fix already in progress

    this.fixInProgress.add(issue.domain);

    try {
      issue.status = 'fixing';
      issue.fixAttempts++;
      await this.updateIssue(issue);

      this.logger.info('dns-proxy-fix', `Attempting fix for issue: ${issue.issueType}`, {
        issueId,
        domain: issue.domain,
        attempt: issue.fixAttempts
      });

      let fixSuccessful = false;

      switch (issue.issueType) {
        case 'cloudflare_522':
          fixSuccessful = await this.fixCloudflare522(issue);
          break;
        case 'cloudflare_526':
          fixSuccessful = await this.fixCloudflare526(issue);
          break;
        case 'dns_propagation':
          fixSuccessful = await this.fixDNSPropagation(issue);
          break;
        case 'ssl_mismatch':
          fixSuccessful = await this.fixSSLMismatch(issue);
          break;
        case 'origin_timeout':
        case 'connection_refused':
          fixSuccessful = await this.fixOriginConnection(issue);
          break;
      }

      if (fixSuccessful) {
        issue.status = 'fixed';
        issue.resolvedAt = new Date();
        await this.updateIssue(issue);

        this.logger.info('dns-proxy-fix', `Fix successful for issue: ${issue.issueType}`, {
          issueId,
          domain: issue.domain
        });

        this.emit('issueFixed', issue);

      } else {
        if (issue.fixAttempts >= issue.maxFixAttempts) {
          issue.status = 'failed';
          issue.errorMessage += ' | Maximum fix attempts reached';
        } else {
          issue.status = 'detected';
          issue.nextFixAttempt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        }
        
        await this.updateIssue(issue);

        this.logger.warn('dns-proxy-fix', `Fix failed for issue: ${issue.issueType}`, {
          issueId,
          domain: issue.domain,
          attempts: issue.fixAttempts
        });

        this.emit('issueFixFailed', issue);
      }

    } catch (error) {
      issue.status = 'failed';
      issue.errorMessage += ` | Fix error: ${error.message}`;
      await this.updateIssue(issue);

      this.logger.error('dns-proxy-fix', `Fix error for issue: ${issue.issueType}`, error as Error);
      this.emit('issueFixError', { issue, error });

    } finally {
      this.fixInProgress.delete(issue.domain);
    }
  }

  private async fixCloudflare522(issue: DNSProxyIssue): Promise<boolean> {
    const attemptId = `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const connection = await this.getSSHConnection(issue.serverId);
      if (!connection) throw new Error('SSH connection not available');

      const fixAttempt: FixAttempt = {
        id: attemptId,
        issueId: issue.id,
        fixType: 'restart_web_services',
        description: 'Restart web services to fix 522 error',
        status: 'pending',
        startTime: new Date(),
        commands: ['systemctl restart nginx', 'systemctl restart apache2'],
        rollbackAvailable: true,
        rollbackExecuted: false,
        createdAt: new Date()
      };

      // Store attempt
      await this.storeFixAttempt(fixAttempt);

      fixAttempt.status = 'running';
      await this.updateFixAttempt(fixAttempt);

      // Restart web services
      const nginxResult = await this.sshConnect.executeCommand(connection.id, 'sudo systemctl restart nginx', 30000);
      const apacheResult = await this.sshConnect.executeCommand(connection.id, 'sudo systemctl restart apache2 || true', 30000);

      fixAttempt.status = (nginxResult.success || apacheResult.success) ? 'success' : 'failed';
      fixAttempt.endTime = new Date();
      fixAttempt.duration = fixAttempt.endTime.getTime() - fixAttempt.startTime.getTime();
      fixAttempt.output = `Nginx: ${nginxResult.success ? 'success' : 'failed'}, Apache: ${apacheResult.success ? 'success' : 'not found'}`;

      await this.updateFixAttempt(fixAttempt);

      // Add to issue
      issue.fixes.push(fixAttempt);

      return nginxResult.success || apacheResult.success;

    } catch (error) {
      this.logger.error('dns-proxy-fix', `Cloudflare 522 fix failed`, error as Error);
      return false;
    }
  }

  private async fixCloudflare526(issue: DNSProxyIssue): Promise<boolean> {
    const attemptId = `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const fixAttempt: FixAttempt = {
        id: attemptId,
        issueId: issue.id,
        fixType: 'renew_ssl_certificate',
        description: 'Renew SSL certificate to fix 526 error',
        status: 'pending',
        startTime: new Date(),
        commands: ['certbot renew'],
        rollbackAvailable: false,
        rollbackExecuted: false,
        createdAt: new Date()
      };

      // Store attempt
      await this.storeFixAttempt(fixAttempt);

      fixAttempt.status = 'running';
      await this.updateFixAttempt(fixAttempt);

      // Renew SSL certificate
      const renewed = await this.sslSystem.renewCertificate(issue.domain);

      fixAttempt.status = renewed ? 'success' : 'failed';
      fixAttempt.endTime = new Date();
      fixAttempt.duration = fixAttempt.endTime.getTime() - fixAttempt.startTime.getTime();
      fixAttempt.output = renewed ? 'Certificate renewed successfully' : 'Certificate renewal failed';

      await this.updateFixAttempt(fixAttempt);

      // Add to issue
      issue.fixes.push(fixAttempt);

      return renewed;

    } catch (error) {
      this.logger.error('dns-proxy-fix', `Cloudflare 526 fix failed`, error as Error);
      return false;
    }
  }

  private async fixDNSPropagation(issue: DNSProxyIssue): Promise<boolean> {
    const attemptId = `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const fixAttempt: FixAttempt = {
        id: attemptId,
        issueId: issue.id,
        fixType: 'flush_dns_cache',
        description: 'Flush DNS cache to fix propagation issues',
        status: 'pending',
        startTime: new Date(),
        commands: ['systemd-resolve --flush-caches'],
        rollbackAvailable: false,
        rollbackExecuted: false,
        createdAt: new Date()
      };

      // Store attempt
      await this.storeFixAttempt(fixAttempt);

      fixAttempt.status = 'running';
      await this.updateFixAttempt(fixAttempt);

      // Update DNS records
      const updated = await this.domainSystem.updateDNSRecord(issue.domain, 'A', 'auto');

      fixAttempt.status = updated ? 'success' : 'failed';
      fixAttempt.endTime = new Date();
      fixAttempt.duration = fixAttempt.endTime.getTime() - fixAttempt.startTime.getTime();
      fixAttempt.output = updated ? 'DNS records updated' : 'DNS update failed';

      await this.updateFixAttempt(fixAttempt);

      // Add to issue
      issue.fixes.push(fixAttempt);

      return updated;

    } catch (error) {
      this.logger.error('dns-proxy-fix', `DNS propagation fix failed`, error as Error);
      return false;
    }
  }

  private async fixSSLMismatch(issue: DNSProxyIssue): Promise<boolean> {
    // Similar to Cloudflare 526 fix
    return await this.fixCloudflare526(issue);
  }

  private async fixOriginConnection(issue: DNSProxyIssue): Promise<boolean> {
    const attemptId = `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const connection = await this.getSSHConnection(issue.serverId);
      if (!connection) throw new Error('SSH connection not available');

      const fixAttempt: FixAttempt = {
        id: attemptId,
        issueId: issue.id,
        fixType: 'restart_origin_service',
        description: 'Restart origin service to fix connection issues',
        status: 'pending',
        startTime: new Date(),
        commands: ['systemctl restart nginx', 'systemctl restart apache2', 'systemctl restart nodejs'],
        rollbackAvailable: true,
        rollbackExecuted: false,
        createdAt: new Date()
      };

      // Store attempt
      await this.storeFixAttempt(fixAttempt);

      fixAttempt.status = 'running';
      await this.updateFixAttempt(fixAttempt);

      // Restart services
      const services = ['nginx', 'apache2', 'nodejs'];
      let anySuccess = false;

      for (const service of services) {
        const result = await this.sshConnect.executeCommand(connection.id, `sudo systemctl restart ${service} || true`, 30000);
        if (result.success) anySuccess = true;
      }

      fixAttempt.status = anySuccess ? 'success' : 'failed';
      fixAttempt.endTime = new Date();
      fixAttempt.duration = fixAttempt.endTime.getTime() - fixAttempt.startTime.getTime();
      fixAttempt.output = anySuccess ? 'Services restarted successfully' : 'All service restarts failed';

      await this.updateFixAttempt(fixAttempt);

      // Add to issue
      issue.fixes.push(fixAttempt);

      return anySuccess;

    } catch (error) {
      this.logger.error('dns-proxy-fix', `Origin connection fix failed`, error as Error);
      return false;
    }
  }

  private async storeFixAttempt(attempt: FixAttempt): Promise<void> {
    await this.database.query(`
      INSERT INTO fix_attempts (
        id, issue_id, fix_type, description, status, start_time,
        commands, rollback_available, rollback_executed, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      attempt.id,
      attempt.issueId,
      attempt.fixType,
      attempt.description,
      attempt.status,
      attempt.startTime,
      JSON.stringify(attempt.commands),
      attempt.rollbackAvailable,
      attempt.rollbackExecuted,
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

  private async startMonitoring(configId: string): Promise<void> {
    const config = this.configs.get(configId);
    if (!config || !config.monitoring.enabled) return;

    // Stop existing monitoring
    await this.stopMonitoring(configId);

    const interval = setInterval(async () => {
      await this.collectMetrics(configId);
    }, 300000); // 5 minutes

    this.monitoringIntervals.set(configId, interval);
    
    // Collect initial metrics
    await this.collectMetrics(configId);
    
    this.logger.info('dns-proxy-fix', `Started monitoring for config: ${config.domain}`, {
      configId
    });
  }

  private async stopMonitoring(configId: string): Promise<void> {
    const interval = this.monitoringIntervals.get(configId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(configId);
    }
  }

  private async startHealthCheck(configId: string, healthCheckId: string): Promise<void> {
    const config = this.configs.get(configId);
    if (!config) return;

    const healthCheck = config.healthChecks.find(hc => hc.id === healthCheckId);
    if (!healthCheck || !healthCheck.active) return;

    const intervalKey = `${configId}-${healthCheckId}`;
    const interval = setInterval(async () => {
      await this.performHealthCheck(configId, healthCheckId);
    }, healthCheck.interval * 1000);

    this.healthCheckIntervals.set(intervalKey, interval);
    
    // Perform initial health check
    await this.performHealthCheck(configId, healthCheckId);
  }

  private async performHealthCheck(configId: string, healthCheckId: string): Promise<void> {
    const config = this.configs.get(configId);
    if (!config) return;

    const healthCheck = config.healthChecks.find(hc => hc.id === healthCheckId);
    if (!healthCheck) return;

    try {
      const connection = await this.getSSHConnection(config.serverId);
      if (!connection) return;

      const url = `${config.originProtocol}://${config.domain}:${config.originPort}${healthCheck.path}`;
      const command = `curl -o /dev/null -s -w "%{http_code}" --connect-timeout ${healthCheck.timeout} -X ${healthCheck.method} ${url}`;
      
      const result = await this.sshConnect.executeCommand(connection.id, command, healthCheck.timeout * 1000);
      const statusCode = parseInt(result.stdout.trim()) || 0;
      
      healthCheck.lastCheck = new Date();
      healthCheck.lastStatus = statusCode === healthCheck.expectedStatus ? 'healthy' : 'unhealthy';

      // Emit health check event
      this.emit('healthCheckCompleted', {
        configId,
        healthCheckId,
        status: healthCheck.lastStatus,
        statusCode,
        expectedStatus: healthCheck.expectedStatus
      });

    } catch (error) {
      healthCheck.lastCheck = new Date();
      healthCheck.lastStatus = 'unhealthy';
      
      this.emit('healthCheckFailed', {
        configId,
        healthCheckId,
        error: error.message
      });
    }
  }

  private async collectMetrics(configId: string): Promise<void> {
    const config = this.configs.get(configId);
    if (!config) return;

    try {
      // This would integrate with the proxy provider's API to get actual metrics
      // For now, simulate metrics
      const metrics: ProxyMetrics = {
        configId,
        timestamp: new Date(),
        requests: {
          total: Math.floor(Math.random() * 10000) + 1000,
          cached: Math.floor(Math.random() * 8000) + 500,
          uncached: Math.floor(Math.random() * 2000) + 100,
          errors: Math.floor(Math.random() * 100)
        },
        responseTime: {
          average: Math.random() * 1000 + 100,
          p50: Math.random() * 500 + 50,
          p95: Math.random() * 2000 + 200,
          p99: Math.random() * 3000 + 300
        },
        bandwidth: {
          total: Math.floor(Math.random() * 1000000) + 100000,
          cached: Math.floor(Math.random() * 800000) + 50000,
          uncached: Math.floor(Math.random() * 200000) + 10000
        },
        errorRate: Math.random() * 5,
        availability: 99 + Math.random(),
        threatsBlocked: Math.floor(Math.random() * 100),
        topCountries: [
          { country: 'US', requests: Math.floor(Math.random() * 5000), bandwidth: 0 },
          { country: 'GB', requests: Math.floor(Math.random() * 2000), bandwidth: 0 },
          { country: 'DE', requests: Math.floor(Math.random() * 1000), bandwidth: 0 }
        ]
      };

      // Store metrics
      await this.database.query(`
        INSERT INTO proxy_metrics (
          config_id, timestamp, requests, response_time, bandwidth,
          error_rate, availability, threats_blocked, top_countries
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        metrics.configId,
        metrics.timestamp,
        JSON.stringify(metrics.requests),
        JSON.stringify(metrics.responseTime),
        JSON.stringify(metrics.bandwidth),
        metrics.errorRate,
        metrics.availability,
        metrics.threatsBlocked,
        JSON.stringify(metrics.topCountries)
      ]);

      // Store in memory
      if (!this.metrics.has(configId)) {
        this.metrics.set(configId, []);
      }
      this.metrics.get(configId)!.push(metrics);

      // Check alert thresholds
      await this.checkAlertThresholds(config, metrics);

    } catch (error) {
      this.logger.error('dns-proxy-fix', `Failed to collect metrics for config: ${configId}`, error as Error);
    }
  }

  private async checkAlertThresholds(config: DNSProxyConfig, metrics: ProxyMetrics): Promise<void> {
    const thresholds = config.monitoring.alertThresholds;
    
    if (metrics.responseTime.average > thresholds.responseTime) {
      this.emit('alert', {
        configId: config.id,
        domain: config.domain,
        type: 'response_time_high',
        value: metrics.responseTime.average,
        threshold: thresholds.responseTime
      });
    }
    
    if (metrics.errorRate > thresholds.errorRate) {
      this.emit('alert', {
        configId: config.id,
        domain: config.domain,
        type: 'error_rate_high',
        value: metrics.errorRate,
        threshold: thresholds.errorRate
      });
    }
    
    if (metrics.availability < thresholds.availability) {
      this.emit('alert', {
        configId: config.id,
        domain: config.domain,
        type: 'availability_low',
        value: metrics.availability,
        threshold: thresholds.availability
      });
    }
  }

  private findIssue(issueId: string): DNSProxyIssue | null {
    for (const issues of this.issues.values()) {
      const issue = issues.find(i => i.id === issueId);
      if (issue) return issue;
    }
    return null;
  }

  private async updateIssue(issue: DNSProxyIssue): Promise<void> {
    await this.database.query(`
      UPDATE dns_proxy_issues 
      SET status = $1, fix_attempts = $2, next_fix_attempt = $3,
      resolved_at = $4, error_message = $5, diagnostics = $6,
      fixes = $7, updated_at = $8 
      WHERE id = $9
    `, [
      issue.status,
      issue.fixAttempts,
      issue.nextFixAttempt,
      issue.resolvedAt,
      issue.errorMessage,
      JSON.stringify(issue.diagnostics),
      JSON.stringify(issue.fixes),
      issue.updatedAt,
      issue.id
    ]);
  }

  private async getSSHConnection(serverId: string): Promise<any> {
    const connections = await this.sshConnect.getConnectionsByUserId('system');
    return connections.find(c => c.serverId === serverId);
  }

  // Public API methods
  async getConfig(configId: string): Promise<DNSProxyConfig | null> {
    return this.configs.get(configId) || null;
  }

  async getConfigsByDomain(domain: string): Promise<DNSProxyConfig[]> {
    return Array.from(this.configs.values()).filter(c => c.domain === domain);
  }

  async getIssues(domain?: string, status?: DNSProxyIssue['status']): Promise<DNSProxyIssue[]> {
    if (domain) {
      const issues = this.issues.get(domain) || [];
      return status ? issues.filter(i => i.status === status) : issues;
    }

    const allIssues: DNSProxyIssue[] = [];
    for (const issues of this.issues.values()) {
      allIssues.push(...issues);
    }
    return status ? allIssues.filter(i => i.status === status) : allIssues;
  }

  async addHealthCheck(configId: string, healthCheck: Omit<HealthCheck, 'id'>): Promise<string> {
    const config = this.configs.get(configId);
    if (!config) throw new Error('Config not found');

    const healthCheckId = `hc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newHealthCheck: HealthCheck = { ...healthCheck, id: healthCheckId };

    config.healthChecks.push(newHealthCheck);
    await this.updateConfig(config);

    if (newHealthCheck.active) {
      await this.startHealthCheck(configId, healthCheckId);
    }

    this.logger.info('dns-proxy-fix', `Health check added: ${newHealthCheck.path}`, {
      configId,
      healthCheckId
    });

    this.emit('healthCheckAdded', { configId, healthCheck: newHealthCheck });
    return healthCheckId;
  }

  private async updateConfig(config: DNSProxyConfig): Promise<void> {
    await this.database.query(`
      UPDATE dns_proxy_configs 
      SET health_checks = $1, updated_at = $2 
      WHERE id = $3
    `, [JSON.stringify(config.healthChecks), config.updatedAt, config.id]);
  }

  async getProxyStats(): Promise<{
    totalConfigs: number;
    activeConfigs: number;
    totalIssues: number;
    activeIssues: number;
    fixedIssues: number;
    failedIssues: number;
    overallFixRate: number;
  }> {
    const configs = Array.from(this.configs.values());
    const allIssues: DNSProxyIssue[] = [];
    
    for (const issues of this.issues.values()) {
      allIssues.push(...issues);
    }

    const fixedIssues = allIssues.filter(i => i.status === 'fixed').length;
    const overallFixRate = allIssues.length > 0 ? (fixedIssues / allIssues.length) * 100 : 0;

    return {
      totalConfigs: configs.length,
      activeConfigs: configs.filter(c => c.monitoring.enabled).length,
      totalIssues: allIssues.length,
      activeIssues: allIssues.filter(i => i.status === 'detected' || i.status === 'fixing').length,
      fixedIssues,
      failedIssues: allIssues.filter(i => i.status === 'failed').length,
      overallFixRate
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    configsCount: number;
    activeIssuesCount: number;
    monitoringActive: number;
    healthChecksActive: number;
    fixesInProgress: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getProxyStats();
    
    if (stats.activeIssues > 20) {
      issues.push('High number of active DNS proxy issues');
    }
    
    if (stats.overallFixRate < 80) {
      issues.push('Low DNS proxy fix success rate');
    }

    return {
      healthy: issues.length === 0,
      configsCount: stats.totalConfigs,
      activeIssuesCount: stats.activeIssues,
      monitoringActive: this.monitoringIntervals.size,
      healthChecksActive: this.healthCheckIntervals.size,
      fixesInProgress: this.fixInProgress.size,
      issues
    };
  }

  async destroy(): Promise<void> {
    // Stop all monitoring
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    
    // Stop all health checks
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    
    this.monitoringIntervals.clear();
    this.healthCheckIntervals.clear();
    
    this.logger.info('dns-proxy-fix', 'DNS and proxy fix system shut down');
  }
}

export default UltraDNSProxyFix;
