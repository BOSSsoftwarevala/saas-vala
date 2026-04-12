import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Activity, 
  Server, 
  Database, 
  Globe, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Monitor,
  HardDrive,
  Cpu,
  Wifi,
  WifiOff,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Play,
  Square,
  Eye,
  TestTube,
  Zap,
  Shield,
  BarChart3,
  Radio,
  RadioOff,
  Timer,
  Network,
  Brain,
  Heart,
  Settings,
  Bell,
  BellOff,
  Tool,
  Map,
  GitBranch,
  ZapOff,
  Thermometer,
  Flame,
  Snowflake,
  Target,
  Crosshair,
  Radar,
  Pulse,
  ActivityIcon,
  LineChart,
  PieChart,
  Layers,
  Grid3X3,
  Hexagon,
  Triangle,
  Circle,
  SquareIcon,
  Crown,
  Infinity,
  Sparkles,
  Command,
  Terminal,
  Code,
  GitMerge,
  GitBranchPlus,
  Rocket,
  Globe2,
  Users,
  DollarSign,
  TrendingUpIcon,
  ZapIcon,
  ShieldCheck,
  EyeOff,
  Lock,
  Unlock,
  Key,
  Package,
  Archive,
  DatabaseBackup,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Gauge,
  Tachometer,
  TimerOff,
  TimerReset,
  PlayCircle,
  PauseCircle,
  SkipForward,
  SkipBack,
  RotateCcw,
  RotateCw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Minus,
  Plus,
  MoreVertical,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Expand,
  Shrink,
  Maximize,
  Minimize,
  Fullscreen,
  FullscreenExit
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { 
  initializeGodModeSystem,
  getSystemHealthScore,
  simulateFailure,
  getDigitalTwin,
  enableGodModeChaos,
  subscribeToGodModeEvents,
  godModeHealthSystem,
  type DigitalTwinState,
  type RemediationPlaybook,
  type PolicyRule,
  type EventStream,
  type SystemHealthScore,
  type LearningInsight
} from '@/lib/godModeHealth';

const GodModeHealthPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [masterLoopActive, setMasterLoopActive] = useState(false);
  const [chaosMode, setChaosMode] = useState(false);
  const [digitalTwin, setDigitalTwin] = useState<DigitalTwinState | null>(null);
  const [systemHealthScore, setSystemHealthScore] = useState<SystemHealthScore | null>(null);
  const [remediationPlaybooks, setRemediationPlaybooks] = useState<RemediationPlaybook[]>([]);
  const [policyRules, setPolicyRules] = useState<PolicyRule[]>([]);
  const [learningInsights, setLearningInsights] = useState<LearningInsight[]>([]);
  const [selectedSimulation, setSelectedSimulation] = useState<any>(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState<RemediationPlaybook | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyRule | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<LearningInsight | null>(null);
  const [realTimeEvents, setRealTimeEvents] = useState<EventStream[]>([]);
  const eventSubscriptionRef = useRef<(() => void) | null>(null);

  // Check user role for access control
  const userRole = user?.role || 'user';
  const hasAccess = userRole === 'admin' || userRole === 'super_admin';

  // Initialize God Mode System
  useEffect(() => {
    if (!hasAccess) {
      toast.error('Access denied. Admin privileges required.');
      return;
    }

    const initializeSystem = async () => {
      try {
        setLoading(true);
        
        // Initialize God Mode System
        await initializeGodModeSystem();
        setIsInitialized(true);
        setMasterLoopActive(true);

        // Load initial data
        await loadGodModeData();

        // Subscribe to real-time events
        const unsubscribe = subscribeToGodModeEvents('action', (event: EventStream) => {
          setRealTimeEvents(prev => [event, ...prev.slice(0, 9)]);
        });

        eventSubscriptionRef.current = unsubscribe;

        // Start continuous updates
        const updateInterval = setInterval(async () => {
          await loadGodModeData();
        }, 30000); // Every 30 seconds

        toast.success('God Mode Health System initialized - Autonomous infra control active');

        return () => {
          clearInterval(updateInterval);
          if (eventSubscriptionRef.current) {
            eventSubscriptionRef.current();
          }
        };

      } catch (error) {
        console.error('Failed to initialize God Mode System:', error);
        toast.error('Failed to initialize God Mode System');
      } finally {
        setLoading(false);
      }
    };

    const cleanup = initializeSystem();
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [hasAccess]);

  // Load God Mode data
  const loadGodModeData = useCallback(async () => {
    try {
      const [twin, healthScore, playbooks, policies, insights] = await Promise.all([
        getDigitalTwin(),
        getSystemHealthScore(),
        godModeHealthSystem.getRemediationPlaybooks(),
        godModeHealthSystem.getPolicyRules(),
        godModeHealthSystem.getLearningInsights()
      ]);

      setDigitalTwin(twin);
      setSystemHealthScore(healthScore);
      setRemediationPlaybooks(playbooks);
      setPolicyRules(policies);
      setLearningInsights(insights);

    } catch (error) {
      console.error('Failed to load God Mode data:', error);
    }
  }, []);

  // Get status icon with God Mode indication
  const getStatusIcon = (status: string, isGod: boolean = false) => {
    const IconComponent = () => {
      switch (status) {
        case 'healthy':
        case 'up':
        case 'connected':
        case 'running':
        case 'met':
          return <CheckCircle className={`h-5 w-5 text-green-500 ${isGod ? 'animate-pulse' : ''}`} />;
        case 'warning':
        case 'at_risk':
        case 'degraded':
          return <AlertTriangle className={`h-5 w-5 text-yellow-500 ${isGod ? 'animate-pulse' : ''}`} />;
        case 'critical':
        case 'down':
        case 'disconnected':
        case 'stopped':
        case 'failed':
        case 'breached':
          return <XCircle className={`h-5 w-5 text-red-500 ${isGod ? 'animate-pulse' : ''}`} />;
        default:
          return <AlertCircle className={`h-5 w-5 text-gray-500`} />;
      }
    };

    return <IconComponent />;
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
      case 'met':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
      case 'at_risk':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high':
      case 'critical':
      case 'breached':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Test failure simulation
  const handleSimulateFailure = async (type: string, target: string) => {
    try {
      const simulation = await simulateFailure(type, target);
      if (simulation) {
        toast.success(`Failure simulation completed: ${type} on ${target}`);
        setSelectedSimulation(simulation);
        await loadGodModeData();
      }
    } catch (error) {
      toast.error('Failed to simulate failure');
    }
  };

  // Enable chaos mode
  const handleEnableChaosMode = async () => {
    try {
      await enableGodModeChaos();
      setChaosMode(true);
      toast.success('God Mode Chaos enabled - Autonomous testing active');
    } catch (error) {
      toast.error('Failed to enable chaos mode');
    }
  };

  // Get health score color
  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-yellow-600';
    if (score >= 70) return 'text-orange-600';
    return 'text-red-600';
  };

  if (!hasAccess) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            You need admin privileges to access God Mode Health System.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Crown className="h-8 w-8 text-yellow-500" />
            God Mode Health System
            <Badge variant="outline" className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none">
              AUTONOMOUS • ZERO DOWNTIME
            </Badge>
          </h1>
          <p className="text-muted-foreground">
            Self-evolving, autonomous infrastructure control system with predictive healing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {masterLoopActive ? (
              <Infinity className="h-4 w-4 text-green-500 animate-pulse" />
            ) : (
              <PauseCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm text-muted-foreground">
              Master Loop {masterLoopActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => handleSimulateFailure('failure', 'server-1')}
          >
            <Flame className="h-4 w-4 mr-2" />
            Simulate
          </Button>
          <Button
            variant={chaosMode ? "destructive" : "outline"}
            onClick={handleEnableChaosMode}
          >
            <Zap className="h-4 w-4 mr-2" />
            {chaosMode ? 'Chaos ON' : 'God Chaos'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* God Mode Status Overview */}
          <Card className="border-l-4 border-l-gradient-to-r from-purple-500 to-pink-500 bg-gradient-to-r from-purple-50 to-pink-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Crown className="h-5 w-5 text-yellow-500 animate-pulse" />
                God Mode System Status
                <Badge variant="outline" className="text-xs bg-black text-white">
                  AUTONOMOUS CONTROL
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Digital Twin</span>
                  <Badge variant="outline" className="text-xs">ACTIVE</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Master Loop</span>
                  <Badge variant="outline" className="text-xs">RUNNING</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Auto-Remediation</span>
                  <Badge variant="outline" className="text-xs">ACTIVE</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Self-Learning</span>
                  <Badge variant="outline" className="text-xs">EVOLVING</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Zero Downtime</span>
                  <Badge variant="outline" className="text-xs">GUARANTEED</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Health Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tachometer className="h-5 w-5" />
                System Health Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              {systemHealthScore && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">Overall Score</span>
                    <span className={`text-4xl font-bold ${getHealthScoreColor(systemHealthScore.overall)}`}>
                      {systemHealthScore.overall.toFixed(1)}%
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-5">
                    {Object.entries(systemHealthScore.breakdown).map(([key, value]) => (
                      <div key={key} className="text-center">
                        <div className="text-2xl font-bold" style={{ color: getHealthScoreColor(value.score) }}>
                          {value.score.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">{key}</div>
                        <div className="text-xs text-muted-foreground">Weight: {(value.weight * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Digital Twin Infrastructure */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe2 className="h-5 w-5" />
                Digital Twin Infrastructure
              </CardTitle>
            </CardHeader>
            <CardContent>
              {digitalTwin && (
                <div className="space-y-6">
                  {/* Servers */}
                  <div>
                    <h4 className="font-medium mb-3">Servers</h4>
                    <div className="grid gap-3 md:grid-cols-3">
                      {digitalTwin.infrastructure.servers.map((server, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{server.name}</span>
                            {getStatusIcon(server.status, true)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>CPU</span>
                              <span>{server.cpu}%</span>
                            </div>
                            <Progress value={server.cpu} className="h-1" />
                            <div className="flex justify-between text-xs">
                              <span>RAM</span>
                              <span>{server.ram}%</span>
                            </div>
                            <Progress value={server.ram} className="h-1" />
                            <div className="flex justify-between text-xs">
                              <span>Disk</span>
                              <span>{server.disk}%</span>
                            </div>
                            <Progress value={server.disk} className="h-1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Services */}
                  <div>
                    <h4 className="font-medium mb-3">Services</h4>
                    <div className="grid gap-3 md:grid-cols-3">
                      {digitalTwin.infrastructure.services.map((service, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{service.name}</span>
                            <Badge variant="outline" className="text-xs">
                              v{service.version}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Replicas: {service.replicas}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Dependencies: {service.dependencies.join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Remediation Playbooks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Command className="h-5 w-5" />
                Auto-Remediation Playbooks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {remediationPlaybooks.map((playbook, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{playbook.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {playbook.actions.length} actions
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Trigger: {playbook.trigger.condition} {playbook.trigger.threshold} {playbook.trigger.metric}
                    </div>
                    <div className="flex gap-2">
                      {playbook.actions.slice(0, 3).map((action, actionIndex) => (
                        <Badge key={actionIndex} variant="secondary" className="text-xs">
                          {action.type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Policy Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Policy Engine Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policyRules.map((policy, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{policy.name}</TableCell>
                        <TableCell className="font-mono text-xs">{policy.condition}</TableCell>
                        <TableCell>{policy.action}</TableCell>
                        <TableCell>
                          <Badge variant={policy.priority === 1 ? 'destructive' : 'secondary'}>
                            {policy.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {policy.category}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Learning Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Self-Learning Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {learningInsights.slice(0, 5).map((insight, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Lesson Learned</span>
                      <Badge variant="outline" className="text-xs">
                        {insight.category}
                      </Badge>
                    </div>
                    <div className="text-sm mb-2">{insight.lesson}</div>
                    <div className="text-xs text-muted-foreground">
                      Confidence: {(insight.confidence * 100).toFixed(1)}% • 
                      Impact: {insight.improvement.impact}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Real-time Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                Real-time Event Stream
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {realTimeEvents.map((event, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded text-sm">
                    <div className={`w-2 h-2 rounded-full ${
                      event.severity === 'critical' ? 'bg-red-500' :
                      event.severity === 'warning' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`} />
                    <span className="text-muted-foreground">
                      {formatTimestamp(event.timestamp)}
                    </span>
                    <span className="font-medium">{event.type}</span>
                    <span className="text-muted-foreground">
                      {event.source}
                    </span>
                    {event.data?.playbook && (
                      <Badge variant="outline" className="text-xs">
                        {event.data.playbook}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* God Mode Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                God Mode Controls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">Digital Twin</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    ACTIVE
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    <Infinity className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Master Loop</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    RUNNING
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    {chaosMode ? <Flame className="h-4 w-4 text-red-500" /> : <TestTube className="h-4 w-4 text-gray-500" />}
                    <span className="text-sm font-medium">Chaos Mode</span>
                  </div>
                  <Badge variant={chaosMode ? "destructive" : "outline"} className="text-xs">
                    {chaosMode ? 'ENABLED' : 'DISABLED'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default GodModeHealthPage;
