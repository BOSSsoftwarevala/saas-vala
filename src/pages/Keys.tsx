import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Key,
  Copy,
  Pause,
  Ban,
  RefreshCw,
  Trash2,
  Play,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLicenseKeys, type LicenseKey } from '@/hooks/useLicenseKeys';
import { useProducts } from '@/hooks/useProducts';

const statusConfig = {
  active: { label: 'Active', style: 'bg-success/20 text-success border-success/30' },
  suspended: { label: 'Suspended', style: 'bg-warning/20 text-warning border-warning/30' },
  revoked: { label: 'Revoked', style: 'bg-destructive/20 text-destructive border-destructive/30' },
  expired: { label: 'Expired', style: 'bg-muted text-muted-foreground border-muted-foreground/30' },
};

const keyTypeConfig = {
  lifetime: { label: 'Lifetime', style: 'bg-primary/20 text-primary border-primary/30' },
  yearly: { label: 'Yearly', style: 'bg-cyan/20 text-cyan border-cyan/30' },
  monthly: { label: 'Monthly', style: 'bg-purple/20 text-purple border-purple/30' },
  trial: { label: 'Trial', style: 'bg-warning/20 text-warning border-warning/30' },
};

export default function Keys() {
  const { keys, loading, createKey, deleteKey, suspendKey, activateKey, revokeKey, generateKeyString } = useLicenseKeys();
  const { products } = useProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    product_id: '',
    key_type: 'yearly' as LicenseKey['key_type'],
    owner_name: '',
    owner_email: '',
    max_devices: 1,
    expires_at: '',
    notes: '',
  });

  const filteredKeys = keys.filter(
    (key) =>
      key.license_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      key.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      key.owner_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    active: keys.filter(k => k.status === 'active').length,
    suspended: keys.filter(k => k.status === 'suspended').length,
    revoked: keys.filter(k => k.status === 'revoked').length,
    expired: keys.filter(k => k.status === 'expired').length,
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('License key copied to clipboard');
  };

  const openCreateDialog = () => {
    setFormData({
      product_id: products[0]?.id || '',
      key_type: 'yearly',
      owner_name: '',
      owner_email: '',
      max_devices: 1,
      expires_at: '',
      notes: '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.product_id) {
      toast.error('Please select a product');
      return;
    }
    setSubmitting(true);
    try {
      await createKey({
        product_id: formData.product_id,
        key_type: formData.key_type,
        owner_name: formData.owner_name || null,
        owner_email: formData.owner_email || null,
        max_devices: formData.max_devices,
        expires_at: formData.expires_at || null,
        notes: formData.notes || null,
      });
      setDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteKey(deleteId);
    setDeleteId(null);
  };

  const getProductName = (productId: string) => {
    return products.find(p => p.id === productId)?.name || 'Unknown';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Key Management
            </h2>
            <p className="text-muted-foreground">
              Generate and manage license keys
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={openCreateDialog} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
              <Plus className="h-4 w-4" />
              Generate Key
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-success">{stats.active}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-warning">{stats.suspended}</p>
            <p className="text-sm text-muted-foreground">Suspended</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.revoked}</p>
            <p className="text-sm text-muted-foreground">Revoked</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{stats.expired}</p>
            <p className="text-sm text-muted-foreground">Expired</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by key, name, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50 border-border"
              />
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              className="border-border"
              onClick={() => toast.info('Filter options coming soon')}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Keys Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Key className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-foreground mb-2">No license keys found</h3>
              <p className="text-muted-foreground mb-4">Generate your first license key</p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Generate Key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="text-muted-foreground">License Key</TableHead>
                  <TableHead className="text-muted-foreground">Product</TableHead>
                  <TableHead className="text-muted-foreground">Owner</TableHead>
                  <TableHead className="text-muted-foreground">Type</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Expires</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKeys.map((keyItem) => {
                  const status = statusConfig[keyItem.status];
                  const keyType = keyTypeConfig[keyItem.key_type];
                  return (
                    <TableRow key={keyItem.id} className="border-border hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-primary" />
                          <code className="text-sm font-mono text-foreground">{keyItem.license_key}</code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(keyItem.license_key)}
                          >
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">{getProductName(keyItem.product_id)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-foreground">{keyItem.owner_name || '-'}</p>
                          <p className="text-xs text-muted-foreground">{keyItem.owner_email || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={keyType.style}>
                          {keyType.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.style}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {keyItem.expires_at ? new Date(keyItem.expires_at).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border-border">
                            {keyItem.status === 'suspended' ? (
                              <DropdownMenuItem className="gap-2 cursor-pointer text-success" onClick={() => activateKey(keyItem.id)}>
                                <Play className="h-4 w-4" /> Activate
                              </DropdownMenuItem>
                            ) : keyItem.status === 'active' && (
                              <DropdownMenuItem className="gap-2 cursor-pointer text-warning" onClick={() => suspendKey(keyItem.id)}>
                                <Pause className="h-4 w-4" /> Suspend
                              </DropdownMenuItem>
                            )}
                            {keyItem.status !== 'revoked' && (
                              <DropdownMenuItem className="gap-2 cursor-pointer text-destructive" onClick={() => revokeKey(keyItem.id)}>
                                <Ban className="h-4 w-4" /> Revoke
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="gap-2 cursor-pointer text-destructive" onClick={() => setDeleteId(keyItem.id)}>
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Generate Key Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate License Key</DialogTitle>
            <DialogDescription>
              Create a new license key for a product
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select value={formData.product_id} onValueChange={(v) => setFormData({ ...formData, product_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Key Type</Label>
                <Select value={formData.key_type} onValueChange={(v) => setFormData({ ...formData, key_type: v as LicenseKey['key_type'] })}>
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
                  min="1"
                  value={formData.max_devices}
                  onChange={(e) => setFormData({ ...formData, max_devices: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label>Expires At</Label>
              <Input
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Internal notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !formData.product_id}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete License Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The license key will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
