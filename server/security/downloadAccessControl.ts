import { Request, Response } from 'express';
import { UltraDatabase } from '../database';
import { UltraLogger } from '../logger';
import crypto from 'crypto';
import path from 'path';

// Note: Express types should be available in the project
// If not, install: npm install @types/express

export interface DownloadConfig {
  maxFileSize: number;
  allowedExtensions: string[];
  requireAuthentication: boolean;
  defaultExpiry: number; // seconds
  maxExpiry: number; // seconds
}

export interface SignedURL {
  url: string;
  token: string;
  expiresAt: Date;
  fileId: string;
  userId?: string;
  permissions: string[];
}

export class DownloadAccessControl {
  private urlStore = new Map<string, SignedURL>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private db: UltraDatabase,
    private logger: UltraLogger
  ) {
    // Cleanup expired URLs every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  // Generate secure download URL with token
  async generateDownloadURL(
    fileId: string,
    userId?: string,
    expirySeconds: number = 3600,
    permissions: string[] = ['read']
  ): Promise<{
    url: string;
    token: string;
    expiresAt: Date;
  }> {
    try {
      // Validate expiry time
      const maxExpiry = parseInt(process.env.MAX_DOWNLOAD_EXPIRY || '86400'); // 24 hours default
      const expiry = Math.min(expirySeconds, maxExpiry);
      const expiresAt = new Date(Date.now() + (expiry * 1000));

      // Generate secure token
      const token = this.generateSecureToken(fileId, userId, expiresAt, permissions);

      // Store URL information
      const signedURL: SignedURL = {
        url: `/api/download/${token}`,
        token,
        expiresAt,
        fileId,
        userId,
        permissions
      };

      // Store in memory and database
      this.urlStore.set(token, signedURL);
      await this.storeSignedURL(signedURL);

      this.logger.info(`Download URL generated for file ${fileId}`, 'DOWNLOAD_SUCCESS');

      return {
        url: signedURL.url,
        token: signedURL.token,
        expiresAt: signedURL.expiresAt
      };

    } catch (error: any) {
      this.logger.error(`Failed to generate download URL: ${error.message}`, 'DOWNLOAD_ERROR');
      throw new Error('Failed to generate download URL');
    }
  }

  // Validate download request
  async validateDownloadRequest(token: string, req: Request): Promise<{
    valid: boolean;
    fileId?: string;
    error?: string;
    signedURL?: SignedURL;
  }> {
    try {
      // Check memory store first
      let signedURL = this.urlStore.get(token);

      // If not in memory, check database
      if (!signedURL) {
        signedURL = await this.getStoredURL(token);
        if (signedURL) {
          this.urlStore.set(token, signedURL); // Restore to memory
        }
      }

      if (!signedURL) {
        return { valid: false, error: 'Invalid or expired download token' };
      }

      // Check expiry
      if (signedURL.expiresAt < new Date()) {
        this.urlStore.delete(token);
        await this.revokeURL(token);
        return { valid: false, error: 'Download token expired' };
      }

      // Check user authentication if required
      if (signedURL.userId && !req.user) {
        return { valid: false, error: 'Authentication required' };
      }

      // Check user authorization
      if (signedURL.userId && req.user?.id !== signedURL.userId) {
        this.logger.warn(`Unauthorized download attempt for token ${token.substring(0, 8)}...`, 'DOWNLOAD_SECURITY');
        return { valid: false, error: 'Unauthorized access' };
      }

      // Check file exists and user has permission
      const fileCheck = await this.validateFileAccess(signedURL.fileId, req.user?.id);
      if (!fileCheck.valid) {
        return { valid: false, error: fileCheck.error };
      }

      // Log successful validation
      this.logger.info(`Download request validated for file ${signedURL.fileId}`, 'DOWNLOAD_SUCCESS');

      return {
        valid: true,
        fileId: signedURL.fileId,
        signedURL
      };

    } catch (error: any) {
      this.logger.error(`Download validation error: ${error.message}`, 'DOWNLOAD_ERROR');
      return { valid: false, error: 'Validation error' };
    }
  }

  // Generate secure token
  private generateSecureToken(
    fileId: string,
    userId: string | undefined,
    expiresAt: Date,
    permissions: string[]
  ): string {
    const payload = {
      fileId,
      userId,
      exp: Math.floor(expiresAt.getTime() / 1000),
      permissions,
      nonce: crypto.randomBytes(16).toString('hex')
    };

    const tokenData = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', process.env.DOWNLOAD_SECRET || 'default-secret')
      .update(tokenData)
      .digest('hex');

    return Buffer.from(tokenData).toString('base64') + '.' + signature;
  }

  // Store signed URL in database
  private async storeSignedURL(signedURL: SignedURL): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO download_urls (
          id, token, file_id, user_id, expires_at, permissions, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (token) DO UPDATE SET
          expires_at = EXCLUDED.expires_at,
          permissions = EXCLUDED.permissions
      `, [
        crypto.randomUUID(),
        signedURL.token,
        signedURL.fileId,
        signedURL.userId,
        signedURL.expiresAt,
        JSON.stringify(signedURL.permissions)
      ]);
    } catch (error: any) {
      this.logger.error(`Failed to store signed URL: ${error.message}`, 'DOWNLOAD_ERROR');
    }
  }

  // Get stored URL from database
  private async getStoredURL(token: string): Promise<SignedURL | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM download_urls WHERE token = $1 AND expires_at > NOW()',
        [token]
      ) as unknown as { rows: any[] };

      if (!result.rows[0]) {
        return null;
      }

      const row = result.rows[0];
      return {
        url: `/api/download/${token}`,
        token: row.token,
        expiresAt: row.expires_at,
        fileId: row.file_id,
        userId: row.user_id,
        permissions: JSON.parse(row.permissions || '[]')
      };
    } catch (error: any) {
      this.logger.error(`Failed to retrieve stored URL: ${error.message}`, 'DOWNLOAD_ERROR');
      return null;
    }
  }

  // Validate file access permissions
  private async validateFileAccess(fileId: string, userId?: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      // Check if file exists
      const fileResult = await this.db.query(
        'SELECT * FROM files WHERE id = $1',
        [fileId]
      ) as unknown as { rows: any[] };

      if (!fileResult.rows[0]) {
        return { valid: false, error: 'File not found' };
      }

      const file = fileResult.rows[0];

      // Check if file is public
      if (file.is_public) {
        return { valid: true };
      }

      // Check user authentication for private files
      if (!userId) {
        return { valid: false, error: 'Authentication required for this file' };
      }

      // Check if user owns the file
      if (file.owner_id === userId) {
        return { valid: true };
      }

      // Check if user has explicit permission
      const permissionResult = await this.db.query(
        'SELECT 1 FROM file_permissions WHERE file_id = $1 AND user_id = $2',
        [fileId, userId]
      ) as unknown as { rows: any[] };

      if (permissionResult.rows[0]) {
        return { valid: true };
      }

      // Check if user has role-based access
      if (userId) {
        const userResult = await this.db.query(
          'SELECT role FROM users WHERE id = $1',
          [userId]
        ) as { rows: any[] };

        const userRole = userResult.rows[0]?.role;
        
        // Admins can access all files
        if (['admin', 'super_admin'].includes(userRole)) {
          return { valid: true };
        }
      }

      return { valid: false, error: 'Access denied' };

    } catch (error: any) {
      this.logger.error(`File access validation error: ${error.message}`, 'DOWNLOAD_ERROR');
      return { valid: false, error: 'Access validation failed' };
    }
  }

  // Revoke download URL
  async revokeURL(token: string): Promise<void> {
    try {
      this.urlStore.delete(token);
      
      await this.db.query(
        'DELETE FROM download_urls WHERE token = $1',
        [token]
      );

      this.logger.info(`Download URL revoked for token ${token.substring(0, 8)}...`, 'DOWNLOAD_SUCCESS');
    } catch (error: any) {
      this.logger.error(`Failed to revoke URL: ${error.message}`, 'DOWNLOAD_ERROR');
    }
  }

  // Revoke all URLs for a file
  async revokeFileURLs(fileId: string): Promise<number> {
    try {
      let revokedCount = 0;

      // Remove from memory store
      for (const [token, url] of this.urlStore.entries()) {
        if (url.fileId === fileId) {
          this.urlStore.delete(token);
          revokedCount++;
        }
      }

      // Remove from database
      const dbResult = await this.db.query(
        'DELETE FROM download_urls WHERE file_id = $1',
        [fileId]
      );

      const totalRevoked = revokedCount + (dbResult as any).rowCount;

      this.logger.info(`All URLs revoked for file ${fileId}, total: ${totalRevoked}`, 'DOWNLOAD_SUCCESS');

      return totalRevoked;

    } catch (error: any) {
      this.logger.error(`Failed to revoke file URLs: ${error.message}`, 'DOWNLOAD_ERROR');
      return 0;
    }
  }

  // Revoke all URLs for a user
  async revokeUserURLs(userId: string): Promise<number> {
    try {
      let revokedCount = 0;

      // Remove from memory store
      for (const [token, url] of this.urlStore.entries()) {
        if (url.userId === userId) {
          this.urlStore.delete(token);
          revokedCount++;
        }
      }

      // Remove from database
      const dbResult = await this.db.query(
        'DELETE FROM download_urls WHERE user_id = $1',
        [userId]
      );

      const totalRevoked = revokedCount + (dbResult as any).rowCount;

      this.logger.info(`All URLs revoked for user ${userId}, total: ${totalRevoked}`, 'DOWNLOAD_SUCCESS');

      return totalRevoked;

    } catch (error: any) {
      this.logger.error(`Failed to revoke user URLs: ${error.message}`, 'DOWNLOAD_ERROR');
      return 0;
    }
  }

  // Cleanup expired URLs
  private cleanup(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [token, url] of this.urlStore.entries()) {
      if (url.expiresAt < now) {
        this.urlStore.delete(token);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`Download URLs cleanup: ${cleanedCount} cleaned, ${this.urlStore.size} remaining`, 'DOWNLOAD_CLEANUP');
    }

    // Also cleanup database
    this.cleanupDatabase();
  }

  // Cleanup expired URLs from database
  private async cleanupDatabase(): Promise<void> {
    try {
      const result = await this.db.query(
        'DELETE FROM download_urls WHERE expires_at < NOW()'
      );

      if ((result as any).rowCount && (result as any).rowCount > 0) {
        this.logger.info(`Database download URLs cleanup: ${(result as any).rowCount} deleted`, 'DOWNLOAD_CLEANUP');
      }
    } catch (error: any) {
      this.logger.error(`Database cleanup failed: ${error.message}`, 'DOWNLOAD_ERROR');
    }
  }

  // Get download statistics
  async getStatistics(): Promise<{
    totalURLs: number;
    activeURLs: number;
    expiredURLs: number;
    urlsByUser: Array<{ userId: string; count: number }>;
    urlsByFile: Array<{ fileId: string; count: number }>;
  }> {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_urls,
          COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_urls,
          COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_urls
        FROM download_urls
      `) as unknown as { rows: any[] };

      const userResult = await this.db.query(`
        SELECT user_id, COUNT(*) as count
        FROM download_urls
        WHERE user_id IS NOT NULL
        GROUP BY user_id
        ORDER BY count DESC
        LIMIT 10
      `) as unknown as { rows: any[] };

      const fileResult = await this.db.query(`
        SELECT file_id, COUNT(*) as count
        FROM download_urls
        GROUP BY file_id
        ORDER BY count DESC
        LIMIT 10
      `) as unknown as { rows: any[] };

      return {
        totalURLs: parseInt(result.rows[0]?.total_urls || '0'),
        activeURLs: parseInt(result.rows[0]?.active_urls || '0'),
        expiredURLs: parseInt(result.rows[0]?.expired_urls || '0'),
        urlsByUser: userResult.rows.map(row => ({
          userId: row.user_id,
          count: parseInt(row.count)
        })),
        urlsByFile: fileResult.rows.map(row => ({
          fileId: row.file_id,
          count: parseInt(row.count)
        }))
      };
    } catch (error: any) {
      this.logger.error(`Failed to get download statistics: ${error.message}`, 'DOWNLOAD_ERROR');
      return {
        totalURLs: 0,
        activeURLs: 0,
        expiredURLs: 0,
        urlsByUser: [],
        urlsByFile: []
      };
    }
  }

  // Cleanup on shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.urlStore.clear();
  }
}

export default DownloadAccessControl;
