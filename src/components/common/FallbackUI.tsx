// Fallback UI Component - Safe UI for data failures
import { AlertTriangle, RefreshCw, WifiOff, Database, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FallbackUIProps {
  type?: 'error' | 'network' | 'empty' | 'loading';
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export default function FallbackUI({
  type = 'error',
  title,
  message,
  onRetry,
  className,
}: FallbackUIProps) {
  const config = {
    error: {
      icon: <XCircle className="w-16 h-16 text-red-500" />,
      defaultTitle: 'Something went wrong',
      defaultMessage: 'An error occurred while loading data. Please try again.',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
    },
    network: {
      icon: <WifiOff className="w-16 h-16 text-orange-500" />,
      defaultTitle: 'Network error',
      defaultMessage: 'Please check your internet connection and try again.',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
    },
    empty: {
      icon: <Database className="w-16 h-16 text-slate-500" />,
      defaultTitle: 'No data available',
      defaultMessage: 'There is no data to display at this time.',
      bgColor: 'bg-slate-800/50',
      borderColor: 'border-slate-700/50',
    },
    loading: {
      icon: <RefreshCw className="w-16 h-16 text-blue-500 animate-spin" />,
      defaultTitle: 'Loading...',
      defaultMessage: 'Please wait while we load your data.',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    },
  };

  const currentConfig = config[type];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-12 rounded-2xl border',
        currentConfig.bgColor,
        currentConfig.borderColor,
        className
      )}
    >
      <div className="mb-6">{currentConfig.icon}</div>
      
      <h3 className="text-xl font-semibold text-white mb-2">
        {title || currentConfig.defaultTitle}
      </h3>
      
      <p className="text-slate-400 text-center mb-6 max-w-md">
        {message || currentConfig.defaultMessage}
      </p>
      
      {onRetry && type !== 'loading' && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="w-5 h-5" />
          Try Again
        </button>
      )}
    </div>
  );
}

// HOC to wrap components with fallback UI
export function withFallbackUI<T extends object>(
  Component: React.ComponentType<T>,
  fallbackType?: FallbackUIProps['type']
) {
  return function WithFallbackUIWrapper(props: T & { error?: boolean; loading?: boolean; onRetry?: () => void }) {
    const { error, loading, onRetry, ...rest } = props;

    if (loading) {
      return <FallbackUI type="loading" />;
    }

    if (error) {
      return (
        <FallbackUI
          type={fallbackType || 'error'}
          onRetry={onRetry}
        />
      );
    }

    return <Component {...(rest as T)} />;
  };
}
