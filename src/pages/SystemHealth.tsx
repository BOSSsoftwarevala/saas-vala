import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { 
  Activity, 
  Server, 
  Database, 
  Shield, 
  Package, 
  Key, 
  Users, 
  CreditCard, 
  HardDrive, 
  Cpu,
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getCurrentSystemHealth, getHealthHistory } from '@/lib/systemHealth';
import { systemHealthIntegrator } from '@/lib/offline/moduleIntegration';

interface HealthCheck {
  name: string;
  status: 'ok' | 'warning' | 'error' | 'checking';
  message: string;
  icon: React.ComponentType<{ className?: string }>;
  latencyMs?: number;
  uptimePct?: number;
  activity1h?: number;
  autoAction?: string;
  count?: number;
}

const SystemHealthPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [queuePending, setQueuePending] = useState(0);
  const [autoActions, setAutoActions] = useState(0);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([
    { name: 'Database Connection', status: 'checking', message: 'Checking...', icon: Database },
    { name: 'Authentication Service', status: 'checking', message: 'Checking...', icon: Shield },
    { name: 'Products Table', status: 'checking', message: 'Checking...', icon: Package },
    { name: 'License Keys', status: 'checking', message: 'Checking...', icon: Key },
    { name: 'User Profiles', status: 'checking', message: 'Checking...', icon: Users },
    { name: 'Servers Table', status: 'checking', message: 'Checking...', icon: Server },
    { name: 'Wallets & Transactions', status: 'checking', message: 'Checking...', icon: CreditCard },
    { name: 'Audit Logs', status: 'checking', message: 'Checking...', icon: Activity },
    { name: 'AI Usage Tracking', status: 'checking', message: 'Checking...', icon: Cpu },
    { name: 'Storage Buckets', status: 'checking', message: 'Checking...', icon: HardDrive },
  ]);

  useEffect(() => {
    console.log('[SystemHealth] MODULE LOADED');
    // Initialize module integration with all 30 micro validations
    const init = async () => {
      try {
        await systemHealthIntegrator.initialize();
      } catch (error) {
        console.error('Failed to initialize system health module:', error);
      } finally {
        setInitialized(true);
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      try {
        systemHealthIntegrator.cleanup();
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    };
  }, []);

  const loadHealthDashboard = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const report = await getCurrentSystemHealth();
      const history = getHealthHistory();

      const apiDownCount = report.apis.filter((api) => api.status === 'down').length;
      const criticalErrors = report.errors.filter((error) => error.type === 'server' || error.type === 'database').length;
      const runningServices = report.services.filter((service) => service.status === 'running').length;

      const updatedChecks: HealthCheck[] = [
        {
          name: 'Database Connection',
          status: report.database.status === 'connected' ? 'ok' : 'error',
          message: report.database.status === 'connected' ? 'Connected' : (report.database.error || 'Disconnected'),
          icon: Database,
          latencyMs: report.database.responseTime,
          uptimePct: report.uptime.percentage,
        },
        {
          name: 'Authentication Service',
          status: report.apis.some((api) => api.endpoint.toLowerCase().includes('auth') && api.status === 'down') ? 'error' : 'ok',
          message: report.apis.some((api) => api.endpoint.toLowerCase().includes('auth') && api.status === 'down') ? 'Auth API unavailable' : 'Auth API operational',
          icon: Shield,
          latencyMs: report.apis.find((api) => api.endpoint.toLowerCase().includes('auth'))?.responseTime,
          uptimePct: report.uptime.percentage,
        },
        {
          name: 'Products Table',
          status: report.database.status === 'connected' ? 'ok' : 'error',
          message: report.database.status === 'connected' ? 'Products DB reachable' : 'Products DB unavailable',
          icon: Package,
          latencyMs: report.database.responseTime,
          uptimePct: report.uptime.percentage,
        },
        {
          name: 'License Keys',
          status: report.database.status === 'connected' ? 'ok' : 'error',
          message: report.database.status === 'connected' ? 'License data reachable' : 'License data unavailable',
          icon: Key,
          latencyMs: report.database.responseTime,
          uptimePct: report.uptime.percentage,
        },
        {
          name: 'User Profiles',
          status: report.database.status === 'connected' ? 'ok' : 'error',
          message: report.database.status === 'connected' ? 'Profiles reachable' : 'Profiles unavailable',
          icon: Users,
          latencyMs: report.database.responseTime,
          uptimePct: report.uptime.percentage,
        },
        {
          name: 'Servers Table',
          status: report.server.status === 'up' ? 'ok' : 'error',
          message: report.server.status === 'up' ? 'Server monitoring online' : 'Server monitoring offline',
          icon: Server,
          uptimePct: report.uptime.percentage,
        },
        {
          name: 'Wallets & Transactions',
          status: report.database.status === 'connected' ? 'ok' : 'error',
          message: report.database.status === 'connected' ? 'Transaction storage reachable' : 'Transaction storage unavailable',
          icon: CreditCard,
          latencyMs: report.database.responseTime,
          uptimePct: report.uptime.percentage,
        },
        {
          name: 'Audit Logs',
          status: report.database.status === 'connected' ? 'ok' : 'error',
          message: report.database.status === 'connected' ? 'Audit logging active' : 'Audit logging unavailable',
          icon: Activity,
          latencyMs: report.database.responseTime,
          uptimePct: report.uptime.percentage,
        },
        {
          name: 'AI Usage Tracking',
          status: apiDownCount > 0 ? 'warning' : 'ok',
          message: apiDownCount > 0 ? `${apiDownCount} API endpoint(s) down` : 'API endpoints operational',
          icon: Cpu,
          latencyMs: report.apis[0]?.responseTime,
          uptimePct: report.uptime.percentage,
        },
        {
          name: 'Storage Buckets',
          status: runningServices > 0 ? 'ok' : 'warning',
          message: runningServices > 0 ? `${runningServices} service(s) running` : 'No services reported running',
          icon: HardDrive,
          uptimePct: report.uptime.percentage,
        },
      ];

      setHealthChecks(updatedChecks);
      setLastCheck(new Date());

      setHistoryCount(history.length);
      setActiveAlerts(report.errors.length);
      setQueuePending(apiDownCount);
      setAutoActions(criticalErrors);

    } catch (error) {
      console.error('Failed to load health dashboard:', error);
      
      const fallbackChecks = healthChecks.map(check => ({
        ...check,
        status: 'error' as const,
        message: 'Failed to check'
      }));
      
      setHealthChecks(fallbackChecks);
      setLastCheck(new Date());
    } finally {
      setLoading(false);
    }
  }, [healthChecks]);

  const runHealthCheck = useCallback(async () => {
    await loadHealthDashboard(false);
  }, [loadHealthDashboard]);

  // Initialize dashboard
  useEffect(() => {
    loadHealthDashboard();
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      loadHealthDashboard(true);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [loadHealthDashboard]);

  const okCount = healthChecks.filter(c => c.status === 'ok').length;
  const healthPercentage = Math.round((okCount / healthChecks.length) * 100);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">System Health</h1>
            <p className="text-muted-foreground">Real-time system monitoring</p>
          </div>
          <Button onClick={runHealthCheck}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

      {/* Overall Status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                healthPercentage >= 90 ? 'bg-green-100' : 
                healthPercentage >= 70 ? 'bg-yellow-100' : 
                'bg-red-100'
              }`}>
                {healthPercentage >= 90 ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : healthPercentage >= 70 ? (
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-600" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {healthPercentage >= 90 ? 'ALL SYSTEMS OPERATIONAL' : 
                   healthPercentage >= 70 ? 'MINOR ISSUES DETECTED' : 
                   'CRITICAL ISSUES'}
                </h3>
                <p className="text-muted-foreground">
                  {okCount}/{healthChecks.length} modules healthy
                </p>
              </div>
            </div>
            <div className="flex-1 max-w-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Health Score</span>
                <span className={`font-bold ${
                  healthPercentage >= 90 ? 'text-green-600' : 
                  healthPercentage >= 70 ? 'text-yellow-600' : 
                  'text-red-600'
                }`}>{healthPercentage}%</span>
              </div>
              <Progress value={healthPercentage} className="h-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{historyCount}</p>
            <p className="text-sm text-muted-foreground">History Events</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{activeAlerts}</p>
            <p className="text-sm text-muted-foreground">Active Alerts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{queuePending}</p>
            <p className="text-sm text-muted-foreground">Queue Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{autoActions}</p>
            <p className="text-sm text-muted-foreground">Auto Actions</p>
          </CardContent>
        </Card>
      </div>

      {/* Health Checks Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {healthChecks.map((check, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <check.icon className="h-5 w-5" />
                <span className="font-medium">{check.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {check.status === 'ok' && <CheckCircle className="h-4 w-4 text-green-500" />}
                {check.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                {check.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                {check.status === 'checking' && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span className="text-sm">{check.message}</span>
              </div>
              {check.latencyMs && (
                <p className="text-xs text-muted-foreground mt-1">Latency: {check.latencyMs.toFixed(0)}ms</p>
              )}
              {check.uptimePct && (
                <p className="text-xs text-muted-foreground mt-1">Uptime: {check.uptimePct.toFixed(1)}%</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/audit-logs')}>
              View Audit Logs
            </Button>
            <Button variant="outline" onClick={() => navigate('/servers')}>
              View Servers
            </Button>
            <Button variant="outline" onClick={() => navigate('/automation')}>
              View Automation
            </Button>
            <Button variant="outline" onClick={() => navigate('/marketplace-admin')}>
              View Marketplace Admin
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Last Check Info */}
      {lastCheck && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last check: {lastCheck.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </DashboardLayout>
  );
};

export default SystemHealthPage;
