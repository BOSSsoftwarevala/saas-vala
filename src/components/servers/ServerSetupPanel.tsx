import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Server, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Wifi,
  Lock,
  Key,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import type { Server as ServerType } from '@/hooks/useServerManager';

interface ServerSetupPanelProps {
  server: ServerType | null;
  mode: 'create' | 'edit';
  onSave: (server: Partial<ServerType>) => Promise<void>;
  onDisable: (server: ServerType) => Promise<void>;
}

const PROVIDERS = [
  { value: 'vercel', label: 'Vercel' },
  { value: 'aws', label: 'AWS' },
  { value: 'gcp', label: 'Google Cloud' },
  { value: 'azure', label: 'Azure' },
  { value: 'digitalocean', label: 'DigitalOcean' },
  { value: 'contabo', label: 'Contabo' },
  { value: 'other', label: 'Other' },
];

const SERVER_TYPES = [
  { value: 'cloud', label: 'Cloud' },
  { value: 'vps', label: 'VPS' },
  { value: 'dedicated', label: 'Dedicated' },
];

const REGIONS = [
  { value: 'us-east', label: 'US East' },
  { value: 'us-west', label: 'US West' },
  { value: 'eu-west', label: 'EU West' },
  { value: 'eu-central', label: 'EU Central' },
  { value: 'asia-east', label: 'Asia East' },
  { value: 'asia-south', label: 'Asia South' },
];

const RUNTIMES = [
  { value: 'nodejs18', label: 'Node.js 18' },
  { value: 'nodejs20', label: 'Node.js 20' },
  { value: 'php82', label: 'PHP 8.2' },
  { value: 'php83', label: 'PHP 8.3' },
  { value: 'python311', label: 'Python 3.11' },
  { value: 'python312', label: 'Python 3.12' },
];

const OS_TYPES = [
  { value: 'ubuntu', label: 'Ubuntu' },
  { value: 'debian', label: 'Debian' },
  { value: 'centos', label: 'CentOS' },
  { value: 'other', label: 'Other' },
];

export function ServerSetupPanel({ server, mode, onSave, onDisable }: ServerSetupPanelProps) {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const [formData, setFormData] = useState({
    name: server?.name || '',
    server_type: server?.server_type || 'cloud',
    provider: 'vercel',
    region: 'us-east',
    ip_address: '',
    ssh_port: '22',
    username: 'root',
    auth_type: 'key' as 'password' | 'key',
    os_type: 'ubuntu',
    runtime: server?.runtime || 'nodejs20',
    auto_ssl: true,
    auto_backup: false,
    subdomain: server?.subdomain || '',
    custom_domain: server?.custom_domain || '',
  });

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    
    // Simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Mock result - in real implementation, this would call an edge function
    const success = formData.ip_address || formData.server_type === 'cloud';
    setConnectionStatus(success ? 'success' : 'failed');
    
    if (success) {
      toast.success('Connection successful');
    } else {
      toast.error('Connection failed - please check IP and credentials');
    }
    
    setTestingConnection(false);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Server name is required');
      return;
    }
    
    setLoading(true);
    try {
      await onSave({
        name: formData.name,
        server_type: formData.server_type,
        runtime: formData.runtime as ServerType['runtime'],
        subdomain: formData.subdomain,
        custom_domain: formData.custom_domain,
      });
      toast.success(mode === 'create' ? 'Server created' : 'Server updated');
    } catch {
      toast.error('Failed to save server');
    }
    setLoading(false);
  };

  const handleDisable = async () => {
    if (!server) return;
    setLoading(true);
    try {
      await onDisable(server);
    } catch {
      toast.error('Failed to disable server');
    }
    setLoading(false);
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Server className="h-5 w-5 text-primary" />
          {mode === 'create' ? 'Add New Server' : 'Edit Server'}
          {server?.status && (
            <Badge variant={server.status === 'live' ? 'default' : 'secondary'} className="ml-auto">
              {server.status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Server Name *</Label>
            <Input
              placeholder="My Production Server"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Server Type</Label>
            <Select 
              value={formData.server_type}
              onValueChange={(v) => setFormData({ ...formData, server_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select 
              value={formData.provider}
              onValueChange={(v) => setFormData({ ...formData, provider: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Region</Label>
            <Select 
              value={formData.region}
              onValueChange={(v) => setFormData({ ...formData, region: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Connection Info (for VPS/Dedicated) */}
        {formData.server_type !== 'cloud' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>IP Address</Label>
                <Input
                  placeholder="192.168.1.1"
                  value={formData.ip_address}
                  onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>SSH Port</Label>
                <Input
                  placeholder="22"
                  value={formData.ssh_port}
                  onChange={(e) => setFormData({ ...formData, ssh_port: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  placeholder="root"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Authentication</Label>
                <Select 
                  value={formData.auth_type}
                  onValueChange={(v) => setFormData({ ...formData, auth_type: v as 'password' | 'key' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="password">
                      <span className="flex items-center gap-2"><Lock className="h-3 w-3" /> Password</span>
                    </SelectItem>
                    <SelectItem value="key">
                      <span className="flex items-center gap-2"><Key className="h-3 w-3" /> SSH Key</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>OS Type</Label>
              <Select 
                value={formData.os_type}
                onValueChange={(v) => setFormData({ ...formData, os_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OS_TYPES.map((os) => (
                    <SelectItem key={os.value} value={os.value}>{os.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Runtime */}
        <div className="space-y-2">
          <Label>Runtime</Label>
          <Select 
            value={formData.runtime}
            onValueChange={(v) => setFormData({ ...formData, runtime: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RUNTIMES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Domain Settings */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Auto Subdomain</Label>
            <div className="flex gap-2">
              <Input
                placeholder="myapp"
                value={formData.subdomain}
                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
              />
              <span className="flex items-center text-sm text-muted-foreground whitespace-nowrap">.saasvala.com</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Custom Domain</Label>
            <Input
              placeholder="example.com"
              value={formData.custom_domain}
              onChange={(e) => setFormData({ ...formData, custom_domain: e.target.value })}
            />
          </div>
        </div>

        {/* Auto Settings */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Auto SSL</span>
            </div>
            <Switch
              checked={formData.auto_ssl}
              onCheckedChange={(v) => setFormData({ ...formData, auto_ssl: v })}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Auto Backup</span>
            </div>
            <Switch
              checked={formData.auto_backup}
              onCheckedChange={(v) => setFormData({ ...formData, auto_backup: v })}
            />
          </div>
        </div>

        {/* Connection Test Result */}
        {connectionStatus !== 'idle' && (
          <div className={`p-3 rounded-lg border flex items-center gap-2 ${
            connectionStatus === 'success' 
              ? 'bg-primary/10 border-primary/30 text-primary' 
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}>
            {connectionStatus === 'success' ? (
              <><CheckCircle className="h-4 w-4" /> Connection successful</>
            ) : (
              <><XCircle className="h-4 w-4" /> Connection failed</>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
          {formData.server_type !== 'cloud' && (
            <Button 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="gap-2"
            >
              {testingConnection ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
              Test Connection
            </Button>
          )}
          
          <Button 
            onClick={handleSave}
            disabled={loading}
            className="bg-orange-gradient hover:opacity-90 text-white gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Create Server' : 'Save Changes'}
          </Button>

          {mode === 'edit' && server && server.status !== 'suspended' && (
            <Button 
              variant="destructive"
              onClick={handleDisable}
              disabled={loading}
            >
              Disable Server
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
