import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Globe,
  CheckCircle2,
  Clock,
  AlertCircle,
  Shield,
  Copy,
  Check,
  RefreshCw,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
}

interface Server {
  id: string;
  name: string;
  subdomain: string | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
}

interface DomainDrawerProps {
  open: boolean;
  onClose: () => void;
  domain?: Domain | null;
  servers: Server[];
  products: Product[];
  onSave: (data: Partial<Domain>) => void;
  onVerify: (domainId: string) => void;
}

const dnsRecords = [
  { type: 'A', host: '@', value: '185.158.133.1' },
  { type: 'CNAME', host: 'www', value: 'cname.saasvala.com' },
];

export function DomainDrawer({
  open,
  onClose,
  domain,
  servers,
  products,
  onSave,
  onVerify,
}: DomainDrawerProps) {
  const [formData, setFormData] = useState({
    product_id: '',
    server_id: '',
    domain_name: '',
    domain_type: 'production',
    is_primary: false,
    ssl_auto_renew: true,
  });
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const mode = domain ? 'edit' : 'create';

  useEffect(() => {
    if (domain) {
      setFormData({
        product_id: domain.product_id || '',
        server_id: domain.server_id || '',
        domain_name: domain.domain_name,
        domain_type: domain.domain_type || 'production',
        is_primary: domain.is_primary || false,
        ssl_auto_renew: true,
      });
    } else {
      setFormData({
        product_id: '',
        server_id: '',
        domain_name: '',
        domain_type: 'production',
        is_primary: false,
        ssl_auto_renew: true,
      });
    }
  }, [domain, open]);

  const selectedProduct = products.find((p) => p.id === formData.product_id);
  const selectedServer = servers.find((s) => s.id === formData.server_id);
  
  const autoSubdomain = selectedProduct 
    ? `${selectedProduct.slug}.saasvala.com` 
    : selectedServer?.subdomain 
      ? `${selectedServer.subdomain}.saasvala.com`
      : null;

  const copyValue = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedRecord(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopiedRecord(null), 2000);
  };

  const handleVerify = async () => {
    if (!domain) return;
    setIsVerifying(true);
    await onVerify(domain.id);
    setTimeout(() => setIsVerifying(false), 2000);
  };

  const handleSave = async () => {
    if (!formData.domain_name && mode === 'create') {
      toast.error('Domain name is required');
      return;
    }
    
    setIsSaving(true);
    await onSave({
      ...formData,
      id: domain?.id,
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg glass-card border-border overflow-y-auto">
        <SheetHeader className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-warning/20 flex items-center justify-center">
              <Globe className="h-5 w-5 text-warning" />
            </div>
            <div>
              <SheetTitle className="text-lg">
                {mode === 'create' ? 'Add Domain' : 'Edit Domain'}
              </SheetTitle>
              <SheetDescription>
                {mode === 'create' ? 'Connect a custom domain' : 'Manage domain settings'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Product Selection */}
          <div className="space-y-2">
            <Label htmlFor="product">Select Product</Label>
            <Select
              value={formData.product_id}
              onValueChange={(v) => setFormData({ ...formData, product_id: v })}
            >
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue placeholder="Choose a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Server Selection */}
          <div className="space-y-2">
            <Label htmlFor="server">Select Server</Label>
            <Select
              value={formData.server_id}
              onValueChange={(v) => setFormData({ ...formData, server_id: v })}
            >
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue placeholder="Choose a server" />
              </SelectTrigger>
              <SelectContent>
                {servers.map((server) => (
                  <SelectItem key={server.id} value={server.id}>
                    {server.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Primary Domain */}
          <div className="space-y-2">
            <Label htmlFor="domain">Primary Domain</Label>
            <Input
              id="domain"
              placeholder="example.com"
              value={formData.domain_name}
              onChange={(e) => setFormData({ ...formData, domain_name: e.target.value })}
              className="bg-muted/50 border-border"
            />
          </div>

          {/* Auto Subdomain (Read Only) */}
          {autoSubdomain && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Auto Subdomain
                <Badge variant="outline" className="text-xs bg-success/20 text-success border-success/30">
                  Auto Generated
                </Badge>
              </Label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Globe className="h-4 w-4 text-cyan" />
                <span className="text-sm font-mono text-foreground flex-1">{autoSubdomain}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyValue(autoSubdomain, 'Subdomain')}
                >
                  {copiedRecord === 'Subdomain' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Domain Type */}
          <div className="space-y-2">
            <Label>Domain Type</Label>
            <Select
              value={formData.domain_type}
              onValueChange={(v) => setFormData({ ...formData, domain_type: v })}
            >
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="preview">Preview</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* SSL Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium text-foreground">SSL Auto-Renewal</p>
                <p className="text-xs text-muted-foreground">Auto-renew 15 days before expiry</p>
              </div>
            </div>
            <Switch
              checked={formData.ssl_auto_renew}
              onCheckedChange={(v) => setFormData({ ...formData, ssl_auto_renew: v })}
            />
          </div>

          {/* Primary Domain Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Set as Primary</p>
                <p className="text-xs text-muted-foreground">Main domain for this product</p>
              </div>
            </div>
            <Switch
              checked={formData.is_primary}
              onCheckedChange={(v) => setFormData({ ...formData, is_primary: v })}
            />
          </div>

          {/* DNS Records (shown for pending/new domains) */}
          {(mode === 'create' || domain?.status === 'pending') && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-warning/30">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <AlertCircle className="h-4 w-4 text-warning" />
                DNS Records Required
              </div>
              <p className="text-xs text-muted-foreground">
                Add these DNS records at your domain provider:
              </p>
              <div className="space-y-2">
                {dnsRecords.map((record) => (
                  <div
                    key={`${record.type}-${record.host}`}
                    className="flex items-center gap-2 p-2 rounded bg-muted/50"
                  >
                    <Badge variant="outline" className="border-border shrink-0">
                      {record.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground shrink-0 w-10">{record.host}</span>
                    <span className="text-xs font-mono text-foreground flex-1 truncate">
                      {record.value}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => copyValue(record.value, `${record.type} record`)}
                    >
                      {copiedRecord === `${record.type} record` ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                DNS changes can take up to 24-48 hours to propagate.
              </p>
            </div>
          )}

          {/* Status Badge for existing domains */}
          {domain && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div>
                <p className="text-sm font-medium text-foreground">Domain Status</p>
                <p className="text-xs text-muted-foreground">
                  {domain.dns_verified ? 'DNS Verified' : 'Awaiting DNS verification'}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  domain.status === 'active'
                    ? 'bg-success/20 text-success border-success/30'
                    : domain.status === 'pending'
                    ? 'bg-warning/20 text-warning border-warning/30'
                    : 'bg-destructive/20 text-destructive border-destructive/30'
                )}
              >
                {domain.status === 'active' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {domain.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                {domain.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                {domain.status || 'Unknown'}
              </Badge>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <Button
              onClick={handleSave}
              className="bg-orange-gradient hover:opacity-90 text-white gap-2"
              disabled={isSaving}
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Domain
            </Button>

            {domain && domain.status === 'pending' && (
              <Button
                variant="outline"
                onClick={handleVerify}
                disabled={isVerifying}
                className="border-border gap-2"
              >
                {isVerifying ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Verify Domain
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
