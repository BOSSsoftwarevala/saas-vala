import { UltraDatabase } from '../database';
import { UltraLogger } from '../logger';
import crypto from 'crypto';
// Note: speakeasy and qrcode need to be installed: npm install speakeasy qrcode @types/qrcode
// import speakeasy from 'speakeasy';
// import qrcode from 'qrcode';

// Temporary mock implementations for development
const speakeasy = {
  generateSecret: (options: any) => ({
    base32: crypto.randomBytes(16).toString('base64').replace(/=/g, '').replace(/[+/]/g, '').substring(0, 32),
    otpauth_url: `otpauth://totp/${options.name}?secret=${crypto.randomBytes(16).toString('base64').replace(/=/g, '').replace(/[+/]/g, '')}&issuer=${options.issuer}`
  }),
  totp: {
    verify: (options: any) => {
      // Mock verification - in production, use real speakeasy
      return options.token === '123456' || options.token === '000000';
    }
  }
};

const qrcode = {
  toDataURL: async (url: string) => {
    // Mock QR code - in production, use real qrcode
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  }
};

export interface TwoFactorConfig {
  issuer: string;
  window: number; // Time window for TOTP (default: 1)
  digits: number; // Number of digits (default: 6)
  period: number; // Time period in seconds (default: 30)
}

export interface BackupCodes {
  codes: string[];
  used: boolean[];
  createdAt: Date;
}

export class TwoFactorAuth {
  private readonly config: TwoFactorConfig;

  constructor(
    private db: UltraDatabase,
    private logger: UltraLogger,
    config?: Partial<TwoFactorConfig>
  ) {
    this.config = {
      issuer: config?.issuer || 'SaaS Vala',
      window: config?.window || 1,
      digits: config?.digits || 6,
      period: config?.period || 30
    };
  }

  // Generate TOTP secret for user
  async generateTOTPSecret(userId: string, email: string): Promise<{
    secret: string;
    backupCodes: string[];
    qrCode: string;
    manualEntryKey: string;
  }> {
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `${this.config.issuer} (${email})`,
        issuer: this.config.issuer,
        length: 32
      });

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Store in database (not yet enabled)
      await this.db.query(`
        INSERT INTO two_factor_secrets (
          id, user_id, secret, backup_codes, enabled, created_at
        ) VALUES ($1, $2, $3, $4, false, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          secret = EXCLUDED.secret,
          backup_codes = EXCLUDED.backup_codes,
          enabled = false,
          updated_at = NOW()
      `, [
        crypto.randomUUID(),
        userId,
        secret.base32,
        JSON.stringify(backupCodes)
      ]);

      // Generate QR code
      const qrCode = await qrcode.toDataURL(secret.otpauth_url || '');

      this.logger.info(`TOTP secret generated for user ${userId}`, '2FA_SUCCESS');

      return {
        secret: secret.base32,
        backupCodes,
        qrCode,
        manualEntryKey: secret.base32
      };

    } catch (error: any) {
      this.logger.error(`Failed to generate TOTP secret: ${error.message}`, '2FA_ERROR');
      throw new Error('Failed to generate 2FA secret');
    }
  }

  // Enable 2FA for user (after verification)
  async enableTwoFactor(userId: string, verificationCode: string): Promise<{
    success: boolean;
    backupCodes: string[];
  }> {
    try {
      // Get user's secret
      const result = await this.db.query(
        'SELECT secret, backup_codes FROM two_factor_secrets WHERE user_id = $1',
        [userId]
      ) as unknown as { rows: any[] };

      if (!result.rows[0]) {
        throw new Error('2FA secret not found');
      }

      const { secret, backup_codes } = result.rows[0];

      // Verify the code
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: verificationCode,
        window: this.config.window,
        time: Math.floor(Date.now() / 1000)
      });

      if (!verified) {
        this.logger.warn('2FA enable verification failed', { userId });
        throw new Error('Invalid verification code');
      }

      // Enable 2FA
      await this.db.query(`
        UPDATE two_factor_secrets 
        SET enabled = true, enabled_at = NOW(), updated_at = NOW()
        WHERE user_id = $1
      `, [userId]);

      // Log security event
      await this.logSecurityEvent(userId, '2FA_ENABLED', {
        method: 'TOTP'
      });

      this.logger.info(`2FA enabled for user ${userId}`, 'SUCCESS');

      return {
        success: true,
        backupCodes: JSON.parse(backup_codes)
      };

    } catch (error: any) {
      this.logger.error(`Failed to enable 2FA: ${error.message}`, '2FA_ERROR');
      throw error;
    }
  }

  // Disable 2FA for user
  async disableTwoFactor(userId: string, verificationCode: string): Promise<void> {
    try {
      // Verify current code before disabling
      const verified = await this.verifyTOTP(userId, verificationCode);
      
      if (!verified) {
        throw new Error('Invalid verification code');
      }

      // Disable 2FA
      await this.db.query(`
        UPDATE two_factor_secrets 
        SET enabled = false, disabled_at = NOW(), updated_at = NOW()
        WHERE user_id = $1
      `, [userId]);

      // Log security event
      await this.logSecurityEvent(userId, '2FA_DISABLED', {
        method: 'TOTP'
      });

      this.logger.info(`2FA disabled for user ${userId}`, 'SUCCESS');

    } catch (error: any) {
      this.logger.error(`Failed to disable 2FA: ${error.message}`, '2FA_ERROR');
      throw error;
    }
  }

  // Verify TOTP code
  async verifyTOTP(userId: string, token: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        'SELECT secret, enabled FROM two_factor_secrets WHERE user_id = $1',
        [userId]
      ) as unknown as { rows: any[] };

      if (!result.rows[0] || !result.rows[0].enabled) {
        return false;
      }

      const { secret } = result.rows[0];

      return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: this.config.window,
        time: Math.floor(Date.now() / 1000)
      });

    } catch (error: any) {
      this.logger.error(`TOTP verification error: ${error.message}`, '2FA_ERROR');
      return false;
    }
  }

  // Verify backup code
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        'SELECT backup_codes, used_backup_codes FROM two_factor_secrets WHERE user_id = $1 AND enabled = true',
        [userId]
      ) as unknown as { rows: any[] };

      if (!result.rows[0]) {
        return false;
      }

      const { backup_codes, used_backup_codes } = result.rows[0];
      const backupCodeArray = JSON.parse(backup_codes);
      const usedCodes = new Set(used_backup_codes ? JSON.parse(used_backup_codes) : []);

      // Check if code exists and hasn't been used
      const codeIndex = backupCodeArray.findIndex((c: string) => c === code);
      
      if (codeIndex === -1 || usedCodes.has(code)) {
        return false;
      }

      // Mark code as used
      usedCodes.add(code);
      await this.db.query(`
        UPDATE two_factor_secrets 
        SET used_backup_codes = $2, updated_at = NOW()
        WHERE user_id = $1
      `, [userId, JSON.stringify([...usedCodes])]);

      // Log security event
      await this.logSecurityEvent(userId, 'BACKUP_CODE_USED', {
        codeIndex
      });

      this.logger.info(`Backup code used: ${codeIndex} for user ${userId}`, 'SUCCESS');

      return true;

    } catch (error: any) {
      this.logger.error(`Backup code verification error: ${error.message}`, '2FA_ERROR');
      return false;
    }
  }

  // Generate new backup codes
  async regenerateBackupCodes(userId: string, verificationCode: string): Promise<string[]> {
    try {
      // Verify current code first
      const verified = await this.verifyTOTP(userId, verificationCode);
      
      if (!verified) {
        throw new Error('Invalid verification code');
      }

      // Generate new backup codes
      const newBackupCodes = this.generateBackupCodes();

      // Update database
      await this.db.query(`
        UPDATE two_factor_secrets 
        SET backup_codes = $1, used_backup_codes = '[]', updated_at = NOW()
        WHERE user_id = $2
      `, [JSON.stringify(newBackupCodes), userId]);

      // Log security event
      await this.logSecurityEvent(userId, 'BACKUP_CODES_REGENERATED', {});

      this.logger.info(`Backup codes regenerated for user ${userId}`, 'SUCCESS');

      return newBackupCodes;

    } catch (error: any) {
      this.logger.error(`Failed to regenerate backup codes: ${error.message}`, '2FA_ERROR');
      throw error;
    }
  }

  // Check if user has 2FA enabled
  async isTwoFactorEnabled(userId: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        'SELECT enabled FROM two_factor_secrets WHERE user_id = $1',
        [userId]
      ) as unknown as { rows: any[] };

      return result.rows[0]?.enabled || false;

    } catch (error: any) {
      this.logger.error(`Error checking 2FA status: ${error.message}`, '2FA_ERROR');
      return false;
    }
  }

  // Get 2FA status for user
  async getTwoFactorStatus(userId: string): Promise<{
    enabled: boolean;
    hasSecret: boolean;
    backupCodesCount: number;
    usedBackupCodesCount: number;
    enabledAt?: Date;
  }> {
    try {
      const result = await this.db.query(
        'SELECT * FROM two_factor_secrets WHERE user_id = $1',
        [userId]
      ) as unknown as { rows: any[] };

      if (!result.rows[0]) {
        return {
          enabled: false,
          hasSecret: false,
          backupCodesCount: 0,
          usedBackupCodesCount: 0
        };
      }

      const row = result.rows[0];
      const backupCodes = JSON.parse(row.backup_codes || '[]');
      const usedBackupCodes = row.used_backup_codes ? JSON.parse(row.used_backup_codes) : [];

      return {
        enabled: row.enabled,
        hasSecret: true,
        backupCodesCount: backupCodes.length,
        usedBackupCodesCount: usedBackupCodes.length,
        enabledAt: row.enabled_at
      };

    } catch (error: any) {
      this.logger.error(`Error getting 2FA status: ${error.message}`, '2FA_ERROR');
      return {
        enabled: false,
        hasSecret: false,
        backupCodesCount: 0,
        usedBackupCodesCount: 0
      };
    }
  }

  // Generate backup codes
  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  // Log security events
  private async logSecurityEvent(userId: string, eventType: string, details: any): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO security_logs (
          id, user_id, event_type, details, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [
        crypto.randomUUID(),
        userId,
        eventType,
        JSON.stringify(details)
      ]);
    } catch (error: any) {
      this.logger.error(`Failed to log 2FA security event: ${error.message}`);
    }
  }

  // Middleware to require 2FA for admin routes
  requireTwoFactor = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Check if user is admin
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
        return next(); // 2FA not required for non-admins
      }

      // Check if 2FA is enabled for this admin
      const isEnabled = await this.isTwoFactorEnabled(userId);
      
      if (!isEnabled) {
        return res.status(403).json({
          error: 'Two-factor authentication required for admin access',
          code: '2FA_REQUIRED',
          setupRequired: true
        });
      }

      // Check if 2FA verification was done in this session
      if (!req.session?.twoFactorVerified) {
        return res.status(403).json({
          error: 'Two-factor verification required',
          code: '2FA_VERIFICATION_REQUIRED'
        });
      }

      next();

    } catch (error: any) {
      this.logger.error(`2FA middleware error: ${error.message}`, 'AUTH_ERROR');
      res.status(500).json({
        error: 'Authentication error',
        code: 'AUTH_ERROR'
      });
    }
  };

  // Verify 2FA code for session
  async verifyTwoFactorForSession(userId: string, code: string, backupCode?: string): Promise<{
    success: boolean;
    requiresNewBackupCodes?: boolean;
  }> {
    try {
      let verified = false;
      let requiresNewBackupCodes = false;

      if (backupCode) {
        verified = await this.verifyBackupCode(userId, backupCode);
        
        if (verified) {
          // Check if user is low on backup codes
          const status = await this.getTwoFactorStatus(userId);
          const remainingCodes = status.backupCodesCount - status.usedBackupCodesCount;
          
          if (remainingCodes <= 2) {
            requiresNewBackupCodes = true;
          }
        }
      } else {
        verified = await this.verifyTOTP(userId, code);
      }

      if (verified) {
        await this.logSecurityEvent(userId, '2FA_SESSION_VERIFIED', {
          method: backupCode ? 'backup_code' : 'totp'
        });
      }

      return {
        success: verified,
        requiresNewBackupCodes
      };

    } catch (error: any) {
      this.logger.error(`2FA session verification error: ${error.message}`);
      return { success: false };
    }
  }

  // Get 2FA statistics
  async getStatistics(): Promise<{
    totalUsers: number;
    enabledUsers: number;
    adminUsers: number;
    adminsWith2FA: number;
    recentVerifications: number;
  }> {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN enabled = true THEN 1 END) as enabled_users
        FROM two_factor_secrets
      `) as unknown as { rows: any[] };

      const adminResult = await this.db.query(`
        SELECT 
          COUNT(DISTINCT u.id) as total_admins,
          COUNT(DISTINCT CASE WHEN tfs.enabled = true THEN u.id END) as admins_with_2fa
        FROM users u
        LEFT JOIN two_factor_secrets tfs ON u.id = tfs.user_id
        WHERE u.role IN ('admin', 'super_admin')
      `) as unknown as { rows: any[] };

      const recentResult = await this.db.query(`
        SELECT COUNT(*) as recent_verifications
        FROM security_logs
        WHERE event_type = '2FA_SESSION_VERIFIED'
        AND created_at > NOW() - INTERVAL '24 hours'
      `) as unknown as { rows: any[] };

      return {
        totalUsers: parseInt(result.rows[0]?.total_users || '0'),
        enabledUsers: parseInt(result.rows[0]?.enabled_users || '0'),
        adminUsers: parseInt(adminResult.rows[0]?.total_admins || '0'),
        adminsWith2FA: parseInt(adminResult.rows[0]?.admins_with_2fa || '0'),
        recentVerifications: parseInt(recentResult.rows[0]?.recent_verifications || '0')
      };

    } catch (error: any) {
      this.logger.error(`Failed to get 2FA statistics: ${error.message}`, 'STATS_ERROR');
      return {
        totalUsers: 0,
        enabledUsers: 0,
        adminUsers: 0,
        adminsWith2FA: 0,
        recentVerifications: 0
      };
    }
  }
}

export default TwoFactorAuth;
