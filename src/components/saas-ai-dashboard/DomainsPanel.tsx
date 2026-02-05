import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  Plus, 
  Trash2, 
  Shield,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface DomainsPanelProps {
  projectId: string | null;
}

interface Domain {
  id: string;
  domain: string;
  type: 'primary' | 'subdomain' | 'custom';
  sslStatus: 'active' | 'pending' | 'failed';
  verified: boolean;
}

export function DomainsPanel({ projectId: _projectId }: DomainsPanelProps) {
  const [domains, setDomains] = useState<Domain[]>([
    { id: '1', domain: 'demo-app.lovable.app', type: 'subdomain', sslStatus: 'active', verified: true },
    { id: '2', domain: 'myapp.example.com', type: 'custom', sslStatus: 'active', verified: true },
    { id: '3', domain: 'staging.myapp.example.com', type: 'custom', sslStatus: 'pending', verified: false },
  ]);
  const [newDomain, setNewDomain] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const addDomain = () => {
    if (!newDomain.trim()) {
      toast.error('Domain is required');
      return;
    }
    
    setDomains(prev => [
      ...prev,
      { 
        id: crypto.randomUUID(), 
        domain: newDomain.toLowerCase(), 
        type: 'custom', 
        sslStatus: 'pending',
        verified: false
      }
    ]);
    setNewDomain('');
    setDialogOpen(false);
    toast.success('Domain added. Verification pending.');
  };

  const deleteDomain = (id: string) => {
    const domain = domains.find(d => d.id === id);
    if (domain?.type === 'subdomain') {
      toast.error('Cannot delete the primary subdomain');
      return;
    }
    setDomains(prev => prev.filter(d => d.id !== id));
    toast.success('Domain removed');
  };

  const _getSslIcon = (status: Domain['sslStatus']) => {
    switch (status) {
      case 'active': return <ShieldCheck className="h-4 w-4 text-success" />;
      case 'pending': return <Clock className="h-4 w-4 text-warning" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getSslBadge = (status: Domain['sslStatus']) => {
    switch (status) {
      case 'active': return <Badge className="bg-success/20 text-success border-success/30 gap-1"><ShieldCheck className="h-3 w-3" />SSL Active</Badge>;
      case 'pending': return <Badge className="bg-warning/20 text-warning border-warning/30 gap-1"><Clock className="h-3 w-3" />SSL Pending</Badge>;
      case 'failed': return <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1"><AlertCircle className="h-3 w-3" />SSL Failed</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/20">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">Domains & SSL</h2>
            <p className="text-sm text-muted-foreground">Manage custom domains and SSL certificates</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Domain</DialogTitle>
              <DialogDescription>
                Point your custom domain to your project.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Domain Name</Label>
                <Input 
                  placeholder="app.yourdomain.com" 
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter your domain without https://
                </p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
                <p className="text-sm font-medium text-foreground">DNS Configuration</p>
                <p className="text-xs text-muted-foreground">
                  Add an A record pointing to: <code className="text-primary">185.158.133.1</code>
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={addDomain}>Add Domain</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Domains List */}
      <div className="space-y-3">
        {domains.map((domain) => (
          <Card key={domain.id} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${domain.verified ? 'bg-success/20' : 'bg-warning/20'}`}>
                    {domain.verified ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <Clock className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <a 
                        href={`https://${domain.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        {domain.domain}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      {domain.type === 'subdomain' && (
                        <Badge variant="secondary" className="text-[10px]">Primary</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {getSslBadge(domain.sslStatus)}
                      {!domain.verified && (
                        <Badge variant="outline" className="text-[10px]">Pending Verification</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {domain.sslStatus === 'pending' && (
                    <Button variant="outline" size="sm" className="gap-1">
                      <RefreshCw className="h-3 w-3" />
                      Retry SSL
                    </Button>
                  )}
                  {domain.type !== 'subdomain' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteDomain(domain.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SSL Info */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-success/20">
              <Shield className="h-5 w-5 text-success" />
            </div>
            <div>
              <CardTitle className="text-lg">Automatic SSL</CardTitle>
              <CardDescription>Free SSL certificates via Let's Encrypt</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            SSL certificates are automatically provisioned and renewed for all verified domains. 
            Certificate provisioning may take up to 24 hours for new domains.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
