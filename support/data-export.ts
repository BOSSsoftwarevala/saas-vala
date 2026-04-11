import { EventEmitter } from 'events';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';
import { UltraAccessControl } from './access-control';
import { Message, User, Workspace, Channel } from './slack-system';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface ExportConfig {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  type: 'full' | 'incremental' | 'filtered' | 'custom';
  format: 'json' | 'csv' | 'xlsx' | 'xml';
  scope: {
    messages: boolean;
    users: boolean;
    channels: boolean;
    files: boolean;
    analytics: boolean;
    settings: boolean;
    logs: boolean;
  };
  filters: {
    dateRange?: {
      start: Date;
      end: Date;
    };
    users?: string[];
    channels?: string[];
    tags?: string[];
    messageTypes?: string[];
    customFilters?: Array<{
      field: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    }>;
  };
  resellerFiltering: {
    enabled: boolean;
    resellerId?: string;
    includeSubResellers: boolean;
    allowedData: string[];
    restrictedFields: string[];
  };
  privacy: {
    anonymizeUsers: boolean;
    maskSensitiveData: boolean;
    removePrivateMessages: boolean;
    excludeDeletedContent: boolean;
  };
  delivery: {
    method: 'download' | 'email' | 'ftp' | 's3' | 'webhook';
    destination: string;
    compression: boolean;
    encryption: boolean;
    password?: string;
  };
  schedule: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    nextRun: Date;
    timezone: string;
  };
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
}

export interface ExportJob {
  id: string;
  configId: string;
  workspaceId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    processed: number;
    percentage: number;
    currentStep: string;
  };
  stats: {
    recordsExported: number;
    filesExported: number;
    sizeBytes: number;
    duration: number; // seconds
  };
  result: {
    filePath?: string;
    downloadUrl?: string;
    checksum?: string;
    error?: string;
  };
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportTemplate {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  category: string;
  config: Partial<ExportConfig>;
  isPublic: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataMaskingRule {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  pattern: string; // Regex pattern
  replacement: string;
  fields: string[]; // Fields to apply to
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportAnalytics {
  workspaceId: string;
  date: Date;
  totalExports: number;
  successfulExports: number;
  failedExports: number;
  totalDataExported: number; // MB
  averageExportSize: number; // MB
  averageExportTime: number; // minutes
  exportByType: Record<string, number>;
  exportByFormat: Record<string, number>;
  topExporters: Array<{
    userId: string;
    userName: string;
    exportCount: number;
    dataSize: number;
  }>;
  resellerExports: Array<{
    resellerId: string;
    resellerName: string;
    exportCount: number;
    dataSize: number;
  }>;
}

export class UltraDataExport extends EventEmitter {
  private static instance: UltraDataExport;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private accessControl: UltraAccessControl;
  
  private configs: Map<string, Map<string, ExportConfig>> = new Map(); // workspaceId -> configId -> config
  private jobs: Map<string, ExportJob> = new Map(); // jobId -> job
  private templates: Map<string, Map<string, ExportTemplate>> = new Map(); // workspaceId -> templateId -> template
  private maskingRules: Map<string, Map<string, DataMaskingRule>> = new Map(); // workspaceId -> ruleId -> rule
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout;

  static getInstance(): UltraDataExport {
    if (!UltraDataExport.instance) {
      UltraDataExport.instance = new UltraDataExport();
    }
    return UltraDataExport.instance;
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
      await this.loadConfigs();
      await this.loadTemplates();
      await this.loadMaskingRules();
      await this.loadActiveJobs();
      this.startProcessing();
      
      this.logger.info('data-export', 'Data export system initialized', {
        configsCount: Array.from(this.configs.values()).reduce((sum, configs) => sum + configs.size, 0),
        templatesCount: Array.from(this.templates.values()).reduce((sum, templates) => sum + templates.size, 0),
        maskingRulesCount: Array.from(this.maskingRules.values()).reduce((sum, rules) => sum + rules.size, 0),
        activeJobsCount: this.jobs.size
      });
    } catch (error) {
      this.logger.error('data-export', 'Failed to initialize data export system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS export_configs (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(20) NOT NULL,
        format VARCHAR(10) NOT NULL,
        scope JSONB NOT NULL,
        filters JSONB NOT NULL,
        reseller_filtering JSONB NOT NULL,
        privacy JSONB NOT NULL,
        delivery JSONB NOT NULL,
        schedule JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_run TIMESTAMP
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS export_jobs (
        id VARCHAR(255) PRIMARY KEY,
        config_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        progress JSONB NOT NULL,
        stats JSONB NOT NULL,
        result JSONB NOT NULL,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS export_templates (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        config JSONB NOT NULL,
        is_public BOOLEAN DEFAULT FALSE,
        usage_count INTEGER DEFAULT 0,
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
        pattern VARCHAR(500) NOT NULL,
        replacement VARCHAR(255) NOT NULL,
        fields TEXT[] NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS export_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        total_exports INTEGER DEFAULT 0,
        successful_exports INTEGER DEFAULT 0,
        failed_exports INTEGER DEFAULT 0,
        total_data_exported DECIMAL(10,2),
        average_export_size DECIMAL(10,2),
        average_export_time DECIMAL(10,2),
        export_by_type JSONB NOT NULL,
        export_by_format JSONB NOT NULL,
        top_exporters JSONB NOT NULL,
        reseller_exports JSONB NOT NULL,
        UNIQUE(workspace_id, date)
      )
    `);

    // Create indexes
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_export_configs_workspace_id ON export_configs(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_export_configs_status ON export_configs(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_export_jobs_config_id ON export_jobs(config_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_export_templates_workspace_id ON export_templates(workspace_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_data_masking_rules_workspace_id ON data_masking_rules(workspace_id)');
  }

  private async loadConfigs(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM export_configs ORDER BY created_at DESC');
      
      for (const row of rows) {
        const config: ExportConfig = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          type: row.type,
          format: row.format,
          scope: row.scope || {},
          filters: row.filters || {},
          resellerFiltering: row.reseller_filtering || {},
          privacy: row.privacy || {},
          delivery: row.delivery || {},
          schedule: row.schedule || {},
          status: row.status,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastRun: row.last_run
        };
        
        if (!this.configs.has(config.workspaceId)) {
          this.configs.set(config.workspaceId, new Map());
        }
        this.configs.get(config.workspaceId)!.set(config.id, config);
      }
      
      this.logger.info('data-export', `Loaded configs for ${this.configs.size} workspaces`);
    } catch (error) {
      this.logger.error('data-export', 'Failed to load configs', error as Error);
    }
  }

  private async loadTemplates(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM export_templates ORDER BY created_at DESC');
      
      for (const row of rows) {
        const template: ExportTemplate = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          category: row.category,
          config: row.config || {},
          isPublic: row.is_public,
          usageCount: row.usage_count || 0,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.templates.has(template.workspaceId)) {
          this.templates.set(template.workspaceId, new Map());
        }
        this.templates.get(template.workspaceId)!.set(template.id, template);
      }
      
      this.logger.info('data-export', `Loaded templates for ${this.templates.size} workspaces`);
    } catch (error) {
      this.logger.error('data-export', 'Failed to load templates', error as Error);
    }
  }

  private async loadMaskingRules(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM data_masking_rules WHERE is_active = TRUE');
      
      for (const row of rows) {
        const rule: DataMaskingRule = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          pattern: row.pattern,
          replacement: row.replacement,
          fields: row.fields || [],
          isActive: row.is_active,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        if (!this.maskingRules.has(rule.workspaceId)) {
          this.maskingRules.set(rule.workspaceId, new Map());
        }
        this.maskingRules.get(rule.workspaceId)!.set(rule.id, rule);
      }
      
      this.logger.info('data-export', `Loaded masking rules for ${this.maskingRules.size} workspaces`);
    } catch (error) {
      this.logger.error('data-export', 'Failed to load masking rules', error as Error);
    }
  }

  private async loadActiveJobs(): Promise<void> {
    try {
      const rows = await this.database.query(
        "SELECT * FROM export_jobs WHERE status IN ('pending', 'running') ORDER BY created_at ASC"
      );
      
      for (const row of rows) {
        const job: ExportJob = {
          id: row.id,
          configId: row.config_id,
          workspaceId: row.workspace_id,
          status: row.status,
          progress: row.progress || { total: 0, processed: 0, percentage: 0, currentStep: '' },
          stats: row.stats || { recordsExported: 0, filesExported: 0, sizeBytes: 0, duration: 0 },
          result: row.result || {},
          startedAt: row.started_at,
          completedAt: row.completed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.jobs.set(job.id, job);
      }
      
      this.logger.info('data-export', `Loaded ${rows.length} active jobs`);
    } catch (error) {
      this.logger.error('data-export', 'Failed to load active jobs', error as Error);
    }
  }

  private startProcessing(): void {
    this.isProcessing = true;
    
    // Process jobs every minute
    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) {
        await this.processPendingJobs();
        await this.checkScheduledExports();
      }
    }, 60 * 1000);
  }

  // PUBLIC API METHODS
  async createExportConfig(config: {
    workspaceId: string;
    name: string;
    description?: string;
    type: ExportConfig['type'];
    format: ExportConfig['format'];
    scope: ExportConfig['scope'];
    filters?: ExportConfig['filters'];
    resellerFiltering?: ExportConfig['resellerFiltering'];
    privacy?: ExportConfig['privacy'];
    delivery: ExportConfig['delivery'];
    schedule?: ExportConfig['schedule'];
    createdBy: string;
  }): Promise<string> {
    const configId = `export-config-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const exportConfig: ExportConfig = {
        id: configId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        type: config.type,
        format: config.format,
        scope: config.scope,
        filters: config.filters || {},
        resellerFiltering: config.resellerFiltering || {
          enabled: false,
          includeSubResellers: false,
          allowedData: [],
          restrictedFields: []
        },
        privacy: config.privacy || {
          anonymizeUsers: false,
          maskSensitiveData: false,
          removePrivateMessages: false,
          excludeDeletedContent: false
        },
        delivery: config.delivery,
        schedule: config.schedule || {
          enabled: false,
          frequency: 'monthly',
          nextRun: new Date(),
          timezone: 'UTC'
        },
        status: 'draft',
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO export_configs (
          id, workspace_id, name, description, type, format, scope, filters,
          reseller_filtering, privacy, delivery, schedule, status,
          created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        exportConfig.id,
        exportConfig.workspaceId,
        exportConfig.name,
        exportConfig.description,
        exportConfig.type,
        exportConfig.format,
        JSON.stringify(exportConfig.scope),
        JSON.stringify(exportConfig.filters),
        JSON.stringify(exportConfig.resellerFiltering),
        JSON.stringify(exportConfig.privacy),
        JSON.stringify(exportConfig.delivery),
        JSON.stringify(exportConfig.schedule),
        exportConfig.status,
        exportConfig.createdBy,
        exportConfig.createdAt,
        exportConfig.updatedAt
      ]);
      
      if (!this.configs.has(exportConfig.workspaceId)) {
        this.configs.set(exportConfig.workspaceId, new Map());
      }
      this.configs.get(exportConfig.workspaceId)!.set(exportConfig.id, exportConfig);
      
      this.emit('configCreated', exportConfig);
      return configId;
      
    } catch (error) {
      this.logger.error('data-export', `Failed to create export config: ${configId}`, error as Error);
      throw error;
    }
  }

  async runExport(configId: string, userId: string): Promise<string> {
    const jobId = `export-job-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const config = this.findConfig(configId);
      if (!config) {
        throw new Error(`Export config not found: ${configId}`);
      }
      
      // Check permissions
      const hasPermission = await this.accessControl.hasPermission(userId, config.workspaceId, 'admin');
      if (!hasPermission) {
        throw new Error('Insufficient permissions to run export');
      }
      
      const job: ExportJob = {
        id: jobId,
        configId: configId,
        workspaceId: config.workspaceId,
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          percentage: 0,
          currentStep: 'Initializing'
        },
        stats: {
          recordsExported: 0,
          filesExported: 0,
          sizeBytes: 0,
          duration: 0
        },
        result: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO export_jobs (
          id, config_id, workspace_id, status, progress, stats, result, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        job.id,
        job.configId,
        job.workspaceId,
        job.status,
        JSON.stringify(job.progress),
        JSON.stringify(job.stats),
        JSON.stringify(job.result),
        job.createdAt,
        job.updatedAt
      ]);
      
      this.jobs.set(job.id, job);
      
      // Update config last run
      await this.database.query(
        'UPDATE export_configs SET last_run = $1 WHERE id = $2',
        [new Date(), configId]
      );
      
      // Process immediately
      await this.processJob(job.id);
      
      this.emit('exportStarted', job);
      return jobId;
      
    } catch (error) {
      this.logger.error('data-export', `Failed to run export: ${jobId}`, error as Error);
      throw error;
    }
  }

  async createTemplate(config: {
    workspaceId: string;
    name: string;
    description?: string;
    category: string;
    config: Partial<ExportConfig>;
    isPublic?: boolean;
    createdBy: string;
  }): Promise<string> {
    const templateId = `template-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const template: ExportTemplate = {
        id: templateId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        category: config.category,
        config: config.config,
        isPublic: config.isPublic || false,
        usageCount: 0,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO export_templates (
          id, workspace_id, name, description, category, config, is_public,
          usage_count, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        template.id,
        template.workspaceId,
        template.name,
        template.description,
        template.category,
        JSON.stringify(template.config),
        template.isPublic,
        template.usageCount,
        template.createdBy,
        template.createdAt,
        template.updatedAt
      ]);
      
      if (!this.templates.has(template.workspaceId)) {
        this.templates.set(template.workspaceId, new Map());
      }
      this.templates.get(template.workspaceId)!.set(template.id, template);
      
      this.emit('templateCreated', template);
      return templateId;
      
    } catch (error) {
      this.logger.error('data-export', `Failed to create template: ${templateId}`, error as Error);
      throw error;
    }
  }

  async createMaskingRule(config: {
    workspaceId: string;
    name: string;
    description?: string;
    pattern: string;
    replacement: string;
    fields: string[];
    createdBy: string;
  }): Promise<string> {
    const ruleId = `masking-rule-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    try {
      const rule: DataMaskingRule = {
        id: ruleId,
        workspaceId: config.workspaceId,
        name: config.name,
        description: config.description,
        pattern: config.pattern,
        replacement: config.replacement,
        fields: config.fields,
        isActive: true,
        createdBy: config.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.database.query(`
        INSERT INTO data_masking_rules (
          id, workspace_id, name, description, pattern, replacement, fields,
          is_active, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        rule.id,
        rule.workspaceId,
        rule.name,
        rule.description,
        rule.pattern,
        rule.replacement,
        rule.fields,
        rule.isActive,
        rule.createdBy,
        rule.createdAt,
        rule.updatedAt
      ]);
      
      if (!this.maskingRules.has(rule.workspaceId)) {
        this.maskingRules.set(rule.workspaceId, new Map());
      }
      this.maskingRules.get(rule.workspaceId)!.set(rule.id, rule);
      
      this.emit('maskingRuleCreated', rule);
      return ruleId;
      
    } catch (error) {
      this.logger.error('data-export', `Failed to create masking rule: ${ruleId}`, error as Error);
      throw error;
    }
  }

  async getExportConfigs(workspaceId: string): Promise<ExportConfig[]> {
    try {
      const workspaceConfigs = this.configs.get(workspaceId);
      if (!workspaceConfigs) {
        return [];
      }
      
      return Array.from(workspaceConfigs.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      this.logger.error('data-export', 'Failed to get export configs', error as Error);
      return [];
    }
  }

  async getExportJobs(workspaceId: string): Promise<ExportJob[]> {
    try {
      return Array.from(this.jobs.values())
        .filter(job => job.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      this.logger.error('data-export', 'Failed to get export jobs', error as Error);
      return [];
    }
  }

  async getTemplates(workspaceId: string): Promise<ExportTemplate[]> {
    try {
      const workspaceTemplates = this.templates.get(workspaceId);
      if (!workspaceTemplates) {
        return [];
      }
      
      return Array.from(workspaceTemplates.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      this.logger.error('data-export', 'Failed to get templates', error as Error);
      return [];
    }
  }

  async getMaskingRules(workspaceId: string): Promise<DataMaskingRule[]> {
    try {
      const workspaceRules = this.maskingRules.get(workspaceId);
      if (!workspaceRules) {
        return [];
      }
      
      return Array.from(workspaceRules.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      this.logger.error('data-export', 'Failed to get masking rules', error as Error);
      return [];
    }
  }

  async cancelExport(jobId: string, userId: string): Promise<boolean> {
    try {
      const job = this.jobs.get(jobId);
      if (!job || !['pending', 'running'].includes(job.status)) {
        return false;
      }
      
      // Check permissions
      const hasPermission = await this.accessControl.hasPermission(userId, job.workspaceId, 'admin');
      if (!hasPermission) {
        return false;
      }
      
      job.status = 'cancelled';
      job.completedAt = new Date();
      job.updatedAt = new Date();
      
      await this.database.query(
        'UPDATE export_jobs SET status = $1, completed_at = $2, updated_at = $3 WHERE id = $4',
        [job.status, job.completedAt, job.updatedAt, jobId]
      );
      
      this.jobs.delete(jobId);
      
      this.emit('exportCancelled', { jobId, userId });
      return true;
      
    } catch (error) {
      this.logger.error('data-export', `Failed to cancel export: ${jobId}`, error as Error);
      return false;
    }
  }

  async getAnalytics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<ExportAnalytics[]> {
    try {
      let sql = 'SELECT * FROM export_analytics WHERE workspace_id = $1';
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
        totalExports: row.total_exports,
        successfulExports: row.successful_exports,
        failedExports: row.failed_exports,
        totalDataExported: parseFloat(row.total_data_exported) || 0,
        averageExportSize: parseFloat(row.average_export_size) || 0,
        averageExportTime: parseFloat(row.average_export_time) || 0,
        exportByType: row.export_by_type || {},
        exportByFormat: row.export_by_format || {},
        topExporters: row.top_exporters || [],
        resellerExports: row.reseller_exports || []
      }));
      
    } catch (error) {
      this.logger.error('data-export', 'Failed to get analytics', error as Error);
      return [];
    }
  }

  // Private helper methods
  private findConfig(configId: string): ExportConfig | null {
    for (const workspaceConfigs of this.configs.values()) {
      const config = workspaceConfigs.get(configId);
      if (config) return config;
    }
    return null;
  }

  private async processPendingJobs(): Promise<void> {
    try {
      for (const [jobId, job] of this.jobs.entries()) {
        if (job.status === 'pending') {
          await this.processJob(jobId);
        }
      }
      
    } catch (error) {
      this.logger.error('data-export', 'Failed to process pending jobs', error as Error);
    }
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    try {
      job.status = 'running';
      job.startedAt = new Date();
      job.updatedAt = new Date();
      
      await this.database.query(
        'UPDATE export_jobs SET status = $1, started_at = $2, updated_at = $3 WHERE id = $4',
        [job.status, job.startedAt, job.updatedAt, jobId]
      );
      
      const config = this.findConfig(job.configId);
      if (!config) {
        throw new Error(`Config not found: ${job.configId}`);
      }
      
      // Initialize progress
      job.progress.total = await this.estimateTotalRecords(config);
      job.progress.processed = 0;
      job.progress.percentage = 0;
      job.progress.currentStep = 'Extracting data';
      
      // Export data based on scope
      const exportData = await this.extractData(config, job);
      
      // Apply privacy and masking
      const processedData = await this.processData(exportData, config, job);
      
      // Generate file
      const filePath = await this.generateFile(processedData, config, job);
      
      // Apply compression and encryption if needed
      const finalPath = await this.postProcessFile(filePath, config, job);
      
      // Deliver file
      const downloadUrl = await this.deliverFile(finalPath, config, job);
      
      // Complete job
      job.status = 'completed';
      job.completedAt = new Date();
      job.stats.duration = Math.floor((job.completedAt.getTime() - job.startedAt!.getTime()) / 1000);
      job.result.filePath = finalPath;
      job.result.downloadUrl = downloadUrl;
      job.result.checksum = await this.calculateChecksum(finalPath);
      job.progress.percentage = 100;
      job.progress.currentStep = 'Completed';
      
      await this.database.query(
        'UPDATE export_jobs SET status = $1, completed_at = $2, stats = $3, result = $4, progress = $5, updated_at = $6 WHERE id = $7',
        [job.status, job.completedAt, JSON.stringify(job.stats), JSON.stringify(job.result), JSON.stringify(job.progress), new Date(), jobId]
      );
      
      this.jobs.delete(jobId);
      
      this.emit('exportCompleted', job);
      
    } catch (error) {
      this.logger.error('data-export', `Failed to process job: ${jobId}`, error as Error);
      
      job.status = 'failed';
      job.completedAt = new Date();
      job.result.error = error.message;
      
      await this.database.query(
        'UPDATE export_jobs SET status = $1, completed_at = $2, result = $3, updated_at = $4 WHERE id = $5',
        [job.status, job.completedAt, JSON.stringify(job.result), new Date(), jobId]
      );
      
      this.jobs.delete(jobId);
      
      this.emit('exportFailed', job);
    }
  }

  private async estimateTotalRecords(config: ExportConfig): Promise<number> {
    let total = 0;
    
    if (config.scope.messages) {
      const result = await this.database.query('SELECT COUNT(*) as count FROM messages WHERE workspace_id = $1', [config.workspaceId]);
      total += parseInt(result.rows[0].count) || 0;
    }
    
    if (config.scope.users) {
      const result = await this.database.query('SELECT COUNT(*) as count FROM users WHERE id IN (SELECT user_id FROM workspace_members WHERE workspace_id = $1)', [config.workspaceId]);
      total += parseInt(result.rows[0].count) || 0;
    }
    
    if (config.scope.channels) {
      const result = await this.database.query('SELECT COUNT(*) as count FROM channels WHERE workspace_id = $1', [config.workspaceId]);
      total += parseInt(result.rows[0].count) || 0;
    }
    
    return total;
  }

  private async extractData(config: ExportConfig, job: ExportJob): Promise<any> {
    const data: any = {};
    
    if (config.scope.messages) {
      job.progress.currentStep = 'Extracting messages';
      const messages = await this.extractMessages(config, job);
      data.messages = messages;
    }
    
    if (config.scope.users) {
      job.progress.currentStep = 'Extracting users';
      const users = await this.extractUsers(config, job);
      data.users = users;
    }
    
    if (config.scope.channels) {
      job.progress.currentStep = 'Extracting channels';
      const channels = await this.extractChannels(config, job);
      data.channels = channels;
    }
    
    if (config.scope.analytics) {
      job.progress.currentStep = 'Extracting analytics';
      const analytics = await this.extractAnalytics(config, job);
      data.analytics = analytics;
    }
    
    return data;
  }

  private async extractMessages(config: ExportConfig, job: ExportJob): Promise<any[]> {
    let sql = 'SELECT * FROM messages WHERE workspace_id = $1';
    const params: any[] = [config.workspaceId];
    
    // Apply filters
    if (config.filters.dateRange) {
      sql += ' AND created_at >= $2 AND created_at <= $3';
      params.push(config.filters.dateRange.start, config.filters.dateRange.end);
    }
    
    if (config.filters.users && config.filters.users.length > 0) {
      sql += ` AND sender_id = ANY($${params.length + 1})`;
      params.push(config.filters.users);
    }
    
    if (config.filters.channels && config.filters.channels.length > 0) {
      sql += ` AND channel_id = ANY($${params.length + 1})`;
      params.push(config.filters.channels);
    }
    
    sql += ' ORDER BY created_at ASC';
    
    const result = await this.database.query(sql, params);
    job.stats.recordsExported += result.rows.length;
    job.progress.processed += result.rows.length;
    job.progress.percentage = Math.floor((job.progress.processed / job.progress.total) * 100);
    
    return result.rows;
  }

  private async extractUsers(config: ExportConfig, job: ExportJob): Promise<any[]> {
    const result = await this.database.query(`
      SELECT u.* FROM users u 
      JOIN workspace_members wm ON u.id = wm.user_id 
      WHERE wm.workspace_id = $1
    `, [config.workspaceId]);
    
    job.stats.recordsExported += result.rows.length;
    job.progress.processed += result.rows.length;
    job.progress.percentage = Math.floor((job.progress.processed / job.progress.total) * 100);
    
    return result.rows;
  }

  private async extractChannels(config: ExportConfig, job: ExportJob): Promise<any[]> {
    const result = await this.database.query('SELECT * FROM channels WHERE workspace_id = $1', [config.workspaceId]);
    
    job.stats.recordsExported += result.rows.length;
    job.progress.processed += result.rows.length;
    job.progress.percentage = Math.floor((job.progress.processed / job.progress.total) * 100);
    
    return result.rows;
  }

  private async extractAnalytics(config: ExportConfig, job: ExportJob): Promise<any> {
    // Mock analytics data
    return {
      summary: {
        totalMessages: job.stats.recordsExported,
        totalUsers: 0,
        totalChannels: 0,
        exportDate: new Date()
      }
    };
  }

  private async processData(data: any, config: ExportConfig, job: ExportJob): Promise<any> {
    job.progress.currentStep = 'Processing data';
    
    // Apply privacy settings
    if (config.privacy.anonymizeUsers) {
      data = await this.anonymizeUsers(data);
    }
    
    if (config.privacy.maskSensitiveData) {
      data = await this.maskSensitiveData(data, config.workspaceId);
    }
    
    if (config.privacy.removePrivateMessages) {
      data = await this.removePrivateMessages(data);
    }
    
    // Apply reseller filtering
    if (config.resellerFiltering.enabled) {
      data = await this.applyResellerFiltering(data, config);
    }
    
    return data;
  }

  private async anonymizeUsers(data: any): Promise<any> {
    // Simple anonymization - replace user IDs and names
    if (data.messages) {
      data.messages = data.messages.map((msg: any) => ({
        ...msg,
        sender_id: `user-${crypto.createHash('md5').update(msg.sender_id).digest('hex').substring(0, 8)}`,
        sender_name: 'Anonymous User'
      }));
    }
    
    if (data.users) {
      data.users = data.users.map((user: any) => ({
        ...user,
        id: `user-${crypto.createHash('md5').update(user.id).digest('hex').substring(0, 8)}`,
        name: 'Anonymous User',
        email: 'anonymous@example.com'
      }));
    }
    
    return data;
  }

  private async maskSensitiveData(data: any, workspaceId: string): Promise<any> {
    const rules = this.maskingRules.get(workspaceId);
    if (!rules || rules.size === 0) {
      return data;
    }
    
    // Apply masking rules to data
    for (const rule of rules.values()) {
      const regex = new RegExp(rule.pattern, 'gi');
      
      // Apply to messages
      if (data.messages && rule.fields.includes('content')) {
        data.messages = data.messages.map((msg: any) => ({
          ...msg,
          content: msg.content.replace(regex, rule.replacement)
        }));
      }
    }
    
    return data;
  }

  private async removePrivateMessages(data: any): Promise<any> {
    if (data.messages) {
      data.messages = data.messages.filter((msg: any) => msg.type !== 'private');
    }
    
    return data;
  }

  private async applyResellerFiltering(data: any, config: ExportConfig): Promise<any> {
    // Mock reseller filtering - in production would check actual reseller relationships
    if (config.resellerFiltering.allowedData.length > 0) {
      const allowedData = new Set(config.resellerFiltering.allowedData);
      
      // Filter based on allowed data types
      Object.keys(data).forEach(key => {
        if (!allowedData.has(key)) {
          delete data[key];
        }
      });
    }
    
    return data;
  }

  private async generateFile(data: any, config: ExportConfig, job: ExportJob): Promise<string> {
    job.progress.currentStep = 'Generating file';
    
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const fileName = `export-${config.workspaceId}-${Date.now()}.${config.format}`;
    const filePath = path.join(exportDir, fileName);
    
    switch (config.format) {
      case 'json':
        await this.generateJsonFile(data, filePath);
        break;
      case 'csv':
        await this.generateCsvFile(data, filePath);
        break;
      case 'xlsx':
        await this.generateExcelFile(data, filePath);
        break;
      case 'xml':
        await this.generateXmlFile(data, filePath);
        break;
      default:
        throw new Error(`Unsupported format: ${config.format}`);
    }
    
    const stats = fs.statSync(filePath);
    job.stats.sizeBytes = stats.size;
    
    return filePath;
  }

  private async generateJsonFile(data: any, filePath: string): Promise<void> {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  private async generateCsvFile(data: any, filePath: string): Promise<void> {
    // Simple CSV generation - in production would use a proper CSV library
    let csv = '';
    
    if (data.messages && data.messages.length > 0) {
      const headers = Object.keys(data.messages[0]);
      csv += headers.join(',') + '\n';
      
      for (const row of data.messages) {
        const values = headers.map(header => `"${row[header] || ''}"`);
        csv += values.join(',') + '\n';
      }
    }
    
    fs.writeFileSync(filePath, csv);
  }

  private async generateExcelFile(data: any, filePath: string): Promise<void> {
    // Mock Excel generation - in production would use a proper Excel library
    await this.generateJsonFile(data, filePath + '.json');
  }

  private async generateXmlFile(data: any, filePath: string): Promise<void> {
    // Simple XML generation
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<export>\n';
    
    for (const [key, value] of Object.entries(data)) {
      xml += `<${key}>\n`;
      if (Array.isArray(value)) {
        value.forEach(item => {
          xml += `  <item>${JSON.stringify(item)}</item>\n`;
        });
      }
      xml += `</${key}>\n`;
    }
    
    xml += '</export>';
    fs.writeFileSync(filePath, xml);
  }

  private async postProcessFile(filePath: string, config: ExportConfig, job: ExportJob): Promise<string> {
    let processedPath = filePath;
    
    // Apply compression
    if (config.delivery.compression) {
      job.progress.currentStep = 'Compressing file';
      processedPath = await this.compressFile(processedPath);
    }
    
    // Apply encryption
    if (config.delivery.encryption) {
      job.progress.currentStep = 'Encrypting file';
      processedPath = await this.encryptFile(processedPath, config.delivery.password);
    }
    
    return processedPath;
  }

  private async compressFile(filePath: string): Promise<string> {
    const compressedPath = filePath + '.gz';
    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(compressedPath);
    
    return new Promise((resolve, reject) => {
      input
        .pipe(zlib.createGzip())
        .pipe(output)
        .on('finish', () => resolve(compressedPath))
        .on('error', reject);
    });
  }

  private async encryptFile(filePath: string, password?: string): Promise<string> {
    // Mock encryption - in production would use proper encryption
    const encryptedPath = filePath + '.enc';
    fs.copyFileSync(filePath, encryptedPath);
    return encryptedPath;
  }

  private async deliverFile(filePath: string, config: ExportConfig, job: ExportJob): Promise<string> {
    job.progress.currentStep = 'Delivering file';
    
    switch (config.delivery.method) {
      case 'download':
        return await this.deliverViaDownload(filePath, config);
      case 'email':
        return await this.deliverViaEmail(filePath, config);
      case 's3':
        return await this.deliverViaS3(filePath, config);
      default:
        throw new Error(`Unsupported delivery method: ${config.delivery.method}`);
    }
  }

  private async deliverViaDownload(filePath: string, config: ExportConfig): Promise<string> {
    const fileName = path.basename(filePath);
    return `/downloads/${fileName}`;
  }

  private async deliverViaEmail(filePath: string, config: ExportConfig): Promise<string> {
    // Mock email delivery
    return `Email sent to ${config.delivery.destination}`;
  }

  private async deliverViaS3(filePath: string, config: ExportConfig): Promise<string> {
    // Mock S3 upload
    return `https://s3.amazonaws.com/exports/${path.basename(filePath)}`;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async checkScheduledExports(): Promise<void> {
    try {
      const now = new Date();
      
      for (const workspaceConfigs of this.configs.values()) {
        for (const config of workspaceConfigs.values()) {
          if (config.schedule.enabled && 
              config.status === 'active' && 
              config.schedule.nextRun <= now) {
            
            // Run scheduled export
            await this.runExport(config.id, config.createdBy);
            
            // Update next run time
            config.schedule.nextRun = this.calculateNextRun(config.schedule);
            await this.database.query(
              'UPDATE export_configs SET schedule = $1 WHERE id = $2',
              [JSON.stringify(config.schedule), config.id]
            );
          }
        }
      }
      
    } catch (error) {
      this.logger.error('data-export', 'Failed to check scheduled exports', error as Error);
    }
  }

  private calculateNextRun(schedule: ExportConfig['schedule']): Date {
    const now = new Date();
    let nextRun = new Date(now);
    
    switch (schedule.frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
      case 'quarterly':
        nextRun.setMonth(nextRun.getMonth() + 3);
        break;
    }
    
    return nextRun;
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    processingActive: boolean;
    configsCount: number;
    activeJobsCount: number;
    templatesCount: number;
    maskingRulesCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!this.isProcessing) {
      issues.push('Processing is not active');
    }
    
    return {
      healthy: issues.length === 0,
      processingActive: this.isProcessing,
      configsCount: Array.from(this.configs.values()).reduce((sum, configs) => sum + configs.size, 0),
      activeJobsCount: this.jobs.size,
      templatesCount: Array.from(this.templates.values()).reduce((sum, templates) => sum + templates.size, 0),
      maskingRulesCount: Array.from(this.maskingRules.values()).reduce((sum, rules) => sum + rules.size, 0),
      issues
    };
  }

  async destroy(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.configs.clear();
    this.jobs.clear();
    this.templates.clear();
    this.maskingRules.clear();
    
    this.logger.info('data-export', 'Data export system shut down');
  }
}

export default UltraDataExport;
