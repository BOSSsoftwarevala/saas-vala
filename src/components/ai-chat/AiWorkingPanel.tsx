import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Zap, Clock, CheckCircle2, Loader2, Terminal, Code2, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiWorkingPanelProps {
  isLoading: boolean;
  tokensReceived: number;
  elapsedTime: number;
  model?: string;
}

interface LogEntry {
  id: string;
  text: string;
  type: 'info' | 'success' | 'working' | 'token';
}

export function AiWorkingPanel({
  isLoading,
  tokensReceived,
  elapsedTime,
  model = 'gemini-3-flash',
}: AiWorkingPanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const addedLogsRef = useRef<Set<string>>(new Set());
  const timeoutRefs = useRef<number[]>([]);

  const aiSteps = [
    { text: 'Request received, initializing...', type: 'info' as const },
    { text: 'Loading context & memory...', type: 'info' as const },
    { text: 'Analyzing your prompt...', type: 'working' as const },
    { text: 'Connecting to AI provider...', type: 'working' as const },
    { text: 'Model processing input tokens...', type: 'working' as const },
    { text: 'Generating intelligent response...', type: 'working' as const },
    { text: 'Streaming output tokens...', type: 'working' as const },
  ];

  const addLog = (text: string, type: LogEntry['type']) => {
    if (addedLogsRef.current.has(text)) return;
    addedLogsRef.current.add(text);
    setLogs(prev => [...prev.slice(-20), { id: `${text}-${Date.now()}`, text, type }]);
  };

  useEffect(() => {
    if (isLoading) {
      setShowPanel(true);
      addedLogsRef.current.clear();
      setLogs([]);
      // Clear previous timeouts
      timeoutRefs.current.forEach(t => clearTimeout(t));
      timeoutRefs.current = [];

      aiSteps.forEach((step, i) => {
        const t = window.setTimeout(() => {
          addLog(step.text, step.type);
        }, i * 900);
        timeoutRefs.current.push(t);
      });
    } else {
      if (showPanel) {
        addLog('✓ Response generated successfully', 'success');
        const t = window.setTimeout(() => setShowPanel(false), 4000);
        timeoutRefs.current.push(t);
      }
    }
    return () => {
      timeoutRefs.current.forEach(t => clearTimeout(t));
    };
  }, [isLoading]);

  useEffect(() => {
    if (tokensReceived > 0 && tokensReceived % 50 === 0) {
      addLog(`⚡ ${tokensReceived} tokens received`, 'token');
    }
  }, [Math.floor(tokensReceived / 50)]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <AnimatePresence>
      {showPanel && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 260, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="h-full border-l border-border bg-background flex flex-col overflow-hidden shrink-0"
          style={{ minWidth: 0 }}
        >
          {/* Header */}
          <div className="h-12 border-b border-border flex items-center gap-2 px-3 shrink-0 bg-muted/30">
            <div className="relative">
              <Cpu className="h-4 w-4 text-primary" />
              {isLoading && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </div>
            <span className="text-xs font-semibold text-foreground">AI Working</span>
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="ml-auto"
              >
                <Loader2 className="h-3.5 w-3.5 text-primary" />
              </motion.div>
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-auto" />
            )}
          </div>

          {/* Stats */}
          <div className="px-3 py-2 border-b border-border/50 shrink-0 bg-muted/10">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Tokens</span>
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-primary" />
                  <span className="text-sm font-bold text-foreground tabular-nums">{tokensReceived}</span>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Time</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-bold text-foreground tabular-nums">{elapsedTime.toFixed(1)}s</span>
                </div>
              </div>
            </div>

            {isLoading && (
              <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            )}
          </div>

          {/* Model info */}
          <div className="px-3 py-1.5 border-b border-border/50 shrink-0 flex items-center gap-1.5">
            <Brain className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground truncate">
              Model: <span className="text-foreground font-medium">{model}</span>
            </span>
          </div>

          {/* Activity Log */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 font-mono">
            <div className="flex items-center gap-1.5 mb-2">
              <Terminal className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Activity Log</span>
            </div>

            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'flex items-start gap-1.5 text-[10px] leading-relaxed',
                  log.type === 'success' && 'text-green-500',
                  log.type === 'working' && 'text-primary',
                  log.type === 'token' && 'text-orange-400',
                  log.type === 'info' && 'text-muted-foreground',
                )}
              >
                <span className="mt-0.5 shrink-0">
                  {log.type === 'success' ? '✓' : log.type === 'token' ? '⚡' : '›'}
                </span>
                <span>{log.text}</span>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="flex items-center gap-1.5 text-[10px] text-primary"
              >
                <span>›</span>
                <span>Processing</span>
                <span className="inline-flex gap-0.5 ml-1">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 1, delay: i * 0.3, repeat: Infinity }}
                      className="w-1 h-1 rounded-full bg-primary inline-block"
                    />
                  ))}
                </span>
              </motion.div>
            )}

            <div ref={logsEndRef} />
          </div>

          {/* Footer */}
          <div className="shrink-0 px-3 py-2 border-t border-border bg-muted/20">
            <div className="flex items-center gap-1.5">
              <Code2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {isLoading ? 'VALA AI is thinking...' : 'Response complete'}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
