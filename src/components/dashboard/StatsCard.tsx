import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatsCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  accentColor?: 'orange' | 'cyan' | 'purple' | 'green';
  index?: number;
}

const accentStyles = {
  orange: {
    gradient: 'bg-orange-gradient',
    glow: 'glow-orange',
    text: 'text-primary',
    ring: 'hsl(25, 95%, 53%)',
  },
  cyan: {
    gradient: 'bg-cyan-gradient',
    glow: 'glow-cyan',
    text: 'text-cyan',
    ring: 'hsl(187, 85%, 53%)',
  },
  purple: {
    gradient: 'bg-purple-gradient',
    glow: 'glow-purple',
    text: 'text-purple',
    ring: 'hsl(270, 70%, 55%)',
  },
  green: {
    gradient: 'bg-gradient-to-br from-green to-emerald-600',
    glow: '',
    text: 'text-green',
    ring: 'hsl(142, 76%, 45%)',
  },
};

export function StatsCard({
  title,
  value,
  prefix = '',
  suffix = '',
  icon: Icon,
  trend,
  accentColor = 'orange',
  index = 0,
}: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const styles = accentStyles[accentColor];

  // Animate counter
  useEffect(() => {
    const duration = 1200;
    const steps = 40;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ 
        y: -6, 
        scale: 1.02,
        transition: { duration: 0.3, ease: 'easeOut' }
      }}
      whileTap={{ scale: 0.98 }}
      className="neon-card holographic rounded-xl p-6 cursor-default group"
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
            {title}
          </p>
          <div className="flex items-baseline gap-1">
            <motion.span
              key={displayValue}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold font-display text-foreground animate-number"
            >
              {prefix}
              {displayValue.toLocaleString()}
              {suffix}
            </motion.span>
          </div>
          {trend && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className={cn(
                'flex items-center gap-1.5 text-sm font-semibold',
                trend.positive ? 'text-success' : 'text-destructive'
              )}
            >
              <motion.span
                animate={{ y: trend.positive ? [0, -2, 0] : [0, 2, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {trend.positive ? '↑' : '↓'}
              </motion.span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground font-normal text-xs">vs last month</span>
            </motion.div>
          )}
        </div>
        <motion.div
          whileHover={{ rotate: 12, scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center relative cyber-pulse',
            styles.gradient,
          )}
        >
          <Icon className="h-6 w-6 text-white relative z-10" />
        </motion.div>
      </div>
      
      {/* Bottom glow line */}
      <div className="absolute bottom-0 left-4 right-4 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div 
          className="h-full w-full"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${styles.ring} 50%, transparent 100%)`,
          }}
        />
      </div>
    </motion.div>
  );
}