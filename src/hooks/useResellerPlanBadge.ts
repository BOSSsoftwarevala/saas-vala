import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { resellerPlanSystem } from '@/lib/reseller-plans';

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
  badgeLabel: 'No Plan',
  badgeIcon: '',
  planName: 'No Plan',
  marginPercent: 0,
  freeKeysBalance: 0,
  planActive: false,
  dashboardAccess: false,
  planExpiresAt: null,
};

export function useResellerPlanBadge() {
  const { user, isReseller } = useAuth();
  const [plan, setPlan] = useState<ResellerPlanBadgeState>(DEFAULT_PLAN_STATE);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isReseller || !user?.id) {
      setPlan(DEFAULT_PLAN_STATE);
      return;
    }

    setLoading(true);
    try {
      // Get reseller account from our new plan system
      const account = resellerPlanSystem.getResellerAccount(user.id);
      
      if (account?.currentPlan) {
        const availableKeys = account.totalKeys - account.usedKeys;
        setPlan({
          badgeLabel: account.currentPlan.badge.label,
          badgeIcon: account.currentPlan.badge.emoji,
          planName: account.currentPlan.name,
          marginPercent: account.currentPlan.benefits.marginPercentage,
          freeKeysBalance: availableKeys,
          planActive: true,
          dashboardAccess: true,
          planExpiresAt: account.planExpiresAt?.toISOString() || null,
        });
      } else {
        setPlan(DEFAULT_PLAN_STATE);
      }
    } catch {
      // Keep existing plan state on transient failures.
    } finally {
      setLoading(false);
    }
  }, [isReseller, user?.id]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { plan, loading, refresh };
}
