import { UltraDatabase } from '../database';
import { UltraLogger } from '../logger';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export interface SecretConfig {
  encryptionKey: string;
  environment: 'development' | 'staging' | 'production';
  vaultPath: string;
  rotationInterval: number; // hours
  backupEnabled: boolean;
  auditEnabled: boolean;
}

export interface SecretEntry {
  id: string;
  name: string;
  value: string;
  encrypted: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lastRotated?: Date;
  expiresAt?: Date;
  environment: string;
  category: 'api_key' | 'database' | 'jwt' | 'encryption' | 'external' | 'service';
  accessCount: number;
  lastAccessed?: Date;
}

export class SecretManagement {
  private readonly config: SecretConfig;
  private readonly encryptionAlgorithm = 'aes-256-gcm';
  private readonly keyDerivationInfo = 'saas-vala-secret-management';
  private cache = new Map<string, SecretEntry>();
  private cacheExpiry = new Map<string, NodeJS.Timeout>();

  constructor(
    private db: UltraDatabase,
    private logger: UltraLogger,
    config: SecretConfig
  ) {
    this.config = config;
    
    // Initialize vault directory
    this.initializeVault();
    
    // Start rotation scheduler
    this.startRotationScheduler();
    
    // Cache cleanup scheduler
    this.startCacheCleanup();
  }

  // Initialize vault directory structure
  private async initializeVault(): Promise<void> {
    try {
      await fs.mkdir(this.config.vaultPath, { recursive: true });
      await fs.mkdir(path.join(this.config.vaultPath, 'backups'), { recursive: true });
      await fs.mkdir(path.join(this.config.vaultPath, 'audit'), { recursive: true });
      
      this.logger.info('Secret vault initialized', { path: this.config.vaultPath });
    } catch (error: any) {
      this.logger.error('Failed to initialize secret vault', { error: error.message });
      throw error;
    }
  }

  // Store a new secret
  async storeSecret(
    name: string,
    value: string,
    category: SecretEntry['category'],
    environment?: string,
    expiresAt?: Date
  ): Promise<string> {
    try {
      // Validate inputs
      this.validateSecretName(name);
      this.validateSecretValue(value);
      
      const env = environment || this.config.environment;
      const encrypted = this.encryptSecret(value);
      
      const secret: SecretEntry = {
        id: crypto.randomUUID(),
        name,
        value: encrypted.encrypted,
        encrypted: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt,
        environment: env,
        category,
        accessCount: 0
      };

      // Store in database
      await this.db.query(`
        INSERT INTO secrets (
          id, name, value, encrypted, version, created_at, updated_at,
          expires_at, environment, category, access_count, encryption_iv, auth_tag
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (name, environment) DO UPDATE SET
          value = EXCLUDED.value,
          version = secrets.version + 1,
          updated_at = NOW(),
          expires_at = EXCLUDED.expires_at,
          encryption_iv = EXCLUDED.encryption_iv,
          auth_tag = EXCLUDED.auth_tag
      `, [
        secret.id,
        secret.name,
        secret.value,
        secret.encrypted,
        secret.version,
        secret.createdAt,
        secret.updatedAt,
        secret.expiresAt,
        secret.environment,
        secret.category,
        secret.accessCount,
        encrypted.iv,
        encrypted.authTag
      ]);

      // Cache the secret
      this.cacheSecret(secret);

      // Log audit event
      await this.logAuditEvent('SECRET_STORED', {
        secretId: secret.id,
        name: secret.name,
        category: secret.category,
        environment: secret.environment
      });

      this.logger.info('Secret stored successfully', {
        secretId: secret.id,
        name: secret.name,
        category,
        environment: env
      });

      return secret.id;

    } catch (error: any) {
      this.logger.error('Failed to store secret', { 
        error: error.message, 
        name, 
        category 
      });
      throw new Error('Failed to store secret');
    }
  }

  // Retrieve a secret
  async getSecret(name: string, environment?: string): Promise<string | null> {
    try {
      const env = environment || this.config.environment;
      const cacheKey = `${name}:${env}`;

      // Check cache first
      if (this.cache.has(cacheKey)) {
        const secret = this.cache.get(cacheKey)!;
        
        // Update access statistics
        await this.updateAccessStats(secret.id);
        
        return this.decryptSecret(secret.value, secret.id);
      }

      // Retrieve from database
      const result = await this.db.query(`
        SELECT * FROM secrets 
        WHERE name = $1 AND environment = $2 
        AND (expires_at IS NULL OR expires_at > NOW())
      `, [name, env]) as { rows: any[] };

      if (!result.rows[0]) {
        return null;
      }

      const secret: SecretEntry = result.rows[0];
      
      // Update access statistics
      await this.updateAccessStats(secret.id);
      
      // Cache the secret
      this.cacheSecret(secret);

      // Log audit event
      await this.logAuditEvent('SECRET_ACCESSED', {
        secretId: secret.id,
        name: secret.name,
        environment: secret.environment
      });

      return this.decryptSecret(secret.value, secret.id);

    } catch (error: any) {
      this.logger.error('Failed to retrieve secret', { 
        error: error.message, 
        name, 
        environment 
      });
      return null;
    }
  }

  // Update a secret
  async updateSecret(
    name: string,
    newValue: string,
    environment?: string
  ): Promise<boolean> {
    try {
      const env = environment || this.config.environment;
      const encrypted = this.encryptSecret(newValue);

      const result = await this.db.query(`
        UPDATE secrets 
        SET value = $1, 
            version = version + 1,
            updated_at = NOW(),
            encryption_iv = $2,
            auth_tag = $3
        WHERE name = $4 AND environment = $5
        RETURNING id, version
      `, [
        encrypted.encrypted,
        encrypted.iv,
        encrypted.authTag,
        name,
        env
      ]) as { rows: any[] };

      if (!result.rows[0]) {
        return false;
      }

      // Clear cache
      const cacheKey = `${name}:${env}`;
      this.cache.delete(cacheKey);
      this.clearCacheExpiry(cacheKey);

      // Log audit event
      await this.logAuditEvent('SECRET_UPDATED', {
        secretId: result.rows[0].id,
        name,
        environment: env,
        newVersion: result.rows[0].version
      });

      this.logger.info('Secret updated successfully', {
        name,
        environment: env,
        newVersion: result.rows[0].version
      });

      return true;

    } catch (error: any) {
      this.logger.error('Failed to update secret', { 
        error: error.message, 
        name, 
        environment 
      });
      return false;
    }
  }

  // Delete a secret
  async deleteSecret(name: string, environment?: string): Promise<boolean> {
    try {
      const env = environment || this.config.environment;

      const result = await this.db.query(`
        DELETE FROM secrets 
        WHERE name = $1 AND environment = $2
        RETURNING id
      `, [name, env]) as { rows: any[] };

      if (!result.rows[0]) {
        return false;
      }

      // Clear cache
      const cacheKey = `${name}:${env}`;
      this.cache.delete(cacheKey);
      this.clearCacheExpiry(cacheKey);

      // Log audit event
      await this.logAuditEvent('SECRET_DELETED', {
        secretId: result.rows[0].id,
        name,
        environment: env
      });

      this.logger.info('Secret deleted successfully', {
        name,
        environment: env
      });

      return true;

    } catch (error: any) {
      this.logger.error('Failed to delete secret', { 
        error: error.message, 
        name, 
        environment 
      });
      return false;
    }
  }

  // Rotate a secret
  async rotateSecret(name: string, environment?: string): Promise<string | null> {
    try {
      const env = environment || this.config.environment;
      
      // Get current secret
      const currentSecret = await this.getSecret(name, env);
      if (!currentSecret) {
        return null;
      }

      // Generate new secret value (for API keys, etc.)
      const newValue = this.generateSecretValue(name);

      // Update with new value
      const updated = await this.updateSecret(name, newValue, env);
      if (!updated) {
        return null;
      }

      // Log rotation
      await this.logAuditEvent('SECRET_ROTATED', {
        name,
        environment: env
      });

      this.logger.info('Secret rotated successfully', {
        name,
        environment: env
      });

      return newValue;

    } catch (error: any) {
      this.logger.error('Failed to rotate secret', { 
        error: error.message, 
        name, 
        environment 
      });
      return null;
    }
  }

  // List all secrets (metadata only)
  async listSecrets(environment?: string): Promise<Array<{
    id: string;
    name: string;
    category: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date;
    accessCount: number;
    lastAccessed?: Date;
  }>> {
    try {
      const env = environment || this.config.environment;

      const result = await this.db.query(`
        SELECT id, name, category, version, created_at, updated_at, 
               expires_at, access_count, last_accessed
        FROM secrets 
        WHERE environment = $1
        ORDER BY name
      `, [env]) as { rows: any[] };

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
        accessCount: row.access_count,
        lastAccessed: row.last_accessed
      }));

    } catch (error: any) {
      this.logger.error('Failed to list secrets', { 
        error: error.message, 
        environment 
      });
      return [];
    }
  }

  // Encrypt a secret value
  private encryptSecret(value: string): {
    encrypted: string;
    iv: string;
    authTag: string;
  } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.encryptionAlgorithm, this.config.encryptionKey);
    cipher.setAAD(Buffer.from(this.keyDerivationInfo));
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  // Decrypt a secret value
  private decryptSecret(encryptedValue: string, secretId: string): string {
    try {
      // Get IV and auth tag from database
      const result = this.db.query(
        'SELECT encryption_iv, auth_tag FROM secrets WHERE id = $1',
        [secretId]
      ) as { rows: any[] };

      if (!result.rows[0]) {
        throw new Error('Secret not found');
      }

      const { encryption_iv, auth_tag } = result.rows[0];
      
      const decipher = crypto.createDecipher(this.encryptionAlgorithm, this.config.encryptionKey);
      decipher.setAAD(Buffer.from(this.keyDerivationInfo));
      decipher.setAuthTag(Buffer.from(auth_tag, 'hex'));
      
      let decrypted = decipher.update(encryptedValue, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: any) {
      this.logger.error('Failed to decrypt secret', { 
        error: error.message, 
        secretId 
      });
      throw new Error('Failed to decrypt secret');
    }
  }

  // Generate secret value based on category
  private generateSecretValue(name: string): string {
    if (name.includes('api_key')) {
      return crypto.randomBytes(32).toString('hex');
    }
    if (name.includes('jwt')) {
      return crypto.randomBytes(64).toString('base64');
    }
    return crypto.randomBytes(32).toString('base64');
  }

  // Validate secret name
  private validateSecretName(name: string): void {
    if (!name || name.length < 3) {
      throw new Error('Secret name must be at least 3 characters long');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error('Secret name can only contain letters, numbers, underscores, and hyphens');
    }
    if (name.length > 100) {
      throw new Error('Secret name cannot exceed 100 characters');
    }
  }

  // Validate secret value
  private validateSecretValue(value: string): void {
    if (!value || value.length === 0) {
      throw new Error('Secret value cannot be empty');
    }
    if (value.length > 10000) {
      throw new Error('Secret value cannot exceed 10,000 characters');
    }
  }

  // Cache a secret
  private cacheSecret(secret: SecretEntry): void {
    const cacheKey = `${secret.name}:${secret.environment}`;
    this.cache.set(cacheKey, secret);
    
    // Set cache expiry (5 minutes)
    const expiry = setTimeout(() => {
      this.cache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
    }, 5 * 60 * 1000);
    
    this.cacheExpiry.set(cacheKey, expiry);
  }

  // Clear cache expiry
  private clearCacheExpiry(cacheKey: string): void {
    const expiry = this.cacheExpiry.get(cacheKey);
    if (expiry) {
      clearTimeout(expiry);
      this.cacheExpiry.delete(cacheKey);
    }
  }

  // Update access statistics
  private async updateAccessStats(secretId: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE secrets 
        SET access_count = access_count + 1,
            last_accessed = NOW()
        WHERE id = $1
      `, [secretId]);
    } catch (error: any) {
      this.logger.error('Failed to update access stats', { 
        error: error.message, 
        secretId 
      });
    }
  }

  // Log audit event
  private async logAuditEvent(event: string, details: any): Promise<void> {
    if (!this.config.auditEnabled) return;

    try {
      const auditFile = path.join(
        this.config.vaultPath, 
        'audit', 
        `audit-${new Date().toISOString().split('T')[0]}.log`
      );

      const auditEntry = {
        timestamp: new Date().toISOString(),
        event,
        details,
        userId: 'system', // Would be populated by auth context
        ip: 'system'
      };

      await fs.appendFile(auditFile, JSON.stringify(auditEntry) + '\n');
    } catch (error: any) {
      this.logger.error('Failed to log audit event', { 
        error: error.message, 
        event 
      });
    }
  }

  // Start rotation scheduler
  private startRotationScheduler(): void {
    const interval = this.config.rotationInterval * 60 * 60 * 1000; // Convert hours to milliseconds
    
    setInterval(async () => {
      await this.rotateExpiredSecrets();
    }, interval);
  }

  // Rotate expired secrets
  private async rotateExpiredSecrets(): Promise<void> {
    try {
      const result = await this.db.query(`
        SELECT name, environment FROM secrets 
        WHERE expires_at <= NOW() OR 
              (last_rotated IS NOT NULL AND last_rotated < NOW() - INTERVAL '${this.config.rotationInterval} hours')
      `) as { rows: any[] };

      for (const row of result.rows) {
        await this.rotateSecret(row.name, row.environment);
      }

      this.logger.info('Automatic secret rotation completed', {
        rotatedCount: result.rows.length
      });

    } catch (error: any) {
      this.logger.error('Failed to rotate expired secrets', { 
        error: error.message 
      });
    }
  }

  // Start cache cleanup
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cache.clear();
      this.cacheExpiry.forEach(expiry => clearTimeout(expiry));
      this.cacheExpiry.clear();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  // Get secret statistics
  async getStatistics(): Promise<{
    totalSecrets: number;
    expiredSecrets: number;
    secretsByCategory: Array<{ category: string; count: number }>;
    recentlyAccessed: number;
    rotationSchedule: Array<{ name: string; environment: string; nextRotation: Date }>;
  }> {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_secrets,
          COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_secrets,
          COUNT(CASE WHEN last_accessed > NOW() - INTERVAL '24 hours' THEN 1 END) as recently_accessed
        FROM secrets
        WHERE environment = $1
      `, [this.config.environment]) as { rows: any[] };

      const categoryResult = await this.db.query(`
        SELECT category, COUNT(*) as count
        FROM secrets
        WHERE environment = $1
        GROUP BY category
      `, [this.config.environment]) as { rows: any[] };

      const rotationResult = await this.db.query(`
        SELECT name, environment, 
               CASE 
                 WHEN last_rotated IS NULL THEN created_at
                 ELSE last_rotated
               END + INTERVAL '${this.config.rotationInterval} hours' as next_rotation
        FROM secrets
        WHERE environment = $1
        ORDER BY next_rotation
        LIMIT 10
      `, [this.config.environment]) as { rows: any[] };

      return {
        totalSecrets: parseInt(result.rows[0]?.total_secrets || '0'),
        expiredSecrets: parseInt(result.rows[0]?.expired_secrets || '0'),
        recentlyAccessed: parseInt(result.rows[0]?.recently_accessed || '0'),
        secretsByCategory: categoryResult.rows.map(row => ({
          category: row.category,
          count: parseInt(row.count)
        })),
        rotationSchedule: rotationResult.rows.map(row => ({
          name: row.name,
          environment: row.environment,
          nextRotation: row.next_rotation
        }))
      };

    } catch (error: any) {
      this.logger.error('Failed to get secret statistics', { 
        error: error.message 
      });
      return {
        totalSecrets: 0,
        expiredSecrets: 0,
        secretsByCategory: [],
        recentlyAccessed: 0,
        rotationSchedule: []
      };
    }
  }

  // Backup secrets
  async backupSecrets(): Promise<string> {
    if (!this.config.backupEnabled) {
      throw new Error('Backup is disabled');
    }

    try {
      const backupFile = path.join(
        this.config.vaultPath,
        'backups',
        `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.enc`
      );

      const secrets = await this.listSecrets();
      const backupData = {
        timestamp: new Date().toISOString(),
        environment: this.config.environment,
        secrets: secrets
      };

      const encrypted = this.encryptSecret(JSON.stringify(backupData));
      
      await fs.writeFile(backupFile, JSON.stringify({
        encrypted: encrypted.encrypted,
        iv: encrypted.iv,
        authTag: encrypted.authTag
      }));

      await this.logAuditEvent('SECRETS_BACKED_UP', {
        backupFile,
        secretCount: secrets.length
      });

      this.logger.info('Secrets backup completed', {
        backupFile,
        secretCount: secrets.length
      });

      return backupFile;

    } catch (error: any) {
      this.logger.error('Failed to backup secrets', { 
        error: error.message 
      });
      throw error;
    }
  }

  // Cleanup resources
  destroy(): void {
    this.cache.clear();
    this.cacheExpiry.forEach(expiry => clearTimeout(expiry));
    this.cacheExpiry.clear();
  }
}

export default SecretManagement;
