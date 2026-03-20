import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function FoodDeliveryPlatformSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['food', 'delivery', 'restaurant', 'kitchen']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="🍕"
        title="Food Delivery Platforms"
        subtitle="Complete food ordering ecosystems"
        badge="FOOD DELIVERY"
        badgeVariant="hot"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Food Delivery Platforms" />}
      </SectionSlider>
    </section>
  );
}
