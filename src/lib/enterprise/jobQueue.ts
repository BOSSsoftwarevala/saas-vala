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
  delay?: number; // in milliseconds
  timeout?: number; // in milliseconds
  createdBy?: string;
}

export interface JobHandler {
  type: string;
  handler: (job: Job) => Promise<any>;
  timeout?: number;
  retries?: number;
}

export class JobQueue {
  private static instance: JobQueue;
  private queue: Job[] = [];
  private running: Map<string, Job> = new Map();
  private handlers: Map<string, JobHandler> = new Map();
  private isProcessing = false;
  private concurrency = 5; // Max concurrent jobs

  static getInstance(): JobQueue {
    if (!JobQueue.instance) {
      JobQueue.instance = new JobQueue();
    }
    return JobQueue.instance;
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
    const job: Job = {
      id: this.generateJobId(),
      type,
      priority: options.priority || 'medium',
      status: 'pending',
      payload,
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      delay: options.delay,
      timeout: options.timeout,
      createdBy: options.createdBy,
      createdAt: new Date().toISOString(),
    };

    // Insert job in priority order
    this.insertJobByPriority(job);
    await this.saveJobToDB(job);

    return job.id;
  }

  async getJob(jobId: string): Promise<Job | null> {
    // Check running jobs first
    const runningJob = this.running.get(jobId);
    if (runningJob) {
      return runningJob;
    }

    // Check queue
    const queuedJob = this.queue.find(j => j.id === jobId);
    if (queuedJob) {
      return queuedJob;
    }

    // Check database for completed jobs
    return await this.fetchJobFromDB(jobId);
  }

  async getJobs(filters: {
    type?: Job['type'];
    status?: Job['status'];
    createdBy?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Job[]> {
    let jobs = [...this.queue, ...Array.from(this.running.values())];

    // Apply filters
    if (filters.type) {
      jobs = jobs.filter(j => j.type === filters.type);
    }
    if (filters.status) {
      jobs = jobs.filter(j => j.status === filters.status);
    }
    if (filters.createdBy) {
      jobs = jobs.filter(j => j.createdBy === filters.createdBy);
    }

    // Sort by creation time (newest first)
    jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    if (filters.offset) {
      jobs = jobs.slice(filters.offset);
    }
    if (filters.limit) {
      jobs = jobs.slice(0, filters.limit);
    }

    return jobs;
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = this.queue.find(j => j.id === jobId);
    if (job && job.status === 'pending') {
      job.status = 'cancelled';
      await this.updateJobInDB(job);
    }
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

    job.status = 'pending';
    job.retryCount++;
    job.error = undefined;
    
    this.insertJobByPriority(job);
    await this.updateJobInDB(job);
  }

  registerHandler(type: string, handler: JobHandler['handler'], options?: { timeout?: number; retries?: number }): void {
    this.handlers.set(type, {
      type,
      handler,
      timeout: options?.timeout,
      retries: options?.retries,
    });
  }

  private async startProcessing(): void {
    this.isProcessing = true;
    while (this.isProcessing) {
      await this.processNextJob();
      await this.sleep(100); // Small delay to prevent busy waiting
    }
  }

  private async processNextJob(): Promise<void> {
    if (this.running.size >= this.concurrency) {
      return;
    }

    const job = this.getNextJob();
    if (!job) {
      return;
    }

    // Remove from queue and mark as running
    this.queue = this.queue.filter(j => j.id !== job.id);
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    this.running.set(job.id, job);
    await this.updateJobInDB(job);

    // Process job
    this.processJob(job);
  }

  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = 'failed';
      job.error = `No handler found for job type: ${job.type}`;
      job.completedAt = new Date().toISOString();
      this.running.delete(job.id);
      await this.updateJobInDB(job);
      return;
    }

    try {
      const timeout = job.timeout || handler.timeout || 300000; // 5 minutes default
      const result = await this.withTimeout(handler.handler(job), timeout);
      
      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date().toISOString();
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date().toISOString();

      // Auto-retry if available
      if (job.retryCount < job.maxRetries) {
        job.status = 'pending';
        job.retryCount++;
        job.error = undefined;
        job.startedAt = undefined;
        this.insertJobByPriority(job);
      }
    } finally {
      this.running.delete(job.id);
      await this.updateJobInDB(job);
    }
  }

  private getNextJob(): Job | null {
    const now = Date.now();
    
    for (const job of this.queue) {
      if (job.status !== 'pending') continue;
      if (job.delay && new Date(job.createdAt).getTime() + job.delay > now) continue;
      return job;
    }
    
    return null;
  }

  private insertJobByPriority(job: Job): void {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const jobPriority = priorityOrder[job.priority];
    
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const queuePriority = priorityOrder[this.queue[i].priority];
      if (jobPriority < queuePriority) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, job);
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Job timeout')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveJobToDB(job: Job): Promise<void> {
    // Implement database save logic
  }

  private async updateJobInDB(job: Job): Promise<void> {
    // Implement database update logic
  }

  private async fetchJobFromDB(jobId: string): Promise<Job | null> {
    // Implement database fetch logic
    return null;
  }

  stopProcessing(): void {
    this.isProcessing = false;
  }

  getQueueStats(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    const pending = this.queue.filter(j => j.status === 'pending').length;
    const running = this.running.size;
    // Note: completed/failed counts would need to be fetched from DB
    return { pending, running, completed: 0, failed: 0 };
  }
}

// Default job handlers
export const defaultJobHandlers = {
  deploy: async (job: Job) => {
    // Implement deployment logic
    console.log('Deploying:', job.payload);
    return { success: true, deployedAt: new Date().toISOString() };
  },

  key_generation: async (job: Job) => {
    // Implement key generation logic
    console.log('Generating key:', job.payload);
    return { success: true, key: 'generated_key_' + Date.now() };
  },

  backup: async (job: Job) => {
    // Implement backup logic
    console.log('Creating backup:', job.payload);
    return { success: true, backupId: 'backup_' + Date.now() };
  },

  cleanup: async (job: Job) => {
    // Implement cleanup logic
    console.log('Cleaning up:', job.payload);
    return { success: true, cleanedItems: 0 };
  },

  analytics: async (job: Job) => {
    // Implement analytics processing logic
    console.log('Processing analytics:', job.payload);
    return { success: true, processedRecords: 0 };
  },
};
