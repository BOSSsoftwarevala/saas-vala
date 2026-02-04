import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalKeys: number;
  activeKeys: number;
  totalServers: number;
  liveServers: number;
  totalResellers: number;
  activeResellers: number;
  totalLeads: number;
  convertedLeads: number;
  walletBalance: number;
  thisMonthRevenue: number;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    totalKeys: 0,
    activeKeys: 0,
    totalServers: 0,
    liveServers: 0,
    totalResellers: 0,
    activeResellers: 0,
    totalLeads: 0,
    convertedLeads: 0,
    walletBalance: 0,
    thisMonthRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch all counts in parallel
      const [
        productsRes,
        activeProductsRes,
        keysRes,
        activeKeysRes,
        serversRes,
        liveServersRes,
        resellersRes,
        activeResellersRes,
        leadsRes,
        convertedLeadsRes,
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('license_keys').select('*', { count: 'exact', head: true }),
        supabase.from('license_keys').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('servers').select('*', { count: 'exact', head: true }),
        supabase.from('servers').select('*', { count: 'exact', head: true }).eq('status', 'live'),
        supabase.from('resellers').select('*', { count: 'exact', head: true }),
        supabase.from('resellers').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'converted'),
      ]);

      setStats({
        totalProducts: productsRes.count || 0,
        activeProducts: activeProductsRes.count || 0,
        totalKeys: keysRes.count || 0,
        activeKeys: activeKeysRes.count || 0,
        totalServers: serversRes.count || 0,
        liveServers: liveServersRes.count || 0,
        totalResellers: resellersRes.count || 0,
        activeResellers: activeResellersRes.count || 0,
        totalLeads: leadsRes.count || 0,
        convertedLeads: convertedLeadsRes.count || 0,
        walletBalance: 0,
        thisMonthRevenue: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, refetch: fetchStats };
}
