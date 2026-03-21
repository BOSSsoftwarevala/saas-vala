import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function HealthcareTelemedicineSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['healthcare', 'telemedicine', 'doctor', 'patient']);

  // FIXED: Validate products before rendering
  const validProducts = dbProducts.filter(product => {
    if (!Number.isFinite(product.price) || product.price <= 0) {
      console.warn('Invalid product price:', product.id);
      return false;
    }
    return true;
  });

  return (
    <section className="py-4">
      <SectionHeader
        icon="👨‍⚕️"
        title="Healthcare & Telemedicine"
        subtitle="Remote healthcare and telemedicine"
        badge="TELEHEALTH"
        badgeVariant="trending"
        totalCount={validProducts.length}
      />
      <SectionSlider>
        {validProducts.map((product, i) => (
          <MarketplaceProductCard
            key={product.id}
            product={product as any}
            index={i}
            onBuyNow={onBuyNow}
            rank={i + 1}
          />
        ))}
        {!loading && validProducts.length === 0 && <ComingSoonCard label="Healthcare & Telemedicine" />}
      </SectionSlider>
    </section>
  );
}
