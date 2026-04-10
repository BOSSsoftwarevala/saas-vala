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
  const shouldFetchCategoryProducts = productsOverride === undefined && filteredProducts === undefined;
  const { products, loading } = useProductsByCategory(category.keywords, { enabled: shouldFetchCategoryProducts });
  const [visibleCount, setVisibleCount] = React.useState(24);
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);

  const effectiveProducts = productsOverride !== undefined ? productsOverride : (filteredProducts !== undefined ? filteredProducts : products);
  const categoryLoading = productsOverride !== undefined ? false : loading;
  const displayProducts = effectiveProducts.slice(0, visibleCount);

  React.useEffect(() => {
    setVisibleCount(24);
  }, [category.id, effectiveProducts.length]);

  React.useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    if (visibleCount >= effectiveProducts.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 24, effectiveProducts.length));
        }
      },
      { rootMargin: '240px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, effectiveProducts.length]);

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
      <div ref={loadMoreRef} className="h-2 w-full" aria-hidden="true" />
    </section>
  );
});
MarketplaceCategoryRow.displayName = 'MarketplaceCategoryRow';
