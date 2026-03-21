import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  Search,
  ExternalLink,
  Package,
  Store,
  Eye,
} from 'lucide-react';
import { motion } from 'framer-motion';

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

export function ResellerMarketplacePanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('id, name, slug, description, price, status, demo_url, thumbnail_url')
      .eq('status', 'active')
      .neq('slug', '__payment_config__')
      .order('name')
      .limit(100);

    setProducts((data as unknown as Product[]) || []);
    setLoading(false);
  };

  const filtered = search
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Marketplace</h2>
          <p className="text-muted-foreground">Browse products and share with your clients</p>
        </div>
        <Badge variant="outline" className="text-sm py-1.5 px-3 gap-1.5">
          <Package className="h-3.5 w-3.5" />
          {products.length} Products
        </Badge>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products by name or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="h-32 bg-muted/50 rounded-lg animate-pulse mb-3" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card className="hover:border-primary/30 transition-colors group">
                <CardContent className="p-5">
                  {/* Thumbnail */}
                  <div className="h-28 rounded-lg bg-muted/30 mb-3 flex items-center justify-center overflow-hidden">
                    {product.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={product.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                    )}
                  </div>

                  {/* Info */}
                  <h3 className="font-semibold text-foreground text-sm mb-1 line-clamp-1">
                    {product.name}
                  </h3>
                  {product.category && (
                    <Badge variant="secondary" className="text-[10px] mb-2">
                      {product.category}
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {product.description || 'Professional software solution'}
                  </p>

                  {/* Price & Actions */}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">
                      {product.price ? `$${product.price}` : 'Free'}
                    </span>
                    <div className="flex gap-1.5">
                      {product.demo_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => window.open(product.demo_url!, '_blank')}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => {
                          const url = `${window.location.origin}/?product=${product.slug}`;
                          navigator.clipboard.writeText(url);
                          import('sonner').then(({ toast }) =>
                            toast.success('Product link copied! Share with your client.')
                          );
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
