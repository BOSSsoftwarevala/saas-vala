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
  SquareIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { 
  initializeAIHealthSystem,
  performAIAnalysis,
  createDistributedTrace,
  addServiceToTrace,
  enableChaosTestMode,
  generateDailyHealthReport,
  setSilentMode,
  setMaintenanceMode,
  aiHealthSystem,
  type AnomalyDetection,
  type PredictiveFailure,
  type RootCauseAnalysis,
  type SelfHealAction,
  type DistributedTrace,
  type ServiceDependency,
  type CircuitBreakerState,
  type IncidentTimeline,
  type SLOMetrics
} from '@/lib/aiHealthSystem';

const AIHealthSystemPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSilentMode, setIsSilentModeState] = useState(false);
  const [isMaintenanceMode, setIsMaintenanceModeState] = useState(false);
  const [isChaosMode, setIsChaosMode] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyDetection | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictiveFailure | null>(null);
  const [selectedRootCause, setSelectedRootCause] = useState<RootCauseAnalysis | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<DistributedTrace | null>(null);
  const [aiMetrics, setAIMetrics] = useState({
    anomalies: [] as AnomalyDetection[],
    predictions: [] as PredictiveFailure[],
    rootCauses: [] as RootCauseAnalysis[],
    selfHealActions: [] as SelfHealAction[],
    dependencies: [] as ServiceDependency[],
    circuitBreakers: [] as CircuitBreakerState[],
    incidents: [] as IncidentTimeline[],
    sloMetrics: [] as SLOMetrics[]
  });
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check user role for access control
  const userRole = user?.role || 'user';
  const hasAccess = userRole === 'admin' || userRole === 'super_admin';

  // Initialize AI Health System
  useEffect(() => {
    if (!hasAccess) {
      toast.error('Access denied. Admin privileges required.');
      return;
    }

    const initializeSystem = async () => {
      try {
        setLoading(true);
        
        // Initialize AI Health System
        await initializeAIHealthSystem();
        setIsInitialized(true);

        // Load initial data
        await loadAIData();

        // Start continuous analysis
        analysisIntervalRef.current = setInterval(async () => {
          await performAIAnalysis();
          await loadAIData();
        }, 30000); // Every 30 seconds

        toast.success('AI Health System initialized with predictive capabilities');

      } catch (error) {
        console.error('Failed to initialize AI Health System:', error);
        toast.error('Failed to initialize AI Health System');
      } finally {
        setLoading(false);
      }
    };

    initializeSystem();

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, [hasAccess]);

  // Load AI data
  const loadAIData = useCallback(async () => {
    try {
      // Get data from AI Health System
      const dependencies = aiHealthSystem.getServiceDependencies();
      const circuitBreakers = aiHealthSystem.getCircuitBreakers();
      const incidents = aiHealthSystem.getActiveIncidents();
      const sloMetrics = await aiHealthSystem.getSLOStatus();

      setAIMetrics(prev => ({
        ...prev,
        dependencies,
        circuitBreakers,
        incidents,
        sloMetrics
      }));

    } catch (error) {
      console.error('Failed to load AI data:', error);
    }
  }, []);

  // Get status icon with AI indication
  const getStatusIcon = (status: string, isAI: boolean = false) => {
    const IconComponent = () => {
      switch (status) {
        case 'healthy':
        case 'up':
        case 'connected':
        case 'running':
        case 'met':
          return <CheckCircle className={`h-5 w-5 text-green-500 ${isAI ? 'animate-pulse' : ''}`} />;
        case 'warning':
        case 'at_risk':
        case 'medium':
          return <AlertTriangle className={`h-5 w-5 text-yellow-500 ${isAI ? 'animate-pulse' : ''}`} />;
        case 'critical':
        case 'down':
        case 'disconnected':
        case 'stopped':
        case 'breached':
        case 'high':
          return <XCircle className={`h-5 w-5 text-red-500 ${isAI ? 'animate-pulse' : ''}`} />;
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

  // Test chaos mode
  const handleEnableChaosMode = async () => {
    try {
      await enableChaosTestMode();
      setIsChaosMode(true);
      toast.success('Chaos test mode enabled - AI will test system resilience');
    } catch (error) {
      toast.error('Failed to enable chaos test mode');
    }
  };

  // Generate daily report
  const handleGenerateReport = async () => {
    try {
      const report = await generateDailyHealthReport();
      if (report) {
        toast.success('Daily health report generated');
        console.log('Daily Report:', report);
      }
    } catch (error) {
      toast.error('Failed to generate daily report');
    }
  };

  // Toggle silent mode
  const handleToggleSilentMode = () => {
    const newState = !isSilentMode;
    setSilentMode(newState);
    setIsSilentModeState(newState);
    toast.info(`Silent mode ${newState ? 'enabled' : 'disabled'}`);
  };

  // Toggle maintenance mode
  const handleToggleMaintenanceMode = () => {
    const newState = !isMaintenanceMode;
    setMaintenanceMode(newState);
    setIsMaintenanceModeState(newState);
    toast.info(`Maintenance mode ${newState ? 'enabled' : 'disabled'}`);
  };

  // Test distributed tracing
  const handleTestTracing = async () => {
    try {
      const traceId = await createDistributedTrace('test-request-123', user?.id);
      
      // Simulate service calls
      await addServiceToTrace(traceId, 'frontend', 100, 'success');
      await addServiceToTrace(traceId, 'api', 250, 'success');
      await addServiceToTrace(traceId, 'database', 150, 'success');
      
      toast.success('Distributed tracing test completed');
    } catch (error) {
      toast.error('Failed to test distributed tracing');
    }
  };

  if (!hasAccess) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            You need admin privileges to access AI Health System.
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
            <Brain className="h-8 w-8 text-purple-500" />
            AI Health System
            <Badge variant="outline" className="text-xs">
              PREDICTIVE • SELF-HEAL
            </Badge>
          </h1>
          <p className="text-muted-foreground">
            AI-driven predictive monitoring with autonomous self-healing capabilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {isInitialized ? (
              <Brain className="h-4 w-4 text-green-500 animate-pulse" />
            ) : (
              <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
            )}
            <span className="text-sm text-muted-foreground">
              AI {isInitialized ? 'Active' : 'Initializing'}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleSilentMode}
          >
            {isSilentMode ? <BellOff className="h-4 w-4 mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
            {isSilentMode ? 'Silent' : 'Alerts'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleMaintenanceMode}
          >
            <Tool className="h-4 w-4 mr-2" />
            {isMaintenanceMode ? 'Maint' : 'Normal'}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestTracing}
          >
            <GitBranch className="h-4 w-4 mr-2" />
            Test Trace
          </Button>
          <Button
            variant="outline"
            onClick={handleGenerateReport}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Report
          </Button>
          <Button
            variant={isChaosMode ? "destructive" : "outline"}
            onClick={handleEnableChaosMode}
          >
            <Flame className="h-4 w-4 mr-2" />
            {isChaosMode ? 'Chaos ON' : 'Chaos Test'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* AI Status Overview */}
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="h-5 w-5 text-purple-500 animate-pulse" />
                AI System Status
                <Badge variant="outline" className="text-xs">
                  AUTONOMOUS
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Anomaly Detection</span>
                  <Badge variant="outline" className="text-xs">ACTIVE</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Predictive Engine</span>
                  <Badge variant="outline" className="text-xs">ACTIVE</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Self-Heal System</span>
                  <Badge variant="outline" className="text-xs">ACTIVE</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Radar className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Root Cause AI</span>
                  <Badge variant="outline" className="text-xs">ACTIVE</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Metrics Dashboard */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Anomalies Detected</CardTitle>
                <Brain className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {aiMetrics.anomalies.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  AI-detected issues
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Predictions</CardTitle>
                <Target className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {aiMetrics.predictions.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Failure predictions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Self-Heal Actions</CardTitle>
                <Heart className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {aiMetrics.selfHealActions.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-fixes executed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">SLO Status</CardTitle>
                <Shield className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {aiMetrics.sloMetrics.filter(slo => slo.status === 'met').length}/{aiMetrics.sloMetrics.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  SLOs met today
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Service Dependencies Map */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Service Dependency Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {aiMetrics.dependencies.map((dep, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium capitalize">{dep.service}</span>
                      <Badge className={getSeverityColor(dep.criticality)}>
                        {dep.criticality.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Depends on: {dep.dependsOn.join(', ') || 'None'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Impact: {dep.healthImpact}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Circuit Breaker Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ZapOff className="h-5 w-5" />
                Circuit Breaker Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Failures</TableHead>
                      <TableHead>Next Retry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiMetrics.circuitBreakers.map((breaker, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{breaker.service}</TableCell>
                        <TableCell>
                          <Badge className={
                            breaker.state === 'closed' ? 'bg-green-100 text-green-800' :
                            breaker.state === 'open' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }>
                            {breaker.state.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{breaker.failureCount}/{breaker.threshold}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(breaker.nextRetryTime).toLocaleTimeString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Active Incidents Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Active Incidents Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiMetrics.incidents.map((incident, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{incident.incidentId}</span>
                      <Badge variant="outline">
                        {incident.events.length} events
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {incident.events.slice(-3).map((event, eventIndex) => (
                        <div key={eventIndex} className="flex items-center gap-2 text-sm">
                          <div className={`w-2 h-2 rounded-full ${
                            event.type === 'detected' ? 'bg-yellow-500' :
                            event.type === 'resolved' ? 'bg-green-500' :
                            'bg-blue-500'
                          }`} />
                          <span className="text-muted-foreground">
                            {formatTimestamp(event.timestamp)}
                          </span>
                          <span>{event.description}</span>
                          {event.automated && (
                            <Badge variant="outline" className="text-xs">AUTO</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* SLO/SLA Tracking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                SLO/SLA Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {aiMetrics.sloMetrics.map((slo, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{slo.sloName}</span>
                      {getStatusIcon(slo.status, true)}
                    </div>
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Current: {slo.current}%</span>
                        <span>Target: {slo.target}%</span>
                      </div>
                      <Progress value={slo.current} className="h-2" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {slo.incidents} incidents in {slo.timeWindow}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                AI System Controls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">AI Analysis</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    RUNNING
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Self-Heal</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    ACTIVE
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    {isSilentMode ? <BellOff className="h-4 w-4 text-gray-500" /> : <Bell className="h-4 w-4 text-blue-500" />}
                    <span className="text-sm font-medium">Alerts</span>
                  </div>
                  <Badge variant={isSilentMode ? "secondary" : "outline"} className="text-xs">
                    {isSilentMode ? 'SILENT' : 'ACTIVE'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    {isChaosMode ? <Flame className="h-4 w-4 text-red-500" /> : <TestTube className="h-4 w-4 text-gray-500" />}
                    <span className="text-sm font-medium">Chaos Test</span>
                  </div>
                  <Badge variant={isChaosMode ? "destructive" : "outline"} className="text-xs">
                    {isChaosMode ? 'ENABLED' : 'DISABLED'}
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

export default AIHealthSystemPage;
