import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Eye, ArrowLeft, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useFavorites';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Star } from 'lucide-react';

interface FavoritedProduct {
  id: string;
  name: string;
  short_description: string;
  thumbnail_url: string;
  category: string;
  rating: number;
  base_price?: number;
  created_at: string;
}

export default function FavoritesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toggleFavorite, isFavorited } = useFavorites();
  const [products, setProducts] = useState<FavoritedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !authLoading) {
      fetchFavoritedProducts();
    }
  }, [user, authLoading]);

  const fetchFavoritedProducts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get favorite product IDs
      const { data: favorites, error: favError } = await (supabase as any)
        .from('user_favorites')
        .select('product_id')
        .eq('user_id', user.id);

      if (favError) throw favError;

      if (!favorites || favorites.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      // Get product details
      const productIds = favorites.map((f: any) => f.product_id);
      const { data: prods, error: prodError } = await (supabase as any)
        .from('products')
        .select('id, name, short_description, thumbnail_url, category, category_id, rating, created_at')
        .in('id', productIds);

      if (prodError) throw prodError;
      setProducts(
        Array.isArray(prods)
          ? prods.map((p: any) => ({
              id: p.id,
              name: p.name,
              short_description: p.short_description || '',
              thumbnail_url: p.thumbnail_url || '/placeholder.svg',
              category: p.category || p.category_id || 'General',
              rating: Number(p.rating || 0),
              created_at: p.created_at,
            }))
          : []
      );
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
      toast.error('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (productId: string) => {
    await toggleFavorite(productId);
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  if (!user && !authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">Please login to view your favorites</p>
        <Button onClick={() => navigate('/auth')}>Login</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Heart className="h-8 w-8 fill-red-500 text-red-500" />
                My Favorites
              </h1>
              <p className="text-muted-foreground">
                {products.length} product{products.length !== 1 ? 's' : ''} saved
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Heart className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground mb-4">No favorites yet</p>
              <p className="text-sm text-muted-foreground mb-6">
                Add products to your favorites to save them for later
              </p>
              <Button onClick={() => navigate('/marketplace')}>Browse Products</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => (
              <Card
                key={product.id}
                className="hover:shadow-lg transition-shadow overflow-hidden flex flex-col group"
              >
                {/* Product Image */}
                <div className="relative h-48 bg-muted overflow-hidden">
                  <img
                    src={product.thumbnail_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <button
                    onClick={() => handleRemoveFavorite(product.id)}
                    className="absolute top-2 right-2 p-2 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                    title="Remove from favorites"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Product Info */}
                <CardContent className="flex-1 flex flex-col p-4">
                  {/* Category */}
                  <Badge className="w-fit mb-2 text-xs" variant="secondary">
                    {product.category}
                  </Badge>

                  {/* Name */}
                  <h3 className="font-semibold line-clamp-2 text-sm mb-2">{product.name}</h3>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
                    {product.short_description}
                  </p>

                  {/* Rating */}
                  <div className="flex items-center gap-1 mb-4">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < Math.round(product.rating)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-muted-foreground'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {product.rating.toFixed(1)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={() => navigate(`/marketplace/product/${product.id}`)}
                    >
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 text-xs h-8 bg-primary hover:bg-primary/90"
                      onClick={() => {
                        // Add to cart or initiate purchase
                        navigate(`/marketplace/product/${product.id}?action=buy`);
                      }}
                    >
                      <ShoppingCart className="h-3 w-3 mr-1" /> Buy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {products.length > 0 && (
          <div className="mt-8 p-6 bg-primary/5 border border-primary/10 rounded-lg">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate('/marketplace')}>Browse More Products</Button>
              <Button variant="outline">Export Favorites</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
