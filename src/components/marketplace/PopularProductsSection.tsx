import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';

export function PopularProductsSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['marketing', 'finance', 'hr', 'crm', 'accounting', 'hospitality', 'logistics', 'construction']);

  const displayProducts = fillToTarget(dbProducts as any, 'popular', 'Evergreen', 50);

  return (
    <section className="py-4">
      <SectionHeader
        icon="🌿"
        title="Evergreen Software"
        subtitle="Time-tested solutions. Trusted by thousands of businesses worldwide."
        badge="EVERGREEN"
        badgeVariant="trending"
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
        {!loading && displayProducts.length === 0 && <ComingSoonCard label="Popular" />}
      </SectionSlider>
    </section>
  );
}
