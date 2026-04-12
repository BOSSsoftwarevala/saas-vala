// STEP 84: CLIENT QUEUE BUFFER - Queue messages locally before send, flush when connection stable
export interface QueuedMessage {
  id: string;
  chatId: string;
  content: string;
  type: 'text' | 'voice' | 'image' | 'file';
  mediaData?: any;
  clientMessageId: string;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  maxRetries: number;
  nextRetryTime: number;
}

export interface QueueStats {
  totalQueued: number;
  pending: number;
  failed: number;
  processing: number;
  oldestMessage: number | null;
}

export class ClientQueueBuffer {
  private static instance: ClientQueueBuffer;
  private queue: QueuedMessage[] = [];
  private isProcessing = false;
  private isOnline = navigator.onLine;
  private processingInterval: NodeJS.Timeout | null = null;
  private maxQueueSize = 1000;
  private batchSize = 5;
  private processingDelay = 1000; // 1 second between batches

  static getInstance(): ClientQueueBuffer {
    if (!ClientQueueBuffer.instance) {
      ClientQueueBuffer.instance = new ClientQueueBuffer();
    }
    return ClientQueueBuffer.instance;
  }

  constructor() {
    this.loadPersistedQueue();
    this.setupNetworkListeners();
    this.startProcessing();
  }

  private loadPersistedQueue() {
    try {
      const stored = localStorage.getItem('message_queue');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.queue = parsed.filter((msg: QueuedMessage) => {
          // Filter out very old messages (older than 24 hours)
          return Date.now() - msg.timestamp < 24 * 60 * 60 * 1000;
        });
        console.log(`Loaded ${this.queue.length} messages from persisted queue`);
      }
    } catch (error) {
      console.error('Failed to load persisted queue:', error);
    }
  }

  private persistQueue() {
    try {
      localStorage.setItem('message_queue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to persist queue:', error);
    }
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('Network restored, resuming queue processing');
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      console.log('Network lost, pausing queue processing');
      this.isOnline = false;
    });
  }

  // Add message to queue
  enqueue(message: Omit<QueuedMessage, 'id' | 'timestamp' | 'retryCount' | 'nextRetryTime'>): string {
    const queuedMessage: QueuedMessage = {
      ...message,
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      nextRetryTime: Date.now()
    };

    // Add to queue with priority ordering
    this.queue.push(queuedMessage);
    this.sortQueue();

    // Limit queue size
    if (this.queue.length > this.maxQueueSize) {
      const removed = this.queue.splice(0, this.queue.length - this.maxQueueSize);
      console.warn(`Queue size limit reached, removed ${removed.length} old messages`);
    }

    this.persistQueue();
    console.log(`Message enqueued: ${queuedMessage.id}, queue size: ${this.queue.length}`);

    // Try to process immediately if online
    if (this.isOnline) {
      this.processQueue();
    }

    return queuedMessage.id;
  }

  private sortQueue() {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    this.queue.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by timestamp (older first)
      return a.timestamp - b.timestamp;
    });
  }

  // Start processing queue
  private startProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      if (this.isOnline && !this.isProcessing) {
        this.processQueue();
      }
    }, this.processDelay);
  }

  // Process queue
  private async processQueue() {
    if (this.isProcessing || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get messages ready to process
      const now = Date.now();
      const readyMessages = this.queue.filter(msg => 
        msg.retryCount === 0 || msg.nextRetryTime <= now
      ).slice(0, this.batchSize);

      if (readyMessages.length === 0) {
        return;
      }

      console.log(`Processing ${readyMessages.length} messages from queue`);

      // Process messages in parallel
      const results = await Promise.allSettled(
        readyMessages.map(msg => this.processMessage(msg))
      );

      // Handle results
      results.forEach((result, index) => {
        const message = readyMessages[index];
        
        if (result.status === 'fulfilled' && result.value) {
          // Message sent successfully, remove from queue
          this.removeFromQueue(message.id);
          console.log(`Message sent successfully: ${message.id}`);
        } else {
          // Message failed, update retry info
          this.handleFailedMessage(message, result.status === 'rejected' ? result.reason : new Error('Unknown error'));
        }
      });

      this.persistQueue();

    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process individual message
  private async processMessage(message: QueuedMessage): Promise<boolean> {
    try {
      const response = await fetch('/api/internal-chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          chat_id: message.chatId,
          message_text: message.content,
          message_type: message.type,
          client_message_id: message.clientMessageId,
          media_data: message.mediaData
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.success;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Failed to send message ${message.id}:`, error);
      throw error;
    }
  }

  // Handle failed message
  private handleFailedMessage(message: QueuedMessage, error: any) {
    message.retryCount++;
    
    if (message.retryCount >= message.maxRetries) {
      // Max retries reached, mark as permanently failed
      console.error(`Message ${message.id} failed permanently after ${message.maxRetries} retries`);
      // Keep in queue but mark as failed for UI display
    } else {
      // Schedule retry with exponential backoff
      const backoffDelay = Math.min(1000 * Math.pow(2, message.retryCount), 30000); // Max 30 seconds
      message.nextRetryTime = Date.now() + backoffDelay;
      
      console.log(`Message ${message.id} scheduled for retry ${message.retryCount}/${message.maxRetries} in ${backoffDelay}ms`);
    }
  }

  // Remove message from queue
  private removeFromQueue(messageId: string) {
    const index = this.queue.findIndex(msg => msg.id === messageId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  // Get queue statistics
  getQueueStats(): QueueStats {
    const now = Date.now();
    const pending = this.queue.filter(msg => msg.retryCount === 0).length;
    const failed = this.queue.filter(msg => msg.retryCount >= msg.maxRetries).length;
    const processing = this.queue.filter(msg => msg.retryCount > 0 && msg.retryCount < msg.maxRetries).length;
    const oldestMessage = this.queue.length > 0 ? Math.min(...this.queue.map(msg => msg.timestamp)) : null;

    return {
      totalQueued: this.queue.length,
      pending,
      failed,
      processing,
      oldestMessage
    };
  }

  // Get messages for specific chat
  getChatMessages(chatId: string): QueuedMessage[] {
    return this.queue.filter(msg => msg.chatId === chatId);
  }

  // Remove message from queue (e.g., when confirmed received)
  removeMessage(messageId: string): boolean {
    const index = this.queue.findIndex(msg => msg.id === messageId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.persistQueue();
      return true;
    }
    return false;
  }

  // Clear all messages
  clearQueue(): void {
    this.queue = [];
    this.persistQueue();
  }

  // Clear messages for specific chat
  clearChatMessages(chatId: string): void {
    this.queue = this.queue.filter(msg => msg.chatId !== chatId);
    this.persistQueue();
  }

  // Force retry failed messages
  retryFailedMessages(): void {
    const now = Date.now();
    this.queue.forEach(msg => {
      if (msg.retryCount > 0 && msg.retryCount < msg.maxRetries) {
        msg.nextRetryTime = now;
      }
    });
    this.processQueue();
  }

  // Check if message is in queue
  isMessageQueued(clientMessageId: string): boolean {
    return this.queue.some(msg => msg.clientMessageId === clientMessageId);
  }

  // Get message by client ID
  getMessageByClientId(clientMessageId: string): QueuedMessage | undefined {
    return this.queue.find(msg => msg.clientMessageId === clientMessageId);
  }

  // Update message priority
  updateMessagePriority(messageId: string, priority: 'high' | 'normal' | 'low'): boolean {
    const message = this.queue.find(msg => msg.id === messageId);
    if (message) {
      message.priority = priority;
      this.sortQueue();
      this.persistQueue();
      return true;
    }
    return false;
  }

  private getAuthToken(): string {
    return localStorage.getItem('auth_token') || '';
  }

  // Cleanup old messages
  cleanup(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const beforeCount = this.queue.length;
    
    this.queue = this.queue.filter(msg => msg.timestamp > oneDayAgo);
    
    if (this.queue.length < beforeCount) {
      console.log(`Cleaned up ${beforeCount - this.queue.length} old messages from queue`);
      this.persistQueue();
    }
  }

  // Start periodic cleanup
  startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000); // Every hour
  }

  // Destroy queue
  destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.persistQueue();
  }
}

export const clientQueueBuffer = ClientQueueBuffer.getInstance();
