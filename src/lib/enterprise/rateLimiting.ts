export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (identifier: string) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface RateLimitEntry {
  count: number;
  resetTime: Date;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private limits: Map<string, RateLimitConfig> = new Map();
  private requests: Map<string, RateLimitEntry> = new Map();

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  constructor() {
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  defineLimit(name: string, config: RateLimitConfig): void {
    this.limits.set(name, config);
  }

  async checkLimit(
    limitName: string,
    identifier: string,
    customConfig?: RateLimitConfig
  ): Promise<RateLimitResult> {
    const config = customConfig || this.limits.get(limitName);
    if (!config) {
      throw new Error(`Rate limit '${limitName}' not defined`);
    }

    const key = config.keyGenerator 
      ? config.keyGenerator(identifier)
      : `${limitName}:${identifier}`;

    const now = new Date();
    const entry = this.requests.get(key);

    // If no entry exists or window has expired, create new entry
    if (!entry || now > entry.resetTime) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: new Date(now.getTime() + config.windowMs),
      };

      this.requests.set(key, newEntry);
      await this.saveRateLimitToDB(key, newEntry);

      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        resetTime: newEntry.resetTime,
      };
    }

    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime.getTime() - now.getTime()) / 1000);
      
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter,
      };
    }

    // Increment count
    entry.count++;
    await this.saveRateLimitToDB(key, entry);

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  async consumeLimit(
    limitName: string,
    identifier: string,
    amount: number = 1,
    customConfig?: RateLimitConfig
  ): Promise<RateLimitResult> {
    const config = customConfig || this.limits.get(limitName);
    if (!config) {
      throw new Error(`Rate limit '${limitName}' not defined`);
    }

    const key = config.keyGenerator 
      ? config.keyGenerator(identifier)
      : `${limitName}:${identifier}`;

    const now = new Date();
    const entry = this.requests.get(key);

    // If no entry exists or window has expired, create new entry
    if (!entry || now > entry.resetTime) {
      const newEntry: RateLimitEntry = {
        count: amount,
        resetTime: new Date(now.getTime() + config.windowMs),
      };

      this.requests.set(key, newEntry);
      await this.saveRateLimitToDB(key, newEntry);

      return {
        allowed: amount <= config.maxRequests,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - amount),
        resetTime: newEntry.resetTime,
      };
    }

    // Check if limit would be exceeded
    if (entry.count + amount > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime.getTime() - now.getTime()) / 1000);
      
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter,
      };
    }

    // Increment count by amount
    entry.count += amount;
    await this.saveRateLimitToDB(key, entry);

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  async resetLimit(limitName: string, identifier: string): Promise<void> {
    const config = this.limits.get(limitName);
    if (!config) {
      throw new Error(`Rate limit '${limitName}' not defined`);
    }

    const key = config.keyGenerator 
      ? config.keyGenerator(identifier)
      : `${limitName}:${identifier}`;

    this.requests.delete(key);
    await this.deleteRateLimitFromDB(key);
  }

  async getLimitStatus(limitName: string, identifier: string): Promise<RateLimitResult | null> {
    const config = this.limits.get(limitName);
    if (!config) {
      return null;
    }

    const key = config.keyGenerator 
      ? config.keyGenerator(identifier)
      : `${limitName}:${identifier}`;

    const entry = this.requests.get(key);
    if (!entry) {
      return null;
    }

    const now = new Date();
    if (now > entry.resetTime) {
      return null;
    }

    return {
      allowed: entry.count < config.maxRequests,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetTime: entry.resetTime,
    };
  }

  private async cleanup(): Promise<void> {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.requests) {
      if (now > entry.resetTime) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.requests.delete(key);
      await this.deleteRateLimitFromDB(key);
    }
  }

  private async saveRateLimitToDB(key: string, entry: RateLimitEntry): Promise<void> {
    // Implement database save logic (could use Redis for better performance)
  }

  private async deleteRateLimitFromDB(key: string): Promise<void> {
    // Implement database delete logic
  }

  clearCache(): void {
    this.requests.clear();
  }
}

// Default rate limit configurations
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  key_generation: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 keys per minute
  },
  server_deploy: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3, // 3 deployments per minute
  },
  api_requests: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 API requests per minute
  },
  login_attempts: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 login attempts per 15 minutes
  },
  password_reset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 password resets per hour
  },
  webhook_triggers: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 webhook triggers per minute
  },
};

// Initialize default rate limits
export function initializeDefaultRateLimits(): void {
  const rateLimiter = RateLimiter.getInstance();
  
  Object.entries(DEFAULT_RATE_LIMITS).forEach(([name, config]) => {
    rateLimiter.defineLimit(name, config);
  });
}
