import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';

const execAsync = promisify(exec);

export interface ServerProvider {
  id: string;
  name: string;
  type: 'global' | 'vps' | 'india' | 'performance' | 'edge' | 'custom';
  apiEndpoint?: string;
  credentials?: any;
  supportedRegions: string[];
  supportedSizes: string[];
  pricing: {
    hourly: Record<string, number>;
    monthly: Record<string, number>;
  };
  features: string[];
}

export interface ServerConfig {
  id: string;
  name: string;
  provider: string;
  providerId: string;
  region: string;
  size: string;
  ipAddress: string;
  sshKeyId?: string;
  status: 'pending' | 'active' | 'error' | 'stopped' | 'rebooting';
  userId: string;
  tags: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  lastSeen?: Date;
  metrics?: ServerMetrics;
}

export interface ServerMetrics {
  cpu: number;
  memory: number;
  disk: number;
  networkIn: number;
  networkOut: number;
  uptime: number;
  loadAverage: number[];
}

export interface SSHKey {
  id: string;
  name: string;
  publicKey: string;
  fingerprint: string;
  userId: string;
  createdAt: Date;
}

export interface CreateServerRequest {
  name: string;
  provider: string;
  region: string;
  size: string;
  sshKeyId?: string;
  tags?: Record<string, string>;
  userData?: string;
}

export class UltraServerProviders extends EventEmitter {
  private static instance: UltraServerProviders;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private providers: Map<string, ServerProvider> = new Map();
  private servers: Map<string, ServerConfig> = new Map();
  private sshKeys: Map<string, SSHKey> = new Map();

  static getInstance(): UltraServerProviders {
    if (!UltraServerProviders.instance) {
      UltraServerProviders.instance = new UltraServerProviders();
    }
    return UltraServerProviders.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize database tables
      await this.initializeDatabase();
      
      // Setup providers
      this.setupProviders();
      
      // Load existing servers and keys
      await this.loadServers();
      await this.loadSSHKeys();
      
      // Start monitoring
      this.startMonitoring();
      
      this.logger.info('server-providers', 'Server providers system initialized', {
        providersCount: this.providers.size,
        serversCount: this.servers.size,
        sshKeysCount: this.sshKeys.size
      });

    } catch (error) {
      this.logger.error('server-providers', 'Failed to initialize server providers', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS server_providers (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        api_endpoint TEXT,
        credentials JSONB,
        supported_regions JSONB,
        supported_sizes JSONB,
        pricing JSONB,
        features JSONB
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS servers (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        provider VARCHAR(255) NOT NULL,
        provider_id VARCHAR(255) NOT NULL,
        region VARCHAR(100) NOT NULL,
        size VARCHAR(100) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        ssh_key_id VARCHAR(255),
        status VARCHAR(50) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        tags JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_seen TIMESTAMP,
        metrics JSONB
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS ssh_keys (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        public_key TEXT NOT NULL,
        fingerprint VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query('CREATE INDEX IF NOT EXISTS idx_servers_user_id ON servers(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_servers_provider ON servers(provider)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_ssh_keys_user_id ON ssh_keys(user_id)');
  }

  private setupProviders(): void {
    // Global Cloud Providers
    this.providers.set('aws', {
      id: 'aws',
      name: 'Amazon Web Services',
      type: 'global',
      apiEndpoint: 'https://ec2.amazonaws.com',
      supportedRegions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1', 'ap-northeast-1'],
      supportedSizes: ['t3.micro', 't3.small', 't3.medium', 't3.large', 'm5.large', 'm5.xlarge'],
      pricing: {
        hourly: { 't3.micro': 0.0104, 't3.small': 0.0208, 't3.medium': 0.0416 },
        monthly: { 't3.micro': 7.50, 't3.small': 15.00, 't3.medium': 30.00 }
      },
      features: ['auto-scaling', 'load-balancer', 'managed-database', 'cdn']
    });

    this.providers.set('gcp', {
      id: 'gcp',
      name: 'Google Cloud Platform',
      type: 'global',
      apiEndpoint: 'https://compute.googleapis.com',
      supportedRegions: ['us-central1', 'us-west1', 'europe-west1', 'asia-southeast1', 'asia-northeast1'],
      supportedSizes: ['e2-micro', 'e2-small', 'e2-medium', 'e2-standard-2', 'e2-standard-4'],
      pricing: {
        hourly: { 'e2-micro': 0.0051, 'e2-small': 0.0102, 'e2-medium': 0.0204 },
        monthly: { 'e2-micro': 3.67, 'e2-small': 7.34, 'e2-medium': 14.68 }
      },
      features: ['auto-scaling', 'load-balancer', 'managed-database', 'cdn', 'ml-platform']
    });

    this.providers.set('azure', {
      id: 'azure',
      name: 'Microsoft Azure',
      type: 'global',
      apiEndpoint: 'https://management.azure.com',
      supportedRegions: ['eastus', 'westus2', 'westeurope', 'southeastasia', 'japaneast'],
      supportedSizes: ['B1s', 'B1ms', 'B2s', 'D2s_v3', 'D4s_v3'],
      pricing: {
        hourly: { 'B1s': 0.0052, 'B1ms': 0.0104, 'B2s': 0.0416 },
        monthly: { 'B1s': 3.74, 'B1ms': 7.49, 'B2s': 29.95 }
      },
      features: ['auto-scaling', 'load-balancer', 'managed-database', 'cdn', 'devops']
    });

    // VPS Providers
    this.providers.set('digitalocean', {
      id: 'digitalocean',
      name: 'DigitalOcean',
      type: 'vps',
      apiEndpoint: 'https://api.digitalocean.com/v2',
      supportedRegions: ['nyc1', 'nyc3', 'ams3', 'fra1', 'sgp1', 'lon1'],
      supportedSizes: ['s-1vcpu-1gb', 's-1vcpu-2gb', 's-2vcpu-2gb', 's-2vcpu-4gb', 's-4vcpu-8gb'],
      pricing: {
        hourly: { 's-1vcpu-1gb': 0.007, 's-1vcpu-2gb': 0.015, 's-2vcpu-2gb': 0.022 },
        monthly: { 's-1vcpu-1gb': 5.00, 's-1vcpu-2gb': 10.00, 's-2vcpu-2gb': 15.00 }
      },
      features: ['floating-ips', 'block-storage', 'load-balancer', 'kubernetes']
    });

    this.providers.set('linode', {
      id: 'linode',
      name: 'Linode (Akamai)',
      type: 'vps',
      apiEndpoint: 'https://api.linode.com/v4',
      supportedRegions: ['us-east', 'us-west', 'eu-central', 'ap-south', 'ap-southeast'],
      supportedSizes: ['g6-nanode-1', 'g6-standard-1', 'g6-standard-2', 'g6-standard-4', 'g6-standard-8'],
      pricing: {
        hourly: { 'g6-nanode-1': 0.0075, 'g6-standard-1': 0.015, 'g6-standard-2': 0.03 },
        monthly: { 'g6-nanode-1': 5.00, 'g6-standard-1': 10.00, 'g6-standard-2': 20.00 }
      },
      features: ['nodebalancers', 'block-storage', 'object-storage', 'kubernetes']
    });

    this.providers.set('vultr', {
      id: 'vultr',
      name: 'Vultr',
      type: 'vps',
      apiEndpoint: 'https://api.vultr.com/v2',
      supportedRegions: ['ewr', 'lax', 'fra', 'sgp', 'nrt', 'syd'],
      supportedSizes: ['vc2-1c-1gb', 'vc2-1c-2gb', 'vc2-2c-4gb', 'vc2-4c-8gb', 'vc2-8c-16gb'],
      pricing: {
        hourly: { 'vc2-1c-1gb': 0.006, 'vc2-1c-2gb': 0.012, 'vc2-2c-4gb': 0.024 },
        monthly: { 'vc2-1c-1gb': 3.50, 'vc2-1c-2gb': 7.00, 'vc2-2c-4gb': 14.00 }
      },
      features: ['ddos-protection', 'block-storage', 'load-balancer', 'bare-metal']
    });

    // India/Low Cost Providers
    this.providers.set('hostinger', {
      id: 'hostinger',
      name: 'Hostinger VPS',
      type: 'india',
      supportedRegions: ['asia', 'us', 'eu'],
      supportedSizes: ['vps-1', 'vps-2', 'vps-3', 'vps-4', 'vps-5'],
      pricing: {
        hourly: { 'vps-1': 0.003, 'vps-2': 0.006, 'vps-3': 0.012 },
        monthly: { 'vps-1': 2.99, 'vps-2': 5.99, 'vps-3': 11.99 }
      },
      features: ['ssd-storage', 'daily-backups', 'ddos-protection', 'managed-support']
    });

    // High Performance Providers
    this.providers.set('ovhcloud', {
      id: 'ovhcloud',
      name: 'OVHcloud',
      type: 'performance',
      apiEndpoint: 'https://eu.api.ovh.com/1.0',
      supportedRegions: ['GRA', 'SBG', 'RBX', 'WAW', 'UK'],
      supportedSizes: ['vps-ssd-1', 'vps-ssd-2', 'vps-ssd-3', 'vps-ssd-4', 'vps-ssd-5'],
      pricing: {
        hourly: { 'vps-ssd-1': 0.004, 'vps-ssd-2': 0.008, 'vps-ssd-3': 0.016 },
        monthly: { 'vps-ssd-1': 3.50, 'vps-ssd-2': 7.00, 'vps-ssd-3': 14.00 }
      },
      features: ['ddos-protection', 'vrack', 'additional-ip', 'snapshot']
    });

    // Edge/CDN Providers
    this.providers.set('cloudflare', {
      id: 'cloudflare',
      name: 'Cloudflare Workers',
      type: 'edge',
      apiEndpoint: 'https://api.cloudflare.com/client/v4',
      supportedRegions: ['global'],
      supportedSizes: ['free', 'paid', 'enterprise'],
      pricing: {
        hourly: { 'free': 0, 'paid': 0.005, 'enterprise': 0.05 },
        monthly: { 'free': 0, 'paid': 5.00, 'enterprise': 200.00 }
      },
      features: ['edge-computing', 'cdn', 'ddos-protection', 'workers-kv']
    });

    this.logger.info('server-providers', `Setup ${this.providers.size} providers`);
  }

  private async loadServers(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM servers');
      
      for (const row of rows) {
        const server: ServerConfig = {
          id: row.id,
          name: row.name,
          provider: row.provider,
          providerId: row.provider_id,
          region: row.region,
          size: row.size,
          ipAddress: row.ip_address,
          sshKeyId: row.ssh_key_id,
          status: row.status,
          userId: row.user_id,
          tags: row.tags || {},
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastSeen: row.last_seen,
          metrics: row.metrics
        };
        
        this.servers.set(server.id, server);
      }
      
      this.logger.info('server-providers', `Loaded ${this.servers.size} servers`);
    } catch (error) {
      this.logger.error('server-providers', 'Failed to load servers', error as Error);
    }
  }

  private async loadSSHKeys(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM ssh_keys');
      
      for (const row of rows) {
        const sshKey: SSHKey = {
          id: row.id,
          name: row.name,
          publicKey: row.public_key,
          fingerprint: row.fingerprint,
          userId: row.user_id,
          createdAt: row.created_at
        };
        
        this.sshKeys.set(sshKey.id, sshKey);
      }
      
      this.logger.info('server-providers', `Loaded ${this.sshKeys.size} SSH keys`);
    } catch (error) {
      this.logger.error('server-providers', 'Failed to load SSH keys', error as Error);
    }
  }

  async createServer(request: CreateServerRequest, userId: string): Promise<string> {
    const serverId = `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const provider = this.providers.get(request.provider);
      if (!provider) {
        throw new Error(`Provider ${request.provider} not found`);
      }

      // Create server based on provider
      let providerServerId: string;
      let ipAddress: string;

      switch (request.provider) {
        case 'digitalocean':
          ({ providerServerId, ipAddress } = await this.createDigitalOceanServer(request, provider));
          break;
        case 'linode':
          ({ providerServerId, ipAddress } = await this.createLinodeServer(request, provider));
          break;
        case 'vultr':
          ({ providerServerId, ipAddress } = await this.createVultrServer(request, provider));
          break;
        default:
          throw new Error(`Provider ${request.provider} not implemented yet`);
      }

      // Save server config
      const server: ServerConfig = {
        id: serverId,
        name: request.name,
        provider: request.provider,
        providerId: providerServerId,
        region: request.region,
        size: request.size,
        ipAddress,
        sshKeyId: request.sshKeyId,
        status: 'pending',
        userId,
        tags: request.tags || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO servers (
          id, name, provider, provider_id, region, size, ip_address,
          ssh_key_id, status, user_id, tags, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        server.id,
        server.name,
        server.provider,
        server.providerId,
        server.region,
        server.size,
        server.ipAddress,
        server.sshKeyId,
        server.status,
        server.userId,
        JSON.stringify(server.tags),
        server.createdAt,
        server.updatedAt
      ]);

      this.servers.set(serverId, server);

      this.logger.info('server-providers', `Server created: ${request.name}`, {
        serverId,
        provider: request.provider,
        region: request.region,
        size: request.size,
        ipAddress
      });

      this.emit('serverCreated', server);
      return serverId;

    } catch (error) {
      this.logger.error('server-providers', `Failed to create server: ${request.name}`, error as Error);
      throw error;
    }
  }

  private async createDigitalOceanServer(request: CreateServerRequest, provider: ServerProvider): Promise<{ providerServerId: string; ipAddress: string }> {
    const apiKey = process.env.DIGITALOCEAN_API_KEY;
    if (!apiKey) {
      throw new Error('DigitalOcean API key not configured');
    }

    const userData = request.userData || this.getDefaultUserData();
    
    const body = {
      name: request.name,
      region: request.region,
      size: request.size,
      image: 'ubuntu-22-04-x64',
      ssh_keys: request.sshKeyId ? [parseInt(request.sshKeyId)] : [],
      tags: Object.keys(request.tags || {}),
      user_data: userData
    };

    const response = await this.makeProviderRequest('digitalocean', '/droplets', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    const droplet = response.droplet;
    
    // Wait for IP assignment
    let ipAddress = droplet.networks.v4.find((ip: any) => ip.type === 'public')?.ip_address;
    let attempts = 0;
    
    while (!ipAddress && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResponse = await this.makeProviderRequest('digitalocean', `/droplets/${droplet.id}`);
      ipAddress = statusResponse.droplet.networks.v4.find((ip: any) => ip.type === 'public')?.ip_address;
      attempts++;
    }

    if (!ipAddress) {
      throw new Error('Failed to get IP address from DigitalOcean');
    }

    return {
      providerServerId: droplet.id.toString(),
      ipAddress
    };
  }

  private async createLinodeServer(request: CreateServerRequest, provider: ServerProvider): Promise<{ providerServerId: string; ipAddress: string }> {
    const apiKey = process.env.LINODE_API_KEY;
    if (!apiKey) {
      throw new Error('Linode API key not configured');
    }

    const userData = request.userData || this.getDefaultUserData();
    
    const body = {
      label: request.name,
      region: request.region,
      type: request.size,
      image: 'linode/ubuntu22.04',
      authorized_keys: request.sshKeyId ? [this.sshKeys.get(request.sshKeyId)?.publicKey].filter(Boolean) : [],
      tags: Object.keys(request.tags || {}),
      root_pass: this.generateRandomPassword(),
      booted: true
    };

    const response = await this.makeProviderRequest('linode', '/linode/instances', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    const linode = response;

    // Wait for IP assignment
    let ipAddress = linode.ipv4?.[0];
    let attempts = 0;
    
    while (!ipAddress && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResponse = await this.makeProviderRequest('linode', `/linode/instances/${linode.id}`);
      ipAddress = statusResponse.ipv4?.[0];
      attempts++;
    }

    if (!ipAddress) {
      throw new Error('Failed to get IP address from Linode');
    }

    return {
      providerServerId: linode.id.toString(),
      ipAddress
    };
  }

  private async createVultrServer(request: CreateServerRequest, provider: ServerProvider): Promise<{ providerServerId: string; ipAddress: string }> {
    const apiKey = process.env.VULTR_API_KEY;
    if (!apiKey) {
      throw new Error('Vultr API key not configured');
    }

    const userData = request.userData || this.getDefaultUserData();
    
    const body = {
      label: request.name,
      region: request.region,
      plan: request.size,
      os: 387, // Ubuntu 22.04 x64
      sshkey_id: request.sshKeyId ? parseInt(request.sshKeyId) : undefined,
      tags: Object.keys(request.tags || {}),
      user_data: userData,
      enable_ipv6: true
    };

    const response = await this.makeProviderRequest('vultr', '/instances', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    const instance = response.instances[0];

    return {
      providerServerId: instance.id,
      ipAddress: instance.main_ip
    };
  }

  private async makeProviderRequest(provider: string, endpoint: string, options: any = {}): Promise<any> {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not found`);
    }

    return new Promise((resolve, reject) => {
      let apiKey: string;
      let headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      switch (provider) {
        case 'digitalocean':
          apiKey = process.env.DIGITALOCEAN_API_KEY!;
          headers['Authorization'] = `Bearer ${apiKey}`;
          break;
        case 'linode':
          apiKey = process.env.LINODE_API_KEY!;
          headers['Authorization'] = `Bearer ${apiKey}`;
          break;
        case 'vultr':
          apiKey = process.env.VULTR_API_KEY!;
          headers['Authorization'] = `Bearer ${apiKey}`;
          break;
        default:
          throw new Error(`Provider ${provider} API not implemented`);
      }

      const url = `${providerConfig.apiEndpoint}${endpoint}`;
      
      const requestOptions: https.RequestOptions = {
        hostname: new URL(url).hostname,
        port: 443,
        path: new URL(url).pathname + new URL(url).search,
        method: options.method || 'GET',
        headers,
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
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode || 'Unknown'}: ${parsed.message || parsed.error || 'Unknown error'}`));
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

  private getDefaultUserData(): string {
    return `#!/bin/bash
# Ultra Server Setup
apt-get update
apt-get install -y curl wget git nginx nodejs npm postgresql
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable
systemctl enable nginx
systemctl start nginx
`;
  }

  private generateRandomPassword(): string {
    return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
  }

  async addSSHKey(name: string, publicKey: string, userId: string): Promise<string> {
    const keyId = `sshkey-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Generate fingerprint
      const fingerprint = await this.generateSSHKeyFingerprint(publicKey);
      
      const sshKey: SSHKey = {
        id: keyId,
        name,
        publicKey,
        fingerprint,
        userId,
        createdAt: new Date()
      };

      await this.database.query(`
        INSERT INTO ssh_keys (id, name, public_key, fingerprint, user_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [sshKey.id, sshKey.name, sshKey.publicKey, sshKey.fingerprint, sshKey.userId, sshKey.createdAt]);

      this.sshKeys.set(keyId, sshKey);

      this.logger.info('server-providers', `SSH key added: ${name}`, {
        keyId,
        fingerprint
      });

      this.emit('sshKeyAdded', sshKey);
      return keyId;

    } catch (error) {
      this.logger.error('server-providers', `Failed to add SSH key: ${name}`, error as Error);
      throw error;
    }
  }

  private async generateSSHKeyFingerprint(publicKey: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`echo "${publicKey}" | ssh-keygen -lf -`);
      return stdout.trim().split(/\s+/)[1];
    } catch (error) {
      throw new Error('Invalid SSH key format');
    }
  }

  async deleteServer(serverId: string, userId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server || server.userId !== userId) {
      return false;
    }

    try {
      // Delete from provider
      switch (server.provider) {
        case 'digitalocean':
          await this.deleteDigitalOceanServer(server);
          break;
        case 'linode':
          await this.deleteLinodeServer(server);
          break;
        case 'vultr':
          await this.deleteVultrServer(server);
          break;
      }

      // Delete from database
      await this.database.query('DELETE FROM servers WHERE id = $1', [serverId]);

      this.servers.delete(serverId);

      this.logger.info('server-providers', `Server deleted: ${server.name}`, {
        serverId,
        provider: server.provider
      });

      this.emit('serverDeleted', { serverId, server: server.name });
      return true;

    } catch (error) {
      this.logger.error('server-providers', `Failed to delete server: ${server.name}`, error as Error);
      return false;
    }
  }

  private async deleteDigitalOceanServer(server: ServerConfig): Promise<void> {
    await this.makeProviderRequest('digitalocean', `/droplets/${server.providerId}`, {
      method: 'DELETE'
    });
  }

  private async deleteLinodeServer(server: ServerConfig): Promise<void> {
    await this.makeProviderRequest('linode', `/linode/instances/${server.providerId}`, {
      method: 'DELETE'
    });
  }

  private async deleteVultrServer(server: ServerConfig): Promise<void> {
    await this.makeProviderRequest('vultr', `/instances/${server.providerId}`, {
      method: 'DELETE'
    });
  }

  private startMonitoring(): void {
    // Update server status every 5 minutes
    setInterval(async () => {
      for (const [serverId, server] of this.servers.entries()) {
        try {
          await this.updateServerStatus(serverId);
        } catch (error) {
          this.logger.error('server-providers', `Failed to update server status: ${server.name}`, error as Error);
        }
      }
    }, 300000); // 5 minutes
  }

  private async updateServerStatus(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    try {
      // Check server connectivity
      const isReachable = await this.checkServerConnectivity(server.ipAddress);
      
      if (isReachable) {
        server.status = 'active';
        server.lastSeen = new Date();
        
        // Get server metrics
        server.metrics = await this.getServerMetrics(server.ipAddress);
      } else {
        server.status = 'error';
      }

      server.updatedAt = new Date();

      await this.database.query(`
        UPDATE servers 
        SET status = $1, updated_at = $2, last_seen = $3, metrics = $4 
        WHERE id = $5
      `, [server.status, server.updatedAt, server.lastSeen, JSON.stringify(server.metrics), serverId]);

    } catch (error) {
      this.logger.error('server-providers', `Failed to update server status: ${server.name}`, error as Error);
    }
  }

  private async checkServerConnectivity(ipAddress: string): Promise<boolean> {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      exec(`ping -c 1 -W 5 ${ipAddress}`, (error: any) => {
        resolve(!error);
      });
    });
  }

  private async getServerMetrics(ipAddress: string): Promise<ServerMetrics> {
    // This would typically involve SSH connection to get real metrics
    // For now, return placeholder metrics
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      networkIn: Math.random() * 1000000,
      networkOut: Math.random() * 1000000,
      uptime: Math.random() * 86400,
      loadAverage: [Math.random() * 2, Math.random() * 2, Math.random() * 2]
    };
  }

  // Public API methods
  getProviders(): ServerProvider[] {
    return Array.from(this.providers.values());
  }

  getProvider(id: string): ServerProvider | undefined {
    return this.providers.get(id);
  }

  getServersByUserId(userId: string): ServerConfig[] {
    return Array.from(this.servers.values()).filter(s => s.userId === userId);
  }

  getServer(serverId: string): ServerConfig | undefined {
    return this.servers.get(serverId);
  }

  getSSHKeysByUserId(userId: string): SSHKey[] {
    return Array.from(this.sshKeys.values()).filter(k => k.userId === userId);
  }

  async getServerStats(): Promise<{
    totalServers: number;
    activeServers: number;
    serversByProvider: Record<string, number>;
    serversByRegion: Record<string, number>;
    totalSSHKeys: number;
  }> {
    const servers = Array.from(this.servers.values());
    
    return {
      totalServers: servers.length,
      activeServers: servers.filter(s => s.status === 'active').length,
      serversByProvider: servers.reduce((acc, server) => {
        acc[server.provider] = (acc[server.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      serversByRegion: servers.reduce((acc, server) => {
        acc[server.region] = (acc[server.region] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalSSHKeys: this.sshKeys.size
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    providersCount: number;
    serversCount: number;
    sshKeysCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check API keys
    if (!process.env.DIGITALOCEAN_API_KEY) {
      issues.push('DigitalOcean API key not configured');
    }
    if (!process.env.LINODE_API_KEY) {
      issues.push('Linode API key not configured');
    }
    if (!process.env.VULTR_API_KEY) {
      issues.push('Vultr API key not configured');
    }

    return {
      healthy: issues.length === 0,
      providersCount: this.providers.size,
      serversCount: this.servers.size,
      sshKeysCount: this.sshKeys.size,
      issues
    };
  }
}

export default UltraServerProviders;
