import { Request, Response, NextFunction } from 'express';
import { UltraDatabase } from '../database';
import { UltraLogger } from '../logger';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: Request) => string; // Custom key generator
  onLimitReached?: (req: Request, res: Response) => void; // Custom handler
}

export interface RateLimitEntry {
  key: string;
  requests: number;
  windowStart: Date;
  blocked: boolean;
  blockedUntil?: Date;
}

export class RateLimiting {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private db: UltraDatabase,
    private logger: UltraLogger
  ) {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  // Default rate limiter
  defaultRateLimit = this.createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  });

  // Strict rate limiter for sensitive endpoints
  strictRateLimit = this.createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 requests per 15 minutes
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  });

  // Authentication rate limiter
  authRateLimit = this.createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 login attempts per 15 minutes
    skipSuccessfulRequests: true, // Don't count successful logins
    skipFailedRequests: false
  });

  // API rate limiter
  apiRateLimit = this.createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  });

  // Create custom rate limiter
  createRateLimiter(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = config.keyGenerator ? config.keyGenerator(req) : this.generateKey(req);
        const now = new Date();

        // Get or create rate limit entry
        let entry = this.store.get(key);
        if (!entry || this.isEntryExpired(entry, now)) {
          entry = {
            key,
            requests: 0,
            windowStart: now,
            blocked: false
          };
          this.store.set(key, entry);
        }

        // Check if currently blocked
        if (entry.blocked && entry.blockedUntil && entry.blockedUntil > now) {
          const remainingTime = Math.ceil((entry.blockedUntil.getTime() - now.getTime()) / 1000);
          
          this.logger.warn('Rate limit exceeded - blocked', {
            key,
            ip: req.ip,
            path: req.path,
            method: req.method,
            blockedUntil: entry.blockedUntil,
            remainingTime
          });

          return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: remainingTime,
            message: `Rate limit exceeded. Try again in ${remainingTime} seconds.`
          });
        }

        // Check if within rate limit
        if (entry.requests >= config.maxRequests) {
          // Block for increasing durations
          const blockDuration = Math.min(
            60 * 60 * 1000, // Max 1 hour
            Math.pow(2, entry.requests - config.maxRequests) * 60 * 1000 // Exponential backoff
          );

          entry.blocked = true;
          entry.blockedUntil = new Date(now.getTime() + blockDuration);

          this.logger.warn('Rate limit exceeded - blocking', {
            key,
            ip: req.ip,
            path: req.path,
            method: req.method,
            requests: entry.requests,
            maxRequests: config.maxRequests,
            blockDuration
          });

          // Log to database
          await this.logRateLimitViolation(req, {
            key,
            requests: entry.requests,
            maxRequests: config.maxRequests,
            blockDuration
          });

          const remainingTime = Math.ceil(blockDuration / 1000);
          return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: remainingTime,
            message: `Rate limit exceeded. Try again in ${remainingTime} seconds.`
          });
        }

        // Increment request counter
        entry.requests++;

        // Add rate limit headers
        const remainingRequests = Math.max(0, config.maxRequests - entry.requests);
        const resetTime = new Date(entry.windowStart.getTime() + config.windowMs);
        const retryAfter = Math.ceil((resetTime.getTime() - now.getTime()) / 1000);

        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': remainingRequests.toString(),
          'X-RateLimit-Reset': Math.ceil(resetTime.getTime() / 1000).toString(),
          'Retry-After': retryAfter.toString()
        });

        // Store updated entry
        this.store.set(key, entry);

        // Continue to next middleware
        next();

      } catch (error: any) {
        this.logger.error('Rate limiting error', { error: error.message });
        next(); // Fail open - don't block requests if rate limiter fails
      }
    };
  }

  // Generate rate limit key
  private generateKey(req: Request): string {
    // Use IP + User ID (if authenticated) + Path as key
    const userId = (req as any).user?.id || 'anonymous';
    return `rate_limit:${req.ip}:${userId}:${req.path}`;
  }

  // Check if entry is expired
  private isEntryExpired(entry: RateLimitEntry, now: Date): boolean {
    return now.getTime() - entry.windowStart.getTime() > 15 * 60 * 1000; // 15 minutes
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (this.isEntryExpired(entry, now) && 
          (!entry.blockedUntil || entry.blockedUntil < now)) {
        this.store.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Rate limit cleanup', { cleanedCount, totalEntries: this.store.size });
    }
  }

  // Log rate limit violation to database
  private async logRateLimitViolation(req: Request, details: {
    key: string;
    requests: number;
    maxRequests: number;
    blockDuration: number;
  }): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO security_logs (
          id, event_type, ip_address, user_agent, path, method,
          details, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        require('crypto').randomUUID(),
        'RATE_LIMIT_VIOLATION',
        req.ip,
        req.get('User-Agent') || '',
        req.path,
        req.method,
        JSON.stringify(details)
      ]);
    } catch (error: any) {
      this.logger.error('Failed to log rate limit violation', { error: error.message });
    }
  }

  // Get current rate limit status
  getRateLimitStatus(req: Request): {
    limit: number;
    remaining: number;
    reset: Date;
    blocked: boolean;
    blockedUntil?: Date;
  } | null {
    const key = this.generateKey(req);
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    return {
      limit: 100, // Default limit
      remaining: Math.max(0, 100 - entry.requests),
      reset: new Date(entry.windowStart.getTime() + 15 * 60 * 1000),
      blocked: entry.blocked,
      blockedUntil: entry.blockedUntil
    };
  }

  // Reset rate limit for a specific key
  resetRateLimit(key: string): void {
    this.store.delete(key);
    this.logger.info('Rate limit reset', { key });
  }

  // Block IP address manually
  blockIP(ip: string, duration: number = 60 * 60 * 1000): void {
    const key = `rate_limit:${ip}:blocked`;
    const now = new Date();
    
    this.store.set(key, {
      key,
      requests: 999999,
      windowStart: now,
      blocked: true,
      blockedUntil: new Date(now.getTime() + duration)
    });

    this.logger.warn('IP manually blocked', { ip, duration });
  }

  // Unblock IP address
  unblockIP(ip: string): void {
    const key = `rate_limit:${ip}:blocked`;
    this.store.delete(key);
    this.logger.info('IP unblocked', { ip });
  }

  // Get all blocked IPs
  getBlockedIPs(): string[] {
    const now = new Date();
    const blockedIPs: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (entry.blocked && 
          entry.blockedUntil && 
          entry.blockedUntil > now &&
          key.includes(':blocked')) {
        const ip = key.split(':')[2];
        blockedIPs.push(ip);
      }
    }

    return blockedIPs;
  }

  // Get rate limit statistics
  getStatistics(): {
    totalEntries: number;
    blockedEntries: number;
    topIPs: Array<{ ip: string; requests: number }>;
  } {
    const now = new Date();
    let blockedCount = 0;
    const ipCounts = new Map<string, number>();

    for (const [key, entry] of this.store.entries()) {
      if (entry.blocked && entry.blockedUntil && entry.blockedUntil > now) {
        blockedCount++;
      }

      const ip = key.split(':')[2];
      if (ip) {
        ipCounts.set(ip, (ipCounts.get(ip) || 0) + entry.requests);
      }
    }

    // Sort IPs by request count
    const topIPs = Array.from(ipCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, requests]) => ({ ip, requests }));

    return {
      totalEntries: this.store.size,
      blockedEntries: blockedCount,
      topIPs
    };
  }

  // Cleanup on shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

export default RateLimiting;
