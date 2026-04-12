import { motion } from 'framer-motion';
import { Zap, Clock, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TokenUsageDisplayProps {
  tokens: number;
  elapsedMs: number;
  isLoading: boolean;
  estimatedCost?: number;
}

export function TokenUsageDisplay({ tokens, elapsedMs, isLoading, estimatedCost }: TokenUsageDisplayProps) {
  if (!isLoading && tokens === 0) return null;

  const elapsed = (elapsedMs / 1000).toFixed(1);
  const tps = elapsedMs > 0 ? ((tokens / elapsedMs) * 1000).toFixed(1) : '0';
  const cost = estimatedCost ?? (tokens * 0.00001);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn(
        "flex items-center gap-3 text-[10px] px-2 py-1 rounded-md",
        isLoading ? "bg-primary/5 text-primary" : "bg-muted/30 text-muted-foreground"
      )}
    >
      <span className="flex items-center gap-1">
        <Zap className="h-3 w-3" />
        <span className="font-mono font-semibold">{tokens}</span> tokens
      </span>
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        <span className="font-mono">{elapsed}s</span>
        {isLoading && <span>({tps} t/s)</span>}
      </span>
      <span className="flex items-center gap-1">
        <DollarSign className="h-3 w-3" />
        <span className="font-mono">${cost.toFixed(4)}</span>
      </span>
      {isLoading && (
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-primary"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}
