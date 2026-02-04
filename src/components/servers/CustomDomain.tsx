import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Globe2, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Domain {
  id: string;
  name: string;
  status: 'pending' | 'verified' | 'live';
}

interface DNSRecord {
  type: string;
  host: string;
  value: string;
}

export function CustomDomain() {
  const [domains, setDomains] = useState<Domain[]>([
    { id: 'd1', name: 'example.com', status: 'live' },
  ]);
  const [newDomain, setNewDomain] = useState('');
  const [showDNS, setShowDNS] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null);

  const dnsRecords: DNSRecord[] = [
    { type: 'A', host: '@', value: '185.158.133.1' },
    { type: 'CNAME', host: 'www', value: 'cname.saasvala.com' },
  ];

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    
    setIsAdding(true);
    setTimeout(() => {
      setDomains(prev => [...prev, {
        id: `d${Date.now()}`,
        name: newDomain.trim(),
        status: 'pending',
      }]);
      setNewDomain('');
      setIsAdding(false);
      setShowDNS(`d${Date.now()}`);
      toast.success('Domain added!', {
        description: 'Add the DNS records below to verify ownership.',
      });
    }, 1000);
  };

  const handleVerify = (domainId: string) => {
    toast.info('Checking DNS records...', { duration: 2000 });
    setTimeout(() => {
      setDomains(prev => prev.map(d => 
        d.id === domainId ? { ...d, status: 'verified' } : d
      ));
      setTimeout(() => {
        setDomains(prev => prev.map(d => 
          d.id === domainId ? { ...d, status: 'live' } : d
        ));
        toast.success('Domain verified and live!');
      }, 1500);
    }, 2000);
  };

  const handleRemove = (domainId: string) => {
    setDomains(prev => prev.filter(d => d.id !== domainId));
    toast.success('Domain removed');
  };

  const copyValue = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedRecord(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopiedRecord(null), 2000);
  };

  const statusConfig = {
    pending: { icon: Clock, color: 'text-warning', bg: 'bg-warning/20', border: 'border-warning/30', label: 'Pending' },
    verified: { icon: CheckCircle2, color: 'text-cyan', bg: 'bg-cyan/20', border: 'border-cyan/30', label: 'Verified' },
    live: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/20', border: 'border-success/30', label: 'Live' },
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
              Optional • Add your own domain
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
            {isAdding ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Domain
          </Button>
        </div>

        {/* Connected Domains */}
        {domains.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Connected Domains</p>
            {domains.map((domain) => {
              const status = statusConfig[domain.status];
              const StatusIcon = status.icon;

              return (
                <div key={domain.id} className="space-y-3">
                  <div className="glass-card rounded-lg p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', status.bg)}>
                          <StatusIcon className={cn('h-4 w-4', status.color)} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{domain.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Shield className="h-3 w-3 text-success" />
                            <span>SSL Auto-Enabled</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={cn(status.bg, status.color, status.border)}>
                          {status.label}
                        </Badge>
                        {domain.status === 'pending' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="border-border gap-1"
                            onClick={() => handleVerify(domain.id)}
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span className="hidden sm:inline">Verify</span>
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(domain.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* DNS Records - Only show for pending domains */}
                  {domain.status === 'pending' && (
                    <div className="glass-card rounded-lg p-4 space-y-3 animate-fade-in">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <AlertCircle className="h-4 w-4 text-warning" />
                        Add these DNS records at your domain provider:
                      </div>
                      <div className="space-y-2">
                        {dnsRecords.map((record) => (
                          <div 
                            key={`${record.type}-${record.host}`}
                            className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Badge variant="outline" className="border-border shrink-0">
                                {record.type}
                              </Badge>
                              <span className="text-sm text-muted-foreground shrink-0">{record.host}</span>
                              <span className="text-sm font-mono text-foreground truncate">{record.value}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="shrink-0 gap-1"
                              onClick={() => copyValue(record.value, `${record.type} record`)}
                            >
                              {copiedRecord === `${record.type} record` ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              Copy
                            </Button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        DNS changes can take up to 24-48 hours to propagate.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {domains.length === 0 && (
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
