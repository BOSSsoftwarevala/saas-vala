import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  Server,
  Database,
  Globe,
  Zap,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthPanelProps {
  projectId: string | null;
}

interface HealthCheck {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastCheck: string;
  uptime: number;
  icon: React.ComponentType<{ className?: string }>;
}

export function HealthPanel({ projectId: _projectId }: HealthPanelProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([
    { id: '1', name: 'Web Server', status: 'healthy', responseTime: 45, lastCheck: '30 seconds ago', uptime: 99.98, icon: Server },
    { id: '2', name: 'Database', status: 'healthy', responseTime: 12, lastCheck: '30 seconds ago', uptime: 99.99, icon: Database },
    { id: '3', name: 'CDN', status: 'healthy', responseTime: 8, lastCheck: '30 seconds ago', uptime: 100, icon: Globe },
    { id: '4', name: 'API Gateway', status: 'degraded', responseTime: 250, lastCheck: '30 seconds ago', uptime: 98.5, icon: Zap },
  ]);

  const refresh = async () => {
    setIsRefreshing(true);
    await new Promise(r => setTimeout(r, 1500));
    setHealthChecks(prev => prev.map(h => ({
      ...h,
      responseTime: Math.floor(Math.random() * 100) + 10,
      lastCheck: 'Just now'
    })));
    setIsRefreshing(false);
  };

  const _getStatusIcon = (status: HealthCheck['status']) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-success" />;
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'down': return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getStatusBadge = (status: HealthCheck['status']) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-success/20 text-success border-success/30">Healthy</Badge>;
      case 'degraded': return <Badge className="bg-warning/20 text-warning border-warning/30">Degraded</Badge>;
      case 'down': return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Down</Badge>;
    }
  };

  const overallHealth = healthChecks.every(h => h.status === 'healthy') 
    ? 'healthy' 
    : healthChecks.some(h => h.status === 'down') 
      ? 'down' 
      : 'degraded';

  const averageUptime = (healthChecks.reduce((acc, h) => acc + h.uptime, 0) / healthChecks.length).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card className={cn(
        "glass-card border-2",
        overallHealth === 'healthy' && "border-success/30",
        overallHealth === 'degraded' && "border-warning/30",
        overallHealth === 'down' && "border-destructive/30"
      )}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-3 rounded-xl",
                overallHealth === 'healthy' && "bg-success/20",
                overallHealth === 'degraded' && "bg-warning/20",
                overallHealth === 'down' && "bg-destructive/20"
              )}>
                <Activity className={cn(
                  "h-6 w-6",
                  overallHealth === 'healthy' && "text-success",
                  overallHealth === 'degraded' && "text-warning",
                  overallHealth === 'down' && "text-destructive"
                )} />
              </div>
              <div>
                <CardTitle className="text-xl">System Status</CardTitle>
                <CardDescription>
                  {overallHealth === 'healthy' && 'All systems operational'}
                  {overallHealth === 'degraded' && 'Some systems experiencing issues'}
                  {overallHealth === 'down' && 'Critical systems are down'}
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
              <p className="text-2xl font-display font-bold text-foreground">
                {healthChecks.filter(h => h.status === 'healthy').length}/{healthChecks.length}
              </p>
              <p className="text-xs text-muted-foreground">Services Healthy</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
              <p className="text-2xl font-display font-bold text-success">{averageUptime}%</p>
              <p className="text-xs text-muted-foreground">Average Uptime</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
              <p className="text-2xl font-display font-bold text-foreground">
                {Math.min(...healthChecks.map(h => h.responseTime))}ms
              </p>
              <p className="text-xs text-muted-foreground">Fastest Response</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
              <p className="text-2xl font-display font-bold text-foreground">
                {Math.max(...healthChecks.map(h => h.responseTime))}ms
              </p>
              <p className="text-xs text-muted-foreground">Slowest Response</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Health Checks */}
      <div className="space-y-3">
        <h3 className="font-display font-bold text-foreground">Service Health</h3>
        
        {healthChecks.map((check) => (
          <Card key={check.id} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    check.status === 'healthy' && "bg-success/20",
                    check.status === 'degraded' && "bg-warning/20",
                    check.status === 'down' && "bg-destructive/20"
                  )}>
                    <check.icon className={cn(
                      "h-4 w-4",
                      check.status === 'healthy' && "text-success",
                      check.status === 'degraded' && "text-warning",
                      check.status === 'down' && "text-destructive"
                    )} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{check.name}</span>
                      {getStatusBadge(check.status)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {check.responseTime}ms
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {check.lastCheck}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{check.uptime}%</p>
                  <p className="text-xs text-muted-foreground">Uptime</p>
                  <Progress 
                    value={check.uptime} 
                    className="w-24 h-1.5 mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
