import { useState, useEffect, useCallback, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import {
  Search,
  ExternalLink,
  Package,
  Store,
  Eye,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Wallet,
  Loader2,
  CheckCircle2,
  Key,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | null;
  status: string | null;
  demo_url: string | null;
  thumbnail_url: string | null;
}

async function fetchAllProducts(): Promise<Product[]> {
  const all: Product[] = [];
  const PAGE_SIZE = 100;
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, description, price, status, demo_url, thumbnail_url')
      .eq('status', 'active')
      .neq('slug', '__payment_config__')
      .order('name')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error || !data || data.length === 0) { hasMore = false; break; }
    all.push(...(data as unknown as Product[]));
    if (data.length < PAGE_SIZE) hasMore = false;
    page++;
  }
  return all;
}

const generateLicenseKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array(4).fill(0).map(() =>
    Array(4).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('')
  ).join('-');
};

const ProductCard = memo(({ product, onBuy }: { product: Product; onBuy: (p: Product) => void }) => {
  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/?product=${product.slug}`);
    toast.success('Product link copied!');
  };

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="h-24 rounded-lg bg-muted/30 mb-3 flex items-center justify-center overflow-hidden">
          {product.thumbnail_url ? (
            <img src={product.thumbnail_url} alt={product.name} className="w-full h-full object-cover rounded-lg" loading="lazy" />
          ) : (
            <Package className="h-8 w-8 text-muted-foreground/30" />
          )}
        </div>
        <h3 className="font-semibold text-foreground text-sm mb-1 line-clamp-1">{product.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {product.description || 'Professional software solution'}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-primary">${product.price || 5}</span>
          <div className="flex gap-1.5">
            {product.demo_url && (
              <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => window.open(product.demo_url!, '_blank')}>
                <Eye className="h-3 w-3" />
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleCopyLink}>
              <ExternalLink className="h-3 w-3" />
            </Button>
            <Button size="sm" className="h-7 px-2.5 gap-1" onClick={() => onBuy(product)}>
              <ShoppingCart className="h-3 w-3" /> Buy
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
ProductCard.displayName = 'ProductCard';

export function ResellerMarketplacePanel() {
  const navigate = useNavigate();
  const { wallet, fetchWallet, deductBalance } = useWallet();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Buy dialog state
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [buyClientName, setBuyClientName] = useState('');
  const [buyClientEmail, setBuyClientEmail] = useState('');
  const [buying, setBuying] = useState(false);
  const [purchasedKey, setPurchasedKey] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    const data = await fetchAllProducts();
    setProducts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
    const channel = supabase
      .channel('reseller-marketplace-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => loadProducts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadProducts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
    toast.success(`Refreshed! ${products.length} products`);
  };

  const handleBuyClick = (product: Product) => {
    setBuyProduct(product);
    setBuyClientName('');
    setBuyClientEmail('');
    setPurchasedKey(null);
  };

  const handleBuyConfirm = async () => {
    if (!buyProduct || !wallet) return;
    if (!buyClientName.trim() || !buyClientEmail.trim()) {
      toast.error('Please fill client name & email');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyClientEmail)) {
      toast.error('Invalid email');
      return;
    }

    const cost = buyProduct.price || 5;
    if (wallet.balance < cost) {
      toast.error(`Insufficient balance. Need $${cost}, have $${wallet.balance.toFixed(2)}`);
      return;
    }

    setBuying(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not logged in');

      const key = generateLicenseKey();

      // Insert key
      const { error: keyErr } = await supabase.from('license_keys').insert({
        license_key: key,
        product_id: buyProduct.id,
        owner_name: buyClientName.trim(),
        owner_email: buyClientEmail.trim(),
        status: 'active',
        key_type: 'yearly' as const,
        created_by: userData.user.id,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (keyErr) throw keyErr;

      // Deduct
      await deductBalance(wallet.id, cost, `Purchase: ${buyProduct.name}`, key, 'marketplace_purchase');

      // Activity log
      await supabase.from('activity_logs').insert({
        entity_type: 'marketplace_purchase',
        entity_id: buyProduct.id,
        action: 'reseller_product_purchase',
        performed_by: userData.user.id,
        details: { product_name: buyProduct.name, cost, license_key: key, client: buyClientName.trim() }
      });

      setPurchasedKey(key);
      toast.success(`✅ Purchased! Key generated for ${buyProduct.name}`);
      fetchWallet();
    } catch (err: any) {
      console.error(err);
      toast.error('Purchase failed: ' + err.message);
    } finally {
      setBuying(false);
    }
  };

  const filtered = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">SaaS VALA Marketplace</h2>
          <p className="text-muted-foreground">
            {products.length} live products • Buy & generate keys instantly
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="py-1.5 px-3 gap-1.5">
            <Wallet className="h-3.5 w-3.5" />
            ${wallet?.balance?.toFixed(2) || '0.00'}
          </Badge>
          <Badge variant="outline" className="py-1.5 px-3 gap-1.5">
            <Package className="h-3.5 w-3.5" />
            {products.length}
          </Badge>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => navigate('/')} className="gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5" /> Main Marketplace
          </Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4">
              <div className="h-24 bg-muted/50 rounded-lg animate-pulse mb-3" />
              <div className="h-4 bg-muted/50 rounded animate-pulse mb-2 w-3/4" />
              <div className="h-3 bg-muted/50 rounded animate-pulse w-1/2" />
            </CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Store className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Products Found</h3>
          <p className="text-sm text-muted-foreground">{search ? 'Try different search' : 'Products will appear soon'}</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} onBuy={handleBuyClick} />
          ))}
        </div>
      )}

      {/* Footer */}
      {!loading && (
        <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
          {filtered.length} of {products.length} products • Realtime • Powered by SaaS VALA
        </div>
      )}

      {/* Buy Dialog */}
      <Dialog open={!!buyProduct} onOpenChange={(open) => { if (!open) { setBuyProduct(null); setPurchasedKey(null); } }}>
        <DialogContent className="sm:max-w-md">
          {purchasedKey ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="h-5 w-5" /> Purchase Complete!
                </DialogTitle>
                <DialogDescription>{buyProduct?.name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-xs text-muted-foreground mb-1">License Key</p>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-lg font-bold text-foreground flex-1">{purchasedKey}</code>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(purchasedKey); toast.success('Key copied!'); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Client: <strong className="text-foreground">{buyClientName}</strong></p>
                  <p>Email: <strong className="text-foreground">{buyClientEmail}</strong></p>
                  <p>Charged: <strong className="text-foreground">${buyProduct?.price || 5}</strong></p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setBuyProduct(null); setPurchasedKey(null); }} className="w-full">Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" /> Buy: {buyProduct?.name}
                </DialogTitle>
                <DialogDescription>
                  Price: <strong>${buyProduct?.price || 5}</strong> • Wallet: <strong>${wallet?.balance?.toFixed(2) || '0.00'}</strong>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Name *</label>
                  <Input placeholder="Enter client name" value={buyClientName} onChange={(e) => setBuyClientName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Email *</label>
                  <Input type="email" placeholder="client@email.com" value={buyClientEmail} onChange={(e) => setBuyClientEmail(e.target.value)} />
                </div>
                {wallet && (buyProduct?.price || 5) > wallet.balance && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    ⛔ Insufficient balance. Add ${((buyProduct?.price || 5) - wallet.balance).toFixed(2)} more.
                  </div>
                )}
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Product</span>
                    <span className="font-medium text-foreground">{buyProduct?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-bold text-foreground">${buyProduct?.price || 5}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">After Purchase</span>
                    <span className="font-medium text-foreground">
                      ${((wallet?.balance || 0) - (buyProduct?.price || 5)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setBuyProduct(null)}>Cancel</Button>
                <Button
                  onClick={handleBuyConfirm}
                  disabled={buying || !buyClientName.trim() || !buyClientEmail.trim() || (wallet ? (buyProduct?.price || 5) > wallet.balance : true)}
                  className="gap-2"
                >
                  {buying ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : <><Key className="h-4 w-4" /> Pay & Generate Key</>}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
