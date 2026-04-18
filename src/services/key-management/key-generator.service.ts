// Key Generator Service with Encryption and Checksum
import { supabase } from '@/lib/supabase';
import type {
  Key,
  KeyGenerationRequest,
  KeyGenerationOptions,
  KeySize,
  KeyType,
} from '@/types/key-management';
import { KEY_SIZE_CONFIG, DEFAULT_PREFIXES } from '@/types/key-management';
import crypto from 'crypto';

export class KeyGeneratorService {
  private encryptionKey: string;
  private algorithm = 'aes-256-gcm';
  private ivLength = 16;
  private saltLength = 32;

  constructor() {
    // In production, this should come from environment variables
    this.encryptionKey = process.env.KEY_ENCRYPTION_KEY || 'default-key-change-in-production';
  }

  /**
   * Generate a random key
   */
  async generateKey(request: KeyGenerationRequest): Promise<Key | null> {
    try {
      // Generate random string
      const randomString = this.generateRandomString(request.key_size);
      
      // Add prefix
      const prefix = request.prefix || DEFAULT_PREFIXES[request.type];
      const prefixedKey = `${prefix}-${randomString}`;
      
      // Generate checksum
      const checksum = this.generateChecksum(prefixedKey);
      
      // Attach checksum
      const keyWithChecksum = `${prefixedKey}-${checksum}`;
      
      // Encrypt the key
      const encryptedKey = this.encrypt(keyWithChecksum);
      
      // Generate hash for verification
      const keyHash = this.hash(keyWithChecksum);
      
      // Create key record
      const keyData: Partial<Key> = {
        product_id: request.product_id,
        key_value: encryptedKey,
        key_hash,
        type: request.type,
        key_size: request.key_size,
        prefix,
        checksum,
        usage_limit: request.usage_limit,
        used_count: 0,
        device_bindings: [],
        status: 'active',
        expiry_date: request.expiry_date,
        grace_period_days: 0,
        owner_name: request.owner_name,
        owner_email: request.owner_email,
        ip_restrictions: [],
        geo_restrictions: [],
        metadata: request.metadata || {},
      };
      
      // Save to database
      const { data, error } = await supabase
        .from('keys')
        .insert(keyData)
        .select()
        .single();

      if (error) throw error;
      
      return data as Key;
    } catch (error) {
      console.error('Error generating key:', error);
      return null;
    }
  }

  /**
   * Generate multiple keys
   */
  async generateKeys(requests: KeyGenerationRequest[]): Promise<Key[]> {
    const keys: Key[] = [];
    
    for (const request of requests) {
      const key = await this.generateKey(request);
      if (key) {
        keys.push(key);
      }
    }
    
    return keys;
  }

  /**
   * Generate random string of specified length
   */
  private generateRandomString(size: KeySize): string {
    const length = KEY_SIZE_CONFIG[size];
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Generate checksum for key
   */
  private generateChecksum(key: string): string {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return hash.substring(0, 8).toUpperCase();
  }

  /**
   * Generate hash for verification
   */
  private hash(key: string): string {
    return crypto.createHash('sha512').update(key).digest('hex');
  }

  /**
   * Encrypt key
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const salt = crypto.randomBytes(this.saltLength);
    
    // Derive key from password
    const key = crypto.pbkdf2Sync(
      this.encryptionKey,
      salt,
      100000,
      32,
      'sha256'
    );
    
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine salt, iv, auth tag, and encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'hex'),
    ]);
    
    return combined.toString('base64');
  }

  /**
   * Decrypt key
   */
  private decrypt(encryptedText: string): string {
    const combined = Buffer.from(encryptedText, 'base64');
    
    const salt = combined.slice(0, this.saltLength);
    const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
    const authTag = combined.slice(
      this.saltLength + this.ivLength,
      this.saltLength + this.ivLength + 16
    );
    const encrypted = combined.slice(this.saltLength + this.ivLength + 16);
    
    // Derive key from password
    const key = crypto.pbkdf2Sync(
      this.encryptionKey,
      salt,
      100000,
      32,
      'sha256'
    );
    
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  }

  /**
   * Verify key checksum
   */
  verifyChecksum(key: string, checksum: string): boolean {
    const parts = key.split('-');
    const keyPart = parts.slice(0, -1).join('-');
    const computedChecksum = this.generateChecksum(keyPart);
    
    return computedChecksum === checksum;
  }

  /**
   * Get key by ID (decrypted for display)
   */
  async getKeyById(id: string): Promise<Key | null> {
    try {
      const { data, error } = await supabase
        .from('keys')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Return encrypted version (don't decrypt in this method for security)
      return data as Key;
    } catch (error) {
      console.error('Error getting key:', error);
      return null;
    }
  }

  /**
   * Get keys by product
   */
  async getKeysByProduct(productId: string, filters?: {
    type?: KeyType;
    status?: string;
    assigned?: boolean;
  }): Promise<Key[]> {
    try {
      let query = supabase
        .from('keys')
        .select('*')
        .eq('product_id', productId)
        .is('deleted_at', null);

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.assigned !== undefined) {
        if (filters.assigned) {
          query = query.not('assigned_user_id', 'is', null);
        } else {
          query = query.is('assigned_user_id', null);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as Key[]) || [];
    } catch (error) {
      console.error('Error getting keys by product:', error);
      return [];
    }
  }

  /**
   * Get unassigned keys for a product
   */
  async getUnassignedKeys(productId: string, type?: KeyType): Promise<Key[]> {
    try {
      let query = supabase
        .from('keys')
        .select('*')
        .eq('product_id', productId)
        .is('assigned_user_id', null)
        .eq('status', 'active')
        .is('deleted_at', null);

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query.order('created_at', { ascending: true }).limit(1);

      if (error) throw error;
      return (data as Key[]) || [];
    } catch (error) {
      console.error('Error getting unassigned keys:', error);
      return [];
    }
  }

  /**
   * Delete key (soft delete)
   */
  async deleteKey(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('keys')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting key:', error);
      return false;
    }
  }

  /**
   * Suspend key
   */
  async suspendKey(id: string, reason?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('keys')
        .update({ 
          status: 'suspended',
          notes: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error suspending key:', error);
      return false;
    }
  }

  /**
   * Reactivate key
   */
  async reactivateKey(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('keys')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error reactivating key:', error);
      return false;
    }
  }

  /**
   * Revoke key
   */
  async revokeKey(id: string, reason?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('keys')
        .update({ 
          status: 'revoked',
          notes: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error revoking key:', error);
      return false;
    }
  }

  /**
   * Reset key usage
   */
  async resetKeyUsage(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('keys')
        .update({ 
          used_count: 0,
          device_bindings: [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error resetting key usage:', error);
      return false;
    }
  }

  /**
   * Update key metadata
   */
  async updateKeyMetadata(id: string, metadata: Record<string, unknown>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('keys')
        .update({ 
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating key metadata:', error);
      return false;
    }
  }

  /**
   * Get key statistics
   */
  async getKeyStats(productId?: string): Promise<{
    total_keys: number;
    active_keys: number;
    suspended_keys: number;
    expired_keys: number;
    assigned_keys: number;
    unassigned_keys: number;
    by_type: {
      api: number;
      feature: number;
      license: number;
    };
  }> {
    try {
      let query = supabase.from('keys').select('*').is('deleted_at', null);
      
      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const keys = data as Key[];
      
      return {
        total_keys: keys.length,
        active_keys: keys.filter(k => k.status === 'active').length,
        suspended_keys: keys.filter(k => k.status === 'suspended').length,
        expired_keys: keys.filter(k => k.status === 'expired').length,
        assigned_keys: keys.filter(k => k.assigned_user_id).length,
        unassigned_keys: keys.filter(k => !k.assigned_user_id).length,
        by_type: {
          api: keys.filter(k => k.type === 'api').length,
          feature: keys.filter(k => k.type === 'feature').length,
          license: keys.filter(k => k.type === 'license').length,
        },
      };
    } catch (error) {
      console.error('Error getting key stats:', error);
      return {
        total_keys: 0,
        active_keys: 0,
        suspended_keys: 0,
        expired_keys: 0,
        assigned_keys: 0,
        unassigned_keys: 0,
        by_type: {
          api: 0,
          feature: 0,
          license: 0,
        },
      };
    }
  }

  /**
   * Validate key format
   */
  validateKeyFormat(key: string): boolean {
    // Key format: PREFIX-RANDOM-CHECKSUM
    const parts = key.split('-');
    
    if (parts.length !== 3) {
      return false;
    }
    
    const [prefix, random, checksum] = parts;
    
    // Check prefix
    const validPrefixes = Object.values(DEFAULT_PREFIXES);
    if (!validPrefixes.includes(prefix)) {
      return false;
    }
    
    // Check random part (alphanumeric)
    if (!/^[A-Z0-9]+$/.test(random)) {
      return false;
    }
    
    // Check checksum (8 character hex)
    if (!/^[A-F0-9]{8}$/.test(checksum)) {
      return false;
    }
    
    return true;
  }

  /**
   * Extract key type from key
   */
  extractKeyTypeFromKey(key: string): KeyType | null {
    const prefix = key.split('-')[0];
    
    for (const [type, typePrefix] of Object.entries(DEFAULT_PREFIXES)) {
      if (typePrefix === prefix) {
        return type as KeyType;
      }
    }
    
    return null;
  }
}

export const keyGeneratorService = new KeyGeneratorService();
