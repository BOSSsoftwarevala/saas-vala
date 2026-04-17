/**
 * Global Event Trace System
 * Logs all route changes, API calls, and DB updates to console and audit_logs table
 */

export enum EventType {
  ROUTE_CHANGE = 'route_change',
  API_CALL = 'api_call',
  DB_UPDATE = 'db_update',
  USER_ACTION = 'user_action',
  SYSTEM_EVENT = 'system_event',
  ERROR = 'error',
}

export interface EventLog {
  id?: string;
  user_id?: string;
  event_type: EventType;
  action: string;
  details?: Record<string, any>;
  timestamp?: string;
  ip_address?: string;
  user_agent?: string;
}

class EventLogger {
  private static instance: EventLogger;
  private logs: EventLog[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory

  private constructor() {}

  static getInstance(): EventLogger {
    if (!EventLogger.instance) {
      EventLogger.instance = new EventLogger();
    }
    return EventLogger.instance;
  }

  /**
   * Log an event to console and store in memory
   * @param event The event to log
   */
  log(event: EventLog): void {
    const logEntry: EventLog = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Add to memory logs
    this.logs.push(logEntry);
    
    // Keep only last maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Log to console with appropriate styling
    this.logToConsole(logEntry);

    // TODO: Send to audit_logs table in Supabase
    // This will be implemented when Supabase client is available
  }

  /**
   * Log to console with styling based on event type
   */
  private logToConsole(event: EventLog): void {
    const styles = {
      [EventType.ROUTE_CHANGE]: 'color: #3b82f6; font-weight: bold;',
      [EventType.API_CALL]: 'color: #10b981; font-weight: bold;',
      [EventType.DB_UPDATE]: 'color: #f59e0b; font-weight: bold;',
      [EventType.USER_ACTION]: 'color: #8b5cf6; font-weight: bold;',
      [EventType.SYSTEM_EVENT]: 'color: #06b6d4; font-weight: bold;',
      [EventType.ERROR]: 'color: #ef4444; font-weight: bold;',
    };

    const style = styles[event.event_type] || 'color: #6b7280;';
    const prefix = `[${event.event_type.toUpperCase()}]`;
    
    console.log(
      `%c${prefix} ${event.action}`,
      style,
      event.details || ''
    );
  }

  /**
   * Log route change
   */
  logRouteChange(from: string, to: string, userId?: string): void {
    this.log({
      user_id: userId,
      event_type: EventType.ROUTE_CHANGE,
      action: 'Route changed',
      details: { from, to },
    });
  }

  /**
   * Log API call
   */
  logApiCall(
    method: string,
    endpoint: string,
    userId?: string,
    statusCode?: number,
    duration?: number
  ): void {
    this.log({
      user_id: userId,
      event_type: EventType.API_CALL,
      action: `API ${method} ${endpoint}`,
      details: {
        method,
        endpoint,
        status_code: statusCode,
        duration_ms: duration,
      },
    });
  }

  /**
   * Log DB update
   */
  logDbUpdate(
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    recordId: string,
    userId?: string,
    details?: Record<string, any>
  ): void {
    this.log({
      user_id: userId,
      event_type: EventType.DB_UPDATE,
      action: `DB ${operation} on ${table}`,
      details: {
        table,
        operation,
        record_id: recordId,
        ...details,
      },
    });
  }

  /**
   * Log user action
   */
  logUserAction(action: string, userId?: string, details?: Record<string, any>): void {
    this.log({
      user_id: userId,
      event_type: EventType.USER_ACTION,
      action,
      details,
    });
  }

  /**
   * Log system event
   */
  logSystemEvent(action: string, details?: Record<string, any>): void {
    this.log({
      event_type: EventType.SYSTEM_EVENT,
      action,
      details,
    });
  }

  /**
   * Log error
   */
  logError(action: string, error: Error, userId?: string): void {
    this.log({
      user_id: userId,
      event_type: EventType.ERROR,
      action,
      details: {
        error_message: error.message,
        error_stack: error.stack,
      },
    });
  }

  /**
   * Get all logs from memory
   */
  getLogs(): EventLog[] {
    return [...this.logs];
  }

  /**
   * Get logs by user ID
   */
  getLogsByUserId(userId: string): EventLog[] {
    return this.logs.filter(log => log.user_id === userId);
  }

  /**
   * Get logs by event type
   */
  getLogsByEventType(eventType: EventType): EventLog[] {
    return this.logs.filter(log => log.event_type === eventType);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}

// Export singleton instance
export const eventLogger = EventLogger.getInstance();
