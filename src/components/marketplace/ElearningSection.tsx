import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function ElearningSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['elearning', 'course', 'training', 'quiz', 'lms']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="💡"
        title="E-Learning Platforms"
        subtitle="Online learning and course management"
        badge="E-LEARNING"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="E-Learning Platforms" />}
      </SectionSlider>
    </section>
  );
}
