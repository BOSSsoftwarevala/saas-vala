import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle2, XCircle, RefreshCw, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface LogEntry {
  id: string;
  deployment_id: string | null;
  message: string;
  level?: string | null;
  log_level: string | null;
  timestamp: string | null;
}

interface DeploymentSummary {
  id: string;
  status: string | null;
  duration_seconds: number | null;
  created_at: string | null;
  commit_message: string | null;
}

export function SimpleBuildLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [latestDeploy, setLatestDeploy] = useState<DeploymentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);

    // Get latest deployment
    const { data: deploys } = await supabase
      .from('deployments')
      .select('id, status, duration_seconds, created_at, commit_message')
      .order('created_at', { ascending: false })
      .limit(1);

    const latest = deploys?.[0] || null;
    setLatestDeploy(latest);

    if (latest) {
      const { data: logData } = await supabase
        .from('deployment_logs')
        .select('*')
        .eq('deployment_id', latest.id)
        .order('timestamp', { ascending: true });

      setLogs(logData || []);
    } else {
      setLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (!latestDeploy || !['queued', 'building'].includes(String(latestDeploy.status || '').toLowerCase())) {
      return;
    }

    const interval = window.setInterval(() => {
      fetchLogs();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [latestDeploy?.id, latestDeploy?.status]);

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const levelIcon = (level: string | null) => {
    switch (level) {
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warn': return <Clock className="h-4 w-4 text-warning" />;
      default: return <CheckCircle2 className="h-4 w-4 text-success" />;
    }
  };

  const isSuccess = latestDeploy?.status === 'success';
  const isFailed = latestDeploy?.status === 'failed';

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg">Build Logs</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Live from database • Real deployment logs
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            {latestDeploy && (
              <Badge variant="outline" className={cn(
                isSuccess ? 'bg-success/20 text-success border-success/30' :
                isFailed ? 'bg-destructive/20 text-destructive border-destructive/30' :
                'bg-warning/20 text-warning border-warning/30'
              )}>
                {isSuccess ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Success</> :
                 isFailed ? <><XCircle className="h-3 w-3 mr-1" /> Failed</> :
                 <><Clock className="h-3 w-3 mr-1" /> {latestDeploy.status}</>}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Last Build Info */}
        {latestDeploy && (
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{timeAgo(latestDeploy.created_at)}</span>
            </div>
            {latestDeploy.duration_seconds && (
              <div className="flex items-center gap-1">
                <span>Duration:</span>
                <span className="font-medium text-foreground">{latestDeploy.duration_seconds}s</span>
              </div>
            )}
            {latestDeploy.commit_message && (
              <p className="text-xs truncate max-w-[200px]">{latestDeploy.commit_message}</p>
            )}
          </div>
        )}

        {/* Build Steps */}
        <ScrollArea className="h-[300px] sm:h-[350px]">
          <div className="space-y-2 pr-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No build logs yet</p>
                <p className="text-xs">Deploy a project to see logs here</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={cn(
                  'flex items-start gap-3 p-3 rounded-lg',
                  (log.level || log.log_level) === 'error' ? 'bg-destructive/10' : 'bg-muted/30'
                )}>
                  <div className="shrink-0 mt-0.5">{levelIcon(log.level || log.log_level)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium',
                      (log.level || log.log_level) === 'error' ? 'text-destructive' : 'text-foreground'
                    )}>
                      {log.message}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}