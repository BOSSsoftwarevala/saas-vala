import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Rocket, 
  RotateCcw, 
  History, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  ExternalLink,
  Clock,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type DeployStatus = 'idle' | 'building' | 'deploying' | 'success' | 'failed';

interface Deployment {
  id: string;
  status: 'live' | 'failed' | 'rolled-back';
  timestamp: string;
  message: string;
}

export function ProjectDeploy() {
  const [status, setStatus] = useState<DeployStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  const subdomain = 'my-project.saasvala.com';
  const lastDeploy = '2 hours ago';

  const deployments: Deployment[] = [
    { id: 'd1', status: 'live', timestamp: '2 hours ago', message: 'Latest deployment' },
    { id: 'd2', status: 'rolled-back', timestamp: '5 hours ago', message: 'Previous version' },
    { id: 'd3', status: 'failed', timestamp: '1 day ago', message: 'Build error' },
  ];

  const handleDeploy = () => {
    setStatus('building');
    setProgress(0);
    
    const buildInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 50) {
          clearInterval(buildInterval);
          setStatus('deploying');
          
          const deployInterval = setInterval(() => {
            setProgress(prev2 => {
              if (prev2 >= 100) {
                clearInterval(deployInterval);
                setStatus('success');
                toast.success('Deployment successful!', {
                  description: 'Your project is now live.',
                });
                return 100;
              }
              return prev2 + 10;
            });
          }, 200);
          
          return 50;
        }
        return prev + 5;
      });
    }, 150);
  };

  const handleRedeploy = () => {
    toast.info('Redeploying...', { description: 'Using the same configuration.' });
    handleDeploy();
  };

  const handleRollback = () => {
    toast.success('Rolled back!', { description: 'Restored to previous version.' });
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(`https://${subdomain}`);
    setCopied(true);
    toast.success('URL copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const isDeploying = status === 'building' || status === 'deploying';

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg">Project Deployment</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              One-click deploy • Auto rollback on failure
            </CardDescription>
          </div>
          <Badge 
            variant="outline" 
            className={cn(
              status === 'success' && 'bg-success/20 text-success border-success/30',
              status === 'failed' && 'bg-destructive/20 text-destructive border-destructive/30',
              isDeploying && 'bg-warning/20 text-warning border-warning/30',
              status === 'idle' && 'bg-muted text-muted-foreground border-border'
            )}
          >
            {status === 'success' && <><CheckCircle2 className="h-3 w-3 mr-1" /> Live</>}
            {status === 'failed' && <><XCircle className="h-3 w-3 mr-1" /> Failed</>}
            {isDeploying && <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {status === 'building' ? 'Building' : 'Deploying'}</>}
            {status === 'idle' && <><Clock className="h-3 w-3 mr-1" /> Last: {lastDeploy}</>}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Live URL */}
        <div className="glass-card rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-1">Your Live URL</p>
              <p className="text-sm font-medium text-foreground truncate">https://{subdomain}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="border-border gap-2" onClick={copyUrl}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </Button>
              <Button variant="outline" size="sm" className="border-border gap-2" asChild>
                <a href={`https://${subdomain}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  <span className="hidden sm:inline">Visit</span>
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Bar (when deploying) */}
        {isDeploying && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {status === 'building' ? 'Building your project...' : 'Deploying to servers...'}
              </span>
              <span className="text-foreground font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <Button 
            onClick={handleDeploy}
            disabled={isDeploying}
            className="bg-orange-gradient hover:opacity-90 text-white gap-2 h-11 sm:h-12"
          >
            {isDeploying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            Deploy Now
          </Button>
          <Button 
            variant="outline" 
            className="border-border gap-2 h-11 sm:h-12"
            onClick={handleRedeploy}
            disabled={isDeploying}
          >
            <RotateCcw className="h-4 w-4" />
            Redeploy
          </Button>
          <Button 
            variant="outline" 
            className="border-border gap-2 h-11 sm:h-12"
            onClick={handleRollback}
            disabled={isDeploying}
          >
            <History className="h-4 w-4" />
            Rollback
          </Button>
        </div>

        {/* Recent Deployments */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Recent Deployments</p>
          <div className="space-y-2">
            {deployments.map((deploy) => (
              <div 
                key={deploy.id}
                className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className={cn(
                    'h-6 w-6 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shrink-0',
                    deploy.status === 'live' && 'bg-success/20',
                    deploy.status === 'failed' && 'bg-destructive/20',
                    deploy.status === 'rolled-back' && 'bg-muted'
                  )}>
                    {deploy.status === 'live' && <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-success" />}
                    {deploy.status === 'failed' && <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />}
                    {deploy.status === 'rolled-back' && <History className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate">{deploy.message}</p>
                    <p className="text-xs text-muted-foreground">{deploy.timestamp}</p>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn(
                    'text-xs shrink-0',
                    deploy.status === 'live' && 'bg-success/20 text-success border-success/30',
                    deploy.status === 'failed' && 'bg-destructive/20 text-destructive border-destructive/30',
                    deploy.status === 'rolled-back' && 'bg-muted text-muted-foreground border-border'
                  )}
                >
                  {deploy.status === 'live' ? 'Live' : deploy.status === 'failed' ? 'Failed' : 'Old'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
