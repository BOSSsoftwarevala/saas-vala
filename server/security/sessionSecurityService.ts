import { Request, Response } from 'express';
import { UltraDatabase } from '../database';
import { UltraLogger } from '../logger';
import crypto from 'crypto';

export interface SessionFingerprint {
  userId: string;
  sessionId: string;
  deviceId: string;
  userAgent: string;
  ip: string;
  country?: string;
  city?: string;
  createdAt: Date;
  lastActivity: Date;
}

export class SessionSecurityService {
  constructor(
    private db: UltraDatabase,
    private logger: UltraLogger
  ) {}

  // Generate device fingerprint from request
  generateDeviceFingerprint(req: Request): string {
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';
    
    // Create fingerprint from stable browser characteristics
    const fingerprintData = `${userAgent}:${acceptLanguage}:${acceptEncoding}`;
    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
  }

  // Create new secure session
  async createSecureSession(
    userId: string,
    req: Request,
    deviceBinding: boolean = true
  ): Promise<{
    sessionId: string;
    deviceId: string;
    expiresAt: Date;
  }> {
    const sessionId = crypto.randomUUID();
    const deviceId = deviceBinding ? this.generateDeviceFingerprint(req) : crypto.randomUUID();
    const userAgent = req.get('User-Agent') || '';
    const ip = req.ip;
    
    // Get geo location (optional)
    const location = await this.getGeoLocation(ip);
    
    const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours

    // Store session with security metadata
    await this.db.query(`
      INSERT INTO user_sessions (
        id, user_id, device_id, user_agent, ip_address, country, city,
        created_at, last_activity, expires_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8, true)
    `, [
      sessionId, userId, deviceId, userAgent, ip, 
      location?.country, location?.city, expiresAt
    ]);

    // Store session fingerprint
    await this.db.query(`
      INSERT INTO session_fingerprints (
        session_id, user_id, device_id, user_agent, ip_address,
        country, city, created_at, last_activity
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    `, [
      sessionId, userId, deviceId, userAgent, ip,
      location?.country, location?.city
    ]);

    this.logger.info('Secure session created', {
      userId,
      sessionId,
      deviceId,
      ip,
      userAgent: userAgent.substring(0, 100),
      location
    });

    return {
      sessionId,
      deviceId,
      expiresAt
    };
  }

  // Validate session security
  async validateSessionSecurity(
    sessionId: string,
    req: Request,
    strictMode: boolean = true
  ): Promise<{
    valid: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    reasons: string[];
    session?: SessionFingerprint;
  }> {
    const reasons: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    try {
      // Get session details
      const sessionResult = await this.db.query(`
        SELECT s.*, f.country, f.city
        FROM user_sessions s
        LEFT JOIN session_fingerprints f ON s.id = f.session_id
        WHERE s.id = $1 AND s.is_active = true AND s.expires_at > NOW()
      `, [sessionId]);

      if (!sessionResult.rows[0]) {
        return {
          valid: false,
          riskLevel: 'high',
          reasons: ['Session not found or expired'],
        };
      }

      const session = sessionResult.rows[0];
      const currentDeviceId = this.generateDeviceFingerprint(req);
      const currentIp = req.ip;
      const currentUserAgent = req.get('User-Agent') || '';

      // Check 1: Device binding
      if (session.device_id && strictMode) {
        if (session.device_id !== currentDeviceId) {
          reasons.push('Device fingerprint mismatch');
          riskLevel = 'high';
        }
      }

      // Check 2: IP address change (if enabled)
      if (process.env.ENFORCE_IP_BINDING === 'true' && session.ip_address !== currentIp) {
        reasons.push('IP address changed');
        riskLevel = 'medium';
        
        // Check for impossible geography
        const geoChange = await this.detectImpossibleGeography(session.ip_address, currentIp);
        if (geoChange.impossible) {
          reasons.push(`Impossible geography: ${geoChange.reason}`);
          riskLevel = 'high';
        }
      }

      // Check 3: User agent change
      if (session.user_agent !== currentUserAgent) {
        reasons.push('User agent changed');
        riskLevel = 'medium';
      }

      // Check 4: Rapid location changes
      if (session.country || session.city) {
        const currentLocation = await this.getGeoLocation(currentIp);
        if (currentLocation && (session.country !== currentLocation.country || session.city !== currentLocation.city)) {
          reasons.push('Location changed');
          riskLevel = 'medium';
        }
      }

      // Check 5: Session age
      const sessionAge = Date.now() - new Date(session.created_at).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (sessionAge > maxAge) {
        reasons.push('Session too old');
        riskLevel = 'medium';
      }

      // Update last activity
      await this.db.query(
        'UPDATE user_sessions SET last_activity = NOW() WHERE id = $1',
        [sessionId]
      );

      // Log security events
      if (reasons.length > 0) {
        this.logger.warn('Session security validation failed', {
          sessionId,
          userId: session.user_id,
          riskLevel,
          reasons,
          ip: currentIp,
          userAgent: currentUserAgent.substring(0, 100)
        });
      }

      return {
        valid: riskLevel !== 'high',
        riskLevel,
        reasons,
        session: {
          userId: session.user_id,
          sessionId: session.id,
          deviceId: session.device_id,
          userAgent: session.user_agent,
          ip: session.ip_address,
          country: session.country,
          city: session.city,
          createdAt: session.created_at,
          lastActivity: session.last_activity
        }
      };

    } catch (error: any) {
      this.logger.error('Session validation error', { error: error.message, sessionId });
      return {
        valid: false,
        riskLevel: 'high',
        reasons: ['Validation error'],
      };
    }
  }

  // Detect impossible geography (too fast travel)
  private async detectImpossibleGeography(oldIp: string, newIp: string): Promise<{
    impossible: boolean;
    reason?: string;
  }> {
    try {
      const [oldLocation, newLocation] = await Promise.all([
        this.getGeoLocation(oldIp),
        this.getGeoLocation(newIp)
      ]);

      if (!oldLocation?.lat || !oldLocation?.lng || !newLocation?.lat || !newLocation?.lng) {
        return { impossible: false };
      }

      // Calculate distance between coordinates
      const distance = this.calculateDistance(
        oldLocation.lat, oldLocation.lng,
        newLocation.lat, newLocation.lng
      );

      // If distance > 1000km, it's impossible to travel in < 1 hour
      if (distance > 1000) {
        return {
          impossible: true,
          reason: `Impossible travel: ${Math.round(distance)}km distance`
        };
      }

      return { impossible: false };
    } catch (error) {
      return { impossible: false };
    }
  }

  // Calculate distance between two coordinates
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Get geo location from IP
  private async getGeoLocation(ip: string): Promise<{
    country?: string;
    city?: string;
    lat?: number;
    lng?: number;
  } | null> {
    try {
      // Use a free geo IP service (in production, use a paid service)
      const response = await fetch(`http://ip-api.com/json/${ip}`);
      if (response.ok) {
        const data = await response.json();
        return {
          country: data.country,
          city: data.city,
          lat: data.lat,
          lng: data.lon
        };
      }
    } catch (error) {
      // Silently fail - geo location is optional
    }
    return null;
  }

  // Terminate suspicious session
  async terminateSuspiciousSession(sessionId: string, reason: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE user_sessions 
        SET is_active = false, terminated_at = NOW(), termination_reason = $1
        WHERE id = $2
      `, [reason, sessionId]);

      this.logger.warn('Session terminated due to suspicious activity', {
        sessionId,
        reason
      });

    } catch (error: any) {
      this.logger.error('Failed to terminate session', { error: error.message, sessionId });
    }
  }

  // Get all active sessions for user
  async getUserActiveSessions(userId: string): Promise<SessionFingerprint[]> {
    try {
      const result = await this.db.query(`
        SELECT s.id as session_id, s.user_id, s.device_id, s.user_agent, 
               s.ip_address, f.country, f.city, s.created_at, s.last_activity
        FROM user_sessions s
        LEFT JOIN session_fingerprints f ON s.id = f.session_id
        WHERE s.user_id = $1 AND s.is_active = true AND s.expires_at > NOW()
        ORDER BY s.last_activity DESC
      `, [userId]);

      return result.rows.map(row => ({
        userId: row.user_id,
        sessionId: row.session_id,
        deviceId: row.device_id,
        userAgent: row.user_agent,
        ip: row.ip_address,
        country: row.country,
        city: row.city,
        createdAt: row.created_at,
        lastActivity: row.last_activity
      }));

    } catch (error: any) {
      this.logger.error('Failed to get user sessions', { error: error.message, userId });
      return [];
    }
  }

  // Terminate all user sessions except current
  async terminateOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    try {
      const result = await this.db.query(`
        UPDATE user_sessions 
        SET is_active = false, terminated_at = NOW(), termination_reason = 'User logout'
        WHERE user_id = $1 AND id != $2 AND is_active = true
      `, [userId, currentSessionId]);

      this.logger.info('Other sessions terminated', {
        userId,
        currentSessionId,
        terminatedCount: result.rowCount
      });

      return result.rowCount || 0;

    } catch (error: any) {
      this.logger.error('Failed to terminate other sessions', { error: error.message, userId });
      return 0;
    }
  }

  // Clean up expired sessions
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.db.query(`
        DELETE FROM user_sessions 
        WHERE expires_at < NOW() OR (is_active = false AND terminated_at < NOW() - INTERVAL '7 days')
      `);

      if (result.rowCount > 0) {
        this.logger.info('Cleaned up expired sessions', { 
          deletedCount: result.rowCount 
        });
      }

      return result.rowCount || 0;

    } catch (error: any) {
      this.logger.error('Session cleanup failed', { error: error.message });
      return 0;
    }
  }
}

export default SessionSecurityService;
