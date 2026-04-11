import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ResellerPlan } from '@/lib/reseller-plans';

interface ResellerBadgeProps {
  plan?: ResellerPlan;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export default function ResellerBadge({ 
  plan, 
  size = 'md', 
  showLabel = true, 
  className = '' 
}: ResellerBadgeProps) {
  if (!plan) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const emojiSize = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <Badge 
      className={`
        ${sizeClasses[size]} 
        ${plan.badge.color} 
        bg-gradient-to-r from-transparent to-current/20 
        border-current/30 
        font-semibold
        ${className}
      `}
      variant="outline"
    >
      <span className={`${emojiSize[size]} mr-1`}>
        {plan.badge.emoji}
      </span>
      {showLabel && (
        <span>{plan.badge.label}</span>
      )}
    </Badge>
  );
}
