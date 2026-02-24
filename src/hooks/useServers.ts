import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface AgentStatus {
  agent_alive: boolean;
  live_status: unknown;
  diagnostics?: {
    attempts?: Array<{ url: string; method: string; status: number | null; error?: string }>;
  };
  server: {
    id: string;
    name: string;
    ip: string;
    status: string;
    agent_connected: boolean;
    agent_alive: boolean;
  };
}

export interface Server {
  id: string;
  name: string;
  subdomain: string | null;
  custom_domain: string | null;
  git_repo: string | null;
  git_branch: string;
  runtime: 'nodejs18' | 'nodejs20' | 'php82' | 'php83' | 'python311' | 'python312';
  status: 'deploying' | 'live' | 'failed' | 'stopped' | 'suspended';
  auto_deploy: boolean;
  ssl_status: string;
  env_vars: Json;
  last_deploy_at: string | null;
  health_status: string;
  uptime_percent: number;
  created_at: string;
}

export interface Deployment {
  id: string;
  server_id: string;
  commit_sha: string | null;
  commit_message: string | null;
  branch: string | null;
  status: 'queued' | 'building' | 'success' | 'failed' | 'cancelled' | 'rolled_back';
  build_logs: string | null;
  duration_seconds: number | null;
  created_at: string;
  completed_at: string | null;
}

export function useServers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [checkingAgent, setCheckingAgent] = useState<Record<string, boolean>>({});
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('servers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch servers');
      console.error(error);
    } else {
      setServers((data || []) as Server[]);
    }
    setLoading(false);
  }, []);

  const fetchDeployments = useCallback(async (serverId?: string) => {
    let query = supabase
      .from('deployments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (serverId) {
      query = query.eq('server_id', serverId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
    } else {
      setDeployments((data || []) as Deployment[]);
    }
  }, []);

  const createServer = async (server: Partial<Server>) => {
    const { data: userData } = await supabase.auth.getUser();
    const subdomain = server.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

    const { data, error } = await supabase
      .from('servers')
      .insert({
        name: server.name || '',
        subdomain,
        git_repo: server.git_repo,
        git_branch: server.git_branch || 'main',
        runtime: server.runtime || 'nodejs18',
        status: 'stopped',
        auto_deploy: server.auto_deploy ?? true,
        created_by: userData.user?.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create server');
      throw error;
    }
    toast.success(`Server created: ${subdomain}.saasvala.com`);
    await fetchServers();
    return data;
  };

  const updateServer = async (id: string, updates: Partial<Server>) => {
    const { error } = await supabase
      .from('servers')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Failed to update server');
      throw error;
    }
    toast.success('Server updated');
    await fetchServers();
  };

  const deleteServer = async (id: string) => {
    const { error } = await supabase
      .from('servers')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete server');
      throw error;
    }
    toast.success('Server deleted');
    await fetchServers();
  };

  const deployServer = async (id: string) => {
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('deployments')
      .insert({
        server_id: id,
        status: 'building',
        triggered_by: userData.user?.id,
      });

    if (error) {
      toast.error('Failed to trigger deployment');
      throw error;
    }

    await supabase
      .from('servers')
      .update({ status: 'deploying', last_deploy_at: new Date().toISOString() })
      .eq('id', id);

    toast.success('Deployment triggered');
    await fetchServers();
    await fetchDeployments(id);
  };

  const stopServer = async (id: string) => {
    await updateServer(id, { status: 'stopped' });
  };

  const suspendServer = async (id: string) => {
    await updateServer(id, { status: 'suspended' });
  };

  const registerAgent = useCallback(async (params: { name: string; ip_address?: string; agent_url: string; agent_token: string }) => {
    const { data, error } = await supabase.functions.invoke('server-agent', {
      body: { action: 'register', params },
    });

    if (error || !data?.success) {
      throw new Error(error?.message || data?.error || 'Agent registration failed');
    }

    return data;
  }, []);

  const verifyAgent = useCallback(async (serverId: string, agent_token?: string) => {
    const { data, error } = await supabase.functions.invoke('server-agent', {
      body: { action: 'verify', serverId, params: agent_token ? { agent_token } : {} },
    });

    if (error || !data?.success) {
      throw new Error(error?.message || data?.error || 'Agent verification failed');
    }

    return data;
  }, []);

  const checkAgentStatus = useCallback(async (serverId: string) => {
    setCheckingAgent((prev) => ({ ...prev, [serverId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('server-agent', {
        body: { action: 'status', serverId },
      });

      if (error || !data?.success) {
        console.error('[Agent Check] Error:', error || data?.error);
        setServers((prev) => prev.map((s) => (s.id === serverId && s.status !== 'deploying' ? { ...s, status: 'stopped' } : s)));
        return null;
      }

      setAgentStatuses((prev) => ({ ...prev, [serverId]: data as AgentStatus }));
      setServers((prev) => prev.map((s) => {
        if (s.id !== serverId) return s;
        const nextStatus = data.server?.agent_alive ? 'live' : (s.status === 'deploying' ? 'deploying' : 'stopped');
        return { ...s, status: nextStatus as Server['status'] };
      }));

      return data as AgentStatus;
    } catch (err) {
      console.error('[Agent Check] Failed:', err);
      return null;
    } finally {
      setCheckingAgent((prev) => ({ ...prev, [serverId]: false }));
    }
  }, []);

  const checkAllAgents = useCallback(async () => {
    const { data: agentServers } = await supabase
      .from('servers')
      .select('id')
      .not('agent_url', 'is', null);

    if (!agentServers?.length) return;

    await Promise.all(agentServers.map((s) => checkAgentStatus(s.id)));
  }, [checkAgentStatus]);

  useEffect(() => {
    fetchServers();
    fetchDeployments();
  }, [fetchServers, fetchDeployments]);

  useEffect(() => {
    if (servers.length > 0 && !heartbeatRef.current) {
      checkAllAgents();
      heartbeatRef.current = setInterval(checkAllAgents, 60000);
    }

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [servers.length, checkAllAgents]);

  return {
    servers,
    deployments,
    loading,
    agentStatuses,
    checkingAgent,
    fetchServers,
    fetchDeployments,
    createServer,
    updateServer,
    deleteServer,
    deployServer,
    stopServer,
    suspendServer,
    registerAgent,
    verifyAgent,
    checkAgentStatus,
    checkAllAgents,
  };
}
