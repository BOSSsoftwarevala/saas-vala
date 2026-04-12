// STEP 124: NOTIFICATION DUPLICATE FIX - Ensure one notification per event
import { createClient } from '@supabase/supabase-js';

export interface NotificationEvent {
  id: string;
  type: 'request_sent' | 'request_approved' | 'request_rejected' | 'request_expired';
  userId: string; // User who should receive notification
  sourceUserId: string; // User who triggered the event
  requestId: string;
  data?: Record<string, any>;
  timestamp: string;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  duplicate?: boolean;
  reason?: string;
}

export class NotificationDuplicateFix {
  private static instance: NotificationDuplicateFix;
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  private eventCache = new Map<string, { processed: boolean; timestamp: number }>();
  private cacheExpiry = 60000; // 1 minute
  private dedupWindow = 30000; // 30 seconds deduplication window

  static getInstance(): NotificationDuplicateFix {
    if (!NotificationDuplicateFix.instance) {
      NotificationDuplicateFix.instance = new NotificationDuplicateFix();
    }
    return NotificationDuplicateFix.instance;
  }

  // Send notification with duplicate prevention
  async sendNotification(event: NotificationEvent): Promise<NotificationResult> {
    try {
      // Generate event signature for deduplication
      const eventSignature = this.generateEventSignature(event);
      
      // Check if already processed
      if (this.isEventProcessed(eventSignature)) {
        return {
          success: true,
          duplicate: true,
          reason: 'Event already processed'
        };
      }

      // Check database for existing notification
      const existingNotification = await this.findExistingNotification(event);
      if (existingNotification) {
        this.markEventProcessed(eventSignature);
        return {
          success: true,
          notificationId: existingNotification.id,
          duplicate: true,
          reason: 'Notification already exists'
        };
      }

      // Create new notification
      const notification = await this.createNotification(event);
      
      // Mark event as processed
      this.markEventProcessed(eventSignature);

      // Send real-time notification
      await this.sendRealtimeNotification(notification);

      console.log(`Notification sent: ${event.type} to ${event.userId} for request ${event.requestId}`);
      
      return {
        success: true,
        notificationId: notification.id
      };

    } catch (error) {
      console.error('Error sending notification:', error);
      return {
        success: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Generate unique event signature
  private generateEventSignature(event: NotificationEvent): string {
    // Create signature based on event type, users, request, and time window
    const timeWindow = Math.floor(Date.now() / this.dedupWindow) * this.dedupWindow;
    const signatureData = `${event.type}:${event.userId}:${event.sourceUserId}:${event.requestId}:${timeWindow}`;
    
    // Simple hash (in production, use proper crypto)
    let hash = 0;
    for (let i = 0; i < signatureData.length; i++) {
      const char = signatureData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // Check if event is already processed
  private isEventProcessed(signature: string): boolean {
    const cached = this.eventCache.get(signature);
    if (!cached) {
      return false;
    }

    // Check if cache entry is expired
    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.eventCache.delete(signature);
      return false;
    }

    return cached.processed;
  }

  // Mark event as processed
  private markEventProcessed(signature: string): void {
    this.eventCache.set(signature, {
      processed: true,
      timestamp: Date.now()
    });

    // Clean up old entries periodically
    if (this.eventCache.size > 1000) {
      this.cleanupCache();
    }
  }

  // Find existing notification in database
  private async findExistingNotification(event: NotificationEvent): Promise<{ id: string } | null> {
    const timeAgo = new Date(Date.now() - this.dedupWindow).toISOString();

    const { data, error } = await this.supabase
      .from('notifications')
      .select('id')
      .eq('type', event.type)
      .eq('user_id', event.userId)
      .eq('source_user_id', event.sourceUserId)
      .eq('request_id', event.requestId)
      .gte('created_at', timeAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return { id: data.id };
  }

  // Create new notification
  private async createNotification(event: NotificationEvent): Promise<{ id: string; type: string; user_id: string }> {
    const { data, error } = await this.supabase
      .from('notifications')
      .insert({
        type: event.type,
        user_id: event.userId,
        source_user_id: event.sourceUserId,
        request_id: event.requestId,
        data: event.data || {},
        created_at: event.timestamp,
        read: false,
        read_at: null
      })
      .select('id, type, user_id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create notification: ${error?.message}`);
    }

    return data;
  }

  // Send real-time notification via WebSocket/push
  private async sendRealtimeNotification(notification: { id: string; type: string; user_id: string }): Promise<void> {
    try {
      // Get user's active sessions/devices
      const { data: sessions } = await this.supabase
        .from('user_sessions')
        .select('socket_id, device_id, push_token')
        .eq('user_id', notification.user_id)
        .eq('active', true);

      if (!sessions || sessions.length === 0) {
        return;
      }

      // Prepare notification payload
      const payload = {
        type: 'notification',
        notificationId: notification.id,
        notificationType: notification.type,
        userId: notification.user_id,
        timestamp: new Date().toISOString()
      };

      // Send to active WebSocket sessions
      for (const session of sessions) {
        if (session.socket_id) {
          // Send via WebSocket (implementation depends on your WebSocket setup)
          await this.sendWebSocketNotification(session.socket_id, payload);
        }
        
        if (session.push_token) {
          // Send push notification (implementation depends on your push service)
          await this.sendPushNotification(session.push_token, payload);
        }
      }

    } catch (error) {
      console.error('Error sending real-time notification:', error);
      // Don't fail the whole operation if real-time delivery fails
    }
  }

  // Send WebSocket notification
  private async sendWebSocketNotification(socketId: string, payload: any): Promise<void> {
    // This would integrate with your WebSocket server
    // For now, just log the action
    console.log(`WebSocket notification sent to ${socketId}:`, payload);
  }

  // Send push notification
  private async sendPushNotification(pushToken: string, payload: any): Promise<void> {
    // This would integrate with your push notification service (FCM, APNs, etc.)
    // For now, just log the action
    console.log(`Push notification sent to ${pushToken}:`, payload);
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return false;
      }

      return true;

    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  // Get unread notifications for user
  async getUnreadNotifications(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching unread notifications:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      return [];
    }
  }

  // Clean up old notifications
  async cleanupOldNotifications(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.supabase
        .from('notifications')
        .delete()
        .lt('created_at', cutoffDate)
        .eq('read', true);

      if (error) {
        console.error('Error cleaning up old notifications:', error);
        return 0;
      }

      const deletedCount = Array.isArray(data) ? data.length : 0;
      console.log(`Cleaned up ${deletedCount} old notifications`);
      return deletedCount;

    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      return 0;
    }
  }

  // Clean up expired cache entries
  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.eventCache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.eventCache.delete(key);
    }

    console.log(`Cleaned up ${keysToDelete.length} expired notification cache entries`);
  }

  // Get notification statistics
  async getNotificationStats(userId?: string): Promise<{
    totalSent: number;
    totalRead: number;
    unreadCount: number;
    duplicatePrevented: number;
    cacheSize: number;
  }> {
    const baseQuery = userId ? this.supabase.from('notifications').select('id, read').eq('user_id', userId) 
                           : this.supabase.from('notifications').select('id, read');

    const [totalResult, unreadResult] = await Promise.all([
      baseQuery,
      userId ? this.getUnreadNotifications(userId, 1000) : []
    ]);

    const totalSent = totalResult.data?.length || 0;
    const totalRead = totalResult.data?.filter(n => n.read).length || 0;
    const unreadCount = Array.isArray(unreadResult) ? unreadResult.length : 0;

    return {
      totalSent,
      totalRead,
      unreadCount,
      duplicatePrevented: this.eventCache.size, // Approximate
      cacheSize: this.eventCache.size
    };
  }

  // Clear cache for specific user
  clearUserCache(userId: string): void {
    const keysToDelete: string[] = [];

    for (const [key] of this.eventCache.keys()) {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.eventCache.delete(key);
    }
  }

  // Clear all cache
  clearAllCache(): void {
    this.eventCache.clear();
  }

  // Set deduplication window
  setDedupWindow(windowMs: number): void {
    this.dedupWindow = windowMs;
  }

  // Get deduplication window
  getDedupWindow(): number {
    return this.dedupWindow;
  }
}

export const notificationDuplicateFix = NotificationDuplicateFix.getInstance();
