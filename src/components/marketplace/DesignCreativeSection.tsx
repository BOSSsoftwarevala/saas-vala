import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function DesignCreativeSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['design', 'creative', 'studio', 'photo']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="🎨"
        title="Design & Creative"
        subtitle="Creative tools for designers"
        badge="CREATIVE"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Design & Creative" />}
      </SectionSlider>
    </section>
  );
}
