// Webhook System for Key Management
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export type WebhookEvent =
  | 'key.created'
  | 'key.assigned'
  | 'key.activated'
  | 'key.deactivated'
  | 'key.expired'
  | 'key.suspended'
  | 'key.revoked'
  | 'key.validated'
  | 'key.usage_limit_reached'
  | 'subscription.created'
  | 'subscription.renewed'
  | 'subscription.expired'
  | 'subscription.cancelled'
  | 'payment.success'
  | 'payment.failed'
  | 'payment.refunded'
  | 'user.created'
  | 'user.suspended'
  | 'security.alert';

export interface Webhook {
  id: string;
  user_id?: string;
  event_type: WebhookEvent;
  url: string;
  secret: string;
  description?: string;
  is_active: boolean;
  headers: Record<string, string>;
  retry_count: number;
  last_triggered_at?: string;
  last_success_at?: string;
  last_failure_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: WebhookEvent;
  payload: Record<string, unknown>;
  response_status?: number;
  response_body?: string;
  error_message?: string;
  delivered_at: string;
  retry_count: number;
  status: 'pending' | 'delivered' | 'failed';
  created_at: string;
}

export class WebhookService {
  /**
   * Create webhook
   */
  async createWebhook(webhook: Partial<Webhook>): Promise<Webhook | null> {
    try {
      const secret = this.generateSecret();

      const { data, error } = await supabase
        .from('webhooks')
        .insert({
          user_id: webhook.user_id,
          event_type: webhook.event_type,
          url: webhook.url,
          secret,
          description: webhook.description,
          is_active: webhook.is_active !== undefined ? webhook.is_active : true,
          headers: webhook.headers || {},
          retry_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as Webhook;
    } catch (error) {
      console.error('Error creating webhook:', error);
      return null;
    }
  }

  /**
   * Get webhooks for event type
   */
  async getWebhooksForEvent(eventType: WebhookEvent): Promise<Webhook[]> {
    try {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('event_type', eventType)
        .eq('is_active', true);

      if (error) throw error;
      return (data as Webhook[]) || [];
    } catch (error) {
      console.error('Error getting webhooks for event:', error);
      return [];
    }
  }

  /**
   * Get user webhooks
   */
  async getUserWebhooks(userId: string): Promise<Webhook[]> {
    try {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as Webhook[]) || [];
    } catch (error) {
      console.error('Error getting user webhooks:', error);
      return [];
    }
  }

  /**
   * Get webhook by ID
   */
  async getWebhookById(webhookId: string): Promise<Webhook | null> {
    try {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('id', webhookId)
        .single();

      if (error) throw error;
      return data as Webhook;
    } catch (error) {
      console.error('Error getting webhook by ID:', error);
      return null;
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    webhookId: string,
    updates: Partial<Webhook>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('webhooks')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', webhookId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating webhook:', error);
      return false;
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', webhookId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting webhook:', error);
      return false;
    }
  }

  /**
   * Toggle webhook active status
   */
  async toggleWebhook(webhookId: string): Promise<boolean> {
    try {
      const webhook = await this.getWebhookById(webhookId);

      if (!webhook) {
        return false;
      }

      return await this.updateWebhook(webhookId, {
        is_active: !webhook.is_active,
      });
    } catch (error) {
      console.error('Error toggling webhook:', error);
      return false;
    }
  }

  /**
   * Trigger webhook
   */
  async triggerWebhook(
    eventType: WebhookEvent,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      const webhooks = await this.getWebhooksForEvent(eventType);

      for (const webhook of webhooks) {
        await this.deliverWebhook(webhook, payload);
      }
    } catch (error) {
      console.error('Error triggering webhooks:', error);
    }
  }

  /**
   * Deliver webhook
   */
  private async deliverWebhook(
    webhook: Webhook,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      // Generate signature
      const signature = this.generateSignature(payload, webhook.secret);

      // Create delivery record
      const { data: delivery } = await supabase
        .from('webhook_deliveries')
        .insert({
          webhook_id: webhook.id,
          event_type: webhook.event_type,
          payload,
          retry_count: 0,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!delivery) {
        throw new Error('Failed to create delivery record');
      }

      // Send webhook
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': webhook.event_type,
          'X-Webhook-ID': webhook.id,
          ...webhook.headers,
        },
        body: JSON.stringify(payload),
      });

      // Update delivery record
      const deliveryUpdate: Partial<WebhookDelivery> = {
        response_status: response.status,
        response_body: await response.text(),
        delivered_at: new Date().toISOString(),
        status: response.ok ? 'delivered' : 'failed',
      };

      if (!response.ok) {
        deliveryUpdate.error_message = `HTTP ${response.status}`;
      }

      await supabase
        .from('webhook_deliveries')
        .update(deliveryUpdate)
        .eq('id', delivery.id);

      // Update webhook stats
      const webhookUpdate: Partial<Webhook> = {
        last_triggered_at: new Date().toISOString(),
      };

      if (response.ok) {
        webhookUpdate.last_success_at = new Date().toISOString();
        webhookUpdate.retry_count = 0;
      } else {
        webhookUpdate.last_failure_at = new Date().toISOString();
        webhookUpdate.retry_count = (webhook.retry_count || 0) + 1;
      }

      await this.updateWebhook(webhook.id, webhookUpdate);
    } catch (error) {
      console.error('Error delivering webhook:', error);
    }
  }

  /**
   * Retry failed webhook deliveries
   */
  async retryFailedDeliveries(maxRetries = 3): Promise<number> {
    try {
      const { data: failedDeliveries } = await supabase
        .from('webhook_deliveries')
        .select('*, webhooks!inner(*)')
        .eq('status', 'failed')
        .lt('retry_count', maxRetries)
        .order('created_at', { ascending: true })
        .limit(10);

      if (!failedDeliveries) {
        return 0;
      }

      let retriedCount = 0;

      for (const delivery of failedDeliveries as any) {
        try {
          const webhook = delivery.webhooks;

          if (!webhook || !webhook.is_active) {
            continue;
          }

          await this.deliverWebhook(webhook, delivery.payload);
          retriedCount++;
        } catch (error) {
          console.error('Error retrying delivery:', error);
        }
      }

      return retriedCount;
    } catch (error) {
      console.error('Error retrying failed deliveries:', error);
      return 0;
    }
  }

  /**
   * Get webhook delivery history
   */
  async getWebhookDeliveries(
    webhookId: string,
    limit = 50
  ): Promise<WebhookDelivery[]> {
    try {
      const { data, error } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as WebhookDelivery[]) || [];
    } catch (error) {
      console.error('Error getting webhook deliveries:', error);
      return [];
    }
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(webhookId: string): Promise<string | null> {
    try {
      const newSecret = this.generateSecret();

      const { error } = await supabase
        .from('webhooks')
        .update({
          secret: newSecret,
          updated_at: new Date().toISOString(),
        })
        .eq('id', webhookId);

      if (error) throw error;

      return newSecret;
    } catch (error) {
      console.error('Error regenerating secret:', error);
      return null;
    }
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    payload: Record<string, unknown>,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Generate signature
   */
  private generateSignature(
    payload: Record<string, unknown>,
    secret: string
  ): string {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Generate secret
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Test webhook
   */
  async testWebhook(webhookId: string): Promise<{
    success: boolean;
    status?: number;
    error?: string;
  }> {
    try {
      const webhook = await this.getWebhookById(webhookId);

      if (!webhook) {
        return {
          success: false,
          error: 'Webhook not found',
        };
      }

      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        event_type: webhook.event_type,
      };

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': this.generateSignature(testPayload, webhook.secret),
          'X-Webhook-Event': webhook.event_type,
          'X-Webhook-ID': webhook.id,
          'X-Webhook-Test': 'true',
        },
        body: JSON.stringify(testPayload),
      });

      return {
        success: response.ok,
        status: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      console.error('Error testing webhook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(webhookId?: string): Promise<{
    total_webhooks: number;
    active_webhooks: number;
    total_deliveries: number;
    successful_deliveries: number;
    failed_deliveries: number;
    by_event_type: Record<WebhookEvent, number>;
  }> {
    try {
      let webhookQuery = supabase.from('webhooks').select('id');
      if (webhookId) {
        webhookQuery = webhookQuery.eq('id', webhookId);
      }

      const [totalWebhooksResult, activeWebhooksResult, deliveriesResult] =
        await Promise.all([
          webhookQuery,
          supabase
            .from('webhooks')
            .select('id', { count: 'exact' })
            .eq('is_active', true),
          supabase.from('webhook_deliveries').select('status, event_type'),
        ]);

      const totalWebhooks = totalWebhooksResult.count || 0;
      const activeWebhooks = activeWebhooksResult.count || 0;

      const deliveries = deliveriesResult.data || [];
      const totalDeliveries = deliveries.length;
      const successfulDeliveries = deliveries.filter(
        d => d.status === 'delivered'
      ).length;
      const failedDeliveries = deliveries.filter(
        d => d.status === 'failed'
      ).length;

      const byEventType: Record<WebhookEvent, number> = {} as any;

      for (const delivery of deliveries) {
        byEventType[delivery.event_type] =
          (byEventType[delivery.event_type] || 0) + 1;
      }

      return {
        total_webhooks: totalWebhooks,
        active_webhooks: activeWebhooks,
        total_deliveries: totalDeliveries,
        successful_deliveries: successfulDeliveries,
        failed_deliveries: failedDeliveries,
        by_event_type: byEventType,
      };
    } catch (error) {
      console.error('Error getting webhook stats:', error);
      return {
        total_webhooks: 0,
        active_webhooks: 0,
        total_deliveries: 0,
        successful_deliveries: 0,
        failed_deliveries: 0,
        by_event_type: {} as any,
      };
    }
  }

  /**
   * Clean up old webhook deliveries
   */
  async cleanupOldDeliveries(daysOld = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const { error, count } = await supabase
        .from('webhook_deliveries')
        .delete({ count: 'exact' })
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error('Error cleaning up old webhook deliveries:', error);
      return 0;
    }
  }
}

export const webhookService = new WebhookService();
