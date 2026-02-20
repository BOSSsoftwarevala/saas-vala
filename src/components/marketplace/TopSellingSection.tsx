import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Award, Star, Zap } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { cn } from '@/lib/utils';

const rankMedal: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const staticTopSelling = [
  { id: 'ts-1', rank: 1, title: 'BAR & BISTRO POS', subtitle: 'Restaurant management powerhouse', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop', category: 'Food', salesThisWeek: 892, revenue: 4460, badge: 'CHAMPION' as const, price: 5 },
  { id: 'ts-2', rank: 2, title: 'SCHOOL ERP PRO', subtitle: 'K-12 education management leader', image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop', category: 'Education', salesThisWeek: 744, revenue: 3720, badge: 'RISING' as const, price: 5 },
  { id: 'ts-3', rank: 3, title: 'CLINIC MANAGER AI', subtitle: 'Healthcare SaaS for modern clinics', image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&h=300&fit=crop', category: 'Healthcare', salesThisWeek: 680, revenue: 3400, badge: 'HOT' as const, price: 5 },
  { id: 'ts-4', rank: 4, title: 'FLEET TRACKER GPS', subtitle: 'Real-time transport & logistics AI', image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&h=300&fit=crop', category: 'Transport', salesThisWeek: 521, revenue: 2605, badge: 'GOLD' as const, price: 5 },
  { id: 'ts-5', rank: 5, title: 'WHATSAPP CRM PRO', subtitle: 'Business messaging automation suite', image: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=400&h=300&fit=crop', category: 'Marketing', salesThisWeek: 498, revenue: 2490, badge: 'RISING' as const, price: 5 },
  { id: 'ts-6', rank: 6, title: 'RETAIL POS MAX', subtitle: 'Multi-store billing & inventory', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop', category: 'Retail', salesThisWeek: 430, revenue: 2150, badge: 'HOT' as const, price: 5 },
  { id: 'ts-7', rank: 7, title: 'PROPERTY CRM SUITE', subtitle: 'Real estate & rental management', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop', category: 'Real Estate', salesThisWeek: 382, revenue: 1910, badge: 'GOLD' as const, price: 5 },
  { id: 'ts-8', rank: 8, title: 'ACCOUNTING MASTER', subtitle: 'GST billing & tally-compatible ERP', image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=300&fit=crop', category: 'Finance', salesThisWeek: 340, revenue: 1700, badge: 'CHAMPION' as const, price: 5 },
];

const badgeCfg = {
  CHAMPION: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  RISING: 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse',
  HOT: 'bg-destructive/20 text-destructive border-destructive/30 animate-pulse',
  GOLD: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

export function TopSellingSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['retail', 'pos', 'food', 'restaurant', 'billing', 'erp']);

  // Merge DB (trending products) + static
  const showStatic = dbProducts.length === 0;

  return (
    <section className="py-4">
      <SectionHeader
        icon="🏆"
        title="This Week Top Selling"
        subtitle="Real sales data. Updated every 24 hours. Don't miss the trend."
        badge="LIVE RANKINGS"
        badgeVariant="live"
        totalCount={dbProducts.length || staticTopSelling.length}
      />

      <SectionSlider>
        {/* DB trending products */}
        {!showStatic && dbProducts.filter(p => p.trending || p.featured).map((p, i) => (
          <MarketplaceProductCard
            key={p.id}
            product={p}
            index={i}
            onBuyNow={onBuyNow}
            borderColor={i < 3 ? 'border-warning/40' : 'border-border'}
          />
        ))}
        {/* If DB has products but none trending, show all */}
        {!showStatic && !dbProducts.some(p => p.trending || p.featured) && dbProducts.map((p, i) => (
          <MarketplaceProductCard
            key={p.id}
            product={p}
            index={i}
            onBuyNow={onBuyNow}
            borderColor={i < 3 ? 'border-warning/40' : 'border-border'}
          />
        ))}

        {/* Static fallback */}
        {showStatic && staticTopSelling.map((product) => (
          <div key={product.id} className="flex-shrink-0 w-[280px] md:w-[300px]">
            <div className={cn(
              'relative rounded-xl overflow-hidden bg-card border shadow-lg h-full flex flex-col',
              product.rank <= 3 ? 'border-warning/40' : 'border-border'
            )}>
              <div className="relative h-[108px] overflow-hidden">
                <img src={product.image} alt={product.title} className="w-full h-full object-cover opacity-50" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                <div className={cn(
                  'absolute top-2 left-2 flex items-center gap-1.5 rounded-full px-2 py-0.5',
                  product.rank <= 3 ? 'bg-warning/20 border border-warning/30' : 'bg-background/80'
                )}>
                  <span className="text-sm">{rankMedal[product.rank] || `#${product.rank}`}</span>
                  {product.rank > 3 && <span className="text-[10px] font-bold text-foreground">#{product.rank}</span>}
                </div>
                <Badge className={cn('absolute top-2 right-2 text-[9px] font-black border', badgeCfg[product.badge])}>
                  {product.badge}
                </Badge>
              </div>
              <div className="p-3 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[9px] border-primary/20 text-primary">{product.category}</Badge>
                  <div className="ml-auto flex items-center gap-1">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    <span className="text-[9px] font-bold text-warning">4.9</span>
                  </div>
                </div>
                <h3 className="font-black text-xs text-foreground uppercase leading-tight mb-1">{product.title}</h3>
                <p className="text-[11px] text-muted-foreground mb-2 line-clamp-1">{product.subtitle}</p>
                <div className="grid grid-cols-2 gap-2 mb-3 p-2 bg-muted/30 rounded-lg text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">This Week</p>
                    <p className="text-xs font-bold text-foreground flex items-center justify-center gap-1">
                      <Award className="h-3 w-3 text-primary" />{product.salesThisWeek}
                    </p>
                  </div>
                  <div className="border-l border-border">
                    <p className="text-[10px] text-muted-foreground">Revenue</p>
                    <p className="text-xs font-bold text-green-400">${product.revenue.toLocaleString()}</p>
                  </div>
                </div>
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
                      <ShoppingCart className="h-3 w-3" /> BUY NOW
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" className="w-full h-8 text-[10px] gap-1 border-border text-muted-foreground">
                    + ADD PRODUCT
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {dbProducts.length === 0 && staticTopSelling.length === 0 && (
          <ComingSoonCard label="Top Selling" />
        )}
      </SectionSlider>
    </section>
  );
}
