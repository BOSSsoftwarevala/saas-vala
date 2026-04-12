// STEP 51: BACKEND QUEUE SYSTEM - Handle send, translate, notify
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface QueueJob {
  id: string;
  type: 'send_message' | 'translate_message' | 'send_notification' | 'update_status';
  priority: 'high' | 'normal' | 'low';
  data: any;
  attempts: number;
  maxAttempts: number;
  delayUntil?: number;
  createdAt: number;
  scheduledAt?: number;
}

export class BackendQueueSystem {
  private static instance: BackendQueueSystem;
  private queues: Map<string, QueueJob[]> = new Map();
  private processing = new Map<string, boolean>();
  private workers: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): BackendQueueSystem {
    if (!BackendQueueSystem.instance) {
      BackendQueueSystem.instance = new BackendQueueSystem();
    }
    return BackendQueueSystem.instance;
  }

  constructor() {
    this.initializeQueues();
    this.startWorkers();
    this.loadPendingJobs();
  }

  private initializeQueues() {
    this.queues.set('send_message', []);
    this.queues.set('translate_message', []);
    this.queues.set('send_notification', []);
    this.queues.set('update_status', []);
    
    this.processing.set('send_message', false);
    this.processing.set('translate_message', false);
    this.processing.set('send_notification', false);
    this.processing.set('update_status', false);
  }

  private startWorkers() {
    // High priority queue processes every 1 second
    this.workers.set('send_message', setInterval(() => this.processQueue('send_message'), 1000));
    
    // Translation queue processes every 2 seconds
    this.workers.set('translate_message', setInterval(() => this.processQueue('translate_message'), 2000));
    
    // Notification queue processes every 3 seconds
    this.workers.set('send_notification', setInterval(() => this.processQueue('send_notification'), 3000));
    
    // Status update queue processes every 500ms (high frequency)
    this.workers.set('update_status', setInterval(() => this.processQueue('update_status'), 500));
  }

  async addJob(
    queueType: string, 
    jobData: any, 
    priority: 'high' | 'normal' | 'low' = 'normal',
    delayMs: number = 0
  ): Promise<string> {
    const jobId = `${queueType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: QueueJob = {
      id: jobId,
      type: queueType as any,
      priority,
      data: jobData,
      attempts: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
      scheduledAt: delayMs > 0 ? Date.now() + delayMs : undefined
    };

    // Save to database for persistence
    await supabase
      .from('internal_queue_jobs')
      .insert({
        job_id: jobId,
        queue_type: queueType,
        priority,
        job_data: jobData,
        attempts: 0,
        max_attempts: 3,
        scheduled_at: job.scheduledAt ? new Date(job.scheduledAt).toISOString() : null,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    const queue = this.queues.get(queueType);
    if (queue) {
      queue.push(job);
      // Sort by priority and scheduled time
      queue.sort((a, b) => {
        if (a.scheduledAt && b.scheduledAt) {
          return a.scheduledAt - b.scheduledAt;
        }
        if (a.scheduledAt) return 1;
        if (b.scheduledAt) return -1;
        
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    }

    console.log(`Job ${jobId} added to ${queueType} queue`);
    return jobId;
  }

  private async processQueue(queueType: string) {
    if (this.processing.get(queueType)) return;
    
    this.processing.set(queueType, true);
    const queue = this.queues.get(queueType);
    
    if (!queue || queue.length === 0) {
      this.processing.set(queueType, false);
      return;
    }

    const now = Date.now();
    const jobsToProcess = queue.filter(job => 
      !job.scheduledAt || job.scheduledAt <= now
    ).slice(0, 5); // Process up to 5 jobs at once

    await Promise.allSettled(
      jobsToProcess.map(job => this.processJob(job))
    );

    // Remove processed jobs from queue
    const remainingJobs = queue.filter(job => 
      !jobsToProcess.includes(job)
    );
    this.queues.set(queueType, remainingJobs);

    this.processing.set(queueType, false);
  }

  private async processJob(job: QueueJob) {
    try {
      job.attempts++;
      
      // Update job status in database
      await supabase
        .from('internal_queue_jobs')
        .update({ 
          attempts: job.attempts,
          status: 'processing',
          processed_at: new Date().toISOString()
        })
        .eq('job_id', job.id);

      let result;
      
      switch (job.type) {
        case 'send_message':
          result = await this.processSendMessage(job.data);
          break;
        case 'translate_message':
          result = await this.processTranslateMessage(job.data);
          break;
        case 'send_notification':
          result = await this.processSendNotification(job.data);
          break;
        case 'update_status':
          result = await this.processUpdateStatus(job.data);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // Mark job as completed
      await supabase
        .from('internal_queue_jobs')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          result_data: result
        })
        .eq('job_id', job.id);

      console.log(`Job ${job.id} completed successfully`);

    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      
      if (job.attempts < job.maxAttempts) {
        // Retry with exponential backoff
        const delayMs = Math.pow(2, job.attempts) * 1000;
        job.scheduledAt = Date.now() + delayMs;
        
        await supabase
          .from('internal_queue_jobs')
          .update({ 
            status: 'pending',
            scheduled_at: new Date(job.scheduledAt).toISOString(),
            error_message: error.message
          })
          .eq('job_id', job.id);

        // Re-add to queue for retry
        const queue = this.queues.get(job.type);
        if (queue) {
          queue.push(job);
        }
      } else {
        // Mark as failed
        await supabase
          .from('internal_queue_jobs')
          .update({ 
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_message: error.message
          })
          .eq('job_id', job.id);
      }
    }
  }

  private async processSendMessage(data: any) {
    const { chatId, senderId, messageText, messageType, clientMessageId } = data;
    
    // Insert message into database
    const { data: message, error } = await supabase
      .from('internal_messages')
      .insert({
        chat_id: chatId,
        sender_id: senderId,
        message_text: messageText,
        message_type: messageType || 'text',
        client_message_id: clientMessageId,
        delivery_status: 'sent',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update chat's last activity
    await supabase
      .from('internal_chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);

    // Queue translation job if needed
    await this.addJob('translate_message', {
      messageId: message.id,
      text: messageText,
      sourceLanguage: 'en', // Would detect this
      targetLanguages: ['es', 'fr', 'de'] // Would get from chat members
    }, 'normal');

    // Queue notification job
    await this.addJob('send_notification', {
      type: 'new_message',
      chatId,
      messageId: message.id,
      senderId,
      excludeUserId: senderId
    }, 'high');

    return { messageId: message.id, status: 'sent' };
  }

  private async processTranslateMessage(data: any) {
    const { messageId, text, sourceLanguage, targetLanguages } = data;
    
    // This would integrate with actual translation service
    const translations: Record<string, string> = {};
    
    for (const targetLang of targetLanguages) {
      if (targetLang === sourceLanguage) continue;
      
      // Mock translation - replace with actual API call
      translations[targetLang] = `[Translated to ${targetLang}] ${text}`;
      
      // Cache translation
      await supabase
        .from('internal_translation_cache')
        .upsert({
          original_text: text,
          target_language: targetLang,
          translated_text: translations[targetLang],
          created_at: new Date().toISOString()
        });
    }

    // Update message with translations
    await supabase
      .from('internal_messages')
      .update({ translated_text: translations })
      .eq('id', messageId);

    return { translations };
  }

  private async processSendNotification(data: any) {
    const { type, chatId, messageId, senderId, excludeUserId } = data;
    
    // Get chat members to notify
    const { data: members } = await supabase
      .from('internal_chat_members')
      .select('user_id')
      .eq('chat_id', chatId)
      .neq('user_id', excludeUserId || '')
      .eq('is_blocked', false);

    if (!members) return;

    // Send notifications via Supabase realtime
    for (const member of members) {
      await supabase
        .channel(`user-${member.user_id}-notifications`)
        .send({
          type: 'broadcast',
          event: 'notification',
          payload: {
            type,
            chatId,
            messageId,
            senderId,
            timestamp: new Date().toISOString()
          }
        });
    }

    return { notifiedUsers: members.length };
  }

  private async processUpdateStatus(data: any) {
    const { messageId, userId, status } = data;
    
    await supabase
      .from('internal_messages')
      .update({ 
        delivery_status: status,
        ...(status === 'read' ? { read_at: new Date().toISOString() } : {}),
        ...(status === 'delivered' ? { delivered_at: new Date().toISOString() } : {})
      })
      .eq('id', messageId)
      .neq('sender_id', userId);

    return { messageId, status, updatedFor: userId };
  }

  private async loadPendingJobs() {
    try {
      const { data: pendingJobs } = await supabase
        .from('internal_queue_jobs')
        .select('*')
        .eq('status', 'pending')
        .lt('attempts', 3)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });

      if (pendingJobs) {
        for (const job of pendingJobs) {
          const queueJob: QueueJob = {
            id: job.job_id,
            type: job.queue_type,
            priority: job.priority,
            data: job.job_data,
            attempts: job.attempts,
            maxAttempts: job.max_attempts,
            createdAt: new Date(job.created_at).getTime(),
            scheduledAt: job.scheduled_at ? new Date(job.scheduled_at).getTime() : undefined
          };

          const queue = this.queues.get(job.queue_type);
          if (queue) {
            queue.push(queueJob);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load pending jobs:', error);
    }
  }

  // Get queue statistics
  async getQueueStats() {
    const stats: Record<string, any> = {};
    
    for (const [queueType, queue] of this.queues.entries()) {
      const { data: dbStats } = await supabase
        .from('internal_queue_jobs')
        .select('status')
        .eq('queue_type', queueType);

      stats[queueType] = {
        pending: queue.length,
        processing: this.processing.get(queueType) ? 1 : 0,
        database: {
          pending: dbStats?.filter(j => j.status === 'pending').length || 0,
          processing: dbStats?.filter(j => j.status === 'processing').length || 0,
          completed: dbStats?.filter(j => j.status === 'completed').length || 0,
          failed: dbStats?.filter(j => j.status === 'failed').length || 0
        }
      };
    }
    
    return stats;
  }

  // Shutdown workers
  shutdown() {
    for (const [queueType, worker] of this.workers.entries()) {
      clearInterval(worker);
      console.log(`Stopped worker for ${queueType} queue`);
    }
  }
}

// Export singleton instance
export const backendQueue = BackendQueueSystem.getInstance();
