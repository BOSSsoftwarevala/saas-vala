import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function FoodDeliverySection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['food', 'restaurant', 'cafe', 'pos', 'kitchen']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="🍔"
        title="Food & Restaurant"
        subtitle="Restaurant and food service solutions"
        badge="FOOD"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Food & Restaurant" />}
      </SectionSlider>
    </section>
  );
}
