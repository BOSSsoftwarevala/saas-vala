import { supabase } from '@/integrations/supabase/client';

interface OfflineKeyPayload {
  v: 1 | 2;
  p: string;
  t: number;
  pd?: string | null;
  e?: string | null;
  dl?: number;
  iat?: number;
  r?: string | null;
  a?: string | null;
  c?: string;
  n: string;
}

export interface SecureOfflineKeyBundle {
  key: string;
  signature: string;
  payload: OfflineKeyPayload;
  displayCode: string;
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
    const validVersion = parsed?.v === 1 || parsed?.v === 2;
    if (!parsed || !validVersion || !parsed.p || !parsed.t || !parsed.n) {
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
  planDuration?: string | null;
  expiresAt?: string | null;
  deviceLimit?: number;
}): Promise<SecureOfflineKeyBundle> {
  const issuedAt = Date.now();
  const displayCode = generateSecureLicenseKey();
  const payload: OfflineKeyPayload = {
    v: 2,
    p: input.productId,
    t: issuedAt,
    pd: input.planDuration || null,
    e: input.expiresAt || null,
    dl: Math.max(1, Number(input.deviceLimit || 1)),
    iat: issuedAt,
    r: input.resellerId || null,
    a: input.assignedTo || null,
    c: displayCode,
    n: randomNonce(16),
  };

  const payloadEncoded = encodePayload(payload);
  const signature = await generateKeySignature(payloadEncoded);
  const key = `V2.${payloadEncoded}.${toBase64Url(signature)}`;

  return {
    key,
    signature,
    payload,
    displayCode,
  };
}

export async function verifySecureOfflineLicenseKey(key: string): Promise<boolean> {
  try {
    if (!key.startsWith('V1.') && !key.startsWith('V2.')) return false;
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
  if (!key.startsWith('V1.') && !key.startsWith('V2.')) return null;
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

interface ValidationRuntimeSignals {
  isRooted?: boolean;
  isEmulator?: boolean;
  isDebuggerAttached?: boolean;
  currentTimeMs?: number;
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

function getMonotonicClockStorageKey(productId?: string): string {
  const suffix = productId ? String(productId) : 'global';
  return `saasvala-license-last-validated:${suffix}`;
}

function detectClockRollback(productId: string | undefined, currentTimeMs?: number): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const now = Number(currentTimeMs || Date.now());
    const key = getMonotonicClockStorageKey(productId);
    const previous = Number(window.localStorage.getItem(key) || 0);
    if (Number.isFinite(previous) && previous > 0 && now < previous) {
      return true;
    }
    window.localStorage.setItem(key, String(now));
    return false;
  } catch {
    return false;
  }
}

const LICENSE_AES_STORAGE_KEY = 'saasvala-license-aes-key-v1';
const LICENSE_AES_DATA_PREFIX = 'saasvala-license-data-v1:';

async function getOrCreateLocalAesKey(): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) {
    return null;
  }

  try {
    const existing = window.localStorage.getItem(LICENSE_AES_STORAGE_KEY);
    if (existing) {
      const raw = Uint8Array.from(atob(existing), (c) => c.charCodeAt(0));
      return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }

    const raw = crypto.getRandomValues(new Uint8Array(32));
    window.localStorage.setItem(LICENSE_AES_STORAGE_KEY, btoa(String.fromCharCode(...raw)));
    return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  } catch {
    return null;
  }
}

export async function storeLicenseSecure(storageSlot: string, licenseData: Record<string, unknown>): Promise<boolean> {
  const key = await getOrCreateLocalAesKey();
  if (!key || typeof window === 'undefined') return false;

  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(licenseData));
    const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const cipher = new Uint8Array(cipherBuffer);

    const payload = `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...cipher))}`;
    window.localStorage.setItem(`${LICENSE_AES_DATA_PREFIX}${storageSlot}`, payload);
    return true;
  } catch {
    return false;
  }
}

export async function loadLicenseSecure<T = Record<string, unknown>>(storageSlot: string): Promise<T | null> {
  const key = await getOrCreateLocalAesKey();
  if (!key || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(`${LICENSE_AES_DATA_PREFIX}${storageSlot}`);
    if (!raw) return null;
    const [ivB64, cipherB64] = raw.split('.');
    if (!ivB64 || !cipherB64) return null;

    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const cipher = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0));
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    const json = new TextDecoder().decode(plainBuffer);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

async function bindLicenseOnFirstUse(licenseRow: any, licenseKey: string): Promise<{ valid: boolean; error?: string }> {
  const context = await getClientBindingContext();
  const existingUserId = licenseRow.user_id || null;
  const existingDeviceId = licenseRow.device_id || null;

  if (licenseRow.is_used === true && !existingUserId && !existingDeviceId) {
    await safeWriteVerificationLog(licenseKey, 'invalid', 'used_key_without_binding');
    return { valid: false, error: 'This license key is already used.' };
  }

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
    is_used: true,
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
export async function validateLicenseKeyInDb(key: string, signals?: ValidationRuntimeSignals): Promise<LicenseValidationResult> {
  try {
    const trimmed = key.trim().toUpperCase();
    if (!trimmed) {
      return { valid: false, error: 'License key is required.' };
    }

    if (signals?.isRooted || signals?.isEmulator || signals?.isDebuggerAttached) {
      return { valid: false, error: 'Security violation detected on device.' };
    }

    if (trimmed.startsWith('V1.') || trimmed.startsWith('V2.')) {
      const offlineValid = await verifySecureOfflineLicenseKey(trimmed);
      if (!offlineValid) {
        await safeWriteVerificationLog(trimmed, 'invalid', 'offline_signature_invalid');
        return { valid: false, error: 'License key signature is invalid.' };
      }

      const decoded = decodeSecureOfflineLicenseKey(trimmed);
      if (detectClockRollback(decoded?.p, signals?.currentTimeMs)) {
        await safeWriteVerificationLog(trimmed, 'blocked', 'clock_rollback_detected');
        return { valid: false, error: 'Device time tampering detected.' };
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
      .select('id, status, key_status, is_used, expires_at, meta, user_id, device_id, activated_at, activated_devices')
      .eq('license_key', trimmed)
      .maybeSingle();

    if (error) {
      await safeWriteVerificationLog(trimmed, 'invalid', 'database_error');
      // Network or DB error — don't reject as "invalid key"
      return { valid: false, error: 'Unable to verify license key. Please check your connection and try again.' };
    }

    if (!data) {
      await safeWriteVerificationLog(trimmed, 'not_found', 'license_not_found');
      return { valid: false, error: 'Invalid or expired key' };
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
      return { valid: false, error: 'License expired' };
    }

    if (data.status && data.status !== 'active') {
      await safeWriteVerificationLog(trimmed, 'revoked', `inactive_status:${data.status}`);
      return { valid: false, error: 'This license key is not active.' };
    }

    const now = new Date();
    if (data.expires_at && new Date(data.expires_at) < now) {
      await safeWriteVerificationLog(trimmed, 'expired', 'license_expired');
      return { valid: false, error: 'License expired' };
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

export interface OfflineEnvelopeValidation {
  valid: boolean;
  expired: boolean;
  productId?: string;
  expiresAt?: string | null;
  reason?: string;
}

export async function validateOfflineLicenseEnvelope(key: string): Promise<OfflineEnvelopeValidation> {
  const normalized = String(key || '').trim();
  if (!normalized) {
    return { valid: false, expired: false, reason: 'missing_key' };
  }

  if (!normalized.startsWith('V1.') && !normalized.startsWith('V2.')) {
    return { valid: false, expired: false, reason: 'invalid_format' };
  }

  const signatureOk = await verifySecureOfflineLicenseKey(normalized);
  if (!signatureOk) {
    return { valid: false, expired: false, reason: 'invalid_signature' };
  }

  const payload = decodeSecureOfflineLicenseKey(normalized);
  if (!payload?.p) {
    return { valid: false, expired: false, reason: 'invalid_payload' };
  }

  const expiresAt = payload.e || null;
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return {
      valid: false,
      expired: true,
      productId: payload.p,
      expiresAt,
      reason: 'expired',
    };
  }

  return {
    valid: true,
    expired: false,
    productId: payload.p,
    expiresAt,
  };
}

export interface PhpOfflineRuntimePack {
  licenseKey: string;
  signature: string;
  bootstrap: {
    version: string;
    productId: string;
    expiresAt: string | null;
    deviceLimit: number;
    messageExpired: string;
    messageInvalid: string;
  };
  phpGuardSnippet: string;
  jsGuardSnippet: string;
}

export async function createPhpOfflineRuntimePack(input: {
  productId: string;
  planDuration?: string | null;
  expiresAt?: string | null;
  resellerId?: string | null;
  assignedTo?: string | null;
  deviceLimit?: number;
}): Promise<PhpOfflineRuntimePack> {
  const bundle = await generateSecureOfflineLicenseKey({
    productId: input.productId,
    planDuration: input.planDuration || null,
    expiresAt: input.expiresAt || null,
    resellerId: input.resellerId || null,
    assignedTo: input.assignedTo || null,
    deviceLimit: input.deviceLimit || 1,
  });

  const bootstrap = {
    version: 'php-offline-v1',
    productId: input.productId,
    expiresAt: input.expiresAt || null,
    deviceLimit: Math.max(1, Number(input.deviceLimit || 1)),
    messageExpired: 'License expired, contact reseller',
    messageInvalid: 'Invalid license key',
  };

  const phpGuardSnippet = [
    "<?php",
    "$runtime = json_decode(file_get_contents(__DIR__ . '/license.runtime.json'), true);",
    "$key = trim((string)($_POST['license_key'] ?? $_GET['license_key'] ?? ''));",
    "if ($key === '') { http_response_code(403); exit('License required'); }",
    "$parts = explode('.', $key);",
    "if (count($parts) !== 3 || ($parts[0] !== 'V1' && $parts[0] !== 'V2')) { http_response_code(403); exit('Invalid license key'); }",
    "$payloadRaw = base64_decode(strtr($parts[1], '-_', '+/'));",
    "$payload = json_decode($payloadRaw, true);",
    "if (!$payload || ($payload['p'] ?? '') !== ($runtime['productId'] ?? '')) { http_response_code(403); exit('Invalid license key'); }",
    "if (!empty($payload['e']) && strtotime($payload['e']) < time()) { http_response_code(403); exit('License expired, contact reseller'); }",
    "$secret = getenv('VALA_LICENSE_SECRET') ?: 'vala-secret-key';",
    "$expected = rtrim(strtr(base64_encode(hash_hmac('sha256', $parts[1], $secret, true)), '+/', '-_'), '=');",
    "if (!hash_equals($expected, $parts[2])) { http_response_code(403); exit('Invalid license key'); }",
    "?>",
  ].join('\n');

  const jsGuardSnippet = [
    "async function validateOfflineLicenseOrThrow(licenseKey) {",
    "  const key = String(licenseKey || '').trim();",
    "  if (!key) throw new Error('License required');",
    "  const result = await window.ValaLicense.validateOfflineEnvelope(key);",
    "  if (!result.valid && result.expired) throw new Error('License expired, contact reseller');",
    "  if (!result.valid) throw new Error('Invalid license key');",
    "  const stored = await window.ValaLicense.storeSecure('php-offline-license', { key, checkedAt: new Date().toISOString() });",
    "  if (!stored) console.warn('Failed to persist encrypted license cache');",
    "  return result;",
    "}",
  ].join('\n');

  return {
    licenseKey: bundle.key,
    signature: bundle.signature,
    bootstrap,
    phpGuardSnippet,
    jsGuardSnippet,
  };
}
