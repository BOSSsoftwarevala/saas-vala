import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';

import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { OnDemandRequestModal } from './OnDemandRequestModal';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';

export function OnDemandSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const [requestModal, setRequestModal] = useState<{ open: boolean; product?: any }>({ open: false });
  const { products: dbProducts, loading } = useProductsByCategory(['saas', 'cloud', 'on_demand']);

  const displayProducts = fillToTarget(dbProducts as any, 'on_demand', 'On-Demand', 50);

  const openRequest = (product: any) => setRequestModal({ open: true, product });

  return (
    <section className="py-4">
      <div className="px-4 md:px-8 mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">⚡</span>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase text-foreground">
              On-Demand Software
            </h2>
            <Badge className="bg-green-500 text-white text-[10px] font-black px-2 py-0.5 uppercase tracking-widest">
              INSTANT DEPLOY
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground ml-9">
            Instantly deploy. No setup. Live in minutes.
            <span className="ml-2 text-primary font-semibold">{displayProducts.length} products</span>
          </p>
        </div>
        <Button
          className="gap-2 h-9 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          onClick={() => openRequest({ id: '', title: 'Custom Software', category: 'General' })}
        >
          <Download className="h-4 w-4" />
          REQUEST DOWNLOAD
        </Button>
      </div>

      <SectionSlider>
        {displayProducts.map((product, i) => (
          <div key={product.id} className="flex flex-col gap-2">
            <MarketplaceProductCard
              product={product as any}
              index={i}
              onBuyNow={onBuyNow}
              rank={i + 1}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-[10px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10 rounded-xl"
              onClick={() => openRequest(product)}
            >
              <Download className="h-3.5 w-3.5" />
              REQUEST DOWNLOAD
            </Button>
          </div>
        ))}

        {!loading && displayProducts.length === 0 && (
          <ComingSoonCard label="On-Demand" />
        )}
      </SectionSlider>

      <OnDemandRequestModal
        open={requestModal.open}
        onOpenChange={(v) => setRequestModal({ open: v })}
        productName={requestModal.product?.title}
        productId={requestModal.product?.id}
        productCategory={requestModal.product?.category}
      />
    </section>
  );
}
