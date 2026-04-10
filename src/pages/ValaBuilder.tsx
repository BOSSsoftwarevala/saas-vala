import { useState, useCallback, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { valaBuilderApi } from '@/lib/api';
import { useValaBuilderStateStore } from '@/hooks/useValaBuilderState';
import {
  Rocket, GitBranch, Globe, Code, Database, Bug, Wrench, Package,
  Store, Loader2, CheckCircle2, Circle, ArrowDown,
  Sparkles, Server, Shield, Zap, RotateCcw, Activity, Play, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type StepStatus = 'pending' | 'running' | 'success' | 'fail';
type BuilderAction =
  | 'create_app'
  | 'clone_software'
  | 'generate_ui'
  | 'generate_backend'
  | 'fix_errors'
  | 'build_project'
  | 'deploy_demo'
  | 'publish_marketplace';

interface WorkflowStep {
  id: string;
  label: string;
  icon: JSX.Element;
  status: StepStatus;
  result?: string;
}

interface BuilderServer {
  id: string;
  name: string;
  status: string | null;
}

interface RunLog {
  id: string;
  step_key: string;
  status: StepStatus;
  message: string;
  created_at: string;
}

const INITIAL_STEPS: WorkflowStep[] = [
  { id: 'plan', label: 'AI Planner', icon: <Sparkles className="h-4 w-4" />, status: 'pending' },
  { id: 'ui', label: 'UI Builder', icon: <Code className="h-4 w-4" />, status: 'pending' },
  { id: 'code', label: 'Code Generator', icon: <Package className="h-4 w-4" />, status: 'pending' },
  { id: 'db', label: 'Database Generator', icon: <Database className="h-4 w-4" />, status: 'pending' },
  { id: 'api', label: 'API Generator', icon: <Server className="h-4 w-4" />, status: 'pending' },
  { id: 'debug', label: 'Debug Engine', icon: <Bug className="h-4 w-4" />, status: 'pending' },
  { id: 'fix', label: 'Auto Fix Engine', icon: <Wrench className="h-4 w-4" />, status: 'pending' },
  { id: 'build', label: 'Build Engine', icon: <Package className="h-4 w-4" />, status: 'pending' },
];

export default function ValaBuilder() {
  const { state, patch, clearRunData } = useValaBuilderStateStore();
  const [steps, setSteps] = useState<WorkflowStep[]>(INITIAL_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [servers, setServers] = useState<BuilderServer[]>([]);

  const appName = state.appName;
  const prompt = state.prompt;
  const demoUrl = state.demoUrl;
  const githubUrl = state.githubUrl;
  const apkQueueId = state.apkQueueId;
  const productId = state.productId;
  const runId = state.runId;
  const runStatus = state.runStatus;
  const selectedServerId = state.selectedServerId;

  const resetPipelineState = useCallback(() => {
    setOutput([]);
    clearRunData();
    setIsRunning(false);
    setSteps(INITIAL_STEPS);
  }, [clearRunData]);

  const stepStatusFromLogs = useCallback((logs: RunLog[]) => {
    const byStep = new Map<string, { status: StepStatus; message?: string }>();
    for (const log of logs) {
      if (!INITIAL_STEPS.find((s) => s.id === log.step_key)) continue;
      byStep.set(log.step_key, { status: log.status, message: log.message });
    }

    setSteps(
      INITIAL_STEPS.map((step) => {
        const hit = byStep.get(step.id);
        return {
          ...step,
          status: hit?.status || 'pending',
          result: hit?.message,
        };
      })
    );
  }, []);

  const mapLogsToOutput = useCallback((logs: RunLog[]) => {
    const lines = logs.map((log) => {
      const t = new Date(log.created_at).toLocaleTimeString();
      const prefix = log.status === 'fail' ? '❌' : log.status === 'success' ? '✅' : log.status === 'running' ? '⏳' : 'ℹ️';
      return `[${t}] ${prefix} ${log.message}`;
    });
    setOutput(lines);
  }, []);

  const refreshRun = useCallback(async (id: string) => {
    const runResponse = await valaBuilderApi.getRun(id);
    const logsResponse = await valaBuilderApi.getRunLogs(id);

    const run = runResponse?.run;
    const logs: RunLog[] = Array.isArray(logsResponse?.logs) ? logsResponse.logs : [];

    patch({
      runStatus: (run?.status as any) || '',
      demoUrl: run?.demo_url || '',
      githubUrl: run?.github_repo_url || '',
      apkQueueId: run?.apk_build_queue_id || '',
      productId: run?.product_id || '',
    });
    setIsRunning(run?.status === 'pending' || run?.status === 'running');

    stepStatusFromLogs(logs);
    mapLogsToOutput(logs);

    if (run?.status === 'success') {
      toast.success('Pipeline completed successfully');
    }
    if (run?.status === 'fail' && run?.error_message) {
      toast.error(run.error_message);
    }
  }, [mapLogsToOutput, patch, stepStatusFromLogs]);

  const startAction = useCallback(async (action: BuilderAction) => {
    if (!appName.trim()) {
      toast.error('Enter app name first');
      return;
    }
    if ((action === 'create_app' || action === 'generate_ui' || action === 'generate_backend') && !prompt.trim()) {
      toast.error('Enter app description first');
      return;
    }

    try {
      setIsRunning(true);
      patch({ runStatus: 'pending' });
      setSteps(INITIAL_STEPS);
      setOutput([`[${new Date().toLocaleTimeString()}] 🚀 Queuing ${action}...`]);

      const sourceRef = action === 'clone_software' ? prompt.trim() : '';
      const { data, error } = await valaBuilderApi.startRun({
        action,
        app_name: appName.trim(),
        app_description: prompt.trim(),
        selected_server_id: selectedServerId || null,
        source_ref: sourceRef || undefined,
        environment: state.environment,
        template_key: state.templateKey || undefined,
        priority: state.priority,
      });

      if (error || data?.success === false) {
        throw new Error(error?.message || data?.error || 'Failed to queue run');
      }

      const newRunId = data?.run?.id;
      if (!newRunId) throw new Error('Run ID missing from orchestrator response');

      patch({ runId: newRunId });
      await refreshRun(newRunId);
    } catch (err: any) {
      setIsRunning(false);
      patch({ runStatus: 'fail' });
      toast.error(err.message || 'Failed to trigger action');
      setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ ${err.message || 'Failed to trigger action'}`]);
    }
  }, [appName, patch, prompt, refreshRun, selectedServerId, state.environment, state.priority, state.templateKey]);

  const runFullPipeline = useCallback(async () => {
    await startAction('create_app');
  }, [startAction]);

  const runSingleAction = useCallback(async (action: BuilderAction) => {
    await startAction(action);
  }, [startAction]);

  const resumeCurrentRun = useCallback(async () => {
    if (!runId) {
      toast.error('No run selected to resume');
      return;
    }

    try {
      setIsRunning(true);
      const { data, error } = await valaBuilderApi.resumeRun(runId);
      if (error || data?.success === false) {
        throw new Error(error?.message || data?.error || 'Failed to resume run');
      }
      patch({ runStatus: 'running' });
      setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ⏯️ Resume requested`]);
      await refreshRun(runId);
    } catch (err: any) {
      setIsRunning(false);
      toast.error(err.message || 'Failed to resume run');
    }
  }, [patch, refreshRun, runId]);

  const cancelCurrentRun = useCallback(async () => {
    if (!runId) {
      toast.error('No run selected to cancel');
      return;
    }

    try {
      const { data, error } = await valaBuilderApi.cancelRun(runId);
      if (error || data?.success === false) {
        throw new Error(error?.message || data?.error || 'Failed to cancel run');
      }
      patch({ runStatus: 'fail' });
      setIsRunning(false);
      setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 🛑 Cancel requested`]);
      toast.success('Cancel signal sent');
      await refreshRun(runId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel run');
    }
  }, [patch, refreshRun, runId]);

  const triggerWorkerNow = useCallback(async () => {
    try {
      const { data, error } = await valaBuilderApi.triggerWorker(2);
      if (error || data?.success === false) {
        throw new Error(error?.message || data?.error || 'Failed to trigger worker');
      }
      toast.success('Worker triggered');
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger worker');
    }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const health = await valaBuilderApi.health();
      const healthy = health?.healthy !== false;
      if (healthy) {
        toast.success('Orchestrator health OK');
      } else {
        toast.error(health?.error || 'Orchestrator unhealthy');
      }
    } catch (err: any) {
      toast.error(err.message || 'Health check failed');
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('servers')
        .select('id,name,status')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!active) return;
      setServers((data || []) as BuilderServer[]);
      if (!selectedServerId && data && data.length > 0) {
        patch({ selectedServerId: String(data[0].id) });
      }
    })();
    return () => {
      active = false;
    };
  }, [patch, selectedServerId]);

  useEffect(() => {
    if (!runId) return;
    refreshRun(runId).catch(() => null);
  }, [refreshRun, runId]);

  useEffect(() => {
    if (!runId) return;

    const channel = supabase
      .channel(`vala-builder-run-${runId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'vala_builder_step_logs',
        filter: `run_id=eq.${runId}`,
      }, () => {
        refreshRun(runId).catch(() => null);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'vala_builder_runs',
        filter: `id=eq.${runId}`,
      }, () => {
        refreshRun(runId).catch(() => null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshRun, runId]);

  useEffect(() => {
    if (!runId || !(runStatus === 'pending' || runStatus === 'running')) return;

    const timer = setInterval(() => {
      refreshRun(runId).catch(() => null);
    }, 2500);

    return () => clearInterval(timer);
  }, [refreshRun, runId, runStatus]);

  const statusBadge = useMemo(() => {
    if (!runStatus) return null;
    if (runStatus === 'success') return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">SUCCESS</Badge>;
    if (runStatus === 'fail') return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">FAILED</Badge>;
    return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">RUNNING</Badge>;
  }, [runStatus]);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">VALA AI Builder</h1>
            <p className="text-sm text-muted-foreground">Idea → Working Software → Live Demo → Marketplace</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {statusBadge}
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">AI POWERED</Badge>
          </div>
        </div>

        <Card className="border-primary/20 bg-card">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                placeholder="App Name (e.g. Clinic Manager)"
                value={appName}
                onChange={e => patch({ appName: e.target.value })}
                className="bg-background border-border"
              />
              <div className="md:col-span-2">
                <Textarea
                  placeholder="Describe your app... or paste source repo for clone"
                  value={prompt}
                  onChange={e => patch({ prompt: e.target.value })}
                  className="bg-background border-border min-h-[80px]"
                  rows={2}
                />
              </div>
              <select
                value={selectedServerId}
                onChange={(e) => patch({ selectedServerId: e.target.value })}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Auto server (factory)</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.status ? ` (${s.status})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={runFullPipeline} disabled={isRunning} className="gap-2">
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {isRunning ? 'Building...' : 'Create App (Full Pipeline)'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => runSingleAction('generate_backend')} disabled={isRunning}>
                <Code className="h-3 w-3 mr-1" /> Generate Code
              </Button>
              <Button variant="outline" size="sm" onClick={() => runSingleAction('fix_errors')} disabled={isRunning}>
                <Bug className="h-3 w-3 mr-1" /> Fix Errors
              </Button>
              <Button variant="outline" size="sm" onClick={() => runSingleAction('deploy_demo')} disabled={isRunning}>
                <Globe className="h-3 w-3 mr-1" /> Deploy Demo
              </Button>
              <Button variant="outline" size="sm" onClick={resumeCurrentRun} disabled={!runId || isRunning}>
                <RotateCcw className="h-3 w-3 mr-1" /> Resume
              </Button>
              <Button variant="outline" size="sm" onClick={cancelCurrentRun} disabled={!runId || !isRunning}>
                <XCircle className="h-3 w-3 mr-1" /> Cancel
              </Button>
              <Button variant="outline" size="sm" onClick={triggerWorkerNow}>
                <Play className="h-3 w-3 mr-1" /> Trigger Worker
              </Button>
              <Button variant="outline" size="sm" onClick={checkHealth}>
                <Activity className="h-3 w-3 mr-1" /> Health
              </Button>
              <Button variant="outline" size="sm" onClick={resetPipelineState} disabled={isRunning}>Reset</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {steps.map((step, i) => (
                <div key={step.id}>
                  <div className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm',
                    step.status === 'running' && 'bg-primary/10 text-primary',
                    step.status === 'success' && 'text-green-400',
                    step.status === 'fail' && 'text-destructive',
                    step.status === 'pending' && 'text-muted-foreground'
                  )}>
                    {step.status === 'running' ? (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    ) : step.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : step.status === 'fail' ? (
                      <Shield className="h-4 w-4 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 opacity-40" />
                    )}
                    <span className="flex-1">{step.label}</span>
                    {step.result && (
                      <span className="text-xs opacity-60 truncate max-w-[120px]">{step.result}</span>
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex justify-center py-0.5">
                      <ArrowDown className="h-3 w-3 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Output</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-background rounded-lg border border-border p-4 h-[400px] overflow-y-auto font-mono text-xs space-y-1">
                {output.length === 0 ? (
                  <p className="text-muted-foreground">Enter an app name and description, then click "Create App" to start real pipeline execution...</p>
                ) : (
                  output.map((line, i) => (
                    <div key={i} className={cn(
                      line.includes('❌') ? 'text-destructive' :
                      line.includes('✅') ? 'text-green-400' :
                      line.includes('🚀') ? 'text-primary' :
                      'text-foreground'
                    )}>{line}</div>
                  ))
                )}
              </div>

              {(demoUrl || githubUrl || apkQueueId || productId) && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {demoUrl && (
                    <a href={demoUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-2 text-green-400 border-green-500/30">
                        <Globe className="h-3 w-3" /> Live Demo
                      </Button>
                    </a>
                  )}
                  {githubUrl && (
                    <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-2">
                        <GitBranch className="h-3 w-3" /> GitHub Repo
                      </Button>
                    </a>
                  )}
                  {apkQueueId && <Badge variant="secondary">APK Queue: {apkQueueId.slice(0, 8)}...</Badge>}
                  {productId && <Badge variant="secondary">Product: {productId.slice(0, 8)}...</Badge>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Create App', icon: Rocket, color: 'text-primary', action: () => runFullPipeline() },
                { label: 'Clone Software', icon: GitBranch, color: 'text-blue-400', action: () => runSingleAction('clone_software') },
                { label: 'Generate UI', icon: Code, color: 'text-purple-400', action: () => runSingleAction('generate_ui') },
                { label: 'Generate Backend', icon: Server, color: 'text-orange-400', action: () => runSingleAction('generate_backend') },
                { label: 'Fix Errors', icon: Bug, color: 'text-red-400', action: () => runSingleAction('fix_errors') },
                { label: 'Build Project', icon: Package, color: 'text-yellow-400', action: () => runSingleAction('build_project') },
                { label: 'Deploy Demo', icon: Globe, color: 'text-green-400', action: () => runSingleAction('deploy_demo') },
                { label: 'Publish Marketplace', icon: Store, color: 'text-pink-400', action: () => runSingleAction('publish_marketplace') },
              ].map(btn => (
                <Button
                  key={btn.label}
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 hover:bg-accent/50"
                  onClick={btn.action}
                  disabled={isRunning}
                >
                  <btn.icon className={cn('h-5 w-5', btn.color)} />
                  <span className="text-xs">{btn.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">AI Models</p>
              <div className="flex flex-wrap gap-1">
                {['OpenAI (Primary)', 'Gemini (Fallback)', 'Claude (Fallback)'].map(m => (
                  <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Voice System</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-xs">Whisper STT</Badge>
                <Badge variant="secondary" className="text-xs">ElevenLabs TTS</Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Infrastructure</p>
              <div className="flex flex-wrap gap-1">
                {['GitHub', 'VPS Agent', 'Docker'].map(m => (
                  <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
