import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Server, 
  Rocket, 
  CheckCircle2, 
  ExternalLink,
  Loader2,
  Shield,
  Globe,
  Terminal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DeploymentStatus {
  step: string;
  progress: number;
  status: 'pending' | 'running' | 'complete' | 'error';
}

export function ServerDeploy() {
  const [serverIp, setServerIp] = useState('');
  const [sshUser, setSshUser] = useState('root');
  const [sshPassword, setSshPassword] = useState('');
  const [domain, setDomain] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployComplete, setDeployComplete] = useState(false);
  const [liveUrl, setLiveUrl] = useState('');
  const [steps, setSteps] = useState<DeploymentStatus[]>([]);

  const startDeploy = () => {
    if (!serverIp || !sshPassword) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsDeploying(true);
    setSteps([
      { step: 'Connecting to server...', progress: 0, status: 'running' },
      { step: 'Setting up environment...', progress: 0, status: 'pending' },
      { step: 'Uploading build files...', progress: 0, status: 'pending' },
      { step: 'Configuring server...', progress: 0, status: 'pending' },
      { step: 'Applying domain & SSL...', progress: 0, status: 'pending' },
    ]);

    // Simulate deployment steps
    let currentStep = 0;
    const stepInterval = setInterval(() => {
      if (currentStep >= 5) {
        clearInterval(stepInterval);
        setIsDeploying(false);
        setDeployComplete(true);
        setLiveUrl(domain || `http://${serverIp}`);
        toast.success('Deployment successful!', {
          description: 'Your application is now live'
        });
        return;
      }

      // Complete current step, start next
      setSteps(prev => prev.map((s, i) => {
        if (i === currentStep) {
          return { ...s, progress: 100, status: 'complete' };
        }
        if (i === currentStep + 1) {
          return { ...s, status: 'running' };
        }
        return s;
      }));

      // Animate progress for running step
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 20 + 10;
        if (progress >= 100) {
          clearInterval(progressInterval);
        } else {
          setSteps(prev => prev.map((s, i) => 
            i === currentStep + 1 ? { ...s, progress: Math.min(progress, 95) } : s
          ));
        }
      }, 300);

      currentStep++;
    }, 2000);
  };

  const resetDeploy = () => {
    setDeployComplete(false);
    setLiveUrl('');
    setSteps([]);
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-success/20 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-success" />
            </div>
            <div>
              <CardTitle className="text-lg">Client Server Deploy</CardTitle>
              <CardDescription className="text-xs">
                No developer required • Auto SSL
              </CardDescription>
            </div>
          </div>

          {deployComplete && (
            <Badge className="bg-success/20 text-success border-success/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              LIVE
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isDeploying && !deployComplete && (
          <div className="space-y-4">
            {/* Server IP */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Server IP *</Label>
              <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={serverIp}
                  onChange={(e) => setServerIp(e.target.value)}
                  placeholder="192.168.1.1"
                  className="pl-10 bg-muted/30 border-border"
                />
              </div>
            </div>

            {/* SSH Credentials */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">SSH User</Label>
                <Input
                  value={sshUser}
                  onChange={(e) => setSshUser(e.target.value)}
                  placeholder="root"
                  className="bg-muted/30 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">SSH Password *</Label>
                <Input
                  type="password"
                  value={sshPassword}
                  onChange={(e) => setSshPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-muted/30 border-border"
                />
              </div>
            </div>

            {/* Domain */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Domain (optional)</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="https://example.com"
                  className="pl-10 bg-muted/30 border-border"
                />
              </div>
            </div>

            <Button 
              onClick={startDeploy}
              className="w-full bg-success hover:bg-success/90 text-success-foreground gap-2"
            >
              <Rocket className="h-4 w-4" />
              Deploy to Server
            </Button>
          </div>
        )}

        {isDeploying && (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div 
                key={index}
                className={cn(
                  'p-3 rounded-lg border transition-colors',
                  step.status === 'complete' && 'bg-success/5 border-success/30',
                  step.status === 'running' && 'bg-secondary/5 border-secondary/30',
                  step.status === 'pending' && 'bg-muted/20 border-border opacity-50'
                )}
              >
                <div className="flex items-center gap-3">
                  {step.status === 'complete' && (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  )}
                  {step.status === 'running' && (
                    <Loader2 className="h-4 w-4 text-secondary animate-spin shrink-0" />
                  )}
                  {step.status === 'pending' && (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground shrink-0" />
                  )}
                  <p className={cn(
                    'text-sm',
                    step.status === 'complete' && 'text-success',
                    step.status === 'running' && 'text-foreground',
                    step.status === 'pending' && 'text-muted-foreground'
                  )}>
                    {step.step}
                  </p>
                </div>
                {step.status === 'running' && (
                  <Progress value={step.progress} className="h-1 mt-2" />
                )}
              </div>
            ))}
          </div>
        )}

        {deployComplete && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-success/10 border border-success/30">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-success" />
                <div>
                  <p className="text-sm font-medium text-success">Deployment Successful</p>
                  <p className="text-xs text-muted-foreground">SSL enabled • Auto-configured</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <Label className="text-xs text-muted-foreground">Live URL</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 text-sm bg-background px-3 py-2 rounded border border-border text-primary">
                  {liveUrl}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => window.open(liveUrl, '_blank')}
                  className="shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={resetDeploy}
                className="flex-1"
              >
                <Terminal className="h-4 w-4 mr-2" />
                New Deployment
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
