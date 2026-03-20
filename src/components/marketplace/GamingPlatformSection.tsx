import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function GamingPlatformSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['game', 'gaming', 'sports', 'casino']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="🎮"
        title="Gaming Platforms"
        subtitle="Gaming and entertainment solutions"
        badge="GAMING"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Gaming Platforms" />}
      </SectionSlider>
    </section>
  );
}
