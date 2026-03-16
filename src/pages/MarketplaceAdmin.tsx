import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Package, Search, Plus, Edit2, Trash2, Eye, EyeOff,
  ExternalLink, Download, Star, Image as ImageIcon, Link2, Loader2,
  Layout, Megaphone, RefreshCw, CheckCircle2, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: string; name: string; slug: string; description: string | null;
  short_description: string | null; price: number; status: string;
  thumbnail_url: string | null; git_repo_url: string | null;
  demo_url: string | null; demo_login: string | null; demo_password: string | null;
  demo_enabled: boolean; apk_url: string | null; featured: boolean;
  trending: boolean; marketplace_visible: boolean; business_type: string | null;
  created_at: string;
}

interface BannerSlide {
  id: string; title: string; subtitle: string; image: string;
  badge: string; badgeColor: string; active: boolean;
}

const defaultBanners: BannerSlide[] = [
  { id: 'mega-sale', title: '🔥 ALL SOFTWARE — ONLY $5', subtitle: '2000+ products with source code.', image: '', badge: 'MEGA SALE', badgeColor: 'from-red-500 to-orange-500', active: true },
  { id: 'healthcare', title: '🏥 Healthcare Suite', subtitle: 'Hospital ERP, Clinic Manager, Lab System.', image: '', badge: 'NEW', badgeColor: 'from-emerald-500 to-teal-500', active: true },
  { id: 'festival', title: '🎉 Festival Offer — 20% OFF', subtitle: 'Buy 3 Get 1 FREE. Code: FESTIVAL2026', image: '', badge: 'LIMITED', badgeColor: 'from-amber-500 to-yellow-500', active: true },
  { id: 'diwali', title: '🪔 Diwali Dhamaka — India Special', subtitle: '₹99 mein koi bhi software.', image: '', badge: '🇮🇳 INDIA', badgeColor: 'from-orange-500 to-green-500', active: true },
  { id: 'eid', title: '🌙 Eid Sale — Arabic RTL Ready', subtitle: 'POS, Hospital, School — all localized.', image: '', badge: 'EID SALE', badgeColor: 'from-emerald-600 to-teal-600', active: true },
];

export default function MarketplaceAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [banners, setBanners] = useState<BannerSlide[]>(defaultBanners);
  const [editBanner, setEditBanner] = useState<BannerSlide | null>(null);
  
  const [bulkRunning, setBulkRunning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const PAGE_SIZE = 25;

  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase.from('products')
      .select('id, name, slug, description, short_description, price, status, thumbnail_url, git_repo_url, demo_url, demo_login, demo_password, demo_enabled, apk_url, featured, trending, marketplace_visible, business_type, created_at')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (search.trim()) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,business_type.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) toast.error('Failed to load products');
    else setProducts(data as Product[]);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [page, search]);

  const handleSave = async () => {
    if (!editProduct) return;
    setSaving(true);
    const { error } = await supabase.from('products').update({
      name: editProduct.name, short_description: editProduct.short_description,
      price: editProduct.price, status: editProduct.status as any,
      thumbnail_url: editProduct.thumbnail_url, git_repo_url: editProduct.git_repo_url,
      demo_url: editProduct.demo_url, demo_login: editProduct.demo_login,
      demo_password: editProduct.demo_password, demo_enabled: editProduct.demo_enabled,
      apk_url: editProduct.apk_url, featured: editProduct.featured,
      trending: editProduct.trending, marketplace_visible: editProduct.marketplace_visible,
      business_type: editProduct.business_type,
    }).eq('id', editProduct.id);
    if (error) toast.error('Save failed: ' + error.message);
    else { toast.success('Saved!'); setEditProduct(null); fetchProducts(); }
    setSaving(false);
  };

  const toggleVisibility = async (p: Product) => {
    await supabase.from('products').update({ marketplace_visible: !p.marketplace_visible }).eq('id', p.id);
    toast.success(p.marketplace_visible ? 'Hidden' : 'Visible');
    fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete permanently?')) return;
    await supabase.from('products').delete().eq('id', id);
    toast.success('Deleted'); fetchProducts();
  };

  const toggleSelect = (id: string) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  const selectAll = () => {
    if (selectedIds.size === products.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(products.map(p => p.id)));
  };

  const runBulkAction = async (action: string) => {
    if (selectedIds.size === 0) { toast.error('Select products first'); return; }
    setBulkRunning(true);
    const ids = Array.from(selectedIds);
    let update: any = {};
    if (action === 'show') update = { marketplace_visible: true };
    else if (action === 'hide') update = { marketplace_visible: false };
    else if (action === 'feature') update = { featured: true };
    else if (action === 'unfeature') update = { featured: false };
    else if (action === 'trending') update = { trending: true };
    else if (action === 'price5') update = { price: 5 };
    else if (action === 'delete') {
      if (!confirm(`Delete ${ids.length} products?`)) { setBulkRunning(false); return; }
      for (const id of ids) await supabase.from('products').delete().eq('id', id);
      toast.success(`Deleted ${ids.length} products`);
      setSelectedIds(new Set()); fetchProducts(); setBulkRunning(false); return;
    }
    for (const id of ids) await supabase.from('products').update(update).eq('id', id);
    toast.success(`Updated ${ids.length} products`);
    setSelectedIds(new Set()); fetchProducts(); setBulkRunning(false);
  };

  const saveBanner = () => {
    if (!editBanner) return;
    setBanners(prev => prev.map(b => b.id === editBanner.id ? editBanner : b));
    setEditBanner(null);
    toast.success('Banner updated! Changes apply on next deploy.');
  };

  const stats = [
    { label: 'Total', value: products.length, color: 'text-foreground' },
    { label: 'Visible', value: products.filter(p => p.marketplace_visible).length, color: 'text-primary' },
    { label: 'Featured', value: products.filter(p => p.featured).length, color: 'text-yellow-500' },
    { label: 'With Demo', value: products.filter(p => p.demo_url).length, color: 'text-emerald-500' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-foreground flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Marketplace Manager</h1>
            <p className="text-xs text-muted-foreground">Products, banners, pricing & bulk operations</p>
          </div>
          <Button size="sm" onClick={() => window.location.href = '/admin/add-product'} className="gap-1"><Plus className="h-3 w-3" /> Add Product</Button>
        </div>

        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-9">
            <TabsTrigger value="products" className="text-xs gap-1"><Package className="h-3 w-3" /> Products</TabsTrigger>
            <TabsTrigger value="banners" className="text-xs gap-1"><Layout className="h-3 w-3" /> Banners</TabsTrigger>
            <TabsTrigger value="bulk" className="text-xs gap-1"><RefreshCw className="h-3 w-3" /> Bulk Ops</TabsTrigger>
          </TabsList>

          {/* PRODUCTS TAB */}
          <TabsContent value="products" className="space-y-3 mt-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9 text-sm" /></div>

            <div className="grid grid-cols-4 gap-2">
              {stats.map(s => (
                <div key={s.label} className="rounded-lg border border-border p-2 bg-card"><p className="text-[10px] text-muted-foreground">{s.label}</p><p className={cn('text-lg font-black', s.color)}>{s.value}</p></div>
              ))}
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="p-2 text-left"><input type="checkbox" checked={selectedIds.size === products.length && products.length > 0} onChange={selectAll} /></th>
                      <th className="p-2 text-left font-semibold text-muted-foreground">Product</th>
                      <th className="p-2 text-center font-semibold text-muted-foreground">Price</th>
                      <th className="p-2 text-center font-semibold text-muted-foreground hidden sm:table-cell">Status</th>
                      <th className="p-2 text-right font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-t border-border"><td colSpan={5} className="p-2"><Skeleton className="h-7 w-full" /></td></tr>
                    )) : products.length === 0 ? (
                      <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">No products</td></tr>
                    ) : products.map(p => (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/10">
                        <td className="p-2"><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-muted flex items-center justify-center"><ImageIcon className="h-3 w-3 text-muted-foreground" /></div>}
                            <div className="min-w-0"><p className="font-semibold text-foreground truncate max-w-[160px]">{p.name}</p><p className="text-[10px] text-muted-foreground">{p.business_type || '—'}</p></div>
                            {p.featured && <Star className="h-3 w-3 text-yellow-500 shrink-0" />}
                          </div>
                        </td>
                        <td className="p-2 text-center font-bold text-primary">${p.price}</td>
                        <td className="p-2 text-center hidden sm:table-cell">
                          <Badge className={cn('text-[9px]', p.marketplace_visible ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground')}>{p.marketplace_visible ? 'Live' : 'Hidden'}</Badge>
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditProduct(p)}><Edit2 className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleVisibility(p)}>{p.marketplace_visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteProduct(p.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Page {page + 1}</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={products.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          </TabsContent>

          {/* BANNERS TAB */}
          <TabsContent value="banners" className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> Hero Banner Slides</h2>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setBanners(prev => [...prev, { id: `custom-${Date.now()}`, title: 'New Slide', subtitle: 'Description...', image: '', badge: 'NEW', badgeColor: 'from-blue-500 to-indigo-500', active: true }])}>
                <Plus className="h-3 w-3" /> Add Slide
              </Button>
            </div>
            <div className="grid gap-2">
              {banners.map((b, i) => (
                <div key={b.id} className={cn('rounded-lg border p-3 flex items-center gap-3', b.active ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30')}>
                  <span className="text-lg font-black text-muted-foreground w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{b.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{b.subtitle}</p>
                  </div>
                  <Badge className={cn('text-[9px] bg-gradient-to-r text-white', b.badgeColor)}>{b.badge}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setBanners(prev => prev.map(x => x.id === b.id ? { ...x, active: !x.active } : x))}>
                    {b.active ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditBanner(b)}><Edit2 className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setBanners(prev => prev.filter(x => x.id !== b.id))}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">💡 Banner changes apply to the homepage hero slider. Drag to reorder (coming soon).</p>
          </TabsContent>

          {/* BULK OPS TAB */}
          <TabsContent value="bulk" className="space-y-3 mt-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><RefreshCw className="h-4 w-4 text-primary" /> Bulk Operations</h2>
            <p className="text-xs text-muted-foreground">Select products in the Products tab, then run bulk actions here. Selected: <strong className="text-primary">{selectedIds.size}</strong></p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { action: 'show', label: 'Show All', icon: Eye, color: 'text-emerald-500' },
                { action: 'hide', label: 'Hide All', icon: EyeOff, color: 'text-muted-foreground' },
                { action: 'feature', label: 'Set Featured', icon: Star, color: 'text-yellow-500' },
                { action: 'unfeature', label: 'Remove Featured', icon: Star, color: 'text-muted-foreground' },
                { action: 'trending', label: 'Set Trending', icon: Megaphone, color: 'text-purple-500' },
                { action: 'price5', label: 'Set Price $5', icon: Package, color: 'text-primary' },
                { action: 'delete', label: 'Delete Selected', icon: Trash2, color: 'text-destructive' },
              ].map(({ action, label, icon: Icon, color }) => (
                <Button key={action} variant="outline" size="sm" className={cn('h-10 text-xs gap-1.5 justify-start', color)} disabled={bulkRunning || selectedIds.size === 0} onClick={() => runBulkAction(action)}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </Button>
              ))}
            </div>
            {bulkRunning && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Processing...</div>}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Product Dialog */}
      {editProduct && (
        <Dialog open={!!editProduct} onOpenChange={() => setEditProduct(null)}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-sm flex items-center gap-2"><Edit2 className="h-4 w-4 text-primary" /> Edit Product</DialogTitle><DialogDescription className="text-xs">{editProduct.slug}</DialogDescription></DialogHeader>
            <div className="space-y-3 mt-2">
              <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">Name</label><Input value={editProduct.name || ''} onChange={e => setEditProduct({ ...editProduct, name: e.target.value })} className="h-9 text-sm" /></div>
              <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">Description</label><Input value={editProduct.short_description || ''} onChange={e => setEditProduct({ ...editProduct, short_description: e.target.value })} className="h-9 text-sm" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">Price ($)</label><Input type="number" value={editProduct.price} onChange={e => setEditProduct({ ...editProduct, price: Number(e.target.value) })} className="h-9 text-sm" /></div>
                <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">Category</label><Input value={editProduct.business_type || ''} onChange={e => setEditProduct({ ...editProduct, business_type: e.target.value })} className="h-9 text-sm" /></div>
              </div>
              <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Thumbnail</label><Input value={editProduct.thumbnail_url || ''} onChange={e => setEditProduct({ ...editProduct, thumbnail_url: e.target.value })} className="h-9 text-sm" placeholder="https://..." /></div>
              <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block flex items-center gap-1"><Link2 className="h-3 w-3" /> Git Repo</label><Input value={editProduct.git_repo_url || ''} onChange={e => setEditProduct({ ...editProduct, git_repo_url: e.target.value })} className="h-9 text-sm" /></div>
              <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Demo URL</label><Input value={editProduct.demo_url || ''} onChange={e => setEditProduct({ ...editProduct, demo_url: e.target.value })} className="h-9 text-sm" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">Demo Login</label><Input value={editProduct.demo_login || ''} onChange={e => setEditProduct({ ...editProduct, demo_login: e.target.value })} className="h-9 text-sm" /></div>
                <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">Demo Password</label><Input value={editProduct.demo_password || ''} onChange={e => setEditProduct({ ...editProduct, demo_password: e.target.value })} className="h-9 text-sm" /></div>
              </div>
              <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block flex items-center gap-1"><Download className="h-3 w-3" /> APK URL</label><Input value={editProduct.apk_url || ''} onChange={e => setEditProduct({ ...editProduct, apk_url: e.target.value })} className="h-9 text-sm" /></div>
              <div className="flex flex-wrap gap-2">
                {[{ key: 'marketplace_visible', label: 'Visible' }, { key: 'featured', label: 'Featured' }, { key: 'trending', label: 'Trending' }, { key: 'demo_enabled', label: 'Demo' }].map(t => (
                  <button key={t.key} onClick={() => setEditProduct({ ...editProduct, [t.key]: !(editProduct as any)[t.key] })}
                    className={cn('px-2.5 py-1 rounded-lg text-[10px] font-semibold border', (editProduct as any)[t.key] ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border')}>
                    {(editProduct as any)[t.key] ? '✓' : '○'} {t.label}
                  </button>
                ))}
              </div>
              <Button className="w-full h-10 text-sm" onClick={handleSave} disabled={saving}>{saving ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Saving...</> : 'Save Changes'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Banner Dialog */}
      {editBanner && (
        <Dialog open={!!editBanner} onOpenChange={() => setEditBanner(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-sm">Edit Banner Slide</DialogTitle><DialogDescription className="text-xs">Update hero banner content</DialogDescription></DialogHeader>
            <div className="space-y-3 mt-2">
              <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">Title</label><Input value={editBanner.title} onChange={e => setEditBanner({ ...editBanner, title: e.target.value })} className="h-9 text-sm" /></div>
              <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">Subtitle</label><Input value={editBanner.subtitle} onChange={e => setEditBanner({ ...editBanner, subtitle: e.target.value })} className="h-9 text-sm" /></div>
              <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">Image URL</label><Input value={editBanner.image} onChange={e => setEditBanner({ ...editBanner, image: e.target.value })} className="h-9 text-sm" placeholder="https://..." /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">Badge</label><Input value={editBanner.badge} onChange={e => setEditBanner({ ...editBanner, badge: e.target.value })} className="h-9 text-sm" /></div>
                <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">Badge Color</label><Input value={editBanner.badgeColor} onChange={e => setEditBanner({ ...editBanner, badgeColor: e.target.value })} className="h-9 text-sm" placeholder="from-red-500 to-orange-500" /></div>
              </div>
              <Button className="w-full h-10 text-sm" onClick={saveBanner}>Save Banner</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
