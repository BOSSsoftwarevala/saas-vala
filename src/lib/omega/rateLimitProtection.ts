/**
 * RATE + ABUSE PROTECTION
 * Limit requests/user, block spam clicks, cooldown system
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  cooldownMs: number;
}

export interface UserRateLimit {
  requests: number;
  windowStart: number;
  lastRequest: number;
  blockedUntil: number;
  spamScore: number;
}

export class RateLimitProtection {
  private static instance: RateLimitProtection;
  private userLimits: Map<string, UserRateLimit> = new Map();
  private globalLimits: Map<string, { count: number; windowStart: number }> = new Map();
  private defaultConfig: RateLimitConfig = {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    cooldownMs: 5000, // 5 seconds
  };

  private constructor() {
    this.startCleanupInterval();
  }

  static getInstance(): RateLimitProtection {
    if (!RateLimitProtection.instance) {
      RateLimitProtection.instance = new RateLimitProtection();
    }
    return RateLimitProtection.instance;
  }

  /**
   * Check if user is rate limited
   */
  checkRateLimit(userId: string, action?: string, config?: Partial<RateLimitConfig>): {
    allowed: boolean;
    remaining: number;
    blockedUntil?: number;
    reason?: string;
  } {
    const fullConfig = { ...this.defaultConfig, ...config };
    const now = Date.now();
    const key = action ? `${userId}:${action}` : userId;
    const userLimit = this.userLimits.get(key);

    if (!userLimit) {
      // First request
      this.userLimits.set(key, {
        requests: 1,
        windowStart: now,
        lastRequest: now,
        blockedUntil: 0,
        spamScore: 0,
      });
      return { allowed: true, remaining: fullConfig.maxRequests - 1 };
    }

    // Check if user is in cooldown
    if (userLimit.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        blockedUntil: userLimit.blockedUntil,
        reason: 'Cooldown period active',
      };
    }

    // Reset window if expired
    if (now - userLimit.windowStart > fullConfig.windowMs) {
      userLimit.requests = 0;
      userLimit.windowStart = now;
      userLimit.spamScore = Math.max(0, userLimit.spamScore - 10);
    }

    // Check spam score
    if (userLimit.spamScore > 50) {
      const blockTime = now + fullConfig.cooldownMs * (userLimit.spamScore / 10);
      userLimit.blockedUntil = blockTime;
      this.userLimits.set(key, userLimit);
      return {
        allowed: false,
        remaining: 0,
        blockedUntil: blockTime,
        reason: 'Spam score too high',
      };
    }

    // Check request limit
    if (userLimit.requests >= fullConfig.maxRequests) {
      const blockTime = now + fullConfig.cooldownMs;
      userLimit.blockedUntil = blockTime;
      this.userLimits.set(key, userLimit);
      return {
        allowed: false,
        remaining: 0,
        blockedUntil: blockTime,
        reason: 'Rate limit exceeded',
      };
    }

    // Increment request count
    userLimit.requests++;
    userLimit.lastRequest = now;
    this.userLimits.set(key, userLimit);

    return {
      allowed: true,
      remaining: fullConfig.maxRequests - userLimit.requests,
    };
  }

  /**
   * Record spam behavior
   */
  recordSpam(userId: string, action: string, severity: number = 1): void {
    const key = `${userId}:${action}`;
    const userLimit = this.userLimits.get(key) || {
      requests: 0,
      windowStart: Date.now(),
      lastRequest: 0,
      blockedUntil: 0,
      spamScore: 0,
    };

    userLimit.spamScore += severity * 10;
    this.userLimits.set(key, userLimit);
  }

  /**
   * Check global rate limit
   */
  checkGlobalRateLimit(action: string, config?: Partial<RateLimitConfig>): {
    allowed: boolean;
    remaining: number;
  } {
    const fullConfig = { ...this.defaultConfig, ...config };
    const now = Date.now();
    const globalLimit = this.globalLimits.get(action);

    if (!globalLimit) {
      this.globalLimits.set(action, { count: 1, windowStart: now });
      return { allowed: true, remaining: fullConfig.maxRequests - 1 };
    }

    // Reset window if expired
    if (now - globalLimit.windowStart > fullConfig.windowMs) {
      globalLimit.count = 0;
      globalLimit.windowStart = now;
    }

    // Check limit
    if (globalLimit.count >= fullConfig.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    globalLimit.count++;
    this.globalLimits.set(action, globalLimit);

    return {
      allowed: true,
      remaining: fullConfig.maxRequests - globalLimit.count,
    };
  }

  /**
   * Check for rapid clicks (spam protection)
   */
  checkRapidClicks(userId: string, action: string): {
    allowed: boolean;
    reason?: string;
  } {
    const key = `${userId}:${action}`;
    const userLimit = this.userLimits.get(key);
    const now = Date.now();

    if (!userLimit) {
      return { allowed: true };
    }

    const timeSinceLastRequest = now - userLimit.lastRequest;

    // If clicking faster than 100ms, flag as spam
    if (timeSinceLastRequest < 100) {
      this.recordSpam(userId, action, 2);
      return {
        allowed: false,
        reason: 'Rapid clicking detected',
      };
    }

    // If clicking faster than 500ms, increase spam score
    if (timeSinceLastRequest < 500) {
      this.recordSpam(userId, action, 1);
    }

    return { allowed: true };
  }

  /**
   * Reset user rate limit
   */
  resetUserLimit(userId: string, action?: string): void {
    const key = action ? `${userId}:${action}` : userId;
    this.userLimits.delete(key);
  }

  /**
   * Get user rate limit status
   */
  getUserStatus(userId: string, action?: string): UserRateLimit | null {
    const key = action ? `${userId}:${action}` : userId;
    return this.userLimits.get(key) || null;
  }

  /**
   * Cleanup old entries
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      // Cleanup user limits
      for (const [key, limit] of this.userLimits) {
        if (limit.lastRequest < oneHourAgo) {
          this.userLimits.delete(key);
        }
      }

      // Cleanup global limits
      for (const [action, limit] of this.globalLimits) {
        if (limit.windowStart < oneHourAgo) {
          this.globalLimits.delete(action);
        }
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalUsers: number;
    totalActions: number;
    blockedUsers: number;
    avgSpamScore: number;
  } {
    let totalRequests = 0;
    let blockedUsers = 0;
    let totalSpamScore = 0;

    for (const limit of this.userLimits.values()) {
      totalRequests += limit.requests;
      if (limit.blockedUntil > Date.now()) {
        blockedUsers++;
      }
      totalSpamScore += limit.spamScore;
    }

    return {
      totalUsers: this.userLimits.size,
      totalActions: totalRequests,
      blockedUsers,
      avgSpamScore: this.userLimits.size > 0 ? totalSpamScore / this.userLimits.size : 0,
    };
  }
}

// Singleton instance
export const rateLimitProtection = RateLimitProtection.getInstance();

/**
 * React hook for rate limit protection
 */
export function useRateLimitProtection() {
  const checkRateLimit = (
    userId: string,
    action?: string,
    config?: Partial<RateLimitConfig>
  ) => {
    return rateLimitProtection.checkRateLimit(userId, action, config);
  };

  const checkGlobalRateLimit = (action: string, config?: Partial<RateLimitConfig>) => {
    return rateLimitProtection.checkGlobalRateLimit(action, config);
  };

  const checkRapidClicks = (userId: string, action: string) => {
    return rateLimitProtection.checkRapidClicks(userId, action);
  };

  const recordSpam = (userId: string, action: string, severity?: number) => {
    rateLimitProtection.recordSpam(userId, action, severity);
  };

  const resetUserLimit = (userId: string, action?: string) => {
    rateLimitProtection.resetUserLimit(userId, action);
  };

  const getUserStatus = (userId: string, action?: string) => {
    return rateLimitProtection.getUserStatus(userId, action);
  };

  const getStats = () => {
    return rateLimitProtection.getStats();
  };

  return {
    checkRateLimit,
    checkGlobalRateLimit,
    checkRapidClicks,
    recordSpam,
    resetUserLimit,
    getUserStatus,
    getStats,
  };
}
