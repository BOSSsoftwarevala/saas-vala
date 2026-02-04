import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Globe,
  CheckCircle2,
  Clock,
  AlertCircle,
  Shield,
  ShieldCheck,
  ShieldX,
  Eye,
  RefreshCw,
  Trash2,
  Search,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';

interface Domain {
  id: string;
  domain_name: string;
  domain_type: string;
  status: string | null;
  ssl_status: string | null;
  ssl_expiry_at: string | null;
  is_primary: boolean | null;
  dns_verified: boolean | null;
  server_id: string | null;
  product_id: string | null;
  created_at: string | null;
}

interface Server {
  id: string;
  name: string;
  subdomain: string | null;
}

interface Product {
  id: string;
  name: string;
}

interface DomainTableProps {
  domains: Domain[];
  servers: Server[];
  products: Product[];
  onAddDomain: () => void;
  onVerify: (domainId: string) => void;
  onEnableSSL: (domainId: string) => void;
  onRemove: (domainId: string) => void;
  onView: (domain: Domain) => void;
}

const statusConfig = {
  active: {
    icon: CheckCircle2,
    label: 'Active',
    color: 'text-success',
    bgColor: 'bg-success/20',
    borderColor: 'border-success/30',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    color: 'text-warning',
    bgColor: 'bg-warning/20',
    borderColor: 'border-warning/30',
  },
  failed: {
    icon: AlertCircle,
    label: 'Failed',
    color: 'text-destructive',
    bgColor: 'bg-destructive/20',
    borderColor: 'border-destructive/30',
  },
  inactive: {
    icon: Clock,
    label: 'Inactive',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/20',
    borderColor: 'border-muted/30',
  },
};

const sslStatusConfig = {
  active: {
    icon: ShieldCheck,
    label: 'SSL Active',
    color: 'text-success',
    bgColor: 'bg-success/20',
  },
  pending: {
    icon: Shield,
    label: 'Pending',
    color: 'text-warning',
    bgColor: 'bg-warning/20',
  },
  expired: {
    icon: ShieldX,
    label: 'Expired',
    color: 'text-destructive',
    bgColor: 'bg-destructive/20',
  },
  failed: {
    icon: ShieldX,
    label: 'Failed',
    color: 'text-destructive',
    bgColor: 'bg-destructive/20',
  },
  none: {
    icon: Shield,
    label: 'No SSL',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/20',
  },
};

export function DomainTable({
  domains,
  servers,
  products,
  onAddDomain,
  onVerify,
  onEnableSSL,
  onRemove,
  onView,
}: DomainTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDomains = domains.filter((domain) =>
    domain.domain_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getServerName = (serverId: string | null) => {
    if (!serverId) return '-';
    const server = servers.find((s) => s.id === serverId);
    return server?.name || '-';
  };

  const getProductName = (productId: string | null) => {
    if (!productId) return '-';
    const product = products.find((p) => p.id === productId);
    return product?.name || '-';
  };

  const getAutoSubdomain = (serverId: string | null) => {
    if (!serverId) return '-';
    const server = servers.find((s) => s.id === serverId);
    return server?.subdomain ? `${server.subdomain}.saasvala.com` : '-';
  };

  const getDaysUntilExpiry = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    return differenceInDays(new Date(expiryDate), new Date());
  };

  return (
    <div className="space-y-4">
      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/50 border-border"
          />
        </div>
        <Button onClick={onAddDomain} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
          <Plus className="h-4 w-4" />
          Add Domain
        </Button>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Product</TableHead>
              <TableHead className="text-muted-foreground">Server</TableHead>
              <TableHead className="text-muted-foreground">Primary Domain</TableHead>
              <TableHead className="text-muted-foreground hidden lg:table-cell">Auto Subdomain</TableHead>
              <TableHead className="text-muted-foreground">SSL Status</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">SSL Expiry</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDomains.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <Globe className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No domains found</p>
                  <p className="text-sm text-muted-foreground/70">Add your first domain to get started</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredDomains.map((domain) => {
                const status = statusConfig[domain.status as keyof typeof statusConfig] || statusConfig.inactive;
                const StatusIcon = status.icon;
                const sslStatus = sslStatusConfig[domain.ssl_status as keyof typeof sslStatusConfig] || sslStatusConfig.none;
                const SslIcon = sslStatus.icon;
                const daysUntilExpiry = getDaysUntilExpiry(domain.ssl_expiry_at);

                return (
                  <TableRow key={domain.id} className="border-border hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {getProductName(domain.product_id)}
                        </span>
                        {domain.is_primary && (
                          <Badge className="bg-primary text-primary-foreground text-[10px]">Primary</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getServerName(domain.server_id)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`https://${domain.domain_name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          {domain.domain_name}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {getAutoSubdomain(domain.server_id)}
                    </TableCell>
                    <TableCell>
                      <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full w-fit', sslStatus.bgColor)}>
                        <SslIcon className={cn('h-3 w-3', sslStatus.color)} />
                        <span className={cn('text-xs font-medium', sslStatus.color)}>{sslStatus.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {domain.ssl_expiry_at ? (
                        <div className="flex flex-col">
                          <span className="text-sm text-foreground">
                            {format(new Date(domain.ssl_expiry_at), 'MMM dd, yyyy')}
                          </span>
                          {daysUntilExpiry !== null && daysUntilExpiry <= 15 && (
                            <span className="text-xs text-warning">Expires in {daysUntilExpiry} days</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(status.bgColor, status.color, status.borderColor)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onView(domain)}
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {domain.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onVerify(domain.id)}
                          >
                            <RefreshCw className="h-4 w-4 text-cyan" />
                          </Button>
                        )}
                        {domain.ssl_status !== 'active' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEnableSSL(domain.id)}
                          >
                            <Shield className="h-4 w-4 text-warning" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => onRemove(domain.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
