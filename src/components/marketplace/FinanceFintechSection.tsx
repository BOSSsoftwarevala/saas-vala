import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function FinanceFintechSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['finance', 'fintech', 'bank', 'payment', 'billing']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="💳"
        title="Finance & Fintech"
        subtitle="Modern financial technology solutions"
        badge="FINTECH"
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
          />
        ))}
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Finance & Fintech" />}
      </SectionSlider>
    </section>
  );
}
