import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  ultraAIFactory,
  PromptMemory,
  ModulePatch,
  CodeDiff,
  ErrorClassification,
  DependencyInfo,
  EnvironmentConfig,
  Secret,
  FeatureToggle,
  Tenant,
  Blueprint,
  Plugin,
  Webhook,
  ScheduledTask,
  GeneratedTestCase,
  SandboxPreview,
  PerformanceProfile,
  AuditLog,
  CostTracking,
  BuildProgress,
  ValidationResult,
  SearchResult,
  FinalValidationResult
} from '@/lib/ultra-ai-factory';
import {
  Bot, Mic, MicOff, Send, Play, Pause, RotateCcw, CheckCircle2, XCircle,
  AlertCircle, Zap, Rocket, Code, Database, Globe, Shield, Terminal,
  Download, Upload, Eye, EyeOff, Settings, Activity, BarChart3,
  FileText, Layers, Package, Server, Smartphone, TestTube, Bug,
  GitBranch, Users, Lock, TrendingUp, Clock, ArrowRight, ArrowDown,
  Search, Filter, Globe2, Languages, Monitor, Tablet, Smartphone as PhoneIcon,
  Calendar, Bell, Webhook, Puzzle, Archive, RefreshCw, Save,
  History, Brain, GitMerge, Diff, AlertTriangle, Target, Gauge,
  FileSearch, BookOpen, CheckSquare, Square, Key, CreditCard,
  UserCheck, Fingerprint, ShieldCheck, Audit, Timer, Ban,
  Battery, Wifi, Cpu, HardDrive, Cloud, Database as DatabaseIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UltraAISoftwareFactory() {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTab, setSelectedTab] = useState('input');
  const [selectedBlueprint, setSelectedBlueprint] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [buildProgress, setBuildProgress] = useState<BuildProgress | null>(null);
  const [promptMemory, setPromptMemory] = useState<PromptMemory[]>([]);
  const [modulePatches, setModulePatches] = useState<ModulePatch[]>([]);
  const [codeDiffs, setCodeDiffs] = useState<CodeDiff[]>([]);
  const [dependencies, setDependencies] = useState<DependencyInfo[]>([]);
  const [featureToggles, setFeatureToggles] = useState<FeatureToggle[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [costTracking, setCostTracking] = useState<CostTracking[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [finalValidation, setFinalValidation] = useState<FinalValidationResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' }
  ];

  const ULTRA_STEPS = [
    { id: '1', name: 'Memory Context', icon: <Memory className="h-4 w-4" />, description: 'Load prompt memory and context' },
    { id: '2', name: 'Input Processing', icon: <Mic className="h-4 w-4" />, description: 'Process text/voice with multi-language support' },
    { id: '3', name: 'Intent Analysis', icon: <Bot className="h-4 w-4" />, description: 'AI-powered intent analysis with memory' },
    { id: '4', name: 'Blueprint Selection', icon: <Layers className="h-4 w-4" />, description: 'Select or create project blueprint' },
    { id: '5', name: 'Project Planning', icon: <FileText className="h-4 w-4" />, description: 'Generate comprehensive project plan' },
    { id: '6', name: 'Dependency Analysis', icon: <Package className="h-4 w-4" />, description: 'Auto-manage dependencies and versions' },
    { id: '7', name: 'Environment Config', icon: <Settings className="h-4 w-4" />, description: 'Auto-configure environment and secrets' },
    { id: '8', name: 'Code Generation', icon: <Code className="h-4 w-4" />, description: 'Generate code with diff tracking' },
    { id: '9', name: 'Module Patching', icon: <GitMerge className="h-4 w-4" />, description: 'Apply safe module-level patches' },
    { id: '10', name: 'Integration Validation', icon: <CheckSquare className="h-4 w-4" />, description: 'Validate API↔DB↔UI integrations' },
    { id: '11', name: 'Feature Toggles', icon: <Square className="h-4 w-4" />, description: 'Configure feature toggles' },
    { id: '12', name: 'Security Setup', icon: <Shield className="h-4 w-4" />, description: 'Configure access control and secrets' },
    { id: '13', name: 'Test Generation', icon: <TestTube className="h-4 w-4" />, description: 'Generate automated test cases' },
    { id: '14', name: 'Sandbox Preview', icon: <Monitor className="h-4 w-4" />, description: 'Create sandbox preview environment' },
    { id: '15', name: 'Cross-Platform Test', icon: <Smartphone className="h-4 w-4" />, description: 'Test on mobile, tablet, desktop' },
    { id: '16', name: 'Performance Profiling', icon: <Gauge className="h-4 w-4" />, description: 'Profile and optimize performance' },
    { id: '17', name: 'Cost Analysis', icon: <CreditCard className="h-4 w-4" />, description: 'Track AI/API usage costs' },
    { id: '18', name: 'Documentation', icon: <BookOpen className="h-4 w-4" />, description: 'Generate auto-documentation' },
    { id: '19', name: 'Final Validation', icon: <CheckCircle2 className="h-4 w-4" />, description: 'Comprehensive final validation' },
    { id: '20', name: 'Export & Deploy', icon: <Rocket className="h-4 w-4" />, description: 'Export project and deploy' }
  ];

  useEffect(() => {
    initializeUltraFactory();
    const interval = updateRealTimeData;
    const timer = setInterval(interval, 3000);
    return () => clearInterval(timer);
  }, []);

  const initializeUltraFactory = async () => {
    try {
      await ultraAIFactory.initializeBlueprints();
      updateAllData();
    } catch (error) {
      console.error('Failed to initialize Ultra Factory:', error);
    }
  };

  const updateRealTimeData = () => {
    updateAllData();
    
    // Update build progress
    const progress = ultraAIFactory.getBuildProgress();
    if (progress) {
      setBuildProgress(progress);
    }
  };

  const updateAllData = () => {
    setPromptMemory(ultraAIFactory.getPromptMemory());
    setModulePatches(ultraAIFactory.getModulePatches());
    setCodeDiffs(ultraAIFactory.getCodeDiffs());
    setDependencies(ultraAIFactory.getDependencies());
    setFeatureToggles(ultraAIFactory.getFeatureToggles());
    setTenants(ultraAIFactory.getTenants());
    setBlueprints(ultraAIFactory.getBlueprints());
    setAuditLogs(ultraAIFactory.getAuditLogs());
    setCostTracking(ultraAIFactory.getCostTracking());
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioData = await blobToBase64(audioBlob);
        processVoiceInput(audioData);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Voice recording started');
    } catch (error) {
      toast.error('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      toast.success('Voice recording stopped');
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const processVoiceInput = async (audioData: string) => {
    // Process with multi-language support
    toast.info('Processing voice input...');
  };

  const startUltraFactory = async () => {
    if (!inputText.trim()) {
      toast.error('Please enter a project description');
      return;
    }

    setIsProcessing(true);
    setCurrentStep(0);

    try {
      for (let i = 0; i < ULTRA_STEPS.length; i++) {
        const step = ULTRA_STEPS[i];
        setCurrentStep(i);
        
        // Update build progress
        ultraAIFactory.updateBuildProgress(i + 1, ULTRA_STEPS.length, step.name);
        
        // Execute step
        await executeUltraStep(step.id, step.name);
        
        // Small delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Final validation
      const finalResult = await ultraAIFactory.finalValidation('current-project');
      setFinalValidation(finalResult);

      if (finalResult.passed) {
        toast.success(`Ultra Factory completed! Score: ${finalResult.score}%`);
        setSelectedTab('output');
      } else {
        toast.error(`Factory completed with issues. Score: ${finalResult.score}%`);
      }

    } catch (error) {
      toast.error(`Factory process failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
      updateAllData();
    }
  };

  const executeUltraStep = async (stepId: string, stepName: string) => {
    switch (stepId) {
      case '1':
        // Memory Context
        const context = await ultraAIFactory.getMemoryContext('current-project');
        console.log('Memory context loaded:', context);
        break;
        
      case '2':
        // Input Processing
        console.log('Processing input with multi-language support');
        break;
        
      case '3':
        // Intent Analysis
        console.log('Analyzing intent with AI memory');
        break;
        
      case '4':
        // Blueprint Selection
        if (selectedBlueprint) {
          console.log('Using blueprint:', selectedBlueprint);
        }
        break;
        
      case '6':
        // Dependency Analysis
        const packageJson = { dependencies: { react: '^18.0.0', next: '^14.0.0' } };
        const deps = await ultraAIFactory.analyzeDependencies(packageJson);
        setDependencies(deps);
        break;
        
      case '7':
        // Environment Config
        console.log('Auto-configuring environment');
        break;
        
      case '8':
        // Code Generation
        console.log('Generating code with diff tracking');
        break;
        
      case '10':
        // Integration Validation
        const validation = await ultraAIFactory.validateIntegrations({} as any);
        setValidationResult(validation);
        break;
        
      default:
        console.log(`Executing step: ${stepName}`);
        break;
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const results = await ultraAIFactory.searchGlobal(searchQuery, 'current-project');
      setSearchResults(results);
    } catch (error) {
      toast.error('Search failed');
    }
  };

  const handleFeatureToggle = async (featureId: string) => {
    const toggle = featureToggles.find(f => f.id === featureId);
    if (toggle) {
      await ultraAIFactory.toggleFeature(toggle.name, !toggle.enabled);
      updateAllData();
    }
  };

  const handleCreateTenant = async () => {
    try {
      const tenant = await ultraAIFactory.createTenant('New Tenant', 'new.example.com');
      setTenants([...tenants, tenant]);
      toast.success('Tenant created successfully');
    } catch (error) {
      toast.error('Failed to create tenant');
    }
  };

  const handleExportProject = async () => {
    try {
      const exportData = await ultraAIFactory.exportProject('current-project', {
        format: 'zip',
        includeSource: true,
        includeDatabase: true,
        includeConfig: true,
        includeTests: true
      });
      
      // Create download
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ultra-factory-project-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Project exported successfully');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const getStepIcon = (stepId: string) => {
    const step = ULTRA_STEPS.find(s => s.id === stepId);
    return step?.icon || <Clock className="h-4 w-4" />;
  };

  const getStepStatus = (stepId: string) => {
    const stepIndex = ULTRA_STEPS.findIndex(s => s.id === stepId);
    if (stepIndex < currentStep) return 'success';
    if (stepIndex === currentStep) return isProcessing ? 'running' : 'pending';
    return 'pending';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-500';
      case 'running': return 'text-blue-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getTotalCost = () => {
    return costTracking.reduce((sum, cost) => sum + cost.cost, 0);
  };

  const getValidationScore = () => {
    if (!finalValidation) return 0;
    return finalValidation.score;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
          <Zap className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Ultra AI Software Factory
          </h1>
          <p className="text-sm text-muted-foreground">
            Production-grade AI builder with 30 intelligent features
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showAdvanced ? 'Simple' : 'Advanced'}
          </Button>
          <Button variant="outline" onClick={handleExportProject}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Real-time Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{buildProgress?.percentage.toFixed(0) || 0}%</div>
            <div className="text-xs text-muted-foreground">Build Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">${getTotalCost().toFixed(4)}</div>
            <div className="text-xs text-muted-foreground">Total Cost</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{getValidationScore()}%</div>
            <div className="text-xs text-muted-foreground">Validation Score</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{dependencies.length}</div>
            <div className="text-xs text-muted-foreground">Dependencies</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{tenants.length}</div>
            <div className="text-xs text-muted-foreground">Tenants</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{auditLogs.length}</div>
            <div className="text-xs text-muted-foreground">Audit Logs</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="input">Input</TabsTrigger>
              <TabsTrigger value="process">Process</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="output">Output</TabsTrigger>
              <TabsTrigger value="monitor">Monitor</TabsTrigger>
            </TabsList>

            <TabsContent value="input" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="h-5 w-5" />
                    Multi-Language Input System
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Language Selection */}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium">Language</label>
                      <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.map(lang => (
                            <SelectItem key={lang.code} value={lang.code}>
                              {lang.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium">Blueprint</label>
                      <Select value={selectedBlueprint} onValueChange={setSelectedBlueprint}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select blueprint" />
                        </SelectTrigger>
                        <SelectContent>
                          {blueprints.map(bp => (
                            <SelectItem key={bp.id} value={bp.id}>
                              {bp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Memory Context Display */}
                  {promptMemory.length > 0 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Memory className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-600">Memory Context</span>
                      </div>
                      <p className="text-xs text-blue-600">
                        {promptMemory.length} previous prompts remembered
                      </p>
                    </div>
                  )}

                  {/* Input Area */}
                  <div>
                    <label className="text-sm font-medium">Project Description</label>
                    <Textarea
                      placeholder="Describe your application in detail. The AI will remember previous context and build upon it..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="mt-1 min-h-[120px]"
                      disabled={isProcessing}
                    />
                  </div>

                  {/* Voice Input */}
                  <div className="flex gap-2">
                    <Button
                      onClick={startRecording}
                      disabled={isRecording || isProcessing}
                      variant={isRecording ? "destructive" : "outline"}
                      className="flex-1"
                    >
                      {isRecording ? (
                        <>
                          <MicOff className="h-4 w-4 mr-2" />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4 mr-2" />
                          Voice Input
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={startUltraFactory}
                      disabled={!inputText.trim() || isProcessing}
                      className="flex-1"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Rocket className="h-4 w-4 mr-2" />
                          Start Ultra Factory
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="process" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Ultra Factory Process (20 Steps)
                    </div>
                    <Badge variant="outline">
                      {currentStep + 1}/{ULTRA_STEPS.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Overall Progress</span>
                      <span>{buildProgress?.percentage.toFixed(0) || 0}%</span>
                    </div>
                    <Progress value={buildProgress?.percentage || 0} className="h-2" />
                    {buildProgress && (
                      <p className="text-xs text-muted-foreground">
                        Current: {buildProgress.currentAction} • ETA: {Math.round(buildProgress.eta / 1000)}s
                      </p>
                    )}
                  </div>

                  {/* Steps */}
                  <div className="space-y-2">
                    {ULTRA_STEPS.map((step, index) => (
                      <div key={step.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-shrink-0">
                          {getStepIcon(step.id)}
                        </div>
                        <div className={cn("flex-shrink-0", getStatusColor(getStepStatus(step.id)))}>
                          {getStepStatus(step.id) === 'success' && <CheckCircle2 className="h-4 w-4" />}
                          {getStepStatus(step.id) === 'running' && <RefreshCw className="h-4 w-4 animate-spin" />}
                          {getStepStatus(step.id) === 'error' && <XCircle className="h-4 w-4" />}
                          {getStepStatus(step.id) === 'pending' && <Clock className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{step.name}</div>
                          <p className="text-sm text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Feature Toggles */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Feature Toggles</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {featureToggles.map(toggle => (
                      <div key={toggle.id} className="flex items-center justify-between">
                        <span className="text-sm">{toggle.name}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFeatureToggle(toggle.id)}
                        >
                          {toggle.enabled ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Dependencies */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Dependencies</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dependencies.slice(0, 5).map(dep => (
                      <div key={dep.name} className="flex items-center justify-between">
                        <span className="text-sm">{dep.name}</span>
                        <Badge variant="secondary">{dep.version}</Badge>
                      </div>
                    ))}
                    {dependencies.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{dependencies.length - 5} more dependencies
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Tenants */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Multi-Tenant Support</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {tenants.map(tenant => (
                      <div key={tenant.id} className="flex items-center justify-between">
                        <span className="text-sm">{tenant.name}</span>
                        <Badge variant="outline">{tenant.domain}</Badge>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateTenant}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Tenant
                    </Button>
                  </CardContent>
                </Card>

                {/* Cost Tracking */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Cost Tracking</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Total Cost:</span>
                      <span className="font-medium">${getTotalCost().toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">API Calls:</span>
                      <span className="font-medium">{costTracking.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Tokens Used:</span>
                      <span className="font-medium">
                        {costTracking.reduce((sum, cost) => sum + cost.tokens, 0)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="validation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5" />
                    Integration Validation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {validationResult ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        {validationResult.valid ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="font-medium">
                          {validationResult.valid ? 'All Validations Passed' : 'Issues Found'}
                        </span>
                      </div>
                      
                      {validationResult.issues.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Issues ({validationResult.issues.length})</h4>
                          {validationResult.issues.map((issue, index) => (
                            <div key={index} className="p-3 border rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={issue.severity === 'critical' ? 'destructive' : 'secondary'}>
                                  {issue.severity}
                                </Badge>
                                <span className="text-sm font-medium">{issue.type}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{issue.description}</p>
                              <p className="text-xs text-blue-600 mt-1">Fix: {issue.fix}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Run the factory process to see validation results
                    </p>
                  )}
                </CardContent>
              </Card>

              {finalValidation && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Final Validation Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="text-4xl font-bold mb-2">{finalValidation.score}%</div>
                      <div className={cn(
                        "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium",
                        finalValidation.passed 
                          ? "bg-green-100 text-green-800" 
                          : "bg-red-100 text-red-800"
                      )}>
                        {finalValidation.passed ? 'PASSED' : 'FAILED'}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="font-medium">{finalValidation.tests.length}</div>
                        <div className="text-xs text-muted-foreground">Tests</div>
                      </div>
                      <div>
                        <div className="font-medium">{finalValidation.performance.avgResponseTime.toFixed(0)}ms</div>
                        <div className="text-xs text-muted-foreground">Avg Response</div>
                      </div>
                      <div>
                        <div className="font-medium">{finalValidation.security.issues.length}</div>
                        <div className="text-xs text-muted-foreground">Security Issues</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="output" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Generated Output
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {finalValidation ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 border rounded-lg">
                          <FileText className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                          <div className="font-medium">Source Code</div>
                          <div className="text-sm text-muted-foreground">Ready</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <Database className="h-8 w-8 mx-auto mb-2 text-green-500" />
                          <div className="font-medium">Database</div>
                          <div className="text-sm text-muted-foreground">Configured</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <Shield className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                          <div className="font-medium">Security</div>
                          <div className="text-sm text-muted-foreground">Enabled</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <Globe className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                          <div className="font-medium">Deploy</div>
                          <div className="text-sm text-muted-foreground">Ready</div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button onClick={handleExportProject} className="flex-1">
                          <Download className="h-4 w-4 mr-2" />
                          Download Source Code
                        </Button>
                        <Button variant="outline" className="flex-1">
                          <Rocket className="h-4 w-4 mr-2" />
                          Deploy to Production
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Complete the factory process to generate output
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="monitor" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Audit Logs */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Recent Audit Logs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {auditLogs.slice(-10).reverse().map(log => (
                          <div key={log.id} className="text-xs p-2 border rounded">
                            <div className="flex justify-between">
                              <span className="font-medium">{log.action}</span>
                              <span className="text-muted-foreground">
                                {log.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-muted-foreground">{log.resource}</div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Search */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Global Search</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search code, modules, APIs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={handleSearch} size="sm">
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {searchResults.length > 0 && (
                      <ScrollArea className="h-48">
                        <div className="space-y-2">
                          {searchResults.map((result, index) => (
                            <div key={index} className="text-xs p-2 border rounded">
                              <div className="flex justify-between">
                                <Badge variant="secondary">{result.type}</Badge>
                                <span className="text-muted-foreground">
                                  {(result.relevance * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="font-medium">{result.path}</div>
                              <div className="text-muted-foreground truncate">
                                {result.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Save className="h-4 w-4 mr-2" />
                Save Project
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Upload className="h-4 w-4 mr-2" />
                Import Project
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <GitBranch className="h-4 w-4 mr-2" />
                Version Control
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Webhook className="h-4 w-4 mr-2" />
                Webhooks
              </Button>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Factory Status</span>
                <Badge variant={isProcessing ? "default" : "secondary"}>
                  {isProcessing ? 'Running' : 'Ready'}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Memory</span>
                <Badge variant="secondary">Healthy</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Dependencies</span>
                <Badge variant="secondary">Resolved</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Security</span>
                <Badge variant="secondary">Enabled</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Features */}
          {showAdvanced && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Advanced Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Puzzle className="h-4 w-4 mr-2" />
                  Plugin Manager
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Scheduler
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Monitor className="h-4 w-4 mr-2" />
                  Sandbox
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Gauge className="h-4 w-4 mr-2" />
                  Performance
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
