import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { UltraNotificationSystem } from './notification-system';
import * as crypto from 'crypto';
import * as rateLimit from 'express-rate-limit';
import * as helmet from 'helmet';
import * as cors from 'cors';

export interface SecurityPolicy {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  type: 'rate_limit' | 'input_validation' | 'authentication' | 'authorization' | 'encryption' | 'audit';
  rules: SecurityRule[];
  isActive: boolean;
  priority: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityRule {
  id: string;
  name: string;
  type: string;
  parameters: Record<string, any>;
  conditions: SecurityCondition[];
  actions: SecurityAction[];
  isActive: boolean;
}

export interface SecurityCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'regex';
  value: any;
}

export interface SecurityAction {
  type: 'block' | 'warn' | 'log' | 'notify' | 'quarantine' | 'escalate';
  parameters: Record<string, any>;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  keyGenerator?: (req: any) => string;
  skip?: (req: any) => boolean;
  onLimitReached?: (req: any, res: any) => void;
}

export interface SecurityIncident {
  id: string;
  workspaceId: string;
  type: 'rate_limit_exceeded' | 'invalid_input' | 'unauthorized_access' | 'suspicious_activity' | 'brute_force' | 'injection_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  description: string;
  details: Record<string, any>;
  blocked: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface SecurityMetrics {
  workspaceId: string;
  date: Date;
  totalRequests: number;
  blockedRequests: number;
  incidentsByType: Record<string, number>;
  incidentsBySeverity: Record<string, number>;
  topBlockedIPs: Array<{
    ip: string;
    count: number;
  }>;
  averageResponseTime: number;
  securityScore: number; // 0-100
}

export interface InputValidationRule {
  field: string;
  type: 'string' | 'number' | 'email' | 'url' | 'phone' | 'uuid' | 'json';
  required: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  sanitize: boolean;
  customValidator?: (value: any) => boolean;
}

export interface SecurityThreat {
  id: string;
  type: string;
  pattern: string;
  severity: SecurityIncident['severity'];
  description: string;
  isActive: boolean;
  matchCount: number;
  lastMatched?: Date;
  createdBy: string;
  createdAt: Date;
}

export class UltraSecurityHardening extends EventEmitter {
  private static instance: UltraSecurityHardening;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  private notificationSystem: UltraNotificationSystem;
  
  private securityPolicies: Map<string, SecurityPolicy[]> = new Map(); // workspaceId -> policies
  private rateLimiters: Map<string, any> = new Map(); // workspaceId -> rate limiter
  private inputValidators: Map<string, InputValidationRule[]> = new Map(); // endpoint -> validators
  private securityThreats: Map<string, SecurityThreat> = new Map();
  private blockedIPs: Map<string, { blocked: boolean; until: Date; reason: string }> = new Map();
  private securityIncidents: Map<string, SecurityIncident> = new Map();
  
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout;
  private cleanupInterval: NodeJS.Timeout;

  // Default rate limit configurations
  private defaultRateLimits: Record<string, RateLimitConfig> = {
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // 1000 requests per window
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 auth attempts per window
      message: 'Too many authentication attempts, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    },
    message: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30, // 30 messages per minute
      message: 'Too many messages sent, please slow down.',
      standardHeaders: true,
      legacyHeaders: false
    },
    file: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 10, // 10 file uploads per minute
      message: 'Too many file uploads, please wait before uploading again.',
      standardHeaders: true,
      legacyHeaders: false
    },
    search: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 20, // 20 searches per minute
      message: 'Too many search requests, please slow down.',
      standardHeaders: true,
      legacyHeaders: false
    }
  };

  static getInstance(): UltraSecurityHardening {
    if (!UltraSecurityHardening.instance) {
      UltraSecurityHardening.instance = new UltraSecurityHardening();
    }
    return UltraSecurityHardening.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.accessControl = UltraAccessControl.getInstance();
    this.notificationSystem = UltraNotificationSystem.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.loadSecurityPolicies();
      await this.loadSecurityThreats();
      await this.loadSecurityIncidents();
      this.setupDefaultRateLimiters();
      this.setupInputValidators();
      this.startMonitoring();
      this.startCleanupTasks();
      
      this.logger.info('security-hardening', 'Security hardening system initialized', {
        policiesCount: Array.from(this.securityPolicies.values()).reduce((sum, policies) => sum + policies.length, 0),
        threatsCount: this.securityThreats.size,
        incidentsCount: this.securityIncidents.size,
        blockedIPsCount: this.blockedIPs.size
      });
    } catch (error) {
      this.logger.error('security-hardening', 'Failed to initialize security hardening system', error as Error);
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
        type VARCHAR(50) NOT NULL,
        rules JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        priority INTEGER DEFAULT 0,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS security_incidents (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        user_id VARCHAR(255),
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        endpoint VARCHAR(255),
        method VARCHAR(10),
        description TEXT NOT NULL,
        details JSONB NOT NULL,
        blocked BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS security_threats (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        pattern TEXT NOT NULL,
        severity VARCHAR(20) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        match_count INTEGER DEFAULT 0,
        last_matched TIMESTAMP,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS security_metrics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_requests INTEGER DEFAULT 0,
        blocked_requests INTEGER DEFAULT 0,
        incidents_by_type JSONB NOT NULL,
        incidents_by_severity JSONB NOT NULL,
        top_blocked_ips JSONB NOT NULL,
        average_response_time DECIMAL(10,3),
        security_score DECIMAL(5,2),
        UNIQUE(workspace_id, date)
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS blocked_ips (
        id VARCHAR(255) PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL UNIQUE,
        workspace_id VARCHAR(255),
        blocked BOOLEAN DEFAULT TRUE,
        until TIMESTAMP,
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_security_policies_workspace_id ON security_policies(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_security_incidents_workspace_id ON security_incidents(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_security_incidents_ip_address ON security_incidents(ip_address)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_security_incidents_created_at ON security_incidents(created_at)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address)');
  }

  private async loadSecurityPolicies(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM security_policies WHERE is_active = TRUE');
      
      for (const row of rows) {
        const policy: SecurityPolicy = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          type: row.type,
          rules: row.rules || [],
          isActive: row.is_active,
          priority: row.priority,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.securityPolicies.has(policy.workspaceId)) {
          this.securityPolicies.set(policy.workspaceId, []);
        }
        this.securityPolicies.get(policy.workspaceId)!.push(policy);
      }
      
      this.logger.info('security-hardening', `Loaded security policies for ${this.securityPolicies.size} workspaces`);
    } catch (error) {
      this.logger.error('security-hardening', 'Failed to load security policies', error as Error);
    }
  }

  private async loadSecurityThreats(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM security_threats WHERE is_active = TRUE');
      
      for (const row of rows) {
        const threat: SecurityThreat = {
          id: row.id,
          type: row.type,
          pattern: row.pattern,
          severity: row.severity,
          description: row.description,
          isActive: row.is_active,
          matchCount: row.match_count,
          lastMatched: row.last_matched,
          createdBy: row.created_by,
          createdAt: row.created_at
        };
        
        this.securityThreats.set(threat.id, threat);
      }
      
      this.logger.info('security-hardening', `Loaded ${this.securityThreats.size} security threats`);
    } catch (error) {
      this.logger.error('security-hardening', 'Failed to load security threats', error as Error);
    }
  }

  private async loadSecurityIncidents(): Promise<void> {
    try {
      const rows = await this.database.query(`
        SELECT * FROM security_incidents 
        WHERE resolved_at IS NULL 
        ORDER BY created_at DESC 
        LIMIT 10000
      `);
      
      for (const row of rows) {
        const incident: SecurityIncident = {
          id: row.id,
          workspaceId: row.workspace_id,
          type: row.type,
          severity: row.severity,
          userId: row.user_id,
          ipAddress: row.ip_address,
          userAgent: row.user_agent,
          endpoint: row.endpoint,
          method: row.method,
          description: row.description,
          details: row.details || {},
          blocked: row.blocked,
          resolvedAt: row.resolved_at,
          createdAt: row.created_at
        };
        
        this.securityIncidents.set(incident.id, incident);
      }
      
      this.logger.info('security-hardening', `Loaded ${this.securityIncidents.size} active security incidents`);
    } catch (error) {
      this.logger.error('security-hardening', 'Failed to load security incidents', error as Error);
    }
  }

  private setupDefaultRateLimiters(): void {
    // Create rate limiters for different endpoints
    for (const [key, config] of Object.entries(this.defaultRateLimits)) {
      const limiter = rateLimit.rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        message: config.message,
        standardHeaders: config.standardHeaders,
        legacyHeaders: config.legacyHeaders,
        keyGenerator: config.keyGenerator || ((req: any) => req.ip || req.connection.remoteAddress),
        skip: config.skip,
        onLimitReached: config.onLimitReached || this.handleRateLimitExceeded.bind(this)
      });
      
      this.rateLimiters.set(key, limiter);
    }
  }

  private setupInputValidators(): void {
    // Setup input validation rules for common endpoints
    this.inputValidators.set('message', [
      {
        field: 'content',
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 4000,
        sanitize: true,
        pattern: /^[^<>]*$/ // Prevent HTML tags
      },
      {
        field: 'channelId',
        type: 'uuid',
        required: true,
        sanitize: false
      }
    ]);
    
    this.inputValidators.set('auth', [
      {
        field: 'email',
        type: 'email',
        required: true,
        sanitize: true
      },
      {
        field: 'password',
        type: 'string',
        required: true,
        minLength: 8,
        maxLength: 128,
        sanitize: false
      }
    ]);
    
    this.inputValidators.set('file', [
      {
        field: 'filename',
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 255,
        sanitize: true,
        pattern: /^[a-zA-Z0-9._-]+$/
      },
      {
        field: 'mimeType',
        type: 'string',
        required: true,
        sanitize: true,
        pattern: /^[a-zA-Z0-9/._-]+$/
      }
    ]);
  }

  private startMonitoring(): void {
    this.isMonitoring = true;
    
    // Monitor security metrics every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.updateSecurityMetrics();
      }
    }, 5 * 60 * 1000);
  }

  private startCleanupTasks(): void {
    // Cleanup old incidents and blocked IPs every hour
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupOldData();
    }, 60 * 60 * 1000);
  }

  // PUBLIC API METHODS
  async createRateLimiter(workspaceId: string, config: Partial<RateLimitConfig>): Promise<any> {
    const finalConfig: RateLimitConfig = {
      windowMs: config.windowMs || 15 * 60 * 1000,
      max: config.max || 100,
      message: config.message || 'Rate limit exceeded',
      standardHeaders: config.standardHeaders ?? true,
      legacyHeaders: config.legacyHeaders ?? false,
      keyGenerator: config.keyGenerator,
      skip: config.skip,
      onLimitReached: config.onLimitReached || this.handleRateLimitExceeded.bind(this)
    };
    
    const limiter = rateLimit.rateLimit(finalConfig);
    this.rateLimiters.set(`workspace-${workspaceId}`, limiter);
    
    return limiter;
  }

  async validateInput(endpoint: string, data: any, context?: {
    userId?: string;
    workspaceId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ valid: boolean; errors: string[]; sanitized?: any }> {
    try {
      const validators = this.inputValidators.get(endpoint);
      if (!validators) {
        return { valid: true, errors: [] };
      }
      
      const errors: string[] = [];
      const sanitized: any = {};
      
      for (const validator of validators) {
        const value = data[validator.field];
        
        // Check if required field is missing
        if (validator.required && (value === undefined || value === null || value === '')) {
          errors.push(`${validator.field} is required`);
          continue;
        }
        
        // Skip validation if field is not provided and not required
        if (!validator.required && (value === undefined || value === null || value === '')) {
          continue;
        }
        
        // Type validation
        if (!this.validateType(value, validator.type)) {
          errors.push(`${validator.field} must be of type ${validator.type}`);
          continue;
        }
        
        // Length validation for strings
        if (validator.type === 'string') {
          const strValue = String(value);
          if (validator.minLength && strValue.length < validator.minLength) {
            errors.push(`${validator.field} must be at least ${validator.minLength} characters`);
          }
          if (validator.maxLength && strValue.length > validator.maxLength) {
            errors.push(`${validator.field} must be at most ${validator.maxLength} characters`);
          }
        }
        
        // Pattern validation
        if (validator.pattern && !new RegExp(validator.pattern).test(String(value))) {
          errors.push(`${validator.field} format is invalid`);
        }
        
        // Custom validation
        if (validator.customValidator && !validator.customValidator(value)) {
          errors.push(`${validator.field} failed custom validation`);
        }
        
        // Sanitization
        if (validator.sanitize) {
          sanitized[validator.field] = this.sanitizeValue(value, validator.type);
        } else {
          sanitized[validator.field] = value;
        }
      }
      
      // Check for security threats
      if (context) {
        await this.checkSecurityThreats(data, context);
      }
      
      return {
        valid: errors.length === 0,
        errors,
        sanitized: Object.keys(sanitized).length > 0 ? sanitized : undefined
      };
      
    } catch (error) {
      this.logger.error('security-hardening', 'Input validation failed', error as Error);
      return { valid: false, errors: ['Validation error occurred'] };
    }
  }

  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'phone':
        return typeof value === 'string' && /^[\d\s\-\+\(\)]+$/.test(value);
      case 'uuid':
        return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      case 'json':
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      default:
        return true;
    }
  }

  private sanitizeValue(value: any, type: string): any {
    if (typeof value !== 'string') {
      return value;
    }
    
    // Basic XSS prevention
    let sanitized = value
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
  }

  private async checkSecurityThreats(data: any, context: {
    userId?: string;
    workspaceId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const dataString = JSON.stringify(data).toLowerCase();
      
      for (const threat of this.securityThreats.values()) {
        if (new RegExp(threat.pattern, 'i').test(dataString)) {
          await this.reportSecurityIncident({
            workspaceId: context.workspaceId || 'global',
            type: 'suspicious_activity',
            severity: threat.severity,
            userId: context.userId,
            ipAddress: context.ipAddress || 'unknown',
            userAgent: context.userAgent,
            description: `Security threat detected: ${threat.description}`,
            details: {
              threatId: threat.id,
              threatType: threat.type,
              matchedData: dataString.substring(0, 500)
            }
          });
          
          // Update threat match count
          threat.matchCount++;
          threat.lastMatched = new Date();
          await this.updateThreatMatchCount(threat);
        }
      }
      
    } catch (error) {
      this.logger.error('security-hardening', 'Failed to check security threats', error as Error);
    }
  }

  private async updateThreatMatchCount(threat: SecurityThreat): Promise<void> {
    await this.database.query(
      'UPDATE security_threats SET match_count = $1, last_matched = $2 WHERE id = $3',
      [threat.matchCount, threat.lastMatched, threat.id]
    );
  }

  async checkPermissions(userId: string, workspaceId: string, resource: string, action: string, context?: any): Promise<boolean> {
    try {
      // Check basic access control
      const hasAccess = await this.accessControl.canAccessResource(userId, workspaceId, resource, action, context);
      
      if (!hasAccess) {
        await this.reportSecurityIncident({
          workspaceId,
          type: 'unauthorized_access',
          severity: 'medium',
          userId,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          endpoint: context?.endpoint,
          method: context?.method,
          description: `Unauthorized access attempt to ${resource}:${action}`,
          details: {
            resource,
            action,
            context
          }
        });
      }
      
      return hasAccess;
      
    } catch (error) {
      this.logger.error('security-hardening', 'Permission check failed', error as Error);
      return false;
    }
  }

  async reportSecurityIncident(config: {
    workspaceId: string;
    type: SecurityIncident['type'];
    severity: SecurityIncident['severity'];
    userId?: string;
    ipAddress: string;
    userAgent?: string;
    endpoint?: string;
    method?: string;
    description: string;
    details: Record<string, any>;
  }): Promise<string> {
    const incidentId = `incident-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const incident: SecurityIncident = {
        id: incidentId,
        workspaceId: config.workspaceId,
        type: config.type,
        severity: config.severity,
        userId: config.userId,
        ipAddress: config.ipAddress,
        userAgent: config.userAgent,
        endpoint: config.endpoint,
        method: config.method,
        description: config.description,
        details: config.details,
        blocked: false,
        createdAt: new Date()
      };
      
      // Check if IP should be blocked
      if (await this.shouldBlockIP(incident)) {
        incident.blocked = true;
        await this.blockIP(config.ipAddress, config.workspaceId, 'Security incident', new Date(Date.now() + 24 * 60 * 60 * 1000));
      }
      
      await this.database.query(`
        INSERT INTO security_incidents (
          id, workspace_id, type, severity, user_id, ip_address, user_agent,
          endpoint, method, description, details, blocked, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        incident.id,
        incident.workspaceId,
        incident.type,
        incident.severity,
        incident.userId,
        incident.ipAddress,
        incident.userAgent,
        incident.endpoint,
        incident.method,
        incident.description,
        JSON.stringify(incident.details),
        incident.blocked,
        incident.createdAt
      ]);
      
      this.securityIncidents.set(incidentId, incident);
      
      // Notify administrators for critical incidents
      if (incident.severity === 'critical') {
        await this.notifyAdministrators(incident);
      }
      
      this.emit('securityIncident', incident);
      this.logger.warn('security-hardening', `Security incident reported: ${incidentId}`, {
        type: incident.type,
        severity: incident.severity,
        ipAddress: incident.ipAddress
      });
      
      return incidentId;
      
    } catch (error) {
      this.logger.error('security-hardening', `Failed to report security incident: ${incidentId}`, error as Error);
      throw error;
    }
  }

  private async shouldBlockIP(incident: SecurityIncident): Promise<boolean> {
    const recentIncidents = Array.from(this.securityIncidents.values())
      .filter(i => i.ipAddress === incident.ipAddress && 
                 i.createdAt > new Date(Date.now() - 60 * 60 * 1000)); // Last hour
    
    // Block if more than 5 incidents in last hour
    if (recentIncidents.length >= 5) {
      return true;
    }
    
    // Block if critical incident
    if (incident.severity === 'critical') {
      return true;
    }
    
    // Block if multiple high severity incidents
    const highSeverityCount = recentIncidents.filter(i => i.severity === 'high').length;
    if (highSeverityCount >= 3) {
      return true;
    }
    
    return false;
  }

  async blockIP(ipAddress: string, workspaceId?: string, reason?: string, until?: Date): Promise<boolean> {
    try {
      const blockId = `block-${crypto.randomBytes(8).toString('hex')}`;
      const blockUntil = until || new Date(Date.now() + 24 * 60 * 60 * 1000); // Default 24 hours
      
      await this.database.query(`
        INSERT INTO blocked_ips (id, ip_address, workspace_id, blocked, until, reason, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (ip_address) DO UPDATE SET
        blocked = TRUE, until = EXCLUDED.until, reason = EXCLUDED.reason, updated_at = $7
      `, [
        blockId,
        ipAddress,
        workspaceId,
        true,
        blockUntil,
        reason || 'Security violation',
        new Date(),
        new Date()
      ]);
      
      this.blockedIPs.set(ipAddress, {
        blocked: true,
        until: blockUntil,
        reason: reason || 'Security violation'
      });
      
      this.emit('ipBlocked', { ipAddress, workspaceId, reason, until: blockUntil });
      this.logger.warn('security-hardening', `IP address blocked: ${ipAddress}`, {
        workspaceId,
        reason,
        until: blockUntil
      });
      
      return true;
      
    } catch (error) {
      this.logger.error('security-hardening', `Failed to block IP: ${ipAddress}`, error as Error);
      return false;
    }
  }

  async isIPBlocked(ipAddress: string): Promise<boolean> {
    try {
      // Check memory cache first
      const cached = this.blockedIPs.get(ipAddress);
      if (cached) {
        if (cached.blocked && cached.until > new Date()) {
          return true;
        } else if (cached.until <= new Date()) {
          // Expired block, remove from cache
          this.blockedIPs.delete(ipAddress);
          await this.database.query('DELETE FROM blocked_ips WHERE ip_address = $1', [ipAddress]);
        }
      }
      
      // Check database
      const result = await this.database.query(
        'SELECT * FROM blocked_ips WHERE ip_address = $1 AND blocked = TRUE AND until > NOW()',
        [ipAddress]
      );
      
      const isBlocked = result.rows.length > 0;
      
      if (isBlocked) {
        const block = result.rows[0];
        this.blockedIPs.set(ipAddress, {
          blocked: true,
          until: block.until,
          reason: block.reason
        });
      }
      
      return isBlocked;
      
    } catch (error) {
      this.logger.error('security-hardening', `Failed to check IP block status: ${ipAddress}`, error as Error);
      return false;
    }
  }

  private async notifyAdministrators(incident: SecurityIncident): Promise<void> {
    try {
      // Get all super admin users
      const admins = await this.database.query(
        'SELECT user_id FROM workspace_members WHERE role = \'super_admin\''
      );
      
      for (const admin of admins.rows) {
        await this.notificationSystem.createNotification({
          userId: admin.user_id,
          workspaceId: 'system',
          type: 'security',
          title: 'CRITICAL Security Incident',
          content: `${incident.severity.toUpperCase()} security incident: ${incident.description}`,
          data: {
            incidentId: incident.id,
            type: incident.type,
            ipAddress: incident.ipAddress,
            userId: incident.userId
          },
          priority: 'urgent'
        });
      }
      
    } catch (error) {
      this.logger.error('security-hardening', 'Failed to notify administrators', error as Error);
    }
  }

  private handleRateLimitExceeded(req: any, res: any): void {
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    this.reportSecurityIncident({
      workspaceId: req.workspaceId || 'global',
      type: 'rate_limit_exceeded',
      severity: 'medium',
      ipAddress,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method,
      description: `Rate limit exceeded for endpoint: ${req.method} ${req.path}`,
      details: {
        limit: req.rateLimit?.limit,
        current: req.rateLimit?.current,
        resetTime: req.rateLimit?.resetTime
      }
    }).catch(error => {
      this.logger.error('security-hardening', 'Failed to report rate limit incident', error as Error);
    });
  }

  // SECURITY POLICY MANAGEMENT
  async createSecurityPolicy(config: {
    workspaceId: string;
    name: string;
    description?: string;
    type: SecurityPolicy['type'];
    rules: SecurityRule[];
    priority?: number;
    createdBy: string;
  }): Promise<string> {
    const policyId = `policy-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const policy: SecurityPolicy = {
        id: policyId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        type: config.type,
        rules: config.rules,
        isActive: true,
        priority: config.priority || 0,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO security_policies (
          id, workspace_id, name, description, type, rules, is_active,
          priority, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        policy.id,
        policy.workspaceId,
        policy.name,
        policy.description,
        policy.type,
        JSON.stringify(policy.rules),
        policy.isActive,
        policy.priority,
        policy.createdBy,
        policy.createdAt,
        policy.updatedAt
      ]);
      
      if (!this.securityPolicies.has(policy.workspaceId)) {
        this.securityPolicies.set(policy.workspaceId, []);
      }
      this.securityPolicies.get(policy.workspaceId)!.push(policy);
      
      this.emit('securityPolicyCreated', policy);
      return policyId;
      
    } catch (error) {
      this.logger.error('security-hardening', `Failed to create security policy: ${policyId}`, error as Error);
      throw error;
    }
  }

  async createSecurityThreat(config: {
    type: string;
    pattern: string;
    severity: SecurityThreat['severity'];
    description?: string;
    createdBy: string;
  }): Promise<string> {
    const threatId = `threat-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const threat: SecurityThreat = {
        id: threatId,
        type: config.type,
        pattern: config.pattern,
        severity: config.severity,
        description: config.description,
        isActive: true,
        matchCount: 0,
        createdBy: config.createdBy,
        createdAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO security_threats (
          id, type, pattern, severity, description, is_active, match_count, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        threat.id,
        threat.type,
        threat.pattern,
        threat.severity,
        threat.description,
        threat.isActive,
        threat.matchCount,
        threat.createdBy,
        threat.createdAt
      ]);
      
      this.securityThreats.set(threatId, threat);
      
      this.emit('securityThreatCreated', threat);
      return threatId;
      
    } catch (error) {
      this.logger.error('security-hardening', `Failed to create security threat: ${threatId}`, error as Error);
      throw error;
    }
  }

  // ANALYTICS AND REPORTING
  async getSecurityIncidents(workspaceId: string, filters?: {
    type?: SecurityIncident['type'];
    severity?: SecurityIncident['severity'];
    userId?: string;
    ipAddress?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<SecurityIncident[]> {
    try {
      let incidents = Array.from(this.securityIncidents.values())
        .filter(incident => incident.workspaceId === workspaceId);
      
      if (filters?.type) {
        incidents = incidents.filter(incident => incident.type === filters.type);
      }
      
      if (filters?.severity) {
        incidents = incidents.filter(incident => incident.severity === filters.severity);
      }
      
      if (filters?.userId) {
        incidents = incidents.filter(incident => incident.userId === filters.userId);
      }
      
      if (filters?.ipAddress) {
        incidents = incidents.filter(incident => incident.ipAddress === filters.ipAddress);
      }
      
      if (filters?.startDate) {
        incidents = incidents.filter(incident => incident.createdAt >= filters.startDate!);
      }
      
      if (filters?.endDate) {
        incidents = incidents.filter(incident => incident.createdAt <= filters.endDate!);
      }
      
      incidents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      if (filters?.limit) {
        const start = filters.offset || 0;
        incidents = incidents.slice(start, start + filters.limit);
      }
      
      return incidents;
      
    } catch (error) {
      this.logger.error('security-hardening', `Failed to get security incidents: ${workspaceId}`, error as Error);
      return [];
    }
  }

  async getSecurityMetrics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<SecurityMetrics[]> {
    try {
      let sql = 'SELECT * FROM security_metrics WHERE workspace_id = $1';
      const params: any[] = [workspaceId];
      
      if (dateRange) {
        sql += ' AND date >= $2 AND date <= $3';
        params.push(dateRange.start, dateRange.end);
      }
      
      sql += ' ORDER BY date DESC';
      
      const rows = await this.database.query(sql, params);
      
      return rows.map(row => ({
        workspaceId: row.workspace_id,
        date: row.date,
        totalRequests: row.total_requests,
        blockedRequests: row.blocked_requests,
        incidentsByType: row.incidents_by_type || {},
        incidentsBySeverity: row.incidents_by_severity || {},
        topBlockedIPs: row.top_blocked_ips || [],
        averageResponseTime: parseFloat(row.average_response_time) || 0,
        securityScore: parseFloat(row.security_score) || 0
      }));
      
    } catch (error) {
      this.logger.error('security-hardening', `Failed to get security metrics: ${workspaceId}`, error as Error);
      return [];
    }
  }

  private async updateSecurityMetrics(): Promise<void> {
    try {
      const workspaces = new Set(Array.from(this.securityIncidents.values()).map(i => i.workspaceId));
      
      for (const workspaceId of workspaces) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const today = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000);
        
        // Count incidents in the time range
        const workspaceIncidents = Array.from(this.securityIncidents.values())
          .filter(incident => incident.workspaceId === workspaceId && 
                     incident.createdAt >= yesterday && 
                     incident.createdAt < today);
        
        const incidentsByType: Record<string, number> = {};
        const incidentsBySeverity: Record<string, number> = {};
        const ipCounts: Record<string, number> = {};
        
        for (const incident of workspaceIncidents) {
          incidentsByType[incident.type] = (incidentsByType[incident.type] || 0) + 1;
          incidentsBySeverity[incident.severity] = (incidentsBySeverity[incident.severity] || 0) + 1;
          ipCounts[incident.ipAddress] = (ipCounts[incident.ipAddress] || 0) + 1;
        }
        
        const topBlockedIPs = Object.entries(ipCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([ip, count]) => ({ ip, count }));
        
        // Calculate security score (0-100)
        const totalIncidents = workspaceIncidents.length;
        const criticalIncidents = incidentsBySeverity.critical || 0;
        const highIncidents = incidentsBySeverity.high || 0;
        
        let securityScore = 100;
        securityScore -= criticalIncidents * 20;
        securityScore -= highIncidents * 10;
        securityScore -= totalIncidents * 2;
        securityScore = Math.max(0, securityScore);
        
        const metrics: SecurityMetrics = {
          workspaceId,
          date: yesterday,
          totalRequests: 0, // Would be calculated from actual request logs
          blockedRequests: workspaceIncidents.filter(i => i.blocked).length,
          incidentsByType,
          incidentsBySeverity,
          topBlockedIPs,
          averageResponseTime: 0, // Would be calculated from actual response times
          securityScore
        };
        
        await this.database.query(`
          INSERT INTO security_metrics (
            workspace_id, date, total_requests, blocked_requests, incidents_by_type,
            incidents_by_severity, top_blocked_ips, average_response_time, security_score
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (workspace_id, date) DO UPDATE SET
          blocked_requests = EXCLUDED.blocked_requests,
          incidents_by_type = EXCLUDED.incidents_by_type,
          incidents_by_severity = EXCLUDED.incidents_by_severity,
          top_blocked_ips = EXCLUDED.top_blocked_ips,
          security_score = EXCLUDED.security_score
        `, [
          metrics.workspaceId,
          metrics.date,
          metrics.totalRequests,
          metrics.blockedRequests,
          JSON.stringify(metrics.incidentsByType),
          JSON.stringify(metrics.incidentsBySeverity),
          JSON.stringify(metrics.topBlockedIPs),
          metrics.averageResponseTime,
          metrics.securityScore
        ]);
      }
      
    } catch (error) {
      this.logger.error('security-hardening', 'Failed to update security metrics', error as Error);
    }
  }

  private async cleanupOldData(): Promise<void> {
    try {
      // Clean up old resolved incidents (older than 30 days)
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      await this.database.query(
        'DELETE FROM security_incidents WHERE resolved_at < $1',
        [cutoffDate]
      );
      
      // Clean up expired IP blocks
      await this.database.query(
        'DELETE FROM blocked_ips WHERE until < NOW()'
      );
      
      // Clean up memory cache
      for (const [ip, block] of this.blockedIPs.entries()) {
        if (block.until <= new Date()) {
          this.blockedIPs.delete(ip);
        }
      }
      
      for (const [id, incident] of this.securityIncidents.entries()) {
        if (incident.resolvedAt && incident.resolvedAt < cutoffDate) {
          this.securityIncidents.delete(id);
        }
      }
      
      this.logger.debug('security-hardening', 'Security cleanup completed');
      
    } catch (error) {
      this.logger.error('security-hardening', 'Failed to cleanup old data', error as Error);
    }
  }

  // MIDDLEWARE HELPERS
  getSecurityMiddleware(workspaceId: string): Array<(req: any, res: any, next: any) => void> {
    const middlewares: Array<(req: any, res: any, next: any) => void> = [];
    
    // Add helmet for security headers
    middlewares.push(helmet.default({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));
    
    // Add CORS
    middlewares.push(cors.default({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-ID']
    }));
    
    // Add IP blocking check
    middlewares.push(async (req: any, res: any, next: any) => {
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      if (await this.isIPBlocked(ipAddress)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Your IP address has been blocked due to security violations'
        });
      }
      
      next();
    });
    
    // Add rate limiter
    const workspaceLimiter = this.rateLimiters.get(`workspace-${workspaceId}`);
    if (workspaceLimiter) {
      middlewares.push(workspaceLimiter);
    } else {
      middlewares.push(this.rateLimiters.get('global'));
    }
    
    return middlewares;
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    activePoliciesCount: number;
    activeThreatsCount: number;
    activeIncidentsCount: number;
    blockedIPsCount: number;
    monitoringActive: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    const criticalIncidents = Array.from(this.securityIncidents.values())
      .filter(incident => incident.severity === 'critical').length;
    
    if (criticalIncidents > 0) {
      issues.push(`${criticalIncidents} critical security incidents`);
    }
    
    if (!this.isMonitoring) {
      issues.push('Security monitoring is not active');
    }
    
    return {
      healthy: issues.length === 0,
      activePoliciesCount: Array.from(this.securityPolicies.values()).reduce((sum, policies) => sum + policies.length, 0),
      activeThreatsCount: this.securityThreats.size,
      activeIncidentsCount: this.securityIncidents.size,
      blockedIPsCount: this.blockedIPs.size,
      monitoringActive: this.isMonitoring,
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.logger.info('security-hardening', 'Security hardening system shut down');
  }
}

export default UltraSecurityHardening;
