import { useState, useEffect, useRef, useCallback } from 'react';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { SectionHeader } from './SectionHeader';
import { useMarketplaceProducts, type MarketplaceProduct } from '@/hooks/useMarketplaceProducts';
import { Loader2 } from 'lucide-react';

const ITEMS_PER_BATCH = 24;

export function AllProductsGrid({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products, loading } = useMarketplaceProducts();
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_BATCH);
  const loaderRef = useRef<HTMLDivElement>(null);

  const hasMore = visibleCount < products.length;
  const visibleProducts = products.slice(0, visibleCount);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore) {
          setVisibleCount(prev => Math.min(prev + ITEMS_PER_BATCH, products.length));
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, products.length]);

  if (loading && products.length === 0) {
    return (
      <section className="py-6 px-4 md:px-8">
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading products...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6">
      <SectionHeader
        icon="📦"
        title="All Products"
        subtitle={`${products.length} software products available`}
        badge="CATALOG"
        badgeVariant="live"
        totalCount={products.length}
      />
      <div className="px-4 md:px-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {visibleProducts.map((product, i) => (
          <MarketplaceProductCard
            key={product.id}
            product={product}
            index={i}
            onBuyNow={onBuyNow}
            rank={i + 1}
          />
        ))}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={loaderRef} className="flex items-center justify-center py-6">
        {hasMore ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">
              Showing {visibleCount} of {products.length}
            </span>
          </div>
        ) : products.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            ✅ All {products.length} products loaded
          </span>
        ) : null}
      </div>
    </section>
  );
}
