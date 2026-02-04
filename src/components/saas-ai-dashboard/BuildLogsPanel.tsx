import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Terminal, 
  Check, 
  X, 
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BuildLogsPanelProps {
  projectId: string | null;
}

export function BuildLogsPanel({ projectId: _projectId }: BuildLogsPanelProps) {

const mockBuilds = [
  {
    id: 'build-001',
    status: 'success',
    branch: 'main',
    commit: 'a1b2c3d',
    message: 'feat: add payment integration',
    duration: '2m 34s',
    startedAt: '10 minutes ago',
    logs: [
      { time: '00:00', level: 'info', message: 'Build started...' },
      { time: '00:02', level: 'info', message: 'Installing dependencies...' },
      { time: '00:45', level: 'info', message: 'Dependencies installed successfully' },
      { time: '00:46', level: 'info', message: 'Building application...' },
      { time: '02:10', level: 'info', message: 'Build completed successfully' },
      { time: '02:15', level: 'info', message: 'Deploying to server...' },
      { time: '02:30', level: 'success', message: 'Deployment complete!' },
    ]
  },
  {
    id: 'build-002',
    status: 'failed',
    branch: 'dev',
    commit: 'f4e5d6c',
    message: 'fix: database connection',
    duration: '1m 12s',
    startedAt: '1 hour ago',
    logs: [
      { time: '00:00', level: 'info', message: 'Build started...' },
      { time: '00:02', level: 'info', message: 'Installing dependencies...' },
      { time: '00:48', level: 'info', message: 'Dependencies installed successfully' },
      { time: '00:49', level: 'info', message: 'Building application...' },
      { time: '01:10', level: 'error', message: 'Error: Cannot find module "pg-promise"' },
      { time: '01:11', level: 'error', message: 'Build failed with exit code 1' },
    ]
  },
  {
    id: 'build-003',
    status: 'building',
    branch: 'main',
    commit: 'b7c8d9e',
    message: 'chore: update dependencies',
    duration: '45s...',
    startedAt: 'Just now',
    logs: [
      { time: '00:00', level: 'info', message: 'Build started...' },
      { time: '00:02', level: 'info', message: 'Installing dependencies...' },
      { time: '00:40', level: 'info', message: 'Resolving packages...' },
    ]
  }
];

  const [expandedBuild, setExpandedBuild] = useState<string | null>('build-001');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <Check className="h-4 w-4 text-success" />;
      case 'failed': return <X className="h-4 w-4 text-destructive" />;
      case 'building': return <RefreshCw className="h-4 w-4 text-warning animate-spin" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge className="bg-success/20 text-success border-success/30">Success</Badge>;
      case 'failed': return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Failed</Badge>;
      case 'building': return <Badge className="bg-warning/20 text-warning border-warning/30">Building</Badge>;
      default: return <Badge variant="secondary">Queued</Badge>;
    }
  };

  const copyLogs = (logs: typeof mockBuilds[0]['logs']) => {
    const text = logs.map(l => `[${l.time}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Logs copied to clipboard');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/20">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">Build Logs</h2>
            <p className="text-sm text-muted-foreground">View build history and logs</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Build List */}
      <div className="space-y-3">
        {mockBuilds.map((build) => (
          <Card key={build.id} className="glass-card overflow-hidden">
            <button
              onClick={() => setExpandedBuild(expandedBuild === build.id ? null : build.id)}
              className="w-full"
            >
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(build.status)}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-foreground">{build.commit}</span>
                        <Badge variant="outline" className="text-xs">{build.branch}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                        {build.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {getStatusBadge(build.status)}
                      <p className="text-xs text-muted-foreground mt-1">
                        {build.duration} • {build.startedAt}
                      </p>
                    </div>
                    {expandedBuild === build.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </button>

            {expandedBuild === build.id && (
              <CardContent className="pt-0 pb-4">
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyLogs(build.logs)}
                    className="absolute top-2 right-2 h-7 gap-1 text-xs"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                  <ScrollArea className="h-[200px] rounded-lg bg-background/50 border border-border p-3 font-mono text-xs">
                    {build.logs.map((log, idx) => (
                      <div 
                        key={idx} 
                        className={cn(
                          'py-0.5',
                          log.level === 'error' && 'text-destructive',
                          log.level === 'success' && 'text-success',
                          log.level === 'info' && 'text-foreground'
                        )}
                      >
                        <span className="text-muted-foreground">[{log.time}]</span>{' '}
                        {log.message}
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
