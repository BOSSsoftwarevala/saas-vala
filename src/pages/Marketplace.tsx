import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Search, ShoppingCart, Play, Info, Filter } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  thumbnail_url: string | null;
  status: string;
  demo_url: string | null;
  business_type: string | null;
  tags: string[];
}

const Marketplace: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'software', 'mobile', 'web', 'erp', 'crm', 'ecommerce', 'education', 'healthcare', 'finance'];

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, selectedCategory]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('marketplace_visible', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p =>
        p.business_type === selectedCategory ||
        p.tags?.includes(selectedCategory)
      );
    }

    setFilteredProducts(filtered);
  };

  const handleDemo = (product: Product) => {
    if (product.demo_url) {
      window.open(product.demo_url, '_blank');
    } else {
      toast.info('Demo not available for this product');
    }
  };

  const handleDetails = (slug: string) => {
    window.location.href = `/marketplace/product/${slug}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <Skeleton className="h-40 w-full mb-4 bg-gray-700" />
                  <Skeleton className="h-6 w-3/4 mb-2 bg-gray-700" />
                  <Skeleton className="h-4 w-1/2 mb-4 bg-gray-700" />
                  <Skeleton className="h-10 w-full bg-gray-700" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Marketplace</h1>
          <p className="text-gray-400">Discover and purchase premium software solutions</p>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(category)}
                className="whitespace-nowrap"
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="bg-gray-800 border-gray-700 hover:border-orange-500 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/20">
                <CardContent className="p-4">
                  {/* Thumbnail */}
                  {product.thumbnail_url ? (
                    <img
                      src={product.thumbnail_url}
                      alt={product.name}
                      className="w-full h-40 object-cover rounded-lg mb-4"
                    />
                  ) : (
                    <div className="w-full h-40 bg-gray-700 rounded-lg mb-4 flex items-center justify-center">
                      <span className="text-4xl">📦</span>
                    </div>
                  )}

                  {/* Name */}
                  <h3 className="font-semibold text-lg mb-2 line-clamp-1">{product.name}</h3>

                  {/* Description */}
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                    {product.short_description || product.description || 'No description available'}
                  </p>

                  {/* Price */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold text-orange-500">
                      ${product.price}
                    </span>
                    {product.business_type && (
                      <Badge variant="secondary" className="text-xs">
                        {product.business_type}
                      </Badge>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={() => handleDemo(product)}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Demo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-gray-600 hover:bg-gray-700 text-white"
                        onClick={() => handleDetails(product.slug)}
                      >
                        <Info className="w-3 h-3 mr-1" />
                        Details
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleDetails(product.slug)}
                    >
                      <ShoppingCart className="w-3 h-3 mr-1" />
                      Buy Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Marketplace;
