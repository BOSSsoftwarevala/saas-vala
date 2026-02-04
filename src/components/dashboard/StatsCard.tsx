import { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

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
}

const accentStyles = {
  orange: {
    gradient: 'bg-orange-gradient',
    glow: 'glow-orange',
    text: 'text-primary',
  },
  cyan: {
    gradient: 'bg-cyan-gradient',
    glow: 'glow-cyan',
    text: 'text-cyan',
  },
  purple: {
    gradient: 'bg-purple-gradient',
    glow: 'glow-purple',
    text: 'text-purple',
  },
  green: {
    gradient: 'bg-gradient-to-br from-green to-emerald-600',
    glow: '',
    text: 'text-green',
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
}: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const styles = accentStyles[accentColor];

  // Animate counter
  useEffect(() => {
    const duration = 1000;
    const steps = 30;
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
    <div className="glass-card-hover rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-display text-foreground animate-number">
              {prefix}
              {displayValue.toLocaleString()}
              {suffix}
            </span>
          </div>
          {trend && (
            <div
              className={cn(
                'flex items-center gap-1 text-sm font-medium',
                trend.positive ? 'text-success' : 'text-destructive'
              )}
            >
              <span>{trend.positive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>
        <div
          className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center',
            styles.gradient,
            styles.glow
          )}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}
