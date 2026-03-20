import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function LegalTechSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['legal', 'law', 'contract', 'advocate']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="⚖️"
        title="Legal Tech"
        subtitle="Legal technology solutions"
        badge="LEGAL"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Legal Tech" />}
      </SectionSlider>
    </section>
  );
}
