// Auto Cleanup Cron System for Key Management
import { supabase } from '@/integrations/supabase/client';
import { keyGeneratorService } from './key-generator.service';
import { sessionTokenService } from './session-token.service';
import { deviceFingerprintService } from './device-fingerprint.service';

export interface CleanupResult {
  task: string;
  success: boolean;
  affected: number;
  error?: string;
}

export class AutoCleanupService {
  /**
   * Run all cleanup tasks
   */
  async runAllCleanupTasks(): Promise<CleanupResult[]> {
    const results: CleanupResult[] = [];

    // 1. Expire keys
    const expireKeysResult = await this.expireKeys();
    results.push(expireKeysResult);

    // 2. Clean up expired sessions
    const cleanupSessionsResult = await this.cleanupExpiredSessions();
    results.push(cleanupSessionsResult);

    // 3. Clean up old validation attempts
    const cleanupValidationAttemptsResult = await this.cleanupOldValidationAttempts();
    results.push(cleanupValidationAttemptsResult);

    // 4. Clean up old device records
    const cleanupDevicesResult = await this.cleanupOldDevices();
    results.push(cleanupDevicesResult);

    // 5. Clean up old usage logs
    const cleanupUsageLogsResult = await this.cleanupOldUsageLogs();
    results.push(cleanupUsageLogsResult);

    // 6. Clean up old activation records
    const cleanupActivationsResult = await this.cleanupOldActivations();
    results.push(cleanupActivationsResult);

    return results;
  }

  /**
   * Expire keys that have passed their expiry date
   */
  async expireKeys(): Promise<CleanupResult> {
    try {
      const { error } = await supabase.rpc('expire_keys');

      if (error) throw error;

      // Get count of expired keys
      const { count } = await supabase
        .from('keys')
        .select('id', { count: 'exact' })
        .eq('status', 'expired');

      return {
        task: 'expire_keys',
        success: true,
        affected: count || 0,
      };
    } catch (error) {
      console.error('Error expiring keys:', error);
      return {
        task: 'expire_keys',
        success: false,
        affected: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<CleanupResult> {
    try {
      const result = await sessionTokenService.cleanupExpiredSessions();

      return {
        task: 'cleanup_expired_sessions',
        success: true,
        affected: result,
      };
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return {
        task: 'cleanup_expired_sessions',
        success: false,
        affected: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clean up old validation attempts (older than 1 hour)
   */
  async cleanupOldValidationAttempts(): Promise<CleanupResult> {
    try {
      const cutoffDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      const { error, count } = await supabase
        .from('key_validation_attempts')
        .delete({ count: 'exact' })
        .lt('attempted_at', cutoffDate.toISOString());

      if (error) throw error;

      return {
        task: 'cleanup_old_validation_attempts',
        success: true,
        affected: count || 0,
      };
    } catch (error) {
      console.error('Error cleaning up old validation attempts:', error);
      return {
        task: 'cleanup_old_validation_attempts',
        success: false,
        affected: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clean up old device records (inactive for 90 days)
   */
  async cleanupOldDevices(daysOld = 90): Promise<CleanupResult> {
    try {
      const result = await deviceFingerprintService.cleanupOldDevices(daysOld);

      return {
        task: 'cleanup_old_devices',
        success: true,
        affected: result,
      };
    } catch (error) {
      console.error('Error cleaning up old devices:', error);
      return {
        task: 'cleanup_old_devices',
        success: false,
        affected: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clean up old usage logs (older than 90 days)
   */
  async cleanupOldUsageLogs(daysOld = 90): Promise<CleanupResult> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const { error, count } = await supabase
        .from('key_usage_logs')
        .delete({ count: 'exact' })
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;

      return {
        task: 'cleanup_old_usage_logs',
        success: true,
        affected: count || 0,
      };
    } catch (error) {
      console.error('Error cleaning up old usage logs:', error);
      return {
        task: 'cleanup_old_usage_logs',
        success: false,
        affected: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clean up old activation records (older than 180 days)
   */
  async cleanupOldActivations(daysOld = 180): Promise<CleanupResult> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const { error, count } = await supabase
        .from('key_activations')
        .delete({ count: 'exact' })
        .lt('activated_at', cutoffDate.toISOString());

      if (error) throw error;

      return {
        task: 'cleanup_old_activations',
        success: true,
        affected: count || 0,
      };
    } catch (error) {
      console.error('Error cleaning up old activations:', error);
      return {
        task: 'cleanup_old_activations',
        success: false,
        affected: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reset daily usage for all keys (run at midnight)
   */
  async resetDailyUsage(): Promise<CleanupResult> {
    try {
      const { error } = await supabase.rpc('reset_daily_ai_api_usage');

      if (error) throw error;

      // Also reset key daily usage
      const { error: keyError } = await supabase
        .from('keys')
        .update({
          daily_cost_today: 0,
          tokens_used_today: 0,
          requests_today: 0,
          updated_at: new Date().toISOString(),
        })
        .neq('daily_cost_today', 0);

      if (keyError) throw keyError;

      // Get count of affected keys
      const { count } = await supabase
        .from('keys')
        .select('id', { count: 'exact' })
        .neq('daily_cost_today', 0);

      return {
        task: 'reset_daily_usage',
        success: true,
        affected: count || 0,
      };
    } catch (error) {
      console.error('Error resetting daily usage:', error);
      return {
        task: 'reset_daily_usage',
        success: false,
        affected: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clean up soft-deleted records (older than 30 days)
   */
  async cleanupSoftDeletedRecords(daysOld = 30): Promise<CleanupResult> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      let totalAffected = 0;

      // Clean up soft-deleted keys
      const { count: keysCount, error: keysError } = await supabase
        .from('keys')
        .delete({ count: 'exact' })
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoffDate.toISOString());

      if (keysError) throw keysError;
      totalAffected += keysCount || 0;

      // Clean up soft-deleted sessions (if we implement soft delete for sessions)
      // Similar pattern for other tables

      return {
        task: 'cleanup_soft_deleted_records',
        success: true,
        affected: totalAffected,
      };
    } catch (error) {
      console.error('Error cleaning up soft-deleted records:', error);
      return {
        task: 'cleanup_soft_deleted_records',
        success: false,
        affected: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Archive old data to cold storage (for compliance)
   */
  async archiveOldData(daysOld = 365): Promise<CleanupResult> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      // In production, this would move data to a cold storage table or S3
      // For now, we'll just count what would be archived

      const { count: usageLogsCount } = await supabase
        .from('key_usage_logs')
        .select('id', { count: 'exact' })
        .lt('created_at', cutoffDate.toISOString());

      const { count: activationsCount } = await supabase
        .from('key_activations')
        .select('id', { count: 'exact' })
        .lt('activated_at', cutoffDate.toISOString());

      const totalAffected = (usageLogsCount || 0) + (activationsCount || 0);

      return {
        task: 'archive_old_data',
        success: true,
        affected: totalAffected,
      };
    } catch (error) {
      console.error('Error archiving old data:', error);
      return {
        task: 'archive_old_data',
        success: false,
        affected: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check for anomalies (suspicious activity)
   */
  async checkAnomalies(): Promise<{
    task: string;
    success: boolean;
    anomalies: {
      type: string;
      count: number;
      description: string;
    }[];
  }> {
    try {
      const anomalies: {
        type: string;
        count: number;
        description: string;
      }[] = [];

      // Check for keys with high fail count
      const { data: highFailKeys } = await supabase
        .from('keys')
        .select('id, fail_count')
        .gt('fail_count', 10);

      if (highFailKeys && highFailKeys.length > 0) {
        anomalies.push({
          type: 'high_fail_count',
          count: highFailKeys.length,
          description: `${highFailKeys.length} keys with high fail count`,
        });
      }

      // Check for devices with many activation attempts
      const { data: suspiciousDevices } = await supabase
        .from('key_validation_attempts')
        .select('device_id')
        .gte('attempted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .group('device_id')
        .having('count', '>', '100');

      if (suspiciousDevices && suspiciousDevices.length > 0) {
        anomalies.push({
          type: 'suspicious_device_activity',
          count: suspiciousDevices.length,
          description: `${suspiciousDevices.length} devices with high activity`,
        });
      }

      return {
        task: 'check_anomalies',
        success: true,
        anomalies,
      };
    } catch (error) {
      console.error('Error checking anomalies:', error);
      return {
        task: 'check_anomalies',
        success: false,
        anomalies: [],
      };
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    total_keys: number;
    expired_keys: number;
    active_sessions: number;
    expired_sessions: number;
    total_validation_attempts: number;
    old_validation_attempts: number;
    total_devices: number;
    old_devices: number;
  }> {
    try {
      const [
        totalKeysResult,
        expiredKeysResult,
        activeSessionsResult,
        totalValidationAttemptsResult,
        oldValidationAttemptsResult,
        totalDevicesResult,
        oldDevicesResult,
      ] = await Promise.all([
        supabase.from('keys').select('id', { count: 'exact' }),
        supabase
          .from('keys')
          .select('id', { count: 'exact' })
          .eq('status', 'expired'),
        supabase
          .from('sessions')
          .select('id', { count: 'exact' })
          .eq('is_active', true),
        supabase.from('key_validation_attempts').select('id', { count: 'exact' }),
        supabase
          .from('key_validation_attempts')
          .select('id', { count: 'exact' })
          .lt('attempted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()),
        supabase.from('device_fingerprints').select('id', { count: 'exact' }),
        supabase
          .from('device_fingerprints')
          .select('id', { count: 'exact' })
          .lt('last_seen_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const expiredSessionsCount = (totalKeysResult.count || 0) - (activeSessionsResult.count || 0);

      return {
        total_keys: totalKeysResult.count || 0,
        expired_keys: expiredKeysResult.count || 0,
        active_sessions: activeSessionsResult.count || 0,
        expired_sessions: expiredSessionsCount,
        total_validation_attempts: totalValidationAttemptsResult.count || 0,
        old_validation_attempts: oldValidationAttemptsResult.count || 0,
        total_devices: totalDevicesResult.count || 0,
        old_devices: oldDevicesResult.count || 0,
      };
    } catch (error) {
      console.error('Error getting cleanup stats:', error);
      return {
        total_keys: 0,
        expired_keys: 0,
        active_sessions: 0,
        expired_sessions: 0,
        total_validation_attempts: 0,
        old_validation_attempts: 0,
        total_devices: 0,
        old_devices: 0,
      };
    }
  }

  /**
   * Run scheduled cleanup (for cron job)
   */
  async runScheduledCleanup(): Promise<{
    success: boolean;
    results: CleanupResult[];
  }> {
    try {
      const results = await this.runAllCleanupTasks();

      const successCount = results.filter(r => r.success).length;

      return {
        success: successCount === results.length,
        results,
      };
    } catch (error) {
      console.error('Error running scheduled cleanup:', error);
      return {
        success: false,
        results: [],
      };
    }
  }
}

export const autoCleanupService = new AutoCleanupService();
