import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus,
  Search,
  Server,
  GitBranch,
  ExternalLink,
  MoreVertical,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  PauseCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useServers } from '@/hooks/useServers';

interface ServerOverviewProps {
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
}

const runtimeLabels: Record<string, string> = {
  nodejs18: 'Node.js 18',
  nodejs20: 'Node.js 20',
  php82: 'PHP 8.2',
  php83: 'PHP 8.3',
  python311: 'Python 3.11',
  python312: 'Python 3.12',
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const statusConfig: Record<string, {
  icon: typeof CheckCircle2;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  animate?: boolean;
}> = {
  live: {
    icon: CheckCircle2,
    label: 'Live',
    color: 'text-success',
    bgColor: 'bg-success/20',
    borderColor: 'border-success/30',
  },
  deploying: {
    icon: Loader2,
    label: 'Deploying',
    color: 'text-warning',
    bgColor: 'bg-warning/20',
    borderColor: 'border-warning/30',
    animate: true,
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    color: 'text-destructive',
    bgColor: 'bg-destructive/20',
    borderColor: 'border-destructive/30',
  },
  stopped: {
    icon: PauseCircle,
    label: 'Stopped',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-muted-foreground/30',
  },
  suspended: {
    icon: PauseCircle,
    label: 'Suspended',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-muted-foreground/30',
  },
};

export function ServerOverview({ onSelectProject, onNewProject }: ServerOverviewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { servers, deployments, loading } = useServers();

  const filteredServers = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.git_repo || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = servers.filter((s) => s.status === 'live').length;
  const buildingCount = servers.filter((s) => s.status === 'deploying').length;
  const avgUptime = servers.length
    ? Math.round(servers.reduce((sum, s) => sum + (s.uptime_percent || 0), 0) / servers.length * 10) / 10
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="status-dot status-online" />
              <p className="text-2xl font-bold text-success">{activeCount}</p>
            </div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Loader2 className="h-4 w-4 text-warning animate-spin" />
              <p className="text-2xl font-bold text-warning">{buildingCount}</p>
            </div>
            <p className="text-sm text-muted-foreground">Deploying</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{deployments.length}</p>
            <p className="text-sm text-muted-foreground">Deployments</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{avgUptime > 0 ? `${avgUptime}%` : '—'}</p>
            <p className="text-sm text-muted-foreground">Avg Uptime</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-border"
            />
          </div>
          <Button onClick={onNewProject} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Import Project</span>
          </Button>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredServers.map((server) => {
          const statusKey = server.status in statusConfig ? server.status : 'stopped';
          const status = statusConfig[statusKey];
          const StatusIcon = status.icon;
          const domain = server.custom_domain || (server.subdomain ? `${server.subdomain}.saasvala.com` : null);

          return (
            <Card
              key={server.id}
              className="glass-card-hover cursor-pointer group"
              onClick={() => onSelectProject(server.id)}
            >
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Server className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {server.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <GitBranch className="h-3 w-3" />
                        <span>{server.git_repo || runtimeLabels[server.runtime] || server.runtime}</span>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      <DropdownMenuItem>View Deployments</DropdownMenuItem>
                      <DropdownMenuItem>Manage Domains</DropdownMenuItem>
                      <DropdownMenuItem>View Logs</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">Delete Project</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Status & Domain */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={cn(status.bgColor, status.color, status.borderColor)}>
                      <StatusIcon className={cn('h-3 w-3 mr-1', status.animate && 'animate-spin')} />
                      {status.label}
                    </Badge>
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      {server.git_branch}
                    </Badge>
                  </div>

                  {domain && (
                    <a
                      href={`https://${domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-secondary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {domain}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {/* Last Deployment */}
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {relativeTime(server.last_deploy_at)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredServers.length === 0 && !loading && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <Server className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No servers yet</p>
            <p className="text-sm text-muted-foreground mt-1">Import a project to get started</p>
          </div>
        )}

        {/* Add Project Card */}
        <Card
          className="glass-card border-dashed border-2 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={onNewProject}
        >
          <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[200px] text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Import Project</h3>
            <p className="text-sm text-muted-foreground">
              Connect your Git repository
            </p>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
