import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface SectionSliderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Netflix-style horizontal slider with smooth scroll, perfect alignment, and premium feel.
 * - Smooth left/right scroll with fixed-width cards
 * - Scroll-snap for clean alignment
 * - All cards contained within frame
 * - Premium 7D styling with soft shadows and glow effects
 */
export const SectionSlider = React.forwardRef<HTMLDivElement, SectionSliderProps>(({ children, className }, ref) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isOverContainer, setIsOverContainer] = useState(false);

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

  // Auto-scroll every 5 seconds (paused on hover)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isMobile) return;

    let paused = false;
    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    const onVisibilityChange = () => {
      paused = document.hidden;
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const interval = setInterval(() => {
      if (paused || !el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      if (scrollLeft >= scrollWidth - clientWidth - 10) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: clientWidth * 0.75, behavior: 'smooth' });
      }
    }, 5000);
    
    return () => {
      clearInterval(interval);
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isMobile]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const card = scrollRef.current.firstElementChild as HTMLElement | null;
    const gap = 20;
    const amount = card ? card.offsetWidth + gap : 280;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
    setTimeout(checkScroll, 350);
  };

  return (
    <div
      className="relative group/slider"
      onMouseEnter={() => setIsOverContainer(true)}
      onMouseLeave={() => setIsOverContainer(false)}
    >
      {/* Left scroll button - Netflix style */}
      {canScrollLeft && !isMobile && (
        <button
          onClick={() => scroll('left')}
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 z-20',
            'h-12 w-12 rounded-full',
            'bg-gradient-to-r from-background/95 to-background/70 backdrop-blur-sm',
            'border border-white/5 shadow-2xl',
            'flex items-center justify-center',
            'text-foreground/60 hover:text-foreground hover:bg-gradient-to-r hover:from-background/98 hover:to-background/80 hover:border-white/20',
            'transition-all duration-300 ease-out',
            'opacity-0 group-hover/slider:opacity-100 hover:scale-110',
            'flex-shrink-0'
          )}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Scrollable container - Netflix smooth scroll */}
      <div
        ref={scrollRef}
        className={cn(
          'flex flex-nowrap gap-5 overflow-x-auto overflow-y-hidden',
          'px-5 py-2',
          'scroll-smooth snap-x snap-mandatory',
          'touch-pan-x',
          'scrollbar-hide',
          className
        )}
        style={{
          paddingInline: 20,
          scrollPaddingInline: 20,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth'
        }}
      >
        {children}
      </div>

      {/* Right scroll button - Netflix style */}
      {canScrollRight && !isMobile && (
        <button
          onClick={() => scroll('right')}
          className={cn(
            'absolute right-0 top-1/2 -translate-y-1/2 z-20',
            'h-12 w-12 rounded-full',
            'bg-gradient-to-l from-background/95 to-background/70 backdrop-blur-sm',
            'border border-white/5 shadow-2xl',
            'flex items-center justify-center',
            'text-foreground/60 hover:text-foreground hover:bg-gradient-to-l hover:from-background/98 hover:to-background/80 hover:border-white/20',
            'transition-all duration-300 ease-out',
            'opacity-0 group-hover/slider:opacity-100 hover:scale-110',
            'flex-shrink-0'
          )}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
});
SectionSlider.displayName = 'SectionSlider';
