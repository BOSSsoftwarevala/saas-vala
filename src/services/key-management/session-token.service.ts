// Session + Token System for Key Management
import { supabase } from '@/integrations/supabase/client';
import type { Key } from '@/types/key-management';
import crypto from 'crypto';

export interface Session {
  id: string;
  key_id: string;
  user_id?: string;
  device_id: string;
  token: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: string;
  last_activity_at: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenPayload {
  key_id: string;
  device_id: string;
  user_id?: string;
  iat: number; // Issued at
  exp: number; // Expiration
  jti: string; // JWT ID
}

export class SessionTokenService {
  private secretKey: string;
  private tokenExpirySeconds = 3600; // 1 hour default
  private refreshTokenExpirySeconds = 86400 * 7; // 7 days

  constructor() {
    // In production, this should come from environment variables
    this.secretKey = process.env.JWT_SECRET || 'default-secret-change-in-production';
  }

  /**
   * Create session after key validation
   */
  async createSession(
    keyId: string,
    deviceId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; session?: Session; token?: string; error?: string }> {
    try {
      // Generate JWT token
      const tokenPayload: TokenPayload = {
        key_id: keyId,
        device_id: deviceId,
        user_id: userId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.tokenExpirySeconds,
        jti: crypto.randomUUID(),
      };

      const token = this.generateToken(tokenPayload);

      // Create session record
      const expiresAt = new Date(Date.now() + this.tokenExpirySeconds * 1000);
      
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          key_id: keyId,
          user_id: userId,
          device_id: deviceId,
          token: this.hashToken(token),
          ip_address: ipAddress,
          user_agent: userAgent,
          expires_at: expiresAt.toISOString(),
          last_activity_at: new Date().toISOString(),
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        session: data as Session,
        token,
      };
    } catch (error) {
      console.error('Error creating session:', error);
      return {
        success: false,
        error: 'Failed to create session',
      };
    }
  }

  /**
   * Validate session token
   */
  async validateToken(token: string): Promise<{ valid: boolean; session?: Session; error?: string }> {
    try {
      // Decode token
      const payload = this.decodeToken(token);
      
      if (!payload) {
        return { valid: false, error: 'Invalid token' };
      }

      // Check expiration
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return { valid: false, error: 'Token expired' };
      }

      // Get session from database
      const tokenHash = this.hashToken(token);
      
      const { data: session, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('token', tokenHash)
        .eq('is_active', true)
        .single();

      if (error || !session) {
        return { valid: false, error: 'Session not found' };
      }

      // Check session expiration
      const expiresAt = new Date(session.expires_at);
      if (new Date() > expiresAt) {
        await this.deactivateSession(session.id);
        return { valid: false, error: 'Session expired' };
      }

      // Update last activity
      await this.updateSessionActivity(session.id);

      return {
        valid: true,
        session: session as Session,
      };
    } catch (error) {
      console.error('Error validating token:', error);
      return {
        valid: false,
        error: 'Failed to validate token',
      };
    }
  }

  /**
   * Refresh token
   */
  async refreshToken(
    oldToken: string
  ): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      // Validate old token
      const validation = await this.validateToken(oldToken);
      
      if (!validation.valid || !validation.session) {
        return { success: false, error: 'Invalid token' };
      }

      // Generate new token
      const tokenPayload: TokenPayload = {
        key_id: validation.session.key_id,
        device_id: validation.session.device_id,
        user_id: validation.session.user_id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.tokenExpirySeconds,
        jti: crypto.randomUUID(),
      };

      const newToken = this.generateToken(tokenPayload);

      // Update session
      const expiresAt = new Date(Date.now() + this.tokenExpirySeconds * 1000);
      
      const { error } = await supabase
        .from('sessions')
        .update({
          token: this.hashToken(newToken),
          expires_at: expiresAt.toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', validation.session.id);

      if (error) throw error;

      return {
        success: true,
        token: newToken,
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      return {
        success: false,
        error: 'Failed to refresh token',
      };
    }
  }

  /**
   * Deactivate session
   */
  async deactivateSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          is_active: false,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deactivating session:', error);
      return false;
    }
  }

  /**
   * Deactivate all sessions for a key
   */
  async deactivateAllSessionsForKey(keyId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          is_active: false,
          last_activity_at: new Date().toISOString(),
        })
        .eq('key_id', keyId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deactivating sessions for key:', error);
      return false;
    }
  }

  /**
   * Deactivate all sessions for a user
   */
  async deactivateAllSessionsForUser(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          is_active: false,
          last_activity_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deactivating sessions for user:', error);
      return false;
    }
  }

  /**
   * Deactivate all sessions for a device
   */
  async deactivateAllSessionsForDevice(deviceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          is_active: false,
          last_activity_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deactivating sessions for device:', error);
      return false;
    }
  }

  /**
   * Get active sessions for a key
   */
  async getActiveSessionsForKey(keyId: string): Promise<Session[]> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('key_id', keyId)
        .eq('is_active', true)
        .order('last_activity_at', { ascending: false });

      if (error) throw error;
      return (data as Session[]) || [];
    } catch (error) {
      console.error('Error getting active sessions for key:', error);
      return [];
    }
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessionsForUser(userId: string): Promise<Session[]> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity_at', { ascending: false });

      if (error) throw error;
      return (data as Session[]) || [];
    } catch (error) {
      console.error('Error getting active sessions for user:', error);
      return [];
    }
  }

  /**
   * Update session activity
   */
  private async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating session activity:', error);
    }
  }

  /**
   * Generate JWT token (simplified version)
   */
  private generateToken(payload: TokenPayload): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Decode JWT token
   */
  private decodeToken(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = Buffer.from(parts[1], 'base64url').toString();
      return JSON.parse(payload) as TokenPayload;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Hash token for storage (don't store raw token)
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Verify token signature
   */
  private verifyTokenSignature(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const [encodedHeader, encodedPayload, signature] = parts;
      
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');

      return signature === expectedSignature;
    } catch (error) {
      console.error('Error verifying token signature:', error);
      return false;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          is_active: false,
        })
        .lt('expires_at', new Date().toISOString())
        .eq('is_active', true);

      if (error) throw error;
      
      return 0; // Would return actual count in production
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    total_sessions: number;
    active_sessions: number;
    expired_sessions: number;
    unique_devices: number;
    unique_users: number;
  }> {
    try {
      const [totalResult, activeResult] = await Promise.all([
        supabase.from('sessions').select('id', { count: 'exact' }),
        supabase
          .from('sessions')
          .select('id', { count: 'exact' })
          .eq('is_active', true),
      ]);

      const total = totalResult.count || 0;
      const active = activeResult.count || 0;

      // Get unique devices and users
      const { data: sessions } = await supabase
        .from('sessions')
        .select('device_id, user_id');

      const uniqueDevices = new Set(sessions?.map(s => s.device_id) || []).size;
      const uniqueUsers = new Set(sessions?.map(s => s.user_id).filter(Boolean) || []).size;

      return {
        total_sessions: total,
        active_sessions: active,
        expired_sessions: total - active,
        unique_devices: uniqueDevices,
        unique_users: uniqueUsers,
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      return {
        total_sessions: 0,
        active_sessions: 0,
        expired_sessions: 0,
        unique_devices: 0,
        unique_users: 0,
      };
    }
  }

  /**
   * Force logout all users (admin function)
   */
  async forceLogoutAll(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          is_active: false,
          last_activity_at: new Date().toISOString(),
        })
        .eq('is_active', true);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error force logging out all users:', error);
      return false;
    }
  }
}

export const sessionTokenService = new SessionTokenService();
