import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Server,
  Activity,
  Globe,
  Shield,
  Settings,
  ChevronRight,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Loader2,
  Trash2,
  RefreshCw,
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
  agent_token: string | null;
  ip_address: string | null;
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
  digitalocean: { icon: Globe, label: 'DigitalOcean' },
  vps: { icon: Server, label: 'VPS' },
};

export function ServerListPanel() {
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<ServerItem | null>(null);

  const [newServer, setNewServer] = useState({
    name: '',
    server_type: 'self',
    agent_url: '',
    agent_token: '',
    ip_address: '',
  });

  const [editServer, setEditServer] = useState<{
    name: string;
    server_type: string;
    agent_url: string;
    agent_token: string;
    ip_address: string;
    status: 'live' | 'stopped' | 'deploying' | 'failed' | 'suspended';
  }>({
    name: '',
    server_type: 'self',
    agent_url: '',
    agent_token: '',
    ip_address: '',
    status: 'stopped',
  });

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('servers')
        .select('id, name, subdomain, status, server_type, agent_url, agent_token, ip_address, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServers(data || []);
    } catch (err) {
      console.error('Failed to fetch servers:', err);
      toast.error('Failed to fetch servers');
    } finally {
      setLoading(false);
    }
  };

  const verifyServer = async (server: ServerItem) => {
    setVerifyingId(server.id);
    try {
      const { data, error } = await supabase.functions.invoke('server-agent', {
        body: { action: 'verify', serverId: server.id },
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Verification failed');
      }

      toast.success(`${server.name} is ONLINE`);
      await fetchServers();
    } catch (err: any) {
      toast.error(`Verification failed: ${err.message || 'Unknown error'}`);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleAddServer = async () => {
    if (!newServer.name.trim()) {
      toast.error('Server name required');
      return;
    }

    setAdding(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      // If agent credentials are provided, do backend registration+verification first.
      if (newServer.agent_url.trim() && newServer.agent_token.trim()) {
        const { data, error } = await supabase.functions.invoke('server-agent', {
          body: {
            action: 'register',
            params: {
              name: newServer.name,
              ip_address: newServer.ip_address || null,
              agent_url: newServer.agent_url,
              agent_token: newServer.agent_token,
            },
          },
        });

        if (error || !data?.success) {
          throw new Error(error?.message || data?.error || 'Agent registration failed');
        }

        toast.success(`✅ ${newServer.name} registered and verified`);
      } else {
        const subdomain =
          newServer.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

        const { error } = await supabase.from('servers').insert({
          name: newServer.name,
          subdomain,
          server_type: newServer.server_type,
          ip_address: newServer.ip_address || null,
          agent_url: null,
          agent_token: null,
          status: 'stopped',
          git_branch: 'main',
          runtime: 'nodejs18',
          auto_deploy: true,
          created_by: userData.user?.id,
        });

        if (error) throw error;
        toast.success(`✅ Server "${newServer.name}" added`);
      }

      setShowAddModal(false);
      setNewServer({ name: '', server_type: 'self', agent_url: '', agent_token: '', ip_address: '' });
      await fetchServers();
    } catch (err: any) {
      toast.error('Server add failed: ' + (err.message || 'Unknown error'));
    } finally {
      setAdding(false);
    }
  };

  const openManage = (server: ServerItem) => {
    setSelectedServer(server);
    setEditServer({
      name: server.name,
      server_type: server.server_type || 'self',
      agent_url: server.agent_url || '',
      agent_token: server.agent_token || '',
      ip_address: server.ip_address || '',
      status: (server.status as 'live' | 'stopped' | 'deploying' | 'failed' | 'suspended') || 'stopped',
    });
    setShowManageModal(true);
  };

  const handleSaveServer = async () => {
    if (!selectedServer) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('servers')
        .update({
          name: editServer.name,
          server_type: editServer.server_type,
          agent_url: editServer.agent_url || null,
          agent_token: editServer.agent_token || null,
          ip_address: editServer.ip_address || null,
          status: editServer.status,
        })
        .eq('id', selectedServer.id);

      if (error) throw error;
      toast.success('Server updated');
      setShowManageModal(false);
      await fetchServers();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteServer = async () => {
    if (!selectedServer) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('servers').delete().eq('id', selectedServer.id);
      if (error) throw error;
      toast.success('Server deleted');
      setShowManageModal(false);
      await fetchServers();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleServerStatus = async (server: ServerItem) => {
    try {
      const nextStatus = server.status === 'live' ? 'stopped' : 'live';
      const { error } = await supabase.from('servers').update({ status: nextStatus }).eq('id', server.id);
      if (error) throw error;
      toast.success(`${server.name} set to ${nextStatus.toUpperCase()}`);
      await fetchServers();
    } catch (err: any) {
      toast.error(`Status update failed: ${err.message || 'Unknown error'}`);
    }
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
    <>
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
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-gradient-to-r from-primary to-cyan hover:from-primary/90 hover:to-cyan/90"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Server
              </Button>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={fetchServers}>
                Refresh <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {servers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No servers yet</p>
              <p className="text-xs mb-4">Add your first server</p>
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-primary to-cyan"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Your First Server
              </Button>
            </div>
          ) : (
            servers.map((server) => {
              const status = statusConfig[server.status || 'stopped'] || statusConfig.stopped;
              const type = typeConfig[server.server_type || 'self'] || typeConfig.self;
              const StatusIcon = status.icon;
              const TypeIcon = type.icon;

              return (
                <div
                  key={server.id}
                  className="group p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card/80 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={cn(
                          'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                          server.agent_url ? 'bg-success/20' : 'bg-primary/20',
                        )}
                      >
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

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => openManage(server)}
                      >
                        <Settings className="h-3 w-3" />
                        Manage
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => toggleServerStatus(server)}
                      >
                        {server.status === 'live' ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
                        {server.status === 'live' ? 'Stop' : 'Start'}
                      </Button>

                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5 bg-gradient-to-r from-primary to-cyan hover:from-primary/90 hover:to-cyan/90"
                        onClick={() => verifyServer(server)}
                        disabled={verifyingId === server.id || !server.agent_url || !server.agent_token}
                      >
                        {verifyingId === server.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Verify
                      </Button>
                    </div>
                  </div>

                  {server.agent_url && (
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <div className="flex items-center gap-2 text-xs">
                        <Activity className="h-3 w-3 text-success animate-pulse" />
                        <span className="text-success">VALA Agent Configured</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Add New Server
            </DialogTitle>
            <DialogDescription>Add server and optionally register agent immediately.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Server Name *</Label>
              <Input
                value={newServer.name}
                onChange={(e) => setNewServer((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. My VPS"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Server Type</Label>
              <Select value={newServer.server_type} onValueChange={(v) => setNewServer((prev) => ({ ...prev, server_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Self-Hosted (VPS)</SelectItem>
                  <SelectItem value="digitalocean">DigitalOcean</SelectItem>
                  <SelectItem value="cloud">Cloud</SelectItem>
                  <SelectItem value="vps">VPS</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Server IP</Label>
              <Input
                value={newServer.ip_address}
                onChange={(e) => setNewServer((prev) => ({ ...prev, ip_address: e.target.value }))}
                placeholder="e.g. 64.226.91.27"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Agent URL (optional)</Label>
              <Input
                value={newServer.agent_url}
                onChange={(e) => setNewServer((prev) => ({ ...prev, agent_url: e.target.value }))}
                placeholder="e.g. http://64.226.91.27:9876"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Agent Token (optional)</Label>
              <Input
                type="password"
                value={newServer.agent_token}
                onChange={(e) => setNewServer((prev) => ({ ...prev, agent_token: e.target.value }))}
                placeholder="Paste VALA Agent token"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleAddServer}
              disabled={!newServer.name.trim() || adding}
              className="flex-1 gap-2 bg-gradient-to-r from-primary to-cyan"
            >
              {adding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showManageModal} onOpenChange={setShowManageModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Server</DialogTitle>
            <DialogDescription>Edit, save, verify, or delete this server.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Server Name</Label>
              <Input value={editServer.name} onChange={(e) => setEditServer((prev) => ({ ...prev, name: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Server Type</Label>
              <Select value={editServer.server_type} onValueChange={(v) => setEditServer((prev) => ({ ...prev, server_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Self-Hosted (VPS)</SelectItem>
                  <SelectItem value="digitalocean">DigitalOcean</SelectItem>
                  <SelectItem value="cloud">Cloud</SelectItem>
                  <SelectItem value="vps">VPS</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={editServer.status} onValueChange={(v) => setEditServer((prev) => ({ ...prev, status: v as 'live' | 'stopped' | 'deploying' | 'failed' | 'suspended' }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="stopped">Stopped</SelectItem>
                  <SelectItem value="deploying">Deploying</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Server IP</Label>
              <Input value={editServer.ip_address} onChange={(e) => setEditServer((prev) => ({ ...prev, ip_address: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Agent URL</Label>
              <Input value={editServer.agent_url} onChange={(e) => setEditServer((prev) => ({ ...prev, agent_url: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Agent Token</Label>
              <Input
                type="password"
                value={editServer.agent_token}
                onChange={(e) => setEditServer((prev) => ({ ...prev, agent_token: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="destructive" onClick={handleDeleteServer} disabled={saving} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button variant="outline" onClick={() => setShowManageModal(false)} className="ml-auto">
              Cancel
            </Button>
            <Button onClick={handleSaveServer} disabled={saving} className="gap-2 bg-gradient-to-r from-primary to-cyan">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
