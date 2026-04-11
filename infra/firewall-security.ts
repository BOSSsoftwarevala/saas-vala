import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraSSHConnect } from './ssh-connect';
import { UltraServerProviders } from './server-providers';

export interface FirewallRule {
  id: string;
  serverId: string;
  name: string;
  description: string;
  action: 'allow' | 'deny' | 'reject' | 'log';
  protocol: 'tcp' | 'udp' | 'icmp' | 'any';
  sourceIp?: string;
  sourcePort?: number;
  destinationIp?: string;
  destinationPort?: number;
  direction: 'inbound' | 'outbound' | 'both';
  priority: number;
  enabled: boolean;
  status: 'active' | 'inactive' | 'error';
  createdAt: Date;
  updatedAt: Date;
  lastApplied?: Date;
}

export interface IPBlock {
  id: string;
  serverId?: string;
  clusterId?: string;
  ipAddress: string;
  subnetMask?: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  blockType: 'temporary' | 'permanent';
  duration?: number; // seconds for temporary blocks
  expiresAt?: Date;
  createdBy: string;
  isActive: boolean;
  hitCount: number;
  lastHit?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortManagement {
  id: string;
  serverId: string;
  port: number;
  protocol: 'tcp' | 'udp';
  status: 'open' | 'closed' | 'filtered';
  service?: string;
  description: string;
  isRequired: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  lastScanned?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityScan {
  id: string;
  serverId: string;
  scanType: 'port' | 'vulnerability' | 'malware' | 'firewall' | 'full';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  results: SecurityScanResult;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  issues: SecurityIssue[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityScanResult {
  openPorts: PortManagement[];
  vulnerabilities: Vulnerability[];
  malwareDetections: MalwareDetection[];
  firewallStatus: FirewallStatus;
  overallScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface Vulnerability {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedService: string;
  cveId?: string;
  cvssScore?: number;
  recommendation: string;
  references: string[];
}

export interface MalwareDetection {
  id: string;
  type: 'virus' | 'trojan' | 'worm' | 'spyware' | 'rootkit' | 'other';
  name: string;
  path: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  action: 'quarantine' | 'remove' | 'ignore';
}

export interface FirewallStatus {
  isActive: boolean;
  rulesCount: number;
  activeRulesCount: number;
  defaultPolicy: 'allow' | 'deny';
  lastUpdated: Date;
  configuration: any;
}

export interface SecurityIssue {
  id: string;
  type: 'open_port' | 'vulnerability' | 'malware' | 'misconfiguration' | 'weak_password';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedComponent: string;
  recommendation: string;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: Date;
  resolvedAt?: Date;
}

export class UltraFirewallSecurity extends EventEmitter {
  private static instance: UltraFirewallSecurity;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private sshConnect: UltraSSHConnect;
  private serverProviders: UltraServerProviders;
  private firewallRules: Map<string, FirewallRule[]> = new Map();
  private ipBlocks: Map<string, IPBlock> = new Map();
  private portManagements: Map<string, PortManagement[]> = new Map();
  private securityScans: Map<string, SecurityScan> = new Map();
  private scanIntervals: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): UltraFirewallSecurity {
    if (!UltraFirewallSecurity.instance) {
      UltraFirewallSecurity.instance = new UltraFirewallSecurity();
    }
    return UltraFirewallSecurity.instance;
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
      
      // Load existing configurations
      await this.loadFirewallRules();
      await this.loadIPBlocks();
      await this.loadPortManagements();
      await this.loadSecurityScans();
      
      // Start periodic security scans
      this.startPeriodicScans();
      
      this.logger.info('firewall-security', 'Firewall and security system initialized', {
        firewallRulesCount: Array.from(this.firewallRules.values()).reduce((sum, rules) => sum + rules.length, 0),
        ipBlocksCount: this.ipBlocks.size,
        portManagementsCount: Array.from(this.portManagements.values()).reduce((sum, ports) => sum + ports.length, 0),
        securityScansCount: this.securityScans.size
      });

    } catch (error) {
      this.logger.error('firewall-security', 'Failed to initialize firewall security system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS firewall_rules (
        id VARCHAR(255) PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        action VARCHAR(20) NOT NULL,
        protocol VARCHAR(10) NOT NULL,
        source_ip VARCHAR(45),
        source_port INTEGER,
        destination_ip VARCHAR(45),
        destination_port INTEGER,
        direction VARCHAR(20) NOT NULL,
        priority INTEGER NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        status VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_applied TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS ip_blocks (
        id VARCHAR(255) PRIMARY KEY,
        server_id VARCHAR(255),
        cluster_id VARCHAR(255),
        ip_address VARCHAR(45) NOT NULL,
        subnet_mask VARCHAR(45),
        reason TEXT NOT NULL,
        severity VARCHAR(20) NOT NULL,
        block_type VARCHAR(20) NOT NULL,
        duration INTEGER,
        expires_at TIMESTAMP,
        created_by VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        hit_count INTEGER DEFAULT 0,
        last_hit TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS port_managements (
        id VARCHAR(255) PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL,
        protocol VARCHAR(10) NOT NULL,
        status VARCHAR(20) NOT NULL,
        service VARCHAR(100),
        description TEXT,
        is_required BOOLEAN DEFAULT FALSE,
        risk_level VARCHAR(20) NOT NULL,
        last_scanned TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS security_scans (
        id VARCHAR(255) PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        scan_type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        progress INTEGER DEFAULT 0,
        results JSONB,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        duration INTEGER,
        issues JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS security_issues (
        id VARCHAR(255) PRIMARY KEY,
        server_id VARCHAR(255),
        scan_id VARCHAR(255),
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        affected_component VARCHAR(255),
        recommendation TEXT,
        status VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_firewall_rules_server_id ON firewall_rules(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_ip_blocks_server_id ON ip_blocks(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_ip_blocks_cluster_id ON ip_blocks(cluster_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_port_managements_server_id ON port_managements(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_security_scans_server_id ON security_scans(server_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_security_issues_server_id ON security_issues(server_id)');
  }

  private async loadFirewallRules(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM firewall_rules');
      
      for (const row of rows) {
        const rule: FirewallRule = {
          id: row.id,
          serverId: row.server_id,
          name: row.name,
          description: row.description,
          action: row.action,
          protocol: row.protocol,
          sourceIp: row.source_ip,
          sourcePort: row.source_port,
          destinationIp: row.destination_ip,
          destinationPort: row.destination_port,
          direction: row.direction,
          priority: row.priority,
          enabled: row.enabled,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastApplied: row.last_applied
        };
        
        if (!this.firewallRules.has(rule.serverId)) {
          this.firewallRules.set(rule.serverId, []);
        }
        this.firewallRules.get(rule.serverId)!.push(rule);
      }
      
      this.logger.info('firewall-security', `Loaded firewall rules for ${this.firewallRules.size} servers`);
    } catch (error) {
      this.logger.error('firewall-security', 'Failed to load firewall rules', error as Error);
    }
  }

  private async loadIPBlocks(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM ip_blocks WHERE is_active = true');
      
      for (const row of rows) {
        const block: IPBlock = {
          id: row.id,
          serverId: row.server_id,
          clusterId: row.cluster_id,
          ipAddress: row.ip_address,
          subnetMask: row.subnet_mask,
          reason: row.reason,
          severity: row.severity,
          blockType: row.block_type,
          duration: row.duration,
          expiresAt: row.expires_at,
          createdBy: row.created_by,
          isActive: row.is_active,
          hitCount: row.hit_count,
          lastHit: row.last_hit,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.ipBlocks.set(block.id, block);
      }
      
      this.logger.info('firewall-security', `Loaded ${this.ipBlocks.size} active IP blocks`);
    } catch (error) {
      this.logger.error('firewall-security', 'Failed to load IP blocks', error as Error);
    }
  }

  private async loadPortManagements(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM port_managements');
      
      for (const row of rows) {
        const port: PortManagement = {
          id: row.id,
          serverId: row.server_id,
          port: row.port,
          protocol: row.protocol,
          status: row.status,
          service: row.service,
          description: row.description,
          isRequired: row.is_required,
          riskLevel: row.risk_level,
          lastScanned: row.last_scanned,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.portManagements.has(port.serverId)) {
          this.portManagements.set(port.serverId, []);
        }
        this.portManagements.get(port.serverId)!.push(port);
      }
      
      this.logger.info('firewall-security', `Loaded port management data for ${this.portManagements.size} servers`);
    } catch (error) {
      this.logger.error('firewall-security', 'Failed to load port management data', error as Error);
    }
  }

  private async loadSecurityScans(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM security_scans');
      
      for (const row of rows) {
        const scan: SecurityScan = {
          id: row.id,
          serverId: row.server_id,
          scanType: row.scan_type,
          status: row.status,
          progress: row.progress,
          results: row.results || {
            openPorts: [],
            vulnerabilities: [],
            malwareDetections: [],
            firewallStatus: {
              isActive: false,
              rulesCount: 0,
              activeRulesCount: 0,
              defaultPolicy: 'deny',
              lastUpdated: new Date(),
              configuration: {}
            },
            overallScore: 0,
            riskLevel: 'low'
          },
          startedAt: row.started_at,
          completedAt: row.completed_at,
          duration: row.duration,
          issues: row.issues || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.securityScans.set(scan.id, scan);
      }
      
      this.logger.info('firewall-security', `Loaded ${this.securityScans.size} security scans`);
    } catch (error) {
      this.logger.error('firewall-security', 'Failed to load security scans', error as Error);
    }
  }

  private startPeriodicScans(): void {
    // Perform security scans every 6 hours
    setInterval(async () => {
      await this.performPeriodicScans();
    }, 6 * 60 * 60 * 1000); // 6 hours

    // Clean up expired IP blocks every hour
    setInterval(async () => {
      await this.cleanupExpiredBlocks();
    }, 60 * 60 * 1000); // 1 hour
  }

  private async performPeriodicScans(): Promise<void> {
    const servers = this.serverProviders.getServersByUserId('system');
    
    for (const server of servers) {
      try {
        // Only scan if no scan is currently running
        const existingScan = Array.from(this.securityScans.values())
          .find(s => s.serverId === server.id && s.status === 'running');
        
        if (!existingScan) {
          await this.startSecurityScan(server.id, 'port');
        }
      } catch (error) {
        this.logger.error('firewall-security', `Failed to start periodic scan for server: ${server.id}`, error as Error);
      }
    }
  }

  private async cleanupExpiredBlocks(): Promise<void> {
    const now = new Date();
    const expiredBlocks: string[] = [];
    
    for (const [blockId, block] of this.ipBlocks.entries()) {
      if (block.blockType === 'temporary' && block.expiresAt && block.expiresAt < now) {
        expiredBlocks.push(blockId);
      }
    }
    
    for (const blockId of expiredBlocks) {
      await this.removeIPBlock(blockId);
    }
    
    if (expiredBlocks.length > 0) {
      this.logger.info('firewall-security', `Cleaned up ${expiredBlocks.length} expired IP blocks`);
    }
  }

  async createFirewallRule(rule: Omit<FirewallRule, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'lastApplied'>): Promise<string> {
    const ruleId = `fw-rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const firewallRule: FirewallRule = {
        ...rule,
        id: ruleId,
        status: 'inactive',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO firewall_rules (
          id, server_id, name, description, action, protocol,
          source_ip, source_port, destination_ip, destination_port,
          direction, priority, enabled, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        firewallRule.id,
        firewallRule.serverId,
        firewallRule.name,
        firewallRule.description,
        firewallRule.action,
        firewallRule.protocol,
        firewallRule.sourceIp,
        firewallRule.sourcePort,
        firewallRule.destinationIp,
        firewallRule.destinationPort,
        firewallRule.direction,
        firewallRule.priority,
        firewallRule.enabled,
        firewallRule.status,
        firewallRule.createdAt,
        firewallRule.updatedAt
      ]);

      if (!this.firewallRules.has(firewallRule.serverId)) {
        this.firewallRules.set(firewallRule.serverId, []);
      }
      this.firewallRules.get(firewallRule.serverId)!.push(firewallRule);

      // Apply rule if enabled
      if (firewallRule.enabled) {
        await this.applyFirewallRule(ruleId);
      }

      this.logger.info('firewall-security', `Firewall rule created: ${firewallRule.name}`, {
        ruleId,
        serverId: firewallRule.serverId,
        action: firewallRule.action,
        protocol: firewallRule.protocol
      });

      this.emit('firewallRuleCreated', firewallRule);
      return ruleId;

    } catch (error) {
      this.logger.error('firewall-security', `Failed to create firewall rule: ${rule.name}`, error as Error);
      throw error;
    }
  }

  async applyFirewallRule(ruleId: string): Promise<boolean> {
    const rule = Array.from(this.firewallRules.values())
      .flat()
      .find(r => r.id === ruleId);
    
    if (!rule) {
      throw new Error('Firewall rule not found');
    }

    try {
      // Get SSH connection for server
      const connection = await this.getSSHConnection(rule.serverId);
      if (!connection) {
        throw new Error('SSH connection not available');
      }

      // Build iptables command
      let command = 'sudo iptables';
      
      if (rule.direction === 'inbound' || rule.direction === 'both') {
        command += ' -A INPUT';
      } else {
        command += ' -A OUTPUT';
      }

      if (rule.protocol !== 'any') {
        command += ` -p ${rule.protocol}`;
      }

      if (rule.sourceIp) {
        command += ` -s ${rule.sourceIp}`;
      }

      if (rule.sourcePort) {
        command += ` --sport ${rule.sourcePort}`;
      }

      if (rule.destinationIp) {
        command += ` -d ${rule.destinationIp}`;
      }

      if (rule.destinationPort) {
        command += ` --dport ${rule.destinationPort}`;
      }

      command += ` -j ${rule.action.toUpperCase()}`;

      // Execute command
      const result = await this.sshConnect.executeCommand(connection.id, command, 10000);
      
      if (result.success) {
        rule.status = 'active';
        rule.lastApplied = new Date();
        rule.updatedAt = new Date();

        await this.database.query(`
          UPDATE firewall_rules 
          SET status = 'active', last_applied = $1, updated_at = $2 
          WHERE id = $3
        `, [rule.lastApplied, rule.updatedAt, ruleId]);

        this.logger.info('firewall-security', `Firewall rule applied: ${rule.name}`, {
          ruleId,
          command
        });

        this.emit('firewallRuleApplied', rule);
        return true;
      } else {
        rule.status = 'error';
        throw new Error(`Failed to apply rule: ${result.stderr}`);
      }

    } catch (error) {
      rule.status = 'error';
      this.logger.error('firewall-security', `Failed to apply firewall rule: ${rule.name}`, error as Error);
      return false;
    }
  }

  async blockIPAddress(config: {
    serverId?: string;
    clusterId?: string;
    ipAddress: string;
    subnetMask?: string;
    reason: string;
    severity: IPBlock['severity'];
    blockType: IPBlock['blockType'];
    duration?: number;
    createdBy: string;
  }): Promise<string> {
    const blockId = `ip-block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const block: IPBlock = {
        id: blockId,
        serverId: config.serverId,
        clusterId: config.clusterId,
        ipAddress: config.ipAddress,
        subnetMask: config.subnetMask,
        reason: config.reason,
        severity: config.severity,
        blockType: config.blockType,
        duration: config.duration,
        expiresAt: config.blockType === 'temporary' && config.duration ? 
          new Date(Date.now() + config.duration * 1000) : undefined,
        createdBy: config.createdBy,
        isActive: true,
        hitCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO ip_blocks (
          id, server_id, cluster_id, ip_address, subnet_mask, reason,
          severity, block_type, duration, expires_at, created_by,
          is_active, hit_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        block.id,
        block.serverId,
        block.clusterId,
        block.ipAddress,
        block.subnetMask,
        block.reason,
        block.severity,
        block.blockType,
        block.duration,
        block.expiresAt,
        block.createdBy,
        block.isActive,
        block.hitCount,
        block.createdAt,
        block.updatedAt
      ]);

      this.ipBlocks.set(blockId, block);

      // Apply IP block to affected servers
      await this.applyIPBlock(block);

      this.logger.warn('firewall-security', `IP address blocked: ${config.ipAddress}`, {
        blockId,
        reason: config.reason,
        severity: config.severity,
        blockType: config.blockType
      });

      this.emit('ipBlocked', block);
      return blockId;

    } catch (error) {
      this.logger.error('firewall-security', `Failed to block IP address: ${config.ipAddress}`, error as Error);
      throw error;
    }
  }

  private async applyIPBlock(block: IPBlock): Promise<void> {
    try {
      let targetServers: string[] = [];

      if (block.serverId) {
        targetServers = [block.serverId];
      } else if (block.clusterId) {
        // Get all servers in cluster
        const cluster = await this.multiServerManagement.getCluster(block.clusterId);
        if (cluster) {
          targetServers = cluster.servers;
        }
      } else {
        // Apply to all servers
        const servers = this.serverProviders.getServersByUserId('system');
        targetServers = servers.map(s => s.id);
      }

      for (const serverId of targetServers) {
        const connection = await this.getSSHConnection(serverId);
        if (!connection) continue;

        // Block IP using iptables
        const command = `sudo iptables -A INPUT -s ${block.ipAddress} -j DROP`;
        await this.sshConnect.executeCommand(connection.id, command, 5000);

        this.logger.info('firewall-security', `Applied IP block to server: ${serverId}`, {
          ipAddress: block.ipAddress,
          blockId: block.id
        });
      }

    } catch (error) {
      this.logger.error('firewall-security', `Failed to apply IP block: ${block.ipAddress}`, error as Error);
    }
  }

  async removeIPBlock(blockId: string): Promise<boolean> {
    const block = this.ipBlocks.get(blockId);
    if (!block) {
      return false;
    }

    try {
      // Remove IP block from servers
      await this.removeIPBlockFromServers(block);

      // Update database
      await this.database.query('UPDATE ip_blocks SET is_active = false WHERE id = $1', [blockId]);

      block.isActive = false;
      this.ipBlocks.delete(blockId);

      this.logger.info('firewall-security', `IP block removed: ${block.ipAddress}`, {
        blockId
      });

      this.emit('ipBlockRemoved', { blockId, ipAddress: block.ipAddress });
      return true;

    } catch (error) {
      this.logger.error('firewall-security', `Failed to remove IP block: ${block.ipAddress}`, error as Error);
      return false;
    }
  }

  private async removeIPBlockFromServers(block: IPBlock): Promise<void> {
    try {
      let targetServers: string[] = [];

      if (block.serverId) {
        targetServers = [block.serverId];
      } else if (block.clusterId) {
        const cluster = await this.multiServerManagement.getCluster(block.clusterId);
        if (cluster) {
          targetServers = cluster.servers;
        }
      } else {
        const servers = this.serverProviders.getServersByUserId('system');
        targetServers = servers.map(s => s.id);
      }

      for (const serverId of targetServers) {
        const connection = await this.getSSHConnection(serverId);
        if (!connection) continue;

        // Remove IP block using iptables
        const command = `sudo iptables -D INPUT -s ${block.ipAddress} -j DROP`;
        await this.sshConnect.executeCommand(connection.id, command, 5000);
      }

    } catch (error) {
      this.logger.error('firewall-security', `Failed to remove IP block from servers: ${block.ipAddress}`, error as Error);
    }
  }

  async startSecurityScan(serverId: string, scanType: SecurityScan['scanType']): Promise<string> {
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const scan: SecurityScan = {
        id: scanId,
        serverId,
        scanType,
        status: 'pending',
        progress: 0,
        results: {
          openPorts: [],
          vulnerabilities: [],
          malwareDetections: [],
          firewallStatus: {
            isActive: false,
            rulesCount: 0,
            activeRulesCount: 0,
            defaultPolicy: 'deny',
            lastUpdated: new Date(),
            configuration: {}
          },
          overallScore: 0,
          riskLevel: 'low'
        },
        issues: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO security_scans (
          id, server_id, scan_type, status, progress, results,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        scan.id,
        scan.serverId,
        scan.scanType,
        scan.status,
        scan.progress,
        JSON.stringify(scan.results),
        scan.createdAt,
        scan.updatedAt
      ]);

      this.securityScans.set(scanId, scan);

      // Start scan in background
      this.performSecurityScan(scanId);

      this.logger.info('firewall-security', `Security scan started: ${scanType} for server: ${serverId}`, {
        scanId,
        scanType
      });

      this.emit('securityScanStarted', scan);
      return scanId;

    } catch (error) {
      this.logger.error('firewall-security', `Failed to start security scan: ${scanType}`, error as Error);
      throw error;
    }
  }

  private async performSecurityScan(scanId: string): Promise<void> {
    const scan = this.securityScans.get(scanId);
    if (!scan) return;

    try {
      scan.status = 'running';
      scan.startedAt = new Date();
      scan.progress = 10;

      await this.updateScanInDB(scan);

      const connection = await this.getSSHConnection(scan.serverId);
      if (!connection) {
        throw new Error('SSH connection not available');
      }

      // Perform scan based on type
      switch (scan.scanType) {
        case 'port':
          await this.performPortScan(connection.id, scan);
          break;
        case 'vulnerability':
          await this.performVulnerabilityScan(connection.id, scan);
          break;
        case 'malware':
          await this.performMalwareScan(connection.id, scan);
          break;
        case 'firewall':
          await this.performFirewallScan(connection.id, scan);
          break;
        case 'full':
          await this.performFullScan(connection.id, scan);
          break;
      }

      scan.status = 'completed';
      scan.completedAt = new Date();
      scan.duration = scan.completedAt.getTime() - scan.startedAt!.getTime();
      scan.progress = 100;

      await this.updateScanInDB(scan);

      this.logger.info('firewall-security', `Security scan completed: ${scan.scanType} for server: ${scan.serverId}`, {
        scanId,
        duration: scan.duration,
        overallScore: scan.results.overallScore
      });

      this.emit('securityScanCompleted', scan);

    } catch (error) {
      scan.status = 'failed';
      scan.updatedAt = new Date();

      await this.updateScanInDB(scan);

      this.logger.error('firewall-security', `Security scan failed: ${scan.scanType}`, error as Error);
      this.emit('securityScanFailed', { scan, error });
    }
  }

  private async performPortScan(connectionId: string, scan: SecurityScan): Promise<void> {
    scan.progress = 30;

    try {
      // Scan common ports
      const commonPorts = [21, 22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 3306, 5432, 6379, 8080, 8443];
      const openPorts: PortManagement[] = [];

      for (const port of commonPorts) {
        scan.progress = 30 + (openPorts.length / commonPorts.length) * 40;

        try {
          // Check if port is open using nmap or netcat
          const command = `nc -zv localhost ${port} 2>&1 | grep -q "succeeded"`;
          const result = await this.sshConnect.executeCommand(connectionId, command, 3000);

          if (result.success) {
            const portInfo: PortManagement = {
              id: `port-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              serverId: scan.serverId,
              port,
              protocol: 'tcp',
              status: 'open',
              service: this.getServiceName(port),
              description: `Port ${port} is open`,
              isRequired: this.isRequiredPort(port),
              riskLevel: this.getPortRiskLevel(port),
              lastScanned: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            };

            openPorts.push(portInfo);
          }

        } catch (error) {
          // Port is closed or filtered
        }
      }

      scan.results.openPorts = openPorts;
      scan.progress = 70;

      // Update port management
      await this.updatePortManagement(scan.serverId, openPorts);

    } catch (error) {
      this.logger.error('firewall-security', 'Port scan failed', error as Error);
    }
  }

  private async performVulnerabilityScan(connectionId: string, scan: SecurityScan): Promise<void> {
    scan.progress = 70;

    try {
      // Check for common vulnerabilities
      const vulnerabilities: Vulnerability[] = [];

      // Check outdated packages
      const updateCommand = 'sudo apt list --upgradable 2>/dev/null | grep -v "WARNING" | wc -l';
      const updateResult = await this.sshConnect.executeCommand(connectionId, updateCommand, 10000);

      if (parseInt(updateResult.stdout.trim()) > 0) {
        vulnerabilities.push({
          id: `vuln-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          severity: 'medium',
          title: 'System packages need updates',
          description: `${updateResult.stdout.trim()} packages can be updated`,
          affectedService: 'system',
          recommendation: 'Run system updates: sudo apt update && sudo apt upgrade',
          references: []
        });
      }

      // Check SSH configuration
      const sshConfigCommand = "sudo grep '^PermitRootLogin' /etc/ssh/sshd_config";
      const sshResult = await this.sshConnect.executeCommand(connectionId, sshConfigCommand, 5000);

      if (sshResult.stdout.includes('yes')) {
        vulnerabilities.push({
          id: `vuln-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          severity: 'high',
          title: 'SSH root login enabled',
          description: 'SSH root login is permitted, which is a security risk',
          affectedService: 'ssh',
          recommendation: 'Disable root login: PermitRootLogin no',
          references: ['CWE-16']
        });
      }

      scan.results.vulnerabilities = vulnerabilities;

    } catch (error) {
      this.logger.error('firewall-security', 'Vulnerability scan failed', error as Error);
    }
  }

  private async performMalwareScan(connectionId: string, scan: SecurityScan): Promise<void> {
    scan.progress = 85;

    try {
      // Basic malware scan (would use clamav or similar in production)
      const malwareDetections: MalwareDetection[] = [];

      // Check for suspicious files in common directories
      const suspiciousPaths = ['/tmp', '/var/tmp', '/home'];
      
      for (const path of suspiciousPaths) {
        const command = `find ${path} -name "*.sh" -o -name "*.py" -o -name "*.pl" | head -10`;
        const result = await this.sshConnect.executeCommand(connectionId, command, 5000);

        if (result.stdout.trim()) {
          const files = result.stdout.trim().split('\n');
          for (const file of files) {
            if (file.trim()) {
              // In production, you'd scan the file content
              malwareDetections.push({
                id: `malware-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'other',
                name: 'Suspicious script file',
                path: file.trim(),
                severity: 'low',
                description: 'Script file found in temporary directory',
                action: 'ignore'
              });
            }
          }
        }
      }

      scan.results.malwareDetections = malwareDetections;

    } catch (error) {
      this.logger.error('firewall-security', 'Malware scan failed', error as Error);
    }
  }

  private async performFirewallScan(connectionId: string, scan: SecurityScan): Promise<void> {
    scan.progress = 90;

    try {
      // Check firewall status
      const fwCommand = 'sudo iptables -L | wc -l';
      const fwResult = await this.sshConnect.executeCommand(connectionId, fwCommand, 5000);

      const rulesCount = parseInt(fwResult.stdout.trim()) || 0;
      const serverRules = this.firewallRules.get(scan.serverId) || [];
      const activeRulesCount = serverRules.filter(r => r.status === 'active').length;

      scan.results.firewallStatus = {
        isActive: rulesCount > 0,
        rulesCount,
        activeRulesCount,
        defaultPolicy: 'deny', // Default to deny for security
        lastUpdated: new Date(),
        configuration: {
          totalRules: rulesCount,
          managedRules: activeRulesCount
        }
      };

    } catch (error) {
      this.logger.error('firewall-security', 'Firewall scan failed', error as Error);
    }
  }

  private async performFullScan(connectionId: string, scan: SecurityScan): Promise<void> {
    await this.performPortScan(connectionId, scan);
    await this.performVulnerabilityScan(connectionId, scan);
    await this.performMalwareScan(connectionId, scan);
    await this.performFirewallScan(connectionId, scan);
  }

  private async updatePortManagement(serverId: string, openPorts: PortManagement[]): Promise<void> {
    try {
      // Clear existing port management for this server
      await this.database.query('DELETE FROM port_managements WHERE server_id = $1', [serverId]);

      // Insert new port data
      for (const port of openPorts) {
        await this.database.query(`
          INSERT INTO port_managements (
            id, server_id, port, protocol, status, service, description,
            is_required, risk_level, last_scanned, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          port.id,
          port.serverId,
          port.port,
          port.protocol,
          port.status,
          port.service,
          port.description,
          port.isRequired,
          port.riskLevel,
          port.lastScanned,
          port.createdAt,
          port.updatedAt
        ]);
      }

      // Update in-memory data
      this.portManagements.set(serverId, openPorts);

    } catch (error) {
      this.logger.error('firewall-security', 'Failed to update port management', error as Error);
    }
  }

  private async updateScanInDB(scan: SecurityScan): Promise<void> {
    await this.database.query(`
      UPDATE security_scans 
      SET status = $1, progress = $2, results = $3, started_at = $4,
      completed_at = $5, duration = $6, updated_at = $7 
      WHERE id = $8
    `, [
      scan.status,
      scan.progress,
      JSON.stringify(scan.results),
      scan.startedAt,
      scan.completedAt,
      scan.duration,
      scan.updatedAt,
      scan.id
    ]);
  }

  private getServiceName(port: number): string {
    const services: Record<number, string> = {
      21: 'ftp',
      22: 'ssh',
      23: 'telnet',
      25: 'smtp',
      53: 'dns',
      80: 'http',
      110: 'pop3',
      143: 'imap',
      443: 'https',
      993: 'imaps',
      995: 'pop3s',
      3306: 'mysql',
      5432: 'postgresql',
      6379: 'redis',
      8080: 'http-alt',
      8443: 'https-alt'
    };
    return services[port] || 'unknown';
  }

  private isRequiredPort(port: number): boolean {
    const requiredPorts = [22, 80, 443]; // SSH, HTTP, HTTPS
    return requiredPorts.includes(port);
  }

  private getPortRiskLevel(port: number): PortManagement['riskLevel'] {
    const highRiskPorts = [21, 23, 25, 110, 143]; // FTP, Telnet, SMTP, POP3, IMAP
    const mediumRiskPorts = [3306, 5432, 6379]; // Database ports
    
    if (highRiskPorts.includes(port)) return 'high';
    if (mediumRiskPorts.includes(port)) return 'medium';
    return 'low';
  }

  private async getSSHConnection(serverId: string): Promise<any> {
    const connections = await this.sshConnect.getConnectionsByUserId('system');
    return connections.find(c => c.serverId === serverId);
  }

  // Public API methods
  async getFirewallRules(serverId: string): Promise<FirewallRule[]> {
    return this.firewallRules.get(serverId) || [];
  }

  async getIPBlocks(serverId?: string, clusterId?: string): Promise<IPBlock[]> {
    return Array.from(this.ipBlocks.values()).filter(block => {
      if (serverId && block.serverId !== serverId) return false;
      if (clusterId && block.clusterId !== clusterId) return false;
      return true;
    });
  }

  async getPortManagement(serverId: string): Promise<PortManagement[]> {
    return this.portManagements.get(serverId) || [];
  }

  async getSecurityScan(scanId: string): Promise<SecurityScan | null> {
    return this.securityScans.get(scanId) || null;
  }

  async getSecurityScansByServer(serverId: string): Promise<SecurityScan[]> {
    return Array.from(this.securityScans.values()).filter(s => s.serverId === serverId);
  }

  async getSecurityStats(): Promise<{
    totalFirewallRules: number;
    activeFirewallRules: number;
    totalIPBlocks: number;
    activeIPBlocks: number;
    totalPorts: number;
    openPorts: number;
    securityScans: number;
    completedScans: number;
  }> {
    const allRules = Array.from(this.firewallRules.values()).flat();
    const allPorts = Array.from(this.portManagements.values()).flat();
    const allScans = Array.from(this.securityScans.values());
    
    return {
      totalFirewallRules: allRules.length,
      activeFirewallRules: allRules.filter(r => r.status === 'active').length,
      totalIPBlocks: this.ipBlocks.size,
      activeIPBlocks: Array.from(this.ipBlocks.values()).filter(b => b.isActive).length,
      totalPorts: allPorts.length,
      openPorts: allPorts.filter(p => p.status === 'open').length,
      securityScans: allScans.length,
      completedScans: allScans.filter(s => s.status === 'completed').length
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    firewallRulesCount: number;
    ipBlocksCount: number;
    securityScansCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = await this.getSecurityStats();
    
    if (stats.activeIPBlocks > 100) {
      issues.push('High number of active IP blocks');
    }
    
    if (stats.openPorts > 50) {
      issues.push('High number of open ports detected');
    }

    return {
      healthy: issues.length === 0,
      firewallRulesCount: stats.totalFirewallRules,
      ipBlocksCount: stats.activeIPBlocks,
      securityScansCount: stats.securityScans,
      issues
    };
  }

  async destroy(): Promise<void> {
    // Clear all intervals
    for (const interval of this.scanIntervals.values()) {
      clearInterval(interval);
    }
    
    this.scanIntervals.clear();
    
    this.logger.info('firewall-security', 'Firewall and security system shut down');
  }
}

export default UltraFirewallSecurity;
