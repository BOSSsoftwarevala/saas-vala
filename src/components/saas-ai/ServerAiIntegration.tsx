import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  CheckCircle2,
  AlertTriangle,
  Upload,
  FolderArchive,
  Scan,
  Wrench,
  Play,
  ExternalLink
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

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
  { id: 'auto-subdomain', name: 'Auto Subdomain', description: 'project.saasvala.com', icon: Globe, enabled: true, status: 'active' },
  { id: 'custom-domain', name: 'Custom Domain', description: 'Your own domain', icon: Globe, enabled: false, status: 'pending' },
  { id: 'ssl-auto', name: 'SSL Auto', description: 'Let\'s Encrypt', icon: Lock, enabled: true, status: 'active' },
  { id: 'live-logs', name: 'Live Logs', description: 'Real-time streaming', icon: FileText, enabled: true, status: 'active' },
  { id: 'ai-error-fix', name: 'AI Error Fix', description: 'Auto fix errors', icon: Bug, enabled: true, status: 'active' },
  { id: 'ai-rollback', name: 'AI Rollback', description: 'Smart rollback', icon: RotateCcw, enabled: true, status: 'active' },
  { id: 'ai-restart', name: 'AI Restart', description: 'Auto restart on crash', icon: RefreshCw, enabled: true, status: 'active' }
];

interface UploadProgress {
  filename: string;
  progress: number;
  status: 'uploading' | 'extracting' | 'scanning' | 'fixing' | 'deploying' | 'complete' | 'error';
}

export function ServerAiIntegration() {
  const [features, setFeatures] = useState(serverFeatures);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [gitUrl, setGitUrl] = useState('');

  const toggleFeature = (id: string) => {
    setFeatures(prev => prev.map(f => 
      f.id === id ? { ...f, enabled: !f.enabled } : f
    ));
    toast.success('Feature updated');
  };

  const simulateUpload = async (filename: string) => {
    const stages: UploadProgress['status'][] = ['uploading', 'extracting', 'scanning', 'fixing', 'deploying', 'complete'];
    
    for (let i = 0; i < stages.length; i++) {
      setUploadProgress({
        filename,
        progress: ((i + 1) / stages.length) * 100,
        status: stages[i]
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    toast.success('Deployment complete!', {
      description: `${filename} has been deployed successfully`
    });
    
    setTimeout(() => {
      setUploadProgress(null);
      setIsUploadDialogOpen(false);
    }, 1000);
  };

  const handleFileUpload = () => {
    simulateUpload('project.zip');
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

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'uploading': return <Upload className="h-4 w-4 animate-pulse" />;
      case 'extracting': return <FolderArchive className="h-4 w-4 animate-pulse" />;
      case 'scanning': return <Scan className="h-4 w-4 animate-pulse" />;
      case 'fixing': return <Wrench className="h-4 w-4 animate-pulse" />;
      case 'deploying': return <Rocket className="h-4 w-4 animate-pulse" />;
      case 'complete': return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusLabel = (status: UploadProgress['status']) => {
    switch (status) {
      case 'uploading': return 'Uploading...';
      case 'extracting': return 'Auto Extract...';
      case 'scanning': return 'Auto Scan...';
      case 'fixing': return 'Auto Fix...';
      case 'deploying': return 'Auto Deploy...';
      case 'complete': return 'Complete!';
      case 'error': return 'Error';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
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

      {/* File Upload & Git Connect */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Deploy Source</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload files or connect Git repository
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">File Upload</Label>
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-2">
                Upload ZIP, PHP, APK, or Git Repo
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Unlimited size • Auto Extract • Auto Scan • Auto Fix • Auto Deploy
              </p>
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Upload className="h-4 w-4" />
                    Select Files
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Upload & Deploy</DialogTitle>
                  </DialogHeader>
                  {uploadProgress ? (
                    <div className="space-y-4 py-4">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(uploadProgress.status)}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{uploadProgress.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {getStatusLabel(uploadProgress.status)}
                          </p>
                        </div>
                      </div>
                      <Progress value={uploadProgress.progress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{Math.round(uploadProgress.progress)}%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 py-4">
                      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                        <FolderArchive className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-4">
                          Drop files here or click to browse
                        </p>
                        <Button onClick={handleFileUpload}>
                          Choose Files
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          Auto Extract
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          Auto Scan
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          Auto Fix
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          Auto Deploy
                        </div>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Git Connect Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Git Repository</Label>
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
