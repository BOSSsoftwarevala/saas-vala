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
  ExternalLink,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock deployments data
const mockDeployments = [
  {
    id: 'd1',
    status: 'ready',
    environment: 'Production',
    branch: 'main',
    commit: 'a1b2c3d',
    commitMessage: 'feat: add user authentication system',
    author: 'Manoj Kumar',
    timestamp: '2 hours ago',
    duration: '45s',
    url: 'https://saas-vala.com',
  },
  {
    id: 'd2',
    status: 'building',
    environment: 'Preview',
    branch: 'feature/dashboard',
    commit: 'e4f5g6h',
    commitMessage: 'fix: resolve dashboard layout issue',
    author: 'Manoj Kumar',
    timestamp: 'Just now',
    duration: '...',
    url: 'https://preview-dashboard.saasvala.com',
  },
  {
    id: 'd3',
    status: 'ready',
    environment: 'Preview',
    branch: 'feature/api',
    commit: 'i7j8k9l',
    commitMessage: 'chore: update API endpoints',
    author: 'Dev Team',
    timestamp: '5 hours ago',
    duration: '38s',
    url: 'https://preview-api.saasvala.com',
  },
  {
    id: 'd4',
    status: 'error',
    environment: 'Preview',
    branch: 'bugfix/cors',
    commit: 'm0n1o2p',
    commitMessage: 'fix: cors headers configuration',
    author: 'Manoj Kumar',
    timestamp: '1 day ago',
    duration: '12s',
    url: null,
    error: 'Build failed: Module not found',
  },
  {
    id: 'd5',
    status: 'ready',
    environment: 'Production',
    branch: 'main',
    commit: 'q3r4s5t',
    commitMessage: 'refactor: optimize database queries',
    author: 'Dev Team',
    timestamp: '2 days ago',
    duration: '52s',
    url: 'https://saas-vala.com',
  },
  {
    id: 'd6',
    status: 'canceled',
    environment: 'Preview',
    branch: 'experiment/ai',
    commit: 'u6v7w8x',
    commitMessage: 'experiment: add AI chatbot',
    author: 'Manoj Kumar',
    timestamp: '3 days ago',
    duration: '8s',
    url: null,
  },
];

const statusConfig: Record<string, {
  icon: typeof CheckCircle2;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  animate?: boolean;
}> = {
  ready: {
    icon: CheckCircle2,
    label: 'Ready',
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
  error: {
    icon: XCircle,
    label: 'Error',
    color: 'text-destructive',
    bgColor: 'bg-destructive/20',
    borderColor: 'border-destructive/30',
  },
  canceled: {
    icon: XCircle,
    label: 'Canceled',
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

  const filteredDeployments = mockDeployments.filter(
    (d) =>
      d.commitMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.branch.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.commit.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <Button variant="outline" className="border-border gap-2">
            <RotateCcw className="h-4 w-4" />
            Redeploy
          </Button>
        </div>
      </div>

      {/* Deployments List */}
      <div className="glass-card rounded-xl overflow-hidden">
        <ScrollArea className="h-[600px]">
          <div className="divide-y divide-border">
            {filteredDeployments.map((deployment) => {
              const status = statusConfig[deployment.status as keyof typeof statusConfig];
              const StatusIcon = status.icon;
              const isExpanded = selectedDeployment === deployment.id;

              return (
                <div
                  key={deployment.id}
                  className={cn(
                    'p-4 hover:bg-muted/30 cursor-pointer transition-colors',
                    isExpanded && 'bg-muted/30'
                  )}
                  onClick={() => setSelectedDeployment(isExpanded ? null : deployment.id)}
                >
                  {/* Main Row */}
                  <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    <div className={cn('h-10 w-10 rounded-full flex items-center justify-center shrink-0', status.bgColor)}>
                      <StatusIcon className={cn('h-5 w-5', status.color, status.animate && 'animate-spin')} />
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground truncate">
                          {deployment.commitMessage}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          {deployment.branch}
                        </div>
                        <div className="flex items-center gap-1">
                          <GitCommit className="h-3 w-3" />
                          {deployment.commit}
                        </div>
                        <span>{deployment.author}</span>
                      </div>
                    </div>

                    {/* Right Side */}
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="outline" className={envConfig[deployment.environment as keyof typeof envConfig]}>
                        {deployment.environment}
                      </Badge>
                      <div className="text-right text-sm hidden sm:block">
                        <div className="text-muted-foreground">{deployment.timestamp}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {deployment.duration}
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        isExpanded && 'rotate-90'
                      )} />
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border animate-fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left: Details */}
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
                          {deployment.error && (
                            <div>
                              <span className="text-xs text-muted-foreground">Error</span>
                              <p className="text-sm text-destructive mt-1">{deployment.error}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-xs text-muted-foreground">Build Duration</span>
                            <p className="text-sm text-foreground mt-1">{deployment.duration}</p>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex flex-wrap gap-2 items-start justify-end">
                          {deployment.url && (
                            <Button variant="outline" size="sm" className="gap-2 border-border" asChild>
                              <a href={deployment.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                                Visit
                              </a>
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="gap-2 border-border">
                            <Eye className="h-3 w-3" />
                            View Logs
                          </Button>
                          <Button variant="outline" size="sm" className="gap-2 border-border">
                            <RotateCcw className="h-3 w-3" />
                            Redeploy
                          </Button>
                          {deployment.environment === 'Preview' && deployment.status === 'ready' && (
                            <Button size="sm" className="bg-orange-gradient hover:opacity-90 text-white gap-2">
                              Promote to Production
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
