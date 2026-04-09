import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Globe2, Plus, CheckCircle2, Clock, AlertCircle,
  Copy, Check, RefreshCw, Trash2, Shield, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { serversApi } from '@/lib/api';

interface DomainRow {
  id: string;
  domain_name: string;
  domain_type: string;
  status: string | null;
  ssl_status: string | null;
  dns_verified: boolean | null;
  server_id: string | null;
}

interface DnsRecordRow {
  id: string;
  record_type: string;
  name: string;
  value: string;
  ttl?: number | null;
}

interface ServerOption {
  id: string;
  name: string;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function CustomDomain() {
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dnsRecordsByDomain, setDnsRecordsByDomain] = useState<Record<string, DnsRecordRow[]>>({});

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [domainsResp, serversResp] = await Promise.all([
        serversApi.listDomains() as Promise<{ data: DomainRow[] }>,
        serversApi.list() as Promise<{ data: ServerOption[] }>,
      ]);

      const domainRows = domainsResp?.data || [];
      const serverRows = serversResp?.data || [];
      setDomains(domainRows);
      setServers(serverRows);
      setSelectedServerId((prev) => prev || serverRows[0]?.id || '');

      const pending = domainRows.filter((item) => item.status === 'pending');
      const dnsPairs = await Promise.all(
        pending.map(async (item) => {
          const response = await serversApi.domainRecords(item.id) as { data: DnsRecordRow[] };
          return [item.id, response?.data || []] as const;
        })
      );

      setDnsRecordsByDomain(Object.fromEntries(dnsPairs));
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim() || !selectedServerId) return;
    setIsAdding(true);

    try {
      await serversApi.addDomain({
        domain_name: newDomain.trim(),
        server_id: selectedServerId,
        domain_type: 'custom',
      });
      toast.success('Domain added! Add DNS records below to verify.');
      setNewDomain('');
      await fetchData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add domain');
    }
    setIsAdding(false);
  };

  const handleVerify = async (domainId: string) => {
    setVerifyingId(domainId);
    try {
      await serversApi.verifyDomain(domainId);
      toast.success('Domain verified and live!');
      await fetchData();
    } catch (error: any) {
      toast.error(error?.message || 'Verification failed');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleRemove = async (domainId: string) => {
    setRemovingId(domainId);
    try {
      const result = await serversApi.removeDomain(domainId) as { success: boolean; cleanup?: { attempted?: boolean; removed?: number; reason?: string } };
      toast.success('Domain removed');
      if (result?.cleanup?.attempted) {
        const removed = Number(result.cleanup.removed || 0);
        toast.info(removed > 0 ? `Provider cleanup removed ${removed} DNS record(s)` : `Provider cleanup attempted${result.cleanup.reason ? `: ${result.cleanup.reason}` : ''}`);
      }
      await fetchData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove domain');
    } finally {
      setRemovingId(null);
    }
  };

  const copyValue = async (value: string, label: string) => {
    try {
      await copyText(value);
      setCopiedRecord(label);
      toast.success(`${label} copied!`);
      setTimeout(() => setCopiedRecord(null), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; border: string; label: string }> = {
    pending: { icon: Clock, color: 'text-warning', bg: 'bg-warning/20', border: 'border-warning/30', label: 'Pending' },
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
        <div className="space-y-2">
          <Label className="text-foreground">Server</Label>
          <Select value={selectedServerId} onValueChange={setSelectedServerId}>
            <SelectTrigger className="bg-muted/50 border-border">
              <SelectValue placeholder="Select server" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {servers.map((server) => (
                <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Enter your domain (e.g., example.com)"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            className="flex-1 bg-muted/50 border-border"
          />
          <Button 
            onClick={handleAddDomain}
            disabled={!newDomain.trim() || !selectedServerId || isAdding}
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
              const s = statusConfig[domain.status || 'pending'] || statusConfig.pending;
              const SIcon = s.icon;
              const isPending = domain.status === 'pending';

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
                          <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => handleVerify(domain.id)} disabled={verifyingId === domain.id}>
                            {verifyingId === domain.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                            <span className="hidden sm:inline">{verifyingId === domain.id ? 'Checking' : 'Verify'}</span>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => handleRemove(domain.id)} disabled={removingId === domain.id}>
                          {removingId === domain.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
                        {(dnsRecordsByDomain[domain.id] || []).map((record) => (
                          <div key={`${record.record_type}-${record.name}`} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Badge variant="outline" className="border-border shrink-0">{record.record_type}</Badge>
                              <span className="text-sm text-muted-foreground shrink-0">{record.name}</span>
                              <span className="text-sm font-mono text-foreground truncate">{record.value}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="shrink-0 gap-1" onClick={() => copyValue(record.value, `${record.record_type} record`)}>
                              {copiedRecord === `${record.record_type} record` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
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