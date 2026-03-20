import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function TelemedicineSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['telemedicine', 'doctor', 'healthcare', 'clinic', 'pharmacy']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="🩺"
        title="Telemedicine"
        subtitle="Remote healthcare consultations"
        badge="TELEHEALTH"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Telemedicine" />}
      </SectionSlider>
    </section>
  );
}
