import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UltraDatabase } from '../database';
import { UltraLogger } from '../logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  deviceId?: string;
  sessionId?: string;
}

export class ZeroTrustMiddleware {
  constructor(
    private db: UltraDatabase,
    private logger: UltraLogger,
    private jwtSecret: string
  ) {}

  // Verify every request - ZERO TRUST
  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // 1. Check token exists
      const token = this.extractToken(req);
      if (!token) {
        this.logger.warn('No token provided', { ip: req.ip, userAgent: req.get('User-Agent') });
        return res.status(401).json({ error: 'Authentication required' });
      }

      // 2. Verify JWT signature and expiry
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
        issuer: process.env.JWT_ISSUER || 'saas-vala',
        audience: process.env.JWT_AUDIENCE || 'saas-vala-users'
      }) as any;

      // 3. Check if token is revoked
      const isRevoked = await this.isTokenRevoked(decoded.jti);
      if (isRevoked) {
        this.logger.warn('Revoked token used', { tokenId: decoded.jti, userId: decoded.sub });
        return res.status(401).json({ error: 'Token revoked' });
      }

      // 4. Verify user exists and is active
      const user = await this.db.query(
        'SELECT id, email, role, status FROM users WHERE id = $1',
        [decoded.sub]
      );

      if (!user.rows[0] || user.rows[0].status !== 'active') {
        this.logger.warn('Invalid user in token', { userId: decoded.sub });
        return res.status(401).json({ error: 'Invalid user' });
      }

      // 5. Check device binding if enabled
      if (decoded.deviceId && process.env.ENFORCE_DEVICE_BINDING === 'true') {
        const clientDeviceId = this.getDeviceId(req);
        if (clientDeviceId !== decoded.deviceId) {
          this.logger.warn('Device binding violation', {
            expectedDevice: decoded.deviceId,
            actualDevice: clientDeviceId,
            userId: decoded.sub
          });
          return res.status(401).json({ error: 'Device binding violation' });
        }
      }

      // 6. Check session validity
      const sessionValid = await this.isSessionValid(decoded.sessionId, decoded.sub);
      if (!sessionValid) {
        this.logger.warn('Invalid session', { sessionId: decoded.sessionId, userId: decoded.sub });
        return res.status(401).json({ error: 'Session expired' });
      }

      // 7. Get user permissions
      const permissions = await this.getUserPermissions(decoded.sub);

      // 8. Attach user info to request
      req.user = {
        id: user.rows[0].id,
        email: user.rows[0].email,
        role: user.rows[0].role,
        permissions
      };
      req.deviceId = decoded.deviceId;
      req.sessionId = decoded.sessionId;

      // 9. Log successful authentication
      this.logger.info('Request authenticated', {
        userId: req.user.id,
        role: req.user.role,
        ip: req.ip,
        path: req.path
      });

      next();
    } catch (error: any) {
      this.logger.error('Authentication failed', { error: error.message, ip: req.ip });
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      
      return res.status(500).json({ error: 'Authentication error' });
    }
  };

  // Role-based access control
  requireRole = (roles: string | string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      if (!allowedRoles.includes(req.user.role)) {
        this.logger.warn('Access denied - insufficient role', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: allowedRoles,
          path: req.path
        });
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  };

  // Permission-based access control
  requirePermission = (permission: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!req.user.permissions.includes(permission)) {
        this.logger.warn('Access denied - insufficient permission', {
          userId: req.user.id,
          userPermissions: req.user.permissions,
          requiredPermission: permission,
          path: req.path
        });
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  };

  // Prevent role escalation
  preventRoleEscalation = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user is trying to access/modify higher role data
    const targetUserId = req.params.userId || req.body.userId;
    const targetRole = req.body.role;

    if (targetRole && this.isHigherRole(targetRole, req.user.role)) {
      this.logger.warn('Role escalation attempt blocked', {
        userId: req.user.id,
        userRole: req.user.role,
        targetRole: targetRole,
        targetUserId: targetUserId
      });
      return res.status(403).json({ error: 'Role escalation not allowed' });
    }

    next();
  };

  // Private helper methods
  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return req.cookies?.accessToken || null;
  }

  private async isTokenRevoked(tokenId: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        'SELECT 1 FROM revoked_tokens WHERE token_id = $1',
        [tokenId]
      );
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error('Error checking token revocation', { error, tokenId });
      return true; // Fail safe
    }
  }

  private async isSessionValid(sessionId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        'SELECT 1 FROM user_sessions WHERE id = $1 AND user_id = $2 AND expires_at > NOW()',
        [sessionId, userId]
      );
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error('Error checking session validity', { error, sessionId, userId });
      return false;
    }
  }

  private async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const result = await this.db.query(
        'SELECT permission FROM user_permissions WHERE user_id = $1',
        [userId]
      );
      return result.rows.map(row => row.permission);
    } catch (error) {
      this.logger.error('Error getting user permissions', { error, userId });
      return [];
    }
  }

  private getDeviceId(req: Request): string {
    // Generate device fingerprint from user agent and IP
    const userAgent = req.get('User-Agent') || '';
    const ip = req.ip;
    return require('crypto').createHash('sha256').update(`${userAgent}:${ip}`).digest('hex');
  }

  private isHigherRole(targetRole: string, userRole: string): boolean {
    const roleHierarchy = {
      'super_admin': 5,
      'admin': 4,
      'reseller': 3,
      'user': 2,
      'guest': 1
    };

    const targetLevel = roleHierarchy[targetRole as keyof typeof roleHierarchy] || 0;
    const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;

    return targetLevel > userLevel;
  }
}

export default ZeroTrustMiddleware;
