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
import { Plus, Edit, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type DemoStatus = Database['public']['Enums']['demo_status'];

interface Demo {
  id: string;
  name: string;
  url: string | null;
  product_id: string;
  status: DemoStatus | null;
  credentials: Record<string, any> | null;
  access_count: number | null;
  expires_at: string | null;
}

interface Product {
  id: string;
  name: string;
}

export function DemoMapping() {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDemo, setEditDemo] = useState<Demo | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    product_id: '',
    status: 'active' as DemoStatus,
    username: '',
    password: '',
  });

  const fetchDemos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('demos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch demos');
    } else {
      setDemos((data || []) as Demo[]);
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
    fetchDemos();
    fetchProducts();
  }, []);

  const openCreateDialog = () => {
    setEditDemo(null);
    setFormData({
      name: '',
      url: '',
      product_id: '',
      status: 'active',
      username: '',
      password: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (demo: Demo) => {
    setEditDemo(demo);
    const creds = demo.credentials || {};
    setFormData({
      name: demo.name,
      url: demo.url || '',
      product_id: demo.product_id,
      status: demo.status || 'active',
      username: creds.username || '',
      password: creds.password || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.product_id) {
      toast.error('Name and product are required');
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const credentials = formData.username || formData.password
        ? { username: formData.username, password: formData.password }
        : null;

      if (editDemo) {
        const { error } = await supabase
          .from('demos')
          .update({
            name: formData.name,
            url: formData.url || null,
            product_id: formData.product_id,
            status: formData.status,
            credentials,
          })
          .eq('id', editDemo.id);

        if (error) throw error;
        toast.success('Demo updated');
      } else {
        const { error } = await supabase.from('demos').insert({
          name: formData.name,
          url: formData.url || null,
          product_id: formData.product_id,
          status: formData.status,
          credentials,
          created_by: userData.user?.id,
        });

        if (error) throw error;
        toast.success('Demo created');
      }

      setDialogOpen(false);
      await fetchDemos();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save demo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase.from('demos').delete().eq('id', deleteId);

    if (error) {
      toast.error('Failed to delete demo');
    } else {
      toast.success('Demo deleted');
      await fetchDemos();
    }
    setDeleteId(null);
  };

  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product?.name || 'Unknown';
  };

  const statusStyles = {
    active: 'bg-success/20 text-success border-success/30',
    expired: 'bg-warning/20 text-warning border-warning/30',
    disabled: 'bg-destructive/20 text-destructive border-destructive/30',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Demo Mapping</h3>
        <Button onClick={openCreateDialog} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
          <Plus className="h-4 w-4" />
          Add Demo
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : demos.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-muted-foreground mb-4">No demos configured</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Demo
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">Demo Name</TableHead>
                <TableHead className="text-muted-foreground">Product</TableHead>
                <TableHead className="text-muted-foreground">URL</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Access</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demos.map((demo) => (
                <TableRow key={demo.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-medium text-foreground">{demo.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {getProductName(demo.product_id)}
                  </TableCell>
                  <TableCell>
                    {demo.url ? (
                      <a
                        href={demo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusStyles[demo.status || 'active']}
                    >
                      {demo.status || 'active'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {demo.access_count || 0} views
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(demo)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(demo.id)}
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
            <DialogTitle>{editDemo ? 'Edit' : 'Add'} Demo</DialogTitle>
            <DialogDescription>
              {editDemo ? 'Update demo details' : 'Link a demo to a product'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Demo Name *</Label>
              <Input
                placeholder="Main Demo"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
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
            <div className="space-y-2">
              <Label>Demo URL</Label>
              <Input
                placeholder="https://demo.example.com"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v as DemoStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  placeholder="demo_user"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formData.name.trim() || !formData.product_id}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editDemo ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Demo?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The demo link will be removed.
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
