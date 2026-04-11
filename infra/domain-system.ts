import { EventEmitter } from 'events';
import * as dns from 'dns';
import * as https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';

const execAsync = promisify(exec);

export interface DomainConfig {
  id: string;
  domain: string;
  userId: string;
  provider: 'cloudflare' | 'custom' | 'route53';
  status: 'pending' | 'active' | 'error' | 'verifying';
  nameservers: string[];
  dnsRecords: DNSRecord[];
  sslEnabled: boolean;
  sslStatus: 'none' | 'pending' | 'active' | 'expired' | 'error';
  sslExpiry?: Date;
  autoRenew: boolean;
  cloudflareZoneId?: string;
  createdAt: Date;
  updatedAt: Date;
  verifiedAt?: Date;
}

export interface DNSRecord {
  id: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS';
  name: string;
  content: string;
  ttl: number;
  priority?: number;
  proxied?: boolean;
}

export interface SubdomainConfig {
  id: string;
  domainId: string;
  subdomain: string;
  targetIp: string;
  targetServerId?: string;
  type: 'A' | 'CNAME';
  status: 'pending' | 'active' | 'error';
  sslEnabled: boolean;
  createdAt: Date;
}

export interface DomainVerificationResult {
  valid: boolean;
  issues: string[];
  recommendations: string[];
  dnsPropagation: boolean;
  nameserverMatch: boolean;
  sslValid: boolean;
}

export class UltraDomainSystem extends EventEmitter {
  private static instance: UltraDomainSystem;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private cloudflareApiToken: string;
  private domains: Map<string, DomainConfig> = new Map();
  private verificationInterval?: NodeJS.Timeout;

  static getInstance(): UltraDomainSystem {
    if (!UltraDomainSystem.instance) {
      UltraDomainSystem.instance = new UltraDomainSystem();
    }
    return UltraDomainSystem.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN || '';
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize database tables
      await this.initializeDatabase();
      
      // Load existing domains
      await this.loadDomains();
      
      // Start verification interval
      this.startVerificationInterval();
      
      this.logger.info('domain-system', 'Domain system initialized', {
        loadedDomains: this.domains.size,
        cloudflareEnabled: !!this.cloudflareApiToken
      });

    } catch (error) {
      this.logger.error('domain-system', 'Failed to initialize domain system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS domains (
        id VARCHAR(255) PRIMARY KEY,
        domain VARCHAR(255) UNIQUE NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        nameservers JSONB,
        dns_records JSONB,
        ssl_enabled BOOLEAN DEFAULT FALSE,
        ssl_status VARCHAR(50) DEFAULT 'none',
        ssl_expiry TIMESTAMP,
        auto_renew BOOLEAN DEFAULT TRUE,
        cloudflare_zone_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        verified_at TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS subdomains (
        id VARCHAR(255) PRIMARY KEY,
        domain_id VARCHAR(255) REFERENCES domains(id),
        subdomain VARCHAR(255) NOT NULL,
        target_ip VARCHAR(45) NOT NULL,
        target_server_id VARCHAR(255),
        type VARCHAR(10) NOT NULL,
        status VARCHAR(50) NOT NULL,
        ssl_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query('CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_subdomains_domain_id ON subdomains(domain_id)');
  }

  private async loadDomains(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM domains');
      
      for (const row of rows) {
        const domain: DomainConfig = {
          id: row.id,
          domain: row.domain,
          userId: row.user_id,
          provider: row.provider,
          status: row.status,
          nameservers: row.nameservers || [],
          dnsRecords: row.dns_records || [],
          sslEnabled: row.ssl_enabled,
          sslStatus: row.ssl_status,
          sslExpiry: row.ssl_expiry,
          autoRenew: row.auto_renew,
          cloudflareZoneId: row.cloudflare_zone_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          verifiedAt: row.verified_at
        };
        
        this.domains.set(domain.id, domain);
      }
      
      this.logger.info('domain-system', `Loaded ${this.domains.size} domains from database`);
    } catch (error) {
      this.logger.error('domain-system', 'Failed to load domains', error as Error);
    }
  }

  async addDomain(domain: string, userId: string, provider: DomainConfig['provider'] = 'cloudflare'): Promise<string> {
    const domainId = `domain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate domain format
      if (!this.isValidDomain(domain)) {
        throw new Error('Invalid domain format');
      }

      // Check if domain already exists
      const existing = Array.from(this.domains.values()).find(d => d.domain === domain);
      if (existing) {
        throw new Error('Domain already exists');
      }

      // Detect current DNS configuration
      const nameservers = await this.detectNameservers(domain);
      
      // Create domain config
      const domainConfig: DomainConfig = {
        id: domainId,
        domain,
        userId,
        provider,
        status: 'pending',
        nameservers,
        dnsRecords: [],
        sslEnabled: false,
        sslStatus: 'none',
        autoRenew: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Connect to provider
      if (provider === 'cloudflare') {
        await this.connectCloudflareDomain(domainConfig);
      }

      // Save to database
      await this.database.query(`
        INSERT INTO domains (
          id, domain, user_id, provider, status, nameservers, 
          cloudflare_zone_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        domainConfig.id,
        domainConfig.domain,
        domainConfig.userId,
        domainConfig.provider,
        domainConfig.status,
        JSON.stringify(domainConfig.nameservers),
        domainConfig.cloudflareZoneId,
        domainConfig.createdAt,
        domainConfig.updatedAt
      ]);

      this.domains.set(domainId, domainConfig);

      // Start verification process
      await this.verifyDomain(domainId);

      this.logger.info('domain-system', `Domain added: ${domain}`, {
        domainId,
        provider,
        nameservers: nameservers.length
      });

      this.emit('domainAdded', domainConfig);
      return domainId;

    } catch (error) {
      this.logger.error('domain-system', `Failed to add domain: ${domain}`, error as Error);
      throw error;
    }
  }

  private async connectCloudflareDomain(domainConfig: DomainConfig): Promise<void> {
    if (!this.cloudflareApiToken) {
      throw new Error('Cloudflare API token not configured');
    }

    try {
      // Get zone from Cloudflare
      const zoneResponse = await this.makeCloudflareRequest(`/zones?name=${domainConfig.domain}`);
      
      if (zoneResponse.result.length === 0) {
        throw new Error('Domain not found in Cloudflare account');
      }

      const zone = zoneResponse.result[0];
      domainConfig.cloudflareZoneId = zone.id;
      domainConfig.nameservers = zone.name_servers;

      this.logger.info('domain-system', `Connected to Cloudflare: ${domainConfig.domain}`, {
        zoneId: zone.id,
        nameservers: zone.name_servers
      });

    } catch (error) {
      this.logger.error('domain-system', `Failed to connect Cloudflare: ${domainConfig.domain}`, error as Error);
      throw error;
    }
  }

  private async detectNameservers(domain: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      dns.resolveNs(domain, (err, addresses) => {
        if (err) {
          // Try with www subdomain
          dns.resolveNs(`www.${domain}`, (err2, addresses2) => {
            if (err2) {
              resolve([]);
            } else {
              resolve(addresses2);
            }
          });
        } else {
          resolve(addresses);
        }
      });
    });
  }

  async verifyDomain(domainId: string): Promise<DomainVerificationResult> {
    const domain = this.domains.get(domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }

    const result: DomainVerificationResult = {
      valid: false,
      issues: [],
      recommendations: [],
      dnsPropagation: false,
      nameserverMatch: false,
      sslValid: false
    };

    try {
      // Check DNS propagation
      const currentNameservers = await this.detectNameservers(domain.domain);
      result.dnsPropagation = currentNameservers.length > 0;
      
      // Check nameserver match
      if (domain.nameservers.length > 0) {
        result.nameserverMatch = domain.nameservers.some(ns => 
          currentNameservers.includes(ns)
        );
        
        if (!result.nameserverMatch) {
          result.issues.push('Nameservers not pointing to our servers');
          result.recommendations.push('Update nameservers to: ' + domain.nameservers.join(', '));
        }
      }

      // Check domain accessibility
      try {
        await this.checkDomainAccessibility(domain.domain);
      } catch (error) {
        result.issues.push('Domain not accessible');
        result.recommendations.push('Wait for DNS propagation (may take up to 48 hours)');
      }

      // Check SSL status
      if (domain.sslEnabled) {
        result.sslValid = await this.checkSSLStatus(domain.domain);
        if (!result.sslValid) {
          result.issues.push('SSL certificate not valid');
        }
      }

      // Update domain status
      domain.status = result.issues.length === 0 ? 'active' : 'error';
      domain.updatedAt = new Date();
      
      if (domain.status === 'active' && !domain.verifiedAt) {
        domain.verifiedAt = new Date();
      }

      await this.database.query(`
        UPDATE domains 
        SET status = $1, updated_at = $2, verified_at = $3 
        WHERE id = $4
      `, [domain.status, domain.updatedAt, domain.verifiedAt, domainId]);

      result.valid = result.issues.length === 0;

      this.logger.info('domain-system', `Domain verification completed: ${domain.domain}`, {
        valid: result.valid,
        issues: result.issues.length
      });

      this.emit('domainVerified', { domainId, result });
      return result;

    } catch (error) {
      this.logger.error('domain-system', `Domain verification failed: ${domain.domain}`, error as Error);
      result.issues.push('Verification failed: ' + error.message);
      return result;
    }
  }

  private async checkDomainAccessibility(domain: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: domain,
        port: 443,
        path: '/',
        method: 'GET',
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        if (res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  private async checkSSLStatus(domain: string): Promise<boolean> {
    return new Promise((resolve) => {
      const options = {
        hostname: domain,
        port: 443,
        method: 'GET',
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        const cert = res.socket.getPeerCertificate();
        if (cert) {
          const validTo = new Date(cert.valid_to);
          const now = new Date();
          const daysUntilExpiry = (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          resolve(daysUntilExpiry > 0);
        } else {
          resolve(false);
        }
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  async createSubdomain(
    domainId: string, 
    subdomain: string, 
    targetIp: string, 
    type: 'A' | 'CNAME' = 'A',
    targetServerId?: string
  ): Promise<string> {
    const domain = this.domains.get(domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }

    const subdomainId = `subdomain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullSubdomain = `${subdomain}.${domain.domain}`;

    try {
      // Create DNS record
      const dnsRecord: DNSRecord = {
        id: `dns-${Date.now()}`,
        type,
        name: subdomain,
        content: targetIp,
        ttl: 300,
        proxied: true
      };

      if (domain.provider === 'cloudflare') {
        await this.createCloudflareDNSRecord(domain, dnsRecord);
      }

      // Save subdomain config
      const subdomainConfig: SubdomainConfig = {
        id: subdomainId,
        domainId,
        subdomain,
        targetIp,
        targetServerId,
        type,
        status: 'pending',
        sslEnabled: domain.sslEnabled,
        createdAt: new Date()
      };

      await this.database.query(`
        INSERT INTO subdomains (
          id, domain_id, subdomain, target_ip, target_server_id, 
          type, status, ssl_enabled, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        subdomainConfig.id,
        subdomainConfig.domainId,
        subdomainConfig.subdomain,
        subdomainConfig.targetIp,
        subdomainConfig.targetServerId,
        subdomainConfig.type,
        subdomainConfig.status,
        subdomainConfig.sslEnabled,
        subdomainConfig.createdAt
      ]);

      this.logger.info('domain-system', `Subdomain created: ${fullSubdomain}`, {
        subdomainId,
        targetIp,
        type
      });

      this.emit('subdomainCreated', subdomainConfig);
      return subdomainId;

    } catch (error) {
      this.logger.error('domain-system', `Failed to create subdomain: ${fullSubdomain}`, error as Error);
      throw error;
    }
  }

  private async createCloudflareDNSRecord(domain: DomainConfig, record: DNSRecord): Promise<void> {
    if (!domain.cloudflareZoneId) {
      throw new Error('Cloudflare zone ID not available');
    }

    try {
      const response = await this.makeCloudflareRequest(`/zones/${domain.cloudflareZoneId}/dns_records`, {
        method: 'POST',
        body: JSON.stringify({
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl,
          proxied: record.proxied
        })
      });

      this.logger.info('domain-system', `Cloudflare DNS record created: ${record.name}.${domain.domain}`, {
        recordId: response.result.id,
        type: record.type,
        content: record.content
      });

    } catch (error) {
      this.logger.error('domain-system', `Failed to create Cloudflare DNS record`, error as Error);
      throw error;
    }
  }

  private async makeCloudflareRequest(endpoint: string, options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = `https://api.cloudflare.com/client/v4${endpoint}`;
      
      const requestOptions: https.RequestOptions = {
        hostname: 'api.cloudflare.com',
        port: 443,
        path: `/client/v4${endpoint}`,
        method: options.method || 'GET',
        headers: {
          'Authorization': `Bearer ${this.cloudflareApiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.success) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.errors?.[0]?.message || 'Cloudflare API error'));
            }
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  async enableSSL(domainId: string): Promise<void> {
    const domain = this.domains.get(domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }

    try {
      domain.sslEnabled = true;
      domain.sslStatus = 'pending';
      domain.updatedAt = new Date();

      // For Cloudflare, enable Universal SSL
      if (domain.provider === 'cloudflare' && domain.cloudflareZoneId) {
        await this.enableCloudflareSSL(domain);
      }

      await this.database.query(`
        UPDATE domains 
        SET ssl_enabled = true, ssl_status = 'pending', updated_at = $1 
        WHERE id = $2
      `, [domain.updatedAt, domainId]);

      this.logger.info('domain-system', `SSL enabled for domain: ${domain.domain}`);
      this.emit('sslEnabled', { domainId, domain: domain.domain });

    } catch (error) {
      this.logger.error('domain-system', `Failed to enable SSL: ${domain.domain}`, error as Error);
      throw error;
    }
  }

  private async enableCloudflareSSL(domain: DomainConfig): Promise<void> {
    try {
      await this.makeCloudflareRequest(`/zones/${domain.cloudflareZoneId}/ssl/universal/settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          enabled: true
        })
      });

      this.logger.info('domain-system', `Cloudflare Universal SSL enabled: ${domain.domain}`);

    } catch (error) {
      this.logger.error('domain-system', `Failed to enable Cloudflare SSL: ${domain.domain}`, error as Error);
      throw error;
    }
  }

  private startVerificationInterval(): void {
    // Verify domains every hour
    this.verificationInterval = setInterval(async () => {
      for (const [domainId, domain] of this.domains.entries()) {
        if (domain.status === 'pending' || domain.status === 'error') {
          try {
            await this.verifyDomain(domainId);
          } catch (error) {
            this.logger.error('domain-system', `Scheduled verification failed: ${domain.domain}`, error as Error);
          }
        }
      }
    }, 3600000); // 1 hour
  }

  // Public API methods
  async getDomain(domainId: string): Promise<DomainConfig | null> {
    return this.domains.get(domainId) || null;
  }

  async getDomainsByUserId(userId: string): Promise<DomainConfig[]> {
    return Array.from(this.domains.values()).filter(d => d.userId === userId);
  }

  async getSubdomains(domainId: string): Promise<SubdomainConfig[]> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM subdomains WHERE domain_id = $1 ORDER BY created_at DESC',
        [domainId]
      );
      
      return rows.map(row => ({
        id: row.id,
        domainId: row.domain_id,
        subdomain: row.subdomain,
        targetIp: row.target_ip,
        targetServerId: row.target_server_id,
        type: row.type,
        status: row.status,
        sslEnabled: row.ssl_enabled,
        createdAt: row.created_at
      }));

    } catch (error) {
      this.logger.error('domain-system', `Failed to get subdomains for domain: ${domainId}`, error as Error);
      return [];
    }
  }

  async deleteDomain(domainId: string): Promise<boolean> {
    const domain = this.domains.get(domainId);
    if (!domain) {
      return false;
    }

    try {
      // Delete subdomains first
      await this.database.query('DELETE FROM subdomains WHERE domain_id = $1', [domainId]);

      // Delete from Cloudflare if applicable
      if (domain.provider === 'cloudflare' && domain.cloudflareZoneId) {
        // Note: Zone deletion requires manual confirmation in Cloudflare
        this.logger.warn('domain-system', `Cloudflare zone ${domain.cloudflareZoneId} requires manual deletion`);
      }

      // Delete from database
      await this.database.query('DELETE FROM domains WHERE id = $1', [domainId]);

      this.domains.delete(domainId);

      this.logger.info('domain-system', `Domain deleted: ${domain.domain}`);
      this.emit('domainDeleted', { domainId, domain: domain.domain });
      
      return true;

    } catch (error) {
      this.logger.error('domain-system', `Failed to delete domain: ${domain.domain}`, error as Error);
      return false;
    }
  }

  async updateDomainDNSRecords(domainId: string, records: DNSRecord[]): Promise<void> {
    const domain = this.domains.get(domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }

    try {
      domain.dnsRecords = records;
      domain.updatedAt = new Date();

      await this.database.query(`
        UPDATE domains 
        SET dns_records = $1, updated_at = $2 
        WHERE id = $3
      `, [JSON.stringify(records), domain.updatedAt, domainId]);

      this.logger.info('domain-system', `DNS records updated: ${domain.domain}`, {
        recordCount: records.length
      });

      this.emit('dnsRecordsUpdated', { domainId, records });

    } catch (error) {
      this.logger.error('domain-system', `Failed to update DNS records: ${domain.domain}`, error as Error);
      throw error;
    }
  }

  private isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    totalDomains: number;
    activeDomains: number;
    cloudflareConnected: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    let cloudflareConnected = false;

    // Check Cloudflare connection
    if (this.cloudflareApiToken) {
      try {
        await this.makeCloudflareRequest('/user/tokens/verify');
        cloudflareConnected = true;
      } catch (error) {
        issues.push('Cloudflare API connection failed');
      }
    } else {
      issues.push('Cloudflare API token not configured');
    }

    const totalDomains = this.domains.size;
    const activeDomains = Array.from(this.domains.values()).filter(d => d.status === 'active').length;

    return {
      healthy: issues.length === 0,
      totalDomains,
      activeDomains,
      cloudflareConnected,
      issues
    };
  }

  async destroy(): Promise<void> {
    if (this.verificationInterval) {
      clearInterval(this.verificationInterval);
    }
    
    this.logger.info('domain-system', 'Domain system shut down');
  }
}

export default UltraDomainSystem;
