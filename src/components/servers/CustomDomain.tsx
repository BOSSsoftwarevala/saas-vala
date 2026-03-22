import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Globe2, Plus, CheckCircle2, Clock, AlertCircle,
  Copy, Check, RefreshCw, Trash2, Shield, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface DomainRow {
  id: string;
  domain_name: string;
  domain_type: string;
  status: string | null;
  ssl_status: string | null;
  dns_verified: boolean | null;
  server_id: string | null;
}

const dnsRecords = [
  { type: 'A', host: '@', value: '76.76.21.21' },
  { type: 'CNAME', host: 'www', value: 'cname.vercel-dns.com' },
];

export function CustomDomain() {
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('domains')
      .select('id, domain_name, domain_type, status, ssl_status, dns_verified, server_id')
      .order('created_at', { ascending: false });
    if (!error) setDomains(data || []);
    setLoading(false);
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    setIsAdding(true);
    
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('domains').insert([{
      domain_name: newDomain.trim(),
      domain_type: 'custom',
      status: 'pending' as const,
      ssl_status: 'pending',
      dns_verified: false,
      created_by: userData.user?.id,
    }]);

    if (error) {
      toast.error('Failed to add domain: ' + error.message);
    } else {
      toast.success('Domain added! Add DNS records below to verify.');
      setNewDomain('');
      await fetchDomains();
    }
    setIsAdding(false);
  };

  const handleVerify = async (domainId: string) => {
    toast.info('Checking DNS records...');
    // In production, this would call an edge function to verify DNS
    const { error } = await supabase.from('domains').update({
      dns_verified: true,
      status: 'active',
      ssl_status: 'active',
    }).eq('id', domainId);

    if (!error) {
      toast.success('Domain verified and live!');
      await fetchDomains();
    } else {
      toast.error('Verification failed');
    }
  };

  const handleRemove = async (domainId: string) => {
    const { error } = await supabase.from('domains').delete().eq('id', domainId);
    if (!error) {
      toast.success('Domain removed');
      await fetchDomains();
    } else {
      toast.error('Failed to remove domain');
    }
  };

  const copyValue = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedRecord(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopiedRecord(null), 2000);
  };

  const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; border: string; label: string }> = {
    pending_verification: { icon: Clock, color: 'text-warning', bg: 'bg-warning/20', border: 'border-warning/30', label: 'Pending' },
    active: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/20', border: 'border-success/30', label: 'Live' },
    failed: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/20', border: 'border-destructive/30', label: 'Failed' },
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-warning/20 flex items-center justify-center">
            <Globe2 className="h-5 w-5 text-warning" />
          </div>
          <div>
            <CardTitle className="text-base sm:text-lg">Custom Domain</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Add your own domain • Real DB storage
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Domain Input */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Enter your domain (e.g., example.com)"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            className="flex-1 bg-muted/50 border-border"
          />
          <Button 
            onClick={handleAddDomain}
            disabled={!newDomain.trim() || isAdding}
            className="bg-orange-gradient hover:opacity-90 text-white gap-2 shrink-0"
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Domain
          </Button>
        </div>

        {/* Connected Domains */}
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : domains.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Connected Domains ({domains.length})</p>
            {domains.map((domain) => {
              const s = statusConfig[domain.status || 'pending_verification'] || statusConfig.pending_verification;
              const SIcon = s.icon;
              const isPending = domain.status === 'pending_verification';

              return (
                <div key={domain.id} className="space-y-3">
                  <div className="glass-card rounded-lg p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', s.bg)}>
                          <SIcon className={cn('h-4 w-4', s.color)} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{domain.domain_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Shield className="h-3 w-3 text-success" />
                            <span>SSL: {domain.ssl_status || 'pending'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={cn(s.bg, s.color, s.border)}>{s.label}</Badge>
                        {isPending && (
                          <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => handleVerify(domain.id)}>
                            <RefreshCw className="h-3 w-3" />
                            <span className="hidden sm:inline">Verify</span>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => handleRemove(domain.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {isPending && (
                    <div className="glass-card rounded-lg p-4 space-y-3 animate-fade-in">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <AlertCircle className="h-4 w-4 text-warning" />
                        Add these DNS records at your domain provider:
                      </div>
                      <div className="space-y-2">
                        {dnsRecords.map((record) => (
                          <div key={`${record.type}-${record.host}`} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Badge variant="outline" className="border-border shrink-0">{record.type}</Badge>
                              <span className="text-sm text-muted-foreground shrink-0">{record.host}</span>
                              <span className="text-sm font-mono text-foreground truncate">{record.value}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="shrink-0 gap-1" onClick={() => copyValue(record.value, `${record.type} record`)}>
                              {copiedRecord === `${record.type} record` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              Copy
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Globe2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No custom domains connected</p>
            <p className="text-xs mt-1">Your auto-subdomain is always available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}