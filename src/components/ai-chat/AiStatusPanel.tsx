import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi, Loader2, CheckCircle2, AlertCircle,
  Zap, Clock, Brain, RefreshCw, Send, Server, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type AiRequestStage =
  | 'idle'
  | 'sending'
  | 'connected'
  | 'receiving'
  | 'done'
  | 'retrying'
  | 'error';

export interface AiStatusState {
  stage: AiRequestStage;
  model?: string;
  elapsedMs?: number;
  responseMs?: number;
  tokens?: number;
  errorCode?: number | string;
  errorMessage?: string;
  retryCount?: number;
}

interface AiStatusPanelProps {
  status: AiStatusState;
  onDismissError?: () => void;
}

const stageConfig: Record<AiRequestStage, { label: string; color: string; icon: typeof Loader2 }> = {
  idle:      { label: 'Ready',              color: 'text-muted-foreground', icon: CheckCircle2 },
  sending:   { label: 'Sending request...', color: 'text-primary',          icon: Send },
  connected: { label: 'Connected to server',color: 'text-success',          icon: Server },
  receiving: { label: 'Receiving response', color: 'text-primary',          icon: Loader2 },
  done:      { label: 'Done',               color: 'text-success',          icon: CheckCircle2 },
  retrying:  { label: 'Auto-retrying...',   color: 'text-warning',          icon: RefreshCw },
  error:     { label: 'AI NOT RESPONDING',  color: 'text-destructive',      icon: AlertCircle },
};

function formatMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function AiStatusPanel({ status, onDismissError }: AiStatusPanelProps) {
  const { stage, model, elapsedMs, responseMs, tokens, errorCode, errorMessage, retryCount } = status;
  const config = stageConfig[stage];
  const Icon = config.icon;

  const isActive = stage !== 'idle';
  const isError = stage === 'error';
  const isSpinning = stage === 'receiving' || stage === 'sending' || stage === 'retrying';
  const isDone = stage === 'done';

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="ai-status-panel"
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'mx-4 md:mx-6 mb-3 rounded-xl border text-xs font-mono overflow-hidden',
          isError && 'border-destructive/40 bg-destructive/5',
          !isError && isDone && 'border-green-500/30 bg-green-500/5',
          !isError && !isDone && 'border-primary/25 bg-primary/5'
        )}
      >
        {/* Top bar */}
        <div className={cn(
          'flex items-center justify-between px-4 py-2.5 border-b',
          isError && 'border-destructive/20',
          !isError && 'border-border/30'
        )}>
          <div className="flex items-center gap-2">
            {/* Animated icon */}
            <motion.div
              animate={isSpinning ? { rotate: 360 } : {}}
              transition={isSpinning ? { duration: 1.2, repeat: Infinity, ease: 'linear' } : {}}
            >
              <Icon className={cn('h-3.5 w-3.5', config.color)} />
            </motion.div>

            <span className={cn('font-semibold tracking-wide', config.color)}>
              {config.label}
              {retryCount ? ` (attempt ${retryCount + 1})` : ''}
            </span>

            {/* Pulsing dot for active stages */}
            {(stage === 'sending' || stage === 'connected' || stage === 'receiving' || stage === 'retrying') && (
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity }}
                className={cn(
                  'inline-block w-1.5 h-1.5 rounded-full',
                  stage === 'retrying' ? 'bg-warning' : 'bg-primary'
                )}
              />
            )}
          </div>

          <div className="flex items-center gap-3 text-muted-foreground">
            {/* Connection indicator */}
            <div className="flex items-center gap-1">
              <Wifi className="h-3 w-3 text-success" />
              <span className="text-success">Online</span>
            </div>

            {isError && onDismissError && (
              <button
                onClick={onDismissError}
                className="h-4 w-4 rounded-full flex items-center justify-center hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-border/30">
          {/* Model */}
          <div className="flex items-center gap-1.5 px-3 py-2">
            <Brain className="h-3 w-3 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Model</p>
              <p className="text-foreground font-medium truncate max-w-[90px]">
                {model ? model.split('/').pop() : '—'}
              </p>
            </div>
          </div>

          {/* Elapsed time */}
          <div className="flex items-center gap-1.5 px-3 py-2">
            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Elapsed</p>
              <p className="text-foreground font-medium">
                {elapsedMs != null ? formatMs(elapsedMs) : '—'}
              </p>
            </div>
          </div>

          {/* Response time / error code */}
          <div className="flex items-center gap-1.5 px-3 py-2">
            {isError ? (
              <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
            ) : (
              <Zap className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                {isError ? 'Error Code' : 'Response'}
              </p>
              <p className={cn('font-medium', isError ? 'text-destructive' : 'text-foreground')}>
                {isError
                  ? (errorCode ? String(errorCode) : 'TIMEOUT')
                  : (responseMs != null ? formatMs(responseMs) : '—')}
              </p>
            </div>
          </div>

          {/* Tokens */}
          <div className="flex items-center gap-1.5 px-3 py-2">
            <Zap className="h-3 w-3 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Tokens</p>
              <p className="text-foreground font-medium">
                {tokens != null && tokens > 0 ? tokens : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar for receiving */}
        {(stage === 'receiving' || stage === 'sending' || stage === 'retrying') && (
          <div className="h-0.5 bg-muted/50 overflow-hidden">
            <motion.div
              className={cn(
                'h-full rounded-full',
                stage === 'retrying'
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-primary to-orange-500'
              )}
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}

        {/* Error message */}
        {isError && errorMessage && (
          <div className="px-4 py-2 border-t border-destructive/20 bg-destructive/5">
            <p className="text-destructive font-medium">
              ⚠ {errorMessage}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[10px]">
              Request cancelled. Auto-retry {retryCount === 0 ? 'attempted' : 'failed'}. Please try again.
            </p>
          </div>
        )}

        {/* Done summary */}
        {isDone && responseMs != null && (
          <div className="px-4 py-1.5 border-t border-green-500/20 bg-green-500/5 flex items-center gap-2">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span className="text-green-600">Response received in {formatMs(responseMs)}</span>
            {tokens != null && tokens > 0 && (
              <span className="text-muted-foreground ml-auto">{tokens} tokens</span>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
