import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Wifi, 
  WifiOff,
  Clock,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiStatusBarProps {
  isLoading: boolean;
  isConnected?: boolean;
  tokensReceived?: number;
  elapsedTime?: number;
  error?: string | null;
  model?: string;
}

export function AiStatusBar({ 
  isLoading, 
  isConnected = true,
  tokensReceived = 0,
  elapsedTime = 0,
  error = null,
  model = 'gemini-3-flash'
}: AiStatusBarProps) {
  
  const getStatus = () => {
    if (error) return 'error';
    if (isLoading) return 'working';
    return 'idle';
  };

  const status = getStatus();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex items-center justify-between gap-4 px-4 py-2 border-b text-xs transition-colors",
          status === 'working' && "bg-primary/5 border-primary/20",
          status === 'error' && "bg-destructive/5 border-destructive/20",
          status === 'idle' && "bg-muted/30 border-border/50"
        )}
      >
        {/* Left: Status indicator */}
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi className="h-3.5 w-3.5 text-success" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className={cn(
              "font-medium",
              isConnected ? "text-success" : "text-destructive"
            )}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-border" />

          {/* AI Status */}
          <div className="flex items-center gap-1.5">
            {status === 'working' ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 className="h-3.5 w-3.5 text-primary" />
                </motion.div>
                <span className="text-primary font-medium">AI Working...</span>
              </>
            ) : status === 'error' ? (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-destructive font-medium">Error</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span className="text-muted-foreground">Ready</span>
              </>
            )}
          </div>
        </div>

        {/* Center: Progress info when working */}
        {status === 'working' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-4"
          >
            {/* Tokens received - only show if > 0 */}
            {tokensReceived > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Zap className="h-3 w-3 text-primary" />
                <span>
                  <span className="text-foreground font-medium">{tokensReceived}</span> tokens
                </span>
              </div>
            )}

            {/* Elapsed time - only show if > 0 */}
            {elapsedTime > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  <span className="text-foreground font-medium">{elapsedTime.toFixed(1)}</span>s
                </span>
              </div>
            )}

            {/* Progress animation - always show when working */}
            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-orange-500 rounded-full"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            
            <span className="text-xs text-muted-foreground animate-pulse">Generating...</span>
          </motion.div>
        )}

        {/* Right: Model info */}
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            Model: <span className="text-foreground font-medium">{model}</span>
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
