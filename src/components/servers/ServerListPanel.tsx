import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Server, 
  CreditCard, 
  Activity, 
  Globe, 
  Shield, 
  Settings,
  ChevronRight,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ServerItem {
  id: string;
  name: string;
  subdomain: string | null;
  status: string | null;
  server_type: string | null;
  agent_url: string | null;
  created_at: string | null;
}

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  live: { color: 'bg-success text-success-foreground', icon: CheckCircle2, label: 'Live' },
  deploying: { color: 'bg-warning text-warning-foreground', icon: Clock, label: 'Deploying' },
  stopped: { color: 'bg-muted text-muted-foreground', icon: WifiOff, label: 'Stopped' },
  failed: { color: 'bg-destructive text-destructive-foreground', icon: AlertTriangle, label: 'Failed' },
  suspended: { color: 'bg-destructive/70 text-destructive-foreground', icon: AlertTriangle, label: 'Suspended' },
};

const typeConfig: Record<string, { icon: typeof Server; label: string }> = {
  self: { icon: Server, label: 'Self-Hosted' },
  cloud: { icon: Shield, label: 'Cloud' },
  vercel: { icon: Globe, label: 'Vercel' },
  hybrid: { icon: Server, label: 'Hybrid' },
};

export function ServerListPanel() {
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('servers')
        .select('id, name, subdomain, status, server_type, agent_url, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServers(data || []);
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = (server: ServerItem) => {
    toast.info(`💳 Opening payment for: ${server.name}`, {
      description: 'Redirecting to wallet...'
    });
    // Could navigate to wallet or open payment modal
    window.location.href = '/wallet';
  };

  const handleManage = (server: ServerItem) => {
    toast.info(`⚙️ Managing: ${server.name}`);
  };

  if (loading) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            My Servers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            My Servers
            <Badge variant="secondary" className="ml-2 text-xs">
              {servers.length}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            View All <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {servers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Server className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No servers yet</p>
            <p className="text-xs">Add your first server to get started</p>
          </div>
        ) : (
          servers.map((server) => {
            const status = statusConfig[server.status || 'offline'] || statusConfig.offline;
            const type = typeConfig[server.server_type || 'vps'] || typeConfig.vps;
            const StatusIcon = status.icon;
            const TypeIcon = type.icon;

            return (
              <div
                key={server.id}
                className="group p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card/80 hover:border-primary/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  {/* Server Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                      server.agent_url ? 'bg-success/20' : 'bg-primary/20'
                    )}>
                      {server.agent_url ? (
                        <Wifi className="h-5 w-5 text-success" />
                      ) : (
                        <TypeIcon className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{server.name}</span>
                        <Badge className={cn('text-[10px] px-1.5 py-0', status.color)}>
                          <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {server.subdomain && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {server.subdomain}.saasvala.com
                          </span>
                        )}
                        <span className="text-muted-foreground/50">•</span>
                        <span>{type.label}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-8 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleManage(server)}
                    >
                      <Settings className="h-3 w-3" />
                      Manage
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-8 text-xs gap-1.5 bg-gradient-to-r from-primary to-cyan hover:from-primary/90 hover:to-cyan/90"
                      onClick={() => handlePayNow(server)}
                    >
                      <CreditCard className="h-3 w-3" />
                      Pay Now
                    </Button>
                  </div>
                </div>

                {/* Agent Status */}
                {server.agent_url && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <div className="flex items-center gap-2 text-xs">
                      <Activity className="h-3 w-3 text-success animate-pulse" />
                      <span className="text-success">VALA Agent Connected</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
