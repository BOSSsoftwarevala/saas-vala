import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Upload, 
  Rocket, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Server,
  Shield,
  Wrench,
  TestTube,
  ChevronDown,
  ChevronRight,
  FileArchive,
  Eye,
  EyeOff,
  Database,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAutoDeploy, DeploymentStage, HostingCredentials } from '@/hooks/useAutoDeploy';

export function OneClickDeploy() {
  const [isDragging, setIsDragging] = useState(false);
  const [showHosting, setShowHosting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hostingCreds, setHostingCreds] = useState<Partial<HostingCredentials>>({
    type: 'ftp',
    port: 21,
  });

  const {
    isProcessing,
    currentStage,
    stages,
    result,
    progress,
    uploadAndDeploy,
    reset,
  } = useAutoDeploy();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      const creds = showHosting && hostingCreds.host ? hostingCreds as HostingCredentials : undefined;
      uploadAndDeploy(file, creds);
    }
  }, [uploadAndDeploy, showHosting, hostingCreds]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const creds = showHosting && hostingCreds.host ? hostingCreds as HostingCredentials : undefined;
      uploadAndDeploy(file, creds);
    }
    e.target.value = '';
  }, [uploadAndDeploy, showHosting, hostingCreds]);

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'upload': return Upload;
      case 'download': return Upload;
      case 'analyze': return Eye;
      case 'ai-scan': return Shield;
      case 'auto-fix': return Wrench;
      case 'dependencies': return FileArchive;
      case 'deploy': return Rocket;
      case 'deploy-connect': return Server;
      case 'deploy-folders': return FileArchive;
      case 'deploy-db': return Database;
      case 'deploy-upload': return Upload;
      case 'deploy-env': return Globe;
      case 'test': return TestTube;
      default: return Loader2;
    }
  };

  const getStatusColor = (status: DeploymentStage['status']) => {
    switch (status) {
      case 'success': return 'text-success';
      case 'failed': return 'text-destructive';
      case 'running': return 'text-primary animate-pulse';
      case 'skipped': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: DeploymentStage['status']) => {
    switch (status) {
      case 'success': return CheckCircle2;
      case 'failed': return XCircle;
      case 'running': return Loader2;
      default: return ChevronRight;
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Upload Card */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">One-Click Deploy</CardTitle>
              <p className="text-xs text-muted-foreground">
                Upload → Auto-Fix → Deploy → Done
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{currentStage || 'Starting...'}</span>
                <span className="text-primary font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Drop Zone - Only show when not processing and no result */}
          {!isProcessing && !result && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
                isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              )}
            >
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".zip,.apk,.php,.js,.jsx,.ts,.tsx,.html,.css,.py"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-3">
                <div className={cn(
                  'h-16 w-16 rounded-2xl flex items-center justify-center transition-colors',
                  isDragging ? 'bg-primary/20' : 'bg-muted'
                )}>
                  <Upload className={cn(
                    'h-8 w-8 transition-colors',
                    isDragging ? 'text-primary' : 'text-muted-foreground'
                  )} />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    Drop source code here
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ZIP • APK • PHP • JS • Python | Any size
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Optional Hosting Credentials */}
          {!isProcessing && !result && (
            <Collapsible open={showHosting} onOpenChange={setShowHosting}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    Add hosting credentials (optional)
                  </span>
                  {showHosting ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Host (e.g., ftp.example.com)"
                    value={hostingCreds.host || ''}
                    onChange={(e) => setHostingCreds(prev => ({ ...prev, host: e.target.value }))}
                  />
                  <Input
                    placeholder="Port"
                    type="number"
                    value={hostingCreds.port || 21}
                    onChange={(e) => setHostingCreds(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Username"
                    value={hostingCreds.username || ''}
                    onChange={(e) => setHostingCreds(prev => ({ ...prev, username: e.target.value }))}
                  />
                  <div className="relative">
                    <Input
                      placeholder="Password"
                      type={showPassword ? 'text' : 'password'}
                      value={hostingCreds.password || ''}
                      onChange={(e) => setHostingCreds(prev => ({ ...prev, password: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-7 w-7"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Input
                  placeholder="Path (e.g., /public_html)"
                  value={hostingCreds.path || ''}
                  onChange={(e) => setHostingCreds(prev => ({ ...prev, path: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="DB Host"
                    value={hostingCreds.dbHost || ''}
                    onChange={(e) => setHostingCreds(prev => ({ ...prev, dbHost: e.target.value }))}
                  />
                  <Input
                    placeholder="DB Name"
                    value={hostingCreds.dbName || ''}
                    onChange={(e) => setHostingCreds(prev => ({ ...prev, dbName: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="DB Username"
                    value={hostingCreds.dbUser || ''}
                    onChange={(e) => setHostingCreds(prev => ({ ...prev, dbUser: e.target.value }))}
                  />
                  <Input
                    placeholder="DB Password"
                    type="password"
                    value={hostingCreds.dbPassword || ''}
                    onChange={(e) => setHostingCreds(prev => ({ ...prev, dbPassword: e.target.value }))}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Stages List */}
          {stages.length > 0 && (
            <div className="space-y-2">
              {stages.map((stage, idx) => {
                const StageIcon = getStageIcon(stage.stage);
                const StatusIcon = getStatusIcon(stage.status);
                
                return (
                  <div
                    key={`${stage.stage}-${idx}`}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg transition-colors',
                      stage.status === 'running' ? 'bg-primary/5' : 'bg-muted/30'
                    )}
                  >
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', getStatusColor(stage.status))}>
                      <StageIcon className={cn('h-4 w-4', stage.status === 'running' && 'animate-spin')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{stage.message}</p>
                      {stage.details && (
                        <p className="text-xs text-muted-foreground truncate">{stage.details}</p>
                      )}
                    </div>
                    <StatusIcon className={cn('h-4 w-4 shrink-0', getStatusColor(stage.status), stage.status === 'running' && 'animate-spin')} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Result Summary */}
          {result && (
            <div className="space-y-4 pt-4 border-t border-border">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <Badge 
                  variant={result.success ? 'default' : 'destructive'}
                  className={cn(
                    'text-sm px-3 py-1',
                    result.success ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                  )}
                >
                  {result.success ? '✓ Deployment Successful' : '✗ Deployment Failed'}
                </Badge>
                <Button variant="outline" size="sm" onClick={reset}>
                  New Deploy
                </Button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">Framework</p>
                  <p className="font-medium">{result.analysis.framework}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">Language</p>
                  <p className="font-medium">{result.analysis.language}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">Fixes Applied</p>
                  <p className="font-medium text-success">{result.fixes.applied}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">Security Issues</p>
                  <p className={cn('font-medium', result.security.remaining.length > 0 ? 'text-warning' : 'text-success')}>
                    {result.security.remaining.length > 0 ? `${result.security.remaining.length} remaining` : 'None'}
                  </p>
                </div>
              </div>

              {/* Test Results */}
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-2">Test Results</p>
                <div className="space-y-1">
                  {result.tests.details.map((test, idx) => (
                    <p key={idx} className={cn(
                      'text-sm',
                      test.startsWith('✓') ? 'text-success' : 'text-destructive'
                    )}>
                      {test}
                    </p>
                  ))}
                </div>
              </div>

              {/* Deployment URL */}
              {result.deployment.url && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Deployed URL</p>
                  <a 
                    href={result.deployment.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    {result.deployment.url}
                  </a>
                </div>
              )}

              {/* Fixes Applied */}
              {result.fixes.details.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-2">Fixes Applied</p>
                  <div className="space-y-1">
                    {result.fixes.details.map((fix, idx) => (
                      <p key={idx} className="text-sm text-success">✓ {fix}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
