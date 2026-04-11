export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  headers?: Record<string, string>;
  createdAt: string;
  createdBy: string;
  lastTriggered?: string;
  successCount: number;
  failureCount: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, any>;
  timestamp: Date;
  userId?: string;
  productId?: string;
  metadata?: Record<string, any>;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  statusCode?: number;
  response?: string;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  error?: string;
}

export interface WebhookPayload {
  event: string;
  data: Record<string, any>;
  timestamp: string;
  signature?: string;
  webhookId: string;
  eventId: string;
}

export class WebhookManager {
  private static instance: WebhookManager;
  private webhooks: Map<string, Webhook> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private processingQueue: WebhookDelivery[] = [];
  private isProcessing = false;

  static getInstance(): WebhookManager {
    if (!WebhookManager.instance) {
      WebhookManager.instance = new WebhookManager();
    }
    return WebhookManager.instance;
  }

  constructor() {
    this.startProcessing();
  }

  async createWebhook(webhook: Omit<Webhook, 'id' | 'createdAt' | 'successCount' | 'failureCount'>): Promise<Webhook> {
    const newWebhook: Webhook = {
      ...webhook,
      id: this.generateWebhookId(),
      createdAt: new Date().toISOString(),
      successCount: 0,
      failureCount: 0,
    };

    this.webhooks.set(newWebhook.id, newWebhook);
    await this.saveWebhookToDB(newWebhook);

    return newWebhook;
  }

  async updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook> {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      throw new Error(`Webhook ${id} not found`);
    }

    const updatedWebhook = { ...webhook, ...updates };
    this.webhooks.set(id, updatedWebhook);
    await this.saveWebhookToDB(updatedWebhook);

    return updatedWebhook;
  }

  async deleteWebhook(id: string): Promise<void> {
    if (!this.webhooks.has(id)) {
      throw new Error(`Webhook ${id} not found`);
    }

    this.webhooks.delete(id);
    await this.deleteWebhookFromDB(id);
  }

  async getWebhooks(filters: {
    active?: boolean;
    event?: string;
    createdBy?: string;
  } = {}): Promise<Webhook[]> {
    let webhooks = Array.from(this.webhooks.values());

    if (filters.active !== undefined) {
      webhooks = webhooks.filter(w => w.active === filters.active);
    }
    if (filters.event) {
      webhooks = webhooks.filter(w => w.events.includes(filters.event!));
    }
    if (filters.createdBy) {
      webhooks = webhooks.filter(w => w.createdBy === filters.createdBy);
    }

    return webhooks;
  }

  async triggerEvent(event: WebhookEvent): Promise<void> {
    const activeWebhooks = Array.from(this.webhooks.values()).filter(w => 
      w.active && w.events.includes(event.type)
    );

    for (const webhook of activeWebhooks) {
      await this.createDelivery(webhook, event);
    }
  }

  async triggerEventByType(eventType: string, data: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    const event: WebhookEvent = {
      id: this.generateEventId(),
      type: eventType,
      data,
      timestamp: new Date(),
      metadata,
    };

    await this.triggerEvent(event);
  }

  async getDeliveryStatus(deliveryId: string): Promise<WebhookDelivery | null> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      return await this.fetchDeliveryFromDB(deliveryId);
    }
    return delivery;
  }

  async getWebhookDeliveries(webhookId: string, status?: WebhookDelivery['status']): Promise<WebhookDelivery[]> {
    const deliveries = Array.from(this.deliveries.values()).filter(d => d.webhookId === webhookId);
    
    if (status) {
      return deliveries.filter(d => d.status === status);
    }
    
    return deliveries;
  }

  async retryDelivery(deliveryId: string): Promise<void> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    if (delivery.status !== 'failed') {
      throw new Error(`Delivery ${deliveryId} is not in failed state`);
    }

    delivery.status = 'pending';
    delivery.attempt = 0;
    delivery.error = undefined;
    delivery.nextRetryAt = new Date();

    await this.updateDeliveryInDB(delivery);
    this.addToProcessingQueue(delivery);
  }

  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return signature === expectedSignature;
  }

  private async createDelivery(webhook: Webhook, event: WebhookEvent): Promise<void> {
    const delivery: WebhookDelivery = {
      id: this.generateDeliveryId(),
      webhookId: webhook.id,
      eventId: event.id,
      status: 'pending',
      attempt: 0,
      maxAttempts: webhook.retryConfig.maxRetries,
      createdAt: new Date(),
    };

    this.deliveries.set(delivery.id, delivery);
    await this.saveDeliveryToDB(delivery);
    this.addToProcessingQueue(delivery);
  }

  private addToProcessingQueue(delivery: WebhookDelivery): void {
    this.processingQueue.push(delivery);
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const delivery = this.processingQueue.shift()!;
      
      // Check if it's time to retry
      if (delivery.nextRetryAt && new Date() < delivery.nextRetryAt) {
        // Put it back in the queue
        this.processingQueue.push(delivery);
        await this.sleep(1000);
        continue;
      }

      await this.processDelivery(delivery);
    }

    this.isProcessing = false;
  }

  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
    const webhook = this.webhooks.get(delivery.webhookId);
    if (!webhook || !webhook.active) {
      delivery.status = 'failed';
      delivery.error = 'Webhook not found or inactive';
      await this.updateDeliveryInDB(delivery);
      return;
    }

    try {
      const event = await this.getEventById(delivery.eventId);
      if (!event) {
        delivery.status = 'failed';
        delivery.error = 'Event not found';
        await this.updateDeliveryInDB(delivery);
        return;
      }

      const payload: WebhookPayload = {
        event: event.type,
        data: event.data,
        timestamp: event.timestamp.toISOString(),
        webhookId: webhook.id,
        eventId: event.id,
      };

      // Add signature if secret is provided
      if (webhook.secret) {
        payload.signature = this.generateSignature(JSON.stringify(payload), webhook.secret);
      }

      const response = await this.sendWebhook(webhook, payload);
      
      delivery.status = 'delivered';
      delivery.statusCode = response.status;
      delivery.response = await response.text();
      delivery.deliveredAt = new Date();
      
      webhook.successCount++;
      webhook.lastTriggered = new Date().toISOString();
      
      await this.updateDeliveryInDB(delivery);
      await this.saveWebhookToDB(webhook);

    } catch (error) {
      delivery.attempt++;
      delivery.error = error instanceof Error ? error.message : 'Unknown error';
      
      webhook.failureCount++;
      
      if (delivery.attempt >= delivery.maxAttempts) {
        delivery.status = 'failed';
      } else {
        delivery.status = 'retrying';
        delivery.nextRetryAt = this.calculateNextRetry(delivery, webhook);
        this.addToProcessingQueue(delivery);
      }
      
      await this.updateDeliveryInDB(delivery);
      await this.saveWebhookToDB(webhook);
    }
  }

  private async sendWebhook(webhook: Webhook, payload: WebhookPayload): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'SaaSVala-Webhooks/1.0',
      ...webhook.headers,
    };

    if (payload.signature) {
      headers['X-Webhook-Signature'] = payload.signature;
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed with status ${response.status}`);
    }

    return response;
  }

  private calculateNextRetry(delivery: WebhookDelivery, webhook: Webhook): Date {
    const delay = webhook.retryConfig.retryDelay * 
      Math.pow(webhook.retryConfig.backoffMultiplier, delivery.attempt - 1);
    
    return new Date(Date.now() + delay);
  }

  private generateSignature(payload: string, secret: string): string {
    // This should use HMAC-SHA256 in a real implementation
    // For now, return a simple hash
    return Buffer.from(`${payload}:${secret}`).toString('base64');
  }

  private generateWebhookId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeliveryId(): string {
    return `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getEventById(eventId: string): Promise<WebhookEvent | null> {
    // Implement database fetch logic
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async saveWebhookToDB(webhook: Webhook): Promise<void> {
    // Implement database save logic
  }

  private async deleteWebhookFromDB(id: string): Promise<void> {
    // Implement database delete logic
  }

  private async saveDeliveryToDB(delivery: WebhookDelivery): Promise<void> {
    // Implement database save logic
  }

  private async updateDeliveryInDB(delivery: WebhookDelivery): Promise<void> {
    // Implement database update logic
  }

  private async fetchDeliveryFromDB(deliveryId: string): Promise<WebhookDelivery | null> {
    // Implement database fetch logic
    return null;
  }

  stopProcessing(): void {
    this.isProcessing = false;
  }
}

// Predefined webhook event types
export const WEBHOOK_EVENTS = {
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',
  KEY_GENERATED: 'key.generated',
  KEY_ACTIVATED: 'key.activated',
  SERVER_DEPLOYED: 'server.deployed',
  USER_REGISTERED: 'user.registered',
  USER_UPGRADED: 'user.upgraded',
  PAYMENT_COMPLETED: 'payment.completed',
  SYSTEM_ALERT: 'system.alert',
} as const;

export type WebhookEventType = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS];
