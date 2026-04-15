// Rate Limiting Service - Prevent API abuse
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimitService {
  private static instance: RateLimitService;
  private limits: Map<string, RateLimitConfig> = new Map();
  private requests: Map<string, RateLimitEntry> = new Map();

  private constructor() {
    // Initialize default limits
    this.limits.set('api', { maxRequests: 100, windowMs: 60000 }); // 100 requests per minute
    this.limits.set('chat', { maxRequests: 30, windowMs: 60000 }); // 30 messages per minute
    this.limits.set('auth', { maxRequests: 5, windowMs: 60000 }); // 5 auth attempts per minute
    this.limits.set('upload', { maxRequests: 10, windowMs: 60000 }); // 10 uploads per minute
    this.limits.set('search', { maxRequests: 50, windowMs: 60000 }); // 50 searches per minute
  }

  static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  setLimit(key: string, config: RateLimitConfig): void {
    this.limits.set(key, config);
  }

  getLimit(key: string): RateLimitConfig {
    return this.limits.get(key) || { maxRequests: 100, windowMs: 60000 };
  }

  checkRateLimit(identifier: string, key: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const limit = this.getLimit(key);
    const now = Date.now();
    const entryKey = `${identifier}:${key}`;

    let entry = this.requests.get(entryKey);

    // Reset if window expired
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + limit.windowMs,
      };
      this.requests.set(entryKey, entry);
    }

    // Check if limit exceeded
    if (entry.count >= limit.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;
    this.requests.set(entryKey, entry);

    return {
      allowed: true,
      remaining: limit.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  reset(identifier: string, key: string): void {
    const entryKey = `${identifier}:${key}`;
    this.requests.delete(entryKey);
  }

  resetAll(): void {
    this.requests.clear();
  }

  cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  getStats(): {
    totalRequests: number;
    activeLimits: number;
    limits: Record<string, RateLimitConfig>;
  } {
    let totalRequests = 0;
    for (const entry of this.requests.values()) {
      totalRequests += entry.count;
    }

    const limits: Record<string, RateLimitConfig> = {};
    this.limits.forEach((config, key) => {
      limits[key] = config;
    });

    return {
      totalRequests,
      activeLimits: this.requests.size,
      limits,
    };
  }
}

export const rateLimitService = RateLimitService.getInstance();

// Convenience function for checking rate limits
export function checkRateLimit(identifier: string, key: string) {
  return rateLimitService.checkRateLimit(identifier, key);
}
