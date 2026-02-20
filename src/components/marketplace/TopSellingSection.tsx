import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function TopSellingSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['retail', 'pos', 'food', 'restaurant', 'billing', 'erp']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="🏆"
        title="This Week Top Selling"
        subtitle="Real sales data. Updated every 24 hours. Don't miss the trend."
        badge="LIVE RANKINGS"
        badgeVariant="live"
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
            borderColor={i < 3 ? 'border-warning/40' : 'border-border'}
          />
        ))}
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Top Selling" />}
      </SectionSlider>
    </section>
  );
}
