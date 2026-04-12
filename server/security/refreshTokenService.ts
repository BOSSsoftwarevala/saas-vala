import jwt from 'jsonwebtoken';
import { UltraDatabase } from '../database';
import { UltraLogger } from '../logger';
import crypto from 'crypto';

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  deviceId?: string;
  tokenFamily: string;
}

export class RefreshTokenService {
  constructor(
    private db: UltraDatabase,
    private logger: UltraLogger,
    private jwtSecret: string,
    private refreshTokenSecret: string
  ) {}

  // Generate new refresh token with rotation
  async generateRefreshToken(userId: string, sessionId: string, deviceId?: string): Promise<{
    refreshToken: string;
    tokenFamily: string;
    expiresAt: Date;
  }> {
    const tokenFamily = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // 30 days

    const payload: RefreshTokenPayload = {
      userId,
      sessionId,
      deviceId,
      tokenFamily
    };

    const refreshToken = jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: '30d',
      issuer: process.env.JWT_ISSUER || 'saas-vala',
      audience: 'saas-vala-refresh',
      jwtid: crypto.randomUUID()
    });

    // Store refresh token in database
    await this.db.query(`
      INSERT INTO refresh_tokens (id, user_id, session_id, token_family, device_id, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      crypto.randomUUID(),
      userId,
      sessionId,
      tokenFamily,
      deviceId,
      expiresAt
    ]);

    this.logger.info('Refresh token generated', {
      userId,
      sessionId,
      tokenFamily,
      expiresAt
    });

    return {
      refreshToken,
      tokenFamily,
      expiresAt
    };
  }

  // Rotate refresh token - invalidate old, issue new
  async rotateRefreshToken(oldRefreshToken: string): Promise<{
    newRefreshToken: string;
    accessToken: string;
    tokenFamily: string;
  }> {
    try {
      // Verify old refresh token
      const decoded = jwt.verify(oldRefreshToken, this.refreshTokenSecret, {
        algorithms: ['HS256'],
        issuer: process.env.JWT_ISSUER || 'saas-vala',
        audience: 'saas-vala-refresh'
      }) as RefreshTokenPayload & { jti: string };

      // Check if token is already used (replay detection)
      const isUsed = await this.isTokenUsed(decoded.jti);
      if (isUsed) {
        this.logger.warn('Refresh token replay attempt', {
          tokenId: decoded.jti,
          userId: decoded.userId,
          tokenFamily: decoded.tokenFamily
        });
        
        // Invalidate entire token family on replay
        await this.invalidateTokenFamily(decoded.tokenFamily);
        throw new Error('Token replay detected - family invalidated');
      }

      // Mark old token as used
      await this.markTokenAsUsed(decoded.jti);

      // Get user info for new access token
      const userResult = await this.db.query(
        'SELECT id, email, role FROM users WHERE id = $1 AND status = $2',
        [decoded.userId, 'active']
      );

      if (!userResult.rows[0]) {
        throw new Error('User not found or inactive');
      }

      const user = userResult.rows[0];

      // Generate new access token
      const accessToken = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          sessionId: decoded.sessionId,
          deviceId: decoded.deviceId
        },
        this.jwtSecret,
        {
          expiresIn: '15m',
          issuer: process.env.JWT_ISSUER || 'saas-vala',
          audience: 'saas-vala-users',
          jwtid: crypto.randomUUID()
        }
      );

      // Generate new refresh token in same family
      const newRefreshTokenData = await this.generateRefreshToken(
        decoded.userId,
        decoded.sessionId,
        decoded.deviceId
      );

      // Update session with new tokens
      await this.db.query(`
        UPDATE user_sessions 
        SET last_activity = NOW(), refresh_token_id = $1
        WHERE id = $2 AND user_id = $3
      `, [
        newRefreshTokenData.tokenFamily,
        decoded.sessionId,
        decoded.userId
      ]);

      this.logger.info('Refresh token rotated successfully', {
        userId: decoded.userId,
        oldTokenId: decoded.jti,
        newTokenFamily: newRefreshTokenData.tokenFamily
      });

      return {
        newRefreshToken: newRefreshTokenData.refreshToken,
        accessToken,
        tokenFamily: newRefreshTokenData.tokenFamily
      };

    } catch (error: any) {
      this.logger.error('Refresh token rotation failed', { error: error.message });
      throw error;
    }
  }

  // Revoke refresh token (logout)
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const decoded = jwt.decode(refreshToken) as RefreshTokenPayload & { jti: string };
      
      if (!decoded) {
        throw new Error('Invalid refresh token');
      }

      // Mark token as used
      await this.markTokenAsUsed(decoded.jti);

      // Invalidate token family
      await this.invalidateTokenFamily(decoded.tokenFamily);

      this.logger.info('Refresh token revoked', {
        userId: decoded.userId,
        tokenFamily: decoded.tokenFamily
      });

    } catch (error: any) {
      this.logger.error('Refresh token revocation failed', { error: error.message });
      throw error;
    }
  }

  // Revoke all user refresh tokens (force logout all devices)
  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE refresh_tokens 
        SET used_at = NOW(), revoked = true
        WHERE user_id = $1 AND used_at IS NULL
      `, [userId]);

      this.logger.info('All user refresh tokens revoked', { userId });

    } catch (error: any) {
      this.logger.error('Bulk token revocation failed', { error: error.message, userId });
      throw error;
    }
  }

  // Clean up expired tokens
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await this.db.query(`
        DELETE FROM refresh_tokens 
        WHERE expires_at < NOW() OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '7 days')
      `);

      if (result.rowCount > 0) {
        this.logger.info('Cleaned up expired refresh tokens', { 
          deletedCount: result.rowCount 
        });
      }

    } catch (error: any) {
      this.logger.error('Token cleanup failed', { error: error.message });
    }
  }

  // Private helper methods
  private async isTokenUsed(tokenId: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        'SELECT 1 FROM refresh_tokens WHERE id = $1 AND used_at IS NOT NULL',
        [tokenId]
      );
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error('Error checking token usage', { error, tokenId });
      return true; // Fail safe
    }
  }

  private async markTokenAsUsed(tokenId: string): Promise<void> {
    await this.db.query(
      'UPDATE refresh_tokens SET used_at = NOW() WHERE id = $1',
      [tokenId]
    );
  }

  private async invalidateTokenFamily(tokenFamily: string): Promise<void> {
    await this.db.query(`
      UPDATE refresh_tokens 
      SET revoked = true, used_at = NOW()
      WHERE token_family = $1 AND used_at IS NULL
    `, [tokenFamily]);

    this.logger.warn('Token family invalidated due to security issue', { tokenFamily });
  }

  // Validate refresh token without using it
  async validateRefreshToken(refreshToken: string): Promise<{
    valid: boolean;
    userId?: string;
    sessionId?: string;
    error?: string;
  }> {
    try {
      const decoded = jwt.verify(refreshToken, this.refreshTokenSecret, {
        algorithms: ['HS256'],
        issuer: process.env.JWT_ISSUER || 'saas-vala',
        audience: 'saas-vala-refresh'
      }) as RefreshTokenPayload & { jti: string };

      // Check if token is used
      const isUsed = await this.isTokenUsed(decoded.jti);
      if (isUsed) {
        return { valid: false, error: 'Token already used' };
      }

      // Check if user is still active
      const userResult = await this.db.query(
        'SELECT id FROM users WHERE id = $1 AND status = $2',
        [decoded.userId, 'active']
      );

      if (!userResult.rows[0]) {
        return { valid: false, error: 'User not active' };
      }

      return {
        valid: true,
        userId: decoded.userId,
        sessionId: decoded.sessionId
      };

    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return { valid: false, error: 'Token expired' };
      }
      if (error.name === 'JsonWebTokenError') {
        return { valid: false, error: 'Invalid token' };
      }
      
      return { valid: false, error: 'Validation error' };
    }
  }
}

export default RefreshTokenService;
