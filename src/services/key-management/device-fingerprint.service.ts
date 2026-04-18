// Device Fingerprint Engine for generating unique device IDs
import { supabase } from '@/lib/supabase';
import type {
  DeviceFingerprint,
  DeviceRecord,
  DeviceFingerprintOptions,
} from '@/types/key-management';
import crypto from 'crypto';

export class DeviceFingerprintService {
  /**
   * Generate device fingerprint from browser/client data
   */
  generateFingerprint(data: Partial<DeviceFingerprint>): string {
    const fingerprintData = {
      cpu: data.cpu || '',
      os: data.os || '',
      disk: data.disk || '',
      mac_hash: data.mac_hash || '',
      browser: data.browser || '',
      screen: data.screen || '',
      timezone: data.timezone || '',
      language: data.language || '',
      platform: data.platform || '',
      vendor: data.vendor || '',
      hardware_concurrency: data.hardware_concurrency || 0,
      device_memory: data.device_memory || 0,
    };

    const fingerprintString = JSON.stringify(fingerprintData);
    const hash = crypto.createHash('sha256').update(fingerprintString).digest('hex');
    return hash;
  }

  /**
   * Generate device ID from fingerprint
   */
  generateDeviceId(fingerprint: string): string {
    return `DEV-${fingerprint.substring(0, 16).toUpperCase()}`;
  }

  /**
   * Collect browser/device fingerprint data (client-side)
   * This would be called from the client application
   */
  async collectFingerprintData(): Promise<DeviceFingerprint> {
    // In a real implementation, this would collect actual browser data
    // For now, return a placeholder
    return {
      cpu: this.getCPUInfo(),
      os: this.getOSInfo(),
      disk: this.getDiskInfo(),
      mac_hash: this.getMacHash(),
      browser: this.getBrowserInfo(),
      screen: this.getScreenInfo(),
      timezone: this.getTimezone(),
      language: this.getLanguage(),
      platform: this.getPlatform(),
      vendor: this.getVendor(),
      hardware_concurrency: this.getHardwareConcurrency(),
      device_memory: this.getDeviceMemory(),
    };
  }

  /**
   * Get CPU info (placeholder)
   */
  private getCPUInfo(): string {
    // In production, use navigator.hardwareConcurrency or similar
    return 'unknown';
  }

  /**
   * Get OS info (placeholder)
   */
  private getOSInfo(): string {
    // In production, use navigator.userAgent
    return 'unknown';
  }

  /**
   * Get disk info (placeholder)
   */
  private getDiskInfo(): string {
    // In production, use File System API
    return 'unknown';
  }

  /**
   * Get MAC hash (placeholder)
   */
  private getMacHash(): string {
    // In production, use WebRTC or similar to get network info
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Get browser info
   */
  private getBrowserInfo(): string {
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent;
    }
    return 'unknown';
  }

  /**
   * Get screen info
   */
  private getScreenInfo(): string {
    if (typeof window !== 'undefined' && window.screen) {
      return `${window.screen.width}x${window.screen.height}`;
    }
    return 'unknown';
  }

  /**
   * Get timezone
   */
  private getTimezone(): string {
    if (typeof Intl !== 'undefined') {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    return 'unknown';
  }

  /**
   * Get language
   */
  private getLanguage(): string {
    if (typeof navigator !== 'undefined') {
      return navigator.language;
    }
    return 'unknown';
  }

  /**
   * Get platform
   */
  private getPlatform(): string {
    if (typeof navigator !== 'undefined') {
      return navigator.platform;
    }
    return 'unknown';
  }

  /**
   * Get vendor
   */
  private getVendor(): string {
    if (typeof navigator !== 'undefined') {
      return navigator.vendor;
    }
    return 'unknown';
  }

  /**
   * Get hardware concurrency
   */
  private getHardwareConcurrency(): number {
    if (typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator) {
      return navigator.hardwareConcurrency || 0;
    }
    return 0;
  }

  /**
   * Get device memory
   */
  private getDeviceMemory(): number {
    if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
      return navigator.deviceMemory || 0;
    }
    return 0;
  }

  /**
   * Register device fingerprint in database
   */
  async registerDevice(
    deviceId: string,
    fingerprint: DeviceFingerprint,
    metadata: Record<string, unknown> = {}
  ): Promise<DeviceRecord | null> {
    try {
      // Check if device already exists
      const existing = await this.getDeviceById(deviceId);
      
      if (existing) {
        // Update existing device
        const { data, error } = await supabase
          .from('device_fingerprints')
          .update({
            fingerprint,
            last_seen_at: new Date().toISOString(),
            seen_count: existing.seen_count + 1,
            metadata: { ...existing.metadata, ...metadata },
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data as DeviceRecord;
      }

      // Create new device record
      const { data, error } = await supabase
        .from('device_fingerprints')
        .insert({
          device_id: deviceId,
          fingerprint,
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          seen_count: 1,
          is_blocked: false,
          metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as DeviceRecord;
    } catch (error) {
      console.error('Error registering device:', error);
      return null;
    }
  }

  /**
   * Get device by ID
   */
  async getDeviceById(deviceId: string): Promise<DeviceRecord | null> {
    try {
      const { data, error } = await supabase
        .from('device_fingerprints')
        .select('*')
        .eq('device_id', deviceId)
        .single();

      if (error) throw error;
      return data as DeviceRecord;
    } catch (error) {
      console.error('Error getting device by ID:', error);
      return null;
    }
  }

  /**
   * Block device
   */
  async blockDevice(deviceId: string, reason: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('device_fingerprints')
        .update({
          is_blocked: true,
          block_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error blocking device:', error);
      return false;
    }
  }

  /**
   * Unblock device
   */
  async unblockDevice(deviceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('device_fingerprints')
        .update({
          is_blocked: false,
          block_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error unblocking device:', error);
      return false;
    }
  }

  /**
   * Check if device is blocked
   */
  async isDeviceBlocked(deviceId: string): Promise<boolean> {
    try {
      const device = await this.getDeviceById(deviceId);
      return device?.is_blocked || false;
    } catch (error) {
      console.error('Error checking if device is blocked:', error);
      return false;
    }
  }

  /**
   * Get all devices
   */
  async getAllDevices(filters?: {
    is_blocked?: boolean;
    limit?: number;
  }): Promise<DeviceRecord[]> {
    try {
      let query = supabase
        .from('device_fingerprints')
        .select('*')
        .order('last_seen_at', { ascending: false });

      if (filters?.is_blocked !== undefined) {
        query = query.eq('is_blocked', filters.is_blocked);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as DeviceRecord[]) || [];
    } catch (error) {
      console.error('Error getting all devices:', error);
      return [];
    }
  }

  /**
   * Get device statistics
   */
  async getDeviceStats(): Promise<{
    total_devices: number;
    active_devices: number;
    blocked_devices: number;
    unique_devices_this_month: number;
  }> {
    try {
      const [totalResult, blockedResult] = await Promise.all([
        supabase.from('device_fingerprints').select('id', { count: 'exact' }),
        supabase
          .from('device_fingerprints')
          .select('id', { count: 'exact' })
          .eq('is_blocked', true),
      ]);

      const total = totalResult.count || 0;
      const blocked = blockedResult.count || 0;

      // Get devices seen this month
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { count: thisMonth } = await supabase
        .from('device_fingerprints')
        .select('id', { count: 'exact' })
        .gte('first_seen_at', monthAgo.toISOString());

      return {
        total_devices: total,
        active_devices: total - blocked,
        blocked_devices: blocked,
        unique_devices_this_month: thisMonth || 0,
      };
    } catch (error) {
      console.error('Error getting device stats:', error);
      return {
        total_devices: 0,
        active_devices: 0,
        blocked_devices: 0,
        unique_devices_this_month: 0,
      };
    }
  }

  /**
   * Detect suspicious device activity
   */
  async detectSuspiciousActivity(deviceId: string): Promise<{
    is_suspicious: boolean;
    reasons: string[];
  }> {
    try {
      const device = await this.getDeviceById(deviceId);
      
      if (!device) {
        return { is_suspicious: false, reasons: [] };
      }

      const reasons: string[] = [];

      // Check if device is blocked
      if (device.is_blocked) {
        reasons.push('Device is blocked');
      }

      // Check for rapid device changes (multiple devices in short time)
      // This would need to be implemented with additional logic

      // Check for unusual patterns
      if (device.seen_count > 1000) {
        reasons.push('Unusually high activity');
      }

      return {
        is_suspicious: reasons.length > 0,
        reasons,
      };
    } catch (error) {
      console.error('Error detecting suspicious activity:', error);
      return { is_suspicious: false, reasons: [] };
    }
  }

  /**
   * Clean up old device records
   */
  async cleanupOldDevices(daysOld = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      
      const { error } = await supabase
        .from('device_fingerprints')
        .delete()
        .lt('last_seen_at', cutoffDate.toISOString())
        .eq('is_blocked', false);

      if (error) throw error;
      
      return 0; // Would return actual count in production
    } catch (error) {
      console.error('Error cleaning up old devices:', error);
      return 0;
    }
  }
}

export const deviceFingerprintService = new DeviceFingerprintService();
