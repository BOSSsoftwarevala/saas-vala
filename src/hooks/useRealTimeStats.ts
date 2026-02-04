import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RealTimeStats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  suspendedProducts: number;
  totalDemos: number;
  liveDemos: number;
  totalApks: number;
  stableApks: number;
  licensesIssued: number;
  expiringLicenses: number;
  serverDeployments: number;
  productErrors: number;
}

export function useRealTimeStats() {
  const [stats, setStats] = useState<RealTimeStats>({
    totalProducts: 0,
    activeProducts: 0,
    draftProducts: 0,
    suspendedProducts: 0,
    totalDemos: 0,
    liveDemos: 0,
    totalApks: 0,
    stableApks: 0,
    licensesIssued: 0,
    expiringLicenses: 0,
    serverDeployments: 0,
    productErrors: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const [
        productsRes,
        activeProductsRes,
        draftProductsRes,
        suspendedProductsRes,
        demosRes,
        liveDemosRes,
        apksRes,
        stableApksRes,
        licensesRes,
        expiringLicensesRes,
        serversRes,
        healthErrorsRes,
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
        supabase.from('demos').select('*', { count: 'exact', head: true }),
        supabase.from('demos').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('apks').select('*', { count: 'exact', head: true }),
        supabase.from('apks').select('*', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('license_keys').select('*', { count: 'exact', head: true }),
        supabase.from('license_keys').select('*', { count: 'exact', head: true })
          .eq('status', 'active')
          .lt('expires_at', thirtyDaysFromNow.toISOString())
          .gt('expires_at', new Date().toISOString()),
        supabase.from('servers').select('*', { count: 'exact', head: true }).eq('status', 'live'),
        supabase.from('health_checks').select('*', { count: 'exact', head: true }).eq('overall_status', 'error'),
      ]);

      setStats({
        totalProducts: productsRes.count || 0,
        activeProducts: activeProductsRes.count || 0,
        draftProducts: draftProductsRes.count || 0,
        suspendedProducts: suspendedProductsRes.count || 0,
        totalDemos: demosRes.count || 0,
        liveDemos: liveDemosRes.count || 0,
        totalApks: apksRes.count || 0,
        stableApks: stableApksRes.count || 0,
        licensesIssued: licensesRes.count || 0,
        expiringLicenses: expiringLicensesRes.count || 0,
        serverDeployments: serversRes.count || 0,
        productErrors: healthErrorsRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching real-time stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Set up real-time subscriptions for auto-refresh
    const channel = supabase
      .channel('product-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demos' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'apks' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'license_keys' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'health_checks' }, fetchStats)
      .subscribe();

    // Also refresh every 30 seconds as fallback
    const interval = setInterval(fetchStats, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
