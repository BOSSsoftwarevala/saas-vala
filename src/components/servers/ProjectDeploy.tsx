import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Rocket, RotateCcw, History, CheckCircle2, XCircle, Loader2,
  ExternalLink, Clock, Copy, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { serversApi } from '@/lib/api';

interface DeploymentRow {
  id: string;
  server_id: string;
  status: string | null;
  commit_message: string | null;
  branch: string | null;
  duration_seconds: number | null;
  created_at: string | null;
  completed_at: string | null;
  deployed_url: string | null;
}

export function ProjectDeploy() {
  const [deployments, setDeployments] = useState<DeploymentRow[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [servers, setServers] = useState<{ id: string; name: string; subdomain: string | null }[]>([]);

  useEffect(() => {
    fetchDeployments();
    fetchServers();
  }, []);

  const fetchServers = async () => {
    const { data } = await supabase.from('servers').select('id, name, subdomain').order('created_at', { ascending: false });
    setServers(data || []);
  };

  const fetchDeployments = async () => {
    const { data, error } = await supabase
      .from('deployments')
      .select('id, server_id, status, commit_message, branch, duration_seconds, created_at, completed_at, deployed_url')
      .order('created_at', { ascending: false })
      .limit(10);
    if (!error) setDeployments(data || []);
  };

  const handleDeploy = async () => {
    if (servers.length === 0) {
      toast.error('No servers available');
      return;
    }
    setDeploying(true);
    setProgress(10);

    const serverId = servers[0].id;

    try {
      await serversApi.triggerDeploy(serverId);
      toast.success('Deployment triggered');

      const startedAt = Date.now();
      const timeoutMs = 30 * 60 * 1000;
      let completed = false;

      while (!completed) {
        const statusResp: any = await serversApi.deployStatus(serverId);
        const deployment = statusResp?.data;
        const status = String(deployment?.status || '').toLowerCase();

        if (status === 'queued') {
          setProgress((prev) => Math.max(prev, 20));
        } else if (status === 'building') {
          setProgress((prev) => Math.min(95, Math.max(prev + 8, 40)));
        } else if (status === 'success') {
          setProgress(100);
          await fetchDeployments();
          toast.success('Deployment successful!');
          completed = true;
          break;
        } else if (status === 'failed' || status === 'cancelled') {
          setProgress(100);
          await fetchDeployments();
          toast.error('Deployment failed');
          completed = true;
          break;
        }

        if (Date.now() - startedAt > timeoutMs) {
          toast.error('Deployment timed out after 30 minutes');
          completed = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to trigger deployment');
    } finally {
      setDeploying(false);
    }
  };

  const handleRedeploy = async () => {
    const latest = deployments[0];
    if (!latest?.server_id) {
      toast.error('No deployment available to redeploy');
      return;
    }

    setDeploying(true);
    setProgress(10);
    try {
      await serversApi.triggerDeploy(latest.server_id);
      toast.success('Redeploy queued');
      await fetchDeployments();
    } catch (error: any) {
      toast.error(error?.message || 'Redeploy failed');
    } finally {
      setDeploying(false);
    }
  };

  const handleRollback = async () => {
    const lastSuccess = deployments.find(d => d.status === 'success');
    if (!lastSuccess) {
      toast.error('No successful deployment to rollback to');
      return;
    }

    setDeploying(true);
    setProgress(10);
    try {
      await serversApi.triggerDeploy(lastSuccess.server_id);
      await supabase.from('deployments').update({ status: 'rolled_back' }).eq('id', deployments[0]?.id);
      toast.success('Rollback deployment queued');
      await fetchDeployments();
    } catch (error: any) {
      toast.error(error?.message || 'Rollback failed');
    } finally {
      setDeploying(false);
    }
  };

  const latestDeploy = deployments[0];
  const liveUrl = latestDeploy?.deployed_url || (servers[0]?.subdomain ? `https://${servers[0].subdomain}.saasvala.com` : null);

  const copyUrl = () => {
    if (liveUrl) {
      navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      toast.success('URL copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const statusMap: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
    success: { color: 'bg-success/20 text-success border-success/30', icon: CheckCircle2, label: 'Live' },
    building: { color: 'bg-warning/20 text-warning border-warning/30', icon: Clock, label: 'Building' },
    failed: { color: 'bg-destructive/20 text-destructive border-destructive/30', icon: XCircle, label: 'Failed' },
    rolled_back: { color: 'bg-muted text-muted-foreground border-border', icon: History, label: 'Rolled Back' },
    queued: { color: 'bg-muted text-muted-foreground border-border', icon: Clock, label: 'Queued' },
    cancelled: { color: 'bg-muted text-muted-foreground border-border', icon: XCircle, label: 'Cancelled' },
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg">Project Deployment</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              One-click deploy • Real deployment history from DB
            </CardDescription>
          </div>
          {latestDeploy && (
            <Badge variant="outline" className={cn(statusMap[latestDeploy.status || 'queued']?.color)}>
              {latestDeploy.status === 'success' && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {latestDeploy.status === 'building' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {latestDeploy.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
              {statusMap[latestDeploy.status || 'queued']?.label || latestDeploy.status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Live URL */}
        {liveUrl && (
          <div className="glass-card rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Your Live URL</p>
                <p className="text-sm font-medium text-foreground truncate">{liveUrl}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" className="border-border gap-2" onClick={copyUrl}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                </Button>
                <Button variant="outline" size="sm" className="border-border gap-2" asChild>
                  <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {deploying && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Deploying...</span>
              <span className="text-foreground font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <Button onClick={handleDeploy} disabled={deploying} className="bg-orange-gradient hover:opacity-90 text-white gap-2 h-11 sm:h-12">
            {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Deploy Now
          </Button>
          <Button variant="outline" className="border-border gap-2 h-11 sm:h-12" onClick={handleRedeploy} disabled={deploying}>
            <RotateCcw className="h-4 w-4" />
            Redeploy
          </Button>
          <Button variant="outline" className="border-border gap-2 h-11 sm:h-12" onClick={handleRollback} disabled={deploying}>
            <History className="h-4 w-4" />
            Rollback
          </Button>
        </div>

        {/* Recent Deployments from DB */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Recent Deployments ({deployments.length})</p>
          {deployments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No deployments yet</p>
          ) : (
            <div className="space-y-2">
              {deployments.slice(0, 5).map((deploy) => {
                const s = statusMap[deploy.status || 'queued'] || statusMap.queued;
                const SIcon = s.icon;
                return (
                  <div key={deploy.id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className={cn('h-6 w-6 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shrink-0', 
                        deploy.status === 'success' ? 'bg-success/20' : deploy.status === 'failed' ? 'bg-destructive/20' : 'bg-muted')}>
                        <SIcon className={cn('h-3 w-3 sm:h-4 sm:w-4',
                          deploy.status === 'success' ? 'text-success' : deploy.status === 'failed' ? 'text-destructive' : 'text-muted-foreground')} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                          {deploy.commit_message || 'Deployment'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {timeAgo(deploy.created_at)} {deploy.duration_seconds ? `• ${deploy.duration_seconds}s` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn('text-xs shrink-0', s.color)}>
                      {s.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}