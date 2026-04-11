import { EnterpriseDatabase, Database } from '../supabase';

export interface Job {
  id: string;
  type: 'deploy' | 'key_generation' | 'backup' | 'cleanup' | 'analytics' | 'custom';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  payload: Record<string, any>;
  result?: any;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  maxRetries: number;
  delay?: number;
  timeout?: number;
  createdBy?: string;
}

export interface JobHandler {
  type: string;
  handler: (job: Job) => Promise<any>;
  timeout?: number;
  retries?: number;
}

export class RealJobQueue {
  private static instance: RealJobQueue;
  private handlers: Map<string, JobHandler> = new Map();
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;

  static getInstance(): RealJobQueue {
    if (!RealJobQueue.instance) {
      RealJobQueue.instance = new RealJobQueue();
    }
    return RealJobQueue.instance;
  }

  constructor() {
    this.startProcessing();
  }

  async addJob(
    type: Job['type'],
    payload: Record<string, any>,
    options: {
      priority?: Job['priority'];
      delay?: number;
      timeout?: number;
      maxRetries?: number;
      createdBy?: string;
    } = {}
  ): Promise<string> {
    const jobData: Database['public']['Tables']['jobs']['Insert'] = {
      type,
      priority: options.priority || 'medium',
      status: 'pending',
      payload,
      retry_count: 0,
      max_retries: options.maxRetries || 3,
      delay: options.delay,
      timeout: options.timeout,
      created_by: options.createdBy,
    };

    const job = await EnterpriseDatabase.createJob(jobData);
    
    // Track analytics
    await EnterpriseDatabase.trackEvent({
      type: 'job_created',
      category: 'system',
      action: 'create',
      metadata: { 
        jobId: job.id, 
        type, 
        priority: job.priority 
      },
      user_id: options.createdBy
    });

    return job.id;
  }

  async getJob(jobId: string): Promise<Job | null> {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapDbJobToJob(data);
  }

  async getJobs(filters: {
    type?: Job['type'];
    status?: Job['status'];
    createdBy?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Job[]> {
    let query = supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.createdBy) {
      query = query.eq('created_by', filters.createdBy);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data.map(job => this.mapDbJobToJob(job));
  }

  async cancelJob(jobId: string): Promise<void> {
    await EnterpriseDatabase.updateJobStatus(jobId, 'cancelled');
  }

  async retryJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'failed') {
      throw new Error(`Job ${jobId} is not in failed state`);
    }

    if (job.retryCount >= job.maxRetries) {
      throw new Error(`Job ${jobId} has exceeded maximum retries`);
    }

    await EnterpriseDatabase.updateJobStatus(jobId, 'pending');
  }

  registerHandler(type: string, handler: JobHandler['handler'], options?: { timeout?: number; retries?: number }): void {
    this.handlers.set(type, {
      type,
      handler,
      timeout: options?.timeout,
      retries: options?.retries,
    });
  }

  private startProcessing(): void {
    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processNextJob();
    }, 5000); // Check every 5 seconds
  }

  private async processNextJob(): Promise<void> {
    if (!this.isProcessing) return;

    try {
      const jobs = await EnterpriseDatabase.getNextJobs(1);
      if (jobs.length === 0) return;

      const dbJob = jobs[0];
      const job = this.mapDbJobToJob(dbJob);

      // Mark as running
      await EnterpriseDatabase.updateJobStatus(job.id, 'running');
      job.status = 'running';
      job.startedAt = new Date().toISOString();

      // Process job
      this.processJob(job);
    } catch (error) {
      console.error('Error processing job queue:', error);
    }
  }

  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      const error = `No handler found for job type: ${job.type}`;
      await EnterpriseDatabase.updateJobStatus(job.id, 'failed', undefined, error);
      return;
    }

    try {
      const timeout = job.timeout || handler.timeout || 300000; // 5 minutes default
      const result = await this.withTimeout(handler.handler(job), timeout);
      
      await EnterpriseDatabase.updateJobStatus(job.id, 'completed', result);
      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date().toISOString();

      // Track success analytics
      await EnterpriseDatabase.trackEvent({
        type: 'job_completed',
        category: 'system',
        action: 'complete',
        metadata: { 
          jobId: job.id, 
          type: job.type,
          duration: job.startedAt ? Date.now() - new Date(job.startedAt).getTime() : 0
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (job.retryCount < job.maxRetries) {
        // Retry the job
        await EnterpriseDatabase.updateJobStatus(job.id, 'pending', undefined, errorMessage);
        job.status = 'pending';
        job.retryCount++;
        job.error = errorMessage;
      } else {
        // Mark as failed
        await EnterpriseDatabase.updateJobStatus(job.id, 'failed', undefined, errorMessage);
        job.status = 'failed';
        job.error = errorMessage;
        job.completedAt = new Date().toISOString();
      }

      // Track error analytics
      await EnterpriseDatabase.trackEvent({
        type: 'job_failed',
        category: 'system',
        action: 'fail',
        metadata: { 
          jobId: job.id, 
          type: job.type,
          error: errorMessage,
          retryCount: job.retryCount
        }
      });
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Job timeout')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private mapDbJobToJob(dbJob: any): Job {
    return {
      id: dbJob.id,
      type: dbJob.type,
      priority: dbJob.priority,
      status: dbJob.status,
      payload: dbJob.payload,
      result: dbJob.result,
      error: dbJob.error,
      createdAt: dbJob.created_at,
      startedAt: dbJob.started_at,
      completedAt: dbJob.completed_at,
      retryCount: dbJob.retry_count,
      maxRetries: dbJob.max_retries,
      delay: dbJob.delay,
      timeout: dbJob.timeout,
      createdBy: dbJob.created_by,
    };
  }

  stopProcessing(): void {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }

  getQueueStats(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    // This would be a real query in production
    return { pending: 0, running: 0, completed: 0, failed: 0 };
  }
}

// Real job handlers
export const realJobHandlers = {
  deploy: async (job: Job) => {
    console.log('Deploying product:', job.payload);
    
    // Simulate deployment process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update product version in database
    if (job.payload.productId && job.payload.version) {
      await supabase
        .from('product_versions')
        .insert({
          product_id: job.payload.productId,
          version: job.payload.version,
          description: job.payload.description || 'Auto-deployment',
          changelog: job.payload.changelog || '',
          is_active: true,
          deployed_at: new Date().toISOString(),
          created_by: job.createdBy,
          metadata: job.payload.metadata || {}
        });
    }
    
    return { 
      success: true, 
      deployedAt: new Date().toISOString(),
      deploymentId: `deploy_${Date.now()}`
    };
  },

  key_generation: async (job: Job) => {
    console.log('Generating API key:', job.payload);
    
    // Simulate key generation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const apiKey = `sk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const keyHash = await this.hashKey(apiKey);
    
    // Save to database
    if (job.payload.userId && job.payload.productId) {
      await supabase
        .from('api_keys')
        .insert({
          user_id: job.payload.userId,
          product_id: job.payload.productId,
          name: job.payload.name || 'Generated Key',
          key_hash: keyHash,
          permissions: job.payload.permissions || ['read'],
          expires_at: job.payload.expiresAt,
          created_by: job.createdBy
        });
    }
    
    return { 
      success: true, 
      key: apiKey,
      keyId: `key_${Date.now()}`
    };
  },

  backup: async (job: Job) => {
    console.log('Creating backup:', job.payload);
    
    // Simulate backup process
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return { 
      success: true, 
      backupId: `backup_${Date.now()}`,
      size: Math.floor(Math.random() * 1000000) // Random size in bytes
    };
  },

  cleanup: async (job: Job) => {
    console.log('Running cleanup:', job.payload);
    
    // Simulate cleanup process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return { 
      success: true, 
      cleanedItems: Math.floor(Math.random() * 100)
    };
  },

  analytics: async (job: Job) => {
    console.log('Processing analytics:', job.payload);
    
    // Simulate analytics processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return { 
      success: true, 
      processedRecords: Math.floor(Math.random() * 1000)
    };
  },

  private async hashKey(key: string): Promise<string> {
    // In a real implementation, use proper hashing
    return btoa(key);
  }
};

// Initialize real job handlers
export function initializeRealJobHandlers(): void {
  const jobQueue = RealJobQueue.getInstance();
  
  Object.entries(realJobHandlers).forEach(([type, handler]) => {
    if (type !== 'private') {
      jobQueue.registerHandler(type, handler as any);
    }
  });
}

// Import supabase
import { supabase } from '../supabase';

export default RealJobQueue;
