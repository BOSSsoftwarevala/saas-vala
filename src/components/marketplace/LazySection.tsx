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
 */
export function LazySection({ children, height = 320, rootMargin = '400px' }: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

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

  return <div ref={ref}>{children}</div>;
}
