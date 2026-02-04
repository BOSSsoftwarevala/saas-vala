import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Server, GitBranch, ExternalLink, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ServerCardProps {
  name: string;
  domain?: string;
  repo?: string;
  status: 'online' | 'offline' | 'deploying';
  lastDeployed?: string;
  onClick?: () => void;
}

const statusConfig = {
  online: {
    label: 'Online',
    dotClass: 'status-online',
    badgeClass: 'bg-success/20 text-success border-success/30',
  },
  offline: {
    label: 'Offline',
    dotClass: 'status-offline',
    badgeClass: 'bg-destructive/20 text-destructive border-destructive/30',
  },
  deploying: {
    label: 'Deploying',
    dotClass: 'status-pending',
    badgeClass: 'bg-warning/20 text-warning border-warning/30',
  },
};

export function ServerCard({
  name,
  domain,
  repo,
  status,
  lastDeployed,
  onClick,
}: ServerCardProps) {
  const config = statusConfig[status];

  return (
    <div
      className="glass-card-hover min-w-[300px] max-w-[300px] rounded-xl p-4 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
          <Server className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className={cn('status-dot', config.dotClass)} />
            <Badge variant="outline" className={config.badgeClass}>
              {config.label}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              <DropdownMenuItem>View Logs</DropdownMenuItem>
              <DropdownMenuItem>Redeploy</DropdownMenuItem>
              <DropdownMenuItem>Rollback</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <h3 className="font-semibold text-foreground mb-1">{name}</h3>

      {domain && (
        <a
          href={`https://${domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-secondary hover:underline mb-2"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
          {domain}
        </a>
      )}

      {repo && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
          <GitBranch className="h-3 w-3" />
          <span className="truncate">{repo}</span>
        </div>
      )}

      {lastDeployed && (
        <p className="text-xs text-muted-foreground">
          Last deployed: {lastDeployed}
        </p>
      )}
    </div>
  );
}
