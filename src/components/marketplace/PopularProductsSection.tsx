import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Heart, Star, Flame, TrendingUp, Zap, Plus } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const staticPopular = [
  { id: 'pp-1', title: 'WHATSAPP BUSINESS PRO', subtitle: 'Automation & bulk messaging platform', image: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=400&h=300&fit=crop', category: 'Marketing', rating: 4.9, reviews: 3240, wishlistCount: 8900, badge: 'ALL-TIME' as const, price: 5 },
  { id: 'pp-2', title: 'GST BILLING MASTER', subtitle: "India's #1 GST billing & accounting", image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=300&fit=crop', category: 'Finance', rating: 4.9, reviews: 5100, wishlistCount: 12400, badge: 'ALL-TIME' as const, price: 5 },
  { id: 'pp-3', title: 'MULTI STORE RETAIL POS', subtitle: 'Centralized retail chain management', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop', category: 'Retail', rating: 4.8, reviews: 2890, wishlistCount: 7200, badge: 'EDITORS PICK' as const, price: 5 },
  { id: 'pp-4', title: 'STUDENT LMS PORTAL', subtitle: 'Modern learning management system', image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=300&fit=crop', category: 'Education', rating: 4.8, reviews: 1940, wishlistCount: 5400, badge: 'COMMUNITY FAV' as const, price: 5 },
  { id: 'pp-5', title: 'HOTEL & RESORT PMS', subtitle: 'Full property management solution', image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=300&fit=crop', category: 'Hospitality', rating: 4.7, reviews: 1230, wishlistCount: 3800, badge: 'POPULAR' as const, price: 5 },
  { id: 'pp-6', title: 'PAYROLL SMART SUITE', subtitle: 'Complete HR & payroll automation', image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=300&fit=crop', category: 'HR', rating: 4.7, reviews: 2100, wishlistCount: 6300, badge: 'EDITORS PICK' as const, price: 5 },
  { id: 'pp-7', title: 'DELIVERY PARTNER APP', subtitle: 'Last-mile delivery management platform', image: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=400&h=300&fit=crop', category: 'Logistics', rating: 4.6, reviews: 890, wishlistCount: 2900, badge: 'POPULAR' as const, price: 5 },
  { id: 'pp-8', title: 'CONSTRUCTION ERP', subtitle: 'Site management & contractor billing', image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop', category: 'Construction', rating: 4.6, reviews: 760, wishlistCount: 2100, badge: 'COMMUNITY FAV' as const, price: 5 },
];

const badgeCfg = {
  POPULAR: 'bg-primary/20 text-primary border-primary/30',
  'ALL-TIME': 'bg-warning/20 text-warning border-warning/30',
  'EDITORS PICK': 'bg-accent/20 text-accent border-accent/30',
  'COMMUNITY FAV': 'bg-green-500/20 text-green-400 border-green-500/30',
};

export function PopularProductsSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const [wishlisted, setWishlisted] = useState<Set<string>>(new Set());
  const { products: dbProducts } = useProductsByCategory(['marketing', 'finance', 'hr', 'crm', 'accounting', 'hospitality', 'logistics', 'construction']);

  const toggleWishlist = (id: string, title: string) => {
    setWishlisted(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast('Removed from wishlist'); }
      else { next.add(id); toast.success(`❤️ ${title} saved to wishlist`); }
      return next;
    });
  };

  const showStatic = dbProducts.length === 0;

  return (
    <section className="py-4">
      <SectionHeader
        icon="🌟"
        title="Popular Products"
        subtitle="Community-loved software. Trusted by thousands of businesses."
        badge="COMMUNITY CHOICE"
        badgeVariant="trending"
        totalCount={dbProducts.length || staticPopular.length}
      />

      <SectionSlider>
        {/* DB products */}
        {!showStatic && dbProducts.map((p, i) => (
          <MarketplaceProductCard key={p.id} product={p} index={i} onBuyNow={onBuyNow} />
        ))}

        {/* Static fallback */}
        {showStatic && staticPopular.map((product) => {
          const isWL = wishlisted.has(product.id);
          return (
            <div key={product.id} className="flex-shrink-0 w-[280px] md:w-[300px]">
              <div className="relative rounded-xl overflow-hidden bg-card border border-border shadow-lg h-full flex flex-col">
                <div className="relative h-[108px] overflow-hidden">
                  <img src={product.image} alt={product.title} className="w-full h-full object-cover opacity-50" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                  <Badge className={cn('absolute top-2 left-2 text-[9px] font-black border', badgeCfg[product.badge])}>
                    {product.badge}
                  </Badge>
                  <button
                    onClick={() => toggleWishlist(product.id, product.title)}
                    className={cn(
                      'absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center transition-all',
                      isWL ? 'bg-destructive text-destructive-foreground' : 'bg-background/80 text-muted-foreground hover:text-destructive'
                    )}
                  >
                    <Heart className={cn('h-3 w-3', isWL && 'fill-current')} />
                  </button>
                  <div className="absolute bottom-2 left-2 flex items-center gap-1">
                    <Flame className="h-3 w-3 text-destructive" />
                    <span className="text-[9px] text-destructive font-bold">{(product.wishlistCount / 1000).toFixed(1)}k wishlisted</span>
                  </div>
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[9px] border-primary/20 text-primary">{product.category}</Badge>
                    <div className="ml-auto flex items-center gap-1">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      <span className="text-[9px] font-bold text-warning">{product.rating}</span>
                      <span className="text-[9px] text-muted-foreground">({product.reviews.toLocaleString()})</span>
                    </div>
                  </div>
                  <h3 className="font-black text-xs text-foreground uppercase leading-tight mb-1">{product.title}</h3>
                  <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2">{product.subtitle}</p>
                  <div className="flex items-baseline gap-1 mb-3 mt-auto">
                    <span className="text-xs line-through text-muted-foreground">$49</span>
                    <span className="text-xl font-black text-primary">$5</span>
                    <Badge className="bg-destructive/20 text-destructive border-0 text-[9px]">90% OFF</Badge>
                    <TrendingUp className="h-3 w-3 text-green-400 ml-auto" />
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
                      <Plus className="h-3 w-3" /> ADD PRODUCT
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {dbProducts.length === 0 && staticPopular.length === 0 && <ComingSoonCard label="Popular" />}
      </SectionSlider>
    </section>
  );
}
