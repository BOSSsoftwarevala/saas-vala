import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Rocket, 
  RotateCcw, 
  Play,
  Clock,
  Check,
  X,
  GitBranch,
  ExternalLink,
  Server
} from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DeploymentsPanelProps {
  projectId: string | null;
}

interface Deployment {
  id: string;
  status: 'live' | 'building' | 'failed' | 'rolled-back';
  branch: string;
  commit: string;
  message: string;
  deployedAt: string;
  runtime: string;
  url: string;
}

const mockDeployments: Deployment[] = [
  {
    id: 'deploy-001',
    status: 'live',
    branch: 'main',
    commit: 'a1b2c3d',
    message: 'feat: add payment integration',
    deployedAt: '10 minutes ago',
    runtime: 'Node.js 18',
    url: 'https://demo-app.lovable.app'
  },
  {
    id: 'deploy-002',
    status: 'rolled-back',
    branch: 'main',
    commit: 'e5f6g7h',
    message: 'fix: database connection issue',
    deployedAt: '2 hours ago',
    runtime: 'Node.js 18',
    url: 'https://demo-app.lovable.app'
  },
  {
    id: 'deploy-003',
    status: 'failed',
    branch: 'dev',
    commit: 'i8j9k0l',
    message: 'chore: update dependencies',
    deployedAt: '5 hours ago',
    runtime: 'Node.js 18',
    url: ''
  },
];

const runtimes = [
  { id: 'node-18', name: 'Node.js 18', icon: '🟢' },
  { id: 'node-20', name: 'Node.js 20', icon: '🟢' },
  { id: 'php-82', name: 'PHP 8.2', icon: '🐘' },
  { id: 'php-83', name: 'PHP 8.3', icon: '🐘' },
  { id: 'python-311', name: 'Python 3.11', icon: '🐍' },
  { id: 'python-312', name: 'Python 3.12', icon: '🐍' },
];

export function DeploymentsPanel({ projectId: _projectId }: DeploymentsPanelProps) {
  const [deployments] = useState<Deployment[]>(mockDeployments);
  const [selectedRuntime, setSelectedRuntime] = useState('node-18');
  const [isDeploying, setIsDeploying] = useState(false);

  const handleRedeploy = async () => {
    setIsDeploying(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsDeploying(false);
    toast.success('Deployment triggered successfully!');
  };

  const handleRollback = (_deployId: string) => {
    toast.success('Rollback initiated to previous deployment');
  };

  const getStatusIcon = (status: Deployment['status']) => {
    switch (status) {
      case 'live': return <Check className="h-4 w-4 text-success" />;
      case 'building': return <Clock className="h-4 w-4 text-warning animate-pulse" />;
      case 'failed': return <X className="h-4 w-4 text-destructive" />;
      case 'rolled-back': return <RotateCcw className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: Deployment['status']) => {
    switch (status) {
      case 'live': return <Badge className="bg-success/20 text-success border-success/30">Live</Badge>;
      case 'building': return <Badge className="bg-warning/20 text-warning border-warning/30">Building</Badge>;
      case 'failed': return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Failed</Badge>;
      case 'rolled-back': return <Badge variant="secondary">Rolled Back</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/20">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Quick Deploy</CardTitle>
                <CardDescription>Deploy your project with one click</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Runtime Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Runtime</label>
              <Select value={selectedRuntime} onValueChange={setSelectedRuntime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {runtimes.map(runtime => (
                    <SelectItem key={runtime.id} value={runtime.id}>
                      <div className="flex items-center gap-2">
                        <span>{runtime.icon}</span>
                        {runtime.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deploy Button */}
            <div className="flex items-end">
              <Button 
                onClick={handleRedeploy} 
                disabled={isDeploying}
                className="w-full gap-2"
                size="lg"
              >
                {isDeploying ? (
                  <><Clock className="h-4 w-4 animate-spin" /> Deploying...</>
                ) : (
                  <><Play className="h-4 w-4" /> Deploy Now</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deployment History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-foreground">Deployment History</h3>
          <Badge variant="outline">{deployments.length} deployments</Badge>
        </div>

        {deployments.map((deploy) => (
          <Card key={deploy.id} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(deploy.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-foreground">{deploy.commit}</span>
                      <Badge variant="outline" className="text-xs gap-1">
                        <GitBranch className="h-3 w-3" />
                        {deploy.branch}
                      </Badge>
                      {getStatusBadge(deploy.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{deploy.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Server className="h-3 w-3" />
                        {deploy.runtime}
                      </span>
                      <span>{deploy.deployedAt}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {deploy.status === 'live' && deploy.url && (
                    <Button variant="outline" size="sm" asChild className="gap-1">
                      <a href={deploy.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                        Visit
                      </a>
                    </Button>
                  )}
                  {deploy.status !== 'live' && deploy.status !== 'building' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleRollback(deploy.id)}
                      className="gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Rollback
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
