import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Download, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type ApkStatus = Database['public']['Enums']['apk_status'];

interface Apk {
  id: string;
  version: string;
  product_id: string;
  file_url: string | null;
  file_size: number | null;
  status: ApkStatus | null;
  changelog: string | null;
  min_sdk: number | null;
  target_sdk: number | null;
  download_count: number | null;
}

interface Product {
  id: string;
  name: string;
}

export function ApkMapping() {
  const [apks, setApks] = useState<Apk[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editApk, setEditApk] = useState<Apk | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    version: '',
    product_id: '',
    file_url: '',
    status: 'draft' as ApkStatus,
    changelog: '',
    min_sdk: 21,
    target_sdk: 34,
  });

  const fetchApks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('apks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch APKs');
    } else {
      setApks((data || []) as Apk[]);
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name')
      .order('name');

    if (error) {
      console.error(error);
    } else {
      setProducts((data || []) as Product[]);
    }
  };

  useEffect(() => {
    fetchApks();
    fetchProducts();
  }, []);

  const openCreateDialog = () => {
    setEditApk(null);
    setFormData({
      version: '',
      product_id: '',
      file_url: '',
      status: 'draft',
      changelog: '',
      min_sdk: 21,
      target_sdk: 34,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (apk: Apk) => {
    setEditApk(apk);
    setFormData({
      version: apk.version,
      product_id: apk.product_id,
      file_url: apk.file_url || '',
      status: apk.status || 'draft',
      changelog: apk.changelog || '',
      min_sdk: apk.min_sdk || 21,
      target_sdk: apk.target_sdk || 34,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.version.trim() || !formData.product_id) {
      toast.error('Version and product are required');
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      if (editApk) {
        const { error } = await supabase
          .from('apks')
          .update({
            version: formData.version,
            product_id: formData.product_id,
            file_url: formData.file_url || null,
            status: formData.status,
            changelog: formData.changelog || null,
            min_sdk: formData.min_sdk,
            target_sdk: formData.target_sdk,
          })
          .eq('id', editApk.id);

        if (error) throw error;
        toast.success('APK updated');
      } else {
        const { error } = await supabase.from('apks').insert({
          version: formData.version,
          product_id: formData.product_id,
          file_url: formData.file_url || null,
          status: formData.status,
          changelog: formData.changelog || null,
          min_sdk: formData.min_sdk,
          target_sdk: formData.target_sdk,
          created_by: userData.user?.id,
        });

        if (error) throw error;
        toast.success('APK created');
      }

      setDialogOpen(false);
      await fetchApks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save APK');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase.from('apks').delete().eq('id', deleteId);

    if (error) {
      toast.error('Failed to delete APK');
    } else {
      toast.success('APK deleted');
      await fetchApks();
    }
    setDeleteId(null);
  };

  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product?.name || 'Unknown';
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const statusStyles = {
    published: 'bg-success/20 text-success border-success/30',
    draft: 'bg-warning/20 text-warning border-warning/30',
    deprecated: 'bg-muted text-muted-foreground border-muted-foreground/30',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">APK Mapping</h3>
        <Button onClick={openCreateDialog} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
          <Plus className="h-4 w-4" />
          Add APK
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : apks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-muted-foreground mb-4">No APKs configured</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add First APK
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">Product</TableHead>
                <TableHead className="text-muted-foreground">Version</TableHead>
                <TableHead className="text-muted-foreground">SDK</TableHead>
                <TableHead className="text-muted-foreground">Size</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Downloads</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apks.map((apk) => (
                <TableRow key={apk.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-medium text-foreground">
                    {getProductName(apk.product_id)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{apk.version}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {apk.min_sdk}-{apk.target_sdk}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFileSize(apk.file_size)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusStyles[apk.status || 'draft']}
                    >
                      {apk.status || 'draft'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {apk.download_count || 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {apk.file_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8"
                        >
                          <a href={apk.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(apk)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(apk.id)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editApk ? 'Edit' : 'Add'} APK</DialogTitle>
            <DialogDescription>
              {editApk ? 'Update APK details' : 'Link an APK to a product'}
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
                <Label>Version *</Label>
                <Input
                  placeholder="1.0.0"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as ApkStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="deprecated">Deprecated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>File URL</Label>
              <Input
                placeholder="https://storage.example.com/app.apk"
                value={formData.file_url}
                onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min SDK</Label>
                <Input
                  type="number"
                  value={formData.min_sdk}
                  onChange={(e) => setFormData({ ...formData, min_sdk: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Target SDK</Label>
                <Input
                  type="number"
                  value={formData.target_sdk}
                  onChange={(e) => setFormData({ ...formData, target_sdk: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Changelog</Label>
              <Textarea
                placeholder="What's new in this version..."
                value={formData.changelog}
                onChange={(e) => setFormData({ ...formData, changelog: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formData.version.trim() || !formData.product_id}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editApk ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete APK?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The APK record will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
