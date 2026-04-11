import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraSSHConnect } from './ssh-connect';
import { UltraServerProviders } from './server-providers';

export interface ServerCluster {
  id: string;
  name: string;
  description: string;
  userId: string;
  servers: string[]; // Server IDs
  loadBalancerId?: string;
  primaryServerId: string;
  backupServerIds: string[];
  region: string;
  status: 'active' | 'inactive' | 'maintenance' | 'error';
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  createdAt: Date;
  updatedAt: Date;
  lastHealthCheck?: Date;
  tags: Record<string, string>;
}

export interface ServerGroup {
  id: string;
  clusterId: string;
  name: string;
  serverIds: string[];
  role: 'web' | 'api' | 'database' | 'cache' | 'storage' | 'worker';
  loadBalancingMode: 'round-robin' | 'least-connections' | 'ip-hash' | 'weighted';
  healthCheckPath?: string;
  healthCheckInterval: number; // seconds
  healthCheckTimeout: number; // seconds
  unhealthyThreshold: number;
  healthyThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServerHealth {
  serverId: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime: number;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  networkStatus?: boolean;
  servicesStatus: Record<string, boolean>;
  uptime?: number;
  errors: string[];
}

export interface ClusterMetrics {
  clusterId: string;
  totalServers: number;
  healthyServers: number;
  unhealthyServers: number;
  totalRequests: number;
  averageResponseTime: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  uptime: number;
  lastUpdated: Date;
}

export class UltraMultiServerManagement extends EventEmitter {
  private static instance: UltraMultiServerManagement;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private sshConnect: UltraSSHConnect;
  private serverProviders: UltraServerProviders;
  private clusters: Map<string, ServerCluster> = new Map();
  private serverGroups: Map<string, ServerGroup> = new Map();
  private serverHealth: Map<string, ServerHealth> = new Map();
  private clusterMetrics: Map<string, ClusterMetrics> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  static getInstance(): UltraMultiServerManagement {
    if (!UltraMultiServerManagement.instance) {
      UltraMultiServerManagement.instance = new UltraMultiServerManagement();
    }
    return UltraMultiServerManagement.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.sshConnect = UltraSSHConnect.getInstance();
    this.serverProviders = UltraServerProviders.getInstance();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize database tables
      await this.initializeDatabase();
      
      // Load existing clusters and groups
      await this.loadClusters();
      await this.loadServerGroups();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.logger.info('multi-server-management', 'Multi-server management system initialized', {
        clustersCount: this.clusters.size,
        groupsCount: this.serverGroups.size
      });

    } catch (error) {
      this.logger.error('multi-server-management', 'Failed to initialize multi-server management', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS server_clusters (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id VARCHAR(255) NOT NULL,
        servers JSONB,
        load_balancer_id VARCHAR(255),
        primary_server_id VARCHAR(255) NOT NULL,
        backup_server_ids JSONB,
        region VARCHAR(100),
        status VARCHAR(50) NOT NULL,
        health_status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_health_check TIMESTAMP,
        tags JSONB
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS server_groups (
        id VARCHAR(255) PRIMARY KEY,
        cluster_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        server_ids JSONB NOT NULL,
        role VARCHAR(50) NOT NULL,
        load_balancing_mode VARCHAR(50) NOT NULL,
        health_check_path TEXT,
        health_check_interval INTEGER NOT NULL,
        health_check_timeout INTEGER NOT NULL,
        unhealthy_threshold INTEGER NOT NULL,
        healthy_threshold INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS server_health (
        server_id VARCHAR(255) PRIMARY KEY,
        status VARCHAR(50) NOT NULL,
        last_check TIMESTAMP NOT NULL,
        response_time INTEGER,
        cpu_usage DECIMAL(5,2),
        memory_usage DECIMAL(5,2),
        disk_usage DECIMAL(5,2),
        network_status BOOLEAN,
        services_status JSONB,
        uptime INTEGER,
        errors JSONB
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS cluster_metrics (
        cluster_id VARCHAR(255) PRIMARY KEY,
        total_servers INTEGER NOT NULL,
        healthy_servers INTEGER NOT NULL,
        unhealthy_servers INTEGER NOT NULL,
        total_requests BIGINT DEFAULT 0,
        average_response_time DECIMAL(10,2),
        cpu_usage DECIMAL(5,2),
        memory_usage DECIMAL(5,2),
        disk_usage DECIMAL(5,2),
        network_in BIGINT DEFAULT 0,
        network_out BIGINT DEFAULT 0,
        uptime INTEGER,
        last_updated TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query('CREATE INDEX IF NOT EXISTS idx_server_clusters_user_id ON server_clusters(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_server_groups_cluster_id ON server_groups(cluster_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_server_health_server_id ON server_health(server_id)');
  }

  private async loadClusters(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM server_clusters');
      
      for (const row of rows) {
        const cluster: ServerCluster = {
          id: row.id,
          name: row.name,
          description: row.description,
          userId: row.user_id,
          servers: row.servers || [],
          loadBalancerId: row.load_balancer_id,
          primaryServerId: row.primary_server_id,
          backupServerIds: row.backup_server_ids || [],
          region: row.region,
          status: row.status,
          healthStatus: row.health_status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastHealthCheck: row.last_health_check,
          tags: row.tags || {}
        };
        
        this.clusters.set(cluster.id, cluster);
      }
      
      this.logger.info('multi-server-management', `Loaded ${this.clusters.size} server clusters`);
    } catch (error) {
      this.logger.error('multi-server-management', 'Failed to load server clusters', error as Error);
    }
  }

  private async loadServerGroups(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM server_groups');
      
      for (const row of rows) {
        const group: ServerGroup = {
          id: row.id,
          clusterId: row.cluster_id,
          name: row.name,
          serverIds: row.server_ids || [],
          role: row.role,
          loadBalancingMode: row.load_balancing_mode,
          healthCheckPath: row.health_check_path,
          healthCheckInterval: row.health_check_interval,
          healthCheckTimeout: row.health_check_timeout,
          unhealthyThreshold: row.unhealthy_threshold,
          healthyThreshold: row.healthy_threshold,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.serverGroups.set(group.id, group);
      }
      
      this.logger.info('multi-server-management', `Loaded ${this.serverGroups.size} server groups`);
    } catch (error) {
      this.logger.error('multi-server-management', 'Failed to load server groups', error as Error);
    }
  }

  async createCluster(config: {
    name: string;
    description?: string;
    userId: string;
    primaryServerId: string;
    backupServerIds?: string[];
    region: string;
    tags?: Record<string, string>;
  }): Promise<string> {
    const clusterId = `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate primary server exists
      const primaryServer = this.serverProviders.getServer(config.primaryServerId);
      if (!primaryServer) {
        throw new Error('Primary server not found');
      }

      const cluster: ServerCluster = {
        id: clusterId,
        name: config.name,
        description: config.description || '',
        userId: config.userId,
        servers: [config.primaryServerId, ...(config.backupServerIds || [])],
        primaryServerId: config.primaryServerId,
        backupServerIds: config.backupServerIds || [],
        region: config.region,
        status: 'active',
        healthStatus: 'healthy',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: config.tags || {}
      };

      await this.database.query(`
        INSERT INTO server_clusters (
          id, name, description, user_id, servers, primary_server_id,
          backup_server_ids, region, status, health_status, 
          created_at, updated_at, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        cluster.id,
        cluster.name,
        cluster.description,
        cluster.userId,
        JSON.stringify(cluster.servers),
        cluster.primaryServerId,
        JSON.stringify(cluster.backupServerIds),
        cluster.region,
        cluster.status,
        cluster.healthStatus,
        cluster.createdAt,
        cluster.updatedAt,
        JSON.stringify(cluster.tags)
      ]);

      this.clusters.set(clusterId, cluster);

      // Create default server groups
      await this.createDefaultServerGroups(clusterId);

      this.logger.info('multi-server-management', `Server cluster created: ${cluster.name}`, {
        clusterId,
        primaryServerId: config.primaryServerId,
        backupServersCount: config.backupServerIds?.length || 0
      });

      this.emit('clusterCreated', cluster);
      return clusterId;

    } catch (error) {
      this.logger.error('multi-server-management', `Failed to create server cluster: ${config.name}`, error as Error);
      throw error;
    }
  }

  private async createDefaultServerGroups(clusterId: string): Promise<void> {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) return;

    // Create web server group
    await this.createServerGroup({
      clusterId,
      name: 'Web Servers',
      serverIds: [cluster.primaryServerId],
      role: 'web',
      loadBalancingMode: 'round-robin',
      healthCheckInterval: 30,
      healthCheckTimeout: 5,
      unhealthyThreshold: 3,
      healthyThreshold: 2
    });

    // Create database group if backup servers exist
    if (cluster.backupServerIds.length > 0) {
      await this.createServerGroup({
        clusterId,
        name: 'Database Servers',
        serverIds: cluster.backupServerIds,
        role: 'database',
        loadBalancingMode: 'least-connections',
        healthCheckInterval: 60,
        healthCheckTimeout: 10,
        unhealthyThreshold: 2,
        healthyThreshold: 2
      });
    }
  }

  async createServerGroup(config: {
    clusterId: string;
    name: string;
    serverIds: string[];
    role: ServerGroup['role'];
    loadBalancingMode: ServerGroup['loadBalancingMode'];
    healthCheckPath?: string;
    healthCheckInterval?: number;
    healthCheckTimeout?: number;
    unhealthyThreshold?: number;
    healthyThreshold?: number;
  }): Promise<string> {
    const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const group: ServerGroup = {
        id: groupId,
        clusterId: config.clusterId,
        name: config.name,
        serverIds: config.serverIds,
        role: config.role,
        loadBalancingMode: config.loadBalancingMode,
        healthCheckPath: config.healthCheckPath,
        healthCheckInterval: config.healthCheckInterval || 30,
        healthCheckTimeout: config.healthCheckTimeout || 5,
        unhealthyThreshold: config.unhealthyThreshold || 3,
        healthyThreshold: config.healthyThreshold || 2,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO server_groups (
          id, cluster_id, name, server_ids, role, load_balancing_mode,
          health_check_path, health_check_interval, health_check_timeout,
          unhealthy_threshold, healthy_threshold, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        group.id,
        group.clusterId,
        group.name,
        JSON.stringify(group.serverIds),
        group.role,
        group.loadBalancingMode,
        group.healthCheckPath,
        group.healthCheckInterval,
        group.healthCheckTimeout,
        group.unhealthyThreshold,
        group.healthyThreshold,
        group.createdAt,
        group.updatedAt
      ]);

      this.serverGroups.set(groupId, group);

      this.logger.info('multi-server-management', `Server group created: ${group.name}`, {
        groupId,
        clusterId: config.clusterId,
        role: config.role,
        serversCount: config.serverIds.length
      });

      this.emit('serverGroupCreated', group);
      return groupId;

    } catch (error) {
      this.logger.error('multi-server-management', `Failed to create server group: ${config.name}`, error as Error);
      throw error;
    }
  }

  async addServerToCluster(clusterId: string, serverId: string): Promise<boolean> {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      throw new Error('Cluster not found');
    }

    try {
      // Validate server exists
      const server = this.serverProviders.getServer(serverId);
      if (!server) {
        throw new Error('Server not found');
      }

      // Add server to cluster
      if (!cluster.servers.includes(serverId)) {
        cluster.servers.push(serverId);
        cluster.updatedAt = new Date();

        await this.database.query(`
          UPDATE server_clusters 
          SET servers = $1, updated_at = $2 
          WHERE id = $3
        `, [JSON.stringify(cluster.servers), cluster.updatedAt, clusterId]);
      }

      this.logger.info('multi-server-management', `Server added to cluster: ${cluster.name}`, {
        clusterId,
        serverId,
        totalServers: cluster.servers.length
      });

      this.emit('serverAddedToCluster', { clusterId, serverId });
      return true;

    } catch (error) {
      this.logger.error('multi-server-management', `Failed to add server to cluster: ${cluster.name}`, error as Error);
      return false;
    }
  }

  async removeServerFromCluster(clusterId: string, serverId: string): Promise<boolean> {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      throw new Error('Cluster not found');
    }

    try {
      // Cannot remove primary server
      if (serverId === cluster.primaryServerId) {
        throw new Error('Cannot remove primary server from cluster');
      }

      // Remove server from cluster
      cluster.servers = cluster.servers.filter(id => id !== serverId);
      cluster.backupServerIds = cluster.backupServerIds.filter(id => id !== serverId);
      cluster.updatedAt = new Date();

      await this.database.query(`
        UPDATE server_clusters 
        SET servers = $1, backup_server_ids = $2, updated_at = $3 
        WHERE id = $4
      `, [
        JSON.stringify(cluster.servers),
        JSON.stringify(cluster.backupServerIds),
        cluster.updatedAt,
        clusterId
      ]);

      // Remove from all groups in this cluster
      for (const [groupId, group] of this.serverGroups.entries()) {
        if (group.clusterId === clusterId) {
          group.serverIds = group.serverIds.filter(id => id !== serverId);
          group.updatedAt = new Date();

          await this.database.query(`
            UPDATE server_groups 
            SET server_ids = $1, updated_at = $2 
            WHERE id = $3
          `, [JSON.stringify(group.serverIds), group.updatedAt, groupId]);
        }
      }

      this.logger.info('multi-server-management', `Server removed from cluster: ${cluster.name}`, {
        clusterId,
        serverId,
        totalServers: cluster.servers.length
      });

      this.emit('serverRemovedFromCluster', { clusterId, serverId });
      return true;

    } catch (error) {
      this.logger.error('multi-server-management', `Failed to remove server from cluster: ${cluster.name}`, error as Error);
      return false;
    }
  }

  private async performHealthCheck(serverId: string): Promise<ServerHealth> {
    const startTime = Date.now();
    
    try {
      const server = this.serverProviders.getServer(serverId);
      if (!server) {
        throw new Error('Server not found');
      }

      // Find SSH connection for this server
      const connections = await this.sshConnect.getConnectionsByUserId('system'); // System user
      const connection = connections.find(c => c.serverId === serverId);
      
      if (!connection) {
        throw new Error('No SSH connection found for server');
      }

      // Test basic connectivity
      const pingResult = await this.sshConnect.executeCommand(connection.id, 'echo "health-check"', 5000);
      
      const health: ServerHealth = {
        serverId,
        status: pingResult.success ? 'healthy' : 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        servicesStatus: {},
        errors: []
      };

      if (pingResult.success) {
        try {
          // Get system metrics
          const cpuResult = await this.sshConnect.executeCommand(connection.id, "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1", 5000);
          const memResult = await this.sshConnect.executeCommand(connection.id, "free | grep Mem | awk '{printf \"%.2f\", $3/$2 * 100.0}'", 5000);
          const diskResult = await this.sshConnect.executeCommand(connection.id, "df -h / | awk 'NR==2{printf \"%.2f\", $5}'", 5000);
          const uptimeResult = await this.sshConnect.executeCommand(connection.id, "cat /proc/uptime | awk '{print $1}'", 5000);

          health.cpuUsage = parseFloat(cpuResult.stdout.trim()) || 0;
          health.memoryUsage = parseFloat(memResult.stdout.trim()) || 0;
          health.diskUsage = parseFloat(diskResult.stdout.trim()) || 0;
          health.uptime = parseFloat(uptimeResult.stdout.trim()) || 0;
          health.networkStatus = true;

          // Check critical services
          const services = ['nginx', 'node', 'mysql', 'postgresql'];
          for (const service of services) {
            try {
              const serviceResult = await this.sshConnect.executeCommand(connection.id, `systemctl is-active ${service}`, 3000);
              health.servicesStatus[service] = serviceResult.stdout.trim() === 'active';
            } catch {
              health.servicesStatus[service] = false;
            }
          }

        } catch (error) {
          health.errors.push(`Failed to get system metrics: ${error.message}`);
        }
      } else {
        health.errors.push('Server not responding to ping');
      }

      // Save health status
      await this.database.query(`
        INSERT INTO server_health (
          server_id, status, last_check, response_time, cpu_usage,
          memory_usage, disk_usage, network_status, services_status,
          uptime, errors
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (server_id) DO UPDATE SET
          status = EXCLUDED.status,
          last_check = EXCLUDED.last_check,
          response_time = EXCLUDED.response_time,
          cpu_usage = EXCLUDED.cpu_usage,
          memory_usage = EXCLUDED.memory_usage,
          disk_usage = EXCLUDED.disk_usage,
          network_status = EXCLUDED.network_status,
          services_status = EXCLUDED.services_status,
          uptime = EXCLUDED.uptime,
          errors = EXCLUDED.errors
      `, [
        health.serverId,
        health.status,
        health.lastCheck,
        health.responseTime,
        health.cpuUsage,
        health.memoryUsage,
        health.diskUsage,
        health.networkStatus,
        JSON.stringify(health.servicesStatus),
        health.uptime,
        JSON.stringify(health.errors)
      ]);

      this.serverHealth.set(serverId, health);
      return health;

    } catch (error) {
      const health: ServerHealth = {
        serverId,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        errors: [`Health check failed: ${error.message}`],
        servicesStatus: {}
      };

      this.serverHealth.set(serverId, health);
      return health;
    }
  }

  private async updateClusterMetrics(clusterId: string): Promise<void> {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) return;

    try {
      const serverHealths = cluster.servers.map(serverId => this.serverHealth.get(serverId)).filter(Boolean) as ServerHealth[];
      
      const healthyServers = serverHealths.filter(h => h.status === 'healthy').length;
      const unhealthyServers = serverHealths.filter(h => h.status === 'unhealthy').length;
      
      let avgCpuUsage = 0;
      let avgMemoryUsage = 0;
      let avgDiskUsage = 0;
      let avgResponseTime = 0;

      if (serverHealths.length > 0) {
        avgCpuUsage = serverHealths.reduce((sum, h) => sum + (h.cpuUsage || 0), 0) / serverHealths.length;
        avgMemoryUsage = serverHealths.reduce((sum, h) => sum + (h.memoryUsage || 0), 0) / serverHealths.length;
        avgDiskUsage = serverHealths.reduce((sum, h) => sum + (h.diskUsage || 0), 0) / serverHealths.length;
        avgResponseTime = serverHealths.reduce((sum, h) => sum + h.responseTime, 0) / serverHealths.length;
      }

      const metrics: ClusterMetrics = {
        clusterId,
        totalServers: cluster.servers.length,
        healthyServers,
        unhealthyServers,
        totalRequests: 0, // This would be tracked by load balancer
        averageResponseTime: avgResponseTime,
        cpuUsage: avgCpuUsage,
        memoryUsage: avgMemoryUsage,
        diskUsage: avgDiskUsage,
        networkIn: 0,
        networkOut: 0,
        uptime: 0,
        lastUpdated: new Date()
      };

      await this.database.query(`
        INSERT INTO cluster_metrics (
          cluster_id, total_servers, healthy_servers, unhealthy_servers,
          average_response_time, cpu_usage, memory_usage, disk_usage,
          last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (cluster_id) DO UPDATE SET
          total_servers = EXCLUDED.total_servers,
          healthy_servers = EXCLUDED.healthy_servers,
          unhealthy_servers = EXCLUDED.unhealthy_servers,
          average_response_time = EXCLUDED.average_response_time,
          cpu_usage = EXCLUDED.cpu_usage,
          memory_usage = EXCLUDED.memory_usage,
          disk_usage = EXCLUDED.disk_usage,
          last_updated = EXCLUDED.last_updated
      `, [
        metrics.clusterId,
        metrics.totalServers,
        metrics.healthyServers,
        metrics.unhealthyServers,
        metrics.averageResponseTime,
        metrics.cpuUsage,
        metrics.memoryUsage,
        metrics.diskUsage,
        metrics.lastUpdated
      ]);

      this.clusterMetrics.set(clusterId, metrics);

      // Update cluster health status
      const previousHealthStatus = cluster.healthStatus;
      if (unhealthyServers === 0) {
        cluster.healthStatus = 'healthy';
      } else if (healthyServers > 0) {
        cluster.healthStatus = 'degraded';
      } else {
        cluster.healthStatus = 'unhealthy';
      }

      if (previousHealthStatus !== cluster.healthStatus) {
        cluster.lastHealthCheck = new Date();
        cluster.updatedAt = new Date();

        await this.database.query(`
          UPDATE server_clusters 
          SET health_status = $1, last_health_check = $2, updated_at = $3 
          WHERE id = $4
        `, [cluster.healthStatus, cluster.lastHealthCheck, cluster.updatedAt, clusterId]);

        this.emit('clusterHealthChanged', { clusterId, healthStatus: cluster.healthStatus });
      }

    } catch (error) {
      this.logger.error('multi-server-management', `Failed to update cluster metrics: ${clusterId}`, error as Error);
    }
  }

  private startHealthMonitoring(): void {
    // Perform health checks every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      for (const [clusterId, cluster] of this.clusters.entries()) {
        if (cluster.status === 'active') {
          try {
            // Check health of all servers in cluster
            for (const serverId of cluster.servers) {
              await this.performHealthCheck(serverId);
            }

            // Update cluster metrics
            await this.updateClusterMetrics(clusterId);

          } catch (error) {
            this.logger.error('multi-server-management', `Health check failed for cluster: ${cluster.name}`, error as Error);
          }
        }
      }
    }, 30000); // 30 seconds
  }

  // Public API methods
  async getCluster(clusterId: string): Promise<ServerCluster | null> {
    return this.clusters.get(clusterId) || null;
  }

  async getClustersByUserId(userId: string): Promise<ServerCluster[]> {
    return Array.from(this.clusters.values()).filter(c => c.userId === userId);
  }

  async getServerGroup(groupId: string): Promise<ServerGroup | null> {
    return this.serverGroups.get(groupId) || null;
  }

  async getServerGroupsByCluster(clusterId: string): Promise<ServerGroup[]> {
    return Array.from(this.serverGroups.values()).filter(g => g.clusterId === clusterId);
  }

  async getServerHealth(serverId: string): Promise<ServerHealth | null> {
    return this.serverHealth.get(serverId) || null;
  }

  async getClusterMetrics(clusterId: string): Promise<ClusterMetrics | null> {
    return this.clusterMetrics.get(clusterId) || null;
  }

  async deleteCluster(clusterId: string, userId: string): Promise<boolean> {
    const cluster = this.clusters.get(clusterId);
    if (!cluster || cluster.userId !== userId) {
      return false;
    }

    try {
      // Delete server groups
      for (const [groupId, group] of this.serverGroups.entries()) {
        if (group.clusterId === clusterId) {
          await this.database.query('DELETE FROM server_groups WHERE id = $1', [groupId]);
          this.serverGroups.delete(groupId);
        }
      }

      // Delete cluster
      await this.database.query('DELETE FROM server_clusters WHERE id = $1', [clusterId]);

      this.clusters.delete(clusterId);
      this.clusterMetrics.delete(clusterId);

      this.logger.info('multi-server-management', `Server cluster deleted: ${cluster.name}`, {
        clusterId
      });

      this.emit('clusterDeleted', { clusterId, name: cluster.name });
      return true;

    } catch (error) {
      this.logger.error('multi-server-management', `Failed to delete server cluster: ${cluster.name}`, error as Error);
      return false;
    }
  }

  async getManagementStats(): Promise<{
    totalClusters: number;
    activeClusters: number;
    totalGroups: number;
    totalServers: number;
    healthyServers: number;
    unhealthyServers: number;
    clustersByRegion: Record<string, number>;
  }> {
    const clusters = Array.from(this.clusters.values());
    const groups = Array.from(this.serverGroups.values());
    const healths = Array.from(this.serverHealth.values());
    
    return {
      totalClusters: clusters.length,
      activeClusters: clusters.filter(c => c.status === 'active').length,
      totalGroups: groups.length,
      totalServers: healths.length,
      healthyServers: healths.filter(h => h.status === 'healthy').length,
      unhealthyServers: healths.filter(h => h.status === 'unhealthy').length,
      clustersByRegion: clusters.reduce((acc, cluster) => {
        acc[cluster.region] = (acc[cluster.region] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    clustersCount: number;
    groupsCount: number;
    healthChecksRunning: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getManagementStats();
    
    if (stats.unhealthyServers > 0) {
      issues.push(`${stats.unhealthyServers} servers are unhealthy`);
    }
    
    if (stats.activeClusters === 0) {
      issues.push('No active clusters found');
    }

    return {
      healthy: issues.length === 0,
      clustersCount: stats.totalClusters,
      groupsCount: stats.totalGroups,
      healthChecksRunning: !!this.healthCheckInterval,
      issues
    };
  }

  async destroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.logger.info('multi-server-management', 'Multi-server management system shut down');
  }
}

export default UltraMultiServerManagement;
