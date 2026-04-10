import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Globe,
  ExternalLink,
  CheckCircle2,
  Trash2,
  Shield,
  Server,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useServers } from '@/hooks/useServers';

export function ServerDomains() {
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const { toast } = useToast();
  const { servers, loading, updateServer } = useServers();

  const selectedServer = servers.find((s) => s.id === selectedServerId) || servers[0] || null;

  const handleAddDomain = async () => {
    if (!newDomain.trim() || !selectedServer) return;
    await updateServer(selectedServer.id, { custom_domain: newDomain.trim() });
    toast({
      title: 'Domain saved',
      description: `${newDomain} has been set as the custom domain. Configure DNS to complete setup.`,
    });
    setNewDomain('');
    setShowAddDomain(false);
  };

  const handleRemoveCustomDomain = async () => {
    if (!selectedServer) return;
    await updateServer(selectedServer.id, { custom_domain: null });
  };

  const autoSubdomain = selectedServer?.subdomain ? `${selectedServer.subdomain}.saasvala.com` : null;
  const customDomain = selectedServer?.custom_domain;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">Custom Domains</h3>
          <p className="text-sm text-muted-foreground">Connect custom domains to your deployments</p>
        </div>
        <Dialog open={showAddDomain} onOpenChange={setShowAddDomain}>
          <DialogTrigger asChild>
            <Button className="bg-orange-gradient hover:opacity-90 text-white gap-2" disabled={!selectedServer}>
              <Plus className="h-4 w-4" />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Add Custom Domain</DialogTitle>
              <DialogDescription>
                Enter your domain name. You'll need to configure DNS records after adding.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="domain" className="text-foreground">
                  Domain
                </Label>
                <Input
                  id="domain"
                  placeholder="example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="bg-muted/50 border-border"
                />
              </div>
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium text-foreground">DNS Configuration Required</p>
                <p className="text-xs text-muted-foreground">After adding, you'll need to add these DNS records:</p>
                <div className="text-xs font-mono bg-background/50 p-2 rounded">
                  <div>A @ 185.158.133.1</div>
                  <div>CNAME www saas-vala.app</div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDomain(false)} className="border-border">
                Cancel
              </Button>
              <Button onClick={handleAddDomain} className="bg-orange-gradient hover:opacity-90 text-white">
                Add Domain
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {servers.length > 0 && (
        <div className="flex items-center gap-3">
          <Server className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={selectedServerId || selectedServer?.id || ''} onValueChange={setSelectedServerId}>
            <SelectTrigger className="w-64 bg-muted/50 border-border">
              <SelectValue placeholder="Select a server" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {servers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!selectedServer ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Server className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No servers available</p>
            <p className="text-sm text-muted-foreground mt-1">Create a server first to manage domains</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {autoSubdomain && (
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Auto-generated Domain</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <a
                        href={`https://${autoSubdomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        {autoSubdomain}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Shield className="h-3 w-3 text-success" />
                        {selectedServer.ssl_status === 'active' ? 'SSL Enabled' : 'SSL Pending'}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-foreground">Custom Domain</CardTitle>
                {customDomain && (
                  <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                    1 domain
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {customDomain ? (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <a
                        href={`https://${customDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {customDomain}
                      </a>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Shield className="h-3 w-3 text-success" />
                        SSL Enabled
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={handleRemoveCustomDomain}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No custom domain set. Click "Add Domain" to connect one.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
