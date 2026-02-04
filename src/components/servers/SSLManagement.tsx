import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

interface Domain {
  id: string;
  domain_name: string;
  ssl_status: string | null;
  ssl_expiry_at: string | null;
}

interface SSLManagementProps {
  domains: Domain[];
  onIssueSSL: (domainId: string) => void;
  onRenewSSL: (domainId: string) => void;
  onRecheckSSL: (domainId: string) => void;
}

const sslStatusConfig = {
  active: {
    icon: ShieldCheck,
    label: 'Active',
    color: 'text-success',
    bgColor: 'bg-success/20',
    borderColor: 'border-success/30',
    description: 'SSL certificate is active and valid',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    color: 'text-warning',
    bgColor: 'bg-warning/20',
    borderColor: 'border-warning/30',
    description: 'SSL certificate is being issued',
  },
  expired: {
    icon: ShieldX,
    label: 'Expired',
    color: 'text-destructive',
    bgColor: 'bg-destructive/20',
    borderColor: 'border-destructive/30',
    description: 'SSL certificate has expired',
  },
  failed: {
    icon: ShieldAlert,
    label: 'Failed',
    color: 'text-destructive',
    bgColor: 'bg-destructive/20',
    borderColor: 'border-destructive/30',
    description: 'SSL issuance failed',
  },
  none: {
    icon: Shield,
    label: 'No SSL',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/20',
    borderColor: 'border-muted/30',
    description: 'No SSL certificate configured',
  },
};

export function SSLManagement({
  domains,
  onIssueSSL,
  onRenewSSL,
  onRecheckSSL,
}: SSLManagementProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (domainId: string, action: 'issue' | 'renew' | 'recheck') => {
    setLoadingId(domainId);
    
    if (action === 'issue') {
      await onIssueSSL(domainId);
      toast.success('SSL issuance started');
    } else if (action === 'renew') {
      await onRenewSSL(domainId);
      toast.success('SSL renewal started');
    } else {
      await onRecheckSSL(domainId);
      toast.success('SSL status rechecked');
    }
    
    setTimeout(() => setLoadingId(null), 1500);
  };

  const getDaysUntilExpiry = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    return differenceInDays(new Date(expiryDate), new Date());
  };

  const activeSSL = domains.filter(d => d.ssl_status === 'active').length;
  const expiringSoon = domains.filter(d => {
    const days = getDaysUntilExpiry(d.ssl_expiry_at);
    return days !== null && days <= 15 && d.ssl_status === 'active';
  }).length;
  const failedSSL = domains.filter(d => d.ssl_status === 'failed' || d.ssl_status === 'expired').length;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-success/20 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-success" />
          </div>
          <div>
            <CardTitle className="text-base sm:text-lg">SSL Management</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Auto-renew enabled • 15 days before expiry
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-success/10 text-center">
            <p className="text-2xl font-bold text-success">{activeSSL}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="p-3 rounded-lg bg-warning/10 text-center">
            <p className="text-2xl font-bold text-warning">{expiringSoon}</p>
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10 text-center">
            <p className="text-2xl font-bold text-destructive">{failedSSL}</p>
            <p className="text-xs text-muted-foreground">Issues</p>
          </div>
        </div>

        {/* Domain SSL List */}
        <div className="space-y-2">
          {domains.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No domains to manage</p>
            </div>
          ) : (
            domains.map((domain) => {
              const sslStatus = sslStatusConfig[domain.ssl_status as keyof typeof sslStatusConfig] || sslStatusConfig.none;
              const SslIcon = sslStatus.icon;
              const daysUntilExpiry = getDaysUntilExpiry(domain.ssl_expiry_at);
              const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 15;

              return (
                <div
                  key={domain.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', sslStatus.bgColor)}>
                      <SslIcon className={cn('h-4 w-4', sslStatus.color)} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{domain.domain_name}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{sslStatus.description}</span>
                        {domain.ssl_expiry_at && (
                          <span className={cn(isExpiringSoon ? 'text-warning' : 'text-muted-foreground')}>
                            • Expires {format(new Date(domain.ssl_expiry_at), 'MMM dd, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={cn(sslStatus.bgColor, sslStatus.color, sslStatus.borderColor)}>
                      {sslStatus.label}
                    </Badge>

                    {/* Action Buttons based on status */}
                    {domain.ssl_status === 'none' || !domain.ssl_status ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border gap-1"
                        onClick={() => handleAction(domain.id, 'issue')}
                        disabled={loadingId === domain.id}
                      >
                        {loadingId === domain.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Shield className="h-3 w-3" />
                        )}
                        <span className="hidden sm:inline">Issue SSL</span>
                      </Button>
                    ) : domain.ssl_status === 'active' && isExpiringSoon ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-warning/50 text-warning gap-1"
                        onClick={() => handleAction(domain.id, 'renew')}
                        disabled={loadingId === domain.id}
                      >
                        {loadingId === domain.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        <span className="hidden sm:inline">Renew</span>
                      </Button>
                    ) : domain.ssl_status === 'failed' || domain.ssl_status === 'expired' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/50 text-destructive gap-1"
                        onClick={() => handleAction(domain.id, 'recheck')}
                        disabled={loadingId === domain.id}
                      >
                        {loadingId === domain.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        <span className="hidden sm:inline">Recheck</span>
                      </Button>
                    ) : domain.ssl_status === 'pending' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleAction(domain.id, 'recheck')}
                        disabled={loadingId === domain.id}
                      >
                        {loadingId === domain.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Auto-Renew Notice */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="text-success font-medium">Auto-renewal active:</span> SSL certificates will be automatically renewed 15 days before expiry.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
