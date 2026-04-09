import { supabase } from '@/integrations/supabase/client';

interface OfflineKeyPayload {
  v: 1;
  p: string;
  t: number;
  r?: string | null;
  a?: string | null;
  n: string;
}

export interface SecureOfflineKeyBundle {
  key: string;
  signature: string;
  payload: OfflineKeyPayload;
}

function toBase64Url(input: string): string {
  return input.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): string {
  const padded = `${input}${'='.repeat((4 - (input.length % 4 || 4)) % 4)}`;
  return padded.replace(/-/g, '+').replace(/_/g, '/');
}

function encodePayload(payload: OfflineKeyPayload): string {
  return toBase64Url(btoa(JSON.stringify(payload)));
}

function decodePayload(payloadEncoded: string): OfflineKeyPayload | null {
  try {
    const raw = atob(fromBase64Url(payloadEncoded));
    const parsed = JSON.parse(raw) as OfflineKeyPayload;
    if (!parsed || parsed.v !== 1 || !parsed.p || !parsed.t || !parsed.n) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function randomNonce(length = 24): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a cryptographically random license key in XXXX-XXXX-XXXX-XXXX format.
 * Uses rejection sampling to avoid modulo bias.
 */
export function generateSecureLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const charLen = chars.length; // 36
  // Largest multiple of charLen that fits in a byte (0-255): floor(256/36)*36 = 252
  const maxValid = Math.floor(256 / charLen) * charLen;

  const result: string[] = [];
  const totalChars = 16; // 4 segments × 4 chars

  while (result.length < totalChars) {
    const bytes = crypto.getRandomValues(new Uint8Array(totalChars));
    for (const byte of bytes) {
      // Rejection sampling: skip bytes that would introduce bias
      if (byte < maxValid) {
        result.push(chars[byte % charLen]);
        if (result.length === totalChars) break;
      }
    }
  }

  return [
    result.slice(0, 4).join(''),
    result.slice(4, 8).join(''),
    result.slice(8, 12).join(''),
    result.slice(12, 16).join(''),
  ].join('-');
}

/**
 * Generate a signature for the license key using HMAC-SHA256.
 * This allows offline verification without revealing the secret.
 */
export async function generateKeySignature(key: string, secret: string = 'vala-secret-key'): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(key);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Verify a license key signature offline.
 */
export async function verifyKeySignature(key: string, signature: string, secret: string = 'vala-secret-key'): Promise<boolean> {
  try {
    const expected = await generateKeySignature(key, secret);
    return expected === signature;
  } catch {
    return false;
  }
}

export async function generateSecureOfflineLicenseKey(input: {
  productId: string;
  resellerId?: string | null;
  assignedTo?: string | null;
}): Promise<SecureOfflineKeyBundle> {
  const payload: OfflineKeyPayload = {
    v: 1,
    p: input.productId,
    t: Date.now(),
    r: input.resellerId || null,
    a: input.assignedTo || null,
    n: randomNonce(16),
  };

  const payloadEncoded = encodePayload(payload);
  const signature = await generateKeySignature(payloadEncoded);
  const key = `V1.${payloadEncoded}.${toBase64Url(signature)}`;

  return {
    key,
    signature,
    payload,
  };
}

export async function verifySecureOfflineLicenseKey(key: string): Promise<boolean> {
  try {
    if (!key.startsWith('V1.')) return false;
    const parts = key.split('.');
    if (parts.length !== 3) return false;

    const [, payloadEncoded, embeddedSignature] = parts;
    const payload = decodePayload(payloadEncoded);
    if (!payload) return false;

    const expectedSignature = await generateKeySignature(payloadEncoded);
    return toBase64Url(expectedSignature) === embeddedSignature;
  } catch {
    return false;
  }
}

export function decodeSecureOfflineLicenseKey(key: string): OfflineKeyPayload | null {
  if (!key.startsWith('V1.')) return null;
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  return decodePayload(parts[1]);
}

export async function generateTemporaryDownloadLink(input: {
  productId: string;
  transactionId: string;
  userId: string;
  ttlSeconds?: number;
}): Promise<string> {
  const ttlSeconds = Math.max(60, Number(input.ttlSeconds || 600));
  const exp = Date.now() + ttlSeconds * 1000;
  const nonce = randomNonce(8);
  const payload = `${input.productId}:${input.transactionId}:${input.userId}:${exp}:${nonce}`;
  const signature = await generateKeySignature(payload);
  const token = toBase64Url(btoa(`${payload}:${signature}`));

  return `/download/apk/${encodeURIComponent(input.productId)}?token=${encodeURIComponent(token)}&exp=${exp}`;
}

/**
 * Validate a license key offline (checks format and signature).
 * For full validation, still needs DB check for status/expiry.
 */
export async function validateLicenseKeyOffline(key: string, signature: string): Promise<boolean> {
  if (key.startsWith('V1.')) {
    return verifySecureOfflineLicenseKey(key);
  }

  // Check format
  const keyRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!keyRegex.test(key)) return false;

  // Verify signature
  return await verifyKeySignature(key, signature);
}

interface LicenseValidationResult {
  valid: boolean;
  expiresAt?: string;
  error?: string;
}

interface ClientBindingContext {
  userId: string | null;
  deviceId: string;
}

function isBlacklistedLicenseRow(row: any): boolean {
  return (
    row?.key_status === 'blocked' ||
    row?.status === 'blocked' ||
    row?.meta?.blacklisted === true
  );
}

async function safeWriteVerificationLog(licenseKey: string, result: string, reason?: string) {
  try {
    await (supabase as any)
      .from('license_verification_logs')
      .insert({
        license_key: licenseKey,
        result,
        reason: reason || null,
        created_at: new Date().toISOString(),
      });
  } catch {
    // Best-effort logging only; validation flow should not fail if this write is denied.
  }
}

function getOrCreateClientDeviceId(): string {
  if (typeof window === 'undefined') {
    return `server-${randomNonce(8)}`;
  }

  const storageKey = 'saasvala-client-device-id';
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;

  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `device-${crypto.randomUUID()}`
    : `device-${randomNonce(12)}`;

  window.localStorage.setItem(storageKey, generated);
  return generated;
}

async function getClientBindingContext(): Promise<ClientBindingContext> {
  let userId: string | null = null;

  try {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user?.id || null;
  } catch {
    userId = null;
  }

  return {
    userId,
    deviceId: getOrCreateClientDeviceId(),
  };
}

async function bindLicenseOnFirstUse(licenseRow: any, licenseKey: string): Promise<{ valid: boolean; error?: string }> {
  const context = await getClientBindingContext();
  const existingUserId = licenseRow.user_id || null;
  const existingDeviceId = licenseRow.device_id || null;

  if (existingUserId && context.userId && existingUserId !== context.userId) {
    await safeWriteVerificationLog(licenseKey, 'invalid', 'bound_to_different_user');
    return { valid: false, error: 'This license key is assigned to a different user.' };
  }

  if (existingDeviceId && existingDeviceId !== context.deviceId) {
    await safeWriteVerificationLog(licenseKey, 'invalid', 'bound_to_different_device');
    return { valid: false, error: 'This license key is already activated on a different device.' };
  }

  const shouldAssignBinding = licenseRow.key_status === 'unused' || !existingUserId || !existingDeviceId;
  if (!shouldAssignBinding) {
    return { valid: true };
  }

  const nowIso = new Date().toISOString();
  const nextActivatedDevices = Math.max(1, Number(licenseRow.activated_devices || 0));
  const nextMeta = {
    ...(licenseRow.meta || {}),
    first_use_bound_at: nowIso,
    first_use_user_id: existingUserId || context.userId || null,
    first_use_device_id: existingDeviceId || context.deviceId,
  };

  const updatePayload = {
    key_status: 'active',
    status: 'active',
    user_id: existingUserId || context.userId || null,
    device_id: existingDeviceId || context.deviceId,
    activated_at: licenseRow.activated_at || nowIso,
    last_validated_at: nowIso,
    activated_devices: nextActivatedDevices,
    meta: nextMeta,
  };

  const { error: updateError } = await (supabase as any)
    .from('license_keys')
    .update(updatePayload)
    .eq('id', licenseRow.id);

  if (updateError) {
    await safeWriteVerificationLog(licenseKey, 'invalid', 'first_use_binding_failed');
    return { valid: false, error: 'Unable to activate this license key on first use.' };
  }

  try {
    await (supabase as any).from('license_activations').insert({
      license_key_id: licenseRow.id,
      device_id: existingDeviceId || context.deviceId,
      activated_at: nowIso,
      activated_by: context.userId,
    });
  } catch {
    // Best-effort activation history only.
  }

  return { valid: true };
}

/**
 * Validate a license key against the database.
 * Returns the license expiry date if valid so it can be cached locally.
 */
export async function validateLicenseKeyInDb(key: string): Promise<LicenseValidationResult> {
  try {
    const trimmed = key.trim().toUpperCase();
    if (!trimmed) {
      return { valid: false, error: 'License key is required.' };
    }

    if (trimmed.startsWith('V1.')) {
      const offlineValid = await verifySecureOfflineLicenseKey(trimmed);
      if (!offlineValid) {
        await safeWriteVerificationLog(trimmed, 'invalid', 'offline_signature_invalid');
        return { valid: false, error: 'License key signature is invalid.' };
      }
    }

    const bruteForceSince = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: recentFailedAttempts } = await (supabase as any)
      .from('license_verification_logs')
      .select('id', { count: 'exact', head: true })
      .eq('license_key', trimmed)
      .in('result', ['invalid', 'not_found', 'blocked', 'revoked', 'rate_limited'])
      .gte('created_at', bruteForceSince);

    if ((recentFailedAttempts || 0) >= 10) {
      await safeWriteVerificationLog(trimmed, 'rate_limited', 'too_many_failed_attempts');
      return { valid: false, error: 'Too many failed attempts. Please try again later.' };
    }

    const { data, error } = await (supabase as any)
      .from('license_keys')
      .select('id, status, key_status, expires_at, meta, user_id, device_id, activated_at, activated_devices')
      .eq('license_key', trimmed)
      .maybeSingle();

    if (error) {
      await safeWriteVerificationLog(trimmed, 'invalid', 'database_error');
      // Network or DB error — don't reject as "invalid key"
      return { valid: false, error: 'Unable to verify license key. Please check your connection and try again.' };
    }

    if (!data) {
      await safeWriteVerificationLog(trimmed, 'not_found', 'license_not_found');
      return { valid: false, error: 'Invalid license key. Please purchase a valid license.' };
    }

    if (isBlacklistedLicenseRow(data)) {
      await safeWriteVerificationLog(trimmed, 'blocked', 'license_blacklisted');
      return { valid: false, error: 'This license key has been blacklisted.' };
    }

    if ((data as any).key_status === 'revoked' || data.status === 'revoked') {
      await safeWriteVerificationLog(trimmed, 'revoked', 'license_revoked');
      return { valid: false, error: 'This license key has been revoked.' };
    }

    if ((data as any).key_status === 'expired' || data.status === 'expired') {
      await safeWriteVerificationLog(trimmed, 'expired', 'license_status_expired');
      return { valid: false, error: 'This license key has expired. Please contact your reseller to purchase a new key.' };
    }

    if (data.status && data.status !== 'active') {
      await safeWriteVerificationLog(trimmed, 'revoked', `inactive_status:${data.status}`);
      return { valid: false, error: 'This license key is not active.' };
    }

    const now = new Date();
    if (data.expires_at && new Date(data.expires_at) < now) {
      await safeWriteVerificationLog(trimmed, 'expired', 'license_expired');
      return { valid: false, error: 'This license key has expired. Please contact your reseller to purchase a new key.' };
    }

    const bindingResult = await bindLicenseOnFirstUse(data, trimmed);
    if (!bindingResult.valid) {
      return { valid: false, error: bindingResult.error || 'Unable to activate this license key.' };
    }

    await safeWriteVerificationLog(trimmed, 'valid', 'license_valid');

    return { valid: true, expiresAt: data.expires_at ?? undefined };
  } catch {
    return { valid: false, error: 'Unable to verify license key. Please check your connection and try again.' };
  }
}
