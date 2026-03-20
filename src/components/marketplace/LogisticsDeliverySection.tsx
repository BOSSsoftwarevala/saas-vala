import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function LogisticsDeliverySection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['logistics', 'delivery', 'fleet', 'shipping', 'transport']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="🚚"
        title="Logistics & Delivery"
        subtitle="Supply chain and delivery management"
        badge="LOGISTICS"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Logistics & Delivery" />}
      </SectionSlider>
    </section>
  );
}
