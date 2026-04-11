export interface TimezoneConfig {
  defaultTimezone: string;
  enableUserTimezone: boolean;
  storeInUTC: boolean;
  displayInLocal: boolean;
  dateFormat: string;
  timeFormat: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  timestamp: Date; // Always UTC
  timezone: string; // User's timezone at time of action
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class TimezoneManager {
  private static instance: TimezoneManager;
  private config: TimezoneConfig;
  private userTimezones: Map<string, string> = new Map();

  static getInstance(config?: TimezoneConfig): TimezoneManager {
    if (!TimezoneManager.instance) {
      TimezoneManager.instance = new TimezoneManager(config);
    }
    return TimezoneManager.instance;
  }

  constructor(config: TimezoneConfig = {
    defaultTimezone: 'UTC',
    enableUserTimezone: true,
    storeInUTC: true,
    displayInLocal: true,
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm:ss',
  }) {
    this.config = config;
  }

  // Convert any date to UTC for storage
  toUTC(date: Date | string): Date {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  }

  // Convert UTC date to user's local timezone
  toLocal(date: Date | string, timezone?: string): Date {
    if (typeof date === 'string') {
      date = new Date(date);
    }

    const targetTimezone = timezone || this.config.defaultTimezone;
    return this.convertTimezone(date, 'UTC', targetTimezone);
  }

  // Get current time in UTC
  nowUTC(): Date {
    return new Date();
  }

  // Get current time in specific timezone
  nowInTimezone(timezone?: string): Date {
    return this.toLocal(this.nowUTC(), timezone);
  }

  // Format date for display
  formatDate(date: Date | string, timezone?: string, format?: string): string {
    const localDate = this.toLocal(date, timezone);
    const dateFormat = format || `${this.config.dateFormat} ${this.config.timeFormat}`;
    
    return this.formatDateWithPattern(localDate, dateFormat);
  }

  // Format date for storage (always UTC)
  formatDateForStorage(date: Date | string): string {
    const utcDate = this.toUTC(date);
    return utcDate.toISOString();
  }

  // Parse date string from storage (UTC) to Date object
  parseDateFromStorage(dateString: string): Date {
    return new Date(dateString);
  }

  // Set user's preferred timezone
  setUserTimezone(userId: string, timezone: string): void {
    this.userTimezones.set(userId, timezone);
    this.saveUserTimezoneToDB(userId, timezone);
  }

  // Get user's preferred timezone
  getUserTimezone(userId: string): string {
    const cached = this.userTimezones.get(userId);
    if (cached) return cached;

    const timezone = this.fetchUserTimezoneFromDB(userId);
    if (timezone) {
      this.userTimezones.set(userId, timezone);
    }
    return timezone || this.config.defaultTimezone;
  }

  // Create audit log entry with proper timezone handling
  async createAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp' | 'timezone'>): Promise<AuditLog> {
    const auditLog: AuditLog = {
      ...entry,
      id: this.generateAuditId(),
      timestamp: this.nowUTC(), // Always store in UTC
      timezone: this.getUserTimezone(entry.userId),
    };

    await this.saveAuditLogToDB(auditLog);
    return auditLog;
  }

  // Get audit logs with timezone conversion
  async getAuditLogs(
    userId?: string,
    timezone?: string,
    limit?: number
  ): Promise<AuditLog[]> {
    const logs = await this.fetchAuditLogsFromDB(userId, limit);
    
    // Convert timestamps to requested timezone for display
    const targetTimezone = timezone || this.config.defaultTimezone;
    return logs.map(log => ({
      ...log,
      // Keep original UTC timestamp but add local timestamp for display
      localTimestamp: this.toLocal(log.timestamp, targetTimezone),
    }));
  }

  // Convert between timezones
  private convertTimezone(date: Date, fromTimezone: string, toTimezone: string): Date {
    // This is a simplified implementation
    // In a real application, you'd use a library like moment-timezone or date-fns-tz
    
    if (fromTimezone === toTimezone) {
      return new Date(date);
    }

    // For now, just return the date as is (UTC)
    // In production, implement proper timezone conversion
    return new Date(date);
  }

  // Format date with pattern
  private formatDateWithPattern(date: Date, pattern: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return pattern
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  // Validate timezone string
  isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  // Get list of available timezones
  getAvailableTimezones(): string[] {
    return Intl.supportedValuesOf('timeZone');
  }

  // Get timezone offset for a specific timezone
  getTimezoneOffset(timezone: string, date?: Date): number {
    const targetDate = date || new Date();
    const utcDate = new Date(targetDate.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(targetDate.toLocaleString('en-US', { timeZone: timezone }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
  }

  // Check if date is in business hours for a timezone
  isBusinessHours(date: Date, timezone?: string): boolean {
    const localDate = this.toLocal(date, timezone);
    const hours = localDate.getHours();
    const day = localDate.getDay();
    
    // Business hours: 9 AM - 6 PM, Monday - Friday
    return hours >= 9 && hours < 18 && day >= 1 && day <= 5;
  }

  // Get start and end of day in specific timezone
  getDayRange(date: Date, timezone?: string): { start: Date; end: Date } {
    const localDate = this.toLocal(date, timezone);
    
    const start = new Date(localDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(localDate);
    end.setHours(23, 59, 59, 999);
    
    return {
      start: this.toUTC(start),
      end: this.toUTC(end),
    };
  }

  // Get start and end of week in specific timezone
  getWeekRange(date: Date, timezone?: string): { start: Date; end: Date } {
    const localDate = this.toLocal(date, timezone);
    const day = localDate.getDay();
    const diff = localDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    
    const start = new Date(localDate);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return {
      start: this.toUTC(start),
      end: this.toUTC(end),
    };
  }

  // Get start and end of month in specific timezone
  getMonthRange(date: Date, timezone?: string): { start: Date; end: Date } {
    const localDate = this.toLocal(date, timezone);
    
    const start = new Date(localDate.getFullYear(), localDate.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(localDate.getFullYear(), localDate.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    
    return {
      start: this.toUTC(start),
      end: this.toUTC(end),
    };
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveUserTimezoneToDB(userId: string, timezone: string): Promise<void> {
    // Implement database save logic
  }

  private fetchUserTimezoneFromDB(userId: string): string | null {
    // Implement database fetch logic
    return null;
  }

  private async saveAuditLogToDB(auditLog: AuditLog): Promise<void> {
    // Implement database save logic
  }

  private async fetchAuditLogsFromDB(userId?: string, limit?: number): Promise<AuditLog[]> {
    // Implement database fetch logic
    return [];
  }

  clearCache(): void {
    this.userTimezones.clear();
  }
}

// Utility functions for common timezone operations
export const tz = TimezoneManager.getInstance();

// Decorator for automatic timezone handling on API endpoints
export function withTimezone(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const userId = args[0]?.userId || args[1]?.userId;
    if (userId) {
      const userTimezone = tz.getUserTimezone(userId);
      // Add timezone to request context
      args[0] = { ...args[0], timezone: userTimezone };
    }

    return originalMethod.apply(this, args);
  };

  return descriptor;
}

// Middleware for Express.js (if using)
export function timezoneMiddleware(req: any, res: any, next: any) {
  const userId = req.user?.id;
  if (userId) {
    req.timezone = tz.getUserTimezone(userId);
  } else {
    req.timezone = tz['config'].defaultTimezone;
  }
  next();
}

// Helper for consistent date responses
export function createDateResponse(date: Date | string, timezone?: string) {
  return {
    utc: tz.toUTC(date),
    local: tz.toLocal(date, timezone),
    formatted: tz.formatDate(date, timezone),
    iso: tz.formatDateForStorage(date),
  };
}
