import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Star, TrendingUp, Zap } from 'lucide-react';

import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { OnDemandRequestModal } from './OnDemandRequestModal';
import { useProductsByCategory, MarketplaceProduct } from '@/hooks/useMarketplaceProducts';
import { cn } from '@/lib/utils';

// Static on-demand fallback cards shown when DB is empty
const staticOnDemand = [
  { id: 'od-1', title: 'SCHOOL ERP PRO', subtitle: 'Complete K-12 school management suite', image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop', category: 'Education', badge: 'BESTSELLER' as const, downloads: 12400, price: 5 },
  { id: 'od-2', title: 'HOSPITAL CRM AI', subtitle: 'Patient relationship & appointment AI', image: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=400&h=300&fit=crop', category: 'Healthcare', badge: 'AI-POWERED' as const, downloads: 8900, price: 5 },
  { id: 'od-3', title: 'RESTAURANT POS MAX', subtitle: 'Multi-outlet restaurant management platform', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop', category: 'Food & Hospitality', badge: 'HOT' as const, downloads: 21000, price: 5 },
  { id: 'od-4', title: 'FLEET TRACKER GPS', subtitle: 'Real-time vehicle tracking & dispatch', image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&h=300&fit=crop', category: 'Transport', badge: 'TRENDING' as const, downloads: 5600, price: 5 },
  { id: 'od-5', title: 'PROPERTY MANAGER CRM', subtitle: 'End-to-end real estate & rental CRM', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop', category: 'Real Estate', badge: 'NEW' as const, downloads: 7200, price: 5 },
  { id: 'od-6', title: 'WAREHOUSE WMS PRO', subtitle: 'Intelligent warehouse & inventory system', image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&h=300&fit=crop', category: 'Logistics', badge: 'AI-POWERED' as const, downloads: 4300, price: 5 },
  { id: 'od-7', title: 'CLINIC MANAGER LITE', subtitle: 'Fast clinic & pharmacy management solution', image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&h=300&fit=crop', category: 'Healthcare', badge: 'BESTSELLER' as const, downloads: 18600, price: 5 },
  { id: 'od-8', title: 'GOVT CITIZEN PORTAL', subtitle: 'Municipal services & citizen app platform', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop', category: 'Government', badge: 'TRENDING' as const, downloads: 3100, price: 5 },
];

const badgeCfg = {
  NEW: 'bg-secondary/20 text-secondary border-secondary/30',
  HOT: 'bg-destructive/20 text-destructive border-destructive/30 animate-pulse',
  TRENDING: 'bg-accent/20 text-accent border-accent/30',
  'AI-POWERED': 'bg-primary/20 text-primary border-primary/30',
  BESTSELLER: 'bg-warning/20 text-warning border-warning/30',
};

export function OnDemandSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const [requestModal, setRequestModal] = useState<{ open: boolean; product?: typeof staticOnDemand[0] | MarketplaceProduct }>({ open: false });
  const { products: dbProducts, loading } = useProductsByCategory(['saas', 'cloud', 'on_demand', 'erp', 'crm', 'pos', 'software']);

  const openRequest = (product: any) => setRequestModal({ open: true, product });

  // Use DB products if available, else static
  const showStatic = dbProducts.length === 0;

  return (
    <section className="py-4">
      {/* Section header with REQUEST DOWNLOAD CTA */}
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
            <span className="ml-2 text-primary font-semibold">{(dbProducts.length || staticOnDemand.length)} products</span>
          </p>
        </div>
        {/* Prominent REQUEST DOWNLOAD button */}
        <Button
          className="gap-2 h-9 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          onClick={() => openRequest({ id: '', title: 'Custom Software', category: 'General' })}
        >
          <Download className="h-4 w-4" />
          REQUEST DOWNLOAD
        </Button>
      </div>

      <SectionSlider>
        {/* DB products */}
        {!showStatic && dbProducts.map((p, i) => (
          <div key={p.id} className="flex-shrink-0 w-[280px] md:w-[300px] flex flex-col gap-2">
            <MarketplaceProductCard
              product={p}
              index={i}
              onBuyNow={onBuyNow}
            />
            {/* Extra REQUEST DOWNLOAD per card */}
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-[10px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => openRequest(p)}
            >
              <Download className="h-3.5 w-3.5" />
              REQUEST DOWNLOAD
            </Button>
          </div>
        ))}

        {/* Static fallback */}
        {showStatic && staticOnDemand.map((product) => (
          <div key={product.id} className="flex-shrink-0 w-[280px] md:w-[300px] flex flex-col gap-2">
            <div className="relative rounded-xl overflow-hidden bg-card border border-border shadow-lg flex-1 flex flex-col">
              <div className="relative h-[108px] overflow-hidden">
                <img src={product.image} alt={product.title} className="w-full h-full object-cover opacity-60" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                <Badge className={cn('absolute top-2 left-2 text-[9px] font-black border', badgeCfg[product.badge])}>
                  {product.badge}
                </Badge>
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/80 rounded-full px-2 py-0.5">
                  <Star className="h-2.5 w-2.5 fill-warning text-warning" />
                  <span className="text-[9px] font-bold text-warning">4.8</span>
                </div>
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  <Download className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground">{(product.downloads / 1000).toFixed(1)}k</span>
                </div>
              </div>
              <div className="p-3 flex flex-col flex-1">
                <Badge variant="outline" className="w-fit text-[9px] mb-2 border-primary/20 text-primary">{product.category}</Badge>
                <h3 className="font-black text-xs text-foreground uppercase leading-tight mb-1">{product.title}</h3>
                <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2">{product.subtitle}</p>
                <div className="flex items-baseline gap-1 mb-3 mt-auto">
                  <span className="text-xs line-through text-muted-foreground">$49</span>
                  <span className="text-xl font-black text-primary">$5</span>
                  <Badge className="bg-destructive/20 text-destructive border-0 text-[9px]">90% OFF</Badge>
                </div>
                {/* EXACTLY 3 buttons */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button size="sm" variant="outline" className="h-8 text-[10px] gap-1 border-primary/30 text-primary">
                      <Zap className="h-3 w-3" /> DEMO
                    </Button>
                    <Button size="sm" className="h-8 text-[10px] gap-1" onClick={() => onBuyNow(product)}>
                      <TrendingUp className="h-3 w-3" /> BUY NOW
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" className="w-full h-8 text-[10px] gap-1 border-border text-muted-foreground">
                    + ADD PRODUCT
                  </Button>
                </div>
              </div>
            </div>
            {/* REQUEST DOWNLOAD per card */}
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-[10px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => openRequest(product)}
            >
              <Download className="h-3.5 w-3.5" />
              REQUEST DOWNLOAD
            </Button>
          </div>
        ))}

        {!loading && dbProducts.length === 0 && staticOnDemand.length === 0 && (
          <ComingSoonCard label="On-Demand" />
        )}
      </SectionSlider>

      {/* On-Demand Request Modal */}
      <OnDemandRequestModal
        open={requestModal.open}
        onOpenChange={(v) => setRequestModal({ open: v })}
        productName={requestModal.product?.title}
        productId={'id' in (requestModal.product || {}) ? (requestModal.product as any)?.id : undefined}
        productCategory={'category' in (requestModal.product || {}) ? (requestModal.product as any)?.category : undefined}
      />
    </section>
  );
}
