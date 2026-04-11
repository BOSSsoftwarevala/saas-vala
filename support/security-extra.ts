import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { Message, User, Workspace, Channel } from './slack-system';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export interface SecurityPolicy {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  isActive: boolean;
  dataMasking: {
    enabled: boolean;
    fields: string[];
    patterns: Array<{
      name: string;
      regex: string;
      replacement: string;
      priority: number;
    }>;
  };
  leakPrevention: {
    enabled: boolean;
    sensitiveKeywords: string[];
    fileTypes: string[];
    scanOutgoing: boolean;
    scanIncoming: boolean;
    quarantineSuspicious: boolean;
  };
  accessControl: {
    enforceMFA: boolean;
    sessionTimeout: number; // minutes
    ipWhitelist: string[];
    ipBlacklist: string[];
    deviceTracking: boolean;
    geoRestrictions: Array<{
      country: string;
      action: 'allow' | 'block' | 'monitor';
    }>;
  };
  encryption: {
    encryptMessages: boolean;
    encryptFiles: boolean;
    keyRotationDays: number;
    algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305';
  };
  audit: {
    logAllAccess: boolean;
    logDataAccess: boolean;
    logFailedAttempts: boolean;
    retentionDays: number;
    alertOnAnomalies: boolean;
  };
  compliance: {
    gdpr: boolean;
    hipaa: boolean;
    pci: boolean;
    sox: boolean;
    customFrameworks: string[];
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataMaskingRule {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  fieldType: 'email' | 'phone' | 'ssn' | 'credit_card' | 'custom';
  pattern: string;
  replacement: string;
  preserveFormat: boolean;
  isActive: boolean;
  priority: number;
  contexts: string[]; // Where to apply: messages, files, logs, exports
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeakDetection {
  id: string;
  workspaceId: string;
  type: 'keyword' | 'pattern' | 'ml' | 'hash';
  name: string;
  description: string;
  pattern?: string;
  keywords?: string[];
  threshold: number; // 0-1
  action: 'alert' | 'block' | 'quarantine' | 'redact';
  isActive: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityIncident {
  id: string;
  workspaceId: string;
  type: 'data_leak' | 'unauthorized_access' | 'suspicious_activity' | 'policy_violation' | 'system_breach';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  source: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
  };
  details: {
    dataType?: string;
    field?: string;
    content?: string;
    policyId?: string;
    ruleId?: string;
  };
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  actions: Array<{
    type: 'block' | 'quarantine' | 'alert' | 'redact' | 'notify';
    description: string;
    timestamp: Date;
    performedBy?: string;
  }>;
  metadata: {
    detectionMethod: string;
    confidence: number; // 0-1
    falsePositiveVotes: number;
    truePositiveVotes: number;
  };
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface SecurityAudit {
  id: string;
  workspaceId: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details: Record<string, any>;
  riskScore: number; // 0-100
  category: 'authentication' | 'authorization' | 'data_access' | 'configuration' | 'system';
  timestamp: Date;
}

export interface ComplianceReport {
  id: string;
  workspaceId: string;
  framework: 'GDPR' | 'HIPAA' | 'PCI' | 'SOX' | 'CUSTOM';
  period: {
    start: Date;
    end: Date;
  };
  status: 'compliant' | 'non_compliant' | 'partial' | 'pending';
  score: number; // 0-100
  findings: Array<{
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
    status: 'open' | 'remediated' | 'accepted';
  }>;
  evidence: Array<{
    type: string;
    description: string;
    url?: string;
    timestamp: Date;
  }>;
  generatedAt: Date;
  generatedBy: string;
}

export class UltraSecurityExtra extends EventEmitter {
  private static instance: UltraSecurityExtra;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  
  private policies: Map<string, Map<string, SecurityPolicy>> = new Map(); // workspaceId -> policyId -> policy
  private maskingRules: Map<string, Map<string, DataMaskingRule>> = new Map(); // workspaceId -> ruleId -> rule
  private leakDetections: Map<string, Map<string, LeakDetection>> = new Map(); // workspaceId -> detectionId -> detection
  private encryptionKeys: Map<string, string> = new Map(); // workspaceId -> key

  static getInstance(): UltraSecurityExtra {
    if (!UltraSecurityExtra.instance) {
      UltraSecurityExtra.instance = new UltraSecurityExtra();
    }
    return UltraSecurityExtra.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.accessControl = UltraAccessControl.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadPolicies();
      await this.loadMaskingRules();
      await this.loadLeakDetections();
      await this.initializeEncryption();
      
      this.logger.info('security-extra', 'Security extra system initialized', {
        policiesCount: Array.from(this.policies.values()).reduce((sum, policies) => sum + policies.size, 0),
        maskingRulesCount: Array.from(this.maskingRules.values()).reduce((sum, rules) => sum + rules.size, 0),
        leakDetectionsCount: Array.from(this.leakDetections.values()).reduce((sum, detections) => sum + detections.size, 0),
        encryptionKeysCount: this.encryptionKeys.size
      });
    } catch (error) {
      this.logger.error('security-extra', 'Failed to initialize security extra system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS security_policies (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        data_masking JSONB NOT NULL,
        leak_prevention JSONB NOT NULL,
        access_control JSONB NOT NULL,
        encryption JSONB NOT NULL,
        audit JSONB NOT NULL,
        compliance JSONB NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS data_masking_rules (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        field_type VARCHAR(20) NOT NULL,
        pattern VARCHAR(500) NOT NULL,
        replacement VARCHAR(255) NOT NULL,
        preserve_format BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        priority INTEGER DEFAULT 0,
        contexts TEXT[] NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS leak_detections (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        pattern VARCHAR(500),
        keywords TEXT[],
        threshold DECIMAL(3,2) NOT NULL,
        action VARCHAR(20) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        severity VARCHAR(20) NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS security_incidents (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        type VARCHAR(30) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        source JSONB NOT NULL,
        details JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        actions JSONB NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        resolved_by VARCHAR(255)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS security_audits (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        success BOOLEAN NOT NULL,
        details JSONB NOT NULL,
        risk_score INTEGER NOT NULL,
        category VARCHAR(30) NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS compliance_reports (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        framework VARCHAR(20) NOT NULL,
        period JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        score INTEGER NOT NULL,
        findings JSONB NOT NULL,
        evidence JSONB NOT NULL,
        generated_at TIMESTAMP DEFAULT NOW(),
        generated_by VARCHAR(255) NOT NULL
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_security_policies_workspace_id ON security_policies(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_data_masking_rules_workspace_id ON data_masking_rules(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_leak_detections_workspace_id ON leak_detections(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_security_incidents_workspace_id ON security_incidents(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_security_audits_workspace_id ON security_audits(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_security_audits_timestamp ON security_audits(timestamp)');
  }

  private async loadPolicies(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM security_policies WHERE is_active = TRUE');
      
      for (const row of rows) {
        const policy: SecurityPolicy = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          isActive: row.is_active,
          dataMasking: row.data_masking || {},
          leakPrevention: row.leak_prevention || {},
          accessControl: row.access_control || {},
          encryption: row.encryption || {},
          audit: row.audit || {},
          compliance: row.compliance || {},
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.policies.has(policy.workspaceId)) {
          this.policies.set(policy.workspaceId, new Map());
        }
        this.policies.get(policy.workspaceId)!.set(policy.id, policy);
      }
      
      this.logger.info('security-extra', `Loaded policies for ${this.policies.size} workspaces`);
    } catch (error) {
      this.logger.error('security-extra', 'Failed to load policies', error as Error);
    }
  }

  private async loadMaskingRules(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM data_masking_rules WHERE is_active = TRUE ORDER BY priority DESC');
      
      for (const row of rows) {
        const rule: DataMaskingRule = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          fieldType: row.field_type,
          pattern: row.pattern,
          replacement: row.replacement,
          preserveFormat: row.preserve_format,
          isActive: row.is_active,
          priority: row.priority,
          contexts: row.contexts || [],
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.maskingRules.has(rule.workspaceId)) {
          this.maskingRules.set(rule.workspaceId, new Map());
        }
        this.maskingRules.get(rule.workspaceId)!.set(rule.id, rule);
      }
      
      this.logger.info('security-extra', `Loaded masking rules for ${this.maskingRules.size} workspaces`);
    } catch (error) {
      this.logger.error('security-extra', 'Failed to load masking rules', error as Error);
    }
  }

  private async loadLeakDetections(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM leak_detections WHERE is_active = TRUE');
      
      for (const row of rows) {
        const detection: LeakDetection = {
          id: row.id,
          workspaceId: row.workspace_id,
          type: row.type,
          name: row.name,
          description: row.description,
          pattern: row.pattern,
          keywords: row.keywords || [],
          threshold: parseFloat(row.threshold),
          action: row.action,
          isActive: row.is_active,
          severity: row.severity,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.leakDetections.has(detection.workspaceId)) {
          this.leakDetections.set(detection.workspaceId, new Map());
        }
        this.leakDetections.get(detection.workspaceId)!.set(detection.id, detection);
      }
      
      this.logger.info('security-extra', `Loaded leak detections for ${this.leakDetections.size} workspaces`);
    } catch (error) {
      this.logger.error('security-extra', 'Failed to load leak detections', error as Error);
    }
  }

  private async initializeEncryption(): Promise<void> {
    try {
      // Generate encryption keys for workspaces that don't have them
      const workspaces = await this.database.query('SELECT DISTINCT workspace_id FROM security_policies WHERE is_active = TRUE');
      
      for (const row of workspaces.rows) {
        const workspaceId = row.workspace_id;
        
        if (!this.encryptionKeys.has(workspaceId)) {
          const key = crypto.randomBytes(32).toString('hex');
          this.encryptionKeys.set(workspaceId, key);
          
          // In production, store keys securely (e.g., AWS KMS, Azure Key Vault)
          this.logger.info('security-extra', `Generated encryption key for workspace: ${workspaceId}`);
        }
      }
      
    } catch (error) {
      this.logger.error('security-extra', 'Failed to initialize encryption', error as Error);
    }
  }

  // PUBLIC API METHODS
  async createSecurityPolicy(config: {
    workspaceId: string;
    name: string;
    description?: string;
    dataMasking?: SecurityPolicy['dataMasking'];
    leakPrevention?: SecurityPolicy['leakPrevention'];
    accessControl?: SecurityPolicy['accessControl'];
    encryption?: SecurityPolicy['encryption'];
    audit?: SecurityPolicy['audit'];
    compliance?: SecurityPolicy['compliance'];
    createdBy: string;
  }): Promise<string> {
    const policyId = `policy-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const policy: SecurityPolicy = {
        id: policyId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        isActive: true,
        dataMasking: config.dataMasking || {
          enabled: false,
          fields: [],
          patterns: []
        },
        leakPrevention: config.leakPrevention || {
          enabled: false,
          sensitiveKeywords: [],
          fileTypes: [],
          scanOutgoing: false,
          scanIncoming: false,
          quarantineSuspicious: false
        },
        accessControl: config.accessControl || {
          enforceMFA: false,
          sessionTimeout: 60,
          ipWhitelist: [],
          ipBlacklist: [],
          deviceTracking: false,
          geoRestrictions: []
        },
        encryption: config.encryption || {
          encryptMessages: false,
          encryptFiles: false,
          keyRotationDays: 90,
          algorithm: 'AES-256-GCM'
        },
        audit: config.audit || {
          logAllAccess: false,
          logDataAccess: false,
          logFailedAttempts: false,
          retentionDays: 90,
          alertOnAnomalies: false
        },
        compliance: config.compliance || {
          gdpr: false,
          hipaa: false,
          pci: false,
          sox: false,
          customFrameworks: []
        },
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO security_policies (
          id, workspace_id, name, description, is_active, data_masking, leak_prevention,
          access_control, encryption, audit, compliance, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        policy.id,
        policy.workspaceId,
        policy.name,
        policy.description,
        policy.isActive,
        JSON.stringify(policy.dataMasking),
        JSON.stringify(policy.leakPrevention),
        JSON.stringify(policy.accessControl),
        JSON.stringify(policy.encryption),
        JSON.stringify(policy.audit),
        JSON.stringify(policy.compliance),
        policy.createdBy,
        policy.createdAt,
        policy.updatedAt
      ]);
      
      if (!this.policies.has(policy.workspaceId)) {
        this.policies.set(policy.workspaceId, new Map());
      }
      this.policies.get(policy.workspaceId)!.set(policy.id, policy);
      
      // Generate encryption key if needed
      if (policy.encryption.encryptMessages || policy.encryption.encryptFiles) {
        if (!this.encryptionKeys.has(policy.workspaceId)) {
          const key = crypto.randomBytes(32).toString('hex');
          this.encryptionKeys.set(policy.workspaceId, key);
        }
      }
      
      this.emit('policyCreated', policy);
      return policyId;
      
    } catch (error) {
      this.logger.error('security-extra', `Failed to create security policy: ${policyId}`, error as Error);
      throw error;
    }
  }

  async maskSensitiveData(config: {
    workspaceId: string;
    data: any;
    context: 'messages' | 'files' | 'logs' | 'exports';
    userId?: string;
  }): Promise<any> {
    try {
      const policy = this.getPolicy(config.workspaceId);
      if (!policy || !policy.dataMasking.enabled) {
        return config.data;
      }
      
      const rules = this.maskingRules.get(config.workspaceId);
      if (!rules || rules.size === 0) {
        return config.data;
      }
      
      let maskedData = JSON.parse(JSON.stringify(config.data)); // Deep copy
      
      // Apply masking rules
      for (const rule of rules.values()) {
        if (rule.contexts.includes(config.context)) {
          maskedData = await this.applyMaskingRule(maskedData, rule);
        }
      }
      
      // Apply policy-level patterns
      for (const pattern of policy.dataMasking.patterns) {
        maskedData = await this.applyPatternMasking(maskedData, pattern);
      }
      
      // Log data access
      await this.logSecurityAudit({
        workspaceId: config.workspaceId,
        userId: config.userId,
        action: 'data_masking_applied',
        resource: 'data',
        success: true,
        details: { context, rulesApplied: rules.size },
        riskScore: 20,
        category: 'data_access'
      });
      
      return maskedData;
      
    } catch (error) {
      this.logger.error('security-extra', 'Failed to mask sensitive data', error as Error);
      return config.data;
    }
  }

  async scanForLeaks(config: {
    workspaceId: string;
    content: string;
    type: 'message' | 'file' | 'email';
    userId?: string;
    metadata?: any;
  }): Promise<{
    detected: boolean;
    detections: Array<{
      ruleId: string;
      ruleName: string;
      severity: string;
      confidence: number;
      action: string;
    }>;
    action: 'allow' | 'block' | 'quarantine';
  }> {
    try {
      const policy = this.getPolicy(config.workspaceId);
      if (!policy || !policy.leakPrevention.enabled) {
        return { detected: false, detections: [], action: 'allow' };
      }
      
      const detections = await this.performLeakDetection(config.workspaceId, config.content, config.type);
      const detected = detections.length > 0;
      
      let action: 'allow' | 'block' | 'quarantine' = 'allow';
      
      if (detected) {
        // Determine action based on highest severity detection
        const highestSeverity = detections.reduce((prev, current) => {
          const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
          return severityOrder[current.severity] > severityOrder[prev.severity] ? current : prev;
        });
        
        action = highestSeverity.action as 'allow' | 'block' | 'quarantine';
        
        // Create security incident
        await this.createSecurityIncident({
          workspaceId: config.workspaceId,
          type: 'data_leak',
          severity: highestSeverity.severity,
          title: `Potential data leak detected in ${config.type}`,
          description: `Suspicious content detected: ${config.content.substring(0, 100)}...`,
          source: { userId: config.userId },
          details: {
            content: config.content,
            type: config.type,
            detections: detections
          },
          metadata: {
            detectionMethod: 'automated_scan',
            confidence: highestSeverity.confidence,
            falsePositiveVotes: 0,
            truePositiveVotes: 0
          }
        });
      }
      
      return { detected, detections, action };
      
    } catch (error) {
      this.logger.error('security-extra', 'Failed to scan for leaks', error as Error);
      return { detected: false, detections: [], action: 'allow' };
    }
  }

  async encryptData(config: {
    workspaceId: string;
    data: string;
    type: 'message' | 'file';
  }): Promise<string> {
    try {
      const policy = this.getPolicy(config.workspaceId);
      if (!policy) {
        return config.data;
      }
      
      const shouldEncrypt = (config.type === 'message' && policy.encryption.encryptMessages) ||
                           (config.type === 'file' && policy.encryption.encryptFiles);
      
      if (!shouldEncrypt) {
        return config.data;
      }
      
      const key = this.encryptionKeys.get(config.workspaceId);
      if (!key) {
        throw new Error('Encryption key not found for workspace');
      }
      
      const algorithm = policy.encryption.algorithm;
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, Buffer.from(key, 'hex'));
      
      let encrypted = cipher.update(config.data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine IV and encrypted data
      const result = iv.toString('hex') + ':' + encrypted;
      
      await this.logSecurityAudit({
        workspaceId: config.workspaceId,
        action: 'data_encrypted',
        resource: config.type,
        success: true,
        details: { algorithm, length: config.data.length },
        riskScore: 10,
        category: 'data_access'
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('security-extra', 'Failed to encrypt data', error as Error);
      return config.data;
    }
  }

  async decryptData(config: {
    workspaceId: string;
    encryptedData: string;
    type: 'message' | 'file';
  }): Promise<string> {
    try {
      const key = this.encryptionKeys.get(config.workspaceId);
      if (!key) {
        throw new Error('Encryption key not found for workspace');
      }
      
      const parts = config.encryptedData.split(':');
      if (parts.length !== 2) {
        return config.encryptedData; // Not encrypted
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipher('AES-256-GCM', Buffer.from(key, 'hex'));
      decipher.setAAD(Buffer.from('additional-data'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      await this.logSecurityAudit({
        workspaceId: config.workspaceId,
        action: 'data_decrypted',
        resource: config.type,
        success: true,
        details: { length: decrypted.length },
        riskScore: 10,
        category: 'data_access'
      });
      
      return decrypted;
      
    } catch (error) {
      this.logger.error('security-extra', 'Failed to decrypt data', error as Error);
      return config.encryptedData;
    }
  }

  async createSecurityIncident(config: {
    workspaceId: string;
    type: SecurityIncident['type'];
    severity: SecurityIncident['severity'];
    title: string;
    description: string;
    source?: SecurityIncident['source'];
    details: SecurityIncident['details'];
    metadata?: SecurityIncident['metadata'];
  }): Promise<string> {
    const incidentId = `incident-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const incident: SecurityIncident = {
        id: incidentId,
        workspaceId: config.workspaceId,
        type: config.type,
        severity: config.severity,
        title: config.title,
        description: config.description,
        source: config.source || {},
        details: config.details,
        status: 'open',
        actions: [],
        metadata: config.metadata || {
          detectionMethod: 'manual',
          confidence: 0.5,
          falsePositiveVotes: 0,
          truePositiveVotes: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO security_incidents (
          id, workspace_id, type, severity, title, description, source, details,
          status, actions, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        incident.id,
        incident.workspaceId,
        incident.type,
        incident.severity,
        incident.title,
        incident.description,
        JSON.stringify(incident.source),
        JSON.stringify(incident.details),
        incident.status,
        JSON.stringify(incident.actions),
        JSON.stringify(incident.metadata),
        incident.createdAt,
        incident.updatedAt
      ]);
      
      this.emit('securityIncident', incident);
      return incidentId;
      
    } catch (error) {
      this.logger.error('security-extra', `Failed to create security incident: ${incidentId}`, error as Error);
      throw error;
    }
  }

  async generateComplianceReport(config: {
    workspaceId: string;
    framework: ComplianceReport['framework'];
    period: { start: Date; end: Date };
    generatedBy: string;
  }): Promise<string> {
    const reportId = `report-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const report: ComplianceReport = {
        id: reportId,
        workspaceId: config.workspaceId,
        framework: config.framework,
        period: config.period,
        status: 'pending',
        score: 0,
        findings: [],
        evidence: [],
        generatedAt: new Date(),
        generatedBy: config.generatedBy
      };
      
      // Perform compliance assessment
      const assessment = await this.assessCompliance(config.workspaceId, config.framework, config.period);
      
      report.status = assessment.status;
      report.score = assessment.score;
      report.findings = assessment.findings;
      report.evidence = assessment.evidence;
      
      await this.database.query(`
        INSERT INTO compliance_reports (
          id, workspace_id, framework, period, status, score, findings, evidence, generated_at, generated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        report.id,
        report.workspaceId,
        report.framework,
        JSON.stringify(report.period),
        report.status,
        report.score,
        JSON.stringify(report.findings),
        JSON.stringify(report.evidence),
        report.generatedAt,
        report.generatedBy
      ]);
      
      this.emit('complianceReportGenerated', report);
      return reportId;
      
    } catch (error) {
      this.logger.error('security-extra', `Failed to generate compliance report: ${reportId}`, error as Error);
      throw error;
    }
  }

  async getSecurityIncidents(workspaceId: string, filters?: {
    type?: SecurityIncident['type'];
    severity?: SecurityIncident['severity'];
    status?: SecurityIncident['status'];
    dateRange?: { start: Date; end: Date };
  }): Promise<SecurityIncident[]> {
    try {
      let sql = 'SELECT * FROM security_incidents WHERE workspace_id = $1';
      const params: any[] = [workspaceId];
      
      if (filters?.type) {
        sql += ' AND type = $' + (params.length + 1);
        params.push(filters.type);
      }
      
      if (filters?.severity) {
        sql += ' AND severity = $' + (params.length + 1);
        params.push(filters.severity);
      }
      
      if (filters?.status) {
        sql += ' AND status = $' + (params.length + 1);
        params.push(filters.status);
      }
      
      if (filters?.dateRange) {
        sql += ' AND created_at >= $' + (params.length + 1) + ' AND created_at <= $' + (params.length + 2);
        params.push(filters.dateRange.start, filters.dateRange.end);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      const rows = await this.database.query(sql, params);
      
      return rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        type: row.type,
        severity: row.severity,
        title: row.title,
        description: row.description,
        source: row.source || {},
        details: row.details || {},
        status: row.status,
        actions: row.actions || [],
        metadata: row.metadata || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        resolvedAt: row.resolved_at,
        resolvedBy: row.resolved_by
      }));
      
    } catch (error) {
      this.logger.error('security-extra', 'Failed to get security incidents', error as Error);
      return [];
    }
  }

  async getSecurityAudit(workspaceId: string, filters?: {
    userId?: string;
    category?: SecurityAudit['category'];
    dateRange?: { start: Date; end: Date };
  }): Promise<SecurityAudit[]> {
    try {
      let sql = 'SELECT * FROM security_audits WHERE workspace_id = $1';
      const params: any[] = [workspaceId];
      
      if (filters?.userId) {
        sql += ' AND user_id = $' + (params.length + 1);
        params.push(filters.userId);
      }
      
      if (filters?.category) {
        sql += ' AND category = $' + (params.length + 1);
        params.push(filters.category);
      }
      
      if (filters?.dateRange) {
        sql += ' AND timestamp >= $' + (params.length + 1) + ' AND timestamp <= $' + (params.length + 2);
        params.push(filters.dateRange.start, filters.dateRange.end);
      }
      
      sql += ' ORDER BY timestamp DESC LIMIT 1000';
      
      const rows = await this.database.query(sql, params);
      
      return rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        userId: row.user_id,
        action: row.action,
        resource: row.resource,
        resourceId: row.resource_id,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        success: row.success,
        details: row.details || {},
        riskScore: row.risk_score,
        category: row.category,
        timestamp: row.timestamp
      }));
      
    } catch (error) {
      this.logger.error('security-extra', 'Failed to get security audit', error as Error);
      return [];
    }
  }

  // Private helper methods
  private getPolicy(workspaceId: string): SecurityPolicy | null {
    const workspacePolicies = this.policies.get(workspaceId);
    if (!workspacePolicies || workspacePolicies.size === 0) {
      return null;
    }
    
    // Return the first active policy
    return Array.from(workspacePolicies.values())[0];
  }

  private async applyMaskingRule(data: any, rule: DataMaskingRule): Promise<any> {
    const regex = new RegExp(rule.pattern, 'gi');
    
    const maskValue = (value: any): any => {
      if (typeof value === 'string') {
        if (rule.preserveFormat) {
          return value.replace(regex, (match) => {
            // Preserve format while masking
            return match.replace(/\d/g, rule.replacement);
          });
        } else {
          return value.replace(regex, rule.replacement);
        }
      }
      return value;
    };
    
    const maskObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(maskObject);
      } else if (obj && typeof obj === 'object') {
        const masked: any = {};
        for (const [key, value] of Object.entries(obj)) {
          // Check if field matches rule
          if (this.fieldMatchesRule(key, rule.fieldType)) {
            masked[key] = maskValue(value);
          } else {
            masked[key] = maskObject(value);
          }
        }
        return masked;
      }
      return obj;
    };
    
    return maskObject(data);
  }

  private fieldMatchesRule(fieldName: string, fieldType: string): boolean {
    const fieldPatterns = {
      email: /email|mail/i,
      phone: /phone|mobile|tel/i,
      ssn: /ssn|social_security/i,
      credit_card: /card|credit|cc|payment/i,
      custom: /.*/i
    };
    
    const pattern = fieldPatterns[fieldType as keyof typeof fieldPatterns];
    return pattern ? pattern.test(fieldName) : false;
  }

  private async applyPatternMasking(data: any, pattern: SecurityPolicy['dataMasking']['patterns'][0]): Promise<any> {
    const regex = new RegExp(pattern.regex, 'gi');
    
    const maskInString = (str: string): string => {
      return str.replace(regex, pattern.replacement);
    };
    
    const maskInObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(maskInObject);
      } else if (obj && typeof obj === 'object') {
        const masked: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string') {
            masked[key] = maskInString(value);
          } else {
            masked[key] = maskInObject(value);
          }
        }
        return masked;
      } else if (typeof obj === 'string') {
        return maskInString(obj);
      }
      return obj;
    };
    
    return maskInObject(data);
  }

  private async performLeakDetection(workspaceId: string, content: string, type: string): Promise<Array<{
    ruleId: string;
    ruleName: string;
    severity: string;
    confidence: number;
    action: string;
  }>> {
    const detections = [];
    const rules = this.leakDetections.get(workspaceId);
    
    if (!rules) return detections;
    
    for (const rule of rules.values()) {
      let detected = false;
      let confidence = 0;
      
      if (rule.type === 'keyword' && rule.keywords) {
        const matches = rule.keywords.filter(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        );
        detected = matches.length > 0;
        confidence = matches.length / rule.keywords.length;
      } else if (rule.type === 'pattern' && rule.pattern) {
        const regex = new RegExp(rule.pattern, 'gi');
        const matches = content.match(regex);
        detected = matches && matches.length > 0;
        confidence = matches ? Math.min(matches.length / 10, 1) : 0;
      }
      
      if (detected && confidence >= rule.threshold) {
        detections.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          confidence,
          action: rule.action
        });
      }
    }
    
    return detections;
  }

  private async assessCompliance(workspaceId: string, framework: string, period: { start: Date; end: Date }): Promise<{
    status: ComplianceReport['status'];
    score: number;
    findings: ComplianceReport['findings'];
    evidence: ComplianceReport['evidence'];
  }> {
    const findings = [];
    const evidence = [];
    let score = 100;
    
    // Check for security policy
    const policy = this.getPolicy(workspaceId);
    if (!policy) {
      findings.push({
        category: 'Governance',
        severity: 'high' as const,
        description: 'No security policy defined',
        recommendation: 'Create and implement a comprehensive security policy',
        status: 'open' as const
      });
      score -= 30;
    }
    
    // Check for recent incidents
    const incidents = await this.getSecurityIncidents(workspaceId, {
      dateRange: period,
      severity: 'high'
    });
    
    if (incidents.length > 0) {
      findings.push({
        category: 'Incident Management',
        severity: 'medium' as const,
        description: `${incidents.length} high-severity security incidents detected`,
        recommendation: 'Review and resolve security incidents promptly',
        status: 'open' as const
      });
      score -= incidents.length * 10;
    }
    
    // Add evidence
    evidence.push({
      type: 'policy_check',
      description: policy ? 'Security policy exists and is active' : 'No security policy found',
      timestamp: new Date()
    });
    
    evidence.push({
      type: 'incident_review',
      description: `Reviewed ${incidents.length} security incidents`,
      timestamp: new Date()
    });
    
    // Determine status
    let status: ComplianceReport['status'] = 'compliant';
    if (score < 70) status = 'non_compliant';
    else if (score < 90) status = 'partial';
    
    return { status, score: Math.max(0, score), findings, evidence };
  }

  private async logSecurityAudit(config: {
    workspaceId: string;
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    success: boolean;
    details: Record<string, any>;
    riskScore: number;
    category: SecurityAudit['category'];
  }): Promise<void> {
    try {
      const auditId = `audit-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      
      await this.database.query(`
        INSERT INTO security_audits (
          id, workspace_id, user_id, action, resource, resource_id,
          ip_address, user_agent, success, details, risk_score, category, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        auditId,
        config.workspaceId,
        config.userId,
        config.action,
        config.resource,
        config.resourceId,
        '127.0.0.1', // Would get from request
        'Ultra Security System',
        config.success,
        JSON.stringify(config.details),
        config.riskScore,
        config.category,
        new Date()
      ]);
      
    } catch (error) {
      this.logger.error('security-extra', 'Failed to log security audit', error as Error);
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    policiesCount: number;
    maskingRulesCount: number;
    leakDetectionsCount: number;
    encryptionKeysCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    return {
      healthy: issues.length === 0,
      policiesCount: Array.from(this.policies.values()).reduce((sum, policies) => sum + policies.size, 0),
      maskingRulesCount: Array.from(this.maskingRules.values()).reduce((sum, rules) => sum + rules.size, 0),
      leakDetectionsCount: Array.from(this.leakDetections.values()).reduce((sum, detections) => sum + detections.size, 0),
      encryptionKeysCount: this.encryptionKeys.size,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.policies.clear();
    this.maskingRules.clear();
    this.leakDetections.clear();
    this.encryptionKeys.clear();
    
    this.logger.info('security-extra', 'Security extra system shut down');
  }
}

export default UltraSecurityExtra;
