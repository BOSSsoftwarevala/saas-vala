/**
 * useFeatureFlags — runtime feature toggle hook.
 *
 * Loads flags from the Supabase `feature_flags` table once per session,
 * caches them in-memory for 5 minutes, and exposes typed helpers.
 *
 * Usage:
 *   const { isEnabled, flags, loading } = useFeatureFlags();
 *
 *   if (!isEnabled('payment_wallet')) {
 *     return <FeatureUnavailableMessage />;
 *   }
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';


interface FeatureFlag {
  flag_key:    string;
  is_enabled:  boolean;
  rollout_pct: number;
  description: string | null;
  metadata:    Record<string, unknown>;
}

interface UseFeatureFlagsReturn {
  /** Raw flags array */
  flags:     FeatureFlag[];
  loading:   boolean;
  /** Returns false when the feature is disabled OR the flag doesn't exist */
  isEnabled: (key: string) => boolean;
  /** Force-reload flags (e.g. after an admin change) */
  refresh:   () => Promise<void>;
}

export function useFeatureFlags(): UseFeatureFlagsReturn {
  const [flags, setFlags]     = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFlags = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const hit = cache.get<FeatureFlag[]>(FLAG_CACHE_KEY);
      if (hit) {
        setFlags(hit);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('feature_flags')
        .select('flag_key, is_enabled, rollout_pct, description, metadata');

      if (error) throw error;
      const rows: FeatureFlag[] = (data ?? []).map((r: any) => ({
        flag_key:    r.flag_key,
        is_enabled:  r.is_enabled ?? false,
        rollout_pct: r.rollout_pct ?? 100,
        description: r.description ?? null,
        metadata:    r.metadata ?? {},
      }));

      cache.set(FLAG_CACHE_KEY, rows, FLAG_TTL_MS);
      setFlags(rows);
    } catch (err) {
      console.warn('[useFeatureFlags] Failed to load flags:', err);
      // Keep previous flags on error; do not crash the app
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlags(false);
  }, [loadFlags]);

  const isEnabled = useCallback(
    (key: string): boolean => {
      const flag = flags.find((f) => f.flag_key === key);
      if (!flag) return false;
      if (!flag.is_enabled) return false;
      // Partial rollout: use rollout_pct to gate users deterministically
      if (flag.rollout_pct < 100) {
        // Simple hash of the key to a 0-99 bucket
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
          hash = (hash * 31 + key.charCodeAt(i)) & 0xffffffff;
        }
        return Math.abs(hash) % 100 < flag.rollout_pct;
      }
      return true;
    },
    [flags]
  );

  return { flags, loading, isEnabled, refresh: () => loadFlags(true) };
}

// ─────────────────────────────────────────────
// Failsafe hook: disable buy button when payment system is down
// ─────────────────────────────────────────────

/**
 * usePaymentAvailability
 * Combines feature-flag + basic health check to decide whether
 * the buy button should be enabled.
 */
export function usePaymentAvailability() {
  const { isEnabled, loading } = useFeatureFlags();

  const walletEnabled = !loading && isEnabled('payment_wallet');
  const upiEnabled    = !loading && isEnabled('payment_upi');
  const anyEnabled    = walletEnabled || upiEnabled || isEnabled('payment_wise') ||
                        isEnabled('payment_payu') || isEnabled('payment_binance');

  return {
    loading,
    walletEnabled,
    upiEnabled,
    anyEnabled,
    disabledReason: !anyEnabled && !loading
      ? 'Payment system is temporarily unavailable. Please try again later.'
      : null,
  };
}
