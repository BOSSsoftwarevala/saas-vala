import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Eye,
  Rocket,
  Ban,
  Trash2,
  MoreVertical,
  Server,
  Loader2,
  Play,
} from 'lucide-react';
import type { Server as ServerType } from '@/hooks/useServerManager';
import { formatDistanceToNow } from 'date-fns';

interface ServerTableProps {
  servers: ServerType[];
  loading: boolean;
  onView: (server: ServerType) => void;
  onDeploy: (server: ServerType) => void;
  onDisable: (server: ServerType) => void;
  onDelete: (server: ServerType) => void;
  onActivate: (server: ServerType) => void;
}

const statusConfig: Record<string, { label: string; style: string }> = {
  live: { label: 'Live', style: 'bg-success/20 text-success border-success/30' },
  deploying: { label: 'Deploying', style: 'bg-cyan-500/20 text-cyan-500 border-cyan-500/30' },
  failed: { label: 'Failed', style: 'bg-destructive/20 text-destructive border-destructive/30' },
  stopped: { label: 'Stopped', style: 'bg-muted text-muted-foreground border-muted-foreground/30' },
  suspended: { label: 'Suspended', style: 'bg-warning/20 text-warning border-warning/30' },
};

const runtimeLabels: Record<string, string> = {
  nodejs18: 'Node 18',
  nodejs20: 'Node 20',
  php82: 'PHP 8.2',
  php83: 'PHP 8.3',
  python311: 'Python 3.11',
  python312: 'Python 3.12',
};

export function ServerTable({
  servers,
  loading,
  onView,
  onDeploy,
  onDisable,
  onDelete,
  onActivate,
}: ServerTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Server className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-foreground mb-2">No servers found</h3>
        <p className="text-muted-foreground">Create your first server to get started</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-muted/50">
          <TableHead className="text-muted-foreground">Server Name</TableHead>
          <TableHead className="text-muted-foreground">Type</TableHead>
          <TableHead className="text-muted-foreground">Runtime</TableHead>
          <TableHead className="text-muted-foreground">Domain</TableHead>
          <TableHead className="text-muted-foreground">Status</TableHead>
          <TableHead className="text-muted-foreground">Last Deploy</TableHead>
          <TableHead className="text-muted-foreground text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {servers.map((server) => {
          const status = statusConfig[server.status] || statusConfig.stopped;
          const runtime = server.runtime ? runtimeLabels[server.runtime] || server.runtime : 'N/A';

          return (
            <TableRow key={server.id} className="border-border hover:bg-muted/30">
              <TableCell>
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">{server.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {server.server_type || 'Vercel'}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {runtime}
                </Badge>
              </TableCell>
              <TableCell>
                {server.subdomain ? (
                  <span className="text-xs text-primary font-mono">
                    {server.subdomain}.saasvala.com
                  </span>
                ) : server.custom_domain ? (
                  <span className="text-xs text-foreground font-mono">
                    {server.custom_domain}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={status.style}>
                  {server.status === 'deploying' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  {status.label}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {server.last_deploy_at 
                  ? formatDistanceToNow(new Date(server.last_deploy_at), { addSuffix: true })
                  : 'Never'}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onView(server)}
                  >
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onDeploy(server)}
                    disabled={server.status === 'deploying'}
                  >
                    <Rocket className="h-4 w-4 text-primary" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      {server.status === 'suspended' ? (
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer text-success"
                          onClick={() => onActivate(server)}
                        >
                          <Play className="h-4 w-4" /> Activate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer text-warning"
                          onClick={() => onDisable(server)}
                        >
                          <Ban className="h-4 w-4" /> Suspend
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="gap-2 cursor-pointer text-destructive"
                        onClick={() => onDelete(server)}
                      >
                        <Trash2 className="h-4 w-4" /> Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
