// STEP 50: RATE LIMIT HARD CONTROL - Per user messages/sec limit
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface RateLimitConfig {
  maxMessagesPerMinute: number;
  maxMessagesPerHour: number;
  maxMessagesPerDay: number;
  maxApiCallsPerMinute: number;
  blockDuration: number; // minutes
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  blockedUntil?: number;
  reason?: string;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private userLimits = new Map<string, {
    messages: number[];
    apiCalls: number[];
    blockedUntil: number;
    violations: number;
  }>();

  private config: RateLimitConfig = {
    maxMessagesPerMinute: 30,    // 30 messages per minute
    maxMessagesPerHour: 500,     // 500 messages per hour
    maxMessagesPerDay: 2000,     // 2000 messages per day
    maxApiCallsPerMinute: 100,   // 100 API calls per minute
    blockDuration: 5             // Block for 5 minutes on violation
  };

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  private getUserData(userId: string) {
    if (!this.userLimits.has(userId)) {
      this.userLimits.set(userId, {
        messages: [],
        apiCalls: [],
        blockedUntil: 0,
        violations: 0
      });
    }
    return this.userLimits.get(userId)!;
  }

  private cleanupOldEntries(data: { messages: number[]; apiCalls: number[] }, now: number) {
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Cleanup messages
    data.messages = data.messages.filter(timestamp => timestamp > oneDayAgo);

    // Cleanup API calls
    data.apiCalls = data.apiCalls.filter(timestamp => timestamp > oneMinuteAgo);
  }

  async checkMessageRateLimit(userId: string): Promise<RateLimitResult> {
    const now = Date.now();
    const userData = this.getUserData(userId);

    // Check if user is blocked
    if (userData.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: userData.blockedUntil,
        blockedUntil: userData.blockedUntil,
        reason: 'User temporarily blocked due to rate limit violations'
      };
    }

    // Cleanup old entries
    this.cleanupOldEntries(userData, now);

    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Count messages in different time windows
    const messagesLastMinute = userData.messages.filter(t => t > oneMinuteAgo).length;
    const messagesLastHour = userData.messages.filter(t => t > oneHourAgo).length;
    const messagesLastDay = userData.messages.filter(t > oneDayAgo).length;

    // Check limits
    if (messagesLastMinute >= this.config.maxMessagesPerMinute) {
      return this.handleViolation(userId, 'minute', now, {
        allowed: false,
        remaining: 0,
        resetTime: now + 60 * 1000,
        reason: 'Minute message limit exceeded'
      });
    }

    if (messagesLastHour >= this.config.maxMessagesPerHour) {
      return this.handleViolation(userId, 'hour', now, {
        allowed: false,
        remaining: 0,
        resetTime: now + 60 * 60 * 1000,
        reason: 'Hourly message limit exceeded'
      });
    }

    if (messagesLastDay >= this.config.maxMessagesPerDay) {
      return this.handleViolation(userId, 'day', now, {
        allowed: false,
        remaining: 0,
        resetTime: now + 24 * 60 * 60 * 1000,
        reason: 'Daily message limit exceeded'
      });
    }

    // Allow message and record it
    userData.messages.push(now);
    
    // Calculate remaining messages (minimum of all limits)
    const remainingMinute = Math.max(0, this.config.maxMessagesPerMinute - messagesLastMinute - 1);
    const remainingHour = Math.max(0, this.config.maxMessagesPerHour - messagesLastHour - 1);
    const remainingDay = Math.max(0, this.config.maxMessagesPerDay - messagesLastDay - 1);
    
    return {
      allowed: true,
      remaining: Math.min(remainingMinute, remainingHour, remainingDay),
      resetTime: now + 60 * 1000
    };
  }

  async checkApiRateLimit(userId: string): Promise<RateLimitResult> {
    const now = Date.now();
    const userData = this.getUserData(userId);

    // Check if user is blocked
    if (userData.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: userData.blockedUntil,
        blockedUntil: userData.blockedUntil,
        reason: 'User temporarily blocked due to rate limit violations'
      };
    }

    // Cleanup old entries
    this.cleanupOldEntries(userData, now);

    const oneMinuteAgo = now - 60 * 1000;
    const apiCallsLastMinute = userData.apiCalls.filter(t => t > oneMinuteAgo).length;

    if (apiCallsLastMinute >= this.config.maxApiCallsPerMinute) {
      return this.handleViolation(userId, 'api', now, {
        allowed: false,
        remaining: 0,
        resetTime: now + 60 * 1000,
        reason: 'API rate limit exceeded'
      });
    }

    // Allow API call and record it
    userData.apiCalls.push(now);

    return {
      allowed: true,
      remaining: this.config.maxApiCallsPerMinute - apiCallsLastMinute - 1,
      resetTime: now + 60 * 1000
    };
  }

  private handleViolation(
    userId: string, 
    type: string, 
    now: number, 
    baseResult: RateLimitResult
  ): RateLimitResult {
    const userData = this.getUserData(userId);
    userData.violations++;

    // Log violation for monitoring
    console.warn(`Rate limit violation for user ${userId}: ${type} limit exceeded (violation #${userData.violations})`);

    // STEP 75: ANTI FLOOD GUARD - Auto slow user if spam detected
    if (userData.violations >= 3) {
      // Block user for increasing durations based on violation count
      const blockDuration = this.config.blockDuration * Math.pow(2, userData.violations - 3);
      userData.blockedUntil = now + blockDuration * 60 * 1000;

      // Log to database for monitoring
      supabase
        .from('internal_rate_limit_violations')
        .insert({
          user_id: userId,
          violation_type: type,
          violation_count: userData.violations,
          blocked_until: new Date(userData.blockedUntil).toISOString(),
          created_at: new Date().toISOString()
        });

      return {
        ...baseResult,
        blockedUntil: userData.blockedUntil,
        reason: `User blocked for ${blockDuration} minutes due to repeated violations`
      };
    }

    return baseResult;
  }

  // Middleware for API routes
  async requireRateLimit(req: any, res: any, next: any) {
    try {
      // Extract user ID from validated request (should be set by auth middleware)
      const userId = req.validatedUser;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const result = await this.checkApiRateLimit(userId);
      
      if (!result.allowed) {
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': this.config.maxApiCallsPerMinute.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
          'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString()
        });

        return res.status(429).json({ 
          error: result.reason || 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }

      // Set rate limit headers for successful requests
      res.set({
        'X-RateLimit-Limit': this.config.maxApiCallsPerMinute.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      next();

    } catch (error) {
      console.error('Rate limit middleware error:', error);
      return res.status(500).json({ error: 'Rate limit check failed' });
    }
  }

  // Get user's current rate limit status
  async getUserRateLimitStatus(userId: string) {
    const userData = this.getUserData(userId);
    const now = Date.now();
    
    this.cleanupOldEntries(userData, now);

    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    return {
      messagesLastMinute: userData.messages.filter(t => t > oneMinuteAgo).length,
      messagesLastHour: userData.messages.filter(t > oneHourAgo).length,
      messagesLastDay: userData.messages.filter(t > oneDayAgo).length,
      apiCallsLastMinute: userData.apiCalls.filter(t > oneMinuteAgo).length,
      blockedUntil: userData.blockedUntil,
      violations: userData.violations,
      limits: this.config
    };
  }

  // Reset user's rate limit (admin function)
  resetUserRateLimit(userId: string) {
    this.userLimits.delete(userId);
  }

  // Cleanup old user data periodically
  cleanup() {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    for (const [userId, userData] of this.userLimits.entries()) {
      this.cleanupOldEntries(userData, now);
      
      // Remove users with no recent activity
      if (userData.messages.length === 0 && userData.apiCalls.length === 0 && userData.blockedUntil <= now) {
        this.userLimits.delete(userId);
      }
    }
  }
}

// Export singleton instance
export const rateLimiter = RateLimiter.getInstance();

// Run cleanup periodically
setInterval(() => {
  rateLimiter.cleanup();
}, 10 * 60 * 1000); // Every 10 minutes
