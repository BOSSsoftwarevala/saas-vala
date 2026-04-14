import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
 import { ChevronLeft, ChevronRight, Bell, ShoppingCart, Play, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';

interface Product {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  status: 'upcoming' | 'live' | 'bestseller' | 'draft';
  price: number;
  icon?: string;
  category?: string;
  description?: string;
  features?: string[] | { icon: string; text: string }[];
  originalPrice?: number;
  discount?: number;
  techStack?: string[];
  apkUrl?: string;
}

interface ProductSliderProps {
  title: string;
  products: Product[];
  onBuyNow?: (product: Product) => void;
  onFavorite?: (product: Product) => void;
  onNotify?: (product: Product) => void;
  onLiveDemo?: (product: Product) => void;
   onDownloadApk?: (product: Product) => void;
   showTechStack?: boolean;
}


const productIcons: Record<string, keyof typeof LucideIcons> = {
  'education': 'GraduationCap',
  'healthcare': 'Heart',
  'government': 'Building2',
  'retail': 'ShoppingBag',
  'food': 'UtensilsCrossed',
  'transport': 'Truck',
  'logistics': 'Package',
  'manufacturing': 'Factory',
  'construction': 'HardHat',
  'agriculture': 'Tractor',
  'realestate': 'Home',
  'finance': 'Landmark',
  'insurance': 'Shield',
  'automobile': 'Car',
  'energy': 'Zap',
  'homeservices': 'Wrench',
  'professional': 'Briefcase',
  'media': 'Video',
  'events': 'Calendar',
  'travel': 'Plane',
  'security': 'Lock',
  'ngo': 'Heart',
  'religious': 'Church',
  'warehousing': 'Warehouse',
  'technology': 'Monitor',
  'default': 'Box',
};

function getIconComponent(category: string) {
  const iconName = productIcons[category.toLowerCase().replace(/[^a-z]/g, '')] || productIcons.default;
  const IconComponent = LucideIcons[iconName] as React.ComponentType<{ className?: string }>;
  return IconComponent || LucideIcons.Box;
}

export function ProductSlider({ title, products, onBuyNow, onFavorite, onNotify, onLiveDemo, onDownloadApk, showTechStack = false }: ProductSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 300);
    }
  };

  // Extract category from title
  const categoryName = title.replace(/^[^\s]+\s/, '').toLowerCase();

  return (
    <div className="relative group py-4">
      {/* Row Title */}
      <h2 className="text-lg md:text-xl font-display font-bold text-foreground mb-4 px-4 md:px-8 uppercase tracking-wide">
        {title}
      </h2>

      {/* Scroll Container */}
      <div className="relative">
        {/* Left Arrow */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 z-10 h-full rounded-none bg-gradient-to-r from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity',
            !canScrollLeft && 'hidden'
          )}
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>

        {/* Products */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map((product, index) => {
            const IconComponent = getIconComponent(categoryName);
            const features = product.features || ['Feature 1', 'Feature 2', 'Feature 3'];
            
            return (
              <motion.div
                key={product.id}
                style={{ width: '340px' }}
                className="flex-shrink-0"
                whileHover={{ scale: 1.015, zIndex: 10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <div className="relative rounded-2xl overflow-hidden border border-border/50 shadow-xl h-full flex flex-col" style={{ background: 'hsl(var(--card))' }}>
                  {/* Header with Icon — matches screenshot exactly */}
                  <div
                    className="relative flex items-center justify-between px-5 py-5"
                    style={{ backgroundColor: '#1e2235', minHeight: '100px' }}
                  >
                    {/* Orange icon box */}
                    <div
                      className="flex items-center justify-center rounded-xl shadow-lg"
                      style={{ width: 64, height: 64, background: 'rgba(249,115,22,0.25)', border: '1.5px solid rgba(249,115,22,0.4)' }}
                    >
                      <IconComponent style={{ width: 30, height: 30, color: '#f97316' }} />
                    </div>
                    {/* LIVE DEMO / COMING SOON badge — center */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      {product.status === 'upcoming' ? (
                        <span className="flex items-center gap-1.5 font-black text-black text-[11px] px-3 py-1 rounded-full" style={{ background: '#eab308' }}>
                          ON PIPELINE
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 font-black text-white text-[11px] px-3 py-1 rounded-full" style={{ background: '#16a34a', boxShadow: '0 0 12px rgba(22,163,74,0.5)' }}>
                          <span className="inline-block rounded-full animate-pulse" style={{ width: 6, height: 6, background: '#fff' }} />
                          LIVE DEMO
                        </span>
                      )}
                    </div>
                    {/* Rank — right */}
                    <span className="text-xs font-bold self-start" style={{ color: 'rgba(255,255,255,0.4)' }}>#{index + 1}</span>
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    {/* Title */}
                    <h3 className="font-bold text-base text-foreground uppercase leading-tight mb-1">
                      {product.title}
                    </h3>
                    
                    {/* Category Tag */}
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-xs text-primary">📍 {product.subtitle}</span>
                    </div>
                    
                    {/* Description */}
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      Complete solution with all features, reports, and integrations...
                    </p>

                    {/* Features / Tech Stack Tabs */}
                    <div className="flex gap-2 mb-2">
                      <Badge variant="default" className="text-[10px] bg-primary text-primary-foreground">
                        Features
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Tech Stack
                      </Badge>
                    </div>

                    {/* Feature Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                       {features.slice(0, showTechStack ? 5 : 4).map((feature, i) => {
                        const featureText = typeof feature === 'string' ? feature : feature.text;
                        const featureIcon = typeof feature === 'object' && feature.icon ? feature.icon : null;
                        const FeatureIconComponent = featureIcon ? (LucideIcons[featureIcon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>) : null;
                        return (
                          <Badge 
                            key={i} 
                            variant="outline" 
                            className={cn("bg-muted/50 border-border text-foreground flex items-center gap-1", showTechStack ? "text-[9px]" : "text-[10px]")}
                          >
                            {FeatureIconComponent && <FeatureIconComponent className="h-2.5 w-2.5" />}
                            {featureText}
                          </Badge>
                        );
                      })}
                    </div>

                     {/* Tech Stack Strip */}
                     {showTechStack && product.techStack && (
                       <div className="flex flex-wrap gap-1 mb-3">
                         {product.techStack.map((tech, i) => (
                           <Badge 
                             key={i} 
                             variant="secondary" 
                             className="text-[8px] bg-primary/10 text-primary border-0 px-1.5 py-0"
                           >
                             {tech}
                           </Badge>
                         ))}
                       </div>
                     )}
 
                    {/* Price */}
                    <div className="flex items-center gap-2 mb-3 mt-auto">
                      <span className="text-sm line-through text-muted-foreground">$10</span>
                      <span className="font-black text-[26px] text-primary leading-none">$5</span>
                      <Badge className="bg-destructive/20 text-destructive border-0 text-[10px]">90% OFF</Badge>
                      <span className="ml-auto text-[11px] font-bold text-yellow-400">★ 4.9</span>
                    </div>

                    {/* Action Buttons — DEMO | ❤️ ADD TO CART | BUY */}
                    <div className="flex gap-2">
                      {product.status === 'upcoming' ? (
                        <>
                          <Button
                            size="sm"
                            className="flex-1 h-10 text-[11px] gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl"
                            onClick={() => onNotify?.(product)}
                          >
                            <Bell className="h-3.5 w-3.5" />
                            NOTIFY ME
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-10 w-11 p-0 rounded-xl border-pink-400/40 text-pink-400 hover:bg-pink-500/10"
                            onClick={() => onFavorite?.(product)}
                            title="Add to Cart"
                          >
                            <Heart className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-10 text-[11px] gap-1.5 rounded-xl border-border hover:border-primary/50 hover:text-primary font-bold"
                            onClick={(e) => { e.stopPropagation(); onLiveDemo?.(product); }}
                          >
                            <Play className="h-3.5 w-3.5" />
                            DEMO
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-10 w-11 p-0 rounded-xl border-pink-400/40 text-pink-400 hover:bg-pink-500/10"
                            onClick={(e) => { e.stopPropagation(); onFavorite?.(product); }}
                            title="Add to Cart"
                          >
                            <Heart className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 h-10 text-[11px] gap-1.5 rounded-xl font-black"
                            onClick={(e) => { e.stopPropagation(); onBuyNow?.(product); }}
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            BUY $5
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Right Arrow */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'absolute right-0 top-1/2 -translate-y-1/2 z-10 h-full rounded-none bg-gradient-to-l from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity',
            !canScrollRight && 'hidden'
          )}
          onClick={() => scroll('right')}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      </div>
    </div>
  );
}
