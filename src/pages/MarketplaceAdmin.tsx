import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Package, Search, Plus, Edit2, Trash2, Eye, EyeOff,
  ExternalLink, Download, Star, Image as ImageIcon, Link2, Loader2, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  status: string;
  thumbnail_url: string | null;
  git_repo_url: string | null;
  demo_url: string | null;
  demo_login: string | null;
  demo_password: string | null;
  demo_enabled: boolean;
  apk_url: string | null;
  featured: boolean;
  trending: boolean;
  marketplace_visible: boolean;
  business_type: string | null;
  created_at: string;
}

export default function MarketplaceAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase
      .from('products')
      .select('id, name, slug, description, short_description, price, status, thumbnail_url, git_repo_url, demo_url, demo_login, demo_password, demo_enabled, apk_url, featured, trending, marketplace_visible, business_type, created_at')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,business_type.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load products');
    } else {
      setProducts(data as Product[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [page, search]);

  const handleSave = async () => {
    if (!editProduct) return;
    setSaving(true);
    const { error } = await supabase
      .from('products')
      .update({
        name: editProduct.name,
        short_description: editProduct.short_description,
        price: editProduct.price,
        status: editProduct.status,
        thumbnail_url: editProduct.thumbnail_url,
        git_repo_url: editProduct.git_repo_url,
        demo_url: editProduct.demo_url,
        demo_login: editProduct.demo_login,
        demo_password: editProduct.demo_password,
        demo_enabled: editProduct.demo_enabled,
        apk_url: editProduct.apk_url,
        featured: editProduct.featured,
        trending: editProduct.trending,
        marketplace_visible: editProduct.marketplace_visible,
        business_type: editProduct.business_type,
      })
      .eq('id', editProduct.id);

    if (error) {
      toast.error('Failed to save: ' + error.message);
    } else {
      toast.success('Product updated successfully');
      setEditProduct(null);
      fetchProducts();
    }
    setSaving(false);
  };

  const toggleVisibility = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .update({ marketplace_visible: !product.marketplace_visible })
      .eq('id', product.id);
    if (!error) {
      toast.success(product.marketplace_visible ? 'Hidden from marketplace' : 'Visible on marketplace');
      fetchProducts();
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product permanently?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) {
      toast.success('Product deleted');
      fetchProducts();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Marketplace Manager
            </h1>
            <p className="text-sm text-muted-foreground">Manage products, pricing, demos, APKs & banners</p>
          </div>
          <Button onClick={() => window.location.href = '/admin/add-product'} className="gap-2">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name, slug, or category..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: products.length, color: 'text-foreground' },
            { label: 'Visible', value: products.filter(p => p.marketplace_visible).length, color: 'text-primary' },
            { label: 'Featured', value: products.filter(p => p.featured).length, color: 'text-yellow-500' },
            { label: 'With Demo', value: products.filter(p => p.demo_url).length, color: 'text-emerald-500' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border p-3 bg-card">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Product Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left p-3 font-semibold text-muted-foreground">Product</th>
                  <th className="text-left p-3 font-semibold text-muted-foreground hidden md:table-cell">Category</th>
                  <th className="text-center p-3 font-semibold text-muted-foreground">Price</th>
                  <th className="text-center p-3 font-semibold text-muted-foreground hidden sm:table-cell">Status</th>
                  <th className="text-center p-3 font-semibold text-muted-foreground hidden lg:table-cell">Demo</th>
                  <th className="text-center p-3 font-semibold text-muted-foreground hidden lg:table-cell">APK</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      <td colSpan={7} className="p-3"><Skeleton className="h-8 w-full" /></td>
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No products found</td></tr>
                ) : (
                  products.map(p => (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/10 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {p.thumbnail_url ? (
                            <img src={p.thumbnail_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate max-w-[200px]">{p.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p.slug}</p>
                          </div>
                          {p.featured && <Star className="h-3 w-3 text-yellow-500 shrink-0" />}
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <Badge variant="outline" className="text-[10px]">{p.business_type || '—'}</Badge>
                      </td>
                      <td className="p-3 text-center font-bold text-primary">${p.price}</td>
                      <td className="p-3 text-center hidden sm:table-cell">
                        <Badge className={cn(
                          'text-[10px]',
                          p.marketplace_visible ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted text-muted-foreground'
                        )}>
                          {p.marketplace_visible ? 'Visible' : 'Hidden'}
                        </Badge>
                      </td>
                      <td className="p-3 text-center hidden lg:table-cell">
                        {p.demo_url ? (
                          <a href={p.demo_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                            <ExternalLink className="h-3 w-3 inline" />
                          </a>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="p-3 text-center hidden lg:table-cell">
                        {p.apk_url ? (
                          <Download className="h-3 w-3 text-emerald-500 mx-auto" />
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditProduct(p)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleVisibility(p)}>
                            {p.marketplace_visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteProduct(p.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page + 1} • Showing {products.length} products</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={products.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      {/* Edit Product Dialog */}
      {editProduct && (
        <Dialog open={!!editProduct} onOpenChange={() => setEditProduct(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-primary" />
                Edit Product
              </DialogTitle>
              <DialogDescription>{editProduct.slug}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Product Name</label>
                <Input value={editProduct.name || ''} onChange={e => setEditProduct({ ...editProduct, name: e.target.value })} />
              </div>

              {/* Short Description */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Short Description</label>
                <Input value={editProduct.short_description || ''} onChange={e => setEditProduct({ ...editProduct, short_description: e.target.value })} />
              </div>

              {/* Price & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Price ($)</label>
                  <Input type="number" value={editProduct.price} onChange={e => setEditProduct({ ...editProduct, price: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Category</label>
                  <Input value={editProduct.business_type || ''} onChange={e => setEditProduct({ ...editProduct, business_type: e.target.value })} />
                </div>
              </div>

              {/* Thumbnail URL */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> Thumbnail URL
                </label>
                <Input value={editProduct.thumbnail_url || ''} onChange={e => setEditProduct({ ...editProduct, thumbnail_url: e.target.value })} placeholder="https://..." />
              </div>

              {/* Git Repo URL */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Git Repo URL
                </label>
                <Input value={editProduct.git_repo_url || ''} onChange={e => setEditProduct({ ...editProduct, git_repo_url: e.target.value })} placeholder="https://github.com/..." />
              </div>

              {/* Demo URL */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Demo URL
                </label>
                <Input value={editProduct.demo_url || ''} onChange={e => setEditProduct({ ...editProduct, demo_url: e.target.value })} placeholder="https://demo.saasvala.com" />
              </div>

              {/* Demo Credentials */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Demo Login</label>
                  <Input value={editProduct.demo_login || ''} onChange={e => setEditProduct({ ...editProduct, demo_login: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Demo Password</label>
                  <Input value={editProduct.demo_password || ''} onChange={e => setEditProduct({ ...editProduct, demo_password: e.target.value })} />
                </div>
              </div>

              {/* APK URL */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block flex items-center gap-1">
                  <Download className="h-3 w-3" /> APK URL
                </label>
                <Input value={editProduct.apk_url || ''} onChange={e => setEditProduct({ ...editProduct, apk_url: e.target.value })} placeholder="https://..." />
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-3">
                {[
                  { key: 'marketplace_visible', label: 'Marketplace Visible' },
                  { key: 'featured', label: 'Featured' },
                  { key: 'trending', label: 'Trending' },
                  { key: 'demo_enabled', label: 'Demo Enabled' },
                ].map(toggle => (
                  <button
                    key={toggle.key}
                    onClick={() => setEditProduct({ ...editProduct, [toggle.key]: !(editProduct as any)[toggle.key] })}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                      (editProduct as any)[toggle.key]
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-muted text-muted-foreground border-border'
                    )}
                  >
                    {(editProduct as any)[toggle.key] ? '✓' : '○'} {toggle.label}
                  </button>
                ))}
              </div>

              {/* Save */}
              <Button className="w-full gap-2 h-11" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
