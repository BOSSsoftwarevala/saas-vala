import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  GitBranch, 
  Hammer, 
  Rocket, 
  Globe, 
  Lock, 
  FileText, 
  Bug, 
  RotateCcw, 
  RefreshCw,
  Play,
  ExternalLink
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { OneClickDeploy } from './OneClickDeploy';
import { ServerDeploy } from './ServerDeploy';

interface FeatureToggle {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  status: 'active' | 'pending' | 'error';
}

const serverFeatures: FeatureToggle[] = [
  { id: 'git-connect', name: 'Git Connect', description: 'GitHub/GitLab/Bitbucket', icon: GitBranch, enabled: true, status: 'active' },
  { id: 'auto-build', name: 'Auto Build', description: 'On push to main', icon: Hammer, enabled: true, status: 'active' },
  { id: 'auto-deploy', name: 'Auto Deploy', description: 'After successful build', icon: Rocket, enabled: true, status: 'active' },
  { id: 'auto-subdomain', name: 'Auto Subdomain', description: 'project.lovable.app', icon: Globe, enabled: true, status: 'active' },
  { id: 'custom-domain', name: 'Custom Domain', description: 'Your own domain', icon: Globe, enabled: false, status: 'pending' },
  { id: 'ssl-auto', name: 'SSL Auto', description: 'Let\'s Encrypt', icon: Lock, enabled: true, status: 'active' },
  { id: 'live-logs', name: 'Live Logs', description: 'Real-time streaming', icon: FileText, enabled: true, status: 'active' },
  { id: 'ai-error-fix', name: 'AI Error Fix', description: 'Auto fix errors', icon: Bug, enabled: true, status: 'active' },
  { id: 'ai-rollback', name: 'AI Rollback', description: 'Smart rollback', icon: RotateCcw, enabled: true, status: 'active' },
  { id: 'ai-restart', name: 'AI Restart', description: 'Auto restart on crash', icon: RefreshCw, enabled: true, status: 'active' }
];

export function ServerAiIntegration() {
  const [features, setFeatures] = useState(serverFeatures);
  const [gitUrl, setGitUrl] = useState('');

  const toggleFeature = (id: string) => {
    setFeatures(prev => prev.map(f => 
      f.id === id ? { ...f, enabled: !f.enabled } : f
    ));
    toast.success('Feature updated');
  };

  const handleGitConnect = () => {
    if (!gitUrl) {
      toast.error('Please enter a Git repository URL');
      return;
    }
    toast.success('Connecting to repository...', {
      description: gitUrl
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* One-Click Deploy - THE MAIN FEATURE */}
      <div className="lg:col-span-2">
        <OneClickDeploy />
      </div>

      {/* Client Server Deploy (FTP/SSH) */}
      <div className="lg:col-span-2">
        <ServerDeploy />
      </div>

      {/* Server + AI Features */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Server + AI Integration</CardTitle>
          <p className="text-sm text-muted-foreground">
            One-click operations with AI-powered automation
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((feature) => (
              <div
                key={feature.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    feature.enabled 
                      ? 'bg-primary/10' 
                      : 'bg-muted'
                  }`}>
                    <feature.icon className={`h-4 w-4 ${
                      feature.enabled ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{feature.name}</p>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {feature.enabled && (
                    <Badge 
                      variant="outline" 
                      className={
                        feature.status === 'active' ? 'bg-success/10 text-success border-success/20' :
                        feature.status === 'error' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                        'bg-warning/10 text-warning border-warning/20'
                      }
                    >
                      {feature.status}
                    </Badge>
                  )}
                  <Switch
                    checked={feature.enabled}
                    onCheckedChange={() => toggleFeature(feature.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Git Connect */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Git Repository</CardTitle>
          <p className="text-sm text-muted-foreground">
            Connect Git for continuous deployment
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Git Connect Section */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="https://github.com/username/repo.git"
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleGitConnect} className="gap-2">
                <GitBranch className="h-4 w-4" />
                Connect
              </Button>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="gap-1">
                <img src="https://github.githubassets.com/favicons/favicon.svg" alt="GitHub" className="h-3 w-3" />
                GitHub
              </Badge>
              <Badge variant="outline" className="gap-1">
                <img src="https://gitlab.com/assets/favicon-72a2cad5025aa931d6ea56c3201d1f18e68a8571bfddbd7d95d82ff5d2e9a24c.png" alt="GitLab" className="h-3 w-3" />
                GitLab
              </Badge>
              <Badge variant="outline" className="gap-1">
                <img src="https://bitbucket.org/favicon.ico" alt="Bitbucket" className="h-3 w-3" />
                Bitbucket
              </Badge>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t border-border">
            <Label className="text-sm font-medium mb-3 block">Quick Actions</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Play className="h-4 w-4" />
                Deploy Now
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                View Logs
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Rollback
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Open Site
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
