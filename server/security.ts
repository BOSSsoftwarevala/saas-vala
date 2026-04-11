import crypto from 'crypto';
import { UltraLogger } from './logger';

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiry: string;
  rateLimitWindow: number;
  rateLimitMax: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  allowedOrigins: string[];
  enableCORS: boolean;
  enableRateLimit: boolean;
  enableInputValidation: boolean;
  enableIPBlocking: boolean;
  passwordMinLength: number;
  passwordRequireSpecialChars: boolean;
}

export interface SecurityEvent {
  type: 'login_attempt' | 'login_success' | 'login_failure' | 'rate_limit_exceeded' | 'ip_blocked' | 'suspicious_activity' | 'security_violation';
  userId?: string;
  ip: string;
  userAgent?: string;
  details: any;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface BlockedIP {
  ip: string;
  reason: string;
  blockedAt: Date;
  expiresAt: Date;
  attempts: number;
}

export class UltraSecurity {
  private static instance: UltraSecurity;
  private config: SecurityConfig;
  private logger: UltraLogger;
  private blockedIPs: Map<string, BlockedIP> = new Map();
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();
  private loginAttempts: Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }> = new Map();
  private securityEvents: SecurityEvent[] = [];
  private cleanupInterval?: NodeJS.Timeout;

  static getInstance(config?: SecurityConfig): UltraSecurity {
    if (!UltraSecurity.instance) {
      UltraSecurity.instance = new UltraSecurity(config);
    }
    return UltraSecurity.instance;
  }

  constructor(config?: SecurityConfig) {
    this.logger = UltraLogger.getInstance();
    this.config = {
      jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      jwtExpiry: process.env.JWT_EXPIRY || '24h',
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 100, // 100 requests per window
      maxLoginAttempts: 5,
      lockoutDuration: 30 * 60 * 1000, // 30 minutes
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://saasvala.com'],
      enableCORS: true,
      enableRateLimit: true,
      enableInputValidation: true,
      enableIPBlocking: true,
      passwordMinLength: 8,
      passwordRequireSpecialChars: true,
      ...config
    };

    this.startCleanupInterval();
  }

  // JWT Token Management
  generateToken(payload: any, expiresIn?: string): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.parseExpiry(expiresIn || this.config.jwtExpiry);

    const tokenPayload = {
      ...payload,
      iat: now,
      exp
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', this.config.jwtSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verifyToken(token: string): any {
    try {
      const [header, payload, signature] = token.split('.');
      
      if (!header || !payload || !signature) {
        throw new Error('Invalid token format');
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.config.jwtSecret)
        .update(`${header}.${payload}`)
        .digest('base64url');

      if (signature !== expectedSignature) {
        throw new Error('Invalid token signature');
      }

      // Decode payload
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
      
      // Check expiration
      if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }

      return decodedPayload;
    } catch (error) {
      this.logger.warn('security', 'Token verification failed', { error: error.message });
      throw new Error('Invalid token');
    }
  }

  private parseExpiry(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 3600; // Default to 1 hour
    }
  }

  // Rate Limiting
  checkRateLimit(identifier: string, maxRequests?: number, windowMs?: number): { allowed: boolean; remaining: number; resetTime: number } {
    if (!this.config.enableRateLimit) {
      return { allowed: true, remaining: Infinity, resetTime: 0 };
    }

    const max = maxRequests || this.config.rateLimitMax;
    const window = windowMs || this.config.rateLimitWindow;
    const now = Date.now();
    const key = identifier;

    const current = this.rateLimitStore.get(key);
    
    if (!current || now > current.resetTime) {
      // New window
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + window
      });
      
      return {
        allowed: true,
        remaining: max - 1,
        resetTime: now + window
      };
    }

    if (current.count >= max) {
      // Rate limit exceeded
      this.logSecurityEvent('rate_limit_exceeded', 'medium', {
        identifier,
        count: current.count,
        max,
        window
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime
      };
    }

    // Increment counter
    current.count++;
    
    return {
      allowed: true,
      remaining: max - current.count,
      resetTime: current.resetTime
    };
  }

  // IP Blocking
  blockIP(ip: string, reason: string, duration: number = 24 * 60 * 60 * 1000): void {
    if (!this.config.enableIPBlocking) return;

    const blockedIP: BlockedIP = {
      ip,
      reason,
      blockedAt: new Date(),
      expiresAt: new Date(Date.now() + duration),
      attempts: 1
    };

    this.blockedIPs.set(ip, blockedIP);
    
    this.logSecurityEvent('ip_blocked', 'high', {
      ip,
      reason,
      duration,
      expiresAt: blockedIP.expiresAt
    });

    this.logger.warn('security', `IP blocked: ${ip} - ${reason}`);
  }

  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    this.logger.info('security', `IP unblocked: ${ip}`);
  }

  isIPBlocked(ip: string): boolean {
    const blocked = this.blockedIPs.get(ip);
    if (!blocked) return false;

    if (new Date() > blocked.expiresAt) {
      this.blockedIPs.delete(ip);
      return false;
    }

    return true;
  }

  getBlockedIPs(): BlockedIP[] {
    return Array.from(this.blockedIPs.values());
  }

  // Login Attempt Tracking
  recordLoginAttempt(identifier: string, success: boolean, ip: string, userAgent?: string): void {
    const now = new Date();
    const attempts = this.loginAttempts.get(identifier) || { count: 0, lastAttempt: now };

    attempts.count++;
    attempts.lastAttempt = now;

    if (success) {
      // Reset on successful login
      this.loginAttempts.delete(identifier);
      this.logSecurityEvent('login_success', 'low', {
        identifier,
        ip,
        userAgent
      });
    } else {
      // Check if should be locked out
      if (attempts.count >= this.config.maxLoginAttempts) {
        attempts.lockedUntil = new Date(now.getTime() + this.config.lockoutDuration);
        
        this.logSecurityEvent('login_failure', 'medium', {
          identifier,
          ip,
          userAgent,
          attempts: attempts.count,
          lockedUntil: attempts.lockedUntil
        });

        // Consider blocking IP if multiple failures from different accounts
        const ipFailures = Array.from(this.loginAttempts.entries())
          .filter(([_, attempt]) => attempt.lastAttempt > new Date(now.getTime() - 60 * 60 * 1000))
          .filter(([_, attempt]) => attempt.count >= 3)
          .length;

        if (ipFailures >= 3) {
          this.blockIP(ip, 'Multiple login failures', this.config.lockoutDuration);
        }
      } else {
        this.logSecurityEvent('login_attempt', 'low', {
          identifier,
          ip,
          userAgent,
          attempts: attempts.count
        });
      }
    }

    this.loginAttempts.set(identifier, attempts);
  }

  isAccountLocked(identifier: string): boolean {
    const attempts = this.loginAttempts.get(identifier);
    if (!attempts || !attempts.lockedUntil) return false;

    if (new Date() > attempts.lockedUntil) {
      this.loginAttempts.delete(identifier);
      return false;
    }

    return true;
  }

  // Input Validation
  validateInput(input: any, type: 'email' | 'password' | 'username' | 'general'): { valid: boolean; errors: string[] } {
    if (!this.config.enableInputValidation) {
      return { valid: true, errors: [] };
    }

    const errors: string[] = [];

    switch (type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input)) {
          errors.push('Invalid email format');
        }
        break;

      case 'password':
        if (typeof input !== 'string') {
          errors.push('Password must be a string');
        } else {
          if (input.length < this.config.passwordMinLength) {
            errors.push(`Password must be at least ${this.config.passwordMinLength} characters`);
          }
          if (this.config.passwordRequireSpecialChars) {
            if (!/(?=.*[a-z])/.test(input)) errors.push('Password must contain lowercase letter');
            if (!/(?=.*[A-Z])/.test(input)) errors.push('Password must contain uppercase letter');
            if (!/(?=.*\d)/.test(input)) errors.push('Password must contain number');
            if (!/(?=.*[@$!%*?&])/.test(input)) errors.push('Password must contain special character');
          }
        }
        break;

      case 'username':
        const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
        if (!usernameRegex.test(input)) {
          errors.push('Username must be 3-20 characters, alphanumeric, underscore, or hyphen only');
        }
        break;

      case 'general':
        if (typeof input === 'string') {
          // Check for XSS attempts
          if (/<script|javascript:|on\w+=/i.test(input)) {
            errors.push('Input contains potentially dangerous content');
          }
          // Check for SQL injection attempts
          if (/('|(\\')|(;)|(\-\-)|(\s+(or|and)\s+.*=)/i.test(input)) {
            errors.push('Input contains potentially dangerous SQL patterns');
          }
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  sanitizeInput(input: any): any {
    if (typeof input !== 'string') return input;

    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Security Event Logging
  private logSecurityEvent(type: SecurityEvent['type'], severity: SecurityEvent['severity'], details: any, ip?: string, userId?: string, userAgent?: string): void {
    const event: SecurityEvent = {
      type,
      ip: ip || 'unknown',
      timestamp: new Date(),
      severity,
      details,
      userId,
      userAgent
    };

    this.securityEvents.push(event);

    // Keep only last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    // Log to main logger
    this.logger.logSecurityEvent(type, severity, details, { ip, userAgent });
  }

  // CORS Headers
  getCORSHeaders(origin?: string): Record<string, string> {
    if (!this.config.enableCORS) {
      return {};
    }

    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true'
    };

    if (origin && this.config.allowedOrigins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
    } else if (this.config.allowedOrigins.includes('*')) {
      headers['Access-Control-Allow-Origin'] = '*';
    }

    return headers;
  }

  // Security Middleware
  createSecurityMiddleware() {
    return (req: any, res: any, next: any) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent');

      // Check if IP is blocked
      if (this.isIPBlocked(ip)) {
        this.logger.warn('security', 'Blocked IP attempted access', { ip, userAgent });
        return res.status(403).json({ error: 'Access denied' });
      }

      // Rate limiting
      const rateLimitResult = this.checkRateLimit(ip);
      if (!rateLimitResult.allowed) {
        res.set({
          'X-RateLimit-Limit': this.config.rateLimitMax.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
        });
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }

      // CORS headers
      const corsHeaders = this.getCORSHeaders(req.get('origin'));
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.set(key, value);
      });

      // Handle OPTIONS requests
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      // Add security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      });

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': this.config.rateLimitMax.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
      });

      next();
    };
  }

  // Cleanup expired entries
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  private cleanup(): void {
    const now = Date.now();

    // Clean up expired rate limits
    for (const [key, value] of this.rateLimitStore.entries()) {
      if (now > value.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }

    // Clean up expired IP blocks
    for (const [ip, blocked] of this.blockedIPs.entries()) {
      if (new Date() > blocked.expiresAt) {
        this.blockedIPs.delete(ip);
      }
    }

    // Clean up expired login attempts
    for (const [identifier, attempts] of this.loginAttempts.entries()) {
      if (attempts.lockedUntil && new Date() > attempts.lockedUntil) {
        this.loginAttempts.delete(identifier);
      }
    }
  }

  // Get security statistics
  getSecurityStats(): {
    blockedIPs: number;
    rateLimitEntries: number;
    loginAttempts: number;
    securityEvents: number;
    recentEvents: SecurityEvent[];
  } {
    return {
      blockedIPs: this.blockedIPs.size,
      rateLimitEntries: this.rateLimitStore.size,
      loginAttempts: this.loginAttempts.size,
      securityEvents: this.securityEvents.length,
      recentEvents: this.securityEvents.slice(-20)
    };
  }

  // Export security data
  exportSecurityData(): {
    blockedIPs: BlockedIP[];
    securityEvents: SecurityEvent[];
    stats: any;
  } {
    return {
      blockedIPs: Array.from(this.blockedIPs.values()),
      securityEvents: this.securityEvents,
      stats: this.getSecurityStats()
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export default UltraSecurity;
