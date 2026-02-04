import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Rocket, 
  AlertTriangle, 
  RotateCcw, 
  HardDrive, 
  GitBranch,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Deployment, ServerEvent, BackupLog, GitConnection } from '@/hooks/useServerManager';

interface LiveActivityPanelProps {
  deployments: Deployment[];
  serverEvents: ServerEvent[];
  backupLogs: BackupLog[];
  gitConnections: GitConnection[];
  servers: { id: string; name: string }[];
}

export function LiveActivityPanel({
  deployments,
  serverEvents,
  backupLogs,
  gitConnections,
  servers,
}: LiveActivityPanelProps) {
  const [, setTick] = useState(0);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const getServerName = (serverId: string | null) => {
    if (!serverId) return 'Unknown';
    return servers.find((s) => s.id === serverId)?.name || 'Unknown';
  };

  // Running deployments
  const runningDeployments = deployments.filter(
    (d) => d.status === 'queued' || d.status === 'building'
  );

  // Latest error
  const latestError = deployments
    .filter((d) => d.status === 'failed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  // Last restart event
  const lastRestart = serverEvents
    .filter((e) => e.event_type === 'restart')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  // Last backup
  const lastBackup = backupLogs
    .sort((a, b) => new Date(b.started_at || '').getTime() - new Date(a.started_at || '').getTime())[0];

  // Recent git push triggers
  const recentGitPush = gitConnections
    .filter((g) => g.last_sync_at)
    .sort((a, b) => new Date(b.last_sync_at || '').getTime() - new Date(a.last_sync_at || '').getTime())[0];

  return (
    <div className="w-80 border-l border-border bg-muted/30 p-4 hidden xl:block">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-foreground">Live Activity</h3>
        <Badge variant="outline" className="text-xs gap-1 text-primary">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          Live
        </Badge>
      </div>

      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="space-y-4">
          {/* Running Deployments */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                <Rocket className="h-3.5 w-3.5 text-primary" />
                Running Deployments
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {runningDeployments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No active deployments</p>
              ) : (
                <div className="space-y-2">
                  {runningDeployments.slice(0, 3).map((dep) => (
                    <div key={dep.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium truncate max-w-[140px]">
                          {getServerName(dep.server_id)}
                        </span>
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {dep.status === 'queued' ? 'Queued' : 'Building'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={dep.status === 'queued' ? 10 : 60} 
                          className="h-1.5 flex-1" 
                        />
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Latest Error */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                Latest Error
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {!latestError ? (
                <div className="flex items-center gap-2 text-xs text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  No recent errors
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-medium truncate">
                    {getServerName(latestError.server_id)}
                  </p>
                  <p className="text-[10px] text-destructive line-clamp-2">
                    {latestError.commit_message || 'Deployment failed'}
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(latestError.created_at), { addSuffix: true })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Last Restart Event */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                <RotateCcw className="h-3.5 w-3.5 text-accent-foreground" />
                Last Restart
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {!lastRestart ? (
                <p className="text-xs text-muted-foreground">No restart events</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-medium">{lastRestart.title}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">
                    {lastRestart.description || 'Auto restart triggered'}
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(lastRestart.created_at), { addSuffix: true })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Last Backup Status */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                <HardDrive className="h-3.5 w-3.5 text-primary" />
                Last Backup
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {!lastBackup ? (
                <p className="text-xs text-muted-foreground">No backups recorded</p>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate max-w-[140px]">
                      {getServerName(lastBackup.server_id)}
                    </span>
                    <Badge 
                      variant={lastBackup.status === 'completed' ? 'default' : 'destructive'}
                      className="text-[10px] h-5"
                    >
                      {lastBackup.status === 'completed' ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Done</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" /> Failed</>
                      )}
                    </Badge>
                  </div>
                  {lastBackup.file_size && (
                    <p className="text-[10px] text-muted-foreground">
                      Size: {(lastBackup.file_size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {lastBackup.started_at 
                      ? formatDistanceToNow(new Date(lastBackup.started_at), { addSuffix: true })
                      : 'Unknown'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Git Push Trigger */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                <GitBranch className="h-3.5 w-3.5 text-secondary-foreground" />
                Git Push Trigger
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {!recentGitPush ? (
                <p className="text-xs text-muted-foreground">No recent pushes</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-medium truncate">
                    {recentGitPush.repository_name || 'Repository'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Branch: {recentGitPush.branch}
                  </p>
                  {recentGitPush.last_commit_message && (
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      "{recentGitPush.last_commit_message}"
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {recentGitPush.last_sync_at
                      ? formatDistanceToNow(new Date(recentGitPush.last_sync_at), { addSuffix: true })
                      : 'Unknown'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
