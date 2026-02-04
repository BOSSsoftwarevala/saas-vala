import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NetflixRowProps {
  title: string;
  subtitle?: string;
  onViewAll?: () => void;
  children: ReactNode;
  className?: string;
}

export function NetflixRow({
  title,
  subtitle,
  onViewAll,
  children,
  className,
}: NetflixRowProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {onViewAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="text-primary hover:text-primary/80 hover:bg-primary/10"
          >
            View All
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="netflix-scroll">{children}</div>
    </section>
  );
}
