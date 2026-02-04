import { Button } from '@/components/ui/button';
import { Plus, Globe, GitBranch, Rocket, RefreshCw, Zap } from 'lucide-react';

interface QuickActionBarProps {
  onAddServer: () => void;
  onAddDomain: () => void;
  onConnectGit: () => void;
  onDeployNow: () => void;
  onRefresh: () => void;
  onForceSync: () => void;
  loading?: boolean;
}

export function QuickActionBar({
  onAddServer,
  onAddDomain,
  onConnectGit,
  onDeployNow,
  onRefresh,
  onForceSync,
  loading,
}: QuickActionBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Server Manager</h2>
        <p className="text-muted-foreground text-sm">
          One-click deploy • Auto subdomain • Zero configuration
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Refresh & Sync */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onForceSync}
          disabled={loading}
          className="gap-1.5"
        >
          <Zap className="h-4 w-4" />
          <span className="hidden sm:inline">Force Sync</span>
        </Button>

        <div className="w-px h-6 bg-border hidden sm:block" />

        {/* Quick Actions */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onConnectGit}
          className="gap-1.5"
        >
          <GitBranch className="h-4 w-4" />
          <span className="hidden md:inline">Connect Git</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onAddDomain}
          className="gap-1.5"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden md:inline">Add Domain</span>
        </Button>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={onDeployNow}
          className="gap-1.5"
        >
          <Rocket className="h-4 w-4" />
          <span className="hidden sm:inline">Deploy Now</span>
        </Button>
        <Button 
          onClick={onAddServer}
          size="sm"
          className="bg-orange-gradient hover:opacity-90 text-white gap-1.5"
        >
          <Plus className="h-4 w-4" />
          New Server
        </Button>
      </div>
    </div>
  );
}
