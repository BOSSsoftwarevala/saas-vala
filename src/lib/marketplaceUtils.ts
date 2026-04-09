/**
 * Marketplace utility functions.
 *
 * Centralises: currency formatting, price rounding, idempotency key
 * generation, input sanitisation, order number generation, image
 * fallbacks, license key normalisation, retry wrapper, and
 * client-side rate-limit tracking.
 */

// ─────────────────────────────────────────────
// Currency
// ─────────────────────────────────────────────

/**
 * Format an amount as a human-readable currency string.
 * Examples:
 *   formatCurrency(5)          → "$5.00"
 *   formatCurrency(12.99, 'EUR') → "€12.99"
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  const safeAmount = isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

/**
 * Round a monetary value to 2 decimal places, avoiding floating-point drift.
 * e.g.  roundPrice(1.005) → 1.01
 */
export function roundPrice(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

// ─────────────────────────────────────────────
// IDs & Keys
// ─────────────────────────────────────────────

/**
 * Generate a UUID v4 idempotency key for a single payment or mutation
 * request, ensuring the operation is safe to retry.
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Generate a human-readable order number.
 * Format: ORD-YYYYMMDD-XXXXXXXX (8 random uppercase alphanumeric chars)
 * Example: ORD-20260410-A3B7E2F1
 */
export function generateOrderNumber(): string {
  const date = new Date();
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const randomPart = Array.from(bytes, (b) => chars[b % chars.length]).join('');

  return `ORD-${datePart}-${randomPart}`;
}

/**
 * Normalise a raw license key string to XXXX-XXXX-XXXX-XXXX format.
 * Strips whitespace, dashes, and uppercases the result.
 * Returns the original string unchanged if it doesn't match exactly 16
 * alphanumeric characters after cleaning.
 */
export function formatLicenseKey(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.replace(/[\s-]/g, '').toUpperCase();
  if (cleaned.length !== 16) return raw.toUpperCase();
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}-${cleaned.slice(12, 16)}`;
}

// ─────────────────────────────────────────────
// Input Validation & Sanitisation
// ─────────────────────────────────────────────

/**
 * Basic email validation (RFC-5321 simplified).
 */
export function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

/**
 * Valid subscription durations in days.
 */
const VALID_DURATIONS = new Set([30, 60, 90, 180, 365]);

export function isValidDuration(days: number): boolean {
  return Number.isInteger(days) && VALID_DURATIONS.has(days);
}

/**
 * Sanitise a user-supplied string:
 *  – Trims surrounding whitespace
 *  – Collapses internal whitespace runs to single spaces
 *  – Removes null bytes and control characters
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  const noNullBytes = input.replace(/\0/g, '');
  const withoutControlChars = Array.from(noNullBytes)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      if (ch === '\t' || ch === '\n' || ch === '\r') return true;
      return code >= 0x20 && code !== 0x7f;
    })
    .join('');

  return withoutControlChars.trim().replace(/\s+/g, ' ');
}

/**
 * Truncate a string to a maximum length, appending "…" if truncated.
 */
export function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  return str.length <= maxLen ? str : `${str.slice(0, maxLen - 1)}…`;
}

// ─────────────────────────────────────────────
// Images
// ─────────────────────────────────────────────

const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  productivity: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&q=80',
  entertainment: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80',
  education: 'https://images.unsplash.com/photo-1513258496099-48168024aec0?w=400&q=80',
  finance: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=400&q=80',
  health: 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=400&q=80',
  social: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&q=80',
  tools: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=400&q=80',
  games: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&q=80',
  default: 'https://images.unsplash.com/photo-1607252650355-f7fd0460ccdb?w=400&q=80',
};

/**
 * Return a deterministic placeholder image URL for a given category when
 * the product has no thumbnail.
 */
export function getFallbackImage(category?: string | null): string {
  if (!category) return CATEGORY_FALLBACK_IMAGES.default;
  const key = category.toLowerCase();
  return CATEGORY_FALLBACK_IMAGES[key] ?? CATEGORY_FALLBACK_IMAGES.default;
}

// ─────────────────────────────────────────────
// Duration label
// ─────────────────────────────────────────────

/**
 * Convert a duration in days to a human-readable label.
 */
export function durationLabel(days: number): string {
  const map: Record<number, string> = {
    30: '1 Month',
    60: '2 Months',
    90: '3 Months',
    180: '6 Months',
    365: '1 Year',
  };
  return map[days] ?? `${days} Days`;
}

// ─────────────────────────────────────────────
// Retry
// ─────────────────────────────────────────────

/**
 * Retry an async function up to `maxAttempts` times with exponential backoff.
 * Only retries on error; if the function succeeds it resolves immediately.
 *
 * @param fn           Async function to try
 * @param maxAttempts  Total attempts (default 3)
 * @param baseDelayMs  Base delay in ms; doubles each attempt (default 500)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
      }
    }
  }
  throw lastErr;
}

// ─────────────────────────────────────────────
// Client-side rate limiter (in-memory, per session)
// ─────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter.
 * Returns `false` (blocked) when the action exceeds `maxAttempts`
 * within `windowMs` milliseconds.
 *
 * Usage:
 *   if (!checkClientRateLimit('payment', 3, 60_000)) {
 *     toast.error('Too many attempts. Please wait a minute.');
 *     return;
 *   }
 */
export function checkClientRateLimit(
  action: string,
  maxAttempts: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(action);

  if (!entry || now - entry.windowStart > windowMs) {
    // New window
    rateLimitStore.set(action, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false;
  }

  entry.count += 1;
  return true;
}

/**
 * Reset the rate-limit counter for an action (e.g. on successful payment).
 */
export function resetClientRateLimit(action: string): void {
  rateLimitStore.delete(action);
}
