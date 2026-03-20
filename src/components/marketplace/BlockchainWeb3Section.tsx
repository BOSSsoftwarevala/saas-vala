import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

export function BlockchainWeb3Section({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts, loading } = useProductsByCategory(['blockchain', 'crypto', 'web3', 'crypto_forex']);

  return (
    <section className="py-4">
      <SectionHeader
        icon="⛓️"
        title="Blockchain & Web3"
        subtitle="Decentralized solutions for the future"
        badge="WEB3"
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
        {!loading && dbProducts.length === 0 && <ComingSoonCard label="Blockchain & Web3" />}
      </SectionSlider>
    </section>
  );
}
