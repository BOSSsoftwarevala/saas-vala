import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  GitBranch, 
  Loader2, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Unlink,
  Rocket,
  Github
} from 'lucide-react';
import { toast } from 'sonner';
import type { Server, GitConnection } from '@/hooks/useServerManager';

interface GitConnectionPanelProps {
  server: Server | null;
  gitConnection: GitConnection | null;
  onConnect: (connection: Partial<GitConnection>) => Promise<void>;
  onDisconnect: (connectionId: string) => Promise<void>;
  onManualDeploy: (serverId: string, branch?: string) => Promise<void>;
}

const GIT_PROVIDERS = [
  { value: 'github', label: 'GitHub', icon: Github },
  { value: 'gitlab', label: 'GitLab', icon: GitBranch },
  { value: 'bitbucket', label: 'Bitbucket', icon: GitBranch },
];

export function GitConnectionPanel({ 
  server, 
  gitConnection, 
  onConnect, 
  onDisconnect,
  onManualDeploy 
}: GitConnectionPanelProps) {
  const [loading, setLoading] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const [formData, setFormData] = useState({
    provider: 'github' as 'github' | 'gitlab' | 'bitbucket',
    repository_url: gitConnection?.repository_url || '',
    branch: gitConnection?.branch || 'main',
    deploy_token: '',
    auto_deploy: gitConnection?.auto_deploy ?? true,
  });

  const isConnected = gitConnection?.status === 'connected';
  const isFailed = gitConnection?.status === 'failed';

  const handleConnect = async () => {
    if (!server) {
      toast.error('Select a server first');
      return;
    }
    if (!formData.repository_url.trim()) {
      toast.error('Repository URL is required');
      return;
    }

    setLoading(true);
    try {
      await onConnect({
        server_id: server.id,
        provider: formData.provider,
        repository_url: formData.repository_url,
        branch: formData.branch,
        auto_deploy: formData.auto_deploy,
      });
      toast.success('Git repository connected');
    } catch {
      toast.error('Failed to connect repository');
    }
    setLoading(false);
  };

  const handleReconnect = async () => {
    if (!gitConnection) return;
    
    setReconnecting(true);
    try {
      await onConnect({
        server_id: gitConnection.server_id || undefined,
        provider: gitConnection.provider,
        repository_url: gitConnection.repository_url,
        branch: gitConnection.branch,
        auto_deploy: gitConnection.auto_deploy,
      });
      toast.success('Repository reconnected');
    } catch {
      toast.error('Failed to reconnect');
    }
    setReconnecting(false);
  };

  const handleDisconnect = async () => {
    if (!gitConnection) return;
    
    setLoading(true);
    try {
      await onDisconnect(gitConnection.id);
      toast.success('Git disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
    setLoading(false);
  };

  const handleManualDeploy = async () => {
    if (!server) return;
    
    setDeploying(true);
    try {
      await onManualDeploy(server.id, gitConnection?.branch || 'main');
      toast.success('Deployment triggered');
    } catch {
      toast.error('Failed to trigger deployment');
    }
    setDeploying(false);
  };

  const getStatusBadge = () => {
    if (!gitConnection) return null;
    
    switch (gitConnection.status) {
      case 'connected':
        return (
          <Badge variant="outline" className="text-primary border-primary/30 gap-1">
            <CheckCircle className="h-3 w-3" /> Connected
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" /> Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            Disconnected
          </Badge>
        );
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <GitBranch className="h-5 w-5 text-primary" />
          Git Connection
          <div className="ml-auto">
            {getStatusBadge()}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isConnected ? (
          <>
            {/* Connected State */}
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">{gitConnection?.repository_name || 'Repository'}</p>
                  <p className="text-sm text-muted-foreground font-mono break-all">
                    {gitConnection?.repository_url}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Branch: {gitConnection?.branch}</Badge>
                <Badge variant="outline">
                  Auto Deploy: {gitConnection?.auto_deploy ? 'ON' : 'OFF'}
                </Badge>
              </div>
              {gitConnection?.last_commit_message && (
                <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                  Last commit: "{gitConnection.last_commit_message}"
                </p>
              )}
            </div>

            {/* Connected Actions */}
            <div className="flex flex-wrap gap-3">
              <Button 
                variant="outline"
                onClick={handleReconnect}
                disabled={reconnecting}
                className="gap-2"
              >
                {reconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Reconnect
              </Button>
              
              <Button 
                variant="outline"
                onClick={handleDisconnect}
                disabled={loading}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Unlink className="h-4 w-4" />
                Disconnect
              </Button>

              <Button 
                onClick={handleManualDeploy}
                disabled={deploying || !server}
                className="bg-orange-gradient hover:opacity-90 text-white gap-2 ml-auto"
              >
                {deploying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Manual Deploy
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Failed State Warning */}
            {isFailed && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm flex items-center gap-2">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                Connection failed. Please check credentials and try again.
              </div>
            )}

            {/* Connection Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Git Provider</Label>
                <Select 
                  value={formData.provider}
                  onValueChange={(v) => setFormData({ ...formData, provider: v as 'github' | 'gitlab' | 'bitbucket' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GIT_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="flex items-center gap-2">
                          <p.icon className="h-4 w-4" />
                          {p.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Repository URL *</Label>
                <Input
                  placeholder="https://github.com/username/repo"
                  value={formData.repository_url}
                  onChange={(e) => setFormData({ ...formData, repository_url: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Input
                    placeholder="main"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Deploy Key / Token</Label>
                  <Input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={formData.deploy_token}
                    onChange={(e) => setFormData({ ...formData, deploy_token: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium text-sm text-foreground">Auto Deploy on Push</p>
                  <p className="text-xs text-muted-foreground">Automatically deploy when new commits are pushed</p>
                </div>
                <Switch
                  checked={formData.auto_deploy}
                  onCheckedChange={(v) => setFormData({ ...formData, auto_deploy: v })}
                />
              </div>
            </div>

            {/* Connect Button */}
            <Button 
              onClick={handleConnect}
              disabled={loading || !server}
              className="w-full bg-orange-gradient hover:opacity-90 text-white gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitBranch className="h-4 w-4" />
              )}
              Connect Repository
            </Button>

            {!server && (
              <p className="text-xs text-muted-foreground text-center">
                Select or create a server first to connect Git
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
