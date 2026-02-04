import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Heart, Bell, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface Product {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  status: 'upcoming' | 'live' | 'bestseller';
  price: number;
}

interface ProductSliderProps {
  title: string;
  products: Product[];
  onBuyNow?: (product: Product) => void;
  onFavorite?: (product: Product) => void;
  onNotify?: (product: Product) => void;
}

const statusConfig = {
  upcoming: { label: 'UPCOMING', className: 'bg-warning/20 text-warning border-warning/30' },
  live: { label: 'LIVE', className: 'bg-success/20 text-success border-success/30' },
  bestseller: { label: 'BEST SELLER', className: 'bg-primary/20 text-primary border-primary/30' },
};

export function ProductSlider({ title, products, onBuyNow, onFavorite, onNotify }: ProductSliderProps) {
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

  return (
    <div className="relative group py-4">
      {/* Row Title */}
      <h2 className="text-lg md:text-xl font-display font-semibold text-foreground mb-4 px-4 md:px-8">
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
          {products.map((product) => (
            <motion.div
              key={product.id}
              className="flex-shrink-0 w-[200px] md:w-[240px] group/card"
              whileHover={{ scale: 1.05, zIndex: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div className="relative rounded-xl overflow-hidden bg-card border border-border shadow-lg hover:shadow-xl transition-shadow">
                {/* Image */}
                <div className="relative h-[120px] md:h-[140px] overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Status Badge */}
                  <Badge 
                    className={cn(
                      'absolute top-2 left-2 text-[10px] font-semibold',
                      statusConfig[product.status].className
                    )}
                  >
                    {statusConfig[product.status].label}
                  </Badge>
                  {/* Favorite Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 bg-background/80 hover:bg-background opacity-0 group-hover/card:opacity-100 transition-opacity"
                    onClick={() => onFavorite?.(product)}
                  >
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>

                {/* Content */}
                <div className="p-3 space-y-2">
                  <h3 className="font-semibold text-sm text-foreground uppercase truncate">
                    {product.title}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {product.subtitle}
                  </p>
                  
                  {/* Price & Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-bold text-primary text-sm">
                      ₹{product.price.toLocaleString()}
                    </span>
                    {product.status === 'upcoming' ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => onNotify?.(product)}
                      >
                        <Bell className="h-3 w-3" />
                        Notify
                      </Button>
                    ) : (
                      <Button 
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => onBuyNow?.(product)}
                      >
                        <ShoppingCart className="h-3 w-3" />
                        Buy
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
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
