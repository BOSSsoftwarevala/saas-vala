import { useRef, useState, useEffect, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LazySectionProps {
  children: ReactNode;
  height?: number;
  rootMargin?: string;
}

/**
 * Renders children only when the section scrolls into viewport.
 * Uses IntersectionObserver for zero-cost offscreen sections.
 * ✅ AUTO-REFRESH: Listens for product updates and triggers child re-render
 */
export function LazySection({ children, height = 320, rootMargin = '400px' }: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // ✅ ADD: Refresh key to force child re-renders when products update
  const [refreshKey, setRefreshKey] = useState(0);

  // ✅ ADD: Listen for admin product updates and trigger re-render
  useEffect(() => {
    const MARKETPLACE_PRODUCT_UPDATED = 'marketplace:product-updated';
    
    const handleProductUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('[LazySection] Product updated, re-rendering children...');
      
      // Increment key to force all children to re-mount with fresh data
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener(MARKETPLACE_PRODUCT_UPDATED, handleProductUpdate);
    
    return () => {
      window.removeEventListener(MARKETPLACE_PRODUCT_UPDATED, handleProductUpdate);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  if (!visible) {
    return (
      <div ref={ref} style={{ minHeight: height }} className="py-4">
        <div className="mx-4 md:mx-8 space-y-3">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-56 rounded-xl shrink-0" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ✅ ADD: key={refreshKey} forces all children to re-mount when products update
  return <div ref={ref} key={refreshKey}>{children}</div>;
}
