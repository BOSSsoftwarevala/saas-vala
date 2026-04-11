import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  service: string;
  message: string;
  metadata?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
}

export interface LogFilter {
  service?: string;
  level?: LogLevel;
  startTime?: Date;
  endTime?: Date;
  userId?: string;
  requestId?: string;
  search?: string;
}

export class UltraLogger {
  private static instance: UltraLogger;
  private logFile: string;
  private errorFile: string;
  private accessFile: string;
  private maxFileSize: number;
  private maxFiles: number;
  private logBuffer: LogEntry[] = [];
  private bufferFlushInterval?: NodeJS.Timeout;

  static getInstance(): UltraLogger {
    if (!UltraLogger.instance) {
      UltraLogger.instance = new UltraLogger();
    }
    return UltraLogger.instance;
  }

  constructor() {
    this.logFile = '/var/log/saasvala/application.log';
    this.errorFile = '/var/log/saasvala/error.log';
    this.accessFile = '/var/log/saasvala/access.log';
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.maxFiles = 10;
    
    this.ensureLogDirectories();
    this.startBufferFlush();
  }

  private ensureLogDirectories(): void {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private startBufferFlush(): void {
    this.bufferFlushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000); // Flush every 5 seconds
  }

  private flushBuffer(): void {
    if (this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    const logLines = entries.map(entry => this.formatLogEntry(entry)).join('\n');
    const errorLines = entries
      .filter(entry => entry.level >= LogLevel.ERROR)
      .map(entry => this.formatLogEntry(entry))
      .join('\n');

    try {
      fs.appendFileSync(this.logFile, logLines + '\n');
      
      if (errorLines) {
        fs.appendFileSync(this.errorFile, errorLines + '\n');
      }
    } catch (error) {
      console.error('Failed to write logs:', error);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level].padEnd(8);
    const service = entry.service.padEnd(12);
    
    let logLine = `${timestamp} [${level}] [${service}] ${entry.message}`;
    
    if (entry.userId) {
      logLine += ` [user:${entry.userId}]`;
    }
    
    if (entry.requestId) {
      logLine += ` [req:${entry.requestId}]`;
    }
    
    if (entry.ip) {
      logLine += ` [ip:${entry.ip}]`;
    }
    
    if (entry.metadata) {
      logLine += ` ${JSON.stringify(entry.metadata)}`;
    }
    
    if (entry.error) {
      logLine += `\nError: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        logLine += `\nStack: ${entry.error.stack}`;
      }
    }
    
    return logLine;
  }

  log(level: LogLevel, service: string, message: string, metadata?: any, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      service,
      message,
      metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    this.logBuffer.push(entry);

    // Critical errors are flushed immediately
    if (level >= LogLevel.CRITICAL) {
      this.flushBuffer();
    }
  }

  debug(service: string, message: string, metadata?: any): void {
    this.log(LogLevel.DEBUG, service, message, metadata);
  }

  info(service: string, message: string, metadata?: any): void {
    this.log(LogLevel.INFO, service, message, metadata);
  }

  warn(service: string, message: string, metadata?: any): void {
    this.log(LogLevel.WARN, service, message, metadata);
  }

  error(service: string, message: string, error?: Error, metadata?: any): void {
    this.log(LogLevel.ERROR, service, message, metadata, error);
  }

  critical(service: string, message: string, error?: Error, metadata?: any): void {
    this.log(LogLevel.CRITICAL, service, message, metadata, error);
  }

  // HTTP request logging
  logRequest(req: any, res: any, duration: number): void {
    const entry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      service: 'http',
      message: `${req.method} ${req.url} ${res.statusCode}`,
      metadata: {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('content-length') || 0,
        userAgent: req.get('user-agent'),
        referer: req.get('referer')
      },
      ip: req.ip,
      userAgent: req.get('user-agent')
    };

    this.logBuffer.push(entry);
  }

  // Database query logging
  logQuery(query: string, duration: number, error?: Error): void {
    const level = error ? LogLevel.ERROR : LogLevel.DEBUG;
    const message = error ? `Query failed: ${query}` : `Query executed: ${query}`;
    
    this.log(level, 'database', message, { query, duration }, error);
  }

  // Security event logging
  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details: any, req?: any): void {
    const level = severity === 'critical' ? LogLevel.CRITICAL : 
                   severity === 'high' ? LogLevel.ERROR : 
                   severity === 'medium' ? LogLevel.WARN : LogLevel.INFO;
    
    this.log(level, 'security', `Security event: ${event}`, { severity, ...details }, undefined);
  }

  // Performance logging
  logPerformance(operation: string, duration: number, metadata?: any): void {
    const level = duration > 5000 ? LogLevel.WARN : LogLevel.DEBUG;
    this.log(level, 'performance', `${operation} completed in ${duration}ms`, { duration, ...metadata });
  }

  // Get logs with filtering
  async getLogs(filter: LogFilter = {}, limit: number = 100): Promise<LogEntry[]> {
    try {
      const logs = await this.readLogFile(this.logFile);
      const filteredLogs = this.filterLogs(logs, filter);
      return filteredLogs.slice(-limit);
    } catch (error) {
      console.error('Failed to read logs:', error);
      return [];
    }
  }

  // Get error logs
  async getErrorLogs(filter: LogFilter = {}, limit: number = 100): Promise<LogEntry[]> {
    try {
      const logs = await this.readLogFile(this.errorFile);
      const filteredLogs = this.filterLogs(logs, filter);
      return filteredLogs.slice(-limit);
    } catch (error) {
      console.error('Failed to read error logs:', error);
      return [];
    }
  }

  // Get system logs from various sources
  async getSystemLogs(): Promise<{ [key: string]: string[] }> {
    const systemLogs: { [key: string]: string[] } = {};

    try {
      // Nginx logs
      const nginxAccess = await this.readLogFile('/var/log/nginx/access.log', true);
      const nginxError = await this.readLogFile('/var/log/nginx/error.log', true);
      systemLogs.nginx_access = nginxAccess.slice(-50);
      systemLogs.nginx_error = nginxError.slice(-50);

      // System logs
      const syslog = await this.readLogFile('/var/log/syslog', true);
      systemLogs.system = syslog.slice(-50);

      // PostgreSQL logs
      const postgresql = await this.readLogFile('/var/log/postgresql/postgresql-*.log', true);
      systemLogs.postgresql = postgresql.slice(-50);

    } catch (error) {
      console.error('Failed to read system logs:', error);
    }

    return systemLogs;
  }

  private async readLogFile(filePath: string, isRaw: boolean = false): Promise<LogEntry[] | string[]> {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      if (isRaw) {
        return lines;
      }

      return lines.map(line => this.parseLogLine(line)).filter(entry => entry !== null) as LogEntry[];
    } catch (error) {
      console.error(`Failed to read log file ${filePath}:`, error);
      return [];
    }
  }

  private parseLogLine(line: string): LogEntry | null {
    try {
      // Parse log line format: TIMESTAMP [LEVEL] [SERVICE] MESSAGE [metadata]
      const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \[(\w+)\] \[(\w+)\] (.+)$/);
      if (!match) return null;

      const [, timestamp, levelStr, service, message] = match;
      
      const level = LogLevel[levelStr as keyof typeof LogLevel] || LogLevel.INFO;
      
      return {
        timestamp: new Date(timestamp),
        level,
        service,
        message
      };
    } catch (error) {
      return null;
    }
  }

  private filterLogs(logs: LogEntry[], filter: LogFilter): LogEntry[] {
    return logs.filter(log => {
      if (filter.service && log.service !== filter.service) return false;
      if (filter.level !== undefined && log.level < filter.level) return false;
      if (filter.startTime && log.timestamp < filter.startTime) return false;
      if (filter.endTime && log.timestamp > filter.endTime) return false;
      if (filter.userId && log.userId !== filter.userId) return false;
      if (filter.requestId && log.requestId !== filter.requestId) return false;
      if (filter.search && !log.message.includes(filter.search)) return false;
      
      return true;
    });
  }

  // Log rotation
  private async rotateLogFile(filePath: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) return;

      const stats = fs.statSync(filePath);
      if (stats.size < this.maxFileSize) return;

      const dir = path.dirname(filePath);
      const ext = path.extname(filePath);
      const base = path.basename(filePath, ext);

      // Remove oldest log file if we have too many
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const oldFile = path.join(dir, `${base}.${i}${ext}`);
        const newFile = path.join(dir, `${base}.${i + 1}${ext}`);
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxFiles - 1) {
            fs.unlinkSync(oldFile);
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Move current log to .1
      const rotatedFile = path.join(dir, `${base}.1${ext}`);
      fs.renameSync(filePath, rotatedFile);

      // Create new log file
      fs.writeFileSync(filePath, '');

    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  // Clean up old logs
  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    try {
      const logs = await this.readLogFile(this.logFile);
      const filteredLogs = logs.filter(log => log.timestamp > cutoffDate);
      
      const logLines = filteredLogs.map(entry => this.formatLogEntry(entry)).join('\n');
      fs.writeFileSync(this.logFile, logLines);

      // Rotate if needed
      await this.rotateLogFile(this.logFile);
      await this.rotateLogFile(this.errorFile);

    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  // Get log statistics
  getLogStats(): {
    totalLogs: number;
    errorLogs: number;
    warningLogs: number;
    topServices: Array<{ service: string; count: number }>;
    recentErrors: LogEntry[];
  } {
    const totalLogs = this.logBuffer.length;
    const errorLogs = this.logBuffer.filter(log => log.level >= LogLevel.ERROR).length;
    const warningLogs = this.logBuffer.filter(log => log.level === LogLevel.WARN).length;

    const serviceCounts = this.logBuffer.reduce((acc, log) => {
      acc[log.service] = (acc[log.service] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topServices = Object.entries(serviceCounts)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recentErrors = this.logBuffer
      .filter(log => log.level >= LogLevel.ERROR)
      .slice(-10);

    return {
      totalLogs,
      errorLogs,
      warningLogs,
      topServices,
      recentErrors
    };
  }

  // Export logs to file
  async exportLogs(filter: LogFilter = {}, format: 'json' | 'csv' = 'json'): Promise<string> {
    const logs = await this.getLogs(filter, 10000);
    
    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    } else {
      const headers = 'timestamp,level,service,message,metadata\n';
      const rows = logs.map(log => 
        `${log.timestamp.toISOString()},${LogLevel[log.level]},${log.service},"${log.message}","${JSON.stringify(log.metadata || {})}"`
      ).join('\n');
      return headers + rows;
    }
  }

  destroy(): void {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
    }
    this.flushBuffer();
  }
}

export default UltraLogger;
