import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { HeroBannerSlider } from '@/components/marketplace/HeroBannerSlider';
import { MARKETPLACE_CATEGORIES } from '@/data/marketplaceCategories';
import { useMarketplaceProducts } from '@/hooks/useMarketplaceProducts';
import { useFavorites } from '@/hooks/useMarketplace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  ShoppingCart,
  Star,
  Eye,
  Heart,
  Filter,
  ChevronDown,
  Loader2,
  Search,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const bannerSlides = [
  {
    id: 'featured-banner',
    title: 'Exclusive Software Marketplace',
    subtitle: 'Discover 2000+ verified software products with secure payments and instant delivery.',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=520&fit=crop',
    linkedCategory: '',
  },
  {
    id: 'enterprise-banner',
    title: 'Enterprise Solutions',
    subtitle: 'Scalable business software for all industries.',
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=520&fit=crop',
    linkedCategory: 'technology-services',
  },
  {
    id: 'startup-banner',
    title: 'Perfect for Startups',
    subtitle: 'Affordable software solutions for growing businesses.',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=520&fit=crop',
    linkedCategory: 'retail',
  },
];

export default function MarketplacePublic() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { products: allProducts } = useMarketplaceProducts();
  const { favorites, isFavorited, toggleFavorite, fetchFavorites } = useFavorites();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [sortBy, setSortBy] = useState('newest');
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState('0');
  const [maxPrice, setMaxPrice] = useState('1000');
  const [minRating, setMinRating] = useState('0');

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    // Category filter
    if (selectedCategory) {
      result = result.filter((p) =>
        (p.category || '').toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.title?.toLowerCase().includes(query) ||
        p.subtitle?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query)
      );
    }

    // Price filter
    const min = parseFloat(minPrice) || 0;
    const max = parseFloat(maxPrice) || Infinity;
    result = result.filter((p) => {
      const price = p.price || 0;
      return price >= min && price <= max;
    });

    // Rating filter
    const minRatingNum = parseFloat(minRating) || 0;
    result = result.filter((p) => (p.rating || 0) >= minRatingNum);

    // Sort
    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-high':
        result.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'rating':
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'newest':
      default:
        // Already sorted by created_at in hook
        break;
    }

    return result;
  }, [allProducts, selectedCategory, searchQuery, sortBy, minPrice, maxPrice, minRating]);

  const handleSearch = () => {
    setSearchParams({
      ...(searchQuery && { search: searchQuery }),
      ...(selectedCategory && { category: selectedCategory }),
    });
  };

  const handleBannerClick = (linkedCategory?: string) => {
    if (linkedCategory) {
      setSelectedCategory(linkedCategory);
      setSearchParams({ category: linkedCategory });
    }
  };

  const handleBuyNow = (product: any) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    navigate(`/marketplace/product/${product.id}`);
  };

  const handleDemo = (product: any) => {
    const demoUrl = product.demoUrl || product.demo_url;
    if (demoUrl) {
      window.open(demoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearch}
      />

      <div className="pt-16">
        {/* Banner Slider */}
        <HeroBannerSlider slides={bannerSlides} onBannerClick={handleBannerClick} />

        {/* Top Offers Strip */}
        <div className="bg-primary/10 border-b border-primary/20 py-2 overflow-hidden">
          <div className="flex items-center whitespace-nowrap animate-marquee gap-6 px-4">
            <span className="inline-block text-sm font-medium text-primary">
              🎉 New Releases • 🔥 Trending • ⭐ Best Sellers • 💰 Special Discount
            </span>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8">
          {/* Filters & Controls */}
          <div className="mb-8">
            {/* Main Search/Filter Row */}
            <div className="flex flex-col gap-4 mb-6">
              {/* Search Bar */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search software, APK, tools..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearch} className="gap-2">
                  <Search className="h-4 w-4" /> Search
                </Button>
              </div>

              {/* Filter & Sort Controls */}
              <div className="flex flex-wrap gap-3 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" /> Filters {filteredProducts.length > 0 && `(${filteredProducts.length})`}
                </Button>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    {MARKETPLACE_CATEGORIES.slice(0, 15).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Min Price</label>
                      <Input
                        type="number"
                        min="0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        placeholder="$0"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Max Price</label>
                      <Input
                        type="number"
                        min="0"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        placeholder="$1000"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Min Rating</label>
                      <Select value={minRating} onValueChange={setMinRating}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Any Rating</SelectItem>
                          <SelectItem value="3">3+ Stars</SelectItem>
                          <SelectItem value="4">4+ Stars</SelectItem>
                          <SelectItem value="5">5 Stars</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setMinPrice('0');
                          setMaxPrice('1000');
                          setMinRating('0');
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results Info */}
            <p className="text-sm text-muted-foreground">
              Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
              {selectedCategory && ` in ${MARKETPLACE_CATEGORIES.find((c) => c.id === selectedCategory)?.title}`}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>

          {/* Products Grid/List */}
          {filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No products found</p>
                <Button onClick={() => { setSearchQuery(''); setSelectedCategory(''); }}>
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="hover:shadow-lg transition-all overflow-hidden flex flex-col group"
                >
                  {/* Product Image */}
                  <div className="relative h-48 bg-muted overflow-hidden">
                    <img
                      src={product.image}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    {product.featured && (
                      <Badge className="absolute top-2 left-2 bg-amber-500">FEATURED</Badge>
                    )}
                    {product.discount_percent > 0 && (
                      <Badge className="absolute top-2 right-2 bg-red-500">
                        -{product.discount_percent}%
                      </Badge>
                    )}
                  </div>

                  {/* Product Info */}
                  <CardContent className="flex-1 flex flex-col p-4">
                    {/* Category */}
                    <Badge className="w-fit mb-2 text-xs" variant="secondary">
                      {product.category}
                    </Badge>

                    {/* Title */}
                    <h3 className="font-semibold line-clamp-2 text-sm mb-2">{product.title}</h3>

                    {/* Subtitle */}
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
                      {product.subtitle}
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
                        ({product.rating.toFixed(1)})
                      </span>
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="font-bold text-lg text-primary">
                        ${(product.price || 0).toFixed(2)}
                      </span>
                      {product.discount_percent > 0 && (
                        <span className="text-xs text-muted-foreground line-through">
                          ${(product.price * 1.2).toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-2 h-8"
                        onClick={() => toggleFavorite(product.id)}
                        title={isFavorited(product.id) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Heart
                          className={`h-4 w-4 ${
                            isFavorited(product.id)
                              ? 'fill-red-500 text-red-500'
                              : 'text-muted-foreground'
                          }`}
                        />
                      </Button>
                      {product.demoUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-8"
                          onClick={() => handleDemo(product)}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Demo
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="flex-1 text-xs h-8 gap-1"
                        onClick={() => handleBuyNow(product)}
                      >
                        <ShoppingCart className="h-3 w-3" /> Buy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

