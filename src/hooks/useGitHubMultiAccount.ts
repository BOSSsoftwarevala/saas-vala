import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface GitHubRepo {
  account: string;
  name: string;
  fullName: string;
  url: string;
  language: string | null;
  updatedAt: string;
  stars: number;
  issues: number;
}

interface AccountStatus {
  name: string;
  email: string;
  connected: boolean;
}

interface MonitoringData {
  account: string;
  totalRepos: number;
  activeToday: number;
  failedDeployments: number;
  openIssues: number;
  recentActivity: unknown[];
}

interface DeploymentResult {
  account: string;
  repo: string;
  status: string;
  message: string;
}

interface SyncResult {
  account: string;
  totalRepos: number;
  synced: number;
  updated: string[];
}

interface DailyReport {
  date: string;
  accounts: {
    name: string;
    totalProjects: number;
    activeToday: number;
    topLanguages: { [key: string]: number };
    recentActivity: unknown[];
    deploymentStatus: { success: number; failed: number; pending: number };
  }[];
  summary: {
    totalProjects: number;
    totalActiveToday: number;
    totalDeployments: number;
    healthScore: number;
  };
}

export function useGitHubMultiAccount() {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AccountStatus[]>([]);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [monitoring, setMonitoring] = useState<MonitoringData[]>([]);
  const [report, setReport] = useState<DailyReport | null>(null);

  // Get connected account status
  const getAccountStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-multi-account', {
        body: { action: 'get_account_status' }
      });

      if (error) throw error;

      setAccounts(data.connected || []);
      return data;
    } catch (error) {
      console.error('Failed to get account status:', error);
      toast.error('Failed to check GitHub accounts');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // List all projects from all accounts
  const listAllProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-multi-account', {
        body: { action: 'list_all_projects' }
      });

      if (error) throw error;

      setRepos(data.recentRepos || []);
      setTotalProjects(data.totalProjects || 0);
      toast.success(`📂 Found ${data.totalProjects} projects across ${data.accounts?.length || 0} accounts`);
      return data;
    } catch (error) {
      console.error('Failed to list projects:', error);
      toast.error('Failed to fetch projects');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Monitor all projects
  const monitorProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-multi-account', {
        body: { action: 'monitor_projects' }
      });

      if (error) throw error;

      setMonitoring(data.monitoring || []);
      
      const totalActive = data.monitoring?.reduce((sum: number, m: MonitoringData) => sum + m.activeToday, 0) || 0;
      const totalFailed = data.monitoring?.reduce((sum: number, m: MonitoringData) => sum + m.failedDeployments, 0) || 0;
      
      if (totalFailed > 0) {
        toast.warning(`⚠️ ${totalFailed} repos have failed deployments`);
      } else {
        toast.success(`✅ ${totalActive} repos active today`);
      }
      
      return data;
    } catch (error) {
      console.error('Failed to monitor projects:', error);
      toast.error('Failed to monitor projects');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-deploy updates
  const autoDeploy = useCallback(async (repoFullName?: string, accountName?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-multi-account', {
        body: { 
          action: 'auto_deploy',
          data: repoFullName ? { repoFullName, accountName } : undefined
        }
      });

      if (error) throw error;

      const triggered = (data.deployments as DeploymentResult[])?.filter(d => d.status === 'triggered').length || 0;
      toast.success(`🚀 ${triggered} deployments triggered`);
      
      return data;
    } catch (error) {
      console.error('Failed to auto-deploy:', error);
      toast.error('Failed to trigger deployments');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync projects to database
  const syncProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-multi-account', {
        body: { action: 'sync_projects' }
      });

      if (error) throw error;

      const totalSynced = (data.sync as SyncResult[])?.reduce((sum, s) => sum + s.synced, 0) || 0;
      toast.success(`🔄 ${totalSynced} projects synced to database`);
      
      return data;
    } catch (error) {
      console.error('Failed to sync projects:', error);
      toast.error('Failed to sync projects');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate daily report
  const generateDailyReport = useCallback(async (userId?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-multi-account', {
        body: { 
          action: 'generate_daily_report',
          data: { userId }
        }
      });

      if (error) throw error;

      setReport(data.report);
      toast.success(`📊 Daily report generated - Health: ${data.report?.summary?.healthScore}%`);
      
      return data.report;
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate report');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Bulk set visibility (public/private) for all repos
  const bulkSetVisibility = useCallback(async (visibility: 'public' | 'private' = 'public', account = 'SaaSVala') => {
    setLoading(true);
    toast.info(`🔄 Making all ${account} repos ${visibility}...`);

    let offset = 0;
    let hasMore = true;
    let totalUpdated = 0;
    let totalFailed = 0;

    while (hasMore) {
      try {
        const { data, error } = await supabase.functions.invoke('github-multi-account', {
          body: {
            action: 'bulk_set_visibility',
            data: { visibility, account, batch_size: 30, offset },
          },
        });

        if (error) throw error;

        totalUpdated += data.updated;
        totalFailed += data.failed;
        hasMore = data.has_more;
        offset = data.next_offset;

        toast.success(`Batch done: ${data.updated} updated, ${data.failed} failed. ${hasMore ? 'Continuing...' : 'Done!'}`);

        if (hasMore) await new Promise(r => setTimeout(r, 1000));
      } catch (err: any) {
        toast.error(`Visibility change failed: ${err.message}`);
        hasMore = false;
      }
    }

    toast.success(`✅ Visibility update complete! ${totalUpdated} repos made ${visibility}, ${totalFailed} failed.`);
    setLoading(false);
  }, []);

  // Run full automation cycle
  const runFullAutomation = useCallback(async () => {
    setLoading(true);
    toast.info('🤖 Starting full automation cycle...');
    
    try {
      await listAllProjects();
      await syncProjects();
      await monitorProjects();
      await autoDeploy();
      await generateDailyReport();
      
      toast.success('✅ Full automation cycle completed!');
    } catch (error) {
      console.error('Automation cycle failed:', error);
      toast.error('Automation cycle failed');
    } finally {
      setLoading(false);
    }
  }, [listAllProjects, syncProjects, monitorProjects, autoDeploy, generateDailyReport]);

  return {
    loading,
    accounts,
    repos,
    totalProjects,
    monitoring,
    report,
    getAccountStatus,
    listAllProjects,
    monitorProjects,
    autoDeploy,
    syncProjects,
    generateDailyReport,
    runFullAutomation,
    bulkSetVisibility,
  };
}
