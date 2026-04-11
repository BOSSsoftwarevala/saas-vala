import { EventEmitter } from 'events';
import { UltraLogger } from './logger';
import { UltraDatabase } from './database';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface Job {
  id: string;
  type: 'email' | 'apk_build' | 'data_processing' | 'backup' | 'cleanup' | 'notification' | 'custom';
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  data: any;
  attempts: number;
  maxAttempts: number;
  delay: number; // Delay between retries in milliseconds
  createdAt: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
  progress?: number; // 0-100
  metadata?: any;
}

export interface JobHandler {
  type: Job['type'];
  handler: (job: Job) => Promise<any>;
  timeout: number;
  retryDelay: number;
  maxAttempts: number;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
  processingRate: number; // jobs per minute
  averageProcessingTime: number; // milliseconds
  errorRate: number; // percentage
}

export class UltraQueueSystem extends EventEmitter {
  private static instance: UltraQueueSystem;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private jobHandlers: Map<string, JobHandler> = new Map();
  private processingJobs: Map<string, NodeJS.Timeout> = new Map();
  private isProcessing: boolean = false;
  private maxConcurrentJobs: number;
  private processingInterval: number;
  private cleanupInterval: number;
  private processingTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private jobStats: QueueStats = {
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    retrying: 0,
    processingRate: 0,
    averageProcessingTime: 0,
    errorRate: 0
  };

  static getInstance(): UltraQueueSystem {
    if (!UltraQueueSystem.instance) {
      UltraQueueSystem.instance = new UltraQueueSystem();
    }
    return UltraQueueSystem.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    
    this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_JOBS || '5');
    this.processingInterval = parseInt(process.env.QUEUE_PROCESSING_INTERVAL || '5000');
    this.cleanupInterval = parseInt(process.env.QUEUE_CLEANUP_INTERVAL || '300000'); // 5 minutes
    
    this.setupDefaultHandlers();
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Create jobs table if it doesn't exist
      await this.database.query(`
        CREATE TABLE IF NOT EXISTS jobs (
          id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          priority VARCHAR(20) NOT NULL,
          status VARCHAR(20) NOT NULL,
          data JSONB,
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          delay INTEGER DEFAULT 5000,
          created_at TIMESTAMP DEFAULT NOW(),
          scheduled_at TIMESTAMP,
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          error TEXT,
          result JSONB,
          progress INTEGER DEFAULT 0,
          metadata JSONB
        )
      `);

      // Create indexes
      await this.database.query('CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)');
      await this.database.query('CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority)');
      await this.database.query('CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at ON jobs(scheduled_at)');
      await this.database.query('CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at)');

      this.logger.info('queue-system', 'Database initialized for queue system');
    } catch (error) {
      this.logger.error('queue-system', 'Failed to initialize database', error as Error);
      throw error;
    }
  }

  private setupDefaultHandlers(): void {
    // Email job handler
    this.registerJobHandler('email', {
      type: 'email',
      handler: async (job: Job) => {
        const { to, subject, body, attachments } = job.data;
        
        // Simulate email sending (replace with actual email service)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        this.logger.info('queue-system', `Email sent to ${to}`, { subject, jobId: job.id });
        
        return {
          sent: true,
          to,
          subject,
          sentAt: new Date()
        };
      },
      timeout: 30000,
      retryDelay: 5000,
      maxAttempts: 3
    });

    // APK build job handler
    this.registerJobHandler('apk_build', {
      type: 'apk_build',
      handler: async (job: Job) => {
        const { projectId, buildConfig, outputPath } = job.data;
        
        try {
          // Update progress
          await this.updateJobProgress(job.id, 10);
          
          // Create build directory
          const buildDir = `/tmp/apk-build-${job.id}`;
          await execAsync(`mkdir -p ${buildDir}`);
          
          await this.updateJobProgress(job.id, 20);
          
          // Clone project if needed
          if (buildConfig.repository) {
            await execAsync(`git clone ${buildConfig.repository} ${buildDir}/project`);
          }
          
          await this.updateJobProgress(job.id, 40);
          
          // Build APK
          const buildCommand = buildConfig.buildCommand || './gradlew assembleRelease';
          await execAsync(`cd ${buildDir}/project && ${buildCommand}`, { timeout: 300000 });
          
          await this.updateJobProgress(job.id, 80);
          
          // Copy APK to output location
          const apkPath = path.join(buildDir, 'project', 'app/build/outputs/apk/release/app-release.apk');
          if (fs.existsSync(apkPath)) {
            await execAsync(`cp ${apkPath} ${outputPath}/app-${job.id}.apk`);
          }
          
          await this.updateJobProgress(job.id, 100);
          
          // Cleanup
          await execAsync(`rm -rf ${buildDir}`);
          
          this.logger.info('queue-system', `APK build completed for project ${projectId}`, { jobId: job.id });
          
          return {
            success: true,
            projectId,
            apkPath: `${outputPath}/app-${job.id}.apk`,
            buildTime: new Date()
          };
          
        } catch (error) {
          // Cleanup on error
          await execAsync(`rm -rf /tmp/apk-build-${job.id}`);
          throw error;
        }
      },
      timeout: 600000, // 10 minutes
      retryDelay: 30000,
      maxAttempts: 2
    });

    // Data processing job handler
    this.registerJobHandler('data_processing', {
      type: 'data_processing',
      handler: async (job: Job) => {
        const { processingType, data, options } = job.data;
        
        await this.updateJobProgress(job.id, 10);
        
        let result;
        
        switch (processingType) {
          case 'analytics_aggregation':
            result = await this.processAnalyticsAggregation(data, options, job.id);
            break;
          case 'data_export':
            result = await this.processDataExport(data, options, job.id);
            break;
          case 'data_import':
            result = await this.processDataImport(data, options, job.id);
            break;
          default:
            throw new Error(`Unknown processing type: ${processingType}`);
        }
        
        await this.updateJobProgress(job.id, 100);
        
        this.logger.info('queue-system', `Data processing completed: ${processingType}`, { jobId: job.id });
        
        return result;
      },
      timeout: 300000,
      retryDelay: 10000,
      maxAttempts: 3
    });

    // Backup job handler
    this.registerJobHandler('backup', {
      type: 'backup',
      handler: async (job: Job) => {
        const { backupType, targetPath, compression } = job.data;
        
        await this.updateJobProgress(job.id, 10);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let backupFile;
        
        switch (backupType) {
          case 'database':
            backupFile = await this.createDatabaseBackup(targetPath, timestamp, compression);
            break;
          case 'files':
            backupFile = await this.createFilesBackup(targetPath, timestamp, compression);
            break;
          case 'full':
            backupFile = await this.createFullBackup(targetPath, timestamp, compression);
            break;
          default:
            throw new Error(`Unknown backup type: ${backupType}`);
        }
        
        await this.updateJobProgress(job.id, 100);
        
        this.logger.info('queue-system', `Backup completed: ${backupType}`, { jobId: job.id, backupFile });
        
        return {
          backupType,
          backupFile,
          timestamp,
          size: fs.statSync(backupFile).size
        };
      },
      timeout: 600000,
      retryDelay: 60000,
      maxAttempts: 2
    });

    // Cleanup job handler
    this.registerJobHandler('cleanup', {
      type: 'cleanup',
      handler: async (job: Job) => {
        const { cleanupType, targetPath, olderThanDays } = job.data;
        
        await this.updateJobProgress(job.id, 10);
        
        let cleanedFiles = 0;
        let cleanedSpace = 0;
        
        switch (cleanupType) {
          case 'temp_files':
            ({ cleanedFiles, cleanedSpace } = await this.cleanupTempFiles(targetPath, olderThanDays));
            break;
          case 'log_files':
            ({ cleanedFiles, cleanedSpace } = await this.cleanupLogFiles(targetPath, olderThanDays));
            break;
          case 'backup_files':
            ({ cleanedFiles, cleanedSpace } = await this.cleanupBackupFiles(targetPath, olderThanDays));
            break;
          default:
            throw new Error(`Unknown cleanup type: ${cleanupType}`);
        }
        
        await this.updateJobProgress(job.id, 100);
        
        this.logger.info('queue-system', `Cleanup completed: ${cleanupType}`, { 
          jobId: job.id, 
          cleanedFiles, 
          cleanedSpace 
        });
        
        return {
          cleanupType,
          cleanedFiles,
          cleanedSpace,
          timestamp: new Date()
        };
      },
      timeout: 300000,
      retryDelay: 30000,
      maxAttempts: 2
    });

    // Notification job handler
    this.registerJobHandler('notification', {
      type: 'notification',
      handler: async (job: Job) => {
        const { userId, type, message, channels } = job.data;
        
        // Send notifications through different channels
        const results = [];
        
        for (const channel of channels) {
          try {
            const result = await this.sendNotification(channel, { userId, type, message });
            results.push({ channel, success: true, result });
          } catch (error) {
            results.push({ channel, success: false, error: error.message });
          }
        }
        
        this.logger.info('queue-system', `Notification sent to user ${userId}`, { 
          jobId: job.id, 
          type, 
          channels 
        });
        
        return {
          userId,
          type,
          results,
          sentAt: new Date()
        };
      },
      timeout: 30000,
      retryDelay: 5000,
      maxAttempts: 3
    });
  }

  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('queue-system', 'Queue processing already started');
      return;
    }

    this.logger.info('queue-system', 'Starting queue processing');
    this.isProcessing = true;

    // Start processing loop
    this.processingTimer = setInterval(async () => {
      await this.processJobs();
    }, this.processingInterval);

    // Start cleanup loop
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupOldJobs();
    }, this.cleanupInterval);

    // Initial processing
    await this.processJobs();
  }

  async stopProcessing(): Promise<void> {
    this.logger.info('queue-system', 'Stopping queue processing');
    this.isProcessing = false;

    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Wait for current jobs to complete
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.processingJobs.size > 0 && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Force stop remaining jobs
    for (const [jobId, timeout] of this.processingJobs.entries()) {
      clearTimeout(timeout);
      await this.updateJobStatus(jobId, 'failed', 'Processing stopped due to shutdown');
    }

    this.processingJobs.clear();
    this.logger.info('queue-system', 'Queue processing stopped');
  }

  private async processJobs(): Promise<void> {
    if (!this.isProcessing || this.processingJobs.size >= this.maxConcurrentJobs) {
      return;
    }

    try {
      // Get next jobs to process
      const jobs = await this.getNextJobs(this.maxConcurrentJobs - this.processingJobs.size);

      for (const job of jobs) {
        this.processJob(job);
      }
    } catch (error) {
      this.logger.error('queue-system', 'Failed to process jobs', error as Error);
    }
  }

  private async getNextJobs(limit: number): Promise<Job[]> {
    const query = `
      UPDATE jobs 
      SET status = 'processing', started_at = NOW()
      WHERE id IN (
        SELECT id FROM jobs 
        WHERE status = 'pending' 
        AND (scheduled_at IS NULL OR scheduled_at <= NOW())
        ORDER BY 
          CASE priority 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'normal' THEN 3 
            WHEN 'low' THEN 4 
          END,
          created_at ASC
        LIMIT $1
      )
      RETURNING *
    `;

    const rows = await this.database.query(query, [limit]);
    return rows.map(this.mapRowToJob);
  }

  private async processJob(job: Job): Promise<void> {
    const handler = this.jobHandlers.get(job.type);
    if (!handler) {
      await this.updateJobStatus(job.id, 'failed', `No handler found for job type: ${job.type}`);
      return;
    }

    // Set timeout for job processing
    const timeout = setTimeout(async () => {
      await this.updateJobStatus(job.id, 'failed', `Job timed out after ${handler.timeout}ms`);
      this.processingJobs.delete(job.id);
    }, handler.timeout);

    this.processingJobs.set(job.id, timeout);

    try {
      this.logger.info('queue-system', `Processing job: ${job.id}`, { type: job.type, priority: job.priority });

      const result = await Promise.race([
        handler.handler(job),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Job timeout')), handler.timeout)
        )
      ]);

      clearTimeout(timeout);
      this.processingJobs.delete(job.id);

      await this.updateJobStatus(job.id, 'completed', null, result);

      this.logger.info('queue-system', `Job completed: ${job.id}`, { type: job.type });
      this.emit('jobCompleted', job);

    } catch (error) {
      clearTimeout(timeout);
      this.processingJobs.delete(job.id);

      const newAttempts = job.attempts + 1;
      
      if (newAttempts < handler.maxAttempts) {
        // Retry job
        const retryDelay = handler.retryDelay * Math.pow(2, newAttempts - 1); // Exponential backoff
        const scheduledAt = new Date(Date.now() + retryDelay);
        
        await this.updateJobStatus(job.id, 'retrying', error.message, null, scheduledAt, newAttempts);
        
        this.logger.warn('queue-system', `Job retry scheduled: ${job.id}`, { 
          attempts: newAttempts, 
          maxAttempts: handler.maxAttempts,
          retryDelay 
        });
        
        this.emit('jobRetry', job);
        
      } else {
        // Mark as failed
        await this.updateJobStatus(job.id, 'failed', error.message, null, undefined, newAttempts);
        
        this.logger.error('queue-system', `Job failed: ${job.id}`, error as Error);
        this.emit('jobFailed', job);
      }
    }
  }

  async addJob(type: Job['type'], data: any, options: {
    priority?: Job['priority'];
    scheduledAt?: Date;
    maxAttempts?: number;
    delay?: number;
    metadata?: any;
  } = {}): Promise<string> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const job: Omit<Job, 'attempts' | 'status' | 'createdAt' | 'progress'> = {
      id: jobId,
      type,
      priority: options.priority || 'normal',
      data,
      maxAttempts: options.maxAttempts || 3,
      delay: options.delay || 5000,
      scheduledAt: options.scheduledAt,
      metadata: options.metadata
    };

    try {
      await this.database.query(`
        INSERT INTO jobs (id, type, priority, status, data, max_attempts, delay, scheduled_at, metadata)
        VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8)
      `, [job.id, job.type, job.priority, JSON.stringify(job.data), job.maxAttempts, job.delay, job.scheduledAt, JSON.stringify(job.metadata || {})]);

      this.logger.info('queue-system', `Job added: ${jobId}`, { type, priority: job.priority });
      this.emit('jobAdded', { ...job, attempts: 0, status: 'pending' as const, createdAt: new Date(), progress: 0 });

      return jobId;
    } catch (error) {
      this.logger.error('queue-system', 'Failed to add job', error as Error);
      throw error;
    }
  }

  async getJob(jobId: string): Promise<Job | null> {
    try {
      const rows = await this.database.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
      return rows.length > 0 ? this.mapRowToJob(rows[0]) : null;
    } catch (error) {
      this.logger.error('queue-system', 'Failed to get job', error as Error);
      return null;
    }
  }

  async getJobs(filter: {
    status?: Job['status'];
    type?: Job['type'];
    priority?: Job['priority'];
    limit?: number;
    offset?: number;
  } = {}): Promise<Job[]> {
    try {
      let query = 'SELECT * FROM jobs WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filter.status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(filter.status);
      }

      if (filter.type) {
        query += ` AND type = $${paramIndex++}`;
        params.push(filter.type);
      }

      if (filter.priority) {
        query += ` AND priority = $${paramIndex++}`;
        params.push(filter.priority);
      }

      query += ' ORDER BY created_at DESC';

      if (filter.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(filter.limit);
      }

      if (filter.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(filter.offset);
      }

      const rows = await this.database.query(query, params);
      return rows.map(this.mapRowToJob);
    } catch (error) {
      this.logger.error('queue-system', 'Failed to get jobs', error as Error);
      return [];
    }
  }

  async updateJobProgress(jobId: string, progress: number): Promise<void> {
    try {
      await this.database.query('UPDATE jobs SET progress = $1 WHERE id = $2', [progress, jobId]);
      this.emit('jobProgress', { jobId, progress });
    } catch (error) {
      this.logger.error('queue-system', 'Failed to update job progress', error as Error);
    }
  }

  private async updateJobStatus(
    jobId: string, 
    status: Job['status'], 
    error?: string, 
    result?: any, 
    scheduledAt?: Date,
    attempts?: number
  ): Promise<void> {
    try {
      const query = `
        UPDATE jobs 
        SET status = $1, error = $2, result = $3, scheduled_at = $4, attempts = COALESCE($5, attempts),
            completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN NOW() ELSE completed_at END
        WHERE id = $6
      `;

      await this.database.query(query, [
        status, 
        error, 
        result ? JSON.stringify(result) : null, 
        scheduledAt, 
        attempts, 
        jobId
      ]);

      this.emit('jobStatusUpdated', { jobId, status, error, result });
    } catch (error) {
      this.logger.error('queue-system', 'Failed to update job status', error as Error);
    }
  }

  async deleteJob(jobId: string): Promise<boolean> {
    try {
      const result = await this.database.query('DELETE FROM jobs WHERE id = $1', [jobId]);
      return result.rowCount > 0;
    } catch (error) {
      this.logger.error('queue-system', 'Failed to delete job', error as Error);
      return false;
    }
  }

  async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        return false;
      }

      await this.updateJobStatus(jobId, 'pending', undefined, undefined, new Date(), 0);
      this.logger.info('queue-system', `Job retry requested: ${jobId}`);
      this.emit('jobRetryRequested', { jobId });
      
      return true;
    } catch (error) {
      this.logger.error('queue-system', 'Failed to retry job', error as Error);
      return false;
    }
  }

  async getQueueStats(): Promise<QueueStats> {
    try {
      const stats = await this.database.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN status = 'retrying' THEN 1 END) as retrying,
          AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000 END) as avg_processing_time,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as error_rate
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `);

      const stat = stats[0];
      this.jobStats = {
        total: parseInt(stat.total),
        pending: parseInt(stat.pending),
        processing: parseInt(stat.processing),
        completed: parseInt(stat.completed),
        failed: parseInt(stat.failed),
        retrying: parseInt(stat.retrying),
        processingRate: parseInt(stat.completed) / 60, // jobs per minute for last hour
        averageProcessingTime: parseFloat(stat.avg_processing_time) || 0,
        errorRate: parseFloat(stat.error_rate) || 0
      };

      return this.jobStats;
    } catch (error) {
      this.logger.error('queue-system', 'Failed to get queue stats', error as Error);
      return this.jobStats;
    }
  }

  private async cleanupOldJobs(): Promise<void> {
    try {
      // Delete completed jobs older than 7 days
      await this.database.query(`
        DELETE FROM jobs 
        WHERE status IN ('completed', 'failed') 
        AND created_at < NOW() - INTERVAL '7 days'
      `);

      // Delete failed jobs older than 30 days
      await this.database.query(`
        DELETE FROM jobs 
        WHERE status = 'failed' 
        AND created_at < NOW() - INTERVAL '30 days'
      `);

      this.logger.debug('queue-system', 'Old jobs cleaned up');
    } catch (error) {
      this.logger.error('queue-system', 'Failed to cleanup old jobs', error as Error);
    }
  }

  private mapRowToJob(row: any): Job {
    return {
      id: row.id,
      type: row.type,
      priority: row.priority,
      status: row.status,
      data: row.data,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      delay: row.delay,
      createdAt: row.created_at,
      scheduledAt: row.scheduled_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error,
      result: row.result,
      progress: row.progress,
      metadata: row.metadata
    };
  }

  registerJobHandler(handler: JobHandler): void {
    this.jobHandlers.set(handler.type, handler);
    this.logger.info('queue-system', `Job handler registered: ${handler.type}`);
  }

  unregisterJobHandler(type: Job['type']): void {
    this.jobHandlers.delete(type);
    this.logger.info('queue-system', `Job handler unregistered: ${type}`);
  }

  // Helper methods for job handlers
  private async processAnalyticsAggregation(data: any, options: any, jobId: string): Promise<any> {
    await this.updateJobProgress(jobId, 30);
    
    // Process analytics data
    const result = await this.database.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as events,
        COUNT(DISTINCT user_id) as unique_users
      FROM analytics_events 
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [options.startDate, options.endDate]);

    await this.updateJobProgress(jobId, 60);

    // Generate aggregated data
    const aggregated = result.map(row => ({
      date: row.date,
      events: parseInt(row.events),
      uniqueUsers: parseInt(row.unique_users)
    }));

    await this.updateJobProgress(jobId, 80);

    // Save aggregated data
    await this.database.query(`
      INSERT INTO analytics_aggregated (date, events, unique_users)
      VALUES ($1, $2, $3)
      ON CONFLICT (date) DO UPDATE SET
        events = EXCLUDED.events,
        unique_users = EXCLUDED.unique_users
    `, [aggregated[0]?.date, aggregated[0]?.events, aggregated[0]?.uniqueUsers]);

    return { aggregated, processedAt: new Date() };
  }

  private async processDataExport(data: any, options: any, jobId: string): Promise<any> {
    await this.updateJobProgress(jobId, 20);
    
    const { table, format, filters } = data;
    
    let query = `SELECT * FROM ${table}`;
    const params: any[] = [];
    
    if (filters) {
      const whereClause = Object.keys(filters).map((key, index) => {
        params.push(filters[key]);
        return `${key} = $${index + 1}`;
      }).join(' AND ');
      query += ` WHERE ${whereClause}`;
    }

    const rows = await this.database.query(query, params);
    await this.updateJobProgress(jobId, 60);

    let exportData;
    const filename = `export-${table}-${Date.now()}.${format}`;
    const filepath = `/var/exports/${filename}`;

    if (format === 'csv') {
      exportData = this.convertToCSV(rows);
    } else if (format === 'json') {
      exportData = JSON.stringify(rows, null, 2);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    fs.writeFileSync(filepath, exportData);
    await this.updateJobProgress(jobId, 90);

    return { filename, filepath, recordCount: rows.length, exportedAt: new Date() };
  }

  private async processDataImport(data: any, options: any, jobId: string): Promise<any> {
    await this.updateJobProgress(jobId, 20);
    
    const { table, data: importData, format } = data;
    
    let records;
    if (format === 'json') {
      records = JSON.parse(importData);
    } else if (format === 'csv') {
      records = this.parseCSV(importData);
    } else {
      throw new Error(`Unsupported import format: ${format}`);
    }

    await this.updateJobProgress(jobId, 40);

    let importedCount = 0;
    for (const record of records) {
      try {
        await this.database.query(`
          INSERT INTO ${table} (${Object.keys(record).join(', ')})
          VALUES (${Object.keys(record).map((_, index) => `$${index + 1}`).join(', ')})
        `, Object.values(record));
        importedCount++;
      } catch (error) {
        this.logger.warn('queue-system', `Failed to import record`, { record, error: error.message });
      }
    }

    await this.updateJobProgress(jobId, 90);

    return { importedCount, totalRecords: records.length, importedAt: new Date() };
  }

  private async createDatabaseBackup(targetPath: string, timestamp: string, compression: boolean): Promise<string> {
    const filename = `database-backup-${timestamp}.sql${compression ? '.gz' : ''}`;
    const filepath = path.join(targetPath, filename);
    
    let command = `PGPASSWORD="${process.env.DB_PASSWORD}" pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} > ${filepath}`;
    
    if (compression) {
      command += ` && gzip ${filepath}`;
      filepath += '.gz';
    }
    
    await execAsync(command);
    return filepath;
  }

  private async createFilesBackup(targetPath: string, timestamp: string, compression: boolean): Promise<string> {
    const filename = `files-backup-${timestamp}.tar${compression ? '.gz' : ''}`;
    const filepath = path.join(targetPath, filename);
    
    let command = `tar -cf ${filepath} /var/www/saasvala-site /var/uploads`;
    
    if (compression) {
      command = `tar -czf ${filepath} /var/www/saasvala-site /var/uploads`;
    }
    
    await execAsync(command);
    return filepath;
  }

  private async createFullBackup(targetPath: string, timestamp: string, compression: boolean): Promise<string> {
    const dbFile = await this.createDatabaseBackup(targetPath, timestamp, false);
    const filesFile = await this.createFilesBackup(targetPath, timestamp, false);
    
    const filename = `full-backup-${timestamp}.tar${compression ? '.gz' : ''}`;
    const filepath = path.join(targetPath, filename);
    
    let command = `tar -cf ${filepath} ${dbFile} ${filesFile}`;
    
    if (compression) {
      command = `tar -czf ${filepath} ${dbFile} ${filesFile}`;
    }
    
    await execAsync(command);
    
    // Cleanup individual backup files
    await execAsync(`rm ${dbFile} ${filesFile}`);
    
    return filepath;
  }

  private async cleanupTempFiles(targetPath: string, olderThanDays: number): Promise<{ cleanedFiles: number; cleanedSpace: number }> {
    const { stdout } = await execAsync(`find ${targetPath} -type f -mtime +${olderThanDays} -exec du -b {} + | awk '{sum+=$1} END {print "files:", NR, "space:", sum}'`);
    
    await execAsync(`find ${targetPath} -type f -mtime +${olderThanDays} -delete`);
    
    const match = stdout.match(/files: (\d+) space: (\d+)/);
    return {
      cleanedFiles: parseInt(match?.[1] || '0'),
      cleanedSpace: parseInt(match?.[2] || '0')
    };
  }

  private async cleanupLogFiles(targetPath: string, olderThanDays: number): Promise<{ cleanedFiles: number; cleanedSpace: number }> {
    return await this.cleanupTempFiles(targetPath, olderThanDays);
  }

  private async cleanupBackupFiles(targetPath: string, olderThanDays: number): Promise<{ cleanedFiles: number; cleanedSpace: number }> {
    return await this.cleanupTempFiles(targetPath, olderThanDays);
  }

  private async sendNotification(channel: string, data: any): Promise<any> {
    // Placeholder for actual notification sending
    switch (channel) {
      case 'email':
        return await this.sendEmailNotification(data);
      case 'push':
        return await this.sendPushNotification(data);
      case 'sms':
        return await this.sendSMSNotification(data);
      default:
        throw new Error(`Unknown notification channel: ${channel}`);
    }
  }

  private async sendEmailNotification(data: any): Promise<any> {
    // Placeholder for email sending
    return { sent: true, channel: 'email' };
  }

  private async sendPushNotification(data: any): Promise<any> {
    // Placeholder for push notification sending
    return { sent: true, channel: 'push' };
  }

  private async sendSMSNotification(data: any): Promise<any> {
    // Placeholder for SMS sending
    return { sent: true, channel: 'sms' };
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  private parseCSV(csv: string): any[] {
    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index]?.replace(/^"(.*)"$/, '$1') || '';
      });
      return obj;
    }).filter(row => Object.keys(row).some(key => row[key]));
  }
}

export default UltraQueueSystem;
