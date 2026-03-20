import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function RealEstateMarketplaceSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['real_estate', 'property', 'rent', 'housing']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="🏘️"
        title="Real Estate Marketplace"
        subtitle="Property listing and management"
        badge="REAL ESTATE"
        badgeVariant="trending"
        totalCount={dbProducts.length}
      />
      <SectionSlider>
        {dbProducts.map((product, i) => (
          <MarketplaceProductCard
            key={product.id}
            product={product as any}
            index={i}
            onBuyNow={onBuyNow}
            rank={i + 1}
          />
        ))}
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Real Estate Marketplace" />}
      </SectionSlider>
    </section>
  );
}
