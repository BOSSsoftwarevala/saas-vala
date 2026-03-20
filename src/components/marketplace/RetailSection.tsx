import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function RetailSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['retail', 'pos', 'shop', 'store', 'inventory']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="🏪"
        title="Retail & POS"
        subtitle="Retail point of sale solutions"
        badge="RETAIL"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Retail & POS" />}
      </SectionSlider>
    </section>
  );
}
