import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLog {
  log_id: string;
  user_id?: string;
  role?: string;
  module: string;
  action: string;
  description: string;
  ip_address?: string;
  device?: string;
  timestamp: string;
  old_value?: any;
  new_value?: any;
  source?: 'ui' | 'api' | 'system' | 'cron';
  request_trace_id?: string;
  session_id?: string;
  severity?: 'info' | 'warning' | 'critical';
  response_time?: number;
  response_status?: number;
  error_stack?: string;
  hash_signature?: string;
}

export interface LogFilter {
  user_id?: string;
  role?: string;
  module?: string;
  date_from?: string;
  date_to?: string;
  severity?: string;
  source?: string;
}

class AuditLogger {
  private static instance: AuditLogger;
  private requestTraceId: string | null = null;

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  // Generate unique request trace ID
  generateRequestTraceId(): string {
    this.requestTraceId = uuidv4();
    return this.requestTraceId;
  }

  // Get current request trace ID
  getRequestTraceId(): string | null {
    return this.requestTraceId;
  }

  // Get client IP address
  private async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // Get device information
  private getDeviceInfo(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Mobile')) return 'mobile';
    if (userAgent.includes('Tablet')) return 'tablet';
    return 'desktop';
  }

  // Get session ID
  private getSessionId(): string {
    return sessionStorage.getItem('session_id') || 'unknown';
  }

  // Create hash signature for log integrity
  private createHashSignature(log: Omit<AuditLog, 'hash_signature'>): string {
    const data = JSON.stringify(log);
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  // Mask sensitive data
  private maskSensitiveData(data: any): any {
    if (!data) return data;
    
    const sensitiveKeys = ['email', 'password', 'key', 'token', 'payment', 'credit_card'];
    const masked = { ...data };
    
    const maskValue = (obj: any, key: string) => {
      if (typeof obj === 'object' && obj[key]) {
        obj[key] = '***MASKED***';
      }
    };

    sensitiveKeys.forEach(key => {
      if (masked[key]) {
        masked[key] = '***MASKED***';
      }
      // Check nested objects
      Object.keys(masked).forEach(objKey => {
        if (typeof masked[objKey] === 'object') {
          maskValue(masked[objKey], key);
        }
      });
    });

    return masked;
  }

  // Main logging function
  async log(data: {
    user_id?: string;
    role?: string;
    module: string;
    action: string;
    description: string;
    old_value?: any;
    new_value?: any;
    source?: 'ui' | 'api' | 'system' | 'cron';
    severity?: 'info' | 'warning' | 'critical';
    response_time?: number;
    response_status?: number;
    error_stack?: string;
  }): Promise<void> {
    try {
      const logEntry: Omit<AuditLog, 'hash_signature'> = {
        log_id: uuidv4(),
        user_id: data.user_id,
        role: data.role,
        module: data.module,
        action: data.action,
        description: data.description,
        ip_address: await this.getClientIP(),
        device: this.getDeviceInfo(),
        timestamp: new Date().toISOString(),
        old_value: this.maskSensitiveData(data.old_value),
        new_value: this.maskSensitiveData(data.new_value),
        source: data.source || 'ui',
        request_trace_id: this.getRequestTraceId() || undefined,
        session_id: this.getSessionId(),
        severity: data.severity || 'info',
        response_time: data.response_time,
        response_status: data.response_status,
        error_stack: data.error_stack,
      };

      // Add hash signature
      const hashSignature = this.createHashSignature(logEntry);
      const finalLog: AuditLog = {
        ...logEntry,
        hash_signature: hashSignature,
      };

      // Save to database
      const { error } = await supabase
        .from('audit_logs')
        .insert([finalLog]);

      if (error) {
        console.error('Failed to save audit log:', error);
        // Fallback: store in localStorage for retry
        const pendingLogs = JSON.parse(localStorage.getItem('pending_audit_logs') || '[]');
        pendingLogs.push(finalLog);
        localStorage.setItem('pending_audit_logs', JSON.stringify(pendingLogs));
      }

      // Trigger notification for critical events
      if (data.severity === 'critical') {
        this.triggerCriticalAlert(finalLog);
      }

    } catch (error) {
      console.error('Audit logging error:', error);
    }
  }

  // Trigger critical alert
  private triggerCriticalAlert(log: AuditLog): void {
    // Send notification to admin
    toast.error(`Critical Alert: ${log.description}`, {
      duration: 10000,
    });
    
    // Could integrate with external notification system here
  }

  // Get logs with filtering
  async getLogs(filter?: LogFilter, page: number = 1, limit: number = 50): Promise<{
    logs: AuditLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false });

      // Apply filters
      if (filter?.user_id) {
        query = query.eq('user_id', filter.user_id);
      }
      if (filter?.role) {
        query = query.eq('role', filter.role);
      }
      if (filter?.module) {
        query = query.eq('module', filter.module);
      }
      if (filter?.severity) {
        query = query.eq('severity', filter.severity);
      }
      if (filter?.source) {
        query = query.eq('source', filter.source);
      }
      if (filter?.date_from) {
        query = query.gte('timestamp', filter.date_from);
      }
      if (filter?.date_to) {
        query = query.lte('timestamp', filter.date_to);
      }

      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        logs: data || [],
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      };

    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return {
        logs: [],
        total: 0,
        page,
        totalPages: 0,
      };
    }
  }

  // Export logs to CSV
  async exportLogs(filter?: LogFilter): Promise<string> {
    try {
      const { logs } = await this.getLogs(filter, 1, 10000); // Get up to 10k logs
      
      const headers = [
        'log_id', 'user_id', 'role', 'module', 'action', 'description',
        'ip_address', 'device', 'timestamp', 'severity', 'source'
      ];
      
      const csvContent = [
        headers.join(','),
        ...logs.map(log => [
          log.log_id,
          log.user_id || '',
          log.role || '',
          log.module,
          log.action,
          `"${log.description.replace(/"/g, '""')}"`, // Escape quotes
          log.ip_address || '',
          log.device || '',
          log.timestamp,
          log.severity || '',
          log.source || ''
        ].join(','))
      ].join('\n');

      return csvContent;

    } catch (error) {
      console.error('Failed to export logs:', error);
      throw error;
    }
  }

  // Retry pending logs
  async retryPendingLogs(): Promise<void> {
    try {
      const pendingLogs = JSON.parse(localStorage.getItem('pending_audit_logs') || '[]');
      
      if (pendingLogs.length === 0) return;

      const { error } = await supabase
        .from('audit_logs')
        .insert(pendingLogs);

      if (!error) {
        localStorage.removeItem('pending_audit_logs');
      }

    } catch (error) {
      console.error('Failed to retry pending logs:', error);
    }
  }

  // Verify log integrity
  verifyLogIntegrity(log: AuditLog): boolean {
    const { hash_signature, ...logData } = log;
    const expectedHash = this.createHashSignature(logData);
    return hash_signature === expectedHash;
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();

// Convenience functions for common actions
export const logUserAction = async (
  userId: string,
  role: string,
  action: string,
  description: string,
  module: string = 'auth'
) => {
  await auditLogger.log({
    user_id: userId,
    role,
    module,
    action,
    description,
  });
};

export const logProductAction = async (
  userId: string,
  role: string,
  action: string,
  description: string,
  productId?: string,
  oldValue?: any,
  newValue?: any
) => {
  await auditLogger.log({
    user_id: userId,
    role,
    module: 'marketplace',
    action,
    description: productId ? `${description} (Product: ${productId})` : description,
    old_value: oldValue,
    new_value: newValue,
  });
};

export const logSystemAction = async (
  action: string,
  description: string,
  severity: 'info' | 'warning' | 'critical' = 'info'
) => {
  await auditLogger.log({
    module: 'system',
    action,
    description,
    source: 'system',
    severity,
  });
};

export const logError = async (
  error: Error,
  context: string,
  userId?: string,
  role?: string
) => {
  await auditLogger.log({
    user_id: userId,
    role,
    module: 'system',
    action: 'error',
    description: `${context}: ${error.message}`,
    severity: 'critical',
    error_stack: error.stack,
  });
};
