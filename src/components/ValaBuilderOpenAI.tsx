import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { valaBuilderApi } from '@/lib/api';
import { useValaBuilderStateStore } from '@/hooks/useValaBuilderState';
import { 
  aiIntegrationManager, 
  AIProvider, 
  AIModel, 
  AIConfig 
} from '@/lib/ai-integrations';
import {
  Rocket, GitBranch, Globe, Code, Database, Bug, Wrench, Package,
  Store, Loader2, CheckCircle2, Circle, ArrowDown,
  Sparkles, Server, Shield, Zap, RotateCcw, Activity, Play, XCircle,
  Send, Bot, MessageSquare, Lightbulb, Cpu, FileText, Layers,
  Terminal, Settings, Download, Upload, Eye, Edit3, Copy,
  ChevronRight, ChevronDown, Plus, Minus, RefreshCw, Smartphone,
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
  details?: string;
  duration?: number;
}

interface BuilderMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type: 'text' | 'code' | 'file' | 'action';
  metadata?: {
    action?: BuilderAction;
    step?: string;
    result?: any;
  };
}

interface BuilderTemplate {
  id: string;
  name: string;
  description: string;
  icon: JSX.Element;
  category: string;
  prompt: string;
  tags: string[];
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

const OPENAI_STYLE_STEPS: WorkflowStep[] = [
  { id: 'analyze', label: 'Analyze Requirements', icon: <Lightbulb className="h-4 w-4" />, status: 'pending' },
  { id: 'plan', label: 'Create Architecture', icon: <Layers className="h-4 w-4" />, status: 'pending' },
  { id: 'generate', label: 'Generate Code', icon: <Code className="h-4 w-4" />, status: 'pending' },
  { id: 'integrate', label: 'Integrate Components', icon: <Cpu className="h-4 w-4" />, status: 'pending' },
  { id: 'test', label: 'Test & Debug', icon: <Bug className="h-4 w-4" />, status: 'pending' },
  { id: 'deploy', label: 'Deploy & Launch', icon: <Rocket className="h-4 w-4" />, status: 'pending' },
];

const BUILDER_TEMPLATES: BuilderTemplate[] = [
  {
    id: 'web-app',
    name: 'Web Application',
    description: 'Modern web app with React, Node.js, and database',
    icon: <Globe className="h-5 w-5" />,
    category: 'Web',
    prompt: 'Create a modern web application with React frontend, Node.js backend, and PostgreSQL database. Include user authentication, dashboard, and responsive design.',
    tags: ['React', 'Node.js', 'PostgreSQL', 'Auth']
  },
  {
    id: 'mobile-app',
    name: 'Mobile App',
    description: 'Cross-platform mobile application',
    icon: <Smartphone className="h-5 w-5" />,
    category: 'Mobile',
    prompt: 'Build a cross-platform mobile app using React Native with offline support, push notifications, and native device integration.',
    tags: ['React Native', 'Mobile', 'Offline', 'Push Notifications']
  },
  {
    id: 'api-service',
    name: 'API Service',
    description: 'RESTful API with microservices architecture',
    icon: <Server className="h-5 w-5" />,
    category: 'Backend',
    prompt: 'Design and implement a scalable RESTful API with microservices architecture, authentication, rate limiting, and comprehensive documentation.',
    tags: ['API', 'Microservices', 'REST', 'Documentation']
  },
  {
    id: 'ai-tool',
    name: 'AI Tool',
    description: 'AI-powered application with machine learning',
    icon: <Bot className="h-5 w-5" />,
    category: 'AI',
    prompt: 'Create an AI-powered tool with machine learning capabilities, data processing pipeline, and intelligent user interface.',
    tags: ['AI', 'Machine Learning', 'Data Processing', 'ML']
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Platform',
    description: 'Full-featured online store with payment processing',
    icon: <Store className="h-5 w-5" />,
    category: 'E-commerce',
    prompt: 'Build a complete e-commerce platform with product catalog, shopping cart, payment processing, order management, and admin dashboard.',
    tags: ['E-commerce', 'Payments', 'Inventory', 'Admin']
  },
  {
    id: 'dashboard',
    name: 'Analytics Dashboard',
    description: 'Real-time analytics and data visualization',
    icon: <FileText className="h-5 w-5" />,
    category: 'Analytics',
    prompt: 'Create a comprehensive analytics dashboard with real-time data visualization, custom reports, and interactive charts.',
    tags: ['Analytics', 'Charts', 'Real-time', 'Reports']
  }
];

export default function ValaBuilderOpenAI() {
  const { state, patch, clearRunData } = useValaBuilderStateStore();
  const [steps, setSteps] = useState<WorkflowStep[]>(OPENAI_STYLE_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<BuilderMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<BuilderTemplate | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [servers, setServers] = useState<BuilderServer[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['chat']));
  const [selectedAIProvider, setSelectedAIProvider] = useState<AIProvider>('openai');
  const [availableAIProviders, setAvailableAIProviders] = useState<AIProvider[]>([]);
  const [aiModels, setAiModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4-turbo');
  const [aiProviderStatuses, setAiProviderStatuses] = useState<Map<AIProvider, boolean>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const appName = state.appName;
  const prompt = state.prompt;
  const demoUrl = state.demoUrl;
  const githubUrl = state.githubUrl;
  const apkQueueId = state.apkQueueId;
  const productId = state.productId;
  const runId = state.runId;
  const runStatus = state.runStatus;
  const selectedServerId = state.selectedServerId;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const resetPipelineState = useCallback(() => {
    clearRunData();
    setIsRunning(false);
    setSteps(OPENAI_STYLE_STEPS);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "👋 Welcome to **VALA AI Builder**! I'm your AI assistant that can help you build software from natural language descriptions.\n\n**What would you like to build today?**\n\n• Describe your app idea in detail\n• Choose a template to get started\n• Ask me questions about development\n\nI'll guide you through the entire process from idea to deployment!",
      timestamp: new Date(),
      type: 'text'
    }]);
  }, [clearRunData]);

  const addMessage = useCallback((message: Omit<BuilderMessage, 'id' | 'timestamp'>) => {
    const newMessage: BuilderMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const stepStatusFromLogs = useCallback((logs: RunLog[]) => {
    const byStep = new Map<string, { status: StepStatus; message?: string; duration?: number }>();
    for (const log of logs) {
      if (!OPENAI_STYLE_STEPS.find((s) => s.id === log.step_key)) continue;
      byStep.set(log.step_key, { status: log.status, message: log.message });
    }

    setSteps(
      OPENAI_STYLE_STEPS.map((step) => {
        const hit = byStep.get(step.id);
        return {
          ...step,
          status: hit?.status || 'pending',
          result: hit?.message,
        };
      })
    );
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

    if (run?.status === 'success') {
      addMessage({
        role: 'assistant',
        content: `🎉 **Build completed successfully!**\n\nYour application is now live and ready to use.\n\n**Next steps:**\n• Test your live demo\n• Review the generated code\n• Deploy to production when ready`,
        type: 'text',
        metadata: { result: run }
      });
      toast.success('Pipeline completed successfully');
    }
    if (run?.status === 'fail' && run?.error_message) {
      addMessage({
        role: 'assistant',
        content: `❌ **Build failed**\n\n${run.error_message}\n\nLet me help you fix this issue. Would you like me to:\n• Analyze the error and suggest fixes\n• Retry with different settings\n• Modify the requirements`,
        type: 'text'
      });
      toast.error(run.error_message);
    }
  }, [addMessage, patch, stepStatusFromLogs]);

  const processUserInput = useCallback(async (input: string) => {
    if (!input.trim()) return;

    // Add user message
    addMessage({
      role: 'user',
      content: input,
      type: 'text'
    });

    // Add thinking message
    const thinkingId = `thinking-${Date.now()}`;
    addMessage({
      role: 'assistant',
      content: '🤔 Analyzing your requirements...',
      type: 'text'
    });

    try {
      // Extract app name and description from input
      const lines = input.split('\n');
      const potentialAppName = lines[0].trim();
      const description = input;

      // Update state if app name is detected
      if (potentialAppName && potentialAppName.length < 50 && !potentialAppName.includes(' ')) {
        patch({ appName: potentialAppName });
      }
      patch({ prompt: description });

      // Simulate AI processing
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => !msg.content.includes('Analyzing your requirements')));
        
        addMessage({
          role: 'assistant',
          content: `🚀 **Great! I understand you want to build:**\n\n${description}\n\n**Let me create a plan for you:**\n\n1. **Analyze Requirements** - Understanding your needs\n2. **Create Architecture** - Design the system structure\n3. **Generate Code** - Write the actual code\n4. **Integrate Components** - Connect everything\n5. **Test & Debug** - Ensure quality\n6. **Deploy & Launch** - Go live!\n\nReady to start building? Click "Start Building" below!`,
          type: 'text'
        });
      }, 2000);

    } catch (error) {
      setMessages(prev => prev.filter(msg => !msg.content.includes('Analyzing your requirements')));
      addMessage({
        role: 'assistant',
        content: `❌ I encountered an error processing your request. Please try again or describe your project differently.`,
        type: 'text'
      });
    }
  }, [addMessage, patch]);

  const startBuilding = useCallback(async () => {
    if (!appName.trim()) {
      toast.error('Please provide an app name first');
      return;
    }
    if (!prompt.trim()) {
      toast.error('Please describe what you want to build');
      return;
    }

    try {
      setIsRunning(true);
      patch({ runStatus: 'pending' });
      setSteps(OPENAI_STYLE_STEPS);

      addMessage({
        role: 'assistant',
        content: `🏗️ **Starting build process for ${appName}...**\n\nInitializing the AI-powered development pipeline. This may take a few minutes as I analyze, plan, and generate your application.`,
        type: 'text'
      });

      const { data, error } = await valaBuilderApi.startRun({
        action: 'create_app',
        app_name: appName.trim(),
        app_description: prompt.trim(),
        selected_server_id: selectedServerId || null,
        environment: state.environment,
        template_key: selectedTemplate?.id || undefined,
        priority: state.priority,
      });

      if (error || data?.success === false) {
        throw new Error(error?.message || data?.error || 'Failed to start build');
      }

      const newRunId = data?.run?.id;
      if (!newRunId) throw new Error('Run ID missing from response');

      patch({ runId: newRunId });
      await refreshRun(newRunId);

    } catch (err: any) {
      setIsRunning(false);
      patch({ runStatus: 'fail' });
      addMessage({
        role: 'assistant',
        content: `❌ **Failed to start build**\n\n${err.message}\n\nPlease check your requirements and try again.`,
        type: 'text'
      });
      toast.error(err.message || 'Failed to start build');
    }
  }, [appName, addMessage, patch, prompt, refreshRun, selectedServerId, selectedTemplate, state.environment, state.priority]);

  const applyTemplate = useCallback((template: BuilderTemplate) => {
    setSelectedTemplate(template);
    patch({ appName: template.name, prompt: template.prompt });
    setShowTemplates(false);
    
    addMessage({
      role: 'assistant',
      content: `📋 **Template Applied: ${template.name}**\n\n${template.description}\n\n**Technologies:** ${template.tags.join(', ')}\n\nI've filled in the details for you. Feel free to modify them or click "Start Building" to begin!`,
      type: 'text',
      metadata: { action: 'template_applied', result: template }
    });
  }, [addMessage, patch]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  const statusBadge = useMemo(() => {
    if (!runStatus) return null;
    if (runStatus === 'success') return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">✅ Ready</Badge>;
    if (runStatus === 'fail') return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">❌ Failed</Badge>;
    return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">🔄 Building</Badge>;
  }, [runStatus]);

  useEffect(() => {
    resetPipelineState();
    loadAIProviders();
  }, [resetPipelineState]);

  const loadAIProviders = async () => {
    try {
      const providers: AIProvider[] = ['openai', 'anthropic', 'google', 'elevenlabs', 'stability', 'cohere', 'mistral', 'groq', 'deepseek', 'zhipu'];
      const statuses = new Map<AIProvider, boolean>();
      
      for (const provider of providers) {
        try {
          const config = await aiIntegrationManager.getProviderConfig(provider);
          const apiKey = await aiIntegrationManager.getApiKey(provider);
          statuses.set(provider, !!(config && apiKey));
        } catch (error) {
          statuses.set(provider, false);
        }
      }
      
      setAiProviderStatuses(statuses);
      setAvailableAIProviders(providers.filter(p => statuses.get(p)));
      
      // Load models for the first available provider
      const firstAvailable = providers.find(p => statuses.get(p));
      if (firstAvailable) {
        setSelectedAIProvider(firstAvailable);
        const models = aiIntegrationManager.getModelsByProvider(firstAvailable);
        setAiModels(models);
        if (models.length > 0) {
          setSelectedModel(models[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load AI providers:', error);
    }
  };

  const handleAIProviderChange = async (provider: AIProvider) => {
    setSelectedAIProvider(provider);
    const models = aiIntegrationManager.getModelsByProvider(provider);
    setAiModels(models);
    if (models.length > 0) {
      setSelectedModel(models[0].id);
    }
  };

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
    return () => { active = false; };
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

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Bot className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              VALA AI Builder
            </h1>
            <p className="text-sm text-muted-foreground">
              Your AI-powered development companion - From idea to production in minutes
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {statusBadge}
            <Badge className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border-blue-500/30">
              🤖 {selectedAIProvider.toUpperCase()} Powered
            </Badge>
            {availableAIProviders.length > 1 && (
              <Badge variant="secondary">
                {availableAIProviders.length} AI Providers
              </Badge>
            )}
          </div>
        </div>

        {/* AI Provider Selection */}
        {availableAIProviders.length > 1 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI Provider
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {availableAIProviders.map(provider => (
                  <Button
                    key={provider}
                    variant={selectedAIProvider === provider ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleAIProviderChange(provider)}
                    className="justify-start"
                  >
                    <Bot className="h-3 w-3 mr-2" />
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </Button>
                ))}
              </div>
              
              {/* Model Selection */}
              {aiModels.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full mt-1 h-8 rounded-md border border-border bg-background px-2 text-xs"
                  >
                    {aiModels.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chat Interface */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    AI Development Chat
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="text-xs"
                    >
                      {showTemplates ? <Eye className="h-3 w-3 mr-1" /> : <Layers className="h-3 w-3 mr-1" />}
                      {showTemplates ? 'Hide' : 'Show'} Templates
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Templates */}
                {showTemplates && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-muted/30 rounded-lg">
                    {BUILDER_TEMPLATES.map(template => (
                      <Button
                        key={template.id}
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-accent/50"
                        onClick={() => applyTemplate(template)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className="p-1 rounded bg-primary/10">
                            {template.icon}
                          </div>
                          <span className="font-medium">{template.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground text-left">{template.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {template.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </Button>
                    ))}
                  </div>
                )}

                {/* Messages */}
                <div className="h-[500px] overflow-y-auto space-y-4 p-4 bg-background rounded-lg border">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3",
                        message.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg p-3",
                          message.role === 'user'
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          {message.content.split('\n').map((line, i) => (
                            <p key={i} className={line.startsWith('**') ? 'font-semibold' : ''}>
                              {line || <br />}
                            </p>
                          ))}
                        </div>
                      </div>
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium">YOU</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Describe what you want to build... (e.g., 'Create a task management app with teams, projects, and deadlines')"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="flex-1 min-h-[80px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        processUserInput(inputValue);
                        setInputValue('');
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      processUserInput(inputValue);
                      setInputValue('');
                    }}
                    disabled={!inputValue.trim() || isRunning}
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {/* Action Buttons */}
                {(appName || prompt) && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={startBuilding}
                      disabled={isRunning}
                      className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Building...
                        </>
                      ) : (
                        <>
                          <Rocket className="h-4 w-4" />
                          Start Building
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={resetPipelineState} disabled={isRunning}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Results */}
            {(demoUrl || githubUrl) && (
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    Build Complete!
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {demoUrl && (
                      <a href={demoUrl} target="_blank" rel="noopener noreferrer">
                        <Button className="gap-2 bg-green-500 hover:bg-green-600">
                          <Globe className="h-4 w-4" />
                          View Live Demo
                        </Button>
                      </a>
                    )}
                    {githubUrl && (
                      <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" className="gap-2">
                          <GitBranch className="h-4 w-4" />
                          View Source Code
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Build Progress */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <Button
                  variant="ghost"
                  className="w-full justify-between p-0 h-auto font-medium"
                  onClick={() => toggleSection('progress')}
                >
                  <span className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Build Progress
                  </span>
                  {expandedSections.has('progress') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CardHeader>
              {expandedSections.has('progress') && (
                <CardContent className="space-y-2">
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
                          <XCircle className="h-4 w-4 shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 opacity-40" />
                        )}
                        <span className="flex-1">{step.label}</span>
                      </div>
                      {i < steps.length - 1 && (
                        <div className="flex justify-center py-0.5">
                          <ArrowDown className="h-3 w-3 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>

            {/* Current Project */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <Button
                  variant="ghost"
                  className="w-full justify-between p-0 h-auto font-medium"
                  onClick={() => toggleSection('project')}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Current Project
                  </span>
                  {expandedSections.has('project') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CardHeader>
              {expandedSections.has('project') && (
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">App Name</label>
                    <Input
                      value={appName}
                      onChange={(e) => patch({ appName: e.target.value })}
                      placeholder="Enter app name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Description</label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => patch({ prompt: e.target.value })}
                      placeholder="Describe your app"
                      className="mt-1 min-h-[80px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Server</label>
                    <select
                      value={selectedServerId}
                      onChange={(e) => patch({ selectedServerId: e.target.value })}
                      className="w-full mt-1 h-10 rounded-md border border-border bg-background px-3 text-sm"
                    >
                      <option value="">Auto select</option>
                      {servers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Quick Actions */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <Button
                  variant="ghost"
                  className="w-full justify-between p-0 h-auto font-medium"
                  onClick={() => toggleSection('actions')}
                >
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Quick Actions
                  </span>
                  {expandedSections.has('actions') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CardHeader>
              {expandedSections.has('actions') && (
                <CardContent className="space-y-2">
                  {[
                    { label: 'Generate UI', icon: Code, color: 'text-purple-400' },
                    { label: 'Generate Backend', icon: Server, color: 'text-orange-400' },
                    { label: 'Fix Errors', icon: Bug, color: 'text-red-400' },
                    { label: 'Deploy Demo', icon: Globe, color: 'text-green-400' },
                  ].map(action => (
                    <Button
                      key={action.label}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2"
                      disabled={isRunning}
                    >
                      <action.icon className={cn('h-4 w-4', action.color)} />
                      {action.label}
                    </Button>
                  ))}
                </CardContent>
              )}
            </Card>

            {/* AI Info */}
            <Card className="border-border bg-gradient-to-br from-blue-500/10 to-purple-500/10">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="h-5 w-5 text-blue-400" />
                  <span className="font-medium text-sm">AI Capabilities</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                    <span>Natural language understanding</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                    <span>Full-stack code generation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                    <span>Automated testing & debugging</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                    <span>One-click deployment</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
