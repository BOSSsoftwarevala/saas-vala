// License Activation Server - Central API for key activation
import { supabase } from '@/lib/supabase';
import type {
  Key,
  KeyValidationRequest,
  KeyValidationResponse,
  DeviceFingerprint,
} from '@/types/key-management';
import { keyValidationService } from './key-validation.service';
import { deviceFingerprintService } from './device-fingerprint.service';
import { sessionTokenService } from './session-token.service';

export interface ActivationRequest {
  key_value: string;
  device_id: string;
  device_fingerprint?: DeviceFingerprint;
  ip_address?: string;
  user_agent?: string;
  user_id?: string;
}

export interface ActivationResponse {
  success: boolean;
  token?: string;
  key_id?: string;
  product_id?: string;
  expiry_date?: string;
  error?: string;
  message?: string;
}

export class LicenseActivationService {
  /**
   * Activate license key on device
   */
  async activateLicense(request: ActivationRequest): Promise<ActivationResponse> {
    try {
      // Validate key first
      const validationRequest: KeyValidationRequest = {
        key_value: request.key_value,
        device_id: request.device_id,
        device_fingerprint: request.device_fingerprint,
        ip_address: request.ip_address,
        user_agent: request.user_agent,
      };

      const validation = await keyValidationService.validateKey(validationRequest);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Invalid key',
        };
      }

      // Register device fingerprint
      if (request.device_fingerprint) {
        const fingerprint = deviceFingerprintService.generateFingerprint(request.device_fingerprint);
        const deviceId = deviceFingerprintService.generateDeviceId(fingerprint);
        
        await deviceFingerprintService.registerDevice(
          deviceId,
          request.device_fingerprint
        );
      }

      // Activate key on device
      const activationResult = await keyValidationService.activateKey(
        validation.key_id!,
        request.device_id,
        request.device_fingerprint || {},
        request.ip_address,
        request.user_agent
      );

      if (!activationResult.success) {
        return {
          success: false,
          error: activationResult.error || 'Failed to activate key',
        };
      }

      // Create session and generate token
      const sessionResult = await sessionTokenService.createSession(
        validation.key_id!,
        request.device_id,
        request.user_id,
        request.ip_address,
        request.user_agent
      );

      if (!sessionResult.success) {
        return {
          success: false,
          error: 'Failed to create session',
        };
      }

      return {
        success: true,
        token: sessionResult.token,
        key_id: validation.key_id,
        product_id: validation.product_id,
        expiry_date: validation.expiry_date,
        message: 'License activated successfully',
      };
    } catch (error) {
      console.error('Error activating license:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Validate license (check if still valid)
   */
  async validateLicense(token: string): Promise<{
    valid: boolean;
    key_id?: string;
    device_id?: string;
    expiry_date?: string;
    error?: string;
  }> {
    try {
      // Validate token
      const tokenValidation = await sessionTokenService.validateToken(token);

      if (!tokenValidation.valid) {
        return {
          valid: false,
          error: tokenValidation.error || 'Invalid token',
        };
      }

      // Check key status
      const key = await this.getKeyById(tokenValidation.session!.key_id);

      if (!key) {
        return {
          valid: false,
          error: 'Key not found',
        };
      }

      // Check if key is still valid
      if (key.status !== 'active') {
        return {
          valid: false,
          error: `Key is ${key.status}`,
        };
      }

      // Check expiry
      if (key.expiry_date) {
        const expiryDate = new Date(key.expiry_date);
        const gracePeriodEnd = new Date(
          expiryDate.getTime() + key.grace_period_days * 24 * 60 * 60 * 1000
        );

        if (new Date() > gracePeriodEnd) {
          return {
            valid: false,
            error: 'Key has expired',
          };
        }
      }

      return {
        valid: true,
        key_id: key.id,
        device_id: tokenValidation.session!.device_id,
        expiry_date: key.expiry_date,
      };
    } catch (error) {
      console.error('Error validating license:', error);
      return {
        valid: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Deactivate license on device
   */
  async deactivateLicense(
    keyId: string,
    deviceId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Deactivate key on device
      const result = await keyValidationService.deactivateKey(keyId, deviceId);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to deactivate key',
        };
      }

      // Deactivate sessions for this device
      await sessionTokenService.deactivateAllSessionsForDevice(deviceId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deactivating license:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Refresh license token
   */
  async refreshLicenseToken(oldToken: string): Promise<{
    success: boolean;
    token?: string;
    error?: string;
  }> {
    try {
      const result = await sessionTokenService.refreshToken(oldToken);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to refresh token',
        };
      }

      return {
        success: true,
        token: result.token,
      };
    } catch (error) {
      console.error('Error refreshing license token:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Get license info
   */
  async getLicenseInfo(keyId: string): Promise<{
    success: boolean;
    license?: {
      key_id: string;
      product_id: string;
      type: string;
      status: string;
      expiry_date?: string;
      usage_limit: number;
      used_count: number;
      remaining_uses: number;
      device_bindings: string[];
    };
    error?: string;
  }> {
    try {
      const key = await this.getKeyById(keyId);

      if (!key) {
        return {
          success: false,
          error: 'Key not found',
        };
      }

      return {
        success: true,
        license: {
          key_id: key.id,
          product_id: key.product_id,
          type: key.type,
          status: key.status,
          expiry_date: key.expiry_date,
          usage_limit: key.usage_limit,
          used_count: key.used_count,
          remaining_uses: key.usage_limit - key.used_count,
          device_bindings: key.device_bindings,
        },
      };
    } catch (error) {
      console.error('Error getting license info:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Get key by ID
   */
  private async getKeyById(keyId: string): Promise<Key | null> {
    try {
      const { data, error } = await supabase
        .from('keys')
        .select('*')
        .eq('id', keyId)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return data as Key;
    } catch (error) {
      console.error('Error getting key by ID:', error);
      return null;
    }
  }

  /**
   * Revoke license
   */
  async revokeLicense(
    keyId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Revoke key
      const { error } = await supabase
        .from('keys')
        .update({
          status: 'revoked',
          notes: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', keyId);

      if (error) throw error;

      // Deactivate all sessions for this key
      await sessionTokenService.deactivateAllSessionsForKey(keyId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error revoking license:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Get license usage statistics
   */
  async getLicenseStats(keyId: string): Promise<{
    success: boolean;
    stats?: {
      total_activations: number;
      active_activations: number;
      unique_devices: number;
      total_usage_logs: number;
      last_used_at?: string;
    };
    error?: string;
  }> {
    try {
      // Get activations
      const { data: activations } = await supabase
        .from('key_activations')
        .select('*')
        .eq('key_id', keyId);

      // Get usage logs
      const { data: usageLogs } = await supabase
        .from('key_usage_logs')
        .select('*')
        .eq('key_id', keyId);

      // Get key
      const key = await this.getKeyById(keyId);

      if (!key) {
        return {
          success: false,
          error: 'Key not found',
        };
      }

      const uniqueDevices = new Set(
        activations?.map(a => a.device_id) || []
      ).size;

      return {
        success: true,
        stats: {
          total_activations: activations?.length || 0,
          active_activations:
            activations?.filter(a => a.status === 'active').length || 0,
          unique_devices,
          total_usage_logs: usageLogs?.length || 0,
          last_used_at: key.last_verified_at,
        },
      };
    } catch (error) {
      console.error('Error getting license stats:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Health check for activation server
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: {
      database: 'healthy' | 'unhealthy';
      key_validation: 'healthy' | 'unhealthy';
      session_service: 'healthy' | 'unhealthy';
    };
  }> {
    try {
      // Check database connection
      let dbHealthy = 'unhealthy';
      try {
        await supabase.from('keys').select('id').limit(1);
        dbHealthy = 'healthy';
      } catch (error) {
        dbHealthy = 'unhealthy';
      }

      // Check key validation service
      const keyValidationHealthy = 'healthy'; // Would need actual check

      // Check session service
      const sessionServiceHealthy = 'healthy'; // Would need actual check

      const overallStatus =
        dbHealthy === 'healthy' ? 'healthy' : 'unhealthy';

      return {
        status: overallStatus,
        checks: {
          database: dbHealthy,
          key_validation: keyValidationHealthy,
          session_service: sessionServiceHealthy,
        },
      };
    } catch (error) {
      console.error('Error during health check:', error);
      return {
        status: 'unhealthy',
        checks: {
          database: 'unhealthy',
          key_validation: 'unhealthy',
          session_service: 'unhealthy',
        },
      };
    }
  }

  /**
   * Batch activate licenses (for bulk operations)
   */
  async batchActivateLicenses(
    requests: ActivationRequest[]
  ): Promise<{ success: boolean; results: ActivationResponse[] }> {
    const results: ActivationResponse[] = [];

    for (const request of requests) {
      const result = await this.activateLicense(request);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;

    return {
      success: successCount === requests.length,
      results,
    };
  }

  /**
   * Get all active licenses for a user
   */
  async getUserLicenses(userId: string): Promise<{
    success: boolean;
    licenses?: Array<{
      key_id: string;
      product_id: string;
      type: string;
      status: string;
      expiry_date?: string;
      device_bindings: string[];
    }>;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('keys')
        .select('*')
        .eq('assigned_user_id', userId)
        .is('deleted_at', null)
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      const licenses = (data as Key[]).map(key => ({
        key_id: key.id,
        product_id: key.product_id,
        type: key.type,
        status: key.status,
        expiry_date: key.expiry_date,
        device_bindings: key.device_bindings,
      }));

      return {
        success: true,
        licenses,
      };
    } catch (error) {
      console.error('Error getting user licenses:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }
}

export const licenseActivationService = new LicenseActivationService();
