import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionSliderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Reusable horizontal slider with left/right arrow navigation.
 * Wraps any horizontally scrollable card list.
 */
export function SectionSlider({ children, className }: SectionSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    setTimeout(checkScroll, 350);
  };

  return (
    <div className="relative group">
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className={cn(
            'absolute left-1 top-1/2 -translate-y-1/2 z-20',
            'h-10 w-10 rounded-full',
            'bg-background/90 border border-border shadow-xl',
            'flex items-center justify-center',
            'text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary',
            'transition-all duration-200',
            'opacity-0 group-hover:opacity-100'
          )}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className={cn(
          'flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-2',
          className
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className={cn(
            'absolute right-1 top-1/2 -translate-y-1/2 z-20',
            'h-10 w-10 rounded-full',
            'bg-background/90 border border-border shadow-xl',
            'flex items-center justify-center',
            'text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary',
            'transition-all duration-200',
            'opacity-0 group-hover:opacity-100'
          )}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
