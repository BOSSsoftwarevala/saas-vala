import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function EducationSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['education', 'school', 'college', 'coaching', 'university']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="🎓"
        title="Education Software"
        subtitle="Complete education management systems"
        badge="EDUCATION"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Education Software" />}
      </SectionSlider>
    </section>
  );
}
