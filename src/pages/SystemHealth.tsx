import React, { useState, useEffect, useCallback } from 'react';
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
  TestTube
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { 
  systemHealthMonitor, 
  type SystemHealthReport, 
  type HealthStatus,
  type ServerHealth,
  type APIHealth,
  type DatabaseHealth,
  type ServiceHealth,
  startHealthMonitoring,
  stopHealthMonitoring,
  getCurrentSystemHealth,
  getHealthHistory,
  testDowntimeDetection
} from '@/lib/systemHealth';
  RefreshCw,
  Server,
  Database,
  Shield,
  Key,
  Users,
  Package,
  CreditCard,
  Activity,
  Cpu,
  HardDrive,
  Loader2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { systemApi } from '@/lib/api';
import { toast } from 'sonner';

interface HealthCheck {
  name: string;
  status: 'ok' | 'warning' | 'error' | 'checking';
  message: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  latencyMs?: number;
  uptimePct?: number;
  activity1h?: number;
  autoAction?: string | null;
}

export default function SystemHealth() {
  const navigate = useNavigate();
  const iconByModule = useMemo<Record<string, React.ComponentType<{ className?: string }>>>(() => ({
    database: Database,
    auth: Shield,
    users: Users,
    products: Package,
    license_keys: Key,
    servers: Server,
    wallet: CreditCard,
    transactions: CreditCard,
    audit_logs: Activity,
    logs: Activity,
    ai_usage: Cpu,
    storage: HardDrive,
    queue: RefreshCw,
    background_jobs: RefreshCw,
    api_services: Server,
    api_gateway: Server,
  }), []);
  const [loading, setLoading] = useState(true);
  const [historyCount, setHistoryCount] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [queuePending, setQueuePending] = useState(0);
  const [autoActions, setAutoActions] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'health' | 'alert' | 'audit'>('all');
  const [timelineEvents, setTimelineEvents] = useState<Array<{
    id: string;
    source: 'health' | 'alert' | 'audit';
    severity: 'info' | 'warning' | 'critical';
    module: string;
    message: string;
    timestamp: string;
  }>>([]);
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

  const normalizeSeverity = (value: unknown): 'info' | 'warning' | 'critical' => {
    const v = String(value || '').toLowerCase();
    if (v === 'warn' || v === 'warning') return 'warning';
    if (v === 'critical' || v === 'error' || v === 'fail' || v === 'failed') return 'critical';
    return 'info';
  };

  const loadHealthDashboard = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const res = await systemApi.healthDashboard();
      const checks = (res?.checks || []).map((c: any) => ({
        name: String(c.module || 'module').replace(/_/g, ' ').toUpperCase(),
        status: c.status === 'healthy' ? 'ok' : c.status === 'warning' ? 'warning' : 'error',
        message: c.message || '-',
        icon: iconByModule[c.module] || Activity,
        count: Number(c.records || 0),
        latencyMs: Number(c.latency_ms || 0),
        uptimePct: Number(c.uptime_pct || 0),
        activity1h: Number(c.activity_1h || 0),
        autoAction: c.auto_action || null,
      })) as HealthCheck[];

      setHealthChecks(checks);
      setLastCheck(res?.checked_at ? new Date(res.checked_at) : new Date());
      setHistoryCount((res?.history || []).length);
      setActiveAlerts((res?.alerts || []).filter((a: any) => !a.acknowledged).length);
      setQueuePending(Number(res?.queue_stats?.queued || 0));
      setAutoActions(Number(res?.auto_actions || 0));

      let auditAlertRes: any = { data: [] };
      try {
        auditAlertRes = await systemApi.auditAlerts({ unresolved: true });
      } catch {
        // audit_anomaly_alerts may not exist yet; degrade gracefully
      }

      try {
        const historyRows = Array.isArray(res?.history) ? res.history : [];
        const alertRows = Array.isArray(res?.alerts) ? res.alerts : [];
        const auditRows = Array.isArray(auditAlertRes?.data) ? auditAlertRes.data : [];

        const historyEvents = historyRows.slice(0, 120).map((h: any) => ({
          id: `h-${h.id}`,
          source: 'health' as const,
          severity: normalizeSeverity(h.status),
          module: String(h.service_name || 'module'),
          message: `${h.probe_type || 'probe'} ${h.status || 'pass'}${h.latency_ms ? ` • ${h.latency_ms}ms` : ''}`,
          timestamp: String(h.created_at || new Date().toISOString()),
        }));

        const alertEvents = alertRows.slice(0, 120).map((a: any) => ({
          id: `a-${a.id}`,
          source: 'alert' as const,
          severity: normalizeSeverity(a.severity),
          module: String(a.source_module || 'system'),
          message: String(a.alert_type || 'alert'),
          timestamp: String(a.created_at || new Date().toISOString()),
        }));

        const auditEvents = auditRows.slice(0, 120).map((a: any) => ({
          id: `au-${a.id}`,
          source: 'audit' as const,
          severity: normalizeSeverity(a.severity),
          module: String(a.alert_type || 'audit'),
          message: String(a.alert_message || 'audit anomaly'),
          timestamp: String(a.created_at || new Date().toISOString()),
        }));

        const severityPriority: Record<'info' | 'warning' | 'critical', number> = {
          critical: 3,
          warning: 2,
          info: 1,
        };

        const sourcePriority: Record<'health' | 'alert' | 'audit', number> = {
          alert: 3,
          audit: 2,
          health: 1,
        };

        const merged = [...historyEvents, ...alertEvents, ...auditEvents]
          .sort((x, y) => {
            const severityDelta = severityPriority[y.severity] - severityPriority[x.severity];
            if (severityDelta !== 0) return severityDelta;

            const sourceDelta = sourcePriority[y.source] - sourcePriority[x.source];
            if (sourceDelta !== 0) return sourceDelta;

            return new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime();
          })
          .slice(0, 250);

        setTimelineEvents(merged);
      } catch (timelineError) {
        console.warn('Failed to build timeline events', timelineError);
        setTimelineEvents([]);
      }
    } catch (error: any) {
      if (!silent) {
        toast.error(error?.message || 'Failed to load system health dashboard');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [iconByModule]);

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const res = await systemApi.runHealthCheck({ auto_fix: true, persist: true, snapshot: true });
      toast.success(`Health check completed (${res?.health_score || 0}%)`);
      await loadHealthDashboard();
    } catch (error: any) {
      toast.error(error?.message || 'Health check failed');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealthDashboard();
  }, [loadHealthDashboard]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadHealthDashboard(true);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [loadHealthDashboard]);

  const overallStatus = healthChecks.every(c => c.status === 'ok') 
    ? 'ok' 
    : healthChecks.some(c => c.status === 'error') 
    ? 'error' 
    : 'warning';

  const okCount = healthChecks.filter(c => c.status === 'ok').length;
  const healthPercentage = Math.round((okCount / healthChecks.length) * 100);

  const statusConfig = {
    ok: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/20' },
    error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
    checking: { icon: Loader2, color: 'text-muted-foreground', bg: 'bg-muted' },
  };

  const filteredTimeline = timelineEvents.filter((event) => {
    const severityMatch = severityFilter === 'all' || event.severity === severityFilter;
    const sourceMatch = sourceFilter === 'all' || event.source === sourceFilter;
    return severityMatch && sourceMatch;
  });

  const severityStyles: Record<'info' | 'warning' | 'critical', string> = {
    info: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              System Health
            </h2>
            <p className="text-muted-foreground">
              Real-time monitoring of all core system modules
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastCheck && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Last check: {lastCheck.toLocaleTimeString()}
              </div>
            )}
            <Button onClick={runHealthCheck} disabled={loading} className="gap-2">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              {loading ? 'Checking...' : 'Run Check'}
            </Button>
          </div>
        </div>

        {/* Overall Status */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={cn('w-16 h-16 rounded-xl flex items-center justify-center', statusConfig[overallStatus].bg)}>
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  React.createElement(statusConfig[overallStatus].icon, {
                    className: cn('h-8 w-8', statusConfig[overallStatus].color)
                  })
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground uppercase">
                  {loading ? 'CHECKING...' : overallStatus === 'ok' ? 'ALL SYSTEMS OPERATIONAL' : overallStatus === 'warning' ? 'MINOR ISSUES DETECTED' : 'CRITICAL ISSUES'}
                </h3>
                <p className="text-muted-foreground">
                  {okCount}/{healthChecks.length} modules healthy
                </p>
              </div>
            </div>
            <div className="flex-1 max-w-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Health Score</span>
                <span className={cn('font-bold', statusConfig[overallStatus].color)}>{healthPercentage}%</span>
              </div>
              <Progress value={healthPercentage} className="h-3" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{historyCount}</p>
            <p className="text-sm text-muted-foreground">History Events</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{activeAlerts}</p>
            <p className="text-sm text-muted-foreground">Active Alerts</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-primary">{queuePending}</p>
            <p className="text-sm text-muted-foreground">Queue Pending</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{autoActions}</p>
            <p className="text-sm text-muted-foreground">Auto Actions</p>
          </div>
        </div>

        {/* Health Checks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {healthChecks.map((check) => {
            const StatusIcon = statusConfig[check.status].icon;
            return (
              <div
                key={check.name}
                className={cn(
                  'glass-card rounded-xl p-4 transition-all',
                  check.status === 'error' && 'border-red-500/30',
                  check.status === 'warning' && 'border-amber-500/30'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', statusConfig[check.status].bg)}>
                    <check.icon className={cn('h-5 w-5', statusConfig[check.status].color)} />
                  </div>
                  <StatusIcon className={cn(
                    'h-5 w-5',
                    statusConfig[check.status].color,
                    check.status === 'checking' && 'animate-spin'
                  )} />
                </div>
                <h4 className="font-semibold text-foreground mb-1">{check.name}</h4>
                <p className="text-sm text-muted-foreground">{check.message}</p>
                {check.latencyMs !== undefined && (
                  <p className="text-xs text-muted-foreground mt-1">Latency: {check.latencyMs}ms</p>
                )}
                {check.uptimePct !== undefined && (
                  <p className="text-xs text-muted-foreground mt-1">Uptime: {check.uptimePct.toFixed(2)}%</p>
                )}
                {check.activity1h !== undefined && (
                  <p className="text-xs text-muted-foreground mt-1">Activity (1h): {check.activity1h}</p>
                )}
                {check.autoAction && (
                  <Badge variant="secondary" className="mt-2 text-xs">Auto: {check.autoAction}</Badge>
                )}
                {check.count !== undefined && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    {check.count} records
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate('/audit-logs')}>
              View Audit Logs
            </Button>
            <Button variant="outline" onClick={() => navigate('/settings')}>
              System Settings
            </Button>
            <Button variant="outline" onClick={() => runHealthCheck()}>
              Refresh All Checks
            </Button>
          </div>
        </div>

        {/* Timeline Panel */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <h3 className="font-semibold text-foreground">Health Timeline + Audit Integration</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={severityFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setSeverityFilter('all')}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={severityFilter === 'info' ? 'default' : 'outline'}
                onClick={() => setSeverityFilter('info')}
              >
                Info
              </Button>
              <Button
                size="sm"
                variant={severityFilter === 'warning' ? 'default' : 'outline'}
                onClick={() => setSeverityFilter('warning')}
              >
                Warning
              </Button>
              <Button
                size="sm"
                variant={severityFilter === 'critical' ? 'default' : 'outline'}
                onClick={() => setSeverityFilter('critical')}
              >
                Critical
              </Button>
              <Button
                size="sm"
                variant={sourceFilter === 'health' ? 'default' : 'outline'}
                onClick={() => setSourceFilter('health')}
              >
                Health
              </Button>
              <Button
                size="sm"
                variant={sourceFilter === 'alert' ? 'default' : 'outline'}
                onClick={() => setSourceFilter('alert')}
              >
                Alerts
              </Button>
              <Button
                size="sm"
                variant={sourceFilter === 'audit' ? 'default' : 'outline'}
                onClick={() => setSourceFilter('audit')}
              >
                Audit
              </Button>
              <Button
                size="sm"
                variant={sourceFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setSourceFilter('all')}
              >
                Sources
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/audit-logs')}>
                Open Audit Logs
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filteredTimeline.length === 0 && (
              <p className="text-sm text-muted-foreground">No timeline events for selected filters.</p>
            )}
            {filteredTimeline.map((event) => (
              <div key={event.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={severityStyles[event.severity]}>{event.severity.toUpperCase()}</Badge>
                    <Badge variant="secondary">{event.source}</Badge>
                    <span className="text-xs text-muted-foreground">{event.module}</span>
                  </div>
                  <p className="text-sm text-foreground">{event.message}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(event.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
