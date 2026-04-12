import { Request, Response, NextFunction } from 'express';
import { UltraDatabase } from '../database';
import { UltraLogger } from '../logger';
import crypto from 'crypto';

export interface BruteForceConfig {
  maxAttempts: number;
  windowMs: number;
  lockoutDuration: number;
  resetOnSuccess: boolean;
}

export interface BruteForceEntry {
  identifier: string;
  attempts: number;
  windowStart: Date;
  locked: boolean;
  lockedUntil?: Date;
  lastAttempt: Date;
}

export class BruteForceProtection {
  private store = new Map<string, BruteForceEntry>();
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

  // Login brute force protection
  loginProtection = this.createBruteForceProtection({
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
    resetOnSuccess: true
  });

  // Password reset brute force protection
  passwordResetProtection = this.createBruteForceProtection({
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    lockoutDuration: 60 * 60 * 1000, // 1 hour
    resetOnSuccess: true
  });

  // 2FA brute force protection
  twoFactorProtection = this.createBruteForceProtection({
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutDuration: 60 * 60 * 1000, // 1 hour
    resetOnSuccess: true
  });

  // API key brute force protection
  apiKeyProtection = this.createBruteForceProtection({
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutDuration: 60 * 60 * 1000, // 1 hour
    resetOnSuccess: false
  });

  // Create custom brute force protection
  createBruteForceProtection(config: BruteForceConfig) {
    return {
      // Check if identifier is locked
      isLocked: async (identifier: string): Promise<boolean> => {
        const entry = this.getOrCreateEntry(identifier);
        const now = new Date();

        // Reset if window expired
        if (this.isWindowExpired(entry, now, config.windowMs)) {
          entry.attempts = 0;
          entry.windowStart = now;
          entry.locked = false;
          entry.lockedUntil = undefined;
        }

        // Check if locked
        if (entry.locked && entry.lockedUntil && entry.lockedUntil > now) {
          return true;
        }

        return false;
      },

      // Record failed attempt
      recordFailure: async (identifier: string, req?: Request): Promise<{
        locked: boolean;
        attempts: number;
        remainingAttempts: number;
        lockoutDuration?: number;
      }> => {
        const entry = this.getOrCreateEntry(identifier);
        const now = new Date();

        // Reset if window expired
        if (this.isWindowExpired(entry, now, config.windowMs)) {
          entry.attempts = 0;
          entry.windowStart = now;
          entry.locked = false;
          entry.lockedUntil = undefined;
        }

        // Increment attempts
        entry.attempts++;
        entry.lastAttempt = now;

        // Check if should lock
        if (entry.attempts >= config.maxAttempts) {
          entry.locked = true;
          entry.lockedUntil = new Date(now.getTime() + config.lockoutDuration);

          this.logger.warn('Brute force protection triggered - account locked', {
            identifier,
            attempts: entry.attempts,
            maxAttempts: config.maxAttempts,
            lockoutDuration: config.lockoutDuration,
            ip: req?.ip,
            userAgent: req?.get('User-Agent')
          });

          // Log to database
          await this.logBruteForceEvent(identifier, 'ACCOUNT_LOCKED', {
            attempts: entry.attempts,
            maxAttempts: config.maxAttempts,
            lockoutDuration: config.lockoutDuration,
            ip: req?.ip,
            userAgent: req?.get('User-Agent')
          });
        }

        const remainingAttempts = Math.max(0, config.maxAttempts - entry.attempts);
        const locked = entry.locked && entry.lockedUntil && entry.lockedUntil > now;

        return {
          locked,
          attempts: entry.attempts,
          remainingAttempts,
          lockoutDuration: locked ? (entry.lockedUntil!.getTime() - now.getTime()) : undefined
        };
      },

      // Record successful attempt (resets counter if configured)
      recordSuccess: async (identifier: string): Promise<void> => {
        if (!config.resetOnSuccess) {
          return;
        }

        const entry = this.getOrCreateEntry(identifier);
        
        // Reset on successful attempt
        entry.attempts = 0;
        entry.windowStart = new Date();
        entry.locked = false;
        entry.lockedUntil = undefined;

        this.logger.info('Brute force protection reset on success', {
          identifier
        });
      },

      // Get current status
      getStatus: (identifier: string): {
        attempts: number;
        remainingAttempts: number;
        locked: boolean;
        lockedUntil?: Date;
        nextReset?: Date;
      } => {
        const entry = this.getOrCreateEntry(identifier);
        const now = new Date();

        // Reset if window expired
        if (this.isWindowExpired(entry, now, config.windowMs)) {
          entry.attempts = 0;
          entry.windowStart = now;
          entry.locked = false;
          entry.lockedUntil = undefined;
        }

        const remainingAttempts = Math.max(0, config.maxAttempts - entry.attempts);
        const locked = entry.locked && entry.lockedUntil && entry.lockedUntil > now;
        const nextReset = new Date(entry.windowStart.getTime() + config.windowMs);

        return {
          attempts: entry.attempts,
          remainingAttempts,
          locked,
          lockedUntil: entry.lockedUntil,
          nextReset
        };
      }
    };
  }

  // Middleware for login brute force protection
  loginBruteForceMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const email = req.body?.email || req.body?.username;
    
    if (!email) {
      return next();
    }

    const isLocked = await this.loginProtection.isLocked(email);
    
    if (isLocked) {
      const status = this.loginProtection.getStatus(email);
      const remainingTime = Math.ceil((status.lockedUntil!.getTime() - Date.now()) / 1000);
      
      return res.status(423).json({
        error: 'Account temporarily locked due to too many failed attempts',
        code: 'ACCOUNT_LOCKED',
        retryAfter: remainingTime,
        message: `Account locked. Try again in ${remainingTime} seconds.`
      });
    }

    next();
  };

  // Middleware to record failed login attempts
  recordFailedLogin = async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const email = req.body?.email || req.body?.username;
    
    res.send = function(data: any) {
      // Record failure if response indicates failed authentication
      if (res.statusCode >= 400 && email) {
        (async () => {
          await this.loginProtection.recordFailure(email, req);
        })();
      }
      
      return originalSend.call(this, data);
    };

    next();
  };

  // Middleware to record successful login
  recordSuccessfulLogin = async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const email = req.body?.email || req.body?.username;
    
    res.send = function(data: any) {
      // Record success if response indicates successful authentication
      if (res.statusCode < 300 && email) {
        (async () => {
          await this.loginProtection.recordSuccess(email);
        })();
      }
      
      return originalSend.call(this, data);
    };

    next();
  };

  // Get or create brute force entry
  private getOrCreateEntry(identifier: string): BruteForceEntry {
    const key = `brute_force:${this.hashIdentifier(identifier)}`;
    
    let entry = this.store.get(key);
    if (!entry) {
      entry = {
        identifier,
        attempts: 0,
        windowStart: new Date(),
        locked: false,
        lastAttempt: new Date()
      };
      this.store.set(key, entry);
    }
    
    return entry;
  }

  // Hash identifier for privacy
  private hashIdentifier(identifier: string): string {
    return crypto.createHash('sha256').update(identifier).digest('hex');
  }

  // Check if window has expired
  private isWindowExpired(entry: BruteForceEntry, now: Date, windowMs: number): boolean {
    return now.getTime() - entry.windowStart.getTime() > windowMs;
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      const windowExpired = this.isWindowExpired(entry, now, 15 * 60 * 1000);
      const lockExpired = !entry.lockedUntil || entry.lockedUntil < now;
      
      if (windowExpired && lockExpired) {
        this.store.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Brute force protection cleanup', { 
        cleanedCount, 
        totalEntries: this.store.size 
      });
    }
  }

  // Log brute force events to database
  private async logBruteForceEvent(
    identifier: string, 
    eventType: string, 
    details: any
  ): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO security_logs (
          id, event_type, identifier, ip_address, user_agent,
          details, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        crypto.randomUUID(),
        eventType,
        this.hashIdentifier(identifier),
        details.ip,
        details.userAgent,
        JSON.stringify(details)
      ]);
    } catch (error: any) {
      this.logger.error('Failed to log brute force event', { 
        error: error.message,
        eventType
      });
    }
  }

  // Get brute force statistics
  getStatistics(): {
    totalEntries: number;
    lockedEntries: number;
    topIdentifiers: Array<{ identifier: string; attempts: number }>;
  } {
    const now = new Date();
    let lockedCount = 0;
    const identifierCounts = new Map<string, number>();

    for (const entry of this.store.values()) {
      if (entry.locked && entry.lockedUntil && entry.lockedUntil > now) {
        lockedCount++;
      }

      identifierCounts.set(entry.identifier, (identifierCounts.get(entry.identifier) || 0) + entry.attempts);
    }

    // Sort identifiers by attempt count
    const topIdentifiers = Array.from(identifierCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([identifier, attempts]) => ({ identifier, attempts }));

    return {
      totalEntries: this.store.size,
      lockedEntries: lockedCount,
      topIdentifiers
    };
  }

  // Manually lock an identifier
  lockIdentifier(identifier: string, duration: number = 60 * 60 * 1000): void {
    const entry = this.getOrCreateEntry(identifier);
    const now = new Date();
    
    entry.locked = true;
    entry.lockedUntil = new Date(now.getTime() + duration);

    this.logger.warn('Identifier manually locked', { 
      identifier, 
      duration 
    });
  }

  // Manually unlock an identifier
  unlockIdentifier(identifier: string): void {
    const entry = this.getOrCreateEntry(identifier);
    
    entry.locked = false;
    entry.lockedUntil = undefined;
    entry.attempts = 0;
    entry.windowStart = new Date();

    this.logger.info('Identifier manually unlocked', { identifier });
  }

  // Reset all brute force data
  resetAll(): void {
    this.store.clear();
    this.logger.info('All brute force data reset');
  }

  // Cleanup on shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

export default BruteForceProtection;
