import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  GitBranch, 
  Github, 
  Check, 
  AlertCircle, 
  RefreshCw,
  Link,
  Unlink,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';

interface GitConnectPanelProps {
  projectId: string | null;
}

export function GitConnectPanel({ projectId: _projectId }: GitConnectPanelProps) {
  const [isConnected, setIsConnected] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const mockRepo = {
    name: 'softwarevala/demo-saas-app',
    url: 'https://github.com/softwarevala/demo-saas-app',
    branches: ['main', 'dev', 'staging', 'feature/payment'],
    lastCommit: {
      message: 'feat: add payment integration',
      author: 'devuser',
      time: '2 hours ago',
      sha: 'a1b2c3d'
    },
    status: 'connected',
    error: null
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsConnected(true);
    setIsConnecting(false);
    toast.success('GitHub repository connected!');
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    toast.success('Repository disconnected');
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isConnected ? 'bg-success/20' : 'bg-muted'}`}>
                <Github className={`h-5 w-5 ${isConnected ? 'text-success' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <CardTitle className="text-lg">GitHub Connection</CardTitle>
                <CardDescription>
                  {isConnected ? mockRepo.name : 'Connect your repository'}
                </CardDescription>
              </div>
            </div>
            <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1">
              {isConnected ? (
                <><Check className="h-3 w-3" /> Connected</>
              ) : (
                <><AlertCircle className="h-3 w-3" /> Not Connected</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <>
              {/* Repo Info */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Repository</span>
                  <a 
                    href={mockRepo.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    {mockRepo.name}
                    <Link className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Commit</span>
                  <span className="text-sm text-foreground font-mono">{mockRepo.lastCommit.sha}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Message</span>
                  <span className="text-sm text-foreground truncate max-w-[200px]">{mockRepo.lastCommit.message}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Author</span>
                  <span className="text-sm text-foreground">@{mockRepo.lastCommit.author} • {mockRepo.lastCommit.time}</span>
                </div>
              </div>

              <Button variant="destructive" size="sm" onClick={handleDisconnect} className="gap-2">
                <Unlink className="h-4 w-4" />
                Disconnect Repository
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <Label>Repository URL</Label>
                <Input placeholder="https://github.com/username/repo" />
              </div>
              <Button 
                onClick={handleConnect} 
                disabled={isConnecting}
                className="gap-2"
              >
                {isConnecting ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Connecting...</>
                ) : (
                  <><Github className="h-4 w-4" /> Connect with GitHub</>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Branch Selection */}
      {isConnected && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/20">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Branch Selection</CardTitle>
                <CardDescription>Choose which branch to deploy</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Deploy Branch</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mockRepo.branches.map(branch => (
                    <SelectItem key={branch} value={branch}>
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3 w-3" />
                        {branch}
                        {branch === 'main' && (
                          <Badge variant="secondary" className="text-[10px] h-4">default</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="cursor-pointer">Auto-deploy on push</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatically deploy when code is pushed to {selectedBranch}
                </p>
              </div>
              <Switch checked={autoDeploy} onCheckedChange={setAutoDeploy} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permission Lock */}
      {isConnected && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-warning/20">
                <Lock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <CardTitle className="text-lg">Permission Lock</CardTitle>
                <CardDescription>Restrict who can deploy this project</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
              <div className="space-y-1">
                <Label className="cursor-pointer">Super Admin Only</Label>
                <p className="text-xs text-muted-foreground">
                  Only super admins can trigger deployments
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
