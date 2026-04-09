import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Cpu,
  Zap,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HealthMetric {
  label: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
  icon: typeof Cpu;
}

export function ServerHealthMonitor() {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchServers();
  }, []);

  useEffect(() => {
    if (selectedServerId) {
      refreshMetrics();
    }
  }, [selectedServerId]);

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('servers')
        .select('id, name, status')
        .eq('status', 'live')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServers(data || []);
      if (data?.[0]) {
        setSelectedServerId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err);
      toast.error('Failed to fetch servers');
    } finally {
      setLoading(false);
    }
  };

  const getMetricsStatus = (value: number, threshold: number): 'healthy' | 'warning' | 'critical' => {
    if (value > threshold * 1.2) return 'critical';
    if (value > threshold) return 'warning';
    return 'healthy';
  };

  const refreshMetrics = async () => {
    if (!selectedServerId) return;

    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('server-agent', {
        body: {
          action: 'health_check',
          serverId: selectedServerId,
        },
      });

      if (error) throw error;

      if (data?.success && data.metrics) {
        const newMetrics: HealthMetric[] = [
          {
            label: 'CPU Usage',
            value: data.metrics.cpu || 0,
            unit: '%',
            threshold: 80,
            status: getMetricsStatus(data.metrics.cpu || 0, 80),
            icon: Cpu,
          },
          {
            label: 'Memory Usage',
            value: data.metrics.memory || 0,
            unit: '%',
            threshold: 85,
            status: getMetricsStatus(data.metrics.memory || 0, 85),
            icon: Zap,
          },
          {
            label: 'Disk Usage',
            value: data.metrics.disk || 0,
            unit: '%',
            threshold: 90,
            status: getMetricsStatus(data.metrics.disk || 0, 90),
            icon: HardDrive,
          },
        ];
        setMetrics(newMetrics);
        toast.success('Health metrics updated');
      }
    } catch (err: any) {
      console.error('Failed to fetch metrics:', err);
      toast.error(`Health check failed: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'critical') return 'bg-destructive text-destructive-foreground';
    if (status === 'warning') return 'bg-warning text-warning-foreground';
    return 'bg-success text-success-foreground';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'critical') return <AlertTriangle className="h-4 w-4" />;
    if (status === 'warning') return <AlertTriangle className="h-4 w-4" />;
    return <CheckCircle2 className="h-4 w-4" />;
  };

  if (loading) {
    return <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan" />
              Server Health Monitor
            </CardTitle>
            <CardDescription>Real-time CPU, memory, and disk monitoring</CardDescription>
          </div>
          <Button onClick={refreshMetrics} disabled={refreshing} size="sm" variant="outline">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Server Selection */}
        <div>
          <label className="text-sm font-medium">Select Server</label>
          <select
            value={selectedServerId || ''}
            onChange={(e) => setSelectedServerId(e.target.value)}
            className="w-full mt-2 px-3 py-2 bg-background border border-input rounded-md"
          >
            {servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name}
              </option>
            ))}
          </select>
        </div>

        {/* Metrics Grid */}
        {selectedServerId && metrics.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-4">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.label} className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <Badge className={getStatusColor(metric.status)}>
                        {getStatusIcon(metric.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
                    <p className="text-2xl font-bold">
                      {metric.value}
                      <span className="text-sm text-muted-foreground ml-1">{metric.unit}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">Threshold: {metric.threshold}%</p>
                  </div>
                );
              })}
            </div>

            {/* Alert for critical metrics */}
            {metrics.some((m) => m.status === 'critical') && (
              <Alert className="border-destructive bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  One or more metrics have exceeded critical thresholds. Please investigate.
                </AlertDescription>
              </Alert>
            )}

            {/* Recommendations */}
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-medium text-sm mb-2">AI Recommendations</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {metrics.filter((m) => m.status !== 'healthy').length === 0 ? (
                  <li>✓ All metrics are within healthy ranges</li>
                ) : (
                  metrics
                    .filter((m) => m.status !== 'healthy')
                    .map((metric) => (
                      <li key={metric.label}>
                        • {metric.label} is {metric.status}. Consider optimizing or scaling up resources.
                      </li>
                    ))
                )}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
