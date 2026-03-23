/**
 * Core Security Utilities
 * Provides: device fingerprinting, rate limiting, checksum/HMAC validation,
 * replay-attack prevention, and request signing.
 */

// ─────────────────────────────────────────────
// 1. DEVICE FINGERPRINT
// ─────────────────────────────────────────────

const DEVICE_ID_KEY = 'vala_device_id';

/** Generate a stable, pseudo-anonymous device fingerprint from browser signals. */
async function generateFingerprint(): Promise<string> {
  const components: string[] = [
    navigator.userAgent,
    navigator.language,
    String(screen.width) + 'x' + String(screen.height),
    String(new Date().getTimezoneOffset()),
    navigator.platform || '',
    String(navigator.hardwareConcurrency ?? ''),
    String((navigator as any).deviceMemory ?? ''),
  ];

  const raw = components.join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Return the stored device ID, creating one if it doesn't exist yet.
 * The ID is persisted in localStorage so it survives page reloads.
 */
export async function getDeviceId(): Promise<string> {
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;

  const id = await generateFingerprint();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

// ─────────────────────────────────────────────
// 2. IN-BROWSER RATE LIMITER
// ─────────────────────────────────────────────

interface RateLimitRecord {
  count: number;
  windowStart: number;
}

const rateLimitStore: Map<string, RateLimitRecord> = new Map();

/**
 * Client-side rate limiter (backed by an in-memory Map).
 * Returns `true` when the action is allowed, `false` when it is throttled.
 *
 * @param key      Unique key for the action (e.g. "payment:user123")
 * @param limit    Maximum number of calls allowed per window
 * @param windowMs Length of the time window in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now - record.windowStart > windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= limit) return false;

  record.count += 1;
  return true;
}

/** Reset the rate-limit counter for a key (e.g. after a successful auth). */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

// ─────────────────────────────────────────────
// 3. CHECKSUM / INTEGRITY HELPERS
// ─────────────────────────────────────────────

/**
 * Compute a SHA-256 hex digest of arbitrary data.
 * Can be used to create and later verify integrity checksums.
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate an integrity checksum for a wallet transaction.
 * Binds: walletId + amount + timestamp so a tampered payload is detectable.
 */
export async function walletChecksum(
  walletId: string,
  amount: number,
  timestamp: string
): Promise<string> {
  return sha256(`${walletId}:${amount}:${timestamp}`);
}

/** Verify a previously generated wallet checksum. */
export async function verifyWalletChecksum(
  walletId: string,
  amount: number,
  timestamp: string,
  checksum: string
): Promise<boolean> {
  const expected = await walletChecksum(walletId, amount, timestamp);
  return expected === checksum;
}

// ─────────────────────────────────────────────
// 4. REPLAY ATTACK PREVENTION
// ─────────────────────────────────────────────

const USED_NONCES_KEY = 'vala_used_nonces';
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface NonceEntry {
  nonce: string;
  expiresAt: number;
}

function loadNonces(): NonceEntry[] {
  try {
    return JSON.parse(localStorage.getItem(USED_NONCES_KEY) || '[]') as NonceEntry[];
  } catch {
    return [];
  }
}

function saveNonces(entries: NonceEntry[]): void {
  localStorage.setItem(USED_NONCES_KEY, JSON.stringify(entries));
}

/** Generate a cryptographically random nonce (32 hex chars). */
export function generateNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Return `true` if the nonce has not been seen before (consumes it).
 * Expired nonces are pruned automatically.
 */
export function consumeNonce(nonce: string): boolean {
  const now = Date.now();
  const entries = loadNonces().filter((e) => e.expiresAt > now); // prune expired

  const exists = entries.some((e) => e.nonce === nonce);
  if (exists) return false; // replay detected

  entries.push({ nonce, expiresAt: now + NONCE_TTL_MS });
  saveNonces(entries);
  return true;
}

// ─────────────────────────────────────────────
// 5. REQUEST SIGNING
// ─────────────────────────────────────────────

/**
 * Sign a request payload so that the server can verify it was not tampered with.
 * Returns a hex string that should be sent as the `X-Request-Signature` header.
 *
 * Formula: SHA-256( nonce + ":" + timestamp + ":" + JSON.stringify(body) )
 */
export async function signRequest(
  body: Record<string, unknown>,
  nonce: string,
  timestamp: string
): Promise<string> {
  const payload = `${nonce}:${timestamp}:${JSON.stringify(body)}`;
  return sha256(payload);
}

/** Build the full set of security headers for an API request. */
export async function buildSecurityHeaders(
  body: Record<string, unknown> = {}
): Promise<Record<string, string>> {
  const nonce = generateNonce();
  const timestamp = new Date().toISOString();
  const signature = await signRequest(body, nonce, timestamp);
  const deviceId = await getDeviceId();

  return {
    'X-Request-Nonce': nonce,
    'X-Request-Timestamp': timestamp,
    'X-Request-Signature': signature,
    'X-Device-ID': deviceId,
  };
}

// ─────────────────────────────────────────────
// 6. PAYMENT REFERENCE REGISTRY (client-side)
// ─────────────────────────────────────────────

const SEEN_REFS_KEY = 'vala_seen_payment_refs';
const REF_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface PaymentRefEntry {
  ref: string;
  expiresAt: number;
}

function loadSeenRefs(): PaymentRefEntry[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_REFS_KEY) || '[]') as PaymentRefEntry[];
  } catch {
    return [];
  }
}

/**
 * Returns `true` if this payment reference is NEW (not seen before).
 * Duplicate references are rejected (returns `false`).
 */
export function registerPaymentRef(ref: string): boolean {
  const now = Date.now();
  const entries = loadSeenRefs().filter((e) => e.expiresAt > now); // prune old

  if (entries.some((e) => e.ref === ref)) return false; // duplicate

  entries.push({ ref, expiresAt: now + REF_TTL_MS });
  localStorage.setItem(SEEN_REFS_KEY, JSON.stringify(entries));
  return true;
}

// ─────────────────────────────────────────────
// 7. AMOUNT SANITY CHECK
// ─────────────────────────────────────────────

/** Allowed tolerance between declared and server-returned amount (0 %). */
const AMOUNT_TOLERANCE = 0;

/** Returns true when the amounts match within the allowed tolerance. */
export function verifyAmount(declared: number, serverAmount: number): boolean {
  if (declared <= 0 || serverAmount <= 0) return false;
  return Math.abs(declared - serverAmount) <= AMOUNT_TOLERANCE;
}

// ─────────────────────────────────────────────
// 8. SUSPICIOUS ACTIVITY SCORING
// ─────────────────────────────────────────────

export interface ActivityEvent {
  type: string;
  timestamp: number;
}

const ACTIVITY_KEY = 'vala_activity_events';
const ACTIVITY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const HIGH_RISK_THRESHOLD = 10; // events per window before flagging

function loadActivityEvents(): ActivityEvent[] {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]') as ActivityEvent[];
  } catch {
    return [];
  }
}

/** Record an activity event and return the current risk score (0–100). */
export function recordActivity(type: string): number {
  const now = Date.now();
  const events = loadActivityEvents().filter(
    (e) => now - e.timestamp < ACTIVITY_WINDOW_MS
  );
  events.push({ type, timestamp: now });
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(events));

  const score = Math.min(100, Math.floor((events.length / HIGH_RISK_THRESHOLD) * 100));
  return score;
}

/** Return the current risk score without recording a new event. */
export function getRiskScore(): number {
  const now = Date.now();
  const events = loadActivityEvents().filter(
    (e) => now - e.timestamp < ACTIVITY_WINDOW_MS
  );
  return Math.min(100, Math.floor((events.length / HIGH_RISK_THRESHOLD) * 100));
}
