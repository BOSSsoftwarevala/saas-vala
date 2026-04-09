import { useState, useCallback, useEffect } from 'react';
import { serverManagementApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export interface ServerMetrics {
  id: string;
  server_id: string;
  cpu_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  disk_used_gb: number;
  disk_total_gb: number;
  network_in_mbps: number;
  network_out_mbps: number;
  request_count: number;
  error_count: number;
  avg_response_time_ms: number;
  uptime_seconds: number;
  recorded_at: string;
}

export interface ServerBilling {
  id: string;
  server_id: string;
  user_id: string;
  billing_cycle_start: string;
  billing_cycle_end: string;
  base_price: number;
  total_amount: number;
  status: 'pending' | 'invoiced' | 'paid' | 'failed' | 'refunded';
  paid_at?: string;
  due_date: string;
}

export interface ServerAgent {
  id: string;
  server_id: string;
  agent_name: string;
  agent_version: string;
  status: 'online' | 'offline' | 'error';
  last_heartbeat: string;
  ip_address?: string;
}

export interface ServerLog {
  id: string;
  server_id: string;
  action: string;
  status: 'pending' | 'success' | 'failed' | 'timeout';
  message: string;
  error_details?: string;
  command?: string;
  output?: string;
  duration_seconds?: number;
  created_at: string;
}

export interface ServerAIAnalysis {
  id: string;
  analysis_type: string;
  response: string;
  recommendations: string[];
  confidence_score: number;
  analyzed_at: string;
}

export function useServerManagement(serverId: string) {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<ServerMetrics[]>([]);
  const [billing, setBilling] = useState<ServerBilling | null>(null);
  const [agents, setAgents] = useState<ServerAgent[]>([]);
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const [analysis, setAnalysis] = useState<ServerAIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch latest metrics
  const fetchLatestMetrics = useCallback(async () => {
    try {
      const data = await serverManagementApi.getLatestMetrics(serverId);
      setMetrics(data.metrics);
    } catch (err: any) {
      console.error('Failed to fetch metrics:', err);
      toast?.({ title: 'Error', description: 'Failed to fetch server metrics' });
    }
  }, [serverId, toast]);

  // Fetch metrics history
  const fetchMetricsHistory = useCallback(async (hours: number = 24) => {
    try {
      const data = await serverManagementApi.getMetricsHistory(serverId, hours);
      setMetricsHistory(data.metrics);
    } catch (err: any) {
      console.error('Failed to fetch metrics history:', err);
    }
  }, [serverId]);

  // Fetch current billing
  const fetchBilling = useCallback(async () => {
    try {
      const data = await serverManagementApi.getCurrentBilling(serverId);
      setBilling(data.billing);
    } catch (err: any) {
      console.error('Failed to fetch billing:', err);
    }
  }, [serverId]);

  // Fetch agents
  const fetchAgents = useCallback(async () => {
    try {
      const data = await serverManagementApi.getAgents(serverId);
      setAgents(data.agents || []);
    } catch (err: any) {
      console.error('Failed to fetch agents:', err);
    }
  }, [serverId]);

  // Fetch server logs
  const fetchLogs = useCallback(async (limit: number = 100) => {
    try {
      const data = await serverManagementApi.getLogs(serverId, limit);
      setLogs(data.logs || []);
    } catch (err: any) {
      console.error('Failed to fetch logs:', err);
    }
  }, [serverId]);

  // Fetch AI analysis
  const fetchAnalysis = useCallback(async () => {
    try {
      const data = await serverManagementApi.getLatestAnalysis(serverId);
      setAnalysis(data.analysis);
    } catch (err: any) {
      console.error('Failed to fetch AI analysis:', err);
    }
  }, [serverId]);

  // Trigger AI analysis
  const runAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const data = await serverManagementApi.analyzeServer(serverId);
      setAnalysis(data.analysis);
      toast?.({ title: 'Success', description: 'AI analysis completed' });
    } catch (err: any) {
      console.error('Failed to run analysis:', err);
      toast?.({ title: 'Error', description: 'Failed to run AI analysis' });
    } finally {
      setLoading(false);
    }
  }, [serverId, toast]);

  // Server control actions
  const startServer = useCallback(async () => {
    try {
      await serverManagementApi.startServer(serverId);
      await fetchLogs();
      toast?.({ title: 'Success', description: 'Server start command sent' });
    } catch (err: any) {
      toast?.({ title: 'Error', description: 'Failed to start server' });
    }
  }, [serverId, fetchLogs, toast]);

  const stopServer = useCallback(async () => {
    try {
      await serverManagementApi.stopServer(serverId);
      await fetchLogs();
      toast?.({ title: 'Success', description: 'Server stop command sent' });
    } catch (err: any) {
      toast?.({ title: 'Error', description: 'Failed to stop server' });
    }
  }, [serverId, fetchLogs, toast]);

  const restartServer = useCallback(async () => {
    try {
      await serverManagementApi.restartServer(serverId);
      await fetchLogs();
      toast?.({ title: 'Success', description: 'Server restart command sent' });
    } catch (err: any) {
      toast?.({ title: 'Error', description: 'Failed to restart server' });
    }
  }, [serverId, fetchLogs, toast]);

  // Mark billing as paid
  const markBillingPaid = useCallback(async (billingId: string) => {
    try {
      await serverManagementApi.markBillingPaid(serverId, billingId);
      await fetchBilling();
      toast?.({ title: 'Success', description: 'Billing marked as paid' });
    } catch (err: any) {
      toast?.({ title: 'Error', description: 'Failed to update billing' });
    }
  }, [serverId, fetchBilling, toast]);

  // Initial data fetch
  useEffect(() => {
    fetchLatestMetrics();
    fetchBilling();
    fetchAgents();
    fetchLogs();
    fetchAnalysis();
    fetchMetricsHistory();

    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchLatestMetrics, 30_000);
    return () => clearInterval(interval);
  }, [serverId, fetchLatestMetrics, fetchBilling, fetchAgents, fetchLogs, fetchAnalysis, fetchMetricsHistory]);

  return {
    metrics,
    metricsHistory,
    billing,
    agents,
    logs,
    analysis,
    loading,
    fetchLatestMetrics,
    fetchMetricsHistory,
    fetchBilling,
    fetchAgents,
    fetchLogs,
    fetchAnalysis,
    runAnalysis,
    startServer,
    stopServer,
    restartServer,
    markBillingPaid,
  };
}
