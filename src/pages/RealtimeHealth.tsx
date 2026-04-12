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
  Network
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { 
  initializeRealtimeHealth,
  subscribeToHealthUpdates,
  stopRealtimeHealth,
  updateHealthThresholds,
  testRealtimeDowntime,
  type RealtimeHealthData,
  type HealthThresholds
} from '@/lib/realtimeHealth';

const RealtimeHealthPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [healthData, setHealthData] = useState<RealtimeHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [thresholds, setThresholds] = useState<HealthThresholds>({
    cpu: 80,
    ram: 85,
    disk: 90,
    responseTime: 2000,
    queryTime: 1000
  });
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastUpdateRef = useRef<string>('');

  // Check user role for access control
  const userRole = user?.role || 'user';
  const hasAccess = userRole === 'admin' || userRole === 'super_admin';

  // Initialize real-time monitoring
  useEffect(() => {
    if (!hasAccess) {
      toast.error('Access denied. Admin privileges required.');
      return;
    }

    const initializeMonitoring = async () => {
      try {
        setConnectionStatus('connecting');
        setLoading(true);

        // Initialize real-time health monitoring
        await initializeRealtimeHealth();

        // Subscribe to health updates
        const unsubscribe = subscribeToHealthUpdates((data: RealtimeHealthData) => {
          setHealthData(data);
          lastUpdateRef.current = data.timestamp;
          setConnectionStatus('connected');
          setLoading(false);
        });

        unsubscribeRef.current = unsubscribe;
        setIsRealtimeActive(true);

        toast.success('Real-time health monitoring active');

      } catch (error) {
        console.error('Failed to initialize real-time monitoring:', error);
        setConnectionStatus('disconnected');
        setLoading(false);
        toast.error('Failed to start real-time monitoring');
      }
    };

    initializeMonitoring();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      stopRealtimeHealth();
      setIsRealtimeActive(false);
    };
  }, [hasAccess]);

  // Get status icon with real-time indication
  const getStatusIcon = (status: string, isLive: boolean = false) => {
    const IconComponent = () => {
      switch (status) {
        case 'healthy':
        case 'up':
        case 'connected':
        case 'running':
          return <CheckCircle className={`h-5 w-5 text-green-500 ${isLive ? 'animate-pulse' : ''}`} />;
        case 'warning':
          return <AlertTriangle className={`h-5 w-5 text-yellow-500 ${isLive ? 'animate-pulse' : ''}`} />;
        case 'critical':
        case 'down':
        case 'disconnected':
        case 'stopped':
          return <XCircle className={`h-5 w-5 text-red-500 ${isLive ? 'animate-pulse' : ''}`} />;
        default:
          return <AlertCircle className={`h-5 w-5 text-gray-500`} />;
      }
    };

    return <IconComponent />;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
      case 'connected':
      case 'running':
      case 'fast':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
      case 'slow':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical':
      case 'down':
      case 'disconnected':
      case 'stopped':
      case 'fail':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get health score color
  const getHealthScoreColor = (score: string) => {
    switch (score) {
      case 'fast':
        return 'bg-green-100 text-green-800';
      case 'slow':
        return 'bg-yellow-100 text-yellow-800';
      case 'fail':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Format uptime
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Test downtime detection
  const handleTestDowntime = async () => {
    try {
      await testRealtimeDowntime();
      toast.success('Real-time downtime test completed');
    } catch (error) {
      toast.error('Failed to test downtime detection');
    }
  };

  // Update thresholds
  const handleUpdateThresholds = (newThresholds: Partial<HealthThresholds>) => {
    const updated = { ...thresholds, ...newThresholds };
    setThresholds(updated);
    updateHealthThresholds(updated);
    toast.success('Thresholds updated');
  };

  // Navigate to audit logs
  const handleViewAuditLogs = (incident: any) => {
    navigate('/audit-logs', { state: { filterIncident: incident } });
  };

  if (!hasAccess) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            You need admin privileges to access real-time system health monitoring.
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
            <Radio className="h-8 w-8" />
            Real-Time System Health
          </h1>
          <p className="text-muted-foreground">
            Live system monitoring with real-time updates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <Radio className="h-4 w-4 text-green-500 animate-pulse" />
            ) : connectionStatus === 'connecting' ? (
              <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
            ) : (
              <RadioOff className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm text-muted-foreground capitalize">
              {connectionStatus}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={handleTestDowntime}
          >
            <TestTube className="h-4 w-4 mr-2" />
            Test Real-time
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (isRealtimeActive) {
                stopRealtimeHealth();
                setIsRealtimeActive(false);
                toast.info('Real-time monitoring stopped');
              } else {
                initializeRealtimeHealth();
                setIsRealtimeActive(true);
                toast.info('Real-time monitoring started');
              }
            }}
          >
            {isRealtimeActive ? (
              <Square className="h-4 w-4 mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {isRealtimeActive ? 'Stop' : 'Start'} Real-time
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      ) : healthData ? (
        <>
          {/* Live Status Bar */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-green-500 animate-pulse" />
                Live System Status
                <Badge variant="outline" className="text-xs">
                  REAL-TIME
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(healthData.server.status === 'up' ? 'healthy' : 'critical', true)}
                    <span className="font-medium">
                      Server: {healthData.server.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(healthData.database.status === 'connected' ? 'healthy' : 'critical', true)}
                    <span className="font-medium">
                      Database: {healthData.database.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">
                      APIs: {healthData.apis.filter(api => api.status === 'up').length}/{healthData.apis.length}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">
                    Last update: {formatTimestamp(healthData.timestamp)}
                  </div>
                  <div className="text-xs text-green-600">
                    Auto-updating every 15 seconds
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Metrics Dashboard */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthData.server.cpu.toFixed(1)}%</div>
                <Progress value={healthData.server.cpu} className="mt-2 h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {healthData.server.cpu > thresholds.cpu ? '⚠️ High' : '✅ Normal'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">RAM Usage</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthData.server.ram.toFixed(1)}%</div>
                <Progress value={healthData.server.ram} className="mt-2 h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {healthData.server.ram > thresholds.ram ? '⚠️ High' : '✅ Normal'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthData.server.disk.toFixed(1)}%</div>
                <Progress value={healthData.server.disk} className="mt-2 h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {healthData.server.disk > thresholds.disk ? '⚠️ High' : '✅ Normal'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Network</CardTitle>
                <Network className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthData.server.network.toFixed(1)}%</div>
                <Progress value={healthData.server.network} className="mt-2 h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Active traffic
                </p>
              </CardContent>
            </Card>
          </div>

          {/* API Health Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                API Health Scores (Live)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Response Time</TableHead>
                      <TableHead>Health Score</TableHead>
                      <TableHead>Last Check</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthData.apis.map((api, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">{api.endpoint}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(api.status, true)}
                            <Badge className={getStatusColor(api.status)}>
                              {api.status.toUpperCase()}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={api.responseTime > thresholds.responseTime ? 'text-red-600 font-medium' : ''}>
                              {api.responseTime}ms
                            </span>
                            {api.responseTime > thresholds.responseTime && (
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getHealthScoreColor(api.healthScore)}>
                            {api.healthScore.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatTimestamp(healthData.timestamp)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Database Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Performance (Live)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(healthData.database.status, true)}
                    <span className="font-medium">Connection</span>
                  </div>
                  <Badge className={getStatusColor(healthData.database.status)}>
                    {healthData.database.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <span className="font-medium">Response Time</span>
                  <span className={healthData.database.responseTime > thresholds.responseTime ? 'text-red-600 font-medium' : ''}>
                    {healthData.database.responseTime}ms
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <span className="font-medium">Query Time</span>
                  <span className={healthData.database.queryTime > thresholds.queryTime ? 'text-red-600 font-medium' : ''}>
                    {healthData.database.queryTime}ms
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Services Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Services Status (Live)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                {healthData.services.map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(service.status, true)}
                      <span className="font-medium capitalize">{service.name}</span>
                    </div>
                    <Badge className={getStatusColor(service.status)}>
                      {service.status.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* System Summary Panel */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {healthData.uptime.percentage.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Session: {formatUptime(healthData.uptime.currentSession)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Incidents</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {healthData.incidents.filter(i => !i.resolved).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active incidents
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Security</CardTitle>
                <Shield className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {healthData.security.abnormalLogins}
                </div>
                <p className="text-xs text-muted-foreground">
                  Abnormal logins
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Health Score</CardTitle>
                <BarChart3 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {Math.round((healthData.apis.filter(api => api.healthScore === 'fast').length / healthData.apis.length) * 100)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  API health score
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Active Incidents */}
          {healthData.incidents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Active Incidents (Real-time)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {healthData.incidents.map((incident, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(incident.severity, true)}
                        <div>
                          <p className="font-medium">{incident.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {incident.type.toUpperCase()} • {formatTimestamp(incident.timestamp)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewAuditLogs(incident)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedIncident(incident)}>
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Incident Details</DialogTitle>
                              <DialogDescription>
                                Real-time incident information
                              </DialogDescription>
                            </DialogHeader>
                            {selectedIncident && (
                              <div className="grid gap-4 py-4">
                                <div>
                                  <label className="text-sm font-medium">Type</label>
                                  <p className="text-sm text-muted-foreground capitalize">{selectedIncident.type}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Severity</label>
                                  <Badge className={getStatusColor(selectedIncident.severity)}>
                                    {selectedIncident.severity.toUpperCase()}
                                  </Badge>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Message</label>
                                  <p className="text-sm">{selectedIncident.message}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Timestamp</label>
                                  <p className="text-sm text-muted-foreground">
                                    {formatTimestamp(selectedIncident.timestamp)}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Status</label>
                                  <Badge variant={selectedIncident.resolved ? 'default' : 'destructive'}>
                                    {selectedIncident.resolved ? 'Resolved' : 'Active'}
                                  </Badge>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <RadioOff className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Real-time Connection Failed</h3>
          <p className="text-muted-foreground">
            Unable to establish real-time connection. Please check your network and try again.
          </p>
        </div>
      )}
    </div>
  );
};

export default RealtimeHealthPage;
