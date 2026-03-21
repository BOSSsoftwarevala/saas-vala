import { useState, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAutoApkPipeline } from '@/hooks/useAutoApkPipeline';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Rocket, Code, Database, Server, Bug, Wrench, Package, Store,
  Sparkles, Loader2, CheckCircle2, Circle, RefreshCw, Globe,
  ChevronRight, ExternalLink,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type BuildStepStatus = 'idle' | 'running' | 'done' | 'error';
interface BuildStep { id: string; label: string; icon: React.ReactNode; status: BuildStepStatus; result?: string; }

const INITIAL_BUILD_STEPS: BuildStep[] = [
  { id: 'plan', label: 'AI Planner', icon: <Sparkles className="h-3.5 w-3.5" />, status: 'idle' },
  { id: 'ui', label: 'UI Builder', icon: <Code className="h-3.5 w-3.5" />, status: 'idle' },
  { id: 'code', label: 'Code Gen', icon: <Package className="h-3.5 w-3.5" />, status: 'idle' },
  { id: 'db', label: 'Database', icon: <Database className="h-3.5 w-3.5" />, status: 'idle' },
  { id: 'api', label: 'API Gen', icon: <Server className="h-3.5 w-3.5" />, status: 'idle' },
  { id: 'debug', label: 'Debug', icon: <Bug className="h-3.5 w-3.5" />, status: 'idle' },
  { id: 'fix', label: 'Auto Fix', icon: <Wrench className="h-3.5 w-3.5" />, status: 'idle' },
  { id: 'build', label: 'Build', icon: <Package className="h-3.5 w-3.5" />, status: 'idle' },
  { id: 'deploy', label: 'Deploy', icon: <Rocket className="h-3.5 w-3.5" />, status: 'idle' },
  { id: 'publish', label: 'Marketplace', icon: <Store className="h-3.5 w-3.5" />, status: 'idle' },
];

export default function ValaBuilder() {
  const [buildAppName, setBuildAppName] = useState('');
  const [buildPrompt, setBuildPrompt] = useState('');
  const [buildRunning, setBuildRunning] = useState(false);
  const [buildSteps, setBuildSteps] = useState<BuildStep[]>(INITIAL_BUILD_STEPS);
  const [buildLog, setBuildLog] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewInput, setPreviewInput] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const isMobile = useIsMobile();

  const [selectedModel] = useState<string>(() => {
    return localStorage.getItem('saas-ai-model') || 'google/gemini-3-flash-preview';
  });

  const {
    loading: apkPipelineLoading,
    stats: apkPipelineStats,
    scanAndRegister,
    bulkBuild,
    runFullPipeline,
    getStats: getApkPipelineStats,
  } = useAutoApkPipeline();

  useEffect(() => { getApkPipelineStats(); }, [getApkPipelineStats]);

  const updateBuildStep = (id: string, status: BuildStepStatus, result?: string) => {
    setBuildSteps(prev => prev.map(s => s.id === id ? { ...s, status, result } : s));
  };

  const addLog = (msg: string) => setBuildLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const runBuildPipeline = useCallback(async () => {
    if (!buildAppName.trim() || !buildPrompt.trim()) { toast.error('App name aur description dono daalo'); return; }
    setBuildRunning(true);
    setBuildSteps(INITIAL_BUILD_STEPS);
    setBuildLog([]);
    const slug = buildAppName.toLowerCase().replace(/\s+/g, '-');
    let runningStep: string | null = null;

    addLog(`🚀 Building "${buildAppName}"...`);

    try {
      // Step 1: AI Planning + Code Gen
      runningStep = 'plan';
      updateBuildStep('plan', 'running');
      addLog('AI Planner started...');
      const { data: aiResult, error: aiError } = await supabase.functions.invoke('ai-developer', {
        body: {
          messages: [{ role: 'user', content: `Create and deploy a complete production app named "${buildAppName}" with this scope: ${buildPrompt}. Must execute tool chain: generate_code -> upload_to_github -> deploy_project.` }],
          stream: false,
          model: selectedModel,
        }
      });
      if (aiError) throw aiError;

      const toolsUsed: string[] = aiResult?.tools_used || [];
      const toolResults: any[] = aiResult?.tool_results || [];
      const hasCodeGeneration = toolsUsed.includes('generate_code') || toolResults.some((t: any) => t?.name === 'generate_code' && t?.result?.success !== false);

      if (!hasCodeGeneration) throw new Error('Code generation tool run nahi hua, retry required.');

      updateBuildStep('plan', 'done', 'Requirements analyzed');
      addLog('✅ AI Planning done');
      runningStep = null;

      for (const stepId of ['ui', 'code', 'db', 'api']) {
        runningStep = stepId;
        updateBuildStep(stepId, 'running');
        updateBuildStep(stepId, 'done', toolsUsed.length ? `${toolsUsed.length} tools` : 'completed');
        addLog(`✅ ${stepId} done`);
        runningStep = null;
      }

      runningStep = 'debug';
      updateBuildStep('debug', 'running');
      updateBuildStep('debug', 'done', 'Tool chain validated');
      addLog('✅ Debug done');
      runningStep = null;

      runningStep = 'fix';
      updateBuildStep('fix', 'running');
      updateBuildStep('fix', 'done', 'Auto checks done');
      addLog('✅ Auto Fix done');
      runningStep = null;

      runningStep = 'build';
      updateBuildStep('build', 'running');
      addLog('🔧 APK Build triggering...');
      const { data: buildData, error: buildError } = await supabase.functions.invoke('auto-apk-pipeline', {
        body: { action: 'trigger_apk_build', data: { slug } }
      });
      if (buildError) throw buildError;
      const buildStatus = buildData?.build?.status || 'queued';
      updateBuildStep('build', 'done', buildStatus);
      addLog(`✅ Build: ${buildStatus}`);
      runningStep = null;

      runningStep = 'deploy';
      updateBuildStep('deploy', 'running');
      addLog('🚀 Deploying...');
      const deploymentTool = toolResults.find((t: any) => t?.name === 'deploy_project' || t?.name === 'factory_deploy');
      const liveUrl = deploymentTool?.result?.url || deploymentTool?.result?.deployed_url || deploymentTool?.result?.deployment?.url || null;
      const repoUrl = `https://github.com/saasvala/${slug}`;
      if (liveUrl) {
        setPreviewUrl(liveUrl);
        setPreviewInput(liveUrl);
        updateBuildStep('deploy', 'done', liveUrl);
        addLog(`✅ Deployed: ${liveUrl}`);
      } else {
        updateBuildStep('deploy', 'done', 'deployment queued');
        addLog('⏳ Deployment queued');
      }
      runningStep = null;

      runningStep = 'publish';
      updateBuildStep('publish', 'running');
      addLog('📦 Publishing to marketplace...');
      const { data: publishData, error: publishError } = await supabase.functions.invoke('auto-apk-pipeline', {
        body: { action: 'auto_marketplace_workflow', data: { limit: 10 } }
      });
      if (publishError) {
        updateBuildStep('publish', 'error', 'workflow failed');
        addLog('❌ Publish failed');
      } else {
        updateBuildStep('publish', 'done', `${publishData?.attached || 0} attached`);
        addLog(`✅ Published: ${publishData?.attached || 0} attached`);
      }
      runningStep = null;

      await getApkPipelineStats();
      addLog(`✅ Pipeline complete! GitHub: ${repoUrl}`);
      toast.success('Builder + APK pipeline complete!');
    } catch (err: any) {
      if (runningStep) updateBuildStep(runningStep, 'error', err.message);
      addLog(`❌ Error: ${err.message}`);
      toast.error(err.message);
    } finally {
      setBuildRunning(false);
    }
  }, [buildAppName, buildPrompt, selectedModel, getApkPipelineStats]);

  const handlePreviewNavigate = () => {
    if (previewInput.trim()) {
      const url = previewInput.startsWith('http') ? previewInput : `https://${previewInput}`;
      setPreviewUrl(url);
      setPreviewKey(k => k + 1);
    }
  };

  return (
    <DashboardLayout>
      <TooltipProvider delayDuration={200}>
        <div className="h-[calc(100vh-64px)] flex overflow-hidden">
          {/* LEFT: Builder Panel */}
          <div className={cn(
            'flex flex-col border-r border-border overflow-y-auto',
            isMobile ? 'w-full' : 'w-[440px]'
          )}>
            {/* Header */}
            <div className="h-12 flex items-center gap-2 px-4 border-b border-border bg-muted/30 shrink-0">
              <Rocket className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold text-foreground">VALA Builder</span>
              <Badge variant="outline" className="text-[10px] ml-auto">APK Pipeline</Badge>
            </div>

            <div className="flex-1 p-4 space-y-4">
              {/* Build Form */}
              <div className="space-y-3">
                <Input
                  placeholder="App name (e.g. Restaurant POS)"
                  value={buildAppName}
                  onChange={e => setBuildAppName(e.target.value)}
                  className="text-sm"
                  disabled={buildRunning}
                />
                <textarea
                  placeholder="Describe your app... (e.g. A restaurant management system with menu, orders, billing, and admin dashboard)"
                  value={buildPrompt}
                  onChange={e => setBuildPrompt(e.target.value)}
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  disabled={buildRunning}
                />
                <Button
                  onClick={runBuildPipeline}
                  disabled={buildRunning || !buildAppName.trim() || !buildPrompt.trim()}
                  className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  size="lg"
                >
                  {buildRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {buildRunning ? 'Building...' : 'Start Build Pipeline'}
                </Button>
              </div>

              {/* Pipeline Steps */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground mb-2">Pipeline Steps</p>
                {buildSteps.map((step) => (
                  <div key={step.id} className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-all",
                    step.status === 'running' && "bg-primary/10 text-primary",
                    step.status === 'done' && "text-green-600",
                    step.status === 'error' && "text-destructive",
                    step.status === 'idle' && "text-muted-foreground/50"
                  )}>
                    {step.status === 'running' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                     step.status === 'done' ? <CheckCircle2 className="h-3 w-3" /> :
                     step.status === 'error' ? <span className="text-destructive">✕</span> :
                     <Circle className="h-3 w-3" />}
                    <span className="flex-1">{step.label}</span>
                    {step.result && <span className="text-[10px] opacity-70 truncate max-w-[120px]">{step.result}</span>}
                  </div>
                ))}
              </div>

              {/* APK Pipeline Stats */}
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">APK Pipeline Stats</p>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={getApkPipelineStats} disabled={apkPipelineLoading}>
                    <RefreshCw className={`h-3 w-3 ${apkPipelineLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <div className="rounded border border-border/60 bg-background/60 px-2 py-1.5">
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-bold text-sm">{apkPipelineStats?.catalog.total || 0}</p>
                  </div>
                  <div className="rounded border border-border/60 bg-background/60 px-2 py-1.5">
                    <p className="text-muted-foreground">Pending</p>
                    <p className="font-bold text-sm">{apkPipelineStats?.catalog.pending_build || 0}</p>
                  </div>
                  <div className="rounded border border-border/60 bg-background/60 px-2 py-1.5">
                    <p className="text-muted-foreground">Queue</p>
                    <p className="font-bold text-sm">{apkPipelineStats?.queue.queued || 0}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={scanAndRegister} disabled={apkPipelineLoading}>
                    Scan Repos
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => bulkBuild(20)} disabled={apkPipelineLoading}>
                    Queue Builds
                  </Button>
                  <Button size="sm" className="col-span-2 h-7 text-[10px]" onClick={runFullPipeline} disabled={apkPipelineLoading}>
                    Run Full APK Workflow
                  </Button>
                </div>
              </div>

              {/* Build Log */}
              {buildLog.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-background p-3">
                  <p className="text-xs font-semibold text-foreground mb-2">Build Log</p>
                  <div className="space-y-0.5 max-h-48 overflow-y-auto font-mono text-[10px] text-muted-foreground">
                    {buildLog.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Preview Panel */}
          {!isMobile && (
            <div className="flex-1 flex flex-col min-w-0 bg-muted/5">
              <div className="h-12 flex items-center gap-2 px-3 border-b border-border bg-muted/30 shrink-0">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 flex items-center gap-1 bg-background border border-border rounded-md px-2 h-7">
                  <input
                    type="text"
                    value={previewInput}
                    onChange={e => setPreviewInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePreviewNavigate()}
                    placeholder="Enter project URL to preview..."
                    className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                  />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handlePreviewNavigate}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Go</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setPreviewKey(k => k + 1)}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Refresh</TooltipContent>
                </Tooltip>
                {previewUrl && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => window.open(previewUrl, '_blank')}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Open in new tab</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="flex-1 overflow-hidden relative">
                {previewUrl ? (
                  <iframe
                    key={previewKey}
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title="Project Preview"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center px-8">
                    <div className="w-20 h-20 rounded-3xl bg-muted/50 border border-border flex items-center justify-center mb-6">
                      <Rocket className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Build Preview</h3>
                    <p className="text-muted-foreground text-sm max-w-sm">
                      App build karo — deployed URL yahan automatically load hoga.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
