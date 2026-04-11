import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  aiIntegrationManager, 
  AIProvider, 
  AIModel, 
  AIResponse 
} from '@/lib/ai-integrations';
import {
  Bot, Play, Pause, RotateCcw, CheckCircle2, XCircle, AlertCircle,
  Activity, Zap, Clock, TrendingUp, Server, Cpu, Globe,
  MessageSquare, Code, Image, Volume2, BarChart3, LineChart,
  Download, Upload, RefreshCw, TestTube, Rocket, Terminal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestResult {
  provider: AIProvider;
  model: string;
  testType: string;
  status: 'pending' | 'running' | 'success' | 'error';
  responseTime?: number;
  cost?: number;
  tokens?: number;
  error?: string;
  response?: string;
  timestamp: Date;
}

interface FlowTestStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error';
  duration?: number;
  output?: any;
  error?: string;
}

interface PerformanceMetrics {
  provider: AIProvider;
  avgResponseTime: number;
  successRate: number;
  totalRequests: number;
  totalCost: number;
  lastUpdated: Date;
}

export default function RealTimeAITest() {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('openai');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4-turbo');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [flowTestSteps, setFlowTestSteps] = useState<FlowTestStep[]>([]);
  const [isFlowTestRunning, setIsFlowTestRunning] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<Map<AIProvider, PerformanceMetrics>>(new Map());
  const [realTimeLogs, setRealTimeLogs] = useState<string[]>([]);
  const [testPrompt, setTestPrompt] = useState("Hello! Please respond with 'Test successful' if you can read this.");
  const [testCode, setTestCode] = useState("Create a simple React component with TypeScript that displays a counter.");
  const [testImage, setTestImage] = useState("A futuristic robot assistant helping a developer write code");
  const [testVoice, setTestVoice] = useState("Hello, this is a test of the voice synthesis system.");
  const logsEndRef = useRef<HTMLDivElement>(null);

  const providers: AIProvider[] = ['openai', 'anthropic', 'google', 'cohere', 'mistral', 'groq', 'deepseek', 'zhipu'];

  useEffect(() => {
    loadPerformanceMetrics();
    const interval = setInterval(loadPerformanceMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [realTimeLogs]);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setRealTimeLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const loadPerformanceMetrics = async () => {
    try {
      const metrics = new Map<AIProvider, PerformanceMetrics>();
      
      for (const provider of providers) {
        // Simulate loading metrics (in real implementation, this would come from database)
        const mockMetrics: PerformanceMetrics = {
          provider,
          avgResponseTime: Math.random() * 1000 + 200,
          successRate: Math.random() * 20 + 80,
          totalRequests: Math.floor(Math.random() * 1000),
          totalCost: Math.random() * 100,
          lastUpdated: new Date()
        };
        metrics.set(provider, mockMetrics);
      }
      
      setPerformanceMetrics(metrics);
    } catch (error) {
      addLog(`Error loading performance metrics: ${error.message}`);
    }
  };

  const runSingleTest = async (provider: AIProvider, model: string, testType: string, testData: string) => {
    const startTime = Date.now();
    const testId = `${provider}-${model}-${testType}-${Date.now()}`;
    
    addLog(`Starting ${testType} test for ${provider}/${model}`);
    
    const result: TestResult = {
      provider,
      model,
      testType,
      status: 'running',
      timestamp: new Date()
    };
    
    setTestResults(prev => [...prev, result]);
    
    try {
      let response: AIResponse;
      
      switch (testType) {
        case 'text':
          response = await aiIntegrationManager.generateText(provider, testData);
          break;
        case 'code':
          response = await aiIntegrationManager.generateCode(provider, testData, {
            provider,
            model,
            language: 'typescript',
            framework: 'react',
            includeTests: true,
            includeDocs: true
          });
          break;
        case 'image':
          response = {
            content: await aiIntegrationManager.generateImage(provider as any, testData, {
              provider: provider as any,
              model: 'dall-e-3',
              size: '1024x1024',
              quality: 'standard',
              style: 'vivid'
            }),
            model,
            provider,
            metadata: { type: 'image' }
          };
          break;
        case 'voice':
          const audioBuffer = await aiIntegrationManager.generateVoice(provider as any, testData, {
            provider: provider as any,
            voiceId: 'rachel',
            model: 'eleven-multilingual-v2',
            speed: 1.0
          });
          response = {
            content: `Audio generated (${audioBuffer.byteLength} bytes)`,
            model,
            provider,
            metadata: { type: 'audio', size: audioBuffer.byteLength }
          };
          break;
        default:
          throw new Error(`Unknown test type: ${testType}`);
      }
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      const updatedResult: TestResult = {
        ...result,
        status: 'success',
        responseTime,
        cost: response.usage?.totalTokens ? response.usage.totalTokens * 0.00001 : 0,
        tokens: response.usage?.totalTokens || 0,
        response: response.content,
        timestamp: new Date()
      };
      
      setTestResults(prev => prev.map(r => r === result ? updatedResult : r));
      addLog(`✅ ${testType} test successful for ${provider}/${model} (${responseTime}ms)`);
      
      return updatedResult;
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      const errorResult: TestResult = {
        ...result,
        status: 'error',
        responseTime,
        error: error.message,
        timestamp: new Date()
      };
      
      setTestResults(prev => prev.map(r => r === result ? errorResult : r));
      addLog(`❌ ${testType} test failed for ${provider}/${model}: ${error.message}`);
      
      return errorResult;
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    addLog('🚀 Starting comprehensive AI provider tests');
    
    const allProviders = ['openai', 'anthropic', 'google', 'cohere', 'mistral', 'groq'];
    const testTypes = ['text', 'code'];
    
    for (const provider of allProviders) {
      try {
        const models = aiIntegrationManager.getModelsByProvider(provider);
        const primaryModel = models.find(m => m.type === 'text')?.id || models[0]?.id;
        
        if (primaryModel) {
          for (const testType of testTypes) {
            const testData = testType === 'text' ? testPrompt : testCode;
            await runSingleTest(provider as AIProvider, primaryModel, testType, testData);
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
          }
        }
      } catch (error) {
        addLog(`Error testing ${provider}: ${error.message}`);
      }
    }
    
    setIsRunning(false);
    addLog('✅ All tests completed');
  };

  const runFlowTest = async () => {
    setIsFlowTestRunning(true);
    addLog('🔄 Starting Vala Builder flow test');
    
    const steps: FlowTestStep[] = [
      {
        id: '1',
        name: 'Initialize Conversation',
        description: 'Start AI conversation and set context',
        status: 'pending'
      },
      {
        id: '2',
        name: 'Generate Project Plan',
        description: 'Create comprehensive project architecture',
        status: 'pending'
      },
      {
        id: '3',
        name: 'Generate Frontend Code',
        description: 'Create React components with TypeScript',
        status: 'pending'
      },
      {
        id: '4',
        name: 'Generate Backend API',
        description: 'Create Node.js API endpoints',
        status: 'pending'
      },
      {
        id: '5',
        name: 'Generate Database Schema',
        description: 'Create PostgreSQL schema with Prisma',
        status: 'pending'
      },
      {
        id: '6',
        name: 'Create Test Suite',
        description: 'Generate unit and integration tests',
        status: 'pending'
      },
      {
        id: '7',
        name: 'Generate Documentation',
        description: 'Create API docs and user guides',
        status: 'pending'
      },
      {
        id: '8',
        name: 'Deployment Configuration',
        description: 'Create Docker and deployment configs',
        status: 'pending'
      }
    ];
    
    setFlowTestSteps(steps);
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const startTime = Date.now();
      
      setFlowTestSteps(prev => prev.map(s => 
        s.id === step.id ? { ...s, status: 'running' } : s
      ));
      
      addLog(`⏳ Executing: ${step.name}`);
      
      try {
        // Simulate step execution with real AI calls
        let output;
        
        switch (step.id) {
          case '1':
            output = await runSingleTest(selectedProvider, selectedModel, 'text', 
              "Initialize a conversation for building a task management app. Set the context and ask clarifying questions.");
            break;
          case '2':
            output = await runSingleTest(selectedProvider, selectedModel, 'text',
              "Create a comprehensive project plan for a task management app with React frontend, Node.js backend, and PostgreSQL database.");
            break;
          case '3':
            output = await runSingleTest(selectedProvider, selectedModel, 'code',
              "Generate a complete React component for a task list with TypeScript, including state management and UI.");
            break;
          case '4':
            output = await runSingleTest(selectedProvider, selectedModel, 'code',
              "Generate Node.js API endpoints for task CRUD operations with Express and TypeScript.");
            break;
          case '5':
            output = await runSingleTest(selectedProvider, selectedModel, 'text',
              "Generate a PostgreSQL schema for task management with users, projects, tasks, and comments tables.");
            break;
          case '6':
            output = await runSingleTest(selectedProvider, selectedModel, 'code',
              "Generate Jest test suites for React components and API endpoints.");
            break;
          case '7':
            output = await runSingleTest(selectedProvider, selectedModel, 'text',
              "Generate comprehensive API documentation using OpenAPI specification and user guides.");
            break;
          case '8':
            output = await runSingleTest(selectedProvider, selectedModel, 'code',
              "Generate Docker configuration files and deployment scripts for production.");
            break;
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        setFlowTestSteps(prev => prev.map(s => 
          s.id === step.id ? { 
            ...s, 
            status: output?.status === 'success' ? 'success' : 'error',
            duration,
            output: output?.response,
            error: output?.error
          } : s
        ));
        
        addLog(`${output?.status === 'success' ? '✅' : '❌'} ${step.name} completed in ${duration}ms`);
        
        if (output?.status !== 'success') {
          addLog(`⚠️ Stopping flow test due to error in ${step.name}`);
          break;
        }
        
        // Small delay between steps
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        setFlowTestSteps(prev => prev.map(s => 
          s.id === step.id ? { 
            ...s, 
            status: 'error',
            duration,
            error: error.message
          } : s
        ));
        
        addLog(`❌ ${step.name} failed: ${error.message}`);
        break;
      }
    }
    
    setIsFlowTestRunning(false);
    addLog('🏁 Flow test completed');
  };

  const clearResults = () => {
    setTestResults([]);
    setFlowTestSteps([]);
    setRealTimeLogs([]);
    addLog('📋 Results cleared');
  };

  const exportResults = () => {
    const results = {
      testResults,
      flowTestSteps,
      performanceMetrics: Array.from(performanceMetrics.values()),
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-test-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addLog('📊 Results exported');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAvailableModels = () => {
    return aiIntegrationManager.getModelsByProvider(selectedProvider);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center">
          <TestTube className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Real-Time AI Testing</h1>
          <p className="text-sm text-muted-foreground">
            Test AI providers and validate Vala Builder workflows in real-time
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={clearResults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Clear
          </Button>
          <Button variant="outline" onClick={exportResults}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="single-tests" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="single-tests">Single Tests</TabsTrigger>
          <TabsTrigger value="flow-test">Flow Test</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="logs">Real-Time Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="single-tests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Individual Provider Tests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Provider</label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value as AIProvider)}
                    className="w-full mt-1 h-10 rounded-md border border-border bg-background px-3"
                  >
                    {providers.map(provider => (
                      <option key={provider} value={provider}>
                        {provider.charAt(0).toUpperCase() + provider.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full mt-1 h-10 rounded-md border border-border bg-background px-3"
                  >
                    {getAvailableModels().map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={runAllTests} 
                    disabled={isRunning}
                    className="w-full"
                  >
                    {isRunning ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run All Tests
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Text Test Prompt</label>
                  <Textarea
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                  <Button
                    onClick={() => runSingleTest(selectedProvider, selectedModel, 'text', testPrompt)}
                    disabled={isRunning}
                    className="mt-2 w-full"
                    variant="outline"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Test Text Generation
                  </Button>
                </div>
                <div>
                  <label className="text-sm font-medium">Code Test Prompt</label>
                  <Textarea
                    value={testCode}
                    onChange={(e) => setTestCode(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                  <Button
                    onClick={() => runSingleTest(selectedProvider, selectedModel, 'code', testCode)}
                    disabled={isRunning}
                    className="mt-2 w-full"
                    variant="outline"
                  >
                    <Code className="h-4 w-4 mr-2" />
                    Test Code Generation
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Image Test Prompt</label>
                  <Input
                    value={testImage}
                    onChange={(e) => setTestImage(e.target.value)}
                    className="mt-1"
                  />
                  <Button
                    onClick={() => runSingleTest(selectedProvider, selectedModel, 'image', testImage)}
                    disabled={isRunning}
                    className="mt-2 w-full"
                    variant="outline"
                  >
                    <Image className="h-4 w-4 mr-2" />
                    Test Image Generation
                  </Button>
                </div>
                <div>
                  <label className="text-sm font-medium">Voice Test Text</label>
                  <Input
                    value={testVoice}
                    onChange={(e) => setTestVoice(e.target.value)}
                    className="mt-1"
                  />
                  <Button
                    onClick={() => runSingleTest(selectedProvider, selectedModel, 'voice', testVoice)}
                    disabled={isRunning}
                    className="mt-2 w-full"
                    variant="outline"
                  >
                    <Volume2 className="h-4 w-4 mr-2" />
                    Test Voice Generation
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {testResults.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No tests run yet. Click "Run All Tests" to start.
                  </p>
                ) : (
                  testResults.map((result, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                      {getStatusIcon(result.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{result.provider}</span>
                          <Badge variant="secondary">{result.testType}</Badge>
                          <Badge variant="outline">{result.model}</Badge>
                        </div>
                        {result.responseTime && (
                          <p className="text-sm text-muted-foreground">
                            Response time: {result.responseTime}ms
                            {result.tokens && ` • Tokens: ${result.tokens}`}
                            {result.cost && ` • Cost: $${result.cost.toFixed(6)}`}
                          </p>
                        )}
                        {result.error && (
                          <p className="text-sm text-red-500">{result.error}</p>
                        )}
                        {result.response && (
                          <p className="text-sm text-muted-foreground truncate">
                            {result.response}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {result.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flow-test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Vala Builder Workflow Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-sm font-medium">Provider</label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value as AIProvider)}
                    className="w-full mt-1 h-10 rounded-md border border-border bg-background px-3"
                  >
                    {providers.map(provider => (
                      <option key={provider} value={provider}>
                        {provider.charAt(0).toUpperCase() + provider.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={runFlowTest}
                  disabled={isFlowTestRunning}
                  className="self-end"
                >
                  {isFlowTestRunning ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running Flow...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Flow Test
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                {flowTestSteps.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Click "Start Flow Test" to run the complete Vala Builder workflow.
                  </p>
                ) : (
                  flowTestSteps.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {index + 1}
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
                        {step.output && (
                          <p className="text-sm text-muted-foreground truncate">
                            {step.output}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from(performanceMetrics.values()).map(metric => (
                  <div key={metric.provider} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="h-4 w-4" />
                      <span className="font-medium">{metric.provider}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Avg Response:</span>
                        <span>{metric.avgResponseTime.toFixed(0)}ms</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Success Rate:</span>
                        <span>{metric.successRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Requests:</span>
                        <span>{metric.totalRequests}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Cost:</span>
                        <span>${metric.totalCost.toFixed(4)}</span>
                      </div>
                      <Progress value={metric.successRate} className="mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Real-Time Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
                {realTimeLogs.length === 0 ? (
                  <p className="text-gray-500">Waiting for logs...</p>
                ) : (
                  realTimeLogs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
