import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import type { MarketplaceCategory } from '@/data/marketplaceCategories';

interface Props {
  category: MarketplaceCategory;
  onBuyNow: (p: any) => void;
}

export function MarketplaceCategoryRow({ category, onBuyNow }: Props) {
  const { products, loading } = useProductsByCategory(category.keywords);

  const displayProducts = fillToTarget(products as any, category.id, category.title, 50);

  if (!loading && displayProducts.length === 0) {
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
            rank={i + 1}
          />
        ))}
      </SectionSlider>
    </section>
  );
}
