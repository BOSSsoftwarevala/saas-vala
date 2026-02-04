import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Rocket, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Server,
  Package,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Deployment, Server as ServerType } from '@/hooks/useServerManager';

interface LiveDeployStatusPanelProps {
  deployments: Deployment[];
  servers: ServerType[];
}

const DEPLOY_STEPS = [
  { key: 'clone', label: 'Cloning repository', duration: 5 },
  { key: 'install', label: 'Installing dependencies', duration: 15 },
  { key: 'build', label: 'Building application', duration: 25 },
  { key: 'deploy', label: 'Deploying to server', duration: 10 },
  { key: 'verify', label: 'Verifying deployment', duration: 5 },
];

export function LiveDeployStatusPanel({ deployments, servers }: LiveDeployStatusPanelProps) {
  const [, setTick] = useState(0);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  const getServerName = (serverId: string) => {
    return servers.find((s) => s.id === serverId)?.name || 'Unknown Server';
  };

  // Active deployments
  const activeDeployments = deployments.filter(
    (d) => d.status === 'queued' || d.status === 'building'
  );

  // Latest completed deployment
  const latestCompleted = deployments
    .filter((d) => d.status === 'success' || d.status === 'failed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  // Latest error
  const latestError = deployments
    .filter((d) => d.status === 'failed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const getProgress = (deployment: Deployment) => {
    if (deployment.status === 'queued') return 10;
    if (deployment.status === 'building') {
      const elapsed = (Date.now() - new Date(deployment.created_at).getTime()) / 1000;
      const progress = Math.min(10 + (elapsed / 60) * 80, 90);
      return Math.round(progress);
    }
    return 100;
  };

  const getCurrentStep = (deployment: Deployment) => {
    if (deployment.status === 'queued') return DEPLOY_STEPS[0];
    const elapsed = (Date.now() - new Date(deployment.created_at).getTime()) / 1000;
    let cumulative = 0;
    for (const step of DEPLOY_STEPS) {
      cumulative += step.duration;
      if (elapsed < cumulative) return step;
    }
    return DEPLOY_STEPS[DEPLOY_STEPS.length - 1];
  };

  return (
    <div className="w-80 border-l border-border bg-muted/30 p-4 hidden xl:block">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-foreground">Deploy Status</h3>
        <Badge variant="outline" className="text-xs gap-1 text-primary">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          Live
        </Badge>
      </div>

      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="space-y-4">
          {/* Active Deployments */}
          {activeDeployments.length > 0 ? (
            activeDeployments.map((dep) => (
              <Card key={dep.id} className="bg-card/50 border-primary/30">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-medium flex items-center gap-2 text-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    Active Deployment
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <Server className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium truncate">{getServerName(dep.server_id)}</span>
                    </div>
                    {dep.commit_message && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Package className="h-3 w-3" />
                        <span className="truncate">"{dep.commit_message}"</span>
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {getCurrentStep(dep).label}...
                      </span>
                      <span className="font-medium text-primary">{getProgress(dep)}%</span>
                    </div>
                    <Progress value={getProgress(dep)} className="h-2" />
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Started {formatDistanceToNow(new Date(dep.created_at), { addSuffix: true })}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-6 text-center">
                <Rocket className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground">No active deployments</p>
              </CardContent>
            </Card>
          )}

          {/* Latest Completed */}
          {latestCompleted && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                  {latestCompleted.status === 'success' ? (
                    <CheckCircle className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  Last Deployment
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate max-w-[160px]">
                    {getServerName(latestCompleted.server_id)}
                  </span>
                  <Badge 
                    variant={latestCompleted.status === 'success' ? 'default' : 'destructive'}
                    className="text-[10px] h-5"
                  >
                    {latestCompleted.status}
                  </Badge>
                </div>
                {latestCompleted.duration_seconds && (
                  <p className="text-[10px] text-muted-foreground">
                    Duration: {latestCompleted.duration_seconds}s
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(latestCompleted.created_at), { addSuffix: true })}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Latest Error */}
          {latestError && latestError.id !== latestCompleted?.id && (
            <Card className="bg-card/50 border-destructive/30">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-medium flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Latest Error
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                <p className="text-xs font-medium truncate">
                  {getServerName(latestError.server_id)}
                </p>
                {latestError.build_logs && (
                  <p className="text-[10px] text-destructive line-clamp-3 font-mono">
                    {latestError.build_logs}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(latestError.created_at), { addSuffix: true })}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Recent History */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Recent History
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {deployments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No deployments yet</p>
              ) : (
                <div className="space-y-2">
                  {deployments.slice(0, 5).map((dep) => (
                    <div key={dep.id} className="flex items-center gap-2 text-xs">
                      {dep.status === 'success' && <CheckCircle className="h-3 w-3 text-primary" />}
                      {dep.status === 'failed' && <XCircle className="h-3 w-3 text-destructive" />}
                      {(dep.status === 'queued' || dep.status === 'building') && (
                        <Loader2 className="h-3 w-3 animate-spin text-accent-foreground" />
                      )}
                      {(dep.status === 'cancelled' || dep.status === 'rolled_back') && (
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="truncate flex-1 text-muted-foreground">
                        {getServerName(dep.server_id)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(dep.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
