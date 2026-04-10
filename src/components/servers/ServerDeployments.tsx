import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  GitCommit,
  GitBranch,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useServers } from '@/hooks/useServers';

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

const statusConfig: Record<
  string,
  {
    icon: typeof CheckCircle2;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    animate?: boolean;
  }
> = {
  success: {
    icon: CheckCircle2,
    label: 'Success',
    color: 'text-success',
    bgColor: 'bg-success/20',
    borderColor: 'border-success/30',
  },
  building: {
    icon: Loader2,
    label: 'Building',
    color: 'text-warning',
    bgColor: 'bg-warning/20',
    borderColor: 'border-warning/30',
    animate: true,
  },
  queued: {
    icon: Loader2,
    label: 'Queued',
    color: 'text-warning',
    bgColor: 'bg-warning/20',
    borderColor: 'border-warning/30',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    color: 'text-destructive',
    bgColor: 'bg-destructive/20',
    borderColor: 'border-destructive/30',
  },
  cancelled: {
    icon: XCircle,
    label: 'Cancelled',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-muted-foreground/30',
  },
  rolled_back: {
    icon: XCircle,
    label: 'Rolled back',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-muted-foreground/30',
  },
};

const envConfig = {
  Production: 'bg-primary/20 text-primary border-primary/30',
  Preview: 'bg-cyan/20 text-cyan border-cyan/30',
};

export function ServerDeployments() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);
  const { deployments, loading, deployServer } = useServers();

  const filteredDeployments = deployments.filter(
    (d) =>
      (d.commit_message || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.branch || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.commit_sha || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deployments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/50 border-border"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-border gap-2" disabled={loading}>
            <RotateCcw className="h-4 w-4" />
            Redeploy
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredDeployments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No deployments yet</p>
            <p className="text-sm text-muted-foreground mt-1">Deploy a server to see build history</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="divide-y divide-border">
              {filteredDeployments.map((deployment) => {
                const statusKey = deployment.status in statusConfig ? deployment.status : 'failed';
                const status = statusConfig[statusKey];
                const StatusIcon = status.icon;
                const isExpanded = selectedDeployment === deployment.id;
                const environment = deployment.branch === 'main' ? 'Production' : 'Preview';

                return (
                  <div
                    key={deployment.id}
                    className={cn(
                      'p-4 hover:bg-muted/30 cursor-pointer transition-colors',
                      isExpanded && 'bg-muted/30'
                    )}
                    onClick={() => setSelectedDeployment(isExpanded ? null : deployment.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn('h-10 w-10 rounded-full flex items-center justify-center shrink-0', status.bgColor)}>
                        <StatusIcon className={cn('h-5 w-5', status.color, status.animate && 'animate-spin')} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground truncate">
                            {deployment.commit_message || 'No commit message'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {deployment.branch && (
                            <div className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              {deployment.branch}
                            </div>
                          )}
                          {deployment.commit_sha && (
                            <div className="flex items-center gap-1">
                              <GitCommit className="h-3 w-3" />
                              {deployment.commit_sha.slice(0, 7)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="outline" className={envConfig[environment as keyof typeof envConfig]}>
                          {environment}
                        </Badge>
                        <div className="text-right text-sm hidden sm:block">
                          <div className="text-muted-foreground">{relativeTime(deployment.created_at)}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDuration(deployment.duration_seconds)}
                          </div>
                        </div>
                        <ChevronRight
                          className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform',
                            isExpanded && 'rotate-90'
                          )}
                        />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-border animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div>
                              <span className="text-xs text-muted-foreground">Status</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className={cn(status.bgColor, status.color, status.borderColor)}>
                                  <StatusIcon className={cn('h-3 w-3 mr-1', status.animate && 'animate-spin')} />
                                  {status.label}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Build Duration</span>
                              <p className="text-sm text-foreground mt-1">{formatDuration(deployment.duration_seconds)}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 items-start justify-end">
                            <Button variant="outline" size="sm" className="gap-2 border-border">
                              <Eye className="h-3 w-3" />
                              View Logs
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 border-border"
                              onClick={(e) => {
                                e.stopPropagation();
                                deployServer(deployment.server_id);
                              }}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Redeploy
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
