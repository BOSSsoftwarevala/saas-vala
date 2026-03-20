import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function IoTSmartDeviceSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['iot', 'smart', 'device', 'iot_factory', 'sensor']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="📡"
        title="IoT & Smart Devices"
        subtitle="Internet of Things solutions"
        badge="IoT"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="IoT & Smart Devices" />}
      </SectionSlider>
    </section>
  );
}
