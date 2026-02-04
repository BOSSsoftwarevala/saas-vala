import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Key, Loader2, Copy, CheckCircle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type KeyType = Database['public']['Enums']['key_type'];
type KeyStatus = Database['public']['Enums']['key_status'];

interface LicenseKey {
  id: string;
  license_key: string;
  product_id: string;
  key_type: KeyType;
  status: KeyStatus | null;
  owner_name: string | null;
  owner_email: string | null;
  max_devices: number | null;
  activated_devices: number | null;
  expires_at: string | null;
}

interface Product {
  id: string;
  name: string;
}

export function LicenseMapping() {
  const [licenses, setLicenses] = useState<LicenseKey[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    product_id: '',
    key_type: 'yearly' as KeyType,
    owner_name: '',
    owner_email: '',
    max_devices: 1,
  });

  const fetchLicenses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('license_keys')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      toast.error('Failed to fetch licenses');
    } else {
      setLicenses((data || []) as LicenseKey[]);
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name')
      .eq('status', 'active')
      .order('name');

    if (error) {
      console.error(error);
    } else {
      setProducts((data || []) as Product[]);
    }
  };

  useEffect(() => {
    fetchLicenses();
    fetchProducts();
  }, []);

  const openCreateDialog = () => {
    setFormData({
      product_id: '',
      key_type: 'yearly',
      owner_name: '',
      owner_email: '',
      max_devices: 1,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.product_id) {
      toast.error('Product is required');
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      // Generate a license key using the database function
      const { data: keyData, error: keyError } = await supabase.rpc('generate_license_key');
      if (keyError) throw keyError;

      const { error } = await supabase.from('license_keys').insert({
        license_key: keyData,
        product_id: formData.product_id,
        key_type: formData.key_type,
        owner_name: formData.owner_name || null,
        owner_email: formData.owner_email || null,
        max_devices: formData.max_devices,
        created_by: userData.user?.id,
      });

      if (error) throw error;
      toast.success('License key generated');
      setDialogOpen(false);
      await fetchLicenses();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate license');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (key: string, id: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedId(id);
    toast.success('License key copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product?.name || 'Unknown';
  };

  const statusStyles = {
    active: 'bg-success/20 text-success border-success/30',
    expired: 'bg-warning/20 text-warning border-warning/30',
    suspended: 'bg-destructive/20 text-destructive border-destructive/30',
    revoked: 'bg-muted text-muted-foreground border-muted-foreground/30',
  };

  const keyTypeLabels = {
    lifetime: 'Lifetime',
    yearly: 'Yearly',
    monthly: 'Monthly',
    trial: 'Trial',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">License Mapping</h3>
        <Button onClick={openCreateDialog} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
          <Key className="h-4 w-4" />
          Generate Key
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : licenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-muted-foreground mb-4">No licenses generated</p>
            <Button onClick={openCreateDialog}>
              <Key className="h-4 w-4 mr-2" />
              Generate First Key
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">License Key</TableHead>
                <TableHead className="text-muted-foreground">Product</TableHead>
                <TableHead className="text-muted-foreground">Type</TableHead>
                <TableHead className="text-muted-foreground">Owner</TableHead>
                <TableHead className="text-muted-foreground">Devices</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses.map((license) => (
                <TableRow key={license.id} className="border-border hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {license.license_key.slice(0, 12)}...
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(license.license_key, license.id)}
                        className="h-6 w-6"
                      >
                        {copiedId === license.id ? (
                          <CheckCircle className="h-3 w-3 text-success" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {getProductName(license.product_id)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {keyTypeLabels[license.key_type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {license.owner_name || license.owner_email || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {license.activated_devices || 0} / {license.max_devices || 1}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusStyles[license.status || 'active']}
                    >
                      {license.status || 'active'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Generate Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate License Key</DialogTitle>
            <DialogDescription>
              Create a new license key for a product
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select
                value={formData.product_id}
                onValueChange={(v) => setFormData({ ...formData, product_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Key Type</Label>
                <Select
                  value={formData.key_type}
                  onValueChange={(v) => setFormData({ ...formData, key_type: v as KeyType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max Devices</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.max_devices}
                  onChange={(e) => setFormData({ ...formData, max_devices: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Owner Name</Label>
              <Input
                placeholder="John Doe"
                value={formData.owner_name}
                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Owner Email</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={formData.owner_email}
                onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !formData.product_id}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
