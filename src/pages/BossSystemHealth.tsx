// Boss System Health Module - System monitoring and health checks
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity,
  Cpu,
  HardDrive,
  Memory,
  Globe,
  Database,
  Shield,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Zap,
  Clock,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface HealthMetric {
  id: string;
  name: string;
  category: 'system' | 'database' | 'api' | 'external';
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  value: number;
  unit: string;
  threshold_warning: number;
  threshold_critical: number;
  last_checked_at: string;
}

interface SystemAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  resolved: boolean;
  created_at: string;
}

export default function BossSystemHealth() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystemHealth();
  }, []);

  const loadSystemHealth = async () => {
    setLoading(true);
    try {
      // Mock data for now - in production, this would come from actual health check endpoints
      const mockMetrics: HealthMetric[] = [
        {
          id: '1',
          name: 'CPU Usage',
          category: 'system',
          status: 'healthy',
          value: 45,
          unit: '%',
          threshold_warning: 70,
          threshold_critical: 90,
          last_checked_at: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Memory Usage',
          category: 'system',
          status: 'warning',
          value: 72,
          unit: '%',
          threshold_warning: 70,
          threshold_critical: 85,
          last_checked_at: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'Disk Usage',
          category: 'system',
          status: 'healthy',
          value: 58,
          unit: '%',
          threshold_warning: 80,
          threshold_critical: 90,
          last_checked_at: new Date().toISOString(),
        },
        {
          id: '4',
          name: 'Database Connections',
          category: 'database',
          status: 'healthy',
          value: 23,
          unit: 'active',
          threshold_warning: 80,
          threshold_critical: 95,
          last_checked_at: new Date().toISOString(),
        },
        {
          id: '5',
          name: 'API Response Time',
          category: 'api',
          status: 'healthy',
          value: 120,
          unit: 'ms',
          threshold_warning: 500,
          threshold_critical: 1000,
          last_checked_at: new Date().toISOString(),
        },
        {
          id: '6',
          name: 'CDN Latency',
          category: 'external',
          status: 'healthy',
          value: 45,
          unit: 'ms',
          threshold_warning: 200,
          threshold_critical: 500,
          last_checked_at: new Date().toISOString(),
        },
      ];

      const mockAlerts: SystemAlert[] = [
        {
          id: '1',
          severity: 'warning',
          title: 'High Memory Usage',
          description: 'Memory usage has exceeded 70%. Consider scaling or optimizing.',
          resolved: false,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '2',
          severity: 'info',
          title: 'Scheduled Maintenance',
          description: 'System maintenance scheduled for tonight at 2 AM UTC.',
          resolved: false,
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
      ];

      setMetrics(mockMetrics);
      setAlerts(mockAlerts);
    } catch (error) {
      console.error('Error loading system health:', error);
      toast.error('Failed to load system health');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500 bg-green-500/10';
      case 'warning':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'critical':
        return 'text-red-500 bg-red-500/10';
      case 'unknown':
        return 'text-slate-500 bg-slate-500/10';
      default:
        return 'text-blue-500 bg-blue-500/10';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'warning':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'info':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      default:
        return 'text-slate-500 bg-slate-500/10 border-slate-500/30';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'system':
        return <Cpu className="w-5 h-5" />;
      case 'database':
        return <Database className="w-5 h-5" />;
      case 'api':
        return <Zap className="w-5 h-5" />;
      case 'external':
        return <Globe className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  const healthyMetrics = metrics.filter(m => m.status === 'healthy').length;
  const warningMetrics = metrics.filter(m => m.status === 'warning').length;
  const criticalMetrics = metrics.filter(m => m.status === 'critical').length;
  const activeAlerts = alerts.filter(a => !a.resolved).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">System Health</h1>
          <p className="text-slate-400">Monitor system performance and health metrics</p>
        </div>
        <button
          onClick={loadSystemHealth}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="w-5 h-5" />
          Refresh
        </button>
      </div>

      {/* Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-xs text-slate-400">Healthy</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{healthyMetrics}</h3>
          <p className="text-sm text-slate-400">Healthy Metrics</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <span className="text-xs text-slate-400">Warning</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{warningMetrics}</h3>
          <p className="text-sm text-slate-400">Warning Metrics</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Shield className="w-5 h-5 text-red-400" />
            <span className="text-xs text-slate-400">Critical</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{criticalMetrics}</h3>
          <p className="text-sm text-slate-400">Critical Metrics</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-slate-400">Active</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{activeAlerts}</h3>
          <p className="text-sm text-slate-400">Active Alerts</p>
        </div>
      </div>

      {/* System Metrics */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 mb-8">
        <h2 className="text-xl font-semibold text-white mb-6">System Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-700/50">
                    {getCategoryIcon(metric.category)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{metric.name}</h3>
                    <span className="text-xs text-slate-500 capitalize">{metric.category}</span>
                  </div>
                </div>
                <span className={cn('px-2 py-0.5 rounded-full text-xs', getStatusColor(metric.status))}>
                  {metric.status}
                </span>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold text-white">
                    {metric.value}
                    <span className="text-sm text-slate-400 ml-1">{metric.unit}</span>
                  </span>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(metric.last_checked_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-700/50 rounded-full h-2">
                  <div
                    className={cn(
                      'h-2 rounded-full transition-all duration-300',
                      metric.status === 'healthy' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                      metric.status === 'warning' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                      metric.status === 'critical' ? 'bg-gradient-to-r from-red-500 to-rose-500' :
                      'bg-slate-500'
                    )}
                    style={{ width: `${Math.min(metric.value, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Warning: {metric.threshold_warning}{metric.unit}</span>
                <span>Critical: {metric.threshold_critical}{metric.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Alerts */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
        <h2 className="text-xl font-semibold text-white mb-6">Active Alerts</h2>

        {alerts.filter(a => !a.resolved).length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No active alerts</h3>
            <p className="text-slate-400">System is running smoothly</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.filter(a => !a.resolved).map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'bg-slate-800/30 backdrop-blur-sm rounded-xl p-5 border',
                  getSeverityColor(alert.severity)
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn('p-2 rounded-lg', getSeverityColor(alert.severity))}>
                      {alert.severity === 'critical' ? (
                        <Shield className="w-5 h-5" />
                      ) : alert.severity === 'warning' ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : (
                        <Activity className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{alert.title}</h3>
                      <p className="text-sm text-slate-300 mb-2">{alert.description}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(alert.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                    <Settings className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
