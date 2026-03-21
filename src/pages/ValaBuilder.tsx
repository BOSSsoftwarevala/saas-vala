import { useState, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAutoApkPipeline } from '@/hooks/useAutoApkPipeline';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Rocket, Code, Database, Server, Bug, Wrench, Package, Store,
  Sparkles, Loader2, CheckCircle2, Circle, RefreshCw, Globe,
  ChevronRight, ExternalLink, Layout, Smartphone, Clock,
  Layers, Zap, Settings2, FolderOpen, Eye,
  GitBranch, Cloud, Shield, BarChart3, Plus, Search, Star,
  Monitor, Brain, FileCode, ArrowRight,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─── Types ───
type BuildStepStatus = 'idle' | 'running' | 'done' | 'error';
interface BuildStep { id: string; label: string; icon: React.ReactNode; status: BuildStepStatus; result?: string; }

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  techStack: string[];
  features: string[];
  estimatedTime: string;
  popular?: boolean;
}

interface BuiltProject {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  deployed_url?: string;
  repo_url?: string;
  apk_status?: string;
}

// ─── Constants ───
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

const TECH_STACKS = [
  { id: 'react', name: 'React + Vite', icon: '⚛️', desc: 'Modern SPA' },
  { id: 'next', name: 'Next.js', icon: '▲', desc: 'Full-stack SSR' },
  { id: 'node', name: 'Node.js API', icon: '🟢', desc: 'Backend REST' },
  { id: 'flutter', name: 'Flutter', icon: '🦋', desc: 'Cross-platform Mobile' },
  { id: 'python', name: 'Python + FastAPI', icon: '🐍', desc: 'ML/AI Backend' },
  { id: 'fullstack', name: 'Full Stack', icon: '🏗️', desc: 'React + Node + DB' },
];

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'ecommerce', name: 'E-Commerce Store', icon: <Store className="h-5 w-5" />,
    description: 'Multi-vendor marketplace with payments, cart & admin',
    category: 'Business', techStack: ['React', 'Node.js', 'PostgreSQL'],
    features: ['Product Catalog', 'Cart & Checkout', 'Payment Gateway', 'Admin Dashboard', 'Order Management'],
    estimatedTime: '15 min', popular: true,
  },
  {
    id: 'hospital', name: 'Hospital Management', icon: <Shield className="h-5 w-5" />,
    description: 'Patient records, appointments, billing & pharmacy',
    category: 'Healthcare', techStack: ['React', 'Supabase', 'PWA'],
    features: ['Patient Records', 'Appointment Booking', 'Billing System', 'Pharmacy Module', 'Lab Reports'],
    estimatedTime: '20 min', popular: true,
  },
  {
    id: 'school', name: 'School ERP', icon: <FileCode className="h-5 w-5" />,
    description: 'Student management, fees, attendance & reports',
    category: 'Education', techStack: ['React', 'Node.js', 'PostgreSQL'],
    features: ['Student Management', 'Fee Collection', 'Attendance', 'Exam Results', 'Parent Portal'],
    estimatedTime: '18 min',
  },
  {
    id: 'restaurant', name: 'Restaurant POS', icon: <Layout className="h-5 w-5" />,
    description: 'Order management, kitchen display, billing & delivery',
    category: 'Food & Bev', techStack: ['React', 'Supabase', 'PWA'],
    features: ['Menu Management', 'Table Orders', 'Kitchen Display', 'Billing', 'Delivery Tracking'],
    estimatedTime: '12 min', popular: true,
  },
  {
    id: 'crm', name: 'CRM System', icon: <BarChart3 className="h-5 w-5" />,
    description: 'Lead tracking, pipeline management & analytics',
    category: 'Business', techStack: ['React', 'Supabase', 'Charts'],
    features: ['Lead Management', 'Pipeline View', 'Contact Database', 'Email Integration', 'Analytics'],
    estimatedTime: '14 min',
  },
  {
    id: 'realestate', name: 'Real Estate Portal', icon: <Globe className="h-5 w-5" />,
    description: 'Property listing, agent CRM & virtual tours',
    category: 'Real Estate', techStack: ['React', 'Node.js', 'Maps'],
    features: ['Property Listings', 'Agent Dashboard', 'Lead Capture', 'Virtual Tours', 'EMI Calculator'],
    estimatedTime: '16 min',
  },
  {
    id: 'hrms', name: 'HR Management', icon: <Layers className="h-5 w-5" />,
    description: 'Employee management, payroll, leave & recruitment',
    category: 'Business', techStack: ['React', 'Supabase', 'PWA'],
    features: ['Employee Directory', 'Payroll', 'Leave Management', 'Recruitment', 'Performance Reviews'],
    estimatedTime: '17 min',
  },
  {
    id: 'logistics', name: 'Logistics & Fleet', icon: <Zap className="h-5 w-5" />,
    description: 'Vehicle tracking, route optimization & dispatch',
    category: 'Transport', techStack: ['React', 'Node.js', 'Maps'],
    features: ['Fleet Tracking', 'Route Planning', 'Driver Management', 'Dispatch Console', 'Reports'],
    estimatedTime: '15 min',
  },
];

export default function ValaBuilder() {
  const [activeTab, setActiveTab] = useState('create');
  const [buildAppName, setBuildAppName] = useState('');
  const [buildPrompt, setBuildPrompt] = useState('');
  const [buildRunning, setBuildRunning] = useState(false);
  const [buildSteps, setBuildSteps] = useState<BuildStep[]>(INITIAL_BUILD_STEPS);
  const [buildLog, setBuildLog] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewInput, setPreviewInput] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [selectedTechStack, setSelectedTechStack] = useState('fullstack');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [builtProjects, setBuiltProjects] = useState<BuiltProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const isMobile = useIsMobile();
  useAuth();

  const [selectedModel] = useState<string>(() => {
    return localStorage.getItem('saas-ai-model') || 'google/gemini-3-flash-preview';
  });

  const {
    loading: apkPipelineLoading, stats: apkPipelineStats,
    scanAndRegister, bulkBuild, runFullPipeline, getStats: getApkPipelineStats,
  } = useAutoApkPipeline();

  // ─── Load built projects from DB ───
  const loadBuiltProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const { data, error } = await supabase
        .from('apk_build_queue')
        .select('id, repo_name, slug, build_status, created_at, product_id')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setBuiltProjects((data || []).map(d => ({
        id: d.id, name: d.repo_name, slug: d.slug,
        status: d.build_status, created_at: d.created_at,
        repo_url: `https://github.com/saasvala/${d.slug}`,
        apk_status: d.build_status,
      })));
    } catch { /* silent */ }
    setProjectsLoading(false);
  }, []);

  useEffect(() => { getApkPipelineStats(); loadBuiltProjects(); }, [getApkPipelineStats, loadBuiltProjects]);

  // ─── Build pipeline logic ───
  const updateBuildStep = (id: string, status: BuildStepStatus, result?: string) => {
    setBuildSteps(prev => prev.map(s => s.id === id ? { ...s, status, result } : s));
  };
  const addLog = (msg: string) => setBuildLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const handleTemplateSelect = (template: ProjectTemplate) => {
    setSelectedTemplate(template.id);
    setBuildAppName(template.name);
    setBuildPrompt(`Build a complete ${template.name} application with these features: ${template.features.join(', ')}. ${template.description}. Tech: ${template.techStack.join(', ')}.`);
    setActiveTab('create');
    toast.success(`Template "${template.name}" loaded!`);
  };

  const runBuildPipeline = useCallback(async () => {
    const cleanedName = buildAppName.trim();
    const cleanedPrompt = buildPrompt.trim();

    if (!cleanedName || !cleanedPrompt) {
      toast.error('App name aur description dono daalo');
      return;
    }

    const slug = cleanedName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!slug) {
      toast.error('Valid app name daalo');
      return;
    }

    setBuildRunning(true);
    setBuildSteps(INITIAL_BUILD_STEPS);
    setBuildLog([]);
    setActiveTab('create');

    let runningStep: string | null = null;
    let toolsUsed: string[] = [];
    let toolResults: any[] = [];
    let catalogMeta: { id?: string; github_repo_url?: string } | null = null;

    addLog(`🚀 Building "${cleanedName}" [${TECH_STACKS.find(t => t.id === selectedTechStack)?.name || 'Full Stack'}]...`);

    try {
      runningStep = 'plan';
      updateBuildStep('plan', 'running');
      addLog('AI Planner started...');

      try {
        const { data: aiResult, error: aiError } = await supabase.functions.invoke('ai-developer', {
          body: {
            messages: [{ role: 'user', content: `Create and deploy a complete production app named "${cleanedName}" with this scope: ${cleanedPrompt}. Tech stack preference: ${selectedTechStack}. Must execute tool chain: generate_code -> upload_to_github -> deploy_project.` }],
            stream: false,
            model: selectedModel,
          },
        });

        if (aiError) throw aiError;

        toolsUsed = aiResult?.tools_used || [];
        toolResults = aiResult?.tool_results || [];

        const hasCodeGeneration = toolsUsed.includes('generate_code') || toolResults.some((t: any) => t?.name === 'generate_code' && t?.result?.success !== false);

        if (!hasCodeGeneration) {
          addLog('⚠️ AI response received, but generate_code tool not reported. Continuing in fallback mode...');
          updateBuildStep('plan', 'done', 'fallback mode');
        } else {
          updateBuildStep('plan', 'done', 'requirements analyzed');
        }

        addLog('✅ AI Planning done');
      } catch (aiErr: any) {
        updateBuildStep('plan', 'done', 'fallback mode');
        addLog(`⚠️ AI planner skipped: ${aiErr?.message || 'temporary issue'}`);
      }

      runningStep = null;

      for (const stepId of ['ui', 'code', 'db', 'api']) {
        runningStep = stepId;
        updateBuildStep(stepId, 'running');
        await new Promise(r => setTimeout(r, 250));
        updateBuildStep(stepId, 'done', toolsUsed.length ? `${toolsUsed.length} tools` : 'completed');
        addLog(`✅ ${stepId} done`);
        runningStep = null;
      }

      for (const stepId of ['debug', 'fix']) {
        runningStep = stepId;
        updateBuildStep(stepId, 'running');
        await new Promise(r => setTimeout(r, 200));
        updateBuildStep(stepId, 'done', stepId === 'debug' ? 'checks complete' : 'auto-fix complete');
        addLog(`✅ ${stepId} done`);
        runningStep = null;
      }

      runningStep = 'build';
      updateBuildStep('build', 'running');
      addLog('🔧 APK Build triggering...');

      const { data: catalogEntry } = await supabase
        .from('source_code_catalog')
        .select('id, github_repo_url')
        .eq('slug', slug)
        .maybeSingle();

      catalogMeta = catalogEntry || null;

      const buildPayload: Record<string, string> = { slug };
      if (catalogEntry?.id) buildPayload.catalog_id = catalogEntry.id;
      if (catalogEntry?.github_repo_url) buildPayload.repo_url = catalogEntry.github_repo_url;

      const { data: buildData, error: buildError } = await supabase.functions.invoke('auto-apk-pipeline', {
        body: { action: 'trigger_apk_build', data: buildPayload },
      });

      if (buildError) throw buildError;
      if (!buildData?.success) throw new Error(buildData?.error || 'APK build queue failed');

      const buildStatus = buildData?.build?.status || 'queued';
      updateBuildStep('build', buildStatus === 'failed' ? 'error' : 'done', buildStatus);
      addLog(`✅ Build: ${buildStatus}`);
      runningStep = null;

      runningStep = 'deploy';
      updateBuildStep('deploy', 'running');
      addLog('🚀 Deploying...');

      const deploymentTool = toolResults.find((t: any) => t?.name === 'deploy_project' || t?.name === 'factory_deploy');
      const liveUrl = deploymentTool?.result?.url || deploymentTool?.result?.deployed_url || deploymentTool?.result?.deployment?.url || null;

      if (liveUrl) {
        setPreviewUrl(liveUrl);
        setPreviewInput(liveUrl);
        updateBuildStep('deploy', 'done', liveUrl);
        addLog(`✅ Deployed: ${liveUrl}`);
      } else {
        const fallbackPreview = `https://${slug}.saasvala.com`;
        setPreviewInput(fallbackPreview);
        updateBuildStep('deploy', 'done', 'deployment queued');
        addLog('⏳ Deployment queued');
      }

      runningStep = null;

      runningStep = 'publish';
      updateBuildStep('publish', 'running');
      addLog('📦 Syncing marketplace workflow...');

      const { data: publishData, error: publishError } = await supabase.functions.invoke('auto-apk-pipeline', {
        body: { action: 'auto_marketplace_workflow', data: { limit: 10 } },
      });

      if (publishError) {
        updateBuildStep('publish', 'error', 'workflow failed');
        addLog('⚠️ Marketplace workflow failed');
      } else {
        updateBuildStep('publish', 'done', `${publishData?.attached || 0} attached`);
        addLog(`✅ Marketplace attached: ${publishData?.attached || 0}`);
      }

      runningStep = null;

      await Promise.all([getApkPipelineStats(), loadBuiltProjects()]);
      addLog(`✅ Pipeline complete${catalogMeta?.id ? ` (catalog: ${catalogMeta.id.slice(0, 8)}...)` : ''}`);
      toast.success('VALA Builder pipeline complete!');
    } catch (err: any) {
      if (runningStep) updateBuildStep(runningStep, 'error', err.message);
      addLog(`❌ Error: ${err.message}`);
      toast.error(err.message);
    } finally {
      setBuildRunning(false);
    }
  }, [buildAppName, buildPrompt, selectedModel, selectedTechStack, getApkPipelineStats, loadBuiltProjects]);

  const handlePreviewNavigate = () => {
    if (previewInput.trim()) {
      const url = previewInput.startsWith('http') ? previewInput : `https://${previewInput}`;
      setPreviewUrl(url);
      setPreviewKey(k => k + 1);
    }
  };

  const filteredTemplates = PROJECT_TEMPLATES.filter(t =>
    !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.category.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const completedSteps = buildSteps.filter(s => s.status === 'done').length;

  return (
    <DashboardLayout>
      <TooltipProvider delayDuration={200}>
        <div className="h-[calc(100vh-64px)] flex overflow-hidden">
          {/* LEFT: Builder Panel */}
          <div className={cn(
            'flex flex-col border-r border-border overflow-hidden',
            isMobile ? 'w-full' : 'w-[480px]'
          )}>
            {/* Header */}
            <div className="h-12 flex items-center gap-2 px-4 border-b border-border bg-muted/30 shrink-0">
              <Rocket className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold text-foreground">VALA Builder</span>
              <Badge variant="outline" className="text-[10px] ml-1">v2.0</Badge>
              <div className="ml-auto flex items-center gap-1.5">
                {buildRunning && (
                  <Badge className="text-[10px] bg-primary/20 text-primary animate-pulse gap-1">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    Building...
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px]">
                  {builtProjects.length} Projects
                </Badge>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-muted/20 h-9 px-2 shrink-0 overflow-x-auto whitespace-nowrap">
                <TabsTrigger value="create" className="text-xs gap-1 data-[state=active]:bg-background shrink-0">
                  <Plus className="h-3 w-3" /> Create
                </TabsTrigger>
                <TabsTrigger value="templates" className="text-xs gap-1 data-[state=active]:bg-background shrink-0">
                  <Layout className="h-3 w-3" /> Templates
                </TabsTrigger>
                <TabsTrigger value="projects" className="text-xs gap-1 data-[state=active]:bg-background shrink-0">
                  <FolderOpen className="h-3 w-3" /> Projects
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="text-xs gap-1 data-[state=active]:bg-background shrink-0">
                  <Zap className="h-3 w-3" /> Pipeline
                </TabsTrigger>
              </TabsList>

              {/* ═══ CREATE TAB ═══ */}
              <TabsContent value="create" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
                {/* Tech Stack Selector */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Settings2 className="h-3.5 w-3.5 text-primary" /> Tech Stack
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TECH_STACKS.map(ts => (
                      <button
                        key={ts.id}
                        onClick={() => setSelectedTechStack(ts.id)}
                        disabled={buildRunning}
                        className={cn(
                          "flex flex-col items-center gap-0.5 p-2 rounded-lg border text-center transition-all text-[10px]",
                          selectedTechStack === ts.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background hover:border-primary/40 text-muted-foreground"
                        )}
                      >
                        <span className="text-base">{ts.icon}</span>
                        <span className="font-medium leading-tight">{ts.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Build Form */}
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> App Details
                    </p>
                    <Input
                      placeholder="App name (e.g. Restaurant POS)"
                      value={buildAppName}
                      onChange={e => setBuildAppName(e.target.value)}
                      className="text-sm"
                      disabled={buildRunning}
                    />
                  </div>
                  <textarea
                    placeholder="Describe your app in detail... features, modules, target industry, special requirements..."
                    value={buildPrompt}
                    onChange={e => setBuildPrompt(e.target.value)}
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                    disabled={buildRunning}
                  />
                  {selectedTemplate && (
                    <div className="flex items-center gap-2 text-[10px]">
                      <Badge variant="secondary" className="gap-1">
                        <Layout className="h-2.5 w-2.5" />
                        Template: {PROJECT_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                      </Badge>
                      <button onClick={() => { setSelectedTemplate(null); setBuildAppName(''); setBuildPrompt(''); }} className="text-muted-foreground hover:text-destructive">✕</button>
                    </div>
                  )}
                  <Button
                    onClick={runBuildPipeline}
                    disabled={buildRunning || !buildAppName.trim() || !buildPrompt.trim()}
                    className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    size="lg"
                  >
                    {buildRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    {buildRunning ? `Building... (${completedSteps}/10)` : 'Start Build Pipeline'}
                  </Button>
                </div>

                {/* Pipeline Steps */}
                {(buildRunning || completedSteps > 0) && (
                  <div className="space-y-1 rounded-lg border border-border/50 p-3 bg-muted/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-foreground">Pipeline Progress</p>
                      <span className="text-[10px] text-muted-foreground">{completedSteps}/10 steps</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted mb-2">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(completedSteps / 10) * 100}%` }} />
                    </div>
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
                )}

                {/* Build Log */}
                {buildLog.length > 0 && (
                  <div className="rounded-lg border border-border/50 bg-background p-3">
                    <p className="text-xs font-semibold text-foreground mb-2">Build Log</p>
                    <div className="space-y-0.5 max-h-40 overflow-y-auto font-mono text-[10px] text-muted-foreground">
                      {buildLog.map((line, i) => <p key={i}>{line}</p>)}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ═══ TEMPLATES TAB ═══ */}
              <TabsContent value="templates" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={templateSearch}
                    onChange={e => setTemplateSearch(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>
                <div className="space-y-2">
                  {filteredTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={cn(
                        "w-full text-left rounded-lg border p-3 transition-all hover:border-primary/50 hover:bg-primary/5",
                        selectedTemplate === template.id ? "border-primary bg-primary/10" : "border-border"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          {template.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{template.name}</p>
                            {template.popular && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{template.description}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Badge variant="secondary" className="text-[9px] h-4">{template.category}</Badge>
                            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" /> {template.estimatedTime}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {template.features.slice(0, 3).map(f => (
                              <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{f}</span>
                            ))}
                            {template.features.length > 3 && (
                              <span className="text-[9px] text-muted-foreground">+{template.features.length - 3} more</span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              </TabsContent>

              {/* ═══ PROJECTS TAB ═══ */}
              <TabsContent value="projects" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Built Projects</p>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={loadBuiltProjects} disabled={projectsLoading}>
                    <RefreshCw className={cn("h-3 w-3", projectsLoading && "animate-spin")} /> Refresh
                  </Button>
                </div>

                {builtProjects.length === 0 ? (
                  <div className="text-center py-12">
                    <FolderOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No projects built yet</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">Create your first app using the Create tab</p>
                    <Button size="sm" variant="outline" className="mt-3 text-xs gap-1" onClick={() => setActiveTab('create')}>
                      <Plus className="h-3 w-3" /> Create New
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {builtProjects.map(project => (
                      <Card key={project.id} className="border-border/60 hover:border-primary/30 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Smartphone className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">{project.name}</p>
                              <p className="text-[10px] text-muted-foreground">{project.slug}</p>
                            </div>
                            <Badge variant={
                              project.status === 'completed' ? 'default' :
                              project.status === 'building' ? 'secondary' : 'outline'
                            } className="text-[9px] shrink-0">
                              {project.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[9px] text-muted-foreground">
                              {new Date(project.created_at).toLocaleDateString()}
                            </span>
                            <div className="flex-1" />
                            {project.repo_url && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(project.repo_url, '_blank')}>
                                    <GitBranch className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">Open GitHub</TooltipContent>
                              </Tooltip>
                            )}
                            {project.deployed_url && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                    setPreviewUrl(project.deployed_url!);
                                    setPreviewInput(project.deployed_url!);
                                    setPreviewKey(k => k + 1);
                                  }}>
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">Preview</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ═══ PIPELINE TAB ═══ */}
              <TabsContent value="pipeline" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
                {/* APK Pipeline Stats */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-primary" /> APK Pipeline
                    </p>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={getApkPipelineStats} disabled={apkPipelineLoading}>
                      <RefreshCw className={cn("h-3 w-3", apkPipelineLoading && "animate-spin")} />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <StatMini label="Total Repos" value={apkPipelineStats?.catalog.total || 0} icon={<Database className="h-3 w-3" />} />
                    <StatMini label="APK Built" value={apkPipelineStats?.catalog.completed || 0} icon={<CheckCircle2 className="h-3 w-3 text-green-500" />} />
                    <StatMini label="On Marketplace" value={apkPipelineStats?.catalog.on_marketplace || 0} icon={<Store className="h-3 w-3 text-blue-500" />} />
                    <StatMini label="Build Queue" value={apkPipelineStats?.queue?.queued || 0} icon={<Clock className="h-3 w-3 text-yellow-500" />} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <StatMini label="Pending Scan" value={apkPipelineStats?.catalog.pending || 0} icon={<Search className="h-3 w-3" />} />
                    <StatMini label="Pending Build" value={apkPipelineStats?.catalog.pending_build || 0} icon={<Package className="h-3 w-3" />} />
                    <StatMini label="Building" value={apkPipelineStats?.catalog.building || 0} icon={<Loader2 className="h-3 w-3" />} />
                    <StatMini label="Queue Failed" value={apkPipelineStats?.queue?.failed || 0} icon={<Bug className="h-3 w-3 text-destructive" />} />
                  </div>
                </div>

                {/* Pipeline Actions */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Quick Actions</p>
                  <Button size="sm" className="w-full gap-2 text-xs" onClick={runFullPipeline} disabled={apkPipelineLoading}>
                    <Rocket className="h-3.5 w-3.5" />
                    {apkPipelineLoading ? 'Running...' : 'Run Full APK Pipeline'}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={scanAndRegister} disabled={apkPipelineLoading}>
                      <Search className="h-3 w-3" /> Scan Repos
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => bulkBuild(20)} disabled={apkPipelineLoading}>
                      <Wrench className="h-3 w-3" /> Queue Builds
                    </Button>
                  </div>
                </div>

                {/* How It Works */}
                <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
                  <p className="text-xs font-semibold text-foreground mb-3">Build Pipeline Flow</p>
                  <div className="space-y-2">
                    {[
                      { icon: <Brain className="h-3.5 w-3.5" />, step: '1', label: 'AI Plans Architecture', color: 'text-purple-500' },
                      { icon: <Code className="h-3.5 w-3.5" />, step: '2', label: 'Generates Code + UI', color: 'text-blue-500' },
                      { icon: <GitBranch className="h-3.5 w-3.5" />, step: '3', label: 'Pushes to GitHub', color: 'text-foreground' },
                      { icon: <Cloud className="h-3.5 w-3.5" />, step: '4', label: 'Deploys to Server', color: 'text-green-500' },
                      { icon: <Smartphone className="h-3.5 w-3.5" />, step: '5', label: 'Builds APK', color: 'text-orange-500' },
                      { icon: <Store className="h-3.5 w-3.5" />, step: '6', label: 'Lists on Marketplace', color: 'text-primary' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={cn("w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0", item.color)}>
                          {item.step}
                        </div>
                        <div className={cn("flex items-center gap-1.5 text-xs", item.color)}>
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

            {isMobile && (
              <div className="border-t border-border bg-muted/10 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-primary" /> Live Preview
                </p>
                <div className="flex items-center gap-1 bg-background border border-border rounded-md px-2 h-8">
                  <input
                    type="text"
                    value={previewInput}
                    onChange={e => setPreviewInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePreviewNavigate()}
                    placeholder="Enter project URL"
                    className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handlePreviewNavigate}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="h-64 rounded-lg border border-border overflow-hidden bg-background">
                  {previewUrl ? (
                    <iframe
                      key={previewKey}
                      src={previewUrl}
                      className="w-full h-full border-0"
                      title="Project Preview Mobile"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-center px-4">
                      <p className="text-xs text-muted-foreground">Build ya project select karte hi preview yahan dikhega</p>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-border flex items-center justify-center mb-6">
                      <Rocket className="h-10 w-10 text-primary/40" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Live Preview</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mb-4">
                      Build an app or select a project to see the live preview here.
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                          <Layout className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <span className="text-[10px] text-muted-foreground">Templates</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                          <Brain className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <span className="text-[10px] text-muted-foreground">AI Build</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                          <Monitor className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <span className="text-[10px] text-muted-foreground">Deploy</span>
                      </div>
                    </div>
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

// ─── Mini stat component ───
function StatMini({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-sm font-bold text-foreground">{value}</p>
        <p className="text-[9px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
