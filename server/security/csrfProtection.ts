import { Request, Response, NextFunction } from 'express';
import { UltraDatabase } from '../database';
import { UltraLogger } from '../logger';
import crypto from 'crypto';

export interface CSRFToken {
  token: string;
  sessionId: string;
  expiresAt: Date;
  used: boolean;
}

export class CSRFProtection {
  private tokenStore = new Map<string, CSRFToken>();

  constructor(
    private db: UltraDatabase,
    private logger: UltraLogger
  ) {}

  // Generate CSRF token for session
  async generateCSRFToken(sessionId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (60 * 60 * 1000)); // 1 hour

    const csrfToken: CSRFToken = {
      token,
      sessionId,
      expiresAt,
      used: false
    };

    // Store in memory for fast access
    this.tokenStore.set(token, csrfToken);

    // Also store in database for persistence
    await this.db.query(`
      INSERT INTO csrf_tokens (token, session_id, expires_at, created_at, used)
      VALUES ($1, $2, $3, NOW(), false)
      ON CONFLICT (token) DO UPDATE SET
        session_id = EXCLUDED.session_id,
        expires_at = EXCLUDED.expires_at,
        used = EXCLUDED.used
    `, [token, sessionId, expiresAt]);

    this.logger.info('CSRF token generated', { sessionId, tokenLength: token.length });

    return token;
  }

  // Validate CSRF token for state-changing requests
  validateCSRFToken = async (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF validation for safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // Skip for API endpoints that use Bearer tokens
    if (req.headers.authorization?.startsWith('Bearer ')) {
      return next();
    }

    try {
      const csrfToken = this.extractCSRFToken(req);
      
      if (!csrfToken) {
        this.logger.warn('CSRF token missing', {
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        return res.status(403).json({ 
          error: 'CSRF token required',
          code: 'CSRF_MISSING'
        });
      }

      const storedToken = this.tokenStore.get(csrfToken);
      
      if (!storedToken) {
        // Check database in case token was cleared from memory
        const dbResult = await this.db.query(
          'SELECT * FROM csrf_tokens WHERE token = $1 AND used = false AND expires_at > NOW()',
          [csrfToken]
        );

        if (!dbResult.rows[0]) {
          this.logger.warn('CSRF token invalid or expired', {
            method: req.method,
            path: req.path,
            ip: req.ip,
            tokenProvided: true
          });
          return res.status(403).json({ 
            error: 'Invalid CSRF token',
            code: 'CSRF_INVALID'
          });
        }

        // Restore to memory
        this.tokenStore.set(csrfToken, {
          token: csrfToken,
          sessionId: dbResult.rows[0].session_id,
          expiresAt: dbResult.rows[0].expires_at,
          used: dbResult.rows[0].used
        });
      }

      // Check if token is expired
      if (storedToken.expiresAt < new Date()) {
        this.tokenStore.delete(csrfToken);
        return res.status(403).json({ 
          error: 'CSRF token expired',
          code: 'CSRF_EXPIRED'
        });
      }

      // Check if token is already used
      if (storedToken.used) {
        return res.status(403).json({ 
          error: 'CSRF token already used',
          code: 'CSRF_USED'
        });
      }

      // Mark token as used (one-time use)
      storedToken.used = true;
      await this.db.query(
        'UPDATE csrf_tokens SET used = true, used_at = NOW() WHERE token = $1',
        [csrfToken]
      );

      // Remove from memory after use
      this.tokenStore.delete(csrfToken);

      this.logger.info('CSRF token validated and consumed', {
        method: req.method,
        path: req.path,
        sessionId: storedToken.sessionId
      });

      next();

    } catch (error: any) {
      this.logger.error('CSRF validation error', { 
        error: error.message,
        method: req.method,
        path: req.path
      });
      
      return res.status(500).json({ 
        error: 'CSRF validation failed',
        code: 'CSRF_ERROR'
      });
    }
  };

  // Double Submit Cookie pattern
  setCSRFCookie = (req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.sessionId;
    
    if (sessionId) {
      const token = crypto.randomBytes(32).toString('hex');
      
      // Set HTTP-only cookie
      res.cookie('csrf-token', token, {
        httpOnly: false, // Must be readable by JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000 // 1 hour
      });

      // Store token for validation
      this.tokenStore.set(token, {
        token,
        sessionId,
        expiresAt: new Date(Date.now() + (60 * 60 * 1000)),
        used: false
      });
    }

    next();
  };

  // Validate double submit cookie
  validateDoubleSubmitCookie = async (req: Request, res: Response, next: NextFunction) => {
    // Skip for safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // Skip for API endpoints with Bearer tokens
    if (req.headers.authorization?.startsWith('Bearer ')) {
      return next();
    }

    try {
      const headerToken = req.headers['x-csrf-token'] as string;
      const cookieToken = req.cookies?.['csrf-token'];

      if (!headerToken || !cookieToken) {
        return res.status(403).json({ 
          error: 'CSRF tokens required',
          code: 'CSRF_DOUBLE_MISSING'
        });
      }

      if (headerToken !== cookieToken) {
        this.logger.warn('CSRF double submit mismatch', {
          method: req.method,
          path: req.path,
          ip: req.ip
        });
        return res.status(403).json({ 
          error: 'CSRF token mismatch',
          code: 'CSRF_MISMATCH'
        });
      }

      // Validate the token exists and is not expired
      const storedToken = this.tokenStore.get(cookieToken);
      if (!storedToken || storedToken.expiresAt < new Date() || storedToken.used) {
        return res.status(403).json({ 
          error: 'Invalid CSRF token',
          code: 'CSRF_DOUBLE_INVALID'
        });
      }

      // Mark as used
      storedToken.used = true;
      await this.db.query(
        'UPDATE csrf_tokens SET used = true, used_at = NOW() WHERE token = $1',
        [cookieToken]
      );

      // Clear cookie
      res.clearCookie('csrf-token');

      next();

    } catch (error: any) {
      this.logger.error('CSRF double submit validation error', { 
        error: error.message,
        method: req.method,
        path: req.path
      });
      
      return res.status(500).json({ 
        error: 'CSRF validation failed',
        code: 'CSRF_DOUBLE_ERROR'
      });
    }
  };

  // Extract CSRF token from request
  private extractCSRFToken(req: Request): string | null {
    // Check header first
    const headerToken = req.headers['x-csrf-token'] as string;
    if (headerToken) {
      return headerToken;
    }

    // Check request body
    if (req.body && typeof req.body === 'object' && req.body.csrf_token) {
      return req.body.csrf_token;
    }

    // Check query parameter (less secure, but fallback)
    if (req.query.csrf_token && typeof req.query.csrf_token === 'string') {
      return req.query.csrf_token;
    }

    return null;
  }

  // Clean up expired tokens
  async cleanupExpiredTokens(): Promise<number> {
    try {
      // Clean memory store
      const now = new Date();
      let cleanedCount = 0;

      for (const [token, csrfToken] of this.tokenStore.entries()) {
        if (csrfToken.expiresAt < now || csrfToken.used) {
          this.tokenStore.delete(token);
          cleanedCount++;
        }
      }

      // Clean database
      const dbResult = await this.db.query(`
        DELETE FROM csrf_tokens 
        WHERE expires_at < NOW() OR (used = true AND used_at < NOW() - INTERVAL '1 hour')
      `);

      const totalCleaned = cleanedCount + (dbResult.rowCount || 0);

      if (totalCleaned > 0) {
        this.logger.info('Cleaned up expired CSRF tokens', { 
          memoryCleaned: cleanedCount,
          dbCleaned: dbResult.rowCount,
          totalCleaned
        });
      }

      return totalCleaned;

    } catch (error: any) {
      this.logger.error('CSRF token cleanup failed', { error: error.message });
      return 0;
    }
  }

  // Generate CSRF token for API response
  getCSRFTokenForSession(sessionId: string): string | null {
    for (const [token, csrfToken] of this.tokenStore.entries()) {
      if (csrfToken.sessionId === sessionId && !csrfToken.used && csrfToken.expiresAt > new Date()) {
        return token;
      }
    }
    return null;
  }

  // Revoke all CSRF tokens for a session
  async revokeSessionCSRFTokens(sessionId: string): Promise<number> {
    try {
      // Remove from memory
      let removedCount = 0;
      for (const [token, csrfToken] of this.tokenStore.entries()) {
        if (csrfToken.sessionId === sessionId) {
          this.tokenStore.delete(token);
          removedCount++;
        }
      }

      // Mark as used in database
      const dbResult = await this.db.query(
        'UPDATE csrf_tokens SET used = true, used_at = NOW() WHERE session_id = $1 AND used = false',
        [sessionId]
      );

      const totalRevoked = removedCount + (dbResult.rowCount || 0);

      this.logger.info('CSRF tokens revoked for session', {
        sessionId,
        totalRevoked
      });

      return totalRevoked;

    } catch (error: any) {
      this.logger.error('Failed to revoke CSRF tokens', { error: error.message, sessionId });
      return 0;
    }
  }
}

export default CSRFProtection;
