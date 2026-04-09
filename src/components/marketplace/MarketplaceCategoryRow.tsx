import React from 'react';
import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import type { MarketplaceCategory } from '@/data/marketplaceCategories';

interface Props {
  category: MarketplaceCategory;
  onBuyNow: (p: any) => void;
  onDemo?: (p: any) => void;
  filteredProducts?: any[];
  productsOverride?: any[];
}

export const MarketplaceCategoryRow = React.forwardRef<HTMLElement, Props>(function MarketplaceCategoryRow({ category, onBuyNow, onDemo, filteredProducts, productsOverride }, ref) {
  const { products, loading } = useProductsByCategory(category.keywords);

  const effectiveProducts = productsOverride !== undefined ? productsOverride : (filteredProducts !== undefined ? filteredProducts : products);
  const categoryLoading = productsOverride !== undefined ? false : loading;
  const displayProducts = effectiveProducts.slice(0, 10);

  if (!categoryLoading && displayProducts.length === 0) {
    return (
      <section className="py-4">
        <SectionHeader
          icon={category.icon}
          title={category.title}
          subtitle={category.subtitle}
          badge={category.badge}
          badgeVariant={category.badgeVariant}
          totalCount={0}
        />
        <SectionSlider>
          <ComingSoonCard label={category.title} />
        </SectionSlider>
      </section>
    );
  }

  return (
    <section className="py-4">
      <SectionHeader
        icon={category.icon}
        title={category.title}
        subtitle={category.subtitle}
        badge={category.badge}
        badgeVariant={category.badgeVariant}
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard
            key={product.id}
            product={product as any}
            index={i}
            onBuyNow={onBuyNow}
            onDemo={onDemo}
            rank={i + 1}
          />
        ))}
      </SectionSlider>
    </section>
  );
});
MarketplaceCategoryRow.displayName = 'MarketplaceCategoryRow';
