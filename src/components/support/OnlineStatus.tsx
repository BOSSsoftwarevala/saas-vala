import { cn } from '@/lib/utils';

interface OnlineStatusProps {
  isOnline: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function OnlineStatus({ isOnline, size = 'sm', showLabel = false, className }: OnlineStatusProps) {
  const sizeClasses = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'rounded-full flex-shrink-0',
          sizeClasses[size],
          isOnline 
            ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' 
            : 'bg-gray-400'
        )}
      />
      {showLabel && (
        <span className={cn(
          'text-xs',
          isOnline ? 'text-green-600' : 'text-gray-500'
        )}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </div>
  );
}
