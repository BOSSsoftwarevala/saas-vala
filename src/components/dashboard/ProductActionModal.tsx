import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { DashboardProduct } from '@/lib/dashboardApi';

interface ProductActionModalProps {
  open: boolean;
  action: 'view' | 'edit' | 'deploy' | null;
  product: DashboardProduct | null;
  onClose: () => void;
  onSave?: (product: Partial<DashboardProduct>) => Promise<void>;
  onDeploy?: (productId: string, serverId: string) => Promise<void>;
  servers?: Array<{ id: string; name: string }>;
}

export function ProductActionModal({
  open,
  action,
  product,
  onClose,
  onSave,
  onDeploy,
  servers = [],
}: ProductActionModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<DashboardProduct>>({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || 0,
    status: product?.status || 'active',
    apk: product?.apk || '',
  });
  const [selectedServer, setSelectedServer] = useState('');

  const handleSave = async () => {
    if (!product?.id || !onSave) return;
    setLoading(true);
    try {
      await onSave(formData);
      toast.success('Product updated successfully');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!product?.id || !selectedServer || !onDeploy) return;
    setLoading(true);
    try {
      await onDeploy(product.id, selectedServer);
      toast.success('Product deployed successfully');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to deploy product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        {action === 'view' && (
          <>
            <DialogHeader>
              <DialogTitle>Product Details</DialogTitle>
              <DialogDescription>View product information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Product Name</Label>
                <p className="font-medium text-foreground">{product?.name}</p>
              </div>
              {product?.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm text-foreground">{product.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Price</Label>
                  <p className="font-medium text-foreground">₹{product?.price?.toLocaleString() || '0'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p className="font-medium text-foreground capitalize">{product?.status}</p>
                </div>
              </div>
              {product?.apk && (
                <div>
                  <Label className="text-xs text-muted-foreground">APK</Label>
                  <p className="text-sm text-primary break-all">{product.apk}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="text-foreground">{new Date(product?.created_at || '').toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">By</Label>
                  <p className="text-foreground">{product?.created_by || 'System'}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {action === 'edit' && (
          <>
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>Update product details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Product Name</Label>
                <Input
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Product name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Product description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Price (₹)</Label>
                  <Input
                    type="number"
                    value={formData.price || 0}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status || 'active'} onValueChange={(value) => setFormData({ ...formData, status: value as 'active' | 'inactive' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>APK URL</Label>
                <Input
                  value={formData.apk || ''}
                  onChange={(e) => setFormData({ ...formData, apk: e.target.value })}
                  placeholder="APK URL"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading || !formData.name}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </>
        )}

        {action === 'deploy' && (
          <>
            <DialogHeader>
              <DialogTitle>Deploy Product</DialogTitle>
              <DialogDescription>Select a server to deploy {product?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select Server</Label>
                <Select value={selectedServer} onValueChange={setSelectedServer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a server..." />
                  </SelectTrigger>
                  <SelectContent>
                    {servers.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No servers available</div>
                    ) : (
                      servers.map((server) => (
                        <SelectItem key={server.id} value={server.id}>
                          {server.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleDeploy} disabled={loading || !selectedServer}>
                {loading ? 'Deploying...' : 'Deploy'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
