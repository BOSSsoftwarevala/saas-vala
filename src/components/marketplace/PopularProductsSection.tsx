import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Heart, Play, Star, Flame, TrendingUp } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

interface PopularProduct {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  category: string;
  rating: number;
  reviews: number;
  wishlistCount: number;
  isWishlisted?: boolean;
  badge: 'POPULAR' | 'ALL-TIME' | 'EDITORS PICK' | 'COMMUNITY FAV';
  description: string;
  features: string[];
  price: number;
}

const badgeCfg = {
  POPULAR: 'bg-primary/20 text-primary border-primary/30',
  'ALL-TIME': 'bg-warning/20 text-warning border-warning/30',
  'EDITORS PICK': 'bg-accent/20 text-accent border-accent/30',
  'COMMUNITY FAV': 'bg-green-500/20 text-green-400 border-green-500/30',
};

const popularProducts: PopularProduct[] = [
  { id: 'pp-1', title: 'WHATSAPP BUSINESS PRO', subtitle: 'Automation & bulk messaging platform', image: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=400&h=300&fit=crop', category: 'Marketing', rating: 4.9, reviews: 3240, wishlistCount: 8900, badge: 'ALL-TIME', description: 'Send bulk messages, auto-replies, chatbots, broadcast lists — all from one dashboard', features: ['Bulk Messaging', 'Chatbot AI', 'Broadcast', 'Analytics'], price: 5 },
  { id: 'pp-2', title: 'GST BILLING MASTER', subtitle: 'India\'s #1 GST billing & accounting', image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=300&fit=crop', category: 'Finance', rating: 4.9, reviews: 5100, wishlistCount: 12400, badge: 'ALL-TIME', description: 'GST-compliant invoicing, tally import, multi-branch accounting in one powerful tool', features: ['GST Reports', 'Tally Import', 'E-Invoice', 'Multi-GSTIN'], price: 5 },
  { id: 'pp-3', title: 'MULTI STORE RETAIL POS', subtitle: 'Centralized retail chain management', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop', category: 'Retail', rating: 4.8, reviews: 2890, wishlistCount: 7200, badge: 'EDITORS PICK', description: 'Manage unlimited stores from one HQ dashboard with real-time inventory sync', features: ['Multi-Store', 'Real-time Sync', 'Loyalty Points', 'Analytics'], price: 5 },
  { id: 'pp-4', title: 'STUDENT LMS PORTAL', subtitle: 'Modern learning management system', image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=300&fit=crop', category: 'Education', rating: 4.8, reviews: 1940, wishlistCount: 5400, badge: 'COMMUNITY FAV', description: 'Upload courses, conduct live classes, auto-grade exams, issue certificates', features: ['Live Classes', 'Quizzes', 'Certificates', 'Progress AI'], price: 5 },
  { id: 'pp-5', title: 'HOTEL & RESORT PMS', subtitle: 'Full property management solution', image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=300&fit=crop', category: 'Hospitality', rating: 4.7, reviews: 1230, wishlistCount: 3800, badge: 'POPULAR', description: 'Reservation engine, room POS, housekeeping, guest CRM, channel manager', features: ['Reservations', 'Room Service', 'OTA Sync', 'Guest CRM'], price: 5 },
  { id: 'pp-6', title: 'PAYROLL SMART SUITE', subtitle: 'Complete HR & payroll automation', image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=300&fit=crop', category: 'HR', rating: 4.7, reviews: 2100, wishlistCount: 6300, badge: 'EDITORS PICK', description: 'Attendance, leave management, payslip generation, PF/ESI compliance in one app', features: ['Attendance', 'Payslips', 'PF/ESI', 'Leave Mgmt'], price: 5 },
  { id: 'pp-7', title: 'DELIVERY PARTNER APP', subtitle: 'Last-mile delivery management platform', image: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=400&h=300&fit=crop', category: 'Logistics', rating: 4.6, reviews: 890, wishlistCount: 2900, badge: 'POPULAR', description: 'Order dispatch, driver tracking, customer notifications, COD management', features: ['Live Tracking', 'COD', 'Driver App', 'Reports'], price: 5 },
  { id: 'pp-8', title: 'CONSTRUCTION ERP', subtitle: 'Site management & contractor billing', image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop', category: 'Construction', rating: 4.6, reviews: 760, wishlistCount: 2100, badge: 'COMMUNITY FAV', description: 'Material tracking, labour management, project costing, site supervisor app', features: ['Site Tracker', 'Labour Mgmt', 'Cost Tracking', 'Reports'], price: 5 },
];

export function PopularProductsSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const [wishlisted, setWishlisted] = useState<Set<string>>(new Set());

  const toggleWishlist = (id: string, title: string) => {
    setWishlisted(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast('Removed from wishlist');
      } else {
        next.add(id);
        toast.success(`❤️ ${title} saved to wishlist`);
      }
      return next;
    });
  };

  return (
    <section className="py-4">
      <SectionHeader
        icon="🌟"
        title="Popular Products"
        subtitle="Community-loved software. Trusted by thousands of businesses."
        badge="COMMUNITY CHOICE"
        badgeVariant="trending"
        totalCount={popularProducts.length}
      />

      <SectionSlider>
        {popularProducts.map((product, index) => {
          const isWL = wishlisted.has(product.id);
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, type: 'spring', stiffness: 260, damping: 24 }}
              whileHover={{ scale: 1.03, zIndex: 10 }}
              className="flex-shrink-0 w-[280px] md:w-[300px]"
            >
              <div className="relative rounded-xl overflow-hidden bg-card border border-border shadow-lg h-full flex flex-col">
                {/* Image */}
                <div className="relative h-[100px] overflow-hidden">
                  <img src={product.image} alt={product.title} className="w-full h-full object-cover opacity-50" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                  <Badge className={cn('absolute top-2 left-2 text-[9px] font-black border', badgeCfg[product.badge])}>
                    {product.badge}
                  </Badge>
                  {/* Wishlist */}
                  <button
                    onClick={() => toggleWishlist(product.id, product.title)}
                    className={cn(
                      'absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center transition-all',
                      isWL ? 'bg-pink-500 text-white' : 'bg-background/80 text-muted-foreground hover:text-pink-400'
                    )}
                  >
                    <Heart className={cn('h-3.5 w-3.5', isWL && 'fill-current')} />
                  </button>
                  {/* Wishlist count */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1">
                    <Flame className="h-3 w-3 text-destructive" />
                    <span className="text-[10px] text-destructive font-bold">{(product.wishlistCount / 1000).toFixed(1)}k wishlisted</span>
                  </div>
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[9px] border-primary/20 text-primary">{product.category}</Badge>
                    <div className="ml-auto flex items-center gap-1">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      <span className="text-[10px] font-bold text-warning">{product.rating}</span>
                      <span className="text-[9px] text-muted-foreground">({product.reviews.toLocaleString()})</span>
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-foreground uppercase leading-tight mb-1">{product.title}</h3>
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{product.description}</p>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {product.features.map((f, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] bg-muted/30 border-border">{f}</Badge>
                    ))}
                  </div>

                  <div className="mt-auto">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-xs line-through text-muted-foreground">$49</span>
                      <span className="text-xl font-bold text-primary">$5</span>
                      <Badge className="bg-destructive/20 text-destructive border-0 text-[9px]">90% OFF</Badge>
                      <div className="ml-auto flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-400" />
                        <span className="text-[9px] text-green-400">Popular</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-primary/30 text-primary">
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" className="flex-1 h-8 text-[10px] gap-1" onClick={() => onBuyNow(product)}>
                        <ShoppingCart className="h-3.5 w-3.5" /> BUY $5/mo
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </SectionSlider>
    </section>
  );
}
