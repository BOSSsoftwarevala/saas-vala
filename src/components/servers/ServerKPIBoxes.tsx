import { 
  Server, 
  Activity, 
  PowerOff, 
  Ban, 
  GitBranch, 
  CheckCircle, 
  XCircle, 
  Globe, 
  ShieldCheck, 
  RefreshCw, 
  Database 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ServerKPIs } from '@/hooks/useServerManager';

interface ServerKPIBoxesProps {
  kpis: ServerKPIs;
  onKPIClick: (filter: string) => void;
  activeFilter: string | null;
}

const kpiConfig = [
  { key: 'totalServers', label: 'Total Servers', icon: Server, color: 'text-primary', bgColor: 'bg-primary/10', filter: 'all' },
  { key: 'activeServers', label: 'Active Servers', icon: Activity, color: 'text-success', bgColor: 'bg-success/10', filter: 'live' },
  { key: 'offlineServers', label: 'Offline Servers', icon: PowerOff, color: 'text-muted-foreground', bgColor: 'bg-muted', filter: 'stopped' },
  { key: 'suspendedServers', label: 'Suspended', icon: Ban, color: 'text-warning', bgColor: 'bg-warning/10', filter: 'suspended' },
  { key: 'totalDeployments', label: 'Total Deploys', icon: GitBranch, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10', filter: 'deployments' },
  { key: 'successfulDeployments', label: 'Successful', icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/10', filter: 'deploy-success' },
  { key: 'failedDeployments', label: 'Failed', icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', filter: 'deploy-failed' },
  { key: 'connectedGitRepos', label: 'Git Repos', icon: GitBranch, color: 'text-purple-500', bgColor: 'bg-purple-500/10', filter: 'git' },
  { key: 'activeDomains', label: 'Active Domains', icon: Globe, color: 'text-primary', bgColor: 'bg-primary/10', filter: 'domains' },
  { key: 'sslExpiringSoon', label: 'SSL Expiring', icon: ShieldCheck, color: 'text-warning', bgColor: 'bg-warning/10', filter: 'ssl-expiring' },
  { key: 'autoRestartEvents', label: 'Auto Restarts', icon: RefreshCw, color: 'text-orange-500', bgColor: 'bg-orange-500/10', filter: 'restarts' },
  { key: 'backupFailures', label: 'Backup Fails', icon: Database, color: 'text-destructive', bgColor: 'bg-destructive/10', filter: 'backup-failed' },
] as const;

export function ServerKPIBoxes({ kpis, onKPIClick, activeFilter }: ServerKPIBoxesProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-3">
      {kpiConfig.map((kpi) => {
        const Icon = kpi.icon;
        const value = kpis[kpi.key as keyof ServerKPIs];
        const isActive = activeFilter === kpi.filter;

        return (
          <button
            key={kpi.key}
            onClick={() => onKPIClick(kpi.filter)}
            className={cn(
              'glass-card rounded-xl p-3 text-center transition-all duration-200 hover:scale-105',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              isActive && 'ring-2 ring-primary shadow-lg'
            )}
          >
            <div className={cn('mx-auto w-8 h-8 rounded-lg flex items-center justify-center mb-2', kpi.bgColor)}>
              <Icon className={cn('h-4 w-4', kpi.color)} />
            </div>
            <p className={cn('text-xl font-bold', kpi.color)}>{value}</p>
            <p className="text-[10px] text-muted-foreground truncate">{kpi.label}</p>
          </button>
        );
      })}
    </div>
  );
}
