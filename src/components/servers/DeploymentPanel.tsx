import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Rocket, 
  Loader2, 
  Play,
  RotateCcw,
  Square,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { Server, Deployment } from '@/hooks/useServerManager';

interface DeploymentPanelProps {
  servers: Server[];
  deployments: Deployment[];
  products: { id: string; name: string }[];
  onDeploy: (serverId: string, branch?: string) => Promise<void>;
  onRollback: (deploymentId: string, serverId: string) => Promise<void>;
  onStop: (deploymentId: string) => Promise<void>;
}

const BUILD_TYPES = [
  { value: 'web', label: 'Web Application' },
  { value: 'api', label: 'API Server' },
  { value: 'apk', label: 'APK Build' },
];

export function DeploymentPanel({ 
  servers, 
  deployments, 
  products,
  onDeploy,
  onRollback,
  onStop
}: DeploymentPanelProps) {
  const [loading, setLoading] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [buildType, setBuildType] = useState('web');
  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [outputDir, setOutputDir] = useState('dist');
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([
    { key: '', value: '' }
  ]);

  const serverDeployments = selectedServerId 
    ? deployments.filter(d => d.server_id === selectedServerId).slice(0, 10)
    : deployments.slice(0, 10);

  const activeDeployment = serverDeployments.find(
    d => d.status === 'queued' || d.status === 'building'
  );

  const handleDeploy = async () => {
    if (!selectedServerId) {
      toast.error('Select a server first');
      return;
    }

    setLoading(true);
    try {
      await onDeploy(selectedServerId);
      toast.success('Deployment started');
    } catch {
      toast.error('Failed to start deployment');
    }
    setLoading(false);
  };

  const handleRedeploy = async () => {
    const lastSuccessful = serverDeployments.find(d => d.status === 'success');
    if (!lastSuccessful) {
      toast.error('No successful deployment to redeploy');
      return;
    }

    setLoading(true);
    try {
      await onDeploy(lastSuccessful.server_id);
      toast.success('Redeployment started');
    } catch {
      toast.error('Failed to redeploy');
    }
    setLoading(false);
  };

  const handleRollback = async () => {
    const lastSuccessful = serverDeployments.find(d => d.status === 'success');
    if (!lastSuccessful || !selectedServerId) {
      toast.error('No deployment to rollback to');
      return;
    }

    setLoading(true);
    try {
      await onRollback(lastSuccessful.id, selectedServerId);
      toast.success('Rollback initiated');
    } catch {
      toast.error('Failed to rollback');
    }
    setLoading(false);
  };

  const handleStop = async () => {
    if (!activeDeployment) return;

    setLoading(true);
    try {
      await onStop(activeDeployment.id);
      toast.success('Deployment stopped');
    } catch {
      toast.error('Failed to stop deployment');
    }
    setLoading(false);
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  const getStatusIcon = (status: Deployment['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'queued':
      case 'building':
        return <Loader2 className="h-4 w-4 animate-spin text-accent-foreground" />;
      case 'cancelled':
      case 'rolled_back':
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: Deployment['status']) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      success: 'default',
      failed: 'destructive',
      queued: 'secondary',
      building: 'secondary',
      cancelled: 'outline',
      rolled_back: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'secondary'} className="text-xs">
        {status}
      </Badge>
    );
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Rocket className="h-5 w-5 text-primary" />
          Deployment Manager
          {activeDeployment && (
            <Badge variant="secondary" className="ml-auto gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Deploying...
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Deploy Config */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Select Server *</Label>
            <Select value={selectedServerId} onValueChange={setSelectedServerId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose server" />
              </SelectTrigger>
              <SelectContent>
                {servers.filter(s => s.status !== 'suspended').map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Select Product</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose product (optional)" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Build Type</Label>
            <Select value={buildType} onValueChange={setBuildType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUILD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Build Command</Label>
            <Input 
              value={buildCommand}
              onChange={(e) => setBuildCommand(e.target.value)}
              placeholder="npm run build"
            />
          </div>
          <div className="space-y-2">
            <Label>Output Directory</Label>
            <Input 
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder="dist"
            />
          </div>
        </div>

        {/* Environment Variables */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Environment Variables</Label>
            <Button variant="ghost" size="sm" onClick={addEnvVar} className="gap-1 h-7 text-xs">
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {envVars.map((env, index) => (
              <div key={index} className="flex gap-2">
                <Input 
                  placeholder="KEY"
                  value={env.key}
                  onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
                <Input 
                  placeholder="value"
                  value={env.value}
                  onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
                {envVars.length > 1 && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeEnvVar(index)}
                    className="h-10 w-10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Deploy Actions */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
          <Button 
            onClick={handleDeploy}
            disabled={loading || !selectedServerId || !!activeDeployment}
            className="bg-orange-gradient hover:opacity-90 text-white gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Deploy Now
          </Button>

          <Button 
            variant="outline"
            onClick={handleRedeploy}
            disabled={loading || !selectedServerId || !!activeDeployment}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Redeploy
          </Button>

          <Button 
            variant="outline"
            onClick={handleRollback}
            disabled={loading || !selectedServerId || !!activeDeployment}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Rollback
          </Button>

          {activeDeployment && (
            <Button 
              variant="destructive"
              onClick={handleStop}
              disabled={loading}
              className="gap-2 ml-auto"
            >
              <Square className="h-4 w-4" />
              Stop Deploy
            </Button>
          )}
        </div>

        {/* Recent Deployments */}
        {serverDeployments.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border">
            <Label className="text-muted-foreground">Recent Deployments</Label>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {serverDeployments.map((dep) => (
                  <div 
                    key={dep.id} 
                    className="p-3 rounded-lg border border-border bg-muted/30 flex items-center gap-3"
                  >
                    {getStatusIcon(dep.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {dep.commit_message || 'Deployment'}
                        </span>
                        {getStatusBadge(dep.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {dep.branch} • {formatDistanceToNow(new Date(dep.created_at), { addSuffix: true })}
                        {dep.duration_seconds && ` • ${dep.duration_seconds}s`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Failed Deploy Error */}
        {serverDeployments[0]?.status === 'failed' && serverDeployments[0]?.build_logs && (
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
            <p className="text-xs font-medium text-destructive mb-1">Error Log:</p>
            <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {serverDeployments[0].build_logs}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
