import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  icon: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeVariant?: 'hot' | 'new' | 'trending' | 'limited' | 'live' | 'top';
  totalCount?: number;
  onViewAll?: () => void;
  accentColor?: string;
}

const badgeStyles = {
  hot: 'bg-destructive text-destructive-foreground animate-pulse',
  new: 'bg-secondary text-secondary-foreground',
  trending: 'bg-accent text-accent-foreground',
  limited: 'bg-warning text-warning-foreground',
  live: 'bg-green-500 text-white',
  top: 'bg-primary text-primary-foreground',
};

export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(({
  icon,
  title,
  subtitle,
  badge,
  badgeVariant = 'hot',
  totalCount,
  onViewAll,
  accentColor,
}, ref) => {
  return (
    <div ref={ref} className="px-4 md:px-8 mb-5 flex items-start justify-between">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">{icon}</span>
          <motion.h2
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className={cn(
              'text-xl md:text-2xl font-bold tracking-tight uppercase',
              accentColor ? accentColor : 'text-foreground'
            )}
          >
            {title}
          </motion.h2>
          {badge && (
            <Badge className={cn('text-[10px] font-black px-2 py-0.5 uppercase tracking-widest', badgeStyles[badgeVariant])}>
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground ml-9">
          {subtitle}
          {totalCount !== undefined && (
            <span className="ml-2 text-primary font-semibold">{totalCount.toLocaleString()} products</span>
          )}
        </p>
      </div>

      {onViewAll && (
        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary/80 gap-1 text-xs shrink-0 mt-1"
          onClick={onViewAll}
        >
          View All <ChevronRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
});
SectionHeader.displayName = 'SectionHeader';
