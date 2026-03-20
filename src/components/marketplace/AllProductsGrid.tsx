import React from 'react';
import { MarketplaceProductCard } from './MarketplaceProductCard';
import { SectionHeader } from './SectionHeader';
import { useMarketplaceProducts } from '@/hooks/useMarketplaceProducts';
import { Loader2 } from 'lucide-react';

export function AllProductsGrid({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products, loading } = useMarketplaceProducts();

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
        {products.map((product, i) => (
          <MarketplaceProductCard
            key={product.id}
            product={product}
            index={i}
            onBuyNow={onBuyNow}
            rank={i + 1}
          />
        ))}
      </div>
      {products.length > 0 && (
        <p className="text-center text-xs text-muted-foreground pt-4">
          ✅ {products.length} products loaded
        </p>
      )}
    </section>
  );
}
