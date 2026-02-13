import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MonitorItem {
  id: string;
  monitor_type: string;
  title: string;
  reason: string;
  effect: string;
  risk_level: string;
  auto_approved: boolean;
  status: string;
  source_module: string;
  target_entity_id: string | null;
  target_entity_type: string | null;
  action_payload: Record<string, unknown>;
  ai_confidence: number;
  approved_by: string | null;
  approved_at: string | null;
  executed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface MonitorStats {
  pending: number;
  approved: number;
  rejected: number;
  auto_approved: number;
  last_health: {
    status: string;
    metrics: Record<string, number>;
    issues_detected: number;
    auto_actions_taken: number;
    approvals_queued: number;
    created_at: string;
  } | null;
}

export function useSystemMonitor() {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [queue, setQueue] = useState<MonitorItem[]>([]);
  const [stats, setStats] = useState<MonitorStats | null>(null);

  const runHealthCheck = useCallback(async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-monitor', {
        body: { action: 'health_check' }
      });
      if (error) throw error;
      toast.success(`🔍 Scan complete: ${data.approvals_queued} items need approval, ${data.auto_actions} auto-handled`);
      return data;
    } catch (error) {
      console.error('Health check error:', error);
      toast.error('Health check failed');
      return null;
    } finally {
      setScanning(false);
    }
  }, []);

  const fetchQueue = useCallback(async (status: string = 'pending') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-monitor', {
        body: { action: 'get_queue', data: { status } }
      });
      if (error) throw error;
      setQueue(data.queue || []);
      return data.queue;
    } catch (error) {
      console.error('Fetch queue error:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('auto-monitor', {
        body: { action: 'get_stats' }
      });
      if (error) throw error;
      setStats(data.stats);
      return data.stats;
    } catch (error) {
      console.error('Fetch stats error:', error);
      return null;
    }
  }, []);

  const approveItem = useCallback(async (id: string, userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('auto-monitor', {
        body: { action: 'approve', data: { id, user_id: userId } }
      });
      if (error) throw error;
      toast.success('✅ Approved');
      setQueue(prev => prev.filter(item => item.id !== id));
      return true;
    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Failed to approve');
      return false;
    }
  }, []);

  const rejectItem = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('auto-monitor', {
        body: { action: 'reject', data: { id } }
      });
      if (error) throw error;
      toast.success('❌ Rejected');
      setQueue(prev => prev.filter(item => item.id !== id));
      return true;
    } catch (error) {
      console.error('Reject error:', error);
      toast.error('Failed to reject');
      return false;
    }
  }, []);

  return {
    loading,
    scanning,
    queue,
    stats,
    runHealthCheck,
    fetchQueue,
    fetchStats,
    approveItem,
    rejectItem,
  };
}
