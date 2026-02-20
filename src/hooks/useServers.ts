import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

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

  const fetchServers = async () => {
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
  };

  const fetchDeployments = async (serverId?: string) => {
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
  };

  const createServer = async (server: Partial<Server>) => {
    const { data: userData } = await supabase.auth.getUser();
    
    // Generate subdomain from name
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
        created_by: userData.user?.id
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create server');
      throw error;
    }
    toast.success('Server created: ' + subdomain + '.saasvala.com');
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
    
    // Create deployment record
    const { error } = await supabase
      .from('deployments')
      .insert({
        server_id: id,
        status: 'building',
        triggered_by: userData.user?.id
      });

    if (error) {
      toast.error('Failed to trigger deployment');
      throw error;
    }

    // Update server status
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

  useEffect(() => {
    fetchServers();
    fetchDeployments();
  }, []);

  return {
    servers,
    deployments,
    loading,
    fetchServers,
    fetchDeployments,
    createServer,
    updateServer,
    deleteServer,
    deployServer,
    stopServer,
    suspendServer
  };
}
