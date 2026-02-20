import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function UpcomingSection() {
  const { products: dbProducts, loading } = useProductsByCategory(['upcoming', 'pipeline', 'coming_soon']);
  const allProducts = dbProducts.map(p => ({ ...p, isAvailable: false, status: 'upcoming' as const }));

  return (
    <section className="py-4">
      <SectionHeader
        icon="🚀"
        title="Upcoming Software"
        subtitle="Be first. Get early access before public launch."
        badge="DROPPING SOON"
        badgeVariant="hot"
        totalCount={allProducts.length}
      />

      <SectionSlider>
        {allProducts.map((product, i) => (
          <MarketplaceProductCard
            key={product.id}
            product={product as any}
            index={i}
            onBuyNow={() => {}}
            rank={i + 1}
          />
        ))}
        {!loading && allProducts.length === 0 && <ComingSoonCard label="Upcoming" />}
      </SectionSlider>
    </section>
  );
}
