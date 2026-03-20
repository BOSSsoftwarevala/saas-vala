import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function EcommerceSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['ecommerce', 'shop', 'store', 'cart']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="🛒"
        title="E-Commerce"
        subtitle="Complete online store solutions"
        badge="ECOMMERCE"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="E-Commerce" />}
      </SectionSlider>
    </section>
  );
}
