/**
 * Timezone Consistency Utility
 * Ensures UTC in DB, local convert in UI
 */

/**
 * Format a UTC timestamp to local timezone string
 */
export function toLocalTime(utcTimestamp: string | Date): string {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;
  return date.toLocaleString();
}

/**
 * Format a UTC timestamp to local date string
 */
export function toLocalDate(utcTimestamp: string | Date): string {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;
  return date.toLocaleDateString();
}

/**
 * Format a UTC timestamp to local time string
 */
export function toLocalTimeOnly(utcTimestamp: string | Date): string {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;
  return date.toLocaleTimeString();
}

/**
 * Convert local date to UTC timestamp
 */
export function toUTC(localDate: Date): Date {
  return new Date(localDate.toISOString());
}

/**
 * Get current UTC timestamp as ISO string
 */
export function getCurrentUTC(): string {
  return new Date().toISOString();
}

/**
 * Format UTC timestamp for display with timezone
 */
export function formatWithTimezone(utcTimestamp: string | Date, format: 'full' | 'date' | 'time' = 'full'): string {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;

  switch (format) {
    case 'date':
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    case 'time':
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    case 'full':
    default:
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
  }
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(utcTimestamp: string | Date): string {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  if (diffWeek < 4) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
  return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
}

/**
 * Check if a UTC timestamp is within the last N days
 */
export function isWithinLastDays(utcTimestamp: string | Date, days: number): boolean {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

/**
 * Get the start of day in UTC for a given local date
 */
export function getStartOfDayUTC(date?: Date): Date {
  const d = date || new Date();
  d.setHours(0, 0, 0, 0);
  return new Date(d.toISOString());
}

/**
 * Get the end of day in UTC for a given local date
 */
export function getEndOfDayUTC(date?: Date): Date {
  const d = date || new Date();
  d.setHours(23, 59, 59, 999);
  return new Date(d.toISOString());
}

/**
 * Parse a UTC timestamp safely
 */
export function safeParseUTC(timestamp: string | null | undefined): Date | null {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/**
 * Validate that a timestamp is in UTC format
 */
export function isValidUTCTimestamp(timestamp: string): boolean {
  const date = safeParseUTC(timestamp);
  return date !== null;
}
