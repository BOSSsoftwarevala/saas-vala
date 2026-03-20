import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function RecruitmentJobSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['hr', 'job', 'recruitment', 'career', 'resume']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="💼"
        title="Recruitment & Jobs"
        subtitle="Job portals and recruitment platforms"
        badge="JOBS"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Recruitment & Jobs" />}
      </SectionSlider>
    </section>
  );
}
