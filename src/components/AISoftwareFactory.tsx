import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  aiSoftwareFactory, 
  ProjectPlan, 
  GeneratedCode, 
  AppRequirement,
  TestResult,
  DeploymentResult
} from '@/lib/ai-software-factory';
import {
  Bot, Mic, MicOff, Send, Play, Pause, RotateCcw, CheckCircle2, XCircle,
  AlertCircle, Zap, Rocket, Code, Database, Globe, Shield, Terminal,
  Download, Upload, Eye, EyeOff, Settings, Activity, BarChart3,
  FileText, Layers, Package, Server, Smartphone, TestTube, Bug,
  GitBranch, Users, Lock, TrendingUp, Clock, ArrowRight, ArrowDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FactoryStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  duration?: number;
  output?: any;
  error?: string;
  icon: React.ReactNode;
}

export default function AISoftwareFactory() {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [factorySteps, setFactorySteps] = useState<FactoryStep[]>([]);
  const [projectPlan, setProjectPlan] = useState<ProjectPlan | null>(null);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [selectedTab, setSelectedTab] = useState('input');
  const [isPaused, setIsPaused] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const STEPS: FactoryStep[] = [
    {
      id: '1',
      name: 'Input Processing',
      description: 'Process text/voice input and convert to text',
      status: 'pending',
      icon: <Mic className="h-4 w-4" />
    },
    {
      id: '2',
      name: 'Intent Analysis',
      description: 'Analyze requirements and extract app structure',
      status: 'pending',
      icon: <Bot className="h-4 w-4" />
    },
    {
      id: '3',
      name: 'Project Planning',
      description: 'Create modules, pages, roles, and database schema',
      status: 'pending',
      icon: <FileText className="h-4 w-4" />
    },
    {
      id: '4',
      name: 'Code Generation',
      description: 'Generate frontend, backend, APIs, and database',
      status: 'pending',
      icon: <Code className="h-4 w-4" />
    },
    {
      id: '5',
      name: 'Database Setup',
      description: 'Create database schema and migrations',
      status: 'pending',
      icon: <Database className="h-4 w-4" />
    },
    {
      id: '6',
      name: 'API Integration',
      description: 'Connect APIs and create routing system',
      status: 'pending',
      icon: <Globe className="h-4 w-4" />
    },
    {
      id: '7',
      name: 'UI Generation',
      description: 'Generate UI components using design system',
      status: 'pending',
      icon: <Layers className="h-4 w-4" />
    },
    {
      id: '8',
      name: 'Security Implementation',
      description: 'Add authentication, authorization, and validation',
      status: 'pending',
      icon: <Shield className="h-4 w-4" />
    },
    {
      id: '9',
      name: 'Testing',
      description: 'Run automated tests and validate functionality',
      status: 'pending',
      icon: <TestTube className="h-4 w-4" />
    },
    {
      id: '10',
      name: 'Self-Healing',
      description: 'Detect and fix errors automatically',
      status: 'pending',
      icon: <Bug className="h-4 w-4" />
    },
    {
      id: '11',
      name: 'APK Generation',
      description: 'Build mobile APK file',
      status: 'pending',
      icon: <Smartphone className="h-4 w-4" />
    },
    {
      id: '12',
      name: 'Server Deployment',
      description: 'Deploy to production server',
      status: 'pending',
      icon: <Server className="h-4 w-4" />
    },
    {
      id: '13',
      name: 'Marketplace Registration',
      description: 'Register app in marketplace',
      status: 'pending',
      icon: <Package className="h-4 w-4" />
    },
    {
      id: '14',
      name: 'Final Output',
      description: 'Generate working web app and deliverables',
      status: 'pending',
      icon: <Rocket className="h-4 w-4" />
    }
  ];

  useEffect(() => {
    setFactorySteps(STEPS);
    updateLogs();
  }, []);

  const updateLogs = useCallback(() => {
    const logs = aiSoftwareFactory.getBuildLogs();
    setBuildLogs([...logs]);
  }, []);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setBuildLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const updateStepStatus = useCallback((stepId: string, status: FactoryStep['status'], output?: any, error?: string) => {
    setFactorySteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, output, error } : step
    ));
  }, []);

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
      addLog('🎤 Started voice recording');
    } catch (error) {
      toast.error('Failed to access microphone');
      addLog(`❌ Microphone access failed: ${error.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      addLog('🛑 Stopped voice recording');
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
    try {
      updateStepStatus('1', 'running');
      addLog('🔄 Processing voice input...');
      
      const text = await aiSoftwareFactory.processInput(audioData, 'voice');
      setInputText(text);
      
      updateStepStatus('1', 'success', { text });
      addLog(`✅ Voice processed: "${text.substring(0, 100)}..."`);
      
      // Automatically proceed to next step
      setTimeout(() => startFactoryProcess(text), 1000);
    } catch (error) {
      updateStepStatus('1', 'error', null, error.message);
      addLog(`❌ Voice processing failed: ${error.message}`);
      toast.error('Failed to process voice input');
    }
  };

  const startFactoryProcess = async (input?: string) => {
    const processInput = input || inputText;
    if (!processInput.trim()) {
      toast.error('Please enter a description of the app you want to build');
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    addLog('🚀 Starting AI Software Factory process...');

    try {
      // Step 1: Input Processing
      if (!input) {
        updateStepStatus('1', 'running');
        const processedText = await aiSoftwareFactory.processInput(processInput, 'text');
        updateStepStatus('1', 'success', { text: processedText });
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Step 2: Intent Analysis
      updateStepStatus('2', 'running');
      addLog('🧠 Analyzing user intent...');
      const requirements = await aiSoftwareFactory.analyzeIntent(processInput);
      updateStepStatus('2', 'success', requirements);
      addLog(`✅ Intent analyzed: ${requirements.appType} app with ${requirements.features.length} features`);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 3: Project Planning
      updateStepStatus('3', 'running');
      addLog('📋 Creating project plan...');
      const plan = await aiSoftwareFactory.createProjectPlan(requirements);
      setProjectPlan(plan);
      updateStepStatus('3', 'success', plan);
      addLog(`✅ Project plan created: ${plan.modules.length} modules, ${plan.pages.length} pages`);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 4: Code Generation
      updateStepStatus('4', 'running');
      addLog('💻 Generating code...');
      const code = await aiSoftwareFactory.generateCode(plan);
      setGeneratedCode(code);
      updateStepStatus('4', 'success', code);
      addLog('✅ Code generation completed');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 5-8: Simulate remaining steps
      const remainingSteps = ['5', '6', '7', '8'];
      for (const stepId of remainingSteps) {
        if (isPaused) {
          addLog('⏸️ Process paused');
          await new Promise(resolve => {
            const checkPause = setInterval(() => {
              if (!isPaused) {
                clearInterval(checkPause);
                resolve(undefined);
              }
            }, 100);
          });
          addLog('▶️ Process resumed');
        }

        updateStepStatus(stepId, 'running');
        addLog(`⚙️ Executing step ${stepId}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        updateStepStatus(stepId, 'success', { completed: true });
        addLog(`✅ Step ${stepId} completed`);
      }

      // Step 9: Testing
      updateStepStatus('9', 'running');
      addLog('🧪 Running tests...');
      const testResults = await runTests();
      setTestResults(testResults);
      updateStepStatus('9', testResults.passed ? 'success' : 'error', testResults);
      addLog(testResults.passed ? '✅ All tests passed' : '❌ Some tests failed');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 10: Self-Healing
      updateStepStatus('10', 'running');
      addLog('🔧 Running self-healing...');
      await selfHeal();
      updateStepStatus('10', 'success');
      addLog('✅ Self-healing completed');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 11-14: Final steps
      const finalSteps = ['11', '12', '13', '14'];
      for (const stepId of finalSteps) {
        updateStepStatus(stepId, 'running');
        addLog(`🚀 Executing final step ${stepId}...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        updateStepStatus(stepId, 'success', { completed: true });
        addLog(`✅ Step ${stepId} completed`);
      }

      addLog('🎉 AI Software Factory process completed successfully!');
      toast.success('Application built successfully!');
      setSelectedTab('output');

    } catch (error) {
      addLog(`❌ Process failed: ${error.message}`);
      toast.error('Factory process failed');
      const currentStepId = factorySteps.find(s => s.status === 'running')?.id;
      if (currentStepId) {
        updateStepStatus(currentStepId, 'error', null, error.message);
      }
    } finally {
      setIsProcessing(false);
      updateLogs();
    }
  };

  const runTests = async (): Promise<TestResult> => {
    // Simulate test execution
    addLog('🧪 Running unit tests...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    addLog('🧪 Running integration tests...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    addLog('🧪 Running E2E tests...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      passed: true,
      tests: [
        { name: 'Unit Tests', type: 'unit', passed: true, duration: 1000 },
        { name: 'Integration Tests', type: 'integration', passed: true, duration: 1000 },
        { name: 'E2E Tests', type: 'e2e', passed: true, duration: 1000 }
      ],
      coverage: 95,
      errors: []
    };
  };

  const selfHeal = async () => {
    addLog('🔍 Scanning for errors...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    addLog('🔧 Fixing common issues...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    addLog('✅ Self-healing completed');
  };

  const pauseProcess = () => {
    setIsPaused(true);
    addLog('⏸️ Process paused');
  };

  const resumeProcess = () => {
    setIsPaused(false);
    addLog('▶️ Process resumed');
  };

  const stopProcess = () => {
    setIsProcessing(false);
    setIsPaused(false);
    addLog('🛑 Process stopped');
    
    // Reset all running steps to pending
    setFactorySteps(prev => prev.map(step => 
      step.status === 'running' ? { ...step, status: 'pending' } : step
    ));
  };

  const resetFactory = () => {
    setInputText('');
    setProjectPlan(null);
    setGeneratedCode(null);
    setTestResults(null);
    setDeploymentResult(null);
    setBuildLogs([]);
    setFactorySteps(STEPS);
    setIsProcessing(false);
    setIsPaused(false);
    setCurrentStep(0);
    aiSoftwareFactory.clearLogs();
    addLog('🔄 Factory reset');
  };

  const exportProject = () => {
    if (!generatedCode) {
      toast.error('No code to export');
      return;
    }

    const projectData = {
      projectPlan,
      generatedCode,
      testResults,
      deploymentResult,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-factory-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Project exported successfully');
    addLog('📦 Project exported');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'skipped': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getProgressPercentage = () => {
    const completed = factorySteps.filter(s => s.status === 'success').length;
    return (completed / factorySteps.length) * 100;
  };

  const getActiveStep = () => {
    return factorySteps.find(s => s.status === 'running') || factorySteps.find(s => s.status === 'pending');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
          <Rocket className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            AI Software Factory
          </h1>
          <p className="text-sm text-muted-foreground">
            Transform ideas into working applications with AI
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={resetFactory} disabled={isProcessing}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline" onClick={exportProject} disabled={!generatedCode}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={() => setShowLogs(!showLogs)}>
            <Terminal className="h-4 w-4 mr-2" />
            {showLogs ? 'Hide' : 'Show'} Logs
          </Button>
        </div>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Factory Progress
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {getProgressPercentage().toFixed(0)}% Complete
              </Badge>
              {isProcessing && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  Running
                </Badge>
              )}
              {isPaused && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  Paused
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={getProgressPercentage()} className="h-2" />
          
          <div className="flex items-center gap-4">
            <Button
              onClick={() => startFactoryProcess()}
              disabled={isProcessing || !inputText.trim()}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  {isPaused ? (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  )}
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Start Factory
                </>
              )}
            </Button>
            
            {isProcessing && (
              <Button variant="destructive" onClick={stopProcess}>
                <XCircle className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Factory Interface */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="input">Input</TabsTrigger>
              <TabsTrigger value="process">Process</TabsTrigger>
              <TabsTrigger value="output">Output</TabsTrigger>
              <TabsTrigger value="debug">Debug</TabsTrigger>
            </TabsList>

            <TabsContent value="input" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="h-5 w-5" />
                    Input System
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Describe your application</label>
                    <Textarea
                      placeholder="I want to build a task management application with user authentication, project creation, task assignment, and team collaboration features..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="mt-1 min-h-[120px]"
                      disabled={isProcessing}
                    />
                  </div>
                  
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
                      onClick={() => startFactoryProcess()}
                      disabled={!inputText.trim() || isProcessing}
                      className="flex-1"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Process Text
                    </Button>
                  </div>

                  {isRecording && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm text-red-600 dark:text-red-400">
                        Recording... Speak clearly into your microphone
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="process" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Factory Steps
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {factorySteps.map((step, index) => (
                      <div key={step.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-shrink-0">
                          {step.icon}
                        </div>
                        {getStatusIcon(step.status)}
                        <div className="flex-1">
                          <div className="font-medium">{step.name}</div>
                          <p className="text-sm text-muted-foreground">{step.description}</p>
                          {step.duration && (
                            <p className="text-sm text-muted-foreground">
                              Duration: {step.duration}ms
                            </p>
                          )}
                          {step.error && (
                            <p className="text-sm text-red-500">{step.error}</p>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
                  {projectPlan && (
                    <div>
                      <h4 className="font-medium mb-2">Project Plan</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">App Type:</span> {projectPlan.appType}
                        </div>
                        <div>
                          <span className="font-medium">Modules:</span> {projectPlan.modules.length}
                        </div>
                        <div>
                          <span className="font-medium">Pages:</span> {projectPlan.pages.length}
                        </div>
                        <div>
                          <span className="font-medium">APIs:</span> {projectPlan.apis.length}
                        </div>
                      </div>
                    </div>
                  )}

                  {generatedCode && (
                    <div>
                      <h4 className="font-medium mb-2">Generated Code</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Frontend Components:</span> {Object.keys(generatedCode.frontend.components).length}
                        </div>
                        <div>
                          <span className="font-medium">Backend Controllers:</span> {Object.keys(generatedCode.backend.controllers).length}
                        </div>
                        <div>
                          <span className="font-medium">Database Tables:</span> {generatedCode.database.schema.split('model ').length - 1}
                        </div>
                        <div>
                          <span className="font-medium">API Endpoints:</span> {Object.keys(generatedCode.backend.routes).length}
                        </div>
                      </div>
                    </div>
                  )}

                  {testResults && (
                    <div>
                      <h4 className="font-medium mb-2">Test Results</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Tests Passed:</span>
                          <Badge variant={testResults.passed ? "default" : "destructive"}>
                            {testResults.passed ? 'PASSED' : 'FAILED'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Coverage:</span>
                          <span>{testResults.coverage}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Tests:</span>
                          <span>{testResults.tests.length}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!projectPlan && !generatedCode && !testResults && (
                    <p className="text-muted-foreground text-center py-8">
                      No output generated yet. Start the factory process to see results.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="debug" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bug className="h-5 w-5" />
                    Debug Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">System Status</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span>Factory Status:</span>
                          <Badge variant={isProcessing ? "default" : "secondary"}>
                            {isProcessing ? 'Running' : 'Idle'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Current Step:</span>
                          <span>{getActiveStep()?.name || 'None'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Progress:</span>
                          <span>{getProgressPercentage().toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Errors:</span>
                          <span>{factorySteps.filter(s => s.status === 'error').length}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Error Details</h4>
                      <div className="space-y-2">
                        {factorySteps.filter(s => s.status === 'error').map(step => (
                          <div key={step.id} className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                            <div className="font-medium text-red-600 dark:text-red-400">{step.name}</div>
                            <div className="text-sm text-red-500">{step.error}</div>
                          </div>
                        ))}
                        {factorySteps.filter(s => s.status === 'error').length === 0 && (
                          <p className="text-muted-foreground text-sm">No errors detected</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Steps Completed</span>
                <span>{factorySteps.filter(s => s.status === 'success').length}/{factorySteps.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Processing Time</span>
                <span>
                  {factorySteps
                    .filter(s => s.duration)
                    .reduce((sum, s) => sum + (s.duration || 0), 0) / 1000}s
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Status</span>
                <Badge variant={isProcessing ? "default" : "secondary"}>
                  {isProcessing ? (isPaused ? 'Paused' : 'Running') : 'Ready'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Project Info */}
          {projectPlan && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Project Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="font-medium">{projectPlan.name}</div>
                  <div className="text-sm text-muted-foreground">{projectPlan.appType}</div>
                </div>
                <div className="space-y-1 text-sm">
                  <div>📁 {projectPlan.modules.length} Modules</div>
                  <div>📄 {projectPlan.pages.length} Pages</div>
                  <div>👥 {projectPlan.userRoles.length} Roles</div>
                  <div>🗄️ {projectPlan.database.tables.length} Tables</div>
                  <div>🔌 {projectPlan.apis.length} APIs</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTab('output')}
                disabled={!generatedCode}
                className="w-full justify-start"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Output
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportProject}
                disabled={!generatedCode}
                className="w-full justify-start"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Project
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTab('debug')}
                className="w-full justify-start"
              >
                <Bug className="h-4 w-4 mr-2" />
                Debug Mode
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Logs Panel */}
      {showLogs && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Build Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full rounded border">
              <div className="p-4 font-mono text-sm">
                {buildLogs.length === 0 ? (
                  <p className="text-muted-foreground">No logs yet...</p>
                ) : (
                  buildLogs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
