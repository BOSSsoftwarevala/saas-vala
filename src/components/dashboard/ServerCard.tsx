import { useState } from 'react';
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
import { ServerActionModal } from '@/components/dashboard/ServerActionModal';
import { toast } from 'sonner';
import type { DashboardServer, DashboardLog } from '@/lib/dashboardApi';

interface ServerCardProps {
  server?: DashboardServer | null;
  name?: string;
  domain?: string;
  repo?: string;
  status?: 'online' | 'offline' | 'deploying';
  lastDeployed?: string;
  onClick?: () => void;
  onRestart?: (serverId: string) => Promise<void>;
  onMarkOffline?: (serverId: string) => Promise<void>;
  onDeployProduct?: (serverId: string, productId: string) => Promise<void>;
  logs?: DashboardLog[];
  products?: Array<{ id: string; name: string }>;
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

function normalizeServerStatus(status?: string): 'online' | 'offline' | 'deploying' {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'deploying') return 'deploying';
  if (normalized === 'online' || normalized === 'live' || normalized === 'active') return 'online';
  if (normalized === 'offline' || normalized === 'down' || normalized === 'failed' || normalized === 'stopped' || normalized === 'suspended') return 'offline';

  return 'offline';
}

export function ServerCard({
  server,
  name: legacyName,
  domain: legacyDomain,
  repo: legacyRepo,
  status: legacyStatus,
  lastDeployed: legacyLastDeployed,
  onClick,
  onRestart,
  onMarkOffline,
  onDeployProduct,
  logs = [],
  products = [],
}: ServerCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'logs' | 'deploy-product' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Use server object if available, otherwise fall back to legacy props
  const displayServer = server || {
    id: '',
    name: legacyName || '',
    status: legacyStatus || 'online',
    created_at: new Date().toISOString(),
  };

  const displayName = server?.name || legacyName || '';
  const displayDomain = server?.name || legacyDomain;
  const displayStatus = normalizeServerStatus(server?.status || legacyStatus);
  const config = statusConfig[displayStatus];

  const handleOpenModal = (action: 'logs' | 'deploy-product') => {
    setModalAction(action);
    setModalOpen(true);
  };

  const handleRestart = async () => {
    if (!server?.id || !onRestart) return;
    setActionLoading(true);
    try {
      await onRestart(server.id);
      toast.success('Server restart initiated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to restart server');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkOffline = async () => {
    if (!server?.id || !onMarkOffline) return;
    setActionLoading(true);
    try {
      await onMarkOffline(server.id);
      toast.success('Server marked offline');
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark server offline');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
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
                <DropdownMenuItem onClick={() => handleOpenModal('logs')}>View Logs</DropdownMenuItem>
                {onDeployProduct && (
                  <DropdownMenuItem onClick={() => handleOpenModal('deploy-product')}>
                    Deploy Product
                  </DropdownMenuItem>
                )}
                {onRestart && (
                  <DropdownMenuItem onClick={handleRestart} disabled={actionLoading}>
                    Restart
                  </DropdownMenuItem>
                )}
                {onMarkOffline && (
                  <DropdownMenuItem onClick={handleMarkOffline} disabled={actionLoading} className="text-destructive">
                    Mark Offline
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <h3 className="font-semibold text-foreground mb-1">{displayName}</h3>

        {displayDomain && (
          <a
            href={`https://${displayDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-secondary hover:underline mb-2"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
            {displayDomain}
          </a>
        )}

        {legacyRepo && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
            <GitBranch className="h-3 w-3" />
            <span className="truncate">{legacyRepo}</span>
          </div>
        )}

        {legacyLastDeployed && (
          <div className="text-xs text-muted-foreground">
            Last deployed: {new Date(legacyLastDeployed).toLocaleDateString()}
          </div>
        )}

        {server?.region && (
          <div className="text-xs text-muted-foreground">
            Region: {server.region}
          </div>
        )}

        {server?.load !== undefined && (
          <div className="text-xs text-muted-foreground">
            Load: {server.load}%
          </div>
        )}
      </div>

      <ServerActionModal
        open={modalOpen}
        action={modalAction}
        server={server || null}
        onClose={() => {
          setModalOpen(false);
          setModalAction(null);
        }}
        onDeployProduct={onDeployProduct}
        logs={logs}
        products={products}
      />
    </>
  );
}
