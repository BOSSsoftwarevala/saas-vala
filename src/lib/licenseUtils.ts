import { supabase } from '@/integrations/supabase/client';

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

interface LicenseValidationResult {
  valid: boolean;
  expiresAt?: string;
  error?: string;
}

/**
 * Validate a license key against the database.
 * Returns the license expiry date if valid so it can be cached locally.
 */
export async function validateLicenseKeyInDb(key: string): Promise<LicenseValidationResult> {
  try {
    const trimmed = key.trim().toUpperCase();
    const { data, error } = await supabase
      .from('license_keys')
      .select('id, status, expires_at')
      .eq('license_key', trimmed)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      // Network or DB error — don't reject as "invalid key"
      return { valid: false, error: 'Unable to verify license key. Please check your connection and try again.' };
    }

    if (!data) {
      return { valid: false, error: 'Invalid license key. Please purchase a valid license.' };
    }

    const now = new Date();
    if (data.expires_at && new Date(data.expires_at) < now) {
      return { valid: false, error: 'This license key has expired.' };
    }

    return { valid: true, expiresAt: data.expires_at ?? undefined };
  } catch {
    return { valid: false, error: 'Unable to verify license key. Please check your connection and try again.' };
  }
}
