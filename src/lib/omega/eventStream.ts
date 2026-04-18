/**
 * EVENT STREAM ENGINE
 * Every action → event log for debug, rollback, replay
 * 
 * EVENT STRUCTURE:
 * - user_id
 * - action
 * - entity
 * - before
 * - after
 * - timestamp
 * - trace_id
 */

import { supabase } from '@/lib/supabase';

export interface EventStreamEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before: any;
  after: any;
  timestamp: string;
  trace_id: string;
  session_id?: string;
  metadata?: Record<string, any>;
}

export class EventStreamEngine {
  private static instance: EventStreamEngine;
  private eventQueue: EventStreamEntry[] = [];
  private sessionId: string;
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.startFlushInterval();
  }

  static getInstance(): EventStreamEngine {
    if (!EventStreamEngine.instance) {
      EventStreamEngine.instance = new EventStreamEngine();
    }
    return EventStreamEngine.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startFlushInterval(): void {
    // Flush events every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flushEvents();
    }, 5000);
  }

  /**
   * Log an event to the stream
   */
  async logEvent(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    before: any = null,
    after: any = null,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: EventStreamEntry = {
      id: this.generateId(),
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before,
      after,
      timestamp: new Date().toISOString(),
      trace_id: this.generateTraceId(),
      session_id: this.sessionId,
      metadata,
    };

    this.eventQueue.push(event);

    // Also log to audit_logs for compatibility
    await this.logToAuditLogs(event);
  }

  private async logToAuditLogs(event: EventStreamEntry): Promise<void> {
    try {
      await supabase.from('audit_logs').insert({
        user_id: event.user_id,
        action: event.action as any,
        table_name: event.entity_type,
        record_id: event.entity_id,
        old_values: event.before,
        new_values: event.after,
        metadata: {
          trace_id: event.trace_id,
          session_id: event.sessionId,
          ...event.metadata,
        },
      });
    } catch (error) {
      console.error('Failed to log to audit_logs:', error);
    }
  }

  /**
   * Flush queued events to database
   */
  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Store in event_streams table if it exists
      await supabase.from('event_streams').insert(eventsToFlush);
    } catch (error) {
      console.error('Failed to flush events:', error);
      // Re-queue failed events
      this.eventQueue = [...eventsToFlush, ...this.eventQueue];
    }
  }

  /**
   * Query events for replay/debug
   */
  async getEvents(filters: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    traceId?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): Promise<EventStreamEntry[]> {
    try {
      let query = supabase.from('event_streams').select('*');

      if (filters.userId) query = query.eq('user_id', filters.userId);
      if (filters.action) query = query.eq('action', filters.action);
      if (filters.entityType) query = query.eq('entity_type', filters.entityType);
      if (filters.entityId) query = query.eq('entity_id', filters.entityId);
      if (filters.traceId) query = query.eq('trace_id', filters.traceId);
      if (filters.startTime) query = query.gte('timestamp', filters.startTime);
      if (filters.endTime) query = query.lte('timestamp', filters.endTime);

      if (filters.limit) query = query.limit(filters.limit);

      query = query.order('timestamp', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to query events:', error);
      return [];
    }
  }

  /**
   * Replay events for a specific trace
   */
  async replayTrace(traceId: string): Promise<EventStreamEntry[]> {
    const events = await this.getEvents({ traceId });
    return events.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Rollback to a specific event state
   */
  async rollbackToEvent(eventId: string): Promise<boolean> {
    try {
      const event = await this.getEvents({ limit: 1000 }).then(events =>
        events.find(e => e.id === eventId)
      );

      if (!event) {
        console.error('Event not found:', eventId);
        return false;
      }

      // Restore the 'before' state
      if (event.before && event.entity_type && event.entity_id) {
        await supabase
          .from(event.entity_type)
          .update(event.before)
          .eq('id', event.entity_id);

        // Log the rollback action
        await this.logEvent(
          event.user_id,
          'rollback',
          event.entity_type,
          event.entity_id,
          event.after,
          event.before,
          { original_event_id: eventId }
        );

        return true;
      }

      return false;
    } catch (error) {
      console.error('Rollback failed:', error);
      return false;
    }
  }

  /**
   * Get event statistics
   */
  async getStats(timeRange: { start: string; end: string }): Promise<{
    totalEvents: number;
    eventsByAction: Record<string, number>;
    eventsByEntityType: Record<string, number>;
    uniqueUsers: number;
  }> {
    const events = await this.getEvents({
      startTime: timeRange.start,
      endTime: timeRange.end,
      limit: 10000,
    });

    const eventsByAction: Record<string, number> = {};
    const eventsByEntityType: Record<string, number> = {};
    const uniqueUsers = new Set<string>();

    events.forEach(event => {
      eventsByAction[event.action] = (eventsByAction[event.action] || 0) + 1;
      eventsByEntityType[event.entity_type] = (eventsByEntityType[event.entity_type] || 0) + 1;
      uniqueUsers.add(event.user_id);
    });

    return {
      totalEvents: events.length,
      eventsByAction,
      eventsByEntityType,
      uniqueUsers: uniqueUsers.size,
    };
  }

  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushEvents();
  }
}

// Singleton instance
export const eventStream = EventStreamEngine.getInstance();

/**
 * React hook for event streaming
 */
export function useEventStream() {
  const logEvent = async (
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    before?: any,
    after?: any,
    metadata?: Record<string, any>
  ) => {
    return eventStream.logEvent(userId, action, entityType, entityId, before, after, metadata);
  };

  const getEvents = (filters: Parameters<EventStreamEngine['getEvents']>[0]) => {
    return eventStream.getEvents(filters);
  };

  const replayTrace = (traceId: string) => {
    return eventStream.replayTrace(traceId);
  };

  const rollbackToEvent = (eventId: string) => {
    return eventStream.rollbackToEvent(eventId);
  };

  const getStats = (timeRange: Parameters<EventStreamEngine['getStats']>[0]) => {
    return eventStream.getStats(timeRange);
  };

  return { logEvent, getEvents, replayTrace, rollbackToEvent, getStats };
}
