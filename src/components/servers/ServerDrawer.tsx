import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Server, GitBranch, Globe, Shield, Settings } from 'lucide-react';
import type { Server as ServerType, Domain, GitConnection, ServerAutoRules } from '@/hooks/useServerManager';
import { useProducts } from '@/hooks/useProducts';

interface ServerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: ServerType | null;
  domains: Domain[];
  gitConnection: GitConnection | null;
  autoRules: ServerAutoRules | null;
  mode: 'create' | 'edit' | 'view';
  onSave: (server: Partial<ServerType>) => void;
  onConnectGit: (connection: Partial<GitConnection>) => void;
  onAddDomain: (domain: Partial<Domain>) => void;
  onUpdateAutoRules: (rules: Partial<ServerAutoRules>) => void;
}

export function ServerDrawer({
  open,
  onOpenChange,
  server,
  domains,
  gitConnection,
  autoRules,
  mode,
  onSave,
  onConnectGit,
  onAddDomain,
  onUpdateAutoRules,
}: ServerDrawerProps) {
  const { products } = useProducts();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('server');

  const [formData, setFormData] = useState({
    name: '',
    product_id: '',
    runtime: 'nodejs20' as const,
    server_type: 'vercel',
    subdomain: '',
    custom_domain: '',
    git_repo: '',
    git_branch: 'main',
    auto_deploy: true,
  });

  const [gitForm, setGitForm] = useState({
    repository_url: '',
    branch: 'main',
    auto_deploy: true,
  });

  const [domainForm, setDomainForm] = useState<{
    domain_name: string;
    domain_type: 'subdomain' | 'custom';
  }>({
    domain_name: '',
    domain_type: 'subdomain',
  });

  const [rulesForm, setRulesForm] = useState({
    auto_deploy: true,
    auto_ssl_renewal: true,
    auto_health_check: true,
    auto_restart: false,
    auto_backup: false,
  });

  useEffect(() => {
    if (server) {
      setFormData({
        name: server.name,
        product_id: server.product_id || '',
        runtime: (server.runtime as 'nodejs20') || 'nodejs20',
        server_type: server.server_type || 'vercel',
        subdomain: server.subdomain || '',
        custom_domain: server.custom_domain || '',
        git_repo: server.git_repo || '',
        git_branch: server.git_branch || 'main',
        auto_deploy: server.auto_deploy,
      });
    } else {
      setFormData({
        name: '',
        product_id: '',
        runtime: 'nodejs20',
        server_type: 'vercel',
        subdomain: '',
        custom_domain: '',
        git_repo: '',
        git_branch: 'main',
        auto_deploy: true,
      });
    }

    if (gitConnection) {
      setGitForm({
        repository_url: gitConnection.repository_url,
        branch: gitConnection.branch,
        auto_deploy: gitConnection.auto_deploy,
      });
    }

    if (autoRules) {
      setRulesForm({
        auto_deploy: autoRules.auto_deploy,
        auto_ssl_renewal: autoRules.auto_ssl_renewal,
        auto_health_check: autoRules.auto_health_check,
        auto_restart: autoRules.auto_restart,
        auto_backup: autoRules.auto_backup,
      });
    }
  }, [server, gitConnection, autoRules]);

  const handleSaveServer = async () => {
    setLoading(true);
    try {
      await onSave(formData);
      if (mode === 'create') {
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGit = async () => {
    if (!server) return;
    setLoading(true);
    try {
      await onConnectGit({
        server_id: server.id,
        repository_url: gitForm.repository_url,
        branch: gitForm.branch,
        auto_deploy: gitForm.auto_deploy,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async () => {
    if (!server) return;
    setLoading(true);
    try {
      await onAddDomain({
        server_id: server.id,
        domain_name: domainForm.domain_type === 'subdomain' 
          ? `${domainForm.domain_name}.saasvala.com`
          : domainForm.domain_name,
        domain_type: domainForm.domain_type,
      });
      setDomainForm({ domain_name: '', domain_type: 'subdomain' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRules = async () => {
    if (!server) return;
    setLoading(true);
    try {
      await onUpdateAutoRules(rulesForm);
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'create' ? 'Create Server' : mode === 'edit' ? 'Edit Server' : 'Server Details';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            {title}
          </SheetTitle>
          <SheetDescription>
            {mode === 'create' ? 'Configure a new server for deployment' : 'Manage server settings'}
          </SheetDescription>
        </SheetHeader>

        {mode === 'view' && server ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="server" className="gap-1 text-xs">
                <Server className="h-3 w-3" /> Server
              </TabsTrigger>
              <TabsTrigger value="git" className="gap-1 text-xs">
                <GitBranch className="h-3 w-3" /> Git
              </TabsTrigger>
              <TabsTrigger value="domains" className="gap-1 text-xs">
                <Globe className="h-3 w-3" /> Domains
              </TabsTrigger>
              <TabsTrigger value="auto" className="gap-1 text-xs">
                <Settings className="h-3 w-3" /> Auto
              </TabsTrigger>
            </TabsList>

            <TabsContent value="server" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Server Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select 
                    value={formData.product_id} 
                    onValueChange={(v) => setFormData({ ...formData, product_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Runtime</Label>
                  <Select 
                    value={formData.runtime} 
                    onValueChange={(v: 'nodejs20') => setFormData({ ...formData, runtime: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nodejs18">Node.js 18</SelectItem>
                      <SelectItem value="nodejs20">Node.js 20</SelectItem>
                      <SelectItem value="php82">PHP 8.2</SelectItem>
                      <SelectItem value="php83">PHP 8.3</SelectItem>
                      <SelectItem value="python311">Python 3.11</SelectItem>
                      <SelectItem value="python312">Python 3.12</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSaveServer} disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="git" className="space-y-4 mt-4">
              {gitConnection?.status === 'connected' ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-success/30 bg-success/10">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="font-medium text-success">Connected</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{gitConnection.repository_url}</p>
                    <p className="text-xs text-muted-foreground mt-1">Branch: {gitConnection.branch}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Repository URL</Label>
                    <Input
                      placeholder="https://github.com/user/repo"
                      value={gitForm.repository_url}
                      onChange={(e) => setGitForm({ ...gitForm, repository_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <Input
                      value={gitForm.branch}
                      onChange={(e) => setGitForm({ ...gitForm, branch: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Auto Deploy on Push</Label>
                    <Switch
                      checked={gitForm.auto_deploy}
                      onCheckedChange={(v) => setGitForm({ ...gitForm, auto_deploy: v })}
                    />
                  </div>
                  <Button onClick={handleConnectGit} disabled={loading || !gitForm.repository_url} className="w-full">
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Connect Repository
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="domains" className="space-y-4 mt-4">
              {domains.length > 0 && (
                <div className="space-y-2">
                  {domains.map((domain) => (
                    <div key={domain.id} className="p-3 rounded-lg border border-border flex items-center justify-between">
                      <div>
                        <p className="font-mono text-sm">{domain.domain_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={
                            domain.ssl_status === 'active' 
                              ? 'text-success border-success/30' 
                              : 'text-warning border-warning/30'
                          }>
                            <Shield className="h-3 w-3 mr-1" />
                            SSL {domain.ssl_status}
                          </Badge>
                        </div>
                      </div>
                      {domain.status === 'active' ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-warning" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  <Label>Domain Type</Label>
                  <Select 
                    value={domainForm.domain_type} 
                    onValueChange={(v) => setDomainForm({ ...domainForm, domain_type: v as 'subdomain' | 'custom' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subdomain">Auto Subdomain</SelectItem>
                      <SelectItem value="custom">Custom Domain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{domainForm.domain_type === 'subdomain' ? 'Subdomain' : 'Domain'}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={domainForm.domain_type === 'subdomain' ? 'myapp' : 'example.com'}
                      value={domainForm.domain_name}
                      onChange={(e) => setDomainForm({ ...domainForm, domain_name: e.target.value })}
                    />
                    {domainForm.domain_type === 'subdomain' && (
                      <span className="flex items-center text-sm text-muted-foreground">.saasvala.com</span>
                    )}
                  </div>
                </div>
                <Button onClick={handleAddDomain} disabled={loading || !domainForm.domain_name} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Domain
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="auto" className="space-y-4 mt-4">
              <div className="space-y-4">
                {[
                  { key: 'auto_deploy', label: 'Auto Deploy', desc: 'Deploy automatically on Git push' },
                  { key: 'auto_ssl_renewal', label: 'Auto SSL Renewal', desc: 'Renew SSL certificates automatically' },
                  { key: 'auto_health_check', label: 'Auto Health Check', desc: 'Monitor server health periodically' },
                  { key: 'auto_restart', label: 'Auto Restart', desc: 'Restart on failure detection' },
                  { key: 'auto_backup', label: 'Auto Backup', desc: 'Create scheduled backups' },
                ].map((rule) => (
                  <div key={rule.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="font-medium text-foreground">{rule.label}</p>
                      <p className="text-xs text-muted-foreground">{rule.desc}</p>
                    </div>
                    <Switch
                      checked={rulesForm[rule.key as keyof typeof rulesForm]}
                      onCheckedChange={(v) => setRulesForm({ ...rulesForm, [rule.key]: v })}
                    />
                  </div>
                ))}
                <Button onClick={handleSaveRules} disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Auto Rules
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          // Create mode form
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Server Name *</Label>
              <Input
                placeholder="My Server"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <Select 
                value={formData.product_id} 
                onValueChange={(v) => setFormData({ ...formData, product_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Runtime</Label>
              <Select 
                value={formData.runtime} 
                onValueChange={(v: 'nodejs20') => setFormData({ ...formData, runtime: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nodejs18">Node.js 18</SelectItem>
                  <SelectItem value="nodejs20">Node.js 20</SelectItem>
                  <SelectItem value="php82">PHP 8.2</SelectItem>
                  <SelectItem value="php83">PHP 8.3</SelectItem>
                  <SelectItem value="python311">Python 3.11</SelectItem>
                  <SelectItem value="python312">Python 3.12</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subdomain</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="myapp"
                  value={formData.subdomain}
                  onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                />
                <span className="flex items-center text-sm text-muted-foreground">.saasvala.com</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto Deploy on Push</Label>
              <Switch
                checked={formData.auto_deploy}
                onCheckedChange={(v) => setFormData({ ...formData, auto_deploy: v })}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveServer} disabled={loading || !formData.name} className="flex-1">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Server
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
