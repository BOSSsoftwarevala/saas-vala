import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  aiIntegrationManager, 
  AIProvider, 
  AIResponse 
} from '@/lib/ai-integrations';
import {
  Play, Pause, RotateCcw, CheckCircle2, XCircle, AlertCircle,
  Activity, Zap, Clock, TrendingUp, Server, Cpu, Globe,
  MessageSquare, Code, Database, Package, Rocket, Terminal,
  GitBranch, Users, Settings, Shield, FileText, Layers,
  ArrowRight, ArrowDown, SkipForward, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlowStep {
  id: string;
  name: string;
  description: string;
  category: 'planning' | 'frontend' | 'backend' | 'database' | 'testing' | 'deployment';
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  duration?: number;
  output?: any;
  error?: string;
  dependencies: string[];
  artifacts: string[];
  metrics: {
    tokens?: number;
    cost?: number;
    responseTime?: number;
  };
}

interface FlowTest {
  id: string;
  name: string;
  description: string;
  steps: FlowStep[];
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
  startTime?: Date;
  endTime?: Date;
  totalDuration?: number;
  selectedProvider: AIProvider;
  selectedModel: string;
}

const FLOW_TEMPLATES: Partial<FlowTest>[] = [
  {
    name: 'Full Stack Web App',
    description: 'Complete web application with React, Node.js, and PostgreSQL',
    selectedProvider: 'openai',
    selectedModel: 'gpt-4-turbo'
  },
  {
    name: 'Mobile App Development',
    description: 'React Native mobile app with backend API',
    selectedProvider: 'anthropic',
    selectedModel: 'claude-3-sonnet'
  },
  {
    name: 'AI-Powered SaaS',
    description: 'SaaS application with AI integrations',
    selectedProvider: 'google',
    selectedModel: 'gemini-1.0-pro'
  }
];

export default function FlowTestSystem() {
  const [currentFlow, setCurrentFlow] = useState<FlowTest | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [realTimeOutput, setRealTimeOutput] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Partial<FlowTest>>(FLOW_TEMPLATES[0]);
  const [flowHistory, setFlowHistory] = useState<FlowTest[]>([]);

  useEffect(() => {
    initializeFlow();
  }, []);

  const addOutput = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setRealTimeOutput(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const initializeFlow = () => {
    const steps: FlowStep[] = [
      // Planning Phase
      {
        id: '1',
        name: 'Project Requirements Analysis',
        description: 'Analyze user requirements and create project scope',
        category: 'planning',
        status: 'pending',
        dependencies: [],
        artifacts: ['requirements.md', 'project-scope.md'],
        metrics: {}
      },
      {
        id: '2',
        name: 'Architecture Design',
        description: 'Design system architecture and technology stack',
        category: 'planning',
        status: 'pending',
        dependencies: ['1'],
        artifacts: ['architecture.md', 'tech-stack.md'],
        metrics: {}
      },
      {
        id: '3',
        name: 'Database Schema Design',
        description: 'Create comprehensive database schema',
        category: 'database',
        status: 'pending',
        dependencies: ['2'],
        artifacts: ['schema.sql', 'relationships.md'],
        metrics: {}
      },

      // Frontend Development
      {
        id: '4',
        name: 'Component Structure Setup',
        description: 'Create React component hierarchy and routing',
        category: 'frontend',
        status: 'pending',
        dependencies: ['2'],
        artifacts: ['components/', 'routes/', 'App.tsx'],
        metrics: {}
      },
      {
        id: '5',
        name: 'UI Components Development',
        description: 'Build reusable UI components with TypeScript',
        category: 'frontend',
        status: 'pending',
        dependencies: ['4'],
        artifacts: ['Button.tsx', 'Input.tsx', 'Modal.tsx', 'Card.tsx'],
        metrics: {}
      },
      {
        id: '6',
        name: 'State Management Implementation',
        description: 'Implement Redux/Zustand for state management',
        category: 'frontend',
        status: 'pending',
        dependencies: ['5'],
        artifacts: ['store/', 'hooks/', 'types.ts'],
        metrics: {}
      },
      {
        id: '7',
        name: 'API Integration Layer',
        description: 'Create API client and data fetching hooks',
        category: 'frontend',
        status: 'pending',
        dependencies: ['6'],
        artifacts: ['api/', 'hooks/', 'services/'],
        metrics: {}
      },

      // Backend Development
      {
        id: '8',
        name: 'Server Setup & Configuration',
        description: 'Setup Express.js server with TypeScript',
        category: 'backend',
        status: 'pending',
        dependencies: ['3'],
        artifacts: ['server.ts', 'config/', 'middleware/'],
        metrics: {}
      },
      {
        id: '9',
        name: 'Database Models & ORM',
        description: 'Create Prisma models and database connection',
        category: 'backend',
        status: 'pending',
        dependencies: ['8', '3'],
        artifacts: ['prisma/', 'models/', 'database.ts'],
        metrics: {}
      },
      {
        id: '10',
        name: 'API Endpoints Development',
        description: 'Build RESTful API endpoints with validation',
        category: 'backend',
        status: 'pending',
        dependencies: ['9'],
        artifacts: ['routes/', 'controllers/', 'validators/'],
        metrics: {}
      },
      {
        id: '11',
        name: 'Authentication & Authorization',
        description: 'Implement JWT authentication and role-based access',
        category: 'backend',
        status: 'pending',
        dependencies: ['10'],
        artifacts: ['auth/', 'middleware/', 'guards/'],
        metrics: {}
      },

      // Testing Phase
      {
        id: '12',
        name: 'Unit Tests Setup',
        description: 'Setup Jest and write unit tests for components',
        category: 'testing',
        status: 'pending',
        dependencies: ['7', '11'],
        artifacts: ['__tests__/', 'jest.config.js', 'test-utils.tsx'],
        metrics: {}
      },
      {
        id: '13',
        name: 'Integration Tests',
        description: 'Write integration tests for API endpoints',
        category: 'testing',
        status: 'pending',
        dependencies: ['12'],
        artifacts: ['integration/', 'api.test.ts', 'db.test.ts'],
        metrics: {}
      },
      {
        id: '14',
        name: 'E2E Tests',
        description: 'Setup Playwright and write E2E tests',
        category: 'testing',
        status: 'pending',
        dependencies: ['13'],
        artifacts: ['e2e/', 'playwright.config.ts', 'spec.ts'],
        metrics: {}
      },

      // Deployment Phase
      {
        id: '15',
        name: 'Docker Configuration',
        description: 'Create Dockerfiles and docker-compose setup',
        category: 'deployment',
        status: 'pending',
        dependencies: ['14'],
        artifacts: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
        metrics: {}
      },
      {
        id: '16',
        name: 'CI/CD Pipeline Setup',
        description: 'Setup GitHub Actions for automated deployment',
        category: 'deployment',
        status: 'pending',
        dependencies: ['15'],
        artifacts: ['.github/workflows/', 'deploy.yml', 'test.yml'],
        metrics: {}
      },
      {
        id: '17',
        name: 'Production Deployment',
        description: 'Deploy application to production environment',
        category: 'deployment',
        status: 'pending',
        dependencies: ['16'],
        artifacts: ['deployment/', 'k8s/', 'terraform/'],
        metrics: {}
      }
    ];

    setCurrentFlow({
      id: `flow-${Date.now()}`,
      name: selectedTemplate?.name || 'Custom Flow Test',
      description: selectedTemplate?.description || 'Custom flow test',
      steps,
      status: 'idle',
      selectedProvider: selectedTemplate?.selectedProvider || 'openai',
      selectedModel: selectedTemplate?.selectedModel || 'gpt-4-turbo'
    });
  };

  const executeStep = async (step: FlowStep): Promise<{ success: boolean; output?: any; error?: string; metrics?: any }> => {
    const startTime = Date.now();
    addOutput(`🔄 Executing: ${step.name}`);

    try {
      let response: AIResponse;
      let prompt = '';

      switch (step.id) {
        case '1':
          prompt = "Analyze requirements for a task management web application with user authentication, project management, and team collaboration features. Create a comprehensive requirements document.";
          break;
        case '2':
          prompt = "Design the architecture for a task management app using React frontend, Node.js backend, PostgreSQL database, and RESTful APIs. Include scalability considerations and technology choices.";
          break;
        case '3':
          prompt = "Create a PostgreSQL database schema for a task management system with users, projects, tasks, comments, and attachments. Include proper relationships, indexes, and constraints.";
          break;
        case '4':
          prompt = "Generate the React component structure and routing setup for a task management application. Include App.tsx, main layout components, and route definitions using React Router.";
          break;
        case '5':
          prompt = "Create TypeScript React components for a task management UI: Button, Input, Modal, Card, TaskList, TaskItem, ProjectCard, and UserProfile components with proper styling.";
          break;
        case '6':
          prompt = "Implement state management using Zustand for a task management app. Create stores for tasks, projects, users, and UI state with TypeScript types.";
          break;
        case '7':
          prompt = "Create an API client layer using Axios for a React task management app. Include hooks for data fetching, error handling, and request/response interceptors.";
          break;
        case '8':
          prompt = "Setup an Express.js server with TypeScript for a task management API. Include middleware setup, error handling, CORS, and basic server configuration.";
          break;
        case '9':
          prompt = "Create Prisma models for a task management system with User, Project, Task, Comment, and Attachment entities. Include proper relationships and data types.";
          break;
        case '10':
          prompt = "Build RESTful API endpoints for task management: auth, users, projects, tasks, comments. Include validation, error handling, and proper HTTP status codes.";
          break;
        case '11':
          prompt = "Implement JWT authentication and authorization middleware for Express.js. Include token generation, validation, refresh tokens, and role-based access control.";
          break;
        case '12':
          prompt = "Write comprehensive Jest unit tests for React components in a task management app. Test Button, Input, Modal, TaskList, and TaskItem components with proper mocking.";
          break;
        case '13':
          prompt = "Create integration tests for Node.js API endpoints using Jest and Supertest. Test authentication, CRUD operations for tasks and projects, and error scenarios.";
          break;
        case '14':
          prompt = "Setup Playwright E2E tests for a task management web application. Test user registration, login, project creation, task management, and team collaboration features.";
          break;
        case '15':
          prompt = "Create Docker configuration for a full-stack task management app. Include Dockerfile for React frontend, Node.js backend, and docker-compose.yml with PostgreSQL.";
          break;
        case '16':
          prompt = "Setup GitHub Actions CI/CD pipeline for a task management application. Include automated testing, building, Docker deployment, and environment-specific configurations.";
          break;
        case '17':
          prompt = "Create deployment configuration for production. Include Kubernetes manifests, environment variables, scaling policies, and monitoring setup for a task management app.";
          break;
        default:
          throw new Error(`Unknown step: ${step.id}`);
      }

      response = await aiIntegrationManager.generateText(
        currentFlow!.selectedProvider,
        prompt,
        {
          model: currentFlow!.selectedModel,
          temperature: 0.3,
          maxTokens: 4000
        }
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      return {
        success: true,
        output: response.content,
        metrics: {
          tokens: response.usage?.totalTokens || 0,
          cost: response.usage?.totalTokens ? response.usage.totalTokens * 0.00001 : 0,
          responseTime
        }
      };

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      return {
        success: false,
        error: error.message,
        metrics: { responseTime }
      };
    }
  };

  const runFlow = async () => {
    if (!currentFlow) return;

    setIsRunning(true);
    setIsPaused(false);
    const startTime = Date.now();

    setCurrentFlow(prev => prev ? {
      ...prev,
      status: 'running',
      startTime: new Date()
    } : null);

    addOutput(`🚀 Starting flow: ${currentFlow.name}`);

    for (const step of currentFlow.steps) {
      if (isPaused) {
        addOutput("⏸️ Flow paused");
        await new Promise(resolve => {
          const checkPause = setInterval(() => {
            if (!isPaused) {
              clearInterval(checkPause);
              resolve(undefined);
            }
          }, 100);
        });
        addOutput("▶️ Flow resumed");
      }

      // Check dependencies
      const dependenciesMet = step.dependencies.every(depId => {
        const depStep = currentFlow.steps.find(s => s.id === depId);
        return depStep?.status === 'success';
      });

      if (!dependenciesMet) {
        setCurrentFlow(prev => prev ? {
          ...prev,
          steps: prev.steps.map(s => 
            s.id === step.id ? { ...s, status: 'skipped' } : s
          )
        } : null);
        addOutput(`⏭️ Skipping ${step.name} (dependencies not met)`);
        continue;
      }

      // Execute step
      setCurrentFlow(prev => prev ? {
        ...prev,
        steps: prev.steps.map(s => 
          s.id === step.id ? { ...s, status: 'running' } : s
        )
      } : null);

      const result = await executeStep(step);

      setCurrentFlow(prev => prev ? {
        ...prev,
        steps: prev.steps.map(s => 
          s.id === step.id ? {
            ...s,
            status: result.success ? 'success' : 'error',
            output: result.output,
            error: result.error,
            metrics: { ...s.metrics, ...result.metrics }
          } : s
        )
      } : null);

      addOutput(result.success ? 
        `✅ ${step.name} completed (${result.metrics?.responseTime}ms)` : 
        `❌ ${step.name} failed: ${result.error}`
      );

      if (!result.success) {
        setCurrentFlow(prev => prev ? {
          ...prev,
          status: 'failed',
          endTime: new Date()
        } : null);
        setIsRunning(false);
        addOutput("🛑 Flow stopped due to error");
        return;
      }

      // Small delay between steps
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    setCurrentFlow(prev => prev ? {
      ...prev,
      status: 'completed',
      endTime: new Date(),
      totalDuration
    } : null);

    setIsRunning(false);
    addOutput(`🎉 Flow completed in ${totalDuration}ms`);
    
    // Add to history
    setFlowHistory(prev => [...prev, currentFlow!]);
  };

  const pauseFlow = () => {
    setIsPaused(true);
    addOutput("⏸️ Pausing flow...");
  };

  const resumeFlow = () => {
    setIsPaused(false);
    addOutput("▶️ Resuming flow...");
  };

  const stopFlow = () => {
    setIsRunning(false);
    setIsPaused(false);
    setCurrentFlow(prev => prev ? {
      ...prev,
      status: 'failed',
      endTime: new Date()
    } : null);
    addOutput("🛑 Flow stopped");
  };

  const resetFlow = () => {
    setIsRunning(false);
    setIsPaused(false);
    setRealTimeOutput([]);
    initializeFlow();
    addOutput("🔄 Flow reset");
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'planning': return <FileText className="h-4 w-4" />;
      case 'frontend': return <Layers className="h-4 w-4" />;
      case 'backend': return <Server className="h-4 w-4" />;
      case 'database': return <Database className="h-4 w-4" />;
      case 'testing': return <Shield className="h-4 w-4" />;
      case 'deployment': return <Rocket className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'skipped': return <SkipForward className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'planning': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'frontend': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'backend': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'database': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'testing': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'deployment': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStepProgress = () => {
    if (!currentFlow) return 0;
    const completed = currentFlow.steps.filter(s => s.status === 'success').length;
    return (completed / currentFlow.steps.length) * 100;
  };

  const getTotalMetrics = () => {
    if (!currentFlow) return { tokens: 0, cost: 0, time: 0 };
    
    return currentFlow.steps.reduce((acc, step) => ({
      tokens: acc.tokens + (step.metrics.tokens || 0),
      cost: acc.cost + (step.metrics.cost || 0),
      time: acc.time + (step.metrics.responseTime || 0)
    }), { tokens: 0, cost: 0, time: 0 });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
          <Activity className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Flow Testing System</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive end-to-end testing for Vala Builder workflows
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={resetFlow} disabled={isRunning}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      <Tabs defaultValue="flow" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="flow">Flow Execution</TabsTrigger>
          <TabsTrigger value="details">Step Details</TabsTrigger>
          <TabsTrigger value="output">Real-time Output</TabsTrigger>
        </TabsList>

        <TabsContent value="flow" className="space-y-4">
          {/* Flow Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  {currentFlow?.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{currentFlow?.selectedProvider}</Badge>
                  <Badge variant="secondary">{currentFlow?.selectedModel}</Badge>
                  {currentFlow?.status === 'running' && (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      Running
                    </Badge>
                  )}
                  {currentFlow?.status === 'completed' && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      Completed
                    </Badge>
                  )}
                  {currentFlow?.status === 'failed' && (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      Failed
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{currentFlow?.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Overall Progress</span>
                  <span>{getStepProgress().toFixed(0)}%</span>
                </div>
                <Progress value={getStepProgress()} className="h-2" />
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{currentFlow?.steps.length}</div>
                  <div className="text-sm text-muted-foreground">Total Steps</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{getTotalMetrics().tokens}</div>
                  <div className="text-sm text-muted-foreground">Tokens Used</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">${getTotalMetrics().cost.toFixed(4)}</div>
                  <div className="text-sm text-muted-foreground">Total Cost</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{(getTotalMetrics().time / 1000).toFixed(1)}s</div>
                  <div className="text-sm text-muted-foreground">Total Time</div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex gap-2">
                {!isRunning ? (
                  <Button onClick={runFlow} className="flex-1">
                    <Play className="h-4 w-4 mr-2" />
                    Start Flow
                  </Button>
                ) : (
                  <>
                    {!isPaused ? (
                      <Button onClick={pauseFlow} variant="outline">
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </Button>
                    ) : (
                      <Button onClick={resumeFlow} variant="outline">
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </Button>
                    )}
                    <Button onClick={stopFlow} variant="destructive">
                      <XCircle className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Flow Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Flow Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentFlow?.steps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    {getStatusIcon(step.status)}
                    <div className="flex-shrink-0">
                      {getCategoryIcon(step.category)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{step.name}</span>
                        <Badge variant="outline" className={getCategoryColor(step.category)}>
                          {step.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      {step.duration && (
                        <p className="text-sm text-muted-foreground">
                          Duration: {step.duration}ms
                          {step.metrics.tokens && ` • Tokens: ${step.metrics.tokens}`}
                          {step.metrics.cost && ` • Cost: $${step.metrics.cost.toFixed(6)}`}
                        </p>
                      )}
                      {step.error && (
                        <p className="text-sm text-red-500">{step.error}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {step.artifacts.map(artifact => (
                        <Badge key={artifact} variant="secondary" className="text-xs">
                          {artifact}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Step Details & Outputs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentFlow?.steps.filter(step => step.status !== 'pending').map(step => (
                  <div key={step.id} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(step.status)}
                      <span className="font-medium">{step.name}</span>
                      <Badge variant="outline" className={getCategoryColor(step.category)}>
                        {step.category}
                      </Badge>
                    </div>
                    {step.output && (
                      <div className="mt-2">
                        <h4 className="font-medium text-sm mb-1">Output:</h4>
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                          {step.output}
                        </pre>
                      </div>
                    )}
                    {step.error && (
                      <div className="mt-2">
                        <h4 className="font-medium text-sm mb-1 text-red-500">Error:</h4>
                        <p className="text-sm text-red-500">{step.error}</p>
                      </div>
                    )}
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
                <Terminal className="h-5 w-5" />
                Real-time Output
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
                {realTimeOutput.length === 0 ? (
                  <p className="text-gray-500">Waiting for flow execution...</p>
                ) : (
                  realTimeOutput.map((line, index) => (
                    <div key={index} className="mb-1">
                      {line}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
