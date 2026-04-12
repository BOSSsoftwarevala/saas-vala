// STEP 53: TIMEZONE HANDLING - Store UTC, display local time
export interface TimezoneInfo {
  timezone: string;
  offset: number;
  isDST: boolean;
}

export class TimezoneHandler {
  private static instance: TimezoneHandler;
  private userTimezone: string = 'UTC';
  private userOffset: number = 0;

  static getInstance(): TimezoneHandler {
    if (!TimezoneHandler.instance) {
      TimezoneHandler.instance = new TimezoneHandler();
    }
    return TimezoneHandler.instance;
  }

  constructor() {
    this.detectUserTimezone();
  }

  private detectUserTimezone() {
    try {
      // Get user's timezone from browser
      this.userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Calculate offset in minutes
      const now = new Date();
      this.userOffset = now.getTimezoneOffset();
      
      // Store in localStorage for persistence
      localStorage.setItem('user_timezone', this.userTimezone);
      localStorage.setItem('user_offset', this.userOffset.toString());
    } catch (error) {
      console.error('Failed to detect timezone:', error);
      this.setDefaultTimezone();
    }
  }

  private setDefaultTimezone() {
    this.userTimezone = localStorage.getItem('user_timezone') || 'UTC';
    this.userOffset = parseInt(localStorage.getItem('user_offset') || '0');
  }

  // Store timestamp in UTC (always store UTC in database)
  toUTC(date: Date = new Date()): string {
    return date.toISOString();
  }

  // Convert UTC timestamp to user's local time
  toLocalTime(utcString: string): Date {
    try {
      const utcDate = new Date(utcString);
      return new Date(utcDate.getTime() - (this.userOffset * 60 * 1000));
    } catch (error) {
      console.error('Failed to convert to local time:', error);
      return new Date(utcString);
    }
  }

  // Format time for display in user's timezone
  formatTime(utcString: string, options: Intl.DateTimeFormatOptions = {}): string {
    try {
      const date = new Date(utcString);
      return new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: this.userTimezone,
        ...options
      }).format(date);
    } catch (error) {
      console.error('Failed to format time:', error);
      return new Date(utcString).toLocaleTimeString();
    }
  }

  // Format date for display
  formatDate(utcString: string, options: Intl.DateTimeFormatOptions = {}): string {
    try {
      const date = new Date(utcString);
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        timeZone: this.userTimezone,
        ...options
      }).format(date);
    } catch (error) {
      console.error('Failed to format date:', error);
      return new Date(utcString).toLocaleDateString();
    }
  }

  // Format relative time (e.g., "2 hours ago", "Yesterday")
  formatRelativeTime(utcString: string): string {
    try {
      const date = new Date(utcString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return this.formatDate(utcString);
    } catch (error) {
      console.error('Failed to format relative time:', error);
      return new Date(utcString).toLocaleDateString();
    }
  }

  // Format full date and time
  formatDateTime(utcString: string): string {
    try {
      const date = new Date(utcString);
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: this.userTimezone
      }).format(date);
    } catch (error) {
      console.error('Failed to format datetime:', error);
      return new Date(utcString).toLocaleString();
    }
  }

  // Check if date is today
  isToday(utcString: string): boolean {
    try {
      const date = this.toLocalTime(utcString);
      const today = new Date();
      return date.toDateString() === today.toDateString();
    } catch {
      return false;
    }
  }

  // Check if date is yesterday
  isYesterday(utcString: string): boolean {
    try {
      const date = this.toLocalTime(utcString);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return date.toDateString() === yesterday.toDateString();
    } catch {
      return false;
    }
  }

  // Get timezone info
  getTimezoneInfo(): TimezoneInfo {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat(undefined, {
        timeZone: this.userTimezone,
        timeZoneName: 'short'
      });
      
      const parts = formatter.formatToParts(now);
      const timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value || '';
      
      return {
        timezone: this.userTimezone,
        offset: this.userOffset,
        isDST: timeZoneName.includes('DT') || timeZoneName.includes('Daylight')
      };
    } catch (error) {
      return {
        timezone: this.userTimezone,
        offset: this.userOffset,
        isDST: false
      };
    }
  }

  // Convert timestamp for different users (useful for admin views)
  convertForTimezone(utcString: string, targetTimezone: string): string {
    try {
      const date = new Date(utcString);
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: targetTimezone
      }).format(date);
    } catch (error) {
      console.error('Failed to convert timezone:', error);
      return this.formatDateTime(utcString);
    }
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

  // Set user timezone manually (for user preferences)
  setUserTimezone(timezone: string) {
    if (this.isValidTimezone(timezone)) {
      this.userTimezone = timezone;
      localStorage.setItem('user_timezone', timezone);
      this.detectUserTimezone(); // Re-detect offset
    }
  }

  // Get all available timezones
  getAvailableTimezones(): string[] {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch (error) {
      // Fallback for older browsers
      return [
        'UTC',
        'America/New_York',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Paris',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Australia/Sydney'
      ];
    }
  }
}

export const timezoneHandler = TimezoneHandler.getInstance();
