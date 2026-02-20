import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, TrendingUp, Award, Star, Zap } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { cn } from '@/lib/utils';

interface TopSellingProduct {
  id: string;
  rank: number;
  title: string;
  subtitle: string;
  image: string;
  category: string;
  salesThisWeek: number;
  revenue: number;
  rating: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  trendPercent: number;
  badge: 'CHAMPION' | 'RISING' | 'HOT' | 'GOLD';
  price: number;
}

const rankMedal: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const trendStyle = {
  UP: 'text-green-400',
  DOWN: 'text-destructive',
  STABLE: 'text-muted-foreground',
};
const badgeCfg = {
  CHAMPION: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  RISING: 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse',
  HOT: 'bg-destructive/20 text-destructive border-destructive/30 animate-pulse',
  GOLD: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const topSellingProducts: TopSellingProduct[] = [
  { id: 'ts-1', rank: 1, title: 'BAR & BISTRO POS', subtitle: 'Restaurant management powerhouse', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop', category: 'Food', salesThisWeek: 892, revenue: 4460, rating: 4.9, trend: 'UP', trendPercent: 23, badge: 'CHAMPION', price: 5 },
  { id: 'ts-2', rank: 2, title: 'SCHOOL ERP PRO', subtitle: 'K-12 education management leader', image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop', category: 'Education', salesThisWeek: 744, revenue: 3720, rating: 4.9, trend: 'UP', trendPercent: 18, badge: 'RISING', price: 5 },
  { id: 'ts-3', rank: 3, title: 'CLINIC MANAGER AI', subtitle: 'Healthcare SaaS for modern clinics', image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&h=300&fit=crop', category: 'Healthcare', salesThisWeek: 680, revenue: 3400, rating: 4.8, trend: 'UP', trendPercent: 12, badge: 'HOT', price: 5 },
  { id: 'ts-4', rank: 4, title: 'FLEET TRACKER GPS', subtitle: 'Real-time transport & logistics AI', image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&h=300&fit=crop', category: 'Transport', salesThisWeek: 521, revenue: 2605, rating: 4.7, trend: 'STABLE', trendPercent: 2, badge: 'GOLD', price: 5 },
  { id: 'ts-5', rank: 5, title: 'WHATSAPP CRM PRO', subtitle: 'Business messaging automation suite', image: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=400&h=300&fit=crop', category: 'Marketing', salesThisWeek: 498, revenue: 2490, rating: 4.8, trend: 'UP', trendPercent: 35, badge: 'RISING', price: 5 },
  { id: 'ts-6', rank: 6, title: 'RETAIL POS MAX', subtitle: 'Multi-store billing & inventory', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop', category: 'Retail', salesThisWeek: 430, revenue: 2150, rating: 4.6, trend: 'UP', trendPercent: 8, badge: 'HOT', price: 5 },
  { id: 'ts-7', rank: 7, title: 'PROPERTY CRM SUITE', subtitle: 'Real estate & rental management', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop', category: 'Real Estate', salesThisWeek: 382, revenue: 1910, rating: 4.7, trend: 'STABLE', trendPercent: 4, badge: 'GOLD', price: 5 },
  { id: 'ts-8', rank: 8, title: 'ACCOUNTING MASTER', subtitle: 'GST billing & tally-compatible ERP', image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=300&fit=crop', category: 'Finance', salesThisWeek: 340, revenue: 1700, rating: 4.8, trend: 'UP', trendPercent: 15, badge: 'CHAMPION', price: 5 },
];

export function TopSellingSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  return (
    <section className="py-4">
      <SectionHeader
        icon="🏆"
        title="This Week Top Selling"
        subtitle="Real sales data. Updated every 24 hours. Don't miss the trend."
        badge="LIVE RANKINGS"
        badgeVariant="live"
        totalCount={topSellingProducts.length}
      />

      <SectionSlider>
        {topSellingProducts.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, type: 'spring', stiffness: 260, damping: 24 }}
            whileHover={{ scale: 1.03, zIndex: 10 }}
            className="flex-shrink-0 w-[280px] md:w-[300px]"
          >
            <div className={cn(
              'relative rounded-xl overflow-hidden bg-card border shadow-lg h-full flex flex-col',
              product.rank <= 3 ? 'border-warning/40' : 'border-border'
            )}>
              {/* Image */}
              <div className="relative h-[100px] overflow-hidden">
                <img src={product.image} alt={product.title} className="w-full h-full object-cover opacity-50" />
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />

                {/* Rank */}
                <div className={cn(
                  'absolute top-2 left-2 flex items-center gap-1.5 rounded-full px-2 py-1',
                  product.rank <= 3 ? 'bg-warning/20 border border-warning/30' : 'bg-background/80'
                )}>
                  <span className="text-sm">{rankMedal[product.rank] || `#${product.rank}`}</span>
                  {product.rank > 3 && <span className="text-[10px] font-bold text-foreground">#{product.rank}</span>}
                </div>

                {/* Badge */}
                <Badge className={cn('absolute top-2 right-2 text-[9px] font-black border', badgeCfg[product.badge])}>
                  {product.badge}
                </Badge>

                {/* Trend */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  <TrendingUp className={cn('h-3 w-3', trendStyle[product.trend])} />
                  <span className={cn('text-[10px] font-bold', trendStyle[product.trend])}>
                    {product.trend === 'UP' ? '+' : product.trend === 'DOWN' ? '-' : ''}{product.trendPercent}%
                  </span>
                </div>
              </div>

              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[9px] border-primary/20 text-primary">{product.category}</Badge>
                  <div className="ml-auto flex items-center gap-1">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    <span className="text-[10px] font-bold text-warning">{product.rating}</span>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-foreground uppercase leading-tight mb-1">{product.title}</h3>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{product.subtitle}</p>

                {/* Sales Stats */}
                <div className="grid grid-cols-2 gap-2 mb-3 p-2 bg-muted/30 rounded-lg">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">This Week</p>
                    <p className="text-sm font-bold text-foreground flex items-center justify-center gap-1">
                      <Award className="h-3 w-3 text-primary" />
                      {product.salesThisWeek}
                    </p>
                  </div>
                  <div className="text-center border-l border-border">
                    <p className="text-[10px] text-muted-foreground">Revenue</p>
                    <p className="text-sm font-bold text-green-400">${product.revenue.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-auto">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-xs line-through text-muted-foreground">$49</span>
                    <span className="text-xl font-bold text-primary">$5</span>
                    <Badge className="bg-destructive/20 text-destructive border-0 text-[9px]">90% OFF</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] gap-1 border-primary/30 text-primary">
                      <Zap className="h-3.5 w-3.5" /> DEMO
                    </Button>
                    <Button size="sm" className="flex-1 h-8 text-[10px] gap-1" onClick={() => onBuyNow(product)}>
                      <ShoppingCart className="h-3.5 w-3.5" /> BUY $5
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </SectionSlider>
    </section>
  );
}
