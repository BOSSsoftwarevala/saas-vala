// Key Validation Service with Device Binding and Security Checks
import { supabase } from '@/lib/supabase';
import type {
  Key,
  KeyValidationRequest,
  KeyValidationResponse,
  KeyActivation,
  KeyUsageLog,
  ValidationResult,
  DeviceFingerprint as DeviceFingerprintType,
} from '@/types/key-management';
import { keyGeneratorService } from './key-generator.service';
import crypto from 'crypto';

export class KeyValidationService {
  private maxFailedAttempts = 10;
  private bruteForceWindowMinutes = 15;
  private rateLimitPerMinute = 100;
  private rateLimitPerHour = 1000;

  /**
   * Validate key with comprehensive checks
   */
  async validateKey(request: KeyValidationRequest): Promise<KeyValidationResponse> {
    try {
      // Check for brute force attempts
      const isBruteForce = await this.checkBruteForceDetection(
        request.ip_address,
        request.key_value
      );
      
      if (isBruteForce) {
        await this.logValidationAttempt(request, 'failed', 'Brute force detected');
        return {
          valid: false,
          error: 'Too many failed attempts. Please try again later.',
        };
      }

      // Check rate limit
      const isRateLimited = await this.checkRateLimit(request.ip_address);
      
      if (isRateLimited) {
        await this.logValidationAttempt(request, 'failed', 'Rate limit exceeded');
        return {
          valid: false,
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      // Validate key format
      const isValidFormat = keyGeneratorService.validateKeyFormat(request.key_value);
      
      if (!isValidFormat) {
        await this.logValidationAttempt(request, 'failed', 'Invalid key format');
        return {
          valid: false,
          error: 'Invalid key format.',
        };
      }

      // Find key by hash
      const keyHash = this.hashKey(request.key_value);
      const key = await this.getKeyByHash(keyHash);
      
      if (!key) {
        await this.logValidationAttempt(request, 'failed', 'Key not found');
        return {
          valid: false,
          error: 'Invalid key.',
        };
      }

      // Check if key is valid (status, expiry, usage limit)
      const isValid = await this.isKeyValid(key);
      
      if (!isValid.valid) {
        await this.logValidationAttempt(request, 'failed', isValid.reason);
        return {
          valid: false,
          error: isValid.reason || 'Key is invalid.',
        };
      }

      // Check device binding
      const deviceCheck = await this.checkDeviceBinding(key, request.device_id);
      
      if (!deviceCheck.allowed) {
        await this.logValidationAttempt(request, 'failed', deviceCheck.reason);
        return {
          valid: false,
          error: deviceCheck.reason || 'Device not authorized.',
        };
      }

      // Check geo restrictions
      if (key.geo_restrictions && key.geo_restrictions.length > 0) {
        // In production, get geo location from IP
        // For now, skip geo check
      }

      // Check IP restrictions
      if (key.ip_restrictions && key.ip_restrictions.length > 0) {
        if (request.ip_address && !key.ip_restrictions.includes(request.ip_address)) {
          await this.logValidationAttempt(request, 'failed', 'IP not authorized');
          return {
            valid: false,
            error: 'IP address not authorized.',
          };
        }
      }

      // Increment usage and bind device if needed
      await this.incrementKeyUsage(key.id, request.device_id);

      // Log successful validation
      await this.logValidationAttempt(request, 'success');
      await this.logKeyUsage(key.id, request.device_id, 'verify', 'success');

      // Update last verified timestamp
      await this.updateKeyLastVerified(key.id, request.device_id);

      // Generate JWT token for subsequent requests
      const token = this.generateToken(key.id, request.device_id);

      await this.logValidationAttempt(request, 'success');

      return {
        valid: true,
        key_id: key.id,
        product_id: key.product_id,
        user_id: key.assigned_user_id,
        status: key.status,
        token,
        expiry_date: key.expiry_date,
        usage_limit: key.usage_limit,
        used_count: key.used_count,
        remaining_uses: key.usage_limit - key.used_count,
        device_bindings: key.device_bindings,
        is_new_device: deviceCheck.is_new_device,
      };
    } catch (error) {
      console.error('Error validating key:', error);
      await this.logValidationAttempt(request, 'failed', 'Internal error');
      return {
        valid: false,
        error: 'Internal server error.',
      };
    }
  }

  /**
   * Check if key is valid (status, expiry, usage limit)
   */
  private async isKeyValid(key: Key): Promise<ValidationResult> {
    // Check status
    if (key.status !== 'active') {
      return {
        is_valid: false,
        reason: `Key is ${key.status}.`,
        key,
        security_flags: {
          is_new_device: false,
          is_suspicious: false,
          is_brute_force_detected: false,
          is_geo_blocked: false,
          is_ip_blocked: false,
        },
      };
    }

    // Check expiry with grace period
    if (key.expiry_date) {
      const expiryDate = new Date(key.expiry_date);
      const gracePeriodEnd = new Date(
        expiryDate.getTime() + key.grace_period_days * 24 * 60 * 60 * 1000
      );
      
      if (new Date() > gracePeriodEnd) {
        return {
          is_valid: false,
          reason: 'Key has expired.',
          key,
          security_flags: {
            is_new_device: false,
            is_suspicious: false,
            is_brute_force_detected: false,
            is_geo_blocked: false,
            is_ip_blocked: false,
          },
        };
      }
    }

    // Check usage limit
    if (key.usage_limit && key.used_count >= key.usage_limit) {
      return {
        is_valid: false,
        reason: 'Key has reached usage limit.',
        key,
        security_flags: {
          is_new_device: false,
          is_suspicious: false,
          is_brute_force_detected: false,
          is_geo_blocked: false,
          is_ip_blocked: false,
        },
      };
    }

    return {
      is_valid: true,
      key,
      security_flags: {
        is_new_device: false,
        is_suspicious: false,
        is_brute_force_detected: false,
        is_geo_blocked: false,
        is_ip_blocked: false,
      },
    };
  }

  /**
   * Check device binding
   */
  private async checkDeviceBinding(
    key: Key,
    deviceId: string
  ): Promise<{ allowed: boolean; reason?: string; is_new_device: boolean }> {
    // If no device bindings yet, allow
    if (!key.device_bindings || key.device_bindings.length === 0) {
      return { allowed: true, is_new_device: true };
    }

    // Check if device is already bound
    const isBound = key.device_bindings.includes(deviceId);

    if (isBound) {
      return { allowed: true, is_new_device: false };
    }

    // Check if usage limit reached
    if (key.usage_limit && key.used_count >= key.usage_limit) {
      return {
        allowed: false,
        reason: 'Key has reached maximum device limit.',
        is_new_device: true,
      };
    }

    // Allow new device if under limit
    return { allowed: true, is_new_device: true };
  }

  /**
   * Get key by hash
   */
  private async getKeyByHash(keyHash: string): Promise<Key | null> {
    try {
      const { data, error } = await supabase
        .from('keys')
        .select('*')
        .eq('key_hash', keyHash)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return data as Key;
    } catch (error) {
      console.error('Error getting key by hash:', error);
      return null;
    }
  }

  /**
   * Hash key for lookup
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha512').update(key).digest('hex');
  }

  /**
   * Increment key usage
   */
  private async incrementKeyUsage(keyId: string, deviceId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_key_usage', {
        p_key_id: keyId,
        p_device_id: deviceId,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error incrementing key usage:', error);
    }
  }

  /**
   * Update key last verified timestamp
   */
  private async updateKeyLastVerified(keyId: string, deviceId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('keys')
        .update({
          last_verified_at: new Date().toISOString(),
          last_device_id: deviceId,
        })
        .eq('id', keyId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating key last verified:', error);
    }
  }

  /**
   * Log validation attempt
   */
  private async logValidationAttempt(
    request: KeyValidationRequest,
    status: 'success' | 'failed',
    metadata?: string
  ): Promise<void> {
    try {
      await supabase.rpc('log_validation_attempt', {
        p_key_value: request.key_value,
        p_device_id: request.device_id,
        p_ip_address: request.ip_address,
        p_status: status,
        p_metadata: { error: metadata },
      });
    } catch (error) {
      console.error('Error logging validation attempt:', error);
    }
  }

  /**
   * Log key usage
   */
  private async logKeyUsage(
    keyId: string,
    deviceId: string,
    action: string,
    status: 'success' | 'failed' | 'blocked',
    errorMessage?: string
  ): Promise<void> {
    try {
      await supabase.from('key_usage_logs').insert({
        key_id: keyId,
        device_id: deviceId,
        action,
        status,
        error_message: errorMessage,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error logging key usage:', error);
    }
  }

  /**
   * Check for brute force detection
   */
  private async checkBruteForceDetection(
    ipAddress?: string,
    keyValue?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('is_brute_force_detected', {
        p_ip_address: ipAddress,
        p_key_value: keyValue,
      });

      if (error) throw error;
      return false;
    } catch (error) {
      console.error('Error checking brute force detection:', error);
      return false;
    }
  }

  /**
   * Check rate limit
   */
  private async checkRateLimit(ipAddress?: string): Promise<boolean> {
    try {
      if (!ipAddress) return false;

      // Get recent attempts from this IP
      const { data, error } = await supabase
        .from('key_validation_attempts')
        .select('id')
        .eq('ip_address', ipAddress)
        .gte('attempted_at', new Date(Date.now() - 60000).toISOString()) // Last minute
        .limit(this.rateLimitPerMinute);

      if (error) throw error;

      if (data && data.length >= this.rateLimitPerMinute) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return false;
    }
  }

  /**
   * Generate JWT token for subsequent requests
   */
  private generateToken(keyId: string, deviceId: string): string {
    // In production, use a proper JWT library like jsonwebtoken
    // For now, return a simple token
    const payload = {
      key_id: keyId,
      device_id: deviceId,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
    };

    const token = Buffer.from(JSON.stringify(payload)).toString('base64');
    return token;
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): { valid: boolean; key_id?: string; device_id?: string } {
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return { valid: false };
      }

      return {
        valid: true,
        key_id: payload.key_id,
        device_id: payload.device_id,
      };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Activate key on device
   */
  async activateKey(
    keyId: string,
    deviceId: string,
    deviceFingerprint: DeviceFingerprintType,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if key exists and is valid
      const key = await keyGeneratorService.getKeyById(keyId);
      
      if (!key) {
        return { success: false, error: 'Key not found.' };
      }

      const isValid = await this.isKeyValid(key);
      
      if (!isValid.is_valid) {
        return { success: false, error: isValid.reason };
      }

      // Check device binding
      const deviceCheck = await this.checkDeviceBinding(key, deviceId);
      
      if (!deviceCheck.allowed) {
        return { success: false, error: deviceCheck.reason };
      }

      // Create activation record
      const { error } = await supabase.from('key_activations').insert({
        key_id: keyId,
        device_id: deviceId,
        device_fingerprint: deviceFingerprint,
        ip_address: ipAddress,
        user_agent: userAgent,
        status: 'active',
        activated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Increment usage
      await this.incrementKeyUsage(keyId, deviceId);

      // Log activation
      await this.logKeyUsage(keyId, deviceId, 'activate', 'success');

      return { success: true };
    } catch (error) {
      console.error('Error activating key:', error);
      return { success: false, error: 'Internal server error.' };
    }
  }

  /**
   * Deactivate key on device
   */
  async deactivateKey(
    keyId: string,
    deviceId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('key_activations')
        .update({
          status: 'deactivated',
          deactivated_at: new Date().toISOString(),
        })
        .eq('key_id', keyId)
        .eq('device_id', deviceId);

      if (error) throw error;

      await this.logKeyUsage(keyId, deviceId, 'deactivate', 'success');

      return { success: true };
    } catch (error) {
      console.error('Error deactivating key:', error);
      return { success: false, error: 'Internal server error.' };
    }
  }

  /**
   * Get key activations
   */
  async getKeyActivations(keyId: string): Promise<KeyActivation[]> {
    try {
      const { data, error } = await supabase
        .from('key_activations')
        .select('*')
        .eq('key_id', keyId)
        .order('activated_at', { ascending: false });

      if (error) throw error;
      return (data as KeyActivation[]) || [];
    } catch (error) {
      console.error('Error getting key activations:', error);
      return [];
    }
  }

  /**
   * Get key usage logs
   */
  async getKeyUsageLogs(
    keyId: string,
    limit = 50
  ): Promise<KeyUsageLog[]> {
    try {
      const { data, error } = await supabase
        .from('key_usage_logs')
        .select('*')
        .eq('key_id', keyId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as KeyUsageLog[]) || [];
    } catch (error) {
      console.error('Error getting key usage logs:', error);
      return [];
    }
  }

  /**
   * Get validation statistics
   */
  async getValidationStats(keyId?: string): Promise<{
    total_attempts: number;
    successful_attempts: number;
    failed_attempts: number;
    unique_devices: number;
    unique_ips: number;
  }> {
    try {
      let query = supabase.from('key_validation_attempts').select('*');
      
      if (keyId) {
        const key = await keyGeneratorService.getKeyById(keyId);
        if (key) {
          // Get key hash and search (this would need to be implemented)
        }
      }

      const { data, error } = await query.order('attempted_at', { ascending: false });

      if (error) throw error;

      const attempts = data || [];
      const successful = attempts.filter(a => a.status === 'success').length;
      const failed = attempts.filter(a => a.status === 'failed').length;
      
      const uniqueDevices = new Set(attempts.map(a => a.device_id).filter(Boolean)).size;
      const uniqueIPs = new Set(attempts.map(a => a.ip_address).filter(Boolean)).size;

      return {
        total_attempts: attempts.length,
        successful_attempts: successful,
        failed_attempts: failed,
        unique_devices: uniqueDevices,
        unique_ips: uniqueIPs,
      };
    } catch (error) {
      console.error('Error getting validation stats:', error);
      return {
        total_attempts: 0,
        successful_attempts: 0,
        failed_attempts: 0,
        unique_devices: 0,
        unique_ips: 0,
      };
    }
  }
}

export const keyValidationService = new KeyValidationService();
