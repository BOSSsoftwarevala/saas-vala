// STEP 57: ERROR LOGGING - Log failed sends, translation errors
export interface ErrorLog {
  id: string;
  timestamp: string;
  userId: string;
  deviceId: string;
  type: 'message_send' | 'translation' | 'voice_processing' | 'connection' | 'media_upload' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  stack?: string;
  userAgent: string;
  url: string;
  resolved: boolean;
}

export class ErrorLoggingService {
  private static instance: ErrorLoggingService;
  private logs: ErrorLog[] = [];
  private maxLogs = 1000;
  private isOnline = navigator.onLine;

  static getInstance(): ErrorLoggingService {
    if (!ErrorLoggingService.instance) {
      ErrorLoggingService.instance = new ErrorLoggingService();
    }
    return ErrorLoggingService.instance;
  }

  constructor() {
    this.loadStoredLogs();
    this.setupNetworkListeners();
    this.setupErrorListeners();
  }

  private loadStoredLogs() {
    try {
      const stored = localStorage.getItem('error_logs');
      if (stored) {
        this.logs = JSON.parse(stored);
        // Keep only recent logs
        if (this.logs.length > this.maxLogs) {
          this.logs = this.logs.slice(-this.maxLogs);
        }
      }
    } catch (error) {
      console.error('Failed to load stored error logs:', error);
    }
  }

  private storeLogs() {
    try {
      localStorage.setItem('error_logs', JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to store error logs:', error);
    }
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingLogs();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private setupErrorListeners() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'general',
        severity: 'medium',
        message: event.message,
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        },
        stack: event.error?.stack
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        type: 'general',
        severity: 'high',
        message: 'Unhandled Promise Rejection',
        details: {
          reason: event.reason
        }
      });
    });
  }

  async logError(errorData: {
    type: ErrorLog['type'];
    severity: ErrorLog['severity'];
    message: string;
    details?: any;
    stack?: string;
  }) {
    const errorLog: ErrorLog = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      userId: this.getCurrentUserId(),
      deviceId: this.getCurrentDeviceId(),
      type: errorData.type,
      severity: errorData.severity,
      message: errorData.message,
      details: errorData.details || {},
      stack: errorData.stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      resolved: false
    };

    this.logs.push(errorLog);

    // Keep logs under limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    this.storeLogs();

    // Try to send to server immediately if online
    if (this.isOnline) {
      await this.sendLogToServer(errorLog);
    }

    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${errorData.type.toUpperCase()}] ${errorData.message}`, errorData.details);
    }
  }

  // Specific logging methods
  async logMessageSendError(messageId: string, error: any, context?: any) {
    await this.logError({
      type: 'message_send',
      severity: 'high',
      message: `Failed to send message: ${messageId}`,
      details: {
        messageId,
        error: error.message || error,
        context
      }
    });
  }

  async logTranslationError(text: string, targetLanguage: string, error: any) {
    await this.logError({
      type: 'translation',
      severity: 'medium',
      message: `Translation failed for ${targetLanguage}`,
      details: {
        text: text.substring(0, 100),
        targetLanguage,
        error: error.message || error
      }
    });
  }

  async logVoiceProcessingError(error: any, audioInfo?: any) {
    await this.logError({
      type: 'voice_processing',
      severity: 'medium',
      message: 'Voice processing failed',
      details: {
        error: error.message || error,
        audioInfo
      }
    });
  }

  async logConnectionError(error: any, context?: any) {
    await this.logError({
      type: 'connection',
      severity: 'high',
      message: 'Connection error',
      details: {
        error: error.message || error,
        context,
        isOnline: navigator.onLine
      }
    });
  }

  async logMediaUploadError(fileName: string, error: any, context?: any) {
    await this.logError({
      type: 'media_upload',
      severity: 'medium',
      message: `Media upload failed: ${fileName}`,
      details: {
        fileName,
        error: error.message || error,
        context
      }
    });
  }

  private async sendLogToServer(log: ErrorLog) {
    try {
      const response = await fetch('/api/logs/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(log)
      });

      if (response.ok) {
        log.resolved = true;
        this.updateLogStatus(log.id, true);
      }
    } catch (error) {
      console.error('Failed to send error log to server:', error);
    }
  }

  private async syncPendingLogs() {
    const pendingLogs = this.logs.filter(log => !log.resolved);
    
    for (const log of pendingLogs) {
      await this.sendLogToServer(log);
    }
  }

  private updateLogStatus(logId: string, resolved: boolean) {
    const log = this.logs.find(l => l.id === logId);
    if (log) {
      log.resolved = resolved;
      this.storeLogs();
    }
  }

  private getCurrentUserId(): string {
    // This would integrate with your auth system
    return localStorage.getItem('user_id') || 'anonymous';
  }

  private getCurrentDeviceId(): string {
    return localStorage.getItem('device_id') || 'unknown';
  }

  private getAuthToken(): string {
    return localStorage.getItem('auth_token') || '';
  }

  // Public methods
  getErrorLogs(filters?: {
    type?: ErrorLog['type'];
    severity?: ErrorLog['severity'];
    resolved?: boolean;
    limit?: number;
  }): ErrorLog[] {
    let filteredLogs = [...this.logs];

    if (filters) {
      if (filters.type) {
        filteredLogs = filteredLogs.filter(log => log.type === filters.type);
      }
      if (filters.severity) {
        filteredLogs = filteredLogs.filter(log => log.severity === filters.severity);
      }
      if (filters.resolved !== undefined) {
        filteredLogs = filteredLogs.filter(log => log.resolved === filters.resolved);
      }
      if (filters.limit) {
        filteredLogs = filteredLogs.slice(-filters.limit);
      }
    }

    return filteredLogs.reverse(); // Most recent first
  }

  getErrorStats() {
    const stats = {
      total: this.logs.length,
      resolved: this.logs.filter(log => log.resolved).length,
      pending: this.logs.filter(log => !log.resolved).length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>
    };

    this.logs.forEach(log => {
      stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
      stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
    });

    return stats;
  }

  clearLogs() {
    this.logs = [];
    this.storeLogs();
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Manual error reporting
  async reportError(message: string, details?: any) {
    await this.logError({
      type: 'general',
      severity: 'medium',
      message,
      details
    });
  }

  // Performance monitoring
  logPerformanceMetric(metric: string, value: number, context?: any) {
    const perfLog = {
      timestamp: new Date().toISOString(),
      metric,
      value,
      context,
      userAgent: navigator.userAgent
    };

    // Store performance logs separately
    try {
      const perfLogs = JSON.parse(localStorage.getItem('perf_logs') || '[]');
      perfLogs.push(perfLog);
      
      // Keep only last 500 performance logs
      if (perfLogs.length > 500) {
        perfLogs.splice(0, perfLogs.length - 500);
      }
      
      localStorage.setItem('perf_logs', JSON.stringify(perfLogs));
    } catch (error) {
      console.error('Failed to store performance log:', error);
    }
  }

  getPerformanceLogs() {
    try {
      return JSON.parse(localStorage.getItem('perf_logs') || '[]');
    } catch {
      return [];
    }
  }
}

export const errorLoggingService = ErrorLoggingService.getInstance();
