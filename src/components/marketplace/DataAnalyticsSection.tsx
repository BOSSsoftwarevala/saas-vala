import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function DataAnalyticsSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['data', 'analytics', 'data_analytics', 'dashboard']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="📊"
        title="Data & Analytics"
        subtitle="Turn data into actionable insights"
        badge="ANALYTICS"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Data & Analytics" />}
      </SectionSlider>
    </section>
  );
}
