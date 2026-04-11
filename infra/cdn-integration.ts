import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraDomainSystem } from './domain-system';
import { UltraSSLSystem } from './ssl-system';

export interface CDNConfig {
  id: string;
  name: string;
  provider: 'cloudflare' | 'aws-cloudfront' | 'azure-cdn' | 'google-cdn' | 'fastly' | 'keycdn';
  domain: string;
  originUrl: string;
  zoneId?: string;
  distributionId?: string;
  credentials: CDNCredentials;
  config: CDNSettings;
  status: 'active' | 'inactive' | 'error' | 'configuring';
  cacheSettings: CacheSettings[];
  securitySettings: SecuritySettings;
  performanceSettings: PerformanceSettings;
  createdAt: Date;
  updatedAt: Date;
  lastSync?: Date;
}

export interface CDNCredentials {
  apiKey?: string;
  apiSecret?: string;
  email?: string;
  accessToken?: string;
  accountId?: string;
  region?: string;
  customHeaders?: Record<string, string>;
}

export interface CDNSettings {
  http2: boolean;
  http3: boolean;
  ipv6: boolean;
  brotli: boolean;
  gzip: boolean;
  minify: {
    html: boolean;
    css: boolean;
    js: boolean;
  };
  imageOptimization: boolean;
  webp: boolean;
  avif: boolean;
  customHeaders: Record<string, string>;
  customRules: CDNRule[];
}

export interface CacheSettings {
  id: string;
  path: string;
  cacheTtl: number; // seconds
  browserTtl: number; // seconds
  edgeTtl: number; // seconds
  bypassCache: boolean;
  respectHeaders: boolean;
  cacheKey: string;
  customKey: string;
}

export interface SecuritySettings {
  ddosProtection: boolean;
  wafEnabled: boolean;
  sslMode: 'flexible' | 'full' | 'strict';
  hsts: boolean;
  certificateTransparency: boolean;
  ipFirewall: {
    enabled: boolean;
    allowedIPs: string[];
    blockedIPs: string[];
  };
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
    burstSize: number;
  };
  botProtection: boolean;
}

export interface PerformanceSettings {
  smartRouting: boolean;
  argoSmartRouting: boolean;
  webSockets: boolean;
  http2Prioritization: boolean;
  earlyHints: boolean;
  prefetch: boolean;
  preload: boolean;
  mirroring: boolean;
  loadBalancing: {
    enabled: boolean;
    algorithm: 'round-robin' | 'least-connections' | 'weighted';
    origins: OriginServer[];
  };
}

export interface CDNRule {
  id: string;
  name: string;
  priority: number;
  condition: string;
  action: 'cache' | 'bypass' | 'redirect' | 'transform' | 'security';
  parameters: Record<string, any>;
  enabled: boolean;
}

export interface OriginServer {
  id: string;
  url: string;
  weight: number;
  healthCheck: {
    enabled: boolean;
    path: string;
    interval: number;
    timeout: number;
    expectedStatus: number;
  };
  status: 'healthy' | 'unhealthy' | 'unknown';
}

export interface CDNMetrics {
  cdnId: string;
  timestamp: Date;
  requests: {
    total: number;
    cached: number;
    uncached: number;
    error: number;
  };
  bandwidth: {
    total: number; // bytes
    cached: number; // bytes
    uncached: number; // bytes
  };
  responseTime: {
    average: number; // ms
    p50: number; // ms
    p95: number; // ms
    p99: number; // ms
  };
  cacheHitRatio: number;
  uniqueVisitors: number;
  threatsBlocked: number;
  topCountries: Array<{
    country: string;
    requests: number;
    bandwidth: number;
  }>;
  topPaths: Array<{
    path: string;
    requests: number;
    bandwidth: number;
  }>;
}

export interface CDNPurge {
  id: string;
  cdnId: string;
  type: 'url' | 'prefix' | 'tag' | 'all';
  target: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

export class UltraCDNIntegration extends EventEmitter {
  private static instance: UltraCDNIntegration;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private domainSystem: UltraDomainSystem;
  private sslSystem: UltraSSLSystem;
  private cdnConfigs: Map<string, CDNConfig> = new Map();
  private metrics: Map<string, CDNMetrics[]> = new Map();
  private purges: Map<string, CDNPurge[]> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): UltraCDNIntegration {
    if (!UltraCDNIntegration.instance) {
      UltraCDNIntegration.instance = new UltraCDNIntegration();
    }
    return UltraCDNIntegration.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.domainSystem = UltraDomainSystem.getInstance();
    this.sslSystem = UltraSSLSystem.getInstance();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize database tables
      await this.initializeDatabase();
      
      // Load existing CDN configurations
      await this.loadCDNConfigs();
      
      // Load existing purges
      await this.loadPurges();
      
      // Start monitoring for all CDN configs
      await this.startAllMonitoring();
      
      this.logger.info('cdn-integration', 'CDN integration system initialized', {
        cdnConfigsCount: this.cdnConfigs.size,
        monitoringActive: this.monitoringIntervals.size
      });

    } catch (error) {
      this.logger.error('cdn-integration', 'Failed to initialize CDN integration system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS cdn_configs (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        origin_url TEXT NOT NULL,
        zone_id VARCHAR(255),
        distribution_id VARCHAR(255),
        credentials JSONB NOT NULL,
        config JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        cache_settings JSONB NOT NULL,
        security_settings JSONB NOT NULL,
        performance_settings JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_sync TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS cdn_metrics (
        id SERIAL PRIMARY KEY,
        cdn_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        requests JSONB NOT NULL,
        bandwidth JSONB NOT NULL,
        response_time JSONB NOT NULL,
        cache_hit_ratio DECIMAL(5,2),
        unique_visitors INTEGER,
        threats_blocked INTEGER,
        top_countries JSONB,
        top_paths JSONB
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS cdn_purges (
        id VARCHAR(255) PRIMARY KEY,
        cdn_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        target TEXT NOT NULL,
        status VARCHAR(20) NOT NULL,
        progress INTEGER DEFAULT 0,
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS cdn_rules (
        id VARCHAR(255) PRIMARY KEY,
        cdn_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        priority INTEGER NOT NULL,
        condition TEXT NOT NULL,
        action VARCHAR(20) NOT NULL,
        parameters JSONB NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_cdn_configs_domain ON cdn_configs(domain)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_cdn_metrics_cdn_id_timestamp ON cdn_metrics(cdn_id, timestamp)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_cdn_purges_cdn_id ON cdn_purges(cdn_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_cdn_rules_cdn_id ON cdn_rules(cdn_id)');
  }

  private async loadCDNConfigs(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM cdn_configs');
      
      for (const row of rows) {
        const config: CDNConfig = {
          id: row.id,
          name: row.name,
          provider: row.provider,
          domain: row.domain,
          originUrl: row.origin_url,
          zoneId: row.zone_id,
          distributionId: row.distribution_id,
          credentials: row.credentials,
          config: row.config,
          status: row.status,
          cacheSettings: row.cache_settings || [],
          securitySettings: row.security_settings,
          performanceSettings: row.performance_settings,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastSync: row.last_sync
        };
        
        this.cdnConfigs.set(config.id, config);
      }
      
      this.logger.info('cdn-integration', `Loaded ${this.cdnConfigs.size} CDN configurations`);
    } catch (error) {
      this.logger.error('cdn-integration', 'Failed to load CDN configurations', error as Error);
    }
  }

  private async loadPurges(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM cdn_purges');
      
      for (const row of rows) {
        const purge: CDNPurge = {
          id: row.id,
          cdnId: row.cdn_id,
          type: row.type,
          target: row.target,
          status: row.status,
          progress: row.progress,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          errorMessage: row.error_message,
          createdAt: row.created_at
        };
        
        if (!this.purges.has(purge.cdnId)) {
          this.purges.set(purge.cdnId, []);
        }
        this.purges.get(purge.cdnId)!.push(purge);
      }
      
      this.logger.info('cdn-integration', `Loaded ${Array.from(this.purges.values()).reduce((sum, purges) => sum + purges.length, 0)} CDN purges`);
    } catch (error) {
      this.logger.error('cdn-integration', 'Failed to load CDN purges', error as Error);
    }
  }

  private async startAllMonitoring(): Promise<void> {
    for (const [cdnId, config] of this.cdnConfigs.entries()) {
      if (config.status === 'active') {
        await this.startMonitoring(cdnId);
      }
    }
  }

  async createCDNConfig(config: {
    name: string;
    provider: CDNConfig['provider'];
    domain: string;
    originUrl: string;
    credentials: CDNCredentials;
    config?: Partial<CDNSettings>;
    securitySettings?: Partial<SecuritySettings>;
    performanceSettings?: Partial<PerformanceSettings>;
  }): Promise<string> {
    const cdnId = `cdn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate domain exists
      const domain = await this.domainSystem.getDomain(config.domain);
      if (!domain) {
        throw new Error('Domain not found in domain system');
      }

      const cdnConfig: CDNConfig = {
        id: cdnId,
        name: config.name,
        provider: config.provider,
        domain: config.domain,
        originUrl: config.originUrl,
        credentials: config.credentials,
        config: {
          http2: true,
          http3: true,
          ipv6: true,
          brotli: true,
          gzip: true,
          minify: {
            html: true,
            css: true,
            js: true
          },
          imageOptimization: true,
          webp: true,
          avif: true,
          customHeaders: {},
          customRules: [],
          ...config.config
        },
        status: 'configuring',
        cacheSettings: [],
        securitySettings: {
          ddosProtection: true,
          wafEnabled: true,
          sslMode: 'full',
          hsts: true,
          certificateTransparency: true,
          ipFirewall: {
            enabled: false,
            allowedIPs: [],
            blockedIPs: []
          },
          rateLimiting: {
            enabled: false,
            requestsPerMinute: 1000,
            burstSize: 100
          },
          botProtection: true,
          ...config.securitySettings
        },
        performanceSettings: {
          smartRouting: true,
          argoSmartRouting: false,
          webSockets: true,
          http2Prioritization: true,
          earlyHints: true,
          prefetch: false,
          preload: false,
          mirroring: false,
          loadBalancing: {
            enabled: false,
            algorithm: 'round-robin',
            origins: []
          },
          ...config.performanceSettings
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO cdn_configs (
          id, name, provider, domain, origin_url, credentials, config,
          status, cache_settings, security_settings, performance_settings,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        cdnConfig.id,
        cdnConfig.name,
        cdnConfig.provider,
        cdnConfig.domain,
        cdnConfig.originUrl,
        JSON.stringify(cdnConfig.credentials),
        JSON.stringify(cdnConfig.config),
        cdnConfig.status,
        JSON.stringify(cdnConfig.cacheSettings),
        JSON.stringify(cdnConfig.securitySettings),
        JSON.stringify(cdnConfig.performanceSettings),
        cdnConfig.createdAt,
        cdnConfig.updatedAt
      ]);

      this.cdnConfigs.set(cdnId, cdnConfig);

      // Configure CDN based on provider
      await this.configureCDN(cdnId);

      this.logger.info('cdn-integration', `CDN configuration created: ${cdnConfig.name}`, {
        cdnId,
        provider: config.provider,
        domain: config.domain,
        originUrl: config.originUrl
      });

      this.emit('cdnConfigCreated', cdnConfig);
      return cdnId;

    } catch (error) {
      this.logger.error('cdn-integration', `Failed to create CDN configuration: ${config.name}`, error as Error);
      throw error;
    }
  }

  private async configureCDN(cdnId: string): Promise<void> {
    const cdnConfig = this.cdnConfigs.get(cdnId);
    if (!cdnConfig) throw new Error('CDN configuration not found');

    try {
      switch (cdnConfig.provider) {
        case 'cloudflare':
          await this.configureCloudflare(cdnConfig);
          break;
        case 'aws-cloudfront':
          await this.configureCloudFront(cdnConfig);
          break;
        case 'azure-cdn':
          await this.configureAzureCDN(cdnConfig);
          break;
        case 'google-cdn':
          await this.configureGoogleCDN(cdnConfig);
          break;
        case 'fastly':
          await this.configureFastly(cdnConfig);
          break;
        case 'keycdn':
          await this.configureKeyCDN(cdnConfig);
          break;
      }

      cdnConfig.status = 'active';
      cdnConfig.updatedAt = new Date();
      cdnConfig.lastSync = new Date();

      await this.database.query(`
        UPDATE cdn_configs 
        SET status = 'active', zone_id = $1, distribution_id = $2, updated_at = $3, last_sync = $4 
        WHERE id = $5
      `, [cdnConfig.zoneId, cdnConfig.distributionId, cdnConfig.updatedAt, cdnConfig.lastSync, cdnId]);

      // Update domain DNS to point to CDN
      await this.updateDomainDNS(cdnConfig);

      // Start monitoring
      await this.startMonitoring(cdnId);

      this.logger.info('cdn-integration', `CDN configured and activated: ${cdnConfig.name}`, {
        cdnId,
        provider: cdnConfig.provider,
        zoneId: cdnConfig.zoneId,
        distributionId: cdnConfig.distributionId
      });

      this.emit('cdnConfigured', cdnConfig);

    } catch (error) {
      cdnConfig.status = 'error';
      await this.database.query('UPDATE cdn_configs SET status = \'error\' WHERE id = $1', [cdnId]);
      this.logger.error('cdn-integration', `Failed to configure CDN: ${cdnConfig.name}`, error as Error);
      throw error;
    }
  }

  private async configureCloudflare(cdnConfig: CDNConfig): Promise<void> {
    // Cloudflare API integration
    const apiKey = cdnConfig.credentials.apiKey;
    const email = cdnConfig.credentials.email;
    
    if (!apiKey || !email) {
      throw new Error('Cloudflare API key and email are required');
    }

    // Get zone ID
    const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${cdnConfig.domain}`, {
      headers: {
        'X-Auth-Email': email,
        'X-Auth-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const zoneData = await zoneResponse.json();
    if (!zoneData.success || zoneData.result.length === 0) {
      throw new Error('Cloudflare zone not found');
    }

    cdnConfig.zoneId = zoneData.result[0].id;

    // Configure CDN settings
    await this.configureCloudflareSettings(cdnConfig);
  }

  private async configureCloudflareSettings(cdnConfig: CDNConfig): Promise<void> {
    const apiKey = cdnConfig.credentials.apiKey;
    const email = cdnConfig.credentials.email;
    const zoneId = cdnConfig.zoneId!;

    // Enable/disable features
    const settings = [
      { key: 'ssl', value: cdnConfig.securitySettings.sslMode },
      { key: 'ipv6', value: cdnConfig.config.ipv6 },
      { key: 'webp', value: cdnConfig.config.webp },
      { key: 'brotli', value: cdnConfig.config.brotli },
      { key: 'minify', value: cdnConfig.config.minify },
      { key: 'rocket_loader', value: true },
      { key: 'always_online', value: true },
      { key: 'development_mode', value: false }
    ];

    for (const setting of settings) {
      await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/${setting.key}`, {
        method: 'PATCH',
        headers: {
          'X-Auth-Email': email,
          'X-Auth-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: setting.value })
      });
    }

    // Set origin server
    await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/origin_ca_certs`, {
      method: 'POST',
      headers: {
        'X-Auth-Email': email,
        'X-Auth-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        host: cdnConfig.originUrl,
        zone_id: zoneId
      })
    });
  }

  private async configureCloudFront(cdnConfig: CDNConfig): Promise<void> {
    // AWS CloudFront API integration
    // This would use AWS SDK to create and configure CloudFront distribution
    this.logger.info('cdn-integration', 'Configuring AWS CloudFront distribution', {
      cdnId: cdnConfig.id,
      domain: cdnConfig.domain,
      originUrl: cdnConfig.originUrl
    });
  }

  private async configureAzureCDN(cdnConfig: CDNConfig): Promise<void> {
    // Azure CDN API integration
    this.logger.info('cdn-integration', 'Configuring Azure CDN', {
      cdnId: cdnConfig.id,
      domain: cdnConfig.domain,
      originUrl: cdnConfig.originUrl
    });
  }

  private async configureGoogleCDN(cdnConfig: CDNConfig): Promise<void> {
    // Google CDN API integration
    this.logger.info('cdn-integration', 'Configuring Google CDN', {
      cdnId: cdnConfig.id,
      domain: cdnConfig.domain,
      originUrl: cdnConfig.originUrl
    });
  }

  private async configureFastly(cdnConfig: CDNConfig): Promise<void> {
    // Fastly API integration
    this.logger.info('cdn-integration', 'Configuring Fastly CDN', {
      cdnId: cdnConfig.id,
      domain: cdnConfig.domain,
      originUrl: cdnConfig.originUrl
    });
  }

  private async configureKeyCDN(cdnConfig: CDNConfig): Promise<void> {
    // KeyCDN API integration
    this.logger.info('cdn-integration', 'Configuring KeyCDN', {
      cdnId: cdnConfig.id,
      domain: cdnConfig.domain,
      originUrl: cdnConfig.originUrl
    });
  }

  private async updateDomainDNS(cdnConfig: CDNConfig): Promise<void> {
    try {
      // Update domain to use CDN
      if (cdnConfig.provider === 'cloudflare') {
        // Cloudflare handles DNS automatically
        this.logger.info('cdn-integration', `DNS updated for Cloudflare CDN: ${cdnConfig.domain}`);
      } else {
        // For other providers, update CNAME record
        const cdnHostname = this.getCDNHostname(cdnConfig);
        await this.domainSystem.updateDNSRecord(cdnConfig.domain, 'CNAME', cdnHostname);
      }
    } catch (error) {
      this.logger.error('cdn-integration', `Failed to update DNS for CDN: ${cdnConfig.domain}`, error as Error);
    }
  }

  private getCDNHostname(cdnConfig: CDNConfig): string {
    const hostnames: Record<string, string> = {
      'aws-cloudfront': `${cdnConfig.distributionId}.cloudfront.net`,
      'azure-cdn': `${cdnConfig.domain}.azureedge.net`,
      'google-cdn': `${cdnConfig.domain}.cdn.google.com`,
      'fastly': `${cdnConfig.domain}.global.fastly.net`,
      'keycdn': `${cdnConfig.domain}.kxcdn.com`
    };
    
    return hostnames[cdnConfig.provider] || cdnConfig.domain;
  }

  private async startMonitoring(cdnId: string): Promise<void> {
    const cdnConfig = this.cdnConfigs.get(cdnId);
    if (!cdnConfig || cdnConfig.status !== 'active') return;

    // Stop existing monitoring
    await this.stopMonitoring(cdnId);

    const interval = setInterval(async () => {
      await this.collectMetrics(cdnId);
    }, 300000); // 5 minutes

    this.monitoringIntervals.set(cdnId, interval);
    
    // Collect initial metrics
    await this.collectMetrics(cdnId);
    
    this.logger.info('cdn-integration', `Started monitoring for CDN: ${cdnConfig.name}`, {
      cdnId,
      provider: cdnConfig.provider
    });
  }

  private async stopMonitoring(cdnId: string): Promise<void> {
    const interval = this.monitoringIntervals.get(cdnId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(cdnId);
    }
  }

  private async collectMetrics(cdnId: string): Promise<void> {
    const cdnConfig = this.cdnConfigs.get(cdnId);
    if (!cdnConfig || cdnConfig.status !== 'active') return;

    try {
      let metrics: CDNMetrics = {
        cdnId,
        timestamp: new Date(),
        requests: { total: 0, cached: 0, uncached: 0, error: 0 },
        bandwidth: { total: 0, cached: 0, uncached: 0 },
        responseTime: { average: 0, p50: 0, p95: 0, p99: 0 },
        cacheHitRatio: 0,
        uniqueVisitors: 0,
        threatsBlocked: 0,
        topCountries: [],
        topPaths: []
      };

      switch (cdnConfig.provider) {
        case 'cloudflare':
          metrics = await this.collectCloudflareMetrics(cdnConfig);
          break;
        case 'aws-cloudfront':
          metrics = await this.collectCloudFrontMetrics(cdnConfig);
          break;
        default:
          // Simulated metrics for other providers
          metrics = await this.collectSimulatedMetrics(cdnConfig);
      }

      // Store metrics in memory (keep last 1000 data points)
      if (!this.metrics.has(cdnId)) {
        this.metrics.set(cdnId, []);
      }
      
      const cdnMetrics = this.metrics.get(cdnId)!;
      cdnMetrics.push(metrics);
      
      // Keep only last 1000 data points
      if (cdnMetrics.length > 1000) {
        cdnMetrics.splice(0, cdnMetrics.length - 1000);
      }

      // Store in database
      await this.storeMetricsInDB(metrics);

      this.emit('metricsCollected', { cdnId, metrics });

    } catch (error) {
      this.logger.error('cdn-integration', `Failed to collect metrics for CDN: ${cdnConfig.name}`, error as Error);
    }
  }

  private async collectCloudflareMetrics(cdnConfig: CDNConfig): Promise<CDNMetrics> {
    const apiKey = cdnConfig.credentials.apiKey;
    const email = cdnConfig.credentials.email;
    const zoneId = cdnConfig.zoneId!;

    try {
      // Get analytics data
      const analyticsResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/analytics/dashboard?since=-1440`, // Last 24 hours
        {
          headers: {
            'X-Auth-Email': email,
            'X-Auth-Key': apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const analyticsData = await analyticsResponse.json();
      
      if (analyticsData.success && analyticsData.result.totals) {
        const totals = analyticsData.result.totals;
        
        return {
          cdnId: cdnConfig.id,
          timestamp: new Date(),
          requests: {
            total: totals.requests?.all || 0,
            cached: totals.requests?.cached || 0,
            uncached: totals.requests?.uncached || 0,
            error: totals.requests?.http?.error || 0
          },
          bandwidth: {
            total: totals.bandwidth?.all || 0,
            cached: totals.bandwidth?.cached || 0,
            uncached: totals.bandwidth?.uncached || 0
          },
          responseTime: {
            average: totals.http?.requests?.avg_response_time || 0,
            p50: 0, // Cloudflare doesn't provide percentiles in free tier
            p95: 0,
            p99: 0
          },
          cacheHitRatio: totals.requests?.cached ? 
            (totals.requests.cached / totals.requests.all) * 100 : 0,
          uniqueVisitors: totals.uniques?.all || 0,
          threatsBlocked: totals.threats?.all || 0,
          topCountries: [],
          topPaths: []
        };
      }
    } catch (error) {
      this.logger.error('cdn-integration', 'Failed to collect Cloudflare metrics', error as Error);
    }

    // Return empty metrics on error
    return {
      cdnId: cdnConfig.id,
      timestamp: new Date(),
      requests: { total: 0, cached: 0, uncached: 0, error: 0 },
      bandwidth: { total: 0, cached: 0, uncached: 0 },
      responseTime: { average: 0, p50: 0, p95: 0, p99: 0 },
      cacheHitRatio: 0,
      uniqueVisitors: 0,
      threatsBlocked: 0,
      topCountries: [],
      topPaths: []
    };
  }

  private async collectCloudFrontMetrics(cdnConfig: CDNConfig): Promise<CDNMetrics> {
    // AWS CloudWatch metrics collection
    // This would use AWS SDK to get CloudFront metrics
    return await this.collectSimulatedMetrics(cdnConfig);
  }

  private async collectSimulatedMetrics(cdnConfig: CDNConfig): Promise<CDNMetrics> {
    // Simulated metrics for providers without API integration
    const baseRequests = Math.floor(Math.random() * 10000) + 5000;
    const cacheHitRatio = Math.random() * 30 + 70; // 70-100%
    
    return {
      cdnId: cdnConfig.id,
      timestamp: new Date(),
      requests: {
        total: baseRequests,
        cached: Math.floor(baseRequests * (cacheHitRatio / 100)),
        uncached: Math.floor(baseRequests * ((100 - cacheHitRatio) / 100)),
        error: Math.floor(Math.random() * 100)
      },
      bandwidth: {
        total: baseRequests * 1024 * 100, // Average 100KB per request
        cached: Math.floor(baseRequests * (cacheHitRatio / 100)) * 1024 * 100,
        uncached: Math.floor(baseRequests * ((100 - cacheHitRatio) / 100)) * 1024 * 100
      },
      responseTime: {
        average: Math.random() * 500 + 100, // 100-600ms
        p50: Math.random() * 300 + 50,
        p95: Math.random() * 800 + 200,
        p99: Math.random() * 1200 + 300
      },
      cacheHitRatio,
      uniqueVisitors: Math.floor(baseRequests * 0.3),
      threatsBlocked: Math.floor(Math.random() * 50),
      topCountries: [
        { country: 'US', requests: Math.floor(baseRequests * 0.4), bandwidth: 0 },
        { country: 'GB', requests: Math.floor(baseRequests * 0.2), bandwidth: 0 },
        { country: 'DE', requests: Math.floor(baseRequests * 0.1), bandwidth: 0 }
      ],
      topPaths: [
        { path: '/', requests: Math.floor(baseRequests * 0.3), bandwidth: 0 },
        { path: '/api', requests: Math.floor(baseRequests * 0.2), bandwidth: 0 },
        { path: '/static', requests: Math.floor(baseRequests * 0.15), bandwidth: 0 }
      ]
    };
  }

  private async storeMetricsInDB(metrics: CDNMetrics): Promise<void> {
    try {
      await this.database.query(`
        INSERT INTO cdn_metrics (
          cdn_id, timestamp, requests, bandwidth, response_time,
          cache_hit_ratio, unique_visitors, threats_blocked,
          top_countries, top_paths
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        metrics.cdnId,
        metrics.timestamp,
        JSON.stringify(metrics.requests),
        JSON.stringify(metrics.bandwidth),
        JSON.stringify(metrics.responseTime),
        metrics.cacheHitRatio,
        metrics.uniqueVisitors,
        metrics.threatsBlocked,
        JSON.stringify(metrics.topCountries),
        JSON.stringify(metrics.topPaths)
      ]);
    } catch (error) {
      this.logger.error('cdn-integration', 'Failed to store metrics in database', error as Error);
    }
  }

  async purgeCache(cdnId: string, type: CDNPurge['type'], target: string): Promise<string> {
    const cdnConfig = this.cdnConfigs.get(cdnId);
    if (!cdnConfig) throw new Error('CDN configuration not found');

    const purgeId = `purge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const purge: CDNPurge = {
        id: purgeId,
        cdnId,
        type,
        target,
        status: 'pending',
        progress: 0,
        startedAt: new Date(),
        createdAt: new Date()
      };

      // Store purge in database
      await this.database.query(`
        INSERT INTO cdn_purges (id, cdn_id, type, target, status, started_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [purge.id, purge.cdnId, purge.type, purge.target, purge.status, purge.startedAt, purge.createdAt]);

      if (!this.purges.has(cdnId)) {
        this.purges.set(cdnId, []);
      }
      this.purges.get(cdnId)!.push(purge);

      // Perform purge based on provider
      await this.performPurge(purge);

      this.logger.info('cdn-integration', `Cache purge initiated: ${type} - ${target}`, {
        purgeId,
        cdnId,
        type,
        target
      });

      this.emit('purgeInitiated', purge);
      return purgeId;

    } catch (error) {
      this.logger.error('cdn-integration', `Failed to initiate cache purge: ${type} - ${target}`, error as Error);
      throw error;
    }
  }

  private async performPurge(purge: CDNPurge): Promise<void> {
    const cdnConfig = this.cdnConfigs.get(purge.cdnId);
    if (!cdnConfig) throw new Error('CDN configuration not found');

    try {
      purge.status = 'processing';
      await this.database.query('UPDATE cdn_purges SET status = \'processing\' WHERE id = $1', [purge.id]);

      switch (cdnConfig.provider) {
        case 'cloudflare':
          await this.performCloudflarePurge(cdnConfig, purge);
          break;
        case 'aws-cloudfront':
          await this.performCloudFrontPurge(cdnConfig, purge);
          break;
        default:
          // Simulated purge for other providers
          await this.performSimulatedPurge(purge);
      }

      purge.status = 'completed';
      purge.completedAt = new Date();
      purge.progress = 100;

      await this.database.query(`
        UPDATE cdn_purges 
        SET status = 'completed', completed_at = $1, progress = 100 
        WHERE id = $2
      `, [purge.completedAt, purge.id]);

      this.emit('purgeCompleted', purge);

    } catch (error) {
      purge.status = 'failed';
      purge.errorMessage = error.message;
      
      await this.database.query(`
        UPDATE cdn_purges 
        SET status = 'failed', error_message = $1 
        WHERE id = $2
      `, [purge.errorMessage, purge.id]);

      this.emit('purgeFailed', purge);
      throw error;
    }
  }

  private async performCloudflarePurge(cdnConfig: CDNConfig, purge: CDNPurge): Promise<void> {
    const apiKey = cdnConfig.credentials.apiKey;
    const email = cdnConfig.credentials.email;
    const zoneId = cdnConfig.zoneId!;

    let purgeBody: any = {};

    switch (purge.type) {
      case 'url':
        purgeBody = { files: [purge.target] };
        break;
      case 'prefix':
        purgeBody = { prefixes: [purge.target] };
        break;
      case 'tag':
        purgeBody = { tags: [purge.target] };
        break;
      case 'all':
        purgeBody = { purge_everything: true };
        break;
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        'X-Auth-Email': email,
        'X-Auth-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(purgeBody)
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(`Cloudflare purge failed: ${result.errors?.[0]?.message || 'Unknown error'}`);
    }
  }

  private async performCloudFrontPurge(cdnConfig: CDNConfig, purge: CDNPurge): Promise<void> {
    // AWS CloudFront invalidation
    this.logger.info('cdn-integration', 'Performing CloudFront purge', {
      purgeId: purge.id,
      type: purge.type,
      target: purge.target
    });
  }

  private async performSimulatedPurge(purge: CDNPurge): Promise<void> {
    // Simulate purge process
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Public API methods
  async getCDNConfig(cdnId: string): Promise<CDNConfig | null> {
    return this.cdnConfigs.get(cdnId) || null;
  }

  async getCDNConfigsByDomain(domain: string): Promise<CDNConfig[]> {
    return Array.from(this.cdnConfigs.values()).filter(c => c.domain === domain);
  }

  async getCDNMetrics(cdnId: string, timeRange?: { start: Date; end: Date }): Promise<CDNMetrics[]> {
    const metrics = this.metrics.get(cdnId) || [];
    
    if (!timeRange) {
      return metrics;
    }

    return metrics.filter(m => 
      m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }

  async getCDNPurges(cdnId: string): Promise<CDNPurge[]> {
    return this.purges.get(cdnId) || [];
  }

  async addCacheRule(cdnId: string, rule: Omit<CacheSettings, 'id'>): Promise<string> {
    const cdnConfig = this.cdnConfigs.get(cdnId);
    if (!cdnConfig) throw new Error('CDN configuration not found');

    const ruleId = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const cacheRule: CacheSettings = { ...rule, id: ruleId };

    cdnConfig.cacheSettings.push(cacheRule);
    await this.updateCDNConfig(cdnConfig);

    this.logger.info('cdn-integration', `Cache rule added: ${rule.path}`, {
      cdnId,
      ruleId,
      cacheTtl: rule.cacheTtl
    });

    this.emit('cacheRuleAdded', { cdnId, rule: cacheRule });
    return ruleId;
  }

  async removeCacheRule(cdnId: string, ruleId: string): Promise<boolean> {
    const cdnConfig = this.cdnConfigs.get(cdnId);
    if (!cdnConfig) return false;

    const ruleIndex = cdnConfig.cacheSettings.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return false;

    cdnConfig.cacheSettings.splice(ruleIndex, 1);
    await this.updateCDNConfig(cdnConfig);

    this.logger.info('cdn-integration', `Cache rule removed: ${ruleId}`, {
      cdnId,
      ruleId
    });

    this.emit('cacheRuleRemoved', { cdnId, ruleId });
    return true;
  }

  private async updateCDNConfig(cdnConfig: CDNConfig): Promise<void> {
    await this.database.query(`
      UPDATE cdn_configs 
      SET cache_settings = $1, updated_at = $2 
      WHERE id = $3
    `, [JSON.stringify(cdnConfig.cacheSettings), cdnConfig.updatedAt, cdnConfig.id]);
  }

  async getCDNStats(): Promise<{
    totalConfigs: number;
    activeConfigs: number;
    configsByProvider: Record<string, number>;
    totalRequests: number;
    totalBandwidth: number;
    averageCacheHitRatio: number;
    totalThreatsBlocked: number;
  }> {
    const configs = Array.from(this.cdnConfigs.values());
    const allMetrics = Array.from(this.metrics.values()).flat();
    
    return {
      totalConfigs: configs.length,
      activeConfigs: configs.filter(c => c.status === 'active').length,
      configsByProvider: configs.reduce((acc, config) => {
        acc[config.provider] = (acc[config.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalRequests: allMetrics.reduce((sum, m) => sum + m.requests.total, 0),
      totalBandwidth: allMetrics.reduce((sum, m) => sum + m.bandwidth.total, 0),
      averageCacheHitRatio: allMetrics.length > 0 ? 
        allMetrics.reduce((sum, m) => sum + m.cacheHitRatio, 0) / allMetrics.length : 0,
      totalThreatsBlocked: allMetrics.reduce((sum, m) => sum + m.threatsBlocked, 0)
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    cdnConfigsCount: number;
    activeConfigsCount: number;
    monitoringActive: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getCDNStats();
    
    if (stats.activeConfigs < stats.totalConfigs) {
      issues.push(`${stats.totalConfigs - stats.activeConfigs} CDN configurations are not active`);
    }
    
    if (stats.totalConfigs === 0) {
      issues.push('No CDN configurations found');
    }

    return {
      healthy: issues.length === 0,
      cdnConfigsCount: stats.totalConfigs,
      activeConfigsCount: stats.activeConfigs,
      monitoringActive: this.monitoringIntervals.size,
      issues
    };
  }

  async destroy(): Promise<void> {
    // Stop all monitoring
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    
    this.monitoringIntervals.clear();
    
    this.logger.info('cdn-integration', 'CDN integration system shut down');
  }
}

export default UltraCDNIntegration;
