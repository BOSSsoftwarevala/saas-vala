/**
 * useSystemHealth — polls the server health-check endpoint.
 *
 * Shows a banner or disables features when the system is degraded.
 *
 * Usage:
 *   const { status, healthy, degraded, checking } = useSystemHealth();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type HealthStatus = 'unknown' | 'healthy' | 'degraded' | 'error';

interface HealthData {
  status:           HealthStatus;
  database:         string;
  pending_jobs:     number;
  failed_jobs_1h:   number;
  critical_alerts:  number;
  checked_at:       string | null;
}

const POLL_INTERVAL_MS = 60_000; // poll every 60s

export function useSystemHealth(pollEnabled = true) {
  const [health, setHealth]   = useState<HealthData>({
    status: 'unknown',
    database: 'unknown',
    pending_jobs: 0,
    failed_jobs_1h: 0,
    critical_alerts: 0,
    checked_at: null,
  });
  const [checking, setChecking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const { data, error } = await (supabase as any).rpc('system_health_check');
      if (error) throw error;

      const payload = (data || {}) as any;

      setHealth({
        status:          payload.status ?? 'error',
        database:        payload.database ?? 'unknown',
        pending_jobs:    payload.pending_jobs ?? 0,
        failed_jobs_1h:  payload.failed_jobs_1h ?? 0,
        critical_alerts: payload.critical_alerts ?? 0,
        checked_at:      payload.checked_at ?? new Date().toISOString(),
      });
    } catch (err) {
      setHealth((prev) => ({ ...prev, status: 'error', checked_at: new Date().toISOString() }));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!pollEnabled) return;

    // Initial check
    runCheck();

    timerRef.current = setInterval(runCheck, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pollEnabled, runCheck]);

  return {
    health,
    checking,
    healthy:  health.status === 'healthy',
    degraded: health.status === 'degraded' || health.status === 'error',
    refresh:  runCheck,
  };
}
