import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraMultiServerManagement } from './multi-server-management';
import { UltraServerProviders } from './server-providers';

export interface LoadBalancer {
  id: string;
  name: string;
  clusterId: string;
  algorithm: 'round-robin' | 'least-connections' | 'ip-hash' | 'weighted' | 'random';
  port: number;
  sslEnabled: boolean;
  sslCertificatePath?: string;
  sslPrivateKeyPath?: string;
  healthCheckPath: string;
  healthCheckInterval: number;
  healthCheckTimeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
  sessionAffinity: boolean;
  stickySessionCookieName?: string;
  servers: LoadBalancerServer[];
  status: 'active' | 'inactive' | 'maintenance' | 'error';
  stats: LoadBalancerStats;
  createdAt: Date;
  updatedAt: Date;
  lastHealthCheck?: Date;
}

export interface LoadBalancerServer {
  id: string;
  serverId: string;
  host: string;
  port: number;
  weight: number;
  status: 'healthy' | 'unhealthy' | 'unknown';
  connectionCount: number;
  totalConnections: number;
  totalRequests: number;
  totalResponseTime: number;
  averageResponseTime: number;
  lastHealthCheck?: Date;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export interface LoadBalancerStats {
  totalRequests: number;
  totalConnections: number;
  activeConnections: number;
  totalBytesIn: number;
  totalBytesOut: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  uptime: number;
  lastReset: Date;
}

export interface LoadBalancerConfig {
  name: string;
  clusterId: string;
  algorithm: LoadBalancer['algorithm'];
  port: number;
  sslEnabled?: boolean;
  sslCertificatePath?: string;
  sslPrivateKeyPath?: string;
  healthCheckPath?: string;
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  unhealthyThreshold?: number;
  healthyThreshold?: number;
  sessionAffinity?: boolean;
  stickySessionCookieName?: string;
}

export class UltraLoadBalancer extends EventEmitter {
  private static instance: UltraLoadBalancer;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private multiServerManagement: UltraMultiServerManagement;
  private serverProviders: UltraServerProviders;
  private loadBalancers: Map<string, LoadBalancer> = new Map();
  private httpServers: Map<string, http.Server | https.Server> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): UltraLoadBalancer {
    if (!UltraLoadBalancer.instance) {
      UltraLoadBalancer.instance = new UltraLoadBalancer();
    }
    return UltraLoadBalancer.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.multiServerManagement = UltraMultiServerManagement.getInstance();
    this.serverProviders = UltraServerProviders.getInstance();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize database tables
      await this.initializeDatabase();
      
      // Load existing load balancers
      await this.loadLoadBalancers();
      
      // Start load balancers that are active
      await this.startActiveLoadBalancers();
      
      this.logger.info('load-balancer', 'Load balancer system initialized', {
        loadBalancersCount: this.loadBalancers.size,
        activeLoadBalancers: Array.from(this.loadBalancers.values()).filter(lb => lb.status === 'active').length
      });

    } catch (error) {
      this.logger.error('load-balancer', 'Failed to initialize load balancer system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS load_balancers (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        cluster_id VARCHAR(255) NOT NULL,
        algorithm VARCHAR(50) NOT NULL,
        port INTEGER NOT NULL,
        ssl_enabled BOOLEAN DEFAULT FALSE,
        ssl_certificate_path TEXT,
        ssl_private_key_path TEXT,
        health_check_path TEXT NOT NULL,
        health_check_interval INTEGER NOT NULL,
        health_check_timeout INTEGER NOT NULL,
        unhealthy_threshold INTEGER NOT NULL,
        healthy_threshold INTEGER NOT NULL,
        session_affinity BOOLEAN DEFAULT FALSE,
        sticky_session_cookie_name VARCHAR(255),
        servers JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        stats JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_health_check TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS load_balancer_requests (
        id VARCHAR(255) PRIMARY KEY,
        load_balancer_id VARCHAR(255) NOT NULL,
        server_id VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER,
        response_time INTEGER,
        bytes_in BIGINT,
        bytes_out BIGINT,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query('CREATE INDEX IF NOT EXISTS idx_load_balancers_cluster_id ON load_balancers(cluster_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_load_balancer_requests_load_balancer_id ON load_balancer_requests(load_balancer_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_load_balancer_requests_timestamp ON load_balancer_requests(timestamp)');
  }

  private async loadLoadBalancers(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM load_balancers');
      
      for (const row of rows) {
        const loadBalancer: LoadBalancer = {
          id: row.id,
          name: row.name,
          clusterId: row.cluster_id,
          algorithm: row.algorithm,
          port: row.port,
          sslEnabled: row.ssl_enabled,
          sslCertificatePath: row.ssl_certificate_path,
          sslPrivateKeyPath: row.ssl_private_key_path,
          healthCheckPath: row.health_check_path,
          healthCheckInterval: row.health_check_interval,
          healthCheckTimeout: row.health_check_timeout,
          unhealthyThreshold: row.unhealthy_threshold,
          healthyThreshold: row.healthy_threshold,
          sessionAffinity: row.session_affinity,
          stickySessionCookieName: row.sticky_session_cookie_name,
          servers: row.servers || [],
          status: row.status,
          stats: row.stats || {
            totalRequests: 0,
            totalConnections: 0,
            activeConnections: 0,
            totalBytesIn: 0,
            totalBytesOut: 0,
            averageResponseTime: 0,
            requestsPerSecond: 0,
            errorRate: 0,
            uptime: 0,
            lastReset: new Date()
          },
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastHealthCheck: row.last_health_check
        };
        
        this.loadBalancers.set(loadBalancer.id, loadBalancer);
      }
      
      this.logger.info('load-balancer', `Loaded ${this.loadBalancers.size} load balancers`);
    } catch (error) {
      this.logger.error('load-balancer', 'Failed to load load balancers', error as Error);
    }
  }

  private async startActiveLoadBalancers(): Promise<void> {
    for (const [loadBalancerId, loadBalancer] of this.loadBalancers.entries()) {
      if (loadBalancer.status === 'active') {
        try {
          await this.startLoadBalancer(loadBalancerId);
        } catch (error) {
          this.logger.error('load-balancer', `Failed to start load balancer: ${loadBalancer.name}`, error as Error);
        }
      }
    }
  }

  async createLoadBalancer(config: LoadBalancerConfig): Promise<string> {
    const loadBalancerId = `lb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate cluster exists
      const cluster = await this.multiServerManagement.getCluster(config.clusterId);
      if (!cluster) {
        throw new Error('Cluster not found');
      }

      // Get servers from cluster
      const clusterServers = await this.multiServerManagement.getServerGroupsByCluster(config.clusterId);
      const webGroup = clusterServers.find(g => g.role === 'web');
      
      if (!webGroup || webGroup.serverIds.length === 0) {
        throw new Error('No web servers found in cluster');
      }

      // Create load balancer servers
      const lbServers: LoadBalancerServer[] = [];
      for (const serverId of webGroup.serverIds) {
        const server = this.serverProviders.getServer(serverId);
        if (server) {
          lbServers.push({
            id: `lbs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            serverId,
            host: server.ipAddress,
            port: 80, // Default web server port
            weight: 1,
            status: 'unknown',
            connectionCount: 0,
            totalConnections: 0,
            totalRequests: 0,
            totalResponseTime: 0,
            averageResponseTime: 0,
            consecutiveFailures: 0,
            consecutiveSuccesses: 0
          });
        }
      }

      const loadBalancer: LoadBalancer = {
        id: loadBalancerId,
        name: config.name,
        clusterId: config.clusterId,
        algorithm: config.algorithm,
        port: config.port,
        sslEnabled: config.sslEnabled || false,
        sslCertificatePath: config.sslCertificatePath,
        sslPrivateKeyPath: config.sslPrivateKeyPath,
        healthCheckPath: config.healthCheckPath || '/health',
        healthCheckInterval: config.healthCheckInterval || 30,
        healthCheckTimeout: config.healthCheckTimeout || 5,
        unhealthyThreshold: config.unhealthyThreshold || 3,
        healthyThreshold: config.healthyThreshold || 2,
        sessionAffinity: config.sessionAffinity || false,
        stickySessionCookieName: config.stickySessionCookieName || 'ULTRA_LB_STICKY',
        servers: lbServers,
        status: 'inactive',
        stats: {
          totalRequests: 0,
          totalConnections: 0,
          activeConnections: 0,
          totalBytesIn: 0,
          totalBytesOut: 0,
          averageResponseTime: 0,
          requestsPerSecond: 0,
          errorRate: 0,
          uptime: 0,
          lastReset: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO load_balancers (
          id, name, cluster_id, algorithm, port, ssl_enabled,
          ssl_certificate_path, ssl_private_key_path, health_check_path,
          health_check_interval, health_check_timeout, unhealthy_threshold,
          healthy_threshold, session_affinity, sticky_session_cookie_name,
          servers, status, stats, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      `, [
        loadBalancer.id,
        loadBalancer.name,
        loadBalancer.clusterId,
        loadBalancer.algorithm,
        loadBalancer.port,
        loadBalancer.sslEnabled,
        loadBalancer.sslCertificatePath,
        loadBalancer.sslPrivateKeyPath,
        loadBalancer.healthCheckPath,
        loadBalancer.healthCheckInterval,
        loadBalancer.healthCheckTimeout,
        loadBalancer.unhealthyThreshold,
        loadBalancer.healthyThreshold,
        loadBalancer.sessionAffinity,
        loadBalancer.stickySessionCookieName,
        JSON.stringify(loadBalancer.servers),
        loadBalancer.status,
        JSON.stringify(loadBalancer.stats),
        loadBalancer.createdAt,
        loadBalancer.updatedAt
      ]);

      this.loadBalancers.set(loadBalancerId, loadBalancer);

      this.logger.info('load-balancer', `Load balancer created: ${loadBalancer.name}`, {
        loadBalancerId,
        clusterId: config.clusterId,
        algorithm: config.algorithm,
        serversCount: lbServers.length
      });

      this.emit('loadBalancerCreated', loadBalancer);
      return loadBalancerId;

    } catch (error) {
      this.logger.error('load-balancer', `Failed to create load balancer: ${config.name}`, error as Error);
      throw error;
    }
  }

  async startLoadBalancer(loadBalancerId: string): Promise<void> {
    const loadBalancer = this.loadBalancers.get(loadBalancerId);
    if (!loadBalancer) {
      throw new Error('Load balancer not found');
    }

    if (loadBalancer.status === 'active') {
      this.logger.warn('load-balancer', `Load balancer already active: ${loadBalancer.name}`);
      return;
    }

    try {
      // Create HTTP/HTTPS server
      let server: http.Server | https.Server;

      if (loadBalancer.sslEnabled && loadBalancer.sslCertificatePath && loadBalancer.sslPrivateKeyPath) {
        const options = {
          key: fs.readFileSync(loadBalancer.sslPrivateKeyPath),
          cert: fs.readFileSync(loadBalancer.sslCertificatePath)
        };
        server = https.createServer(options, (req, res) => this.handleRequest(loadBalancerId, req, res));
      } else {
        server = http.createServer((req, res) => this.handleRequest(loadBalancerId, req, res));
      }

      // Start listening
      server.listen(loadBalancer.port, () => {
        this.logger.info('load-balancer', `Load balancer started: ${loadBalancer.name}`, {
          loadBalancerId,
          port: loadBalancer.port,
          ssl: loadBalancer.sslEnabled
        });
      });

      server.on('error', (error) => {
        this.logger.error('load-balancer', `Load balancer server error: ${loadBalancer.name}`, error as Error);
        loadBalancer.status = 'error';
        this.emit('loadBalancerError', { loadBalancerId, error });
      });

      this.httpServers.set(loadBalancerId, server);

      // Update status
      loadBalancer.status = 'active';
      loadBalancer.updatedAt = new Date();
      loadBalancer.stats.lastReset = new Date();

      await this.database.query(`
        UPDATE load_balancers 
        SET status = 'active', updated_at = $1, stats = $2 
        WHERE id = $3
      `, [loadBalancer.updatedAt, JSON.stringify(loadBalancer.stats), loadBalancerId]);

      // Start health checks
      this.startHealthChecks(loadBalancerId);

      this.emit('loadBalancerStarted', loadBalancer);

    } catch (error) {
      loadBalancer.status = 'error';
      this.logger.error('load-balancer', `Failed to start load balancer: ${loadBalancer.name}`, error as Error);
      throw error;
    }
  }

  async stopLoadBalancer(loadBalancerId: string): Promise<void> {
    const loadBalancer = this.loadBalancers.get(loadBalancerId);
    if (!loadBalancer) {
      throw new Error('Load balancer not found');
    }

    try {
      // Stop HTTP server
      const server = this.httpServers.get(loadBalancerId);
      if (server) {
        server.close(() => {
          this.logger.info('load-balancer', `Load balancer stopped: ${loadBalancer.name}`, {
            loadBalancerId
          });
        });
        this.httpServers.delete(loadBalancerId);
      }

      // Stop health checks
      const healthInterval = this.healthCheckIntervals.get(loadBalancerId);
      if (healthInterval) {
        clearInterval(healthInterval);
        this.healthCheckIntervals.delete(loadBalancerId);
      }

      // Update status
      loadBalancer.status = 'inactive';
      loadBalancer.updatedAt = new Date();

      await this.database.query(`
        UPDATE load_balancers 
        SET status = 'inactive', updated_at = $1 
        WHERE id = $2
      `, [loadBalancer.updatedAt, loadBalancerId]);

      this.emit('loadBalancerStopped', loadBalancer);

    } catch (error) {
      this.logger.error('load-balancer', `Failed to stop load balancer: ${loadBalancer.name}`, error as Error);
      throw error;
    }
  }

  private handleRequest(loadBalancerId: string, req: http.IncomingMessage, res: http.ServerResponse): void {
    const loadBalancer = this.loadBalancers.get(loadBalancerId);
    if (!loadBalancer) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('Load Balancer Not Available');
      return;
    }

    const startTime = Date.now();

    try {
      // Select backend server
      const backendServer = this.selectBackendServer(loadBalancer, req);
      
      if (!backendServer) {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('No Healthy Servers Available');
        return;
      }

      // Update connection count
      backendServer.connectionCount++;
      backendServer.totalConnections++;

      // Proxy request to backend server
      this.proxyRequest(loadBalancer, backendServer, req, res, startTime);

    } catch (error) {
      this.logger.error('load-balancer', `Request handling error: ${loadBalancer.name}`, error as Error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  private selectBackendServer(loadBalancer: LoadBalancer, req: http.IncomingMessage): LoadBalancerServer | null {
    const healthyServers = loadBalancer.servers.filter(s => s.status === 'healthy');
    
    if (healthyServers.length === 0) {
      return null;
    }

    let selectedServer: LoadBalancerServer;

    switch (loadBalancer.algorithm) {
      case 'round-robin':
        selectedServer = healthyServers[Math.floor(Math.random() * healthyServers.length)];
        break;
      
      case 'least-connections':
        selectedServer = healthyServers.reduce((min, server) => 
          server.connectionCount < min.connectionCount ? server : min
        );
        break;
      
      case 'weighted':
        const totalWeight = healthyServers.reduce((sum, s) => sum + s.weight, 0);
        let random = Math.random() * totalWeight;
        for (const server of healthyServers) {
          random -= server.weight;
          if (random <= 0) {
            selectedServer = server;
            break;
          }
        }
        selectedServer = selectedServer || healthyServers[0];
        break;
      
      case 'ip-hash':
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || '';
        const hash = this.hashCode(clientIP);
        const index = Math.abs(hash) % healthyServers.length;
        selectedServer = healthyServers[index];
        break;
      
      case 'random':
      default:
        selectedServer = healthyServers[Math.floor(Math.random() * healthyServers.length)];
        break;
    }

    return selectedServer;
  }

  private proxyRequest(
    loadBalancer: LoadBalancer,
    backendServer: LoadBalancerServer,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    startTime: number
  ): void {
    const requestOptions: http.RequestOptions = {
      hostname: backendServer.host,
      port: backendServer.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers }
    };

    // Remove host header to avoid conflicts
    delete requestOptions.headers['host'];

    const proxyReq = http.request(requestOptions, (proxyRes) => {
      // Forward headers
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      
      // Forward response body
      proxyRes.pipe(res);

      // Update stats
      const responseTime = Date.now() - startTime;
      this.updateRequestStats(loadBalancer, backendServer, req, proxyRes, responseTime);
    });

    proxyReq.on('error', (error) => {
      this.logger.error('load-balancer', `Proxy request error: ${backendServer.host}:${backendServer.port}`, error);
      
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad Gateway');
      }

      // Mark server as unhealthy
      backendServer.consecutiveFailures++;
      if (backendServer.consecutiveFailures >= loadBalancer.unhealthyThreshold) {
        backendServer.status = 'unhealthy';
      }
    });

    // Forward request body
    req.pipe(proxyReq);

    // Handle connection close
    req.on('close', () => {
      backendServer.connectionCount--;
    });
  }

  private updateRequestStats(
    loadBalancer: LoadBalancer,
    backendServer: LoadBalancerServer,
    req: http.IncomingMessage,
    proxyRes: http.IncomingMessage,
    responseTime: number
  ): void {
    try {
      // Update server stats
      backendServer.totalRequests++;
      backendServer.totalResponseTime += responseTime;
      backendServer.averageResponseTime = backendServer.totalResponseTime / backendServer.totalRequests;
      backendServer.consecutiveSuccesses++;
      backendServer.consecutiveFailures = 0;

      if (backendServer.consecutiveSuccesses >= loadBalancer.healthyThreshold && backendServer.status !== 'healthy') {
        backendServer.status = 'healthy';
      }

      // Update load balancer stats
      loadBalancer.stats.totalRequests++;
      loadBalancer.stats.averageResponseTime = 
        (loadBalancer.stats.averageResponseTime * (loadBalancer.stats.totalRequests - 1) + responseTime) / 
        loadBalancer.stats.totalRequests;

      // Calculate requests per second
      const now = new Date();
      const timeDiff = (now.getTime() - loadBalancer.stats.lastReset.getTime()) / 1000;
      loadBalancer.stats.requestsPerSecond = loadBalancer.stats.totalRequests / timeDiff;

      // Update database asynchronously
      this.updateRequestStatsInDB(loadBalancer, backendServer, req, proxyRes, responseTime).catch(error => {
        this.logger.error('load-balancer', 'Failed to update request stats in DB', error as Error);
      });

    } catch (error) {
      this.logger.error('load-balancer', 'Failed to update request stats', error as Error);
    }
  }

  private async updateRequestStatsInDB(
    loadBalancer: LoadBalancer,
    backendServer: LoadBalancerServer,
    req: http.IncomingMessage,
    proxyRes: http.IncomingMessage,
    responseTime: number
  ): Promise<void> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await this.database.query(`
      INSERT INTO load_balancer_requests (
        id, load_balancer_id, server_id, method, path, status_code,
        response_time, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      requestId,
      loadBalancer.id,
      backendServer.serverId,
      req.method,
      req.url,
      proxyRes.statusCode,
      responseTime,
      new Date()
    ]);
  }

  private startHealthChecks(loadBalancerId: string): void {
    const loadBalancer = this.loadBalancers.get(loadBalancerId);
    if (!loadBalancer) return;

    const interval = setInterval(async () => {
      await this.performHealthChecks(loadBalancerId);
    }, loadBalancer.healthCheckInterval * 1000);

    this.healthCheckIntervals.set(loadBalancerId, interval);
  }

  private async performHealthChecks(loadBalancerId: string): Promise<void> {
    const loadBalancer = this.loadBalancers.get(loadBalancerId);
    if (!loadBalancer) return;

    for (const server of loadBalancer.servers) {
      try {
        const startTime = Date.now();
        
        const healthReq = http.request({
          hostname: server.host,
          port: server.port,
          path: loadBalancer.healthCheckPath,
          method: 'GET',
          timeout: loadBalancer.healthCheckTimeout * 1000
        }, (res) => {
          const responseTime = Date.now() - startTime;
          
          if (res.statusCode === 200) {
            server.status = 'healthy';
            server.consecutiveSuccesses++;
            server.consecutiveFailures = 0;
          } else {
            server.consecutiveFailures++;
            server.consecutiveSuccesses = 0;
            
            if (server.consecutiveFailures >= loadBalancer.unhealthyThreshold) {
              server.status = 'unhealthy';
            }
          }
          
          server.lastHealthCheck = new Date();
        });

        healthReq.on('error', () => {
          server.consecutiveFailures++;
          server.consecutiveSuccesses = 0;
          
          if (server.consecutiveFailures >= loadBalancer.unhealthyThreshold) {
            server.status = 'unhealthy';
          }
          
          server.lastHealthCheck = new Date();
        });

        healthReq.on('timeout', () => {
          healthReq.destroy();
          server.consecutiveFailures++;
          server.consecutiveSuccesses = 0;
          
          if (server.consecutiveFailures >= loadBalancer.unhealthyThreshold) {
            server.status = 'unhealthy';
          }
          
          server.lastHealthCheck = new Date();
        });

        healthReq.end();

      } catch (error) {
        server.consecutiveFailures++;
        server.consecutiveSuccesses = 0;
        
        if (server.consecutiveFailures >= loadBalancer.unhealthyThreshold) {
          server.status = 'unhealthy';
        }
        
        server.lastHealthCheck = new Date();
      }
    }

    // Update load balancer in database
    loadBalancer.lastHealthCheck = new Date();
    loadBalancer.updatedAt = new Date();

    await this.database.query(`
      UPDATE load_balancers 
      SET servers = $1, last_health_check = $2, updated_at = $3 
      WHERE id = $4
    `, [JSON.stringify(loadBalancer.servers), loadBalancer.lastHealthCheck, loadBalancer.updatedAt, loadBalancerId]);
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  // Public API methods
  async getLoadBalancer(loadBalancerId: string): Promise<LoadBalancer | null> {
    return this.loadBalancers.get(loadBalancerId) || null;
  }

  async getLoadBalancersByCluster(clusterId: string): Promise<LoadBalancer[]> {
    return Array.from(this.loadBalancers.values()).filter(lb => lb.clusterId === clusterId);
  }

  async deleteLoadBalancer(loadBalancerId: string): Promise<boolean> {
    const loadBalancer = this.loadBalancers.get(loadBalancerId);
    if (!loadBalancer) {
      return false;
    }

    try {
      // Stop load balancer if active
      if (loadBalancer.status === 'active') {
        await this.stopLoadBalancer(loadBalancerId);
      }

      // Delete from database
      await this.database.query('DELETE FROM load_balancers WHERE id = $1', [loadBalancerId]);

      this.loadBalancers.delete(loadBalancerId);

      this.logger.info('load-balancer', `Load balancer deleted: ${loadBalancer.name}`, {
        loadBalancerId
      });

      this.emit('loadBalancerDeleted', { loadBalancerId, name: loadBalancer.name });
      return true;

    } catch (error) {
      this.logger.error('load-balancer', `Failed to delete load balancer: ${loadBalancer.name}`, error as Error);
      return false;
    }
  }

  async getLoadBalancerStats(): Promise<{
    totalLoadBalancers: number;
    activeLoadBalancers: number;
    totalServers: number;
    healthyServers: number;
    unhealthyServers: number;
    totalRequests: number;
    averageResponseTime: number;
  }> {
    const loadBalancers = Array.from(this.loadBalancers.values());
    const allServers = loadBalancers.flatMap(lb => lb.servers);
    
    return {
      totalLoadBalancers: loadBalancers.length,
      activeLoadBalancers: loadBalancers.filter(lb => lb.status === 'active').length,
      totalServers: allServers.length,
      healthyServers: allServers.filter(s => s.status === 'healthy').length,
      unhealthyServers: allServers.filter(s => s.status === 'unhealthy').length,
      totalRequests: loadBalancers.reduce((sum, lb) => sum + lb.stats.totalRequests, 0),
      averageResponseTime: loadBalancers.reduce((sum, lb) => sum + lb.stats.averageResponseTime, 0) / loadBalancers.length || 0
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    loadBalancersCount: number;
    activeLoadBalancers: number;
    healthyServers: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getLoadBalancerStats();
    
    if (stats.activeLoadBalancers === 0) {
      issues.push('No active load balancers');
    }
    
    if (stats.unhealthyServers > 0) {
      issues.push(`${stats.unhealthyServers} servers are unhealthy`);
    }

    return {
      healthy: issues.length === 0,
      loadBalancersCount: stats.totalLoadBalancers,
      activeLoadBalancers: stats.activeLoadBalancers,
      healthyServers: stats.healthyServers,
      issues
    };
  }

  async destroy(): Promise<void> {
    // Stop all load balancers
    for (const [loadBalancerId] of this.loadBalancers.keys()) {
      try {
        await this.stopLoadBalancer(loadBalancerId);
      } catch (error) {
        this.logger.error('load-balancer', `Failed to stop load balancer during shutdown: ${loadBalancerId}`, error as Error);
      }
    }

    // Clear all intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    
    this.healthCheckIntervals.clear();
    this.httpServers.clear();
    
    this.logger.info('load-balancer', 'Load balancer system shut down');
  }
}

export default UltraLoadBalancer;
