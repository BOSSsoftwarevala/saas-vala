import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  Server,
  GitBranch,
  ExternalLink,
  MoreVertical,
  Play,
  RotateCcw,
  FileText,
  Trash2,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock data
const mockServers = [
  {
    id: '1',
    name: 'Production API',
    domain: 'api.saas-vala.com',
    repo: 'saas-vala/api',
    branch: 'main',
    status: 'online' as const,
    lastDeployed: '2 hours ago',
    deployments: 156,
    uptime: '99.9%',
  },
  {
    id: '2',
    name: 'Staging Environment',
    domain: 'staging.saas-vala.com',
    repo: 'saas-vala/web',
    branch: 'develop',
    status: 'deploying' as const,
    lastDeployed: 'Just now',
    deployments: 89,
    uptime: '98.5%',
  },
  {
    id: '3',
    name: 'Analytics Service',
    domain: 'analytics.saas-vala.com',
    repo: 'saas-vala/analytics',
    branch: 'main',
    status: 'online' as const,
    lastDeployed: '1 day ago',
    deployments: 45,
    uptime: '99.8%',
  },
  {
    id: '4',
    name: 'Legacy System',
    repo: 'saas-vala/legacy',
    branch: 'master',
    status: 'offline' as const,
    lastDeployed: '1 week ago',
    deployments: 234,
    uptime: '0%',
  },
];

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

export default function Servers() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredServers = mockServers.filter(
    (server) =>
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.repo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Server Manager
            </h2>
            <p className="text-muted-foreground">
              Deploy and manage your applications
            </p>
          </div>
          <Button className="bg-orange-gradient hover:opacity-90 text-white gap-2">
            <Plus className="h-4 w-4" />
            New Deployment
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="status-dot status-online" />
              <p className="text-2xl font-bold text-success">3</p>
            </div>
            <p className="text-sm text-muted-foreground">Online</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="status-dot status-pending animate-pulse" />
              <p className="text-2xl font-bold text-warning">1</p>
            </div>
            <p className="text-sm text-muted-foreground">Deploying</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="status-dot status-offline" />
              <p className="text-2xl font-bold text-destructive">1</p>
            </div>
            <p className="text-sm text-muted-foreground">Offline</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">524</p>
            <p className="text-sm text-muted-foreground">Total Deployments</p>
          </div>
        </div>

        {/* Search */}
        <div className="glass-card rounded-xl p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search servers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-border"
            />
          </div>
        </div>

        {/* Server Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredServers.map((server) => {
            const config = statusConfig[server.status];
            return (
              <Card key={server.id} className="glass-card-hover overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <Server className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-foreground">{server.name}</CardTitle>
                        {server.domain && (
                          <a
                            href={`https://${server.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-secondary hover:underline"
                          >
                            <Globe className="h-3 w-3" />
                            {server.domain}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('status-dot', config.dotClass)} />
                      <Badge variant="outline" className={config.badgeClass}>
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <GitBranch className="h-4 w-4" />
                      <span>{server.repo}</span>
                    </div>
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      {server.branch}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{server.deployments}</p>
                      <p className="text-xs text-muted-foreground">Deployments</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">{server.uptime}</p>
                      <p className="text-xs text-muted-foreground">Uptime</p>
                    </div>
                    <div>
                      <p className="text-sm text-foreground">{server.lastDeployed}</p>
                      <p className="text-xs text-muted-foreground">Last Deploy</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                        <FileText className="h-4 w-4" />
                        Logs
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                        <RotateCcw className="h-4 w-4" />
                        Rollback
                      </Button>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border">
                        <DropdownMenuItem className="gap-2 cursor-pointer">
                          <Play className="h-4 w-4" /> Redeploy
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer">
                          <ExternalLink className="h-4 w-4" /> Visit Site
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer text-destructive">
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
