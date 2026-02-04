import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Clock,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LogEntry {
  id: string;
  step: string;
  status: 'done' | 'failed' | 'running';
  message?: string;
  time: string;
}

export function SimpleBuildLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 'l1', step: 'Pulling code from GitHub', status: 'done', time: '2s' },
    { id: 'l2', step: 'Installing packages', status: 'done', time: '15s' },
    { id: 'l3', step: 'Building your project', status: 'done', time: '28s' },
    { id: 'l4', step: 'Deploying to servers', status: 'done', time: '5s' },
    { id: 'l5', step: 'Setting up SSL', status: 'done', time: '3s' },
    { id: 'l6', step: 'Project is now live!', status: 'done', time: '0s' },
  ]);

  const [lastBuild, setLastBuild] = useState({
    status: 'success' as 'success' | 'failed',
    time: '2 hours ago',
    duration: '53s',
  });

  const handleRetry = () => {
    toast.info('Retrying build...', { description: 'Starting from scratch.' });
  };

  const statusIcon = {
    done: <CheckCircle2 className="h-4 w-4 text-success" />,
    failed: <XCircle className="h-4 w-4 text-destructive" />,
    running: <RefreshCw className="h-4 w-4 text-warning animate-spin" />,
  };

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
                Read-only • Plain language updates
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                lastBuild.status === 'success' 
                  ? 'bg-success/20 text-success border-success/30' 
                  : 'bg-destructive/20 text-destructive border-destructive/30'
              )}
            >
              {lastBuild.status === 'success' ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" /> Success</>
              ) : (
                <><XCircle className="h-3 w-3 mr-1" /> Failed</>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Last Build Info */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{lastBuild.time}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Duration:</span>
            <span className="font-medium text-foreground">{lastBuild.duration}</span>
          </div>
        </div>

        {/* Build Steps */}
        <ScrollArea className="h-[300px] sm:h-[350px]">
          <div className="space-y-2 pr-4">
            {logs.map((log, index) => (
              <div 
                key={log.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg',
                  log.status === 'failed' ? 'bg-destructive/10' : 'bg-muted/30'
                )}
              >
                <div className="shrink-0 mt-0.5">
                  {statusIcon[log.status]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium',
                    log.status === 'failed' ? 'text-destructive' : 'text-foreground'
                  )}>
                    {log.step}
                  </p>
                  {log.message && (
                    <p className="text-xs text-muted-foreground mt-1">{log.message}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {log.time}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Retry Button (only show if failed) */}
        {lastBuild.status === 'failed' && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>Build failed. Click retry to try again.</span>
            </div>
            <Button 
              onClick={handleRetry}
              className="bg-orange-gradient hover:opacity-90 text-white gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Build
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
