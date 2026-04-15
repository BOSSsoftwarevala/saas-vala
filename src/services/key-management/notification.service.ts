// Notification System for Key Management
import { supabase } from '@/integrations/supabase/client';

export type NotificationChannel = 'email' | 'in_app' | 'webhook' | 'sms';
export type NotificationType =
  | 'key_assigned'
  | 'key_activated'
  | 'key_expired'
  | 'key_suspended'
  | 'key_revoked'
  | 'subscription_renewed'
  | 'subscription_expired'
  | 'payment_success'
  | 'payment_failed'
  | 'usage_warning'
  | 'security_alert';

export interface Notification {
  id: string;
  user_id?: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  sent_at?: string;
  error?: string;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  channels: NotificationChannel[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export class NotificationService {
  /**
   * Send notification
   */
  async sendNotification(
    type: NotificationType,
    title: string,
    message: string,
    data: Record<string, unknown> = {},
    userId?: string,
    channels: NotificationChannel[] = ['in_app']
  ): Promise<boolean> {
    try {
      for (const channel of channels) {
        await this.sendToChannel(channel, type, title, message, data, userId);
      }

      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  /**
   * Send notification to specific channel
   */
  private async sendToChannel(
    channel: NotificationChannel,
    type: NotificationType,
    title: string,
    message: string,
    data: Record<string, unknown>,
    userId?: string
  ): Promise<void> {
    const notificationData: Partial<Notification> = {
      user_id: userId,
      type,
      channel,
      title,
      message,
      data,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    switch (channel) {
      case 'in_app':
        await this.sendInAppNotification(notificationData);
        break;
      case 'email':
        await this.sendEmailNotification(notificationData);
        break;
      case 'webhook':
        await this.sendWebhookNotification(notificationData);
        break;
      case 'sms':
        await this.sendSMSNotification(notificationData);
        break;
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(
    notification: Partial<Notification>
  ): Promise<void> {
    try {
      const { error } = await supabase.from('notifications').insert({
        ...notification,
        sent_at: new Date().toISOString(),
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending in-app notification:', error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    notification: Partial<Notification>
  ): Promise<void> {
    try {
      // In production, integrate with email service (SendGrid, AWS SES, etc.)
      // For now, just log the notification
      console.log('Email notification:', notification);

      const { error } = await supabase.from('notifications').insert({
        ...notification,
        sent_at: new Date().toISOString(),
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    notification: Partial<Notification>
  ): Promise<void> {
    try {
      // Get webhook URLs for this notification type
      const { data: webhooks } = await supabase
        .from('webhooks')
        .select('url, secret')
        .eq('event_type', notification.type)
        .eq('is_active', true);

      if (!webhooks || webhooks.length === 0) {
        return;
      }

      // Send to each webhook
      for (const webhook of webhooks) {
        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': webhook.secret || '',
            },
            body: JSON.stringify(notification),
          });

          if (!response.ok) {
            throw new Error(`Webhook failed: ${response.statusText}`);
          }
        } catch (error) {
          console.error('Error sending webhook:', error);
        }
      }

      const { error } = await supabase.from('notifications').insert({
        ...notification,
        sent_at: new Date().toISOString(),
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending webhook notification:', error);
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(
    notification: Partial<Notification>
  ): Promise<void> {
    try {
      // In production, integrate with SMS service (Twilio, etc.)
      // For now, just log the notification
      console.log('SMS notification:', notification);

      const { error } = await supabase.from('notifications').insert({
        ...notification,
        sent_at: new Date().toISOString(),
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending SMS notification:', error);
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    unreadOnly = false,
    limit = 50
  ): Promise<Notification[]> {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as Notification[]) || [];
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
        })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  /**
   * Get notification preferences for user
   */
  async getUserNotificationPreferences(
    userId: string
  ): Promise<NotificationPreference[]> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return (data as NotificationPreference[]) || [];
    } catch (error) {
      console.error('Error getting user notification preferences:', error);
      return [];
    }
  }

  /**
   * Set notification preference for user
   */
  async setNotificationPreference(
    userId: string,
    notificationType: NotificationType,
    channels: NotificationChannel[],
    enabled = true
  ): Promise<boolean> {
    try {
      // Check if preference exists
      const { data: existing } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('notification_type', notificationType)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('notification_preferences')
          .update({
            channels,
            enabled,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('notification_preferences')
          .insert({
            user_id: userId,
            notification_type: notificationType,
            channels,
            enabled,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error setting notification preference:', error);
      return false;
    }
  }

  /**
   * Send key assigned notification
   */
  async sendKeyAssignedNotification(
    userId: string,
    keyId: string,
    productName: string
  ): Promise<boolean> {
    return this.sendNotification(
      'key_assigned',
      'Key Assigned',
      `A new key has been assigned to you for ${productName}`,
      { key_id: keyId, product_name: productName },
      userId,
      ['in_app', 'email']
    );
  }

  /**
   * Send key activated notification
   */
  async sendKeyActivatedNotification(
    userId: string,
    keyId: string,
    deviceName: string
  ): Promise<boolean> {
    return this.sendNotification(
      'key_activated',
      'Key Activated',
      `Your key has been activated on ${deviceName}`,
      { key_id: keyId, device_name },
      userId,
      ['in_app']
    );
  }

  /**
   * Send key expired notification
   */
  async sendKeyExpiredNotification(
    userId: string,
    keyId: string,
    productName: string
  ): Promise<boolean> {
    return this.sendNotification(
      'key_expired',
      'Key Expired',
      `Your key for ${productName} has expired`,
      { key_id: keyId, product_name: productName },
      userId,
      ['in_app', 'email']
    );
  }

  /**
   * Send subscription renewed notification
   */
  async sendSubscriptionRenewedNotification(
    userId: string,
    planName: string,
    nextBillingDate: string
  ): Promise<boolean> {
    return this.sendNotification(
      'subscription_renewed',
      'Subscription Renewed',
      `Your ${planName} subscription has been renewed. Next billing: ${nextBillingDate}`,
      { plan_name: planName, next_billing_date: nextBillingDate },
      userId,
      ['in_app', 'email']
    );
  }

  /**
   * Send subscription expired notification
   */
  async sendSubscriptionExpiredNotification(
    userId: string,
    planName: string
  ): Promise<boolean> {
    return this.sendNotification(
      'subscription_expired',
      'Subscription Expired',
      `Your ${planName} subscription has expired`,
      { plan_name: planName },
      userId,
      ['in_app', 'email']
    );
  }

  /**
   * Send usage warning notification
   */
  async sendUsageWarningNotification(
    userId: string,
    metricType: string,
    currentUsage: number,
    limit: number
  ): Promise<boolean> {
    return this.sendNotification(
      'usage_warning',
      'Usage Warning',
      `You have used ${currentUsage} of ${limit} ${metricType}. Consider upgrading your plan.`,
      { metric_type: metricType, current_usage: currentUsage, limit },
      userId,
      ['in_app']
    );
  }

  /**
   * Send security alert notification
   */
  async sendSecurityAlertNotification(
    userId: string,
    alertType: string,
    details: string
  ): Promise<boolean> {
    return this.sendNotification(
      'security_alert',
      'Security Alert',
      `${alertType}: ${details}`,
      { alert_type: alertType, details },
      userId,
      ['in_app', 'email']
    );
  }

  /**
   * Get unread notification count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_read', false);

      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  /**
   * Clean up old notifications
   */
  async cleanupOldNotifications(daysOld = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const { error, count } = await supabase
        .from('notifications')
        .delete({ count: 'exact' })
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      return 0;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    total_notifications: number;
    unread_notifications: number;
    by_type: Record<NotificationType, number>;
    by_channel: Record<NotificationChannel, number>;
  }> {
    try {
      const [totalResult, unreadResult, byTypeResult, byChannelResult] = await Promise.all([
        supabase.from('notifications').select('id', { count: 'exact' }),
        supabase
          .from('notifications')
          .select('id', { count: 'exact' })
          .eq('is_read', false),
        supabase.from('notifications').select('type'),
        supabase.from('notifications').select('channel'),
      ]);

      const total = totalResult.count || 0;
      const unread = unreadResult.count || 0;

      const byType: Record<NotificationType, number> = {} as any;
      const byChannel: Record<NotificationChannel, number> = {} as any;

      if (byTypeResult.data) {
        for (const notification of byTypeResult.data) {
          byType[notification.type] = (byType[notification.type] || 0) + 1;
        }
      }

      if (byChannelResult.data) {
        for (const notification of byChannelResult.data) {
          byChannel[notification.channel] = (byChannel[notification.channel] || 0) + 1;
        }
      }

      return {
        total_notifications: total,
        unread_notifications: unread,
        by_type: byType,
        by_channel: byChannel,
      };
    } catch (error) {
      console.error('Error getting notification stats:', error);
      return {
        total_notifications: 0,
        unread_notifications: 0,
        by_type: {} as any,
        by_channel: {} as any,
      };
    }
  }
}

export const notificationService = new NotificationService();
