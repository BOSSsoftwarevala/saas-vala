import { useCallback, useEffect, useState } from 'react';
import { publicMarketplaceApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export interface ResellerPlanBadgeState {
  badgeLabel: string;
  badgeIcon: string;
  planName: string;
  marginPercent: number;
  freeKeysBalance: number;
  planActive: boolean;
  dashboardAccess: boolean;
  planExpiresAt: string | null;
}

const DEFAULT_PLAN_STATE: ResellerPlanBadgeState = {
  badgeLabel: 'Bronze',
  badgeIcon: '🥉',
  planName: 'Bronze',
  marginPercent: 0,
  freeKeysBalance: 0,
  planActive: false,
  dashboardAccess: false,
  planExpiresAt: null,
};

export function useResellerPlanBadge() {
  const { isReseller } = useAuth();
  const [plan, setPlan] = useState<ResellerPlanBadgeState>(DEFAULT_PLAN_STATE);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isReseller) {
      setPlan(DEFAULT_PLAN_STATE);
      return;
    }

    setLoading(true);
    try {
      const stats = await publicMarketplaceApi.getResellerStats();
      setPlan({
        badgeLabel: String(stats?.badge_label || DEFAULT_PLAN_STATE.badgeLabel),
        badgeIcon: String(stats?.badge_icon || DEFAULT_PLAN_STATE.badgeIcon),
        planName: String(stats?.plan_name || stats?.badge_label || DEFAULT_PLAN_STATE.planName),
        marginPercent: Number(stats?.margin_percent || 0),
        freeKeysBalance: Number(stats?.free_keys_balance || 0),
        planActive: Boolean(stats?.plan_active),
        dashboardAccess: Boolean(stats?.dashboard_access),
        planExpiresAt: stats?.plan_expires_at || null,
      });
    } catch {
      // Keep existing plan state on transient failures.
    } finally {
      setLoading(false);
    }
  }, [isReseller]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { plan, loading, refresh };
}
