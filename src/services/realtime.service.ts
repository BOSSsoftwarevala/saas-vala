// Real-time Updates Service - Supabase Realtime subscriptions
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeSubscription {
  channel: RealtimeChannel;
  table: string;
  event: RealtimeEvent | RealtimeEvent[];
  callback: (payload: RealtimePostgresChangesPayload<any>) => void;
  filter?: string;
}

class RealtimeService {
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  private isConnected = false;

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection() {
    try {
      // Enable realtime for all tables
      const tables = [
        'products',
        'orders',
        'keys',
        'servers',
        'support_tickets',
        'audit_logs',
        'wallet_transactions',
        'apks',
        'server_deployments',
        'ai_api_usage_logs',
        'resellers',
      ];

      // In production, you would enable realtime on these tables via Supabase dashboard
      // This is a placeholder for the connection setup
      console.log('Realtime service initialized');
      this.isConnected = true;
    } catch (error) {
      console.error('Error initializing realtime service:', error);
    }
  }

  subscribe<T = any>(
    table: string,
    event: RealtimeEvent | RealtimeEvent[],
    callback: (payload: RealtimePostgresChangesPayload<T>) => void,
    filter?: string
  ): string {
    const subscriptionId = `${table}-${Date.now()}`;

    const channel = supabase
      .channel(subscriptionId)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          filter,
        },
        callback
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to ${table} for ${Array.isArray(event) ? event.join(', ') : event} events`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Error subscribing to ${table}`);
        }
      });

    this.subscriptions.set(subscriptionId, {
      channel,
      table,
      event,
      callback,
      filter,
    });

    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      supabase.removeChannel(subscription.channel);
      this.subscriptions.delete(subscriptionId);
      console.log(`Unsubscribed from ${subscription.table}`);
    }
  }

  unsubscribeAll(): void {
    this.subscriptions.forEach((subscription, id) => {
      this.unsubscribe(id);
    });
  }

  unsubscribeByTable(table: string): void {
    const toRemove: string[] = [];
    this.subscriptions.forEach((subscription, id) => {
      if (subscription.table === table) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => this.unsubscribe(id));
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  // Convenience methods for common subscriptions
  subscribeToOrders(
    callback: (payload: RealtimePostgresChangesPayload<any>) => void
  ): string {
    return this.subscribe('orders', '*', callback);
  }

  subscribeToTickets(
    callback: (payload: RealtimePostgresChangesPayload<any>) => void
  ): string {
    return this.subscribe('support_tickets', '*', callback);
  }

  subscribeToServerStatus(
    callback: (payload: RealtimePostgresChangesPayload<any>) => void
  ): string {
    return this.subscribe('servers', 'UPDATE', callback);
  }

  subscribeToWalletTransactions(
    callback: (payload: RealtimePostgresChangesPayload<any>) => void
  ): string {
    return this.subscribe('wallet_transactions', 'INSERT', callback);
  }

  subscribeToAuditLogs(
    callback: (payload: RealtimePostgresChangesPayload<any>) => void
  ): string {
    return this.subscribe('audit_logs', 'INSERT', callback);
  }

  subscribeToAPKDeployments(
    callback: (payload: RealtimePostgresChangesPayload<any>) => void
  ): string {
    return this.subscribe('server_deployments', '*', callback);
  }

  subscribeToAIUsage(
    callback: (payload: RealtimePostgresChangesPayload<any>) => void
  ): string {
    return this.subscribe('ai_api_usage_logs', 'INSERT', callback);
  }

  subscribeToProductUpdates(
    callback: (payload: RealtimePostgresChangesPayload<any>) => void
  ): string {
    return this.subscribe('products', '*', callback);
  }

  // Presence channels for user activity
  subscribeToPresence(channelName: string, callback: (payload: any) => void): string {
    const subscriptionId = `presence-${channelName}-${Date.now()}`;

    const channel = supabase.channel(subscriptionId)
      .on('presence', { event: 'sync' }, callback)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to presence channel: ${channelName}`);
        }
      });

    this.subscriptions.set(subscriptionId, {
      channel,
      table: 'presence',
      event: 'sync',
      callback,
    });

    return subscriptionId;
  }

  // Broadcast channels for real-time messaging
  subscribeToBroadcast(channelName: string, callback: (payload: any) => void): string {
    const subscriptionId = `broadcast-${channelName}-${Date.now()}`;

    const channel = supabase.channel(subscriptionId)
      .on('broadcast', { event: '*' }, callback)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to broadcast channel: ${channelName}`);
        }
      });

    this.subscriptions.set(subscriptionId, {
      channel,
      table: 'broadcast',
      event: '*',
      callback,
    });

    return subscriptionId;
  }

  sendBroadcast(channelName: string, payload: any): void {
    supabase.channel(channelName).send({
      type: 'broadcast',
      event: 'message',
      payload,
    });
  }

  // Track user presence
  async trackPresence(userId: string, status: 'online' | 'offline' | 'away'): Promise<void> {
    const channelName = `user-presence-${userId}`;
    const channel = supabase.channel(channelName);

    await channel.track({
      user_id: userId,
      status,
      online_at: new Date().toISOString(),
    });
  }

  // Cleanup on component unmount
  cleanup(): void {
    this.unsubscribeAll();
  }
}

export const realtimeService = new RealtimeService();

// React hook for using realtime subscriptions
import { useEffect, useRef } from 'react';

export function useRealtimeSubscription<T = any>(
  table: string,
  event: RealtimeEvent | RealtimeEvent[],
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  filter?: string,
  enabled = true
) {
  const subscriptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    subscriptionIdRef.current = realtimeService.subscribe(table, event, callback, filter);

    return () => {
      if (subscriptionIdRef.current) {
        realtimeService.unsubscribe(subscriptionIdRef.current);
      }
    };
  }, [table, event, callback, filter, enabled]);
}

export function useRealtimePresence(
  channelName: string,
  callback: (payload: any) => void,
  enabled = true
) {
  const subscriptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    subscriptionIdRef.current = realtimeService.subscribeToPresence(channelName, callback);

    return () => {
      if (subscriptionIdRef.current) {
        realtimeService.unsubscribe(subscriptionIdRef.current);
      }
    };
  }, [channelName, callback, enabled]);
}

export function useRealtimeBroadcast(
  channelName: string,
  callback: (payload: any) => void,
  enabled = true
) {
  const subscriptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    subscriptionIdRef.current = realtimeService.subscribeToBroadcast(channelName, callback);

    return () => {
      if (subscriptionIdRef.current) {
        realtimeService.unsubscribe(subscriptionIdRef.current);
      }
    };
  }, [channelName, callback, enabled]);
}
