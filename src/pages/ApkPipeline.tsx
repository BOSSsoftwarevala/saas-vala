import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Smartphone, GitBranch, Package, Shield, RefreshCw, Rocket, CheckCircle2,
  XCircle, Clock, Loader2, Database, Key, Download, BarChart3, Wrench
} from 'lucide-react';

interface BuildItem {
  id: string;
  repo_name: string;
  repo_url: string;
  slug: string;
  target_industry: string | null;
  build_status: string;
  build_started_at: string | null;
  build_completed_at: string | null;
  build_error: string | null;
  build_attempts: number;
  apk_file_path: string | null;
  marketplace_listed: boolean;
  created_at: string;
}

interface PipelineStats {
  total: number;
  pending: number;
  building: number;
  completed: number;
  failed: number;
  listed: number;
}

export default function ApkPipeline() {
  const [builds, setBuilds] = useState<BuildItem[]>([]);
  const [stats, setStats] = useState<PipelineStats>({ total: 0, pending: 0, building: 0, completed: 0, failed: 0, listed: 0 });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchBuilds = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('apk_build_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    const items = (data || []) as BuildItem[];
    setBuilds(items);
    setStats({
      total: items.length,
      pending: items.filter(b => b.build_status === 'pending').length,
      building: items.filter(b => b.build_status === 'building').length,
      completed: items.filter(b => b.build_status === 'completed').length,
      failed: items.filter(b => b.build_status === 'failed').length,
      listed: items.filter(b => b.marketplace_listed).length,
    });
    setLoading(false);
  }, []);

  useEffect(() => { fetchBuilds(); }, [fetchBuilds]);

  const scanRepos = async () => {
    setScanning(true);
    try {
      // Scan source_code_catalog for repos not yet in build queue
      const { data: catalog } = await supabase
        .from('source_code_catalog')
        .select('slug, project_name, github_repo_url, target_industry')
        .not('slug', 'is', null)
        .limit(500);

      if (!catalog?.length) {
        toast.info('No repositories found in catalog');
        setScanning(false);
        return;
      }

      const { data: existing } = await supabase
        .from('apk_build_queue')
        .select('slug');

      const existingSlugs = new Set((existing || []).map((e: any) => e.slug));
      const newRepos = catalog.filter((r: any) => r.slug && !existingSlugs.has(r.slug));

      if (newRepos.length === 0) {
        toast.info('All repositories already in build queue');
        setScanning(false);
        return;
      }

      const inserts = newRepos.map((r: any) => ({
        repo_name: r.project_name || r.slug,
        repo_url: r.github_repo_url || `https://github.com/saasvala/${r.slug}`,
        slug: r.slug,
        target_industry: r.target_industry || 'General',
        build_status: 'pending',
      }));

      const { error } = await supabase.from('apk_build_queue').insert(inserts);
      if (error) throw error;

      toast.success(`✅ ${newRepos.length} new repos added to build queue`);
      fetchBuilds();
    } catch (err: any) {
      toast.error(err.message || 'Scan failed');
    }
    setScanning(false);
  };

  const retryBuild = async (id: string) => {
    await supabase.from('apk_build_queue').update({
      build_status: 'pending',
      build_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    toast.success('Build re-queued');
    fetchBuilds();
  };

  const [runningWorkflow, setRunningWorkflow] = useState(false);
  const [workflowResult, setWorkflowResult] = useState<any>(null);
  const [settingUpFactory, setSettingUpFactory] = useState(false);
  const [triggeringBulk, setTriggeringBulk] = useState(false);
  const [healing, setHealing] = useState(false);

  const setupFactory = async () => {
    setSettingUpFactory(true);
    toast.info('⚙️ Setting up APK Factory on GitHub...');
    try {
      const { data: result, error } = await supabase.functions.invoke('apk-factory', {
        body: { action: 'setup_factory' },
      });
      if (error) throw error;
      if (result?.success) toast.success(result.message);
      else toast.error(result?.error || 'Setup failed');
    } catch (err: any) {
      toast.error(err.message || 'Factory setup error');
    }
    setSettingUpFactory(false);
  };

  const triggerBulkBuild = async () => {
    setTriggeringBulk(true);
    toast.info('🔧 Triggering APK builds for pending repos...');
    try {
      const { data: result, error } = await supabase.functions.invoke('apk-factory', {
        body: { action: 'bulk_trigger', data: { limit: 5 } },
      });
      if (error) throw error;
      setWorkflowResult(result);
      if (result?.success) toast.success(result.message);
      else toast.error(result?.error || 'Bulk build failed');
      fetchBuilds();
    } catch (err: any) {
      toast.error(err.message || 'Bulk build error');
    }
    setTriggeringBulk(false);
  };

  const runAutoWorkflow = async () => {
    setRunningWorkflow(true);
    setWorkflowResult(null);
    toast.info('🤖 Starting Auto Marketplace Workflow: Scan → Build → Upload → Attach...');
    try {
      const { data: result, error } = await supabase.functions.invoke('auto-apk-pipeline', {
        body: { action: 'auto_marketplace_workflow', data: { limit: 50 } },
      });
      if (error) throw error;
      setWorkflowResult(result);
      if (result?.success) toast.success(result.message);
      else toast.error(result?.error || 'Workflow failed');
      fetchBuilds();
    } catch (err: any) {
      toast.error(err.message || 'Workflow error');
    }
    setRunningWorkflow(false);
  };

  const runSelfHeal = async () => {
    setHealing(true);
    toast.info('🛠️ Running self-healing module...');
    try {
      const { data: result, error } = await supabase.functions.invoke('auto-apk-pipeline', {
        body: { action: 'self_heal_pipeline', data: { limit: 200, stale_minutes: 90, retry_limit: 3 } },
      });
      if (error) throw error;
      setWorkflowResult(result);
      if (result?.success) toast.success(result.message || 'Self-heal completed');
      else toast.error(result?.error || 'Self-heal failed');
      fetchBuilds();
    } catch (err: any) {
      toast.error(err.message || 'Self-heal error');
    }
    setHealing(false);
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'building': return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusBadge = (s: string) => {
    const variants: Record<string, string> = {
      completed: 'bg-green-500/10 text-green-500 border-green-500/20',
      failed: 'bg-destructive/10 text-destructive border-destructive/20',
      building: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      pending: 'bg-muted text-muted-foreground border-border',
    };
    return <Badge variant="outline" className={variants[s] || variants.pending}>{s.toUpperCase()}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              <Smartphone className="h-6 w-6 text-primary" />
              APK Build Pipeline
            </h1>
            <p className="text-sm text-muted-foreground">
              Auto-convert Git repos → Offline Android APKs → Marketplace listing
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={fetchBuilds} disabled={loading} size="sm">
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={scanRepos} disabled={scanning} variant="outline" size="sm">
              <GitBranch className="h-4 w-4 mr-1" />
              {scanning ? 'Scanning...' : 'Scan Repos'}
            </Button>
            <Button onClick={setupFactory} disabled={settingUpFactory} variant="outline" size="sm">
              <Shield className="h-4 w-4 mr-1" />
              {settingUpFactory ? 'Setting up...' : 'Setup Factory'}
            </Button>
            <Button onClick={triggerBulkBuild} disabled={triggeringBulk} variant="secondary" size="sm">
              <Package className="h-4 w-4 mr-1" />
              {triggeringBulk ? 'Triggering...' : 'Build 5 APKs'}
            </Button>
            <Button onClick={runAutoWorkflow} disabled={runningWorkflow} className="bg-green-600 hover:bg-green-700 text-white" size="sm">
              <Rocket className="h-4 w-4 mr-1" />
              {runningWorkflow ? 'Running...' : '🚀 Auto Workflow'}
            </Button>
            <Button onClick={runSelfHeal} disabled={healing} className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">
              <Wrench className="h-4 w-4 mr-1" />
              {healing ? 'Healing...' : '🛠️ Self Heal'}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: 'Total Repos', value: stats.total, icon: GitBranch, color: 'text-foreground' },
            { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-muted-foreground' },
            { label: 'Building', value: stats.building, icon: Loader2, color: 'text-yellow-500' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-green-500' },
            { label: 'Failed', value: stats.failed, icon: XCircle, color: 'text-destructive' },
            { label: 'On Marketplace', value: stats.listed, icon: Package, color: 'text-primary' },
          ].map(s => (
            <Card key={s.label} className="border-border/40">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <div>
                  <p className="text-2xl font-black">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pipeline Flow Diagram */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Rocket className="h-4 w-4" /> Pipeline Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
              {[
                { icon: GitBranch, label: 'Git Repo' },
                { icon: Database, label: 'Scan & Register' },
                { icon: Smartphone, label: 'Capacitor Wrap' },
                { icon: BarChart3, label: 'Gradle Build' },
                { icon: Download, label: 'APK Storage' },
                { icon: Key, label: 'License Gate' },
                { icon: Shield, label: 'Marketplace' },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-background border border-border">
                    <step.icon className="h-3.5 w-3.5 text-primary" />
                    {step.label}
                  </span>
                  {i < 6 && <span className="text-muted-foreground">→</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Workflow Result */}
        {workflowResult && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Rocket className="h-4 w-4 text-primary" /> Auto Workflow Result
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              {[
                { label: 'Processed', value: workflowResult.processed || 0 },
                { label: 'Built', value: workflowResult.built || 0 },
                { label: 'Uploaded', value: workflowResult.uploaded || 0 },
                { label: 'Attached', value: workflowResult.attached || 0 },
                { label: 'Skipped', value: workflowResult.skipped || 0 },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xl font-black">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </CardContent>
            {workflowResult?.summary && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  {[
                    { label: 'Slug Fixes', value: workflowResult.summary.slugs_repaired || 0 },
                    { label: 'Stale Recovered', value: workflowResult.summary.stale_recovered || 0 },
                    { label: 'Failed Retried', value: workflowResult.summary.failed_retried || 0 },
                    { label: 'Queue Repaired', value: workflowResult.summary.missing_queue_fixed || 0 },
                    { label: 'APK Attached', value: workflowResult.summary.apk_attached || 0 },
                    { label: 'Rebuild Queued', value: workflowResult.summary.rebuilds_queued || 0 },
                    { label: 'Feature Gaps', value: workflowResult.summary.feature_gaps_found || 0 },
                    { label: 'Patch Queued', value: workflowResult.summary.feature_patch_queued || 0 },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xl font-black">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Build Queue Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold">Build Queue ({builds.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground text-[11px]">
                    <th className="text-left p-3">REPO</th>
                    <th className="text-left p-3">INDUSTRY</th>
                    <th className="text-left p-3">STATUS</th>
                    <th className="text-left p-3">ATTEMPTS</th>
                    <th className="text-left p-3">LISTED</th>
                    <th className="text-right p-3">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {builds.map(b => (
                    <tr key={b.id} className="border-b border-border/20 hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {statusIcon(b.build_status)}
                          <div>
                            <p className="font-bold text-foreground">{b.repo_name}</p>
                            <p className="text-[10px] text-muted-foreground">{b.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">{b.target_industry || 'General'}</Badge>
                      </td>
                      <td className="p-3">{statusBadge(b.build_status)}</td>
                      <td className="p-3 text-muted-foreground">{b.build_attempts}</td>
                      <td className="p-3">
                        {b.marketplace_listed ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">LISTED</Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {b.build_status === 'failed' && (
                          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => retryBuild(b.id)}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Retry
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {builds.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No builds yet. Click "Scan Repos" to start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <p className="text-[10px] text-center text-muted-foreground">
          Powered by Software Vala™ — Auto APK Build Pipeline
        </p>
      </div>
    </DashboardLayout>
  );
}
