import { useState, useEffect, useCallback, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ExternalLink,
  Package,
  Store,
  Eye,
  RefreshCw,
  ShoppingBag,
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

// Recursive fetch all products (bypasses 1000-row limit)
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

    if (error || !data || data.length === 0) {
      hasMore = false;
      break;
    }

    all.push(...(data as unknown as Product[]));
    if (data.length < PAGE_SIZE) hasMore = false;
    page++;
  }

  return all;
}

// Memoized product card for performance with 300+ items
const ProductCard = memo(({ product }: { product: Product }) => {
  const handleCopyLink = () => {
    const url = `${window.location.origin}/?product=${product.slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Product link copied! Share with your client.');
  };

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        {/* Thumbnail */}
        <div className="h-24 rounded-lg bg-muted/30 mb-3 flex items-center justify-center overflow-hidden">
          {product.thumbnail_url ? (
            <img
              src={product.thumbnail_url}
              alt={product.name}
              className="w-full h-full object-cover rounded-lg"
              loading="lazy"
            />
          ) : (
            <Package className="h-8 w-8 text-muted-foreground/30" />
          )}
        </div>

        {/* Info */}
        <h3 className="font-semibold text-foreground text-sm mb-1 line-clamp-1">{product.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {product.description || 'Professional software solution'}
        </p>

        {/* Price & Actions */}
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-primary">
            {product.price ? `$${product.price}` : '$5'}
          </span>
          <div className="flex gap-1.5">
            {product.demo_url && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => window.open(product.demo_url!, '_blank')}
              >
                <Eye className="h-3 w-3" />
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleCopyLink}>
              <ExternalLink className="h-3 w-3" />
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadProducts = useCallback(async () => {
    const data = await fetchAllProducts();
    setProducts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();

    // Realtime subscription for live updates
    const channel = supabase
      .channel('reseller-marketplace-products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          // Re-fetch on any product change
          loadProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadProducts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
    toast.success(`Marketplace refreshed! ${products.length} products loaded.`);
  };

  const filtered = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  const withDemo = products.filter((p) => p.demo_url).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            SaaS VALA Marketplace
          </h2>
          <p className="text-muted-foreground">
            Browse all {products.length} live products • Share with clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm py-1.5 px-3 gap-1.5">
            <Package className="h-3.5 w-3.5" />
            {products.length} Products
          </Badge>
          <Badge variant="outline" className="text-sm py-1.5 px-3 gap-1.5 border-green-500/30 text-green-500">
            <Eye className="h-3.5 w-3.5" />
            {withDemo} Live Demos
          </Badge>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => navigate('/')} className="gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5" />
            Open Main Marketplace
          </Button>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-24 bg-muted/50 rounded-lg animate-pulse mb-3" />
                <div className="h-4 bg-muted/50 rounded animate-pulse mb-2 w-3/4" />
                <div className="h-3 bg-muted/50 rounded animate-pulse w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Store className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Products Found</h3>
            <p className="text-sm text-muted-foreground">
              {search ? 'Try a different search term' : 'Products will appear here once available'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Footer Stats */}
      {!loading && (
        <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
          Showing {filtered.length} of {products.length} products •
          Realtime updates enabled •
          Powered by SaaS VALA
        </div>
      )}
    </div>
  );
}
