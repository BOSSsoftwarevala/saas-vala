// Key Management System Types

export type KeyType = 'api' | 'feature' | 'license';
export type KeySize = 'nano' | 'micro' | 'standard';
export type KeyStatus = 'active' | 'suspended' | 'expired' | 'revoked';
export type ActivationStatus = 'active' | 'deactivated' | 'blocked';
export type UsageLogStatus = 'success' | 'failed' | 'blocked';

export interface Key {
  id: string;
  product_id: string;
  key_value: string; // Encrypted
  key_hash: string; // Hashed for verification
  type: KeyType;
  key_size: KeySize;
  prefix: string;
  checksum: string;
  
  // Usage control
  usage_limit: number;
  used_count: number;
  device_bindings: string[]; // Array of device IDs
  
  // Status
  status: KeyStatus;
  expiry_date?: string;
  grace_period_days: number;
  
  // Owner info
  owner_name?: string;
  owner_email?: string;
  assigned_user_id?: string;
  assigned_at?: string;
  
  // Security
  last_verified_at?: string;
  last_device_id?: string;
  ip_restrictions: string[];
  geo_restrictions: string[];
  
  // Metadata
  metadata: Record<string, unknown>;
  notes?: string;
  
  // Soft delete
  deleted_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface KeyActivation {
  id: string;
  key_id: string;
  user_id?: string;
  device_id: string;
  device_fingerprint: DeviceFingerprint;
  ip_address?: string;
  user_agent?: string;
  location: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  status: ActivationStatus;
  activated_at: string;
  deactivated_at?: string;
  last_verified_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KeyUsageLog {
  id: string;
  key_id: string;
  activation_id?: string;
  user_id?: string;
  device_id?: string;
  action: string; // verify, activate, deactivate, use, etc.
  status: UsageLogStatus;
  error_message?: string;
  ip_address?: string;
  user_agent?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DeviceFingerprint {
  cpu?: string;
  os?: string;
  disk?: string;
  mac_hash?: string;
  browser?: string;
  screen?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  vendor?: string;
  hardware_concurrency?: number;
  device_memory?: number;
}

export interface DeviceRecord {
  id: string;
  device_id: string;
  fingerprint: DeviceFingerprint;
  first_seen_at: string;
  last_seen_at: string;
  seen_count: number;
  is_blocked: boolean;
  block_reason?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KeyValidationAttempt {
  id: string;
  key_value: string;
  device_id?: string;
  ip_address?: string;
  status: 'success' | 'failed';
  attempted_at: string;
  metadata: Record<string, unknown>;
}

export interface KeyGenerationRequest {
  product_id: string;
  type: KeyType;
  key_size: KeySize;
  expiry_date?: string;
  usage_limit: number;
  owner_name?: string;
  owner_email?: string;
  prefix?: string;
  metadata?: Record<string, unknown>;
}

export interface KeyValidationRequest {
  key_value: string;
  device_id: string;
  device_fingerprint?: DeviceFingerprint;
  ip_address?: string;
  user_agent?: string;
}

export interface KeyValidationResponse {
  valid: boolean;
  key_id?: string;
  product_id?: string;
  user_id?: string;
  status: KeyStatus;
  error?: string;
  token?: string; // JWT token for subsequent requests
  expiry_date?: string;
  usage_limit: number;
  used_count: number;
  remaining_uses: number;
  device_bindings: string[];
  is_new_device: boolean;
}

export interface KeyAssignmentRequest {
  key_id: string;
  user_id: string;
}

export interface KeyAssignmentResponse {
  success: boolean;
  key_id?: string;
  user_id?: string;
  assigned_at?: string;
  error?: string;
}

export interface KeyStats {
  total_keys: number;
  active_keys: number;
  suspended_keys: number;
  expired_keys: number;
  assigned_keys: number;
  unassigned_keys: number;
  total_activations: number;
  total_usage_logs: number;
  by_type: {
    api: number;
    feature: number;
    license: number;
  };
  by_status: {
    active: number;
    suspended: number;
    expired: number;
    revoked: number;
  };
}

export interface DeviceStats {
  total_devices: number;
  active_devices: number;
  blocked_devices: number;
  unique_devices_this_month: number;
}

export interface SecurityMetrics {
  total_validation_attempts: number;
  failed_validation_attempts: number;
  brute_force_attempts_blocked: number;
  suspicious_activities: number;
  blocked_ips: string[];
  rate_limit_violations: number;
}

// Key size configurations
export const KEY_SIZE_CONFIG = {
  nano: 16,
  micro: 32,
  standard: 64,
} as const;

// Default prefixes
export const DEFAULT_PREFIXES = {
  api: 'API',
  feature: 'FEA',
  license: 'VALA',
} as const;

// Key generation options
export interface KeyGenerationOptions {
  prefix?: string;
  include_checksum: boolean;
  use_encryption: boolean;
  custom_length?: number;
}

// Device fingerprint options
export interface DeviceFingerprintOptions {
  include_cpu: boolean;
  include_os: boolean;
  include_disk: boolean;
  include_mac: boolean;
  include_browser: boolean;
  include_screen: boolean;
}

// Security settings
export interface SecuritySettings {
  max_failed_attempts: number;
  brute_force_window_minutes: number;
  rate_limit_per_minute: number;
  rate_limit_per_hour: number;
  enable_ip_blocking: boolean;
  enable_geo_blocking: boolean;
  block_on_suspicious_activity: boolean;
}

// Validation result
export interface ValidationResult {
  is_valid: boolean;
  reason?: string;
  key?: Key;
  activation?: KeyActivation;
  security_flags: {
    is_new_device: boolean;
    is_suspicious: boolean;
    is_brute_force_detected: boolean;
    is_geo_blocked: boolean;
    is_ip_blocked: boolean;
  };
}
