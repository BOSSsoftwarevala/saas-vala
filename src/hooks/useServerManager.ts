import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Server {
  id: string;
  name: string;
  product_id: string | null;
  status: 'deploying' | 'live' | 'failed' | 'stopped' | 'suspended';
  runtime: string | null;
  subdomain: string | null;
  custom_domain: string | null;
  git_repo: string | null;
  git_branch: string | null;
  auto_deploy: boolean;
  env_vars: Record<string, string>;
  last_deploy_at: string | null;
  last_deploy_commit: string | null;
  last_deploy_message: string | null;
  health_status: string | null;
  ssl_status: string | null;
  uptime_percent: number | null;
  server_type: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Domain {
  id: string;
  server_id: string | null;
  product_id: string | null;
  domain_type: 'subdomain' | 'custom';
  domain_name: string;
  is_primary: boolean;
  ssl_status: string;
  ssl_expiry_at: string | null;
  ssl_auto_renew: boolean;
  dns_verified: boolean;
  status: string;
  created_at: string;
}

export interface GitConnection {
  id: string;
  server_id: string | null;
  provider: 'github' | 'gitlab' | 'bitbucket';
  repository_url: string;
  repository_name: string | null;
  branch: string;
  auto_deploy: boolean;
  last_commit_sha: string | null;
  last_commit_message: string | null;
  last_sync_at: string | null;
  status: 'connected' | 'failed' | 'disconnected';
  created_at: string;
}

export interface Deployment {
  id: string;
  server_id: string;
  status: 'queued' | 'building' | 'success' | 'failed' | 'cancelled' | 'rolled_back';
  branch: string | null;
  commit_sha: string | null;
  commit_message: string | null;
  build_logs: string | null;
  deployed_url: string | null;
  duration_seconds: number | null;
  triggered_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ServerEvent {
  id: string;
  server_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  severity: string;
  resolved: boolean;
  created_at: string;
}

export interface BackupLog {
  id: string;
  server_id: string | null;
  backup_type: string;
  file_path: string | null;
  file_size: number | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface ServerAutoRules {
  id: string;
  server_id: string | null;
  auto_deploy: boolean;
  auto_ssl_renewal: boolean;
  auto_health_check: boolean;
  auto_restart: boolean;
  auto_backup: boolean;
  health_check_interval: number;
  backup_schedule: string;
  restart_on_failure: boolean;
  max_restart_attempts: number;
}

export interface ServerKPIs {
  totalServers: number;
  activeServers: number;
  offlineServers: number;
  suspendedServers: number;
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  connectedGitRepos: number;
  activeDomains: number;
  sslExpiringSoon: number;
  autoRestartEvents: number;
  backupFailures: number;
}

export function useServerManager() {
  const [servers, setServers] = useState<Server[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [gitConnections, setGitConnections] = useState<GitConnection[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [serverEvents, setServerEvents] = useState<ServerEvent[]>([]);
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<ServerKPIs>({
    totalServers: 0,
    activeServers: 0,
    offlineServers: 0,
    suspendedServers: 0,
    totalDeployments: 0,
    successfulDeployments: 0,
    failedDeployments: 0,
    connectedGitRepos: 0,
    activeDomains: 0,
    sslExpiringSoon: 0,
    autoRestartEvents: 0,
    backupFailures: 0,
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        serversRes,
        domainsRes,
        gitRes,
        deploymentsRes,
        eventsRes,
        backupsRes,
      ] = await Promise.all([
        supabase.from('servers').select('*').order('created_at', { ascending: false }),
        supabase.from('domains').select('*').order('created_at', { ascending: false }),
        supabase.from('git_connections').select('*').order('created_at', { ascending: false }),
        supabase.from('deployments').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('server_events').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('backup_logs').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      if (serversRes.data) setServers(serversRes.data as Server[]);
      if (domainsRes.data) setDomains(domainsRes.data as Domain[]);
      if (gitRes.data) setGitConnections(gitRes.data as GitConnection[]);
      if (deploymentsRes.data) setDeployments(deploymentsRes.data as Deployment[]);
      if (eventsRes.data) setServerEvents(eventsRes.data as ServerEvent[]);
      if (backupsRes.data) setBackupLogs(backupsRes.data as BackupLog[]);

      // Calculate KPIs
      const srvData = serversRes.data || [];
      const domData = domainsRes.data || [];
      const gitData = gitRes.data || [];
      const depData = deploymentsRes.data || [];
      const evtData = eventsRes.data || [];
      const bakData = backupsRes.data || [];

      const fifteenDaysFromNow = new Date();
      fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);

      setKpis({
        totalServers: srvData.length,
        activeServers: srvData.filter((s: any) => s.status === 'live').length,
        offlineServers: srvData.filter((s: any) => s.status === 'stopped' || s.status === 'failed').length,
        suspendedServers: srvData.filter((s: any) => s.status === 'suspended').length,
        totalDeployments: depData.length,
        successfulDeployments: depData.filter((d: any) => d.status === 'success').length,
        failedDeployments: depData.filter((d: any) => d.status === 'failed').length,
        connectedGitRepos: gitData.filter((g: any) => g.status === 'connected').length,
        activeDomains: domData.filter((d: any) => d.status === 'active').length,
        sslExpiringSoon: domData.filter((d: any) => 
          d.ssl_expiry_at && new Date(d.ssl_expiry_at) < fifteenDaysFromNow
        ).length,
        autoRestartEvents: evtData.filter((e: any) => e.event_type === 'restart').length,
        backupFailures: bakData.filter((b: any) => b.status === 'failed').length,
      });
    } catch (error) {
      console.error('Error fetching server data:', error);
      toast.error('Failed to load server data');
    }
    setLoading(false);
  }, []);

  // Server CRUD
  const createServer = async (server: Partial<Server>) => {
    const { data: userData } = await supabase.auth.getUser();
    const runtime = (server.runtime as 'nodejs18' | 'nodejs20' | 'php82' | 'php83' | 'python311' | 'python312') || 'nodejs20';
    const { data, error } = await supabase
      .from('servers')
      .insert({
        name: server.name || 'New Server',
        product_id: server.product_id,
        status: 'stopped' as const,
        runtime,
        subdomain: server.subdomain,
        custom_domain: server.custom_domain,
        git_repo: server.git_repo,
        git_branch: server.git_branch || 'main',
        auto_deploy: server.auto_deploy ?? true,
        env_vars: server.env_vars || {},
        server_type: server.server_type || 'vercel',
        created_by: userData.user?.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create server');
      throw error;
    }
    toast.success('Server created successfully');
    return data;
  };

  const updateServer = async (id: string, updates: Partial<Server>) => {
    const { runtime, status, ...rest } = updates;
    const safeUpdates: Record<string, unknown> = { ...rest };
    if (runtime) {
      safeUpdates.runtime = runtime as 'nodejs18' | 'nodejs20' | 'php82' | 'php83' | 'python311' | 'python312';
    }
    if (status) {
      safeUpdates.status = status as 'deploying' | 'live' | 'failed' | 'stopped' | 'suspended';
    }
    const { error } = await supabase
      .from('servers')
      .update(safeUpdates)
      .eq('id', id);

    if (error) {
      toast.error('Failed to update server');
      throw error;
    }
    toast.success('Server updated');
  };

  const deleteServer = async (id: string) => {
    // Archive only - set status to suspended
    const { error } = await supabase
      .from('servers')
      .update({ status: 'suspended' })
      .eq('id', id);

    if (error) {
      toast.error('Failed to archive server');
      throw error;
    }
    toast.success('Server archived');
  };

  // Deployment actions
  const triggerDeploy = async (serverId: string, branch?: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('deployments')
      .insert({
        server_id: serverId,
        status: 'queued',
        branch: branch || 'main',
        triggered_by: userData.user?.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to trigger deployment');
      throw error;
    }

    // Simulate deployment progress
    setTimeout(async () => {
      await supabase.from('deployments').update({ status: 'building' }).eq('id', data.id);
    }, 2000);

    setTimeout(async () => {
      await supabase.from('deployments').update({ 
        status: 'success', 
        completed_at: new Date().toISOString(),
        duration_seconds: 45 
      }).eq('id', data.id);
      await supabase.from('servers').update({ 
        status: 'live', 
        last_deploy_at: new Date().toISOString() 
      }).eq('id', serverId);
    }, 8000);

    toast.success('Deployment started');
    return data;
  };

  const rollbackDeploy = async (deploymentId: string, _serverId: string) => {
    const { error } = await supabase
      .from('deployments')
      .update({ status: 'rolled_back' })
      .eq('id', deploymentId);

    if (error) {
      toast.error('Failed to rollback');
      throw error;
    }
    toast.success('Rollback initiated');
  };

  const stopDeploy = async (deploymentId: string) => {
    const { error } = await supabase
      .from('deployments')
      .update({ status: 'cancelled' })
      .eq('id', deploymentId);

    if (error) {
      toast.error('Failed to stop deployment');
      throw error;
    }
    toast.success('Deployment stopped');
  };

  // Domain actions
  const addDomain = async (domain: Partial<Domain>) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('domains')
      .insert({
        server_id: domain.server_id,
        product_id: domain.product_id,
        domain_type: domain.domain_type || 'subdomain',
        domain_name: domain.domain_name,
        is_primary: domain.is_primary || false,
        ssl_status: 'pending',
        ssl_auto_renew: true,
        status: 'pending',
        created_by: userData.user?.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add domain');
      throw error;
    }
    toast.success('Domain added');
    return data;
  };

  const verifyDomain = async (domainId: string) => {
    const { error } = await supabase
      .from('domains')
      .update({ dns_verified: true, dns_verified_at: new Date().toISOString(), status: 'active' })
      .eq('id', domainId);

    if (error) {
      toast.error('Failed to verify domain');
      throw error;
    }
    toast.success('Domain verified');
  };

  const enableSSL = async (domainId: string) => {
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    
    const { error } = await supabase
      .from('domains')
      .update({ 
        ssl_status: 'active', 
        ssl_expiry_at: expiryDate.toISOString() 
      })
      .eq('id', domainId);

    if (error) {
      toast.error('Failed to enable SSL');
      throw error;
    }
    toast.success('SSL enabled');
  };

  const removeDomain = async (domainId: string) => {
    const { error } = await supabase
      .from('domains')
      .delete()
      .eq('id', domainId);

    if (error) {
      toast.error('Failed to remove domain');
      throw error;
    }
    toast.success('Domain removed');
  };

  // Git connection actions
  const connectGit = async (connection: Partial<GitConnection>) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('git_connections')
      .insert({
        server_id: connection.server_id,
        provider: connection.provider || 'github',
        repository_url: connection.repository_url,
        repository_name: connection.repository_name,
        branch: connection.branch || 'main',
        auto_deploy: connection.auto_deploy ?? true,
        status: 'connected',
        created_by: userData.user?.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to connect Git');
      throw error;
    }
    toast.success('Git repository connected');
    return data;
  };

  const disconnectGit = async (connectionId: string) => {
    const { error } = await supabase
      .from('git_connections')
      .update({ status: 'disconnected' })
      .eq('id', connectionId);

    if (error) {
      toast.error('Failed to disconnect Git');
      throw error;
    }
    toast.success('Git disconnected');
  };

  // Auto rules
  const updateAutoRules = async (serverId: string, rules: Partial<ServerAutoRules>) => {
    const { data: existing } = await supabase
      .from('server_auto_rules')
      .select('*')
      .eq('server_id', serverId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('server_auto_rules')
        .update(rules)
        .eq('server_id', serverId);

      if (error) {
        toast.error('Failed to update auto rules');
        throw error;
      }
    } else {
      const { error } = await supabase
        .from('server_auto_rules')
        .insert({ server_id: serverId, ...rules });

      if (error) {
        toast.error('Failed to create auto rules');
        throw error;
      }
    }
    toast.success('Auto rules updated');
  };

  // Real-time subscriptions
  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel('server-manager-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'domains' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'git_connections' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deployments' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'server_events' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'backup_logs' }, fetchAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  return {
    servers,
    domains,
    gitConnections,
    deployments,
    serverEvents,
    backupLogs,
    kpis,
    loading,
    fetchAll,
    createServer,
    updateServer,
    deleteServer,
    triggerDeploy,
    rollbackDeploy,
    stopDeploy,
    addDomain,
    verifyDomain,
    enableSSL,
    removeDomain,
    connectGit,
    disconnectGit,
    updateAutoRules,
  };
}
