import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Bell, ShoppingCart, Play, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';

interface Product {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  status: 'upcoming' | 'live' | 'bestseller';
  price: number;
  icon?: string;
  category?: string;
  description?: string;
  features?: string[];
  originalPrice?: number;
  discount?: number;
}

interface ProductSliderProps {
  title: string;
  products: Product[];
  onBuyNow?: (product: Product) => void;
  onFavorite?: (product: Product) => void;
  onNotify?: (product: Product) => void;
  onLiveDemo?: (product: Product) => void;
}

const statusConfig = {
  upcoming: { label: 'COMING SOON', className: 'bg-amber-500/90 text-white border-0' },
  live: { label: '● LIVE DEMO', className: 'bg-emerald-500/90 text-white border-0' },
  bestseller: { label: '● LIVE DEMO', className: 'bg-emerald-500/90 text-white border-0' },
};

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

export function ProductSlider({ title, products, onBuyNow, onFavorite, onNotify, onLiveDemo }: ProductSliderProps) {
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
            const originalPrice = product.originalPrice || Math.round(product.price * 1.67);
            const discount = product.discount || 40;
            const features = product.features || ['Feature 1', 'Feature 2', 'Feature 3'];
            
            return (
              <motion.div
                key={product.id}
                className="flex-shrink-0 w-[280px] md:w-[320px]"
                whileHover={{ scale: 1.02, zIndex: 10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <div className="relative rounded-xl overflow-hidden bg-card border border-border shadow-lg hover:shadow-xl transition-shadow h-full flex flex-col">
                  {/* Header with Icon */}
                  <div className="relative h-[100px] bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-between px-4">
                    <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
                      <IconComponent className="h-7 w-7 text-primary" />
                    </div>
                    {/* Status Badge */}
                    <Badge 
                      className={cn(
                        'text-[10px] font-bold px-3 py-1 rounded-full',
                        statusConfig[product.status].className
                      )}
                    >
                      {statusConfig[product.status].label}
                    </Badge>
                    {/* Rank Badge */}
                    <div className="absolute bottom-2 right-4">
                      <span className="text-xs text-muted-foreground">#{index + 1}</span>
                    </div>
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
                      {features.slice(0, 4).map((feature, i) => (
                        <Badge 
                          key={i} 
                          variant="outline" 
                          className="text-[10px] bg-muted/50 border-border text-foreground"
                        >
                          {feature}
                        </Badge>
                      ))}
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-2 mb-4 mt-auto">
                      <span className="text-xs text-muted-foreground line-through">
                        ₹{originalPrice.toLocaleString()}
                      </span>
                      <span className="font-bold text-lg text-primary">
                        ₹{product.price.toLocaleString()}
                      </span>
                      <Badge className="bg-destructive/20 text-destructive border-0 text-[10px]">
                        {discount}% OFF
                      </Badge>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {product.status === 'upcoming' ? (
                        <>
                          <Button 
                            variant="outline"
                            size="sm"
                            className="flex-1 h-9 text-xs gap-1.5"
                            disabled
                          >
                            <Clock className="h-3.5 w-3.5" />
                            COMING SOON
                          </Button>
                          <Button 
                            size="sm"
                            className="flex-1 h-9 text-xs gap-1.5 bg-destructive hover:bg-destructive/90"
                            onClick={() => onNotify?.(product)}
                          >
                            <Bell className="h-3.5 w-3.5" />
                            NOTIFY ME
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button 
                            variant="outline"
                            size="sm"
                            className="flex-1 h-9 text-xs gap-1.5 border-primary text-primary hover:bg-primary/10"
                            onClick={() => onLiveDemo?.(product)}
                          >
                            <Play className="h-3.5 w-3.5" />
                            LIVE DEMO
                          </Button>
                          <Button 
                            size="sm"
                            className="flex-1 h-9 text-xs gap-1.5"
                            onClick={() => onBuyNow?.(product)}
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            BUY NOW
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
