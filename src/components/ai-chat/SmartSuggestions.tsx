import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, Shield, Upload, Server, Code, Wrench, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Suggestion {
  id: string;
  text: string;
  icon: typeof Sparkles;
  category: 'quick' | 'recommended' | 'popular';
  priority: number;
}

interface SmartSuggestionsProps {
  lastMessage?: string;
  isLoading: boolean;
  onSelect: (suggestion: string) => void;
  hasFiles?: boolean;
}

const allSuggestions: Suggestion[] = [
  // After file upload
  { id: 'analyze', text: 'Analyze this code for issues', icon: Code, category: 'recommended', priority: 1 },
  { id: 'security', text: 'Run security scan', icon: Shield, category: 'recommended', priority: 2 },
  { id: 'deploy', text: 'Deploy to my server', icon: Server, category: 'recommended', priority: 3 },
  { id: 'fix', text: 'Auto-fix all problems', icon: Wrench, category: 'recommended', priority: 4 },

  // General
  { id: 'upload', text: 'Upload source code', icon: Upload, category: 'quick', priority: 1 },
  { id: 'payment', text: 'Add payment integration', icon: Zap, category: 'popular', priority: 1 },
  { id: 'optimize', text: 'Optimize performance', icon: Sparkles, category: 'popular', priority: 2 },
  { id: 'database', text: 'Setup database connection', icon: Server, category: 'popular', priority: 3 },
];

const contextualSuggestions: Record<string, string[]> = {
  upload: ['analyze', 'security', 'deploy'],
  error: ['fix', 'analyze', 'security'],
  deploy: ['security', 'database', 'optimize'],
  security: ['fix', 'deploy', 'analyze'],
  php: ['analyze', 'security', 'database'],
  react: ['analyze', 'optimize', 'deploy'],
  database: ['security', 'optimize', 'deploy'],
};

function getRelevantSuggestions(lastMessage: string | undefined, hasFiles: boolean): Suggestion[] {
  if (!lastMessage && !hasFiles) {
    return allSuggestions.filter((s) => s.category === 'quick').slice(0, 4);
  }

  if (hasFiles) {
    return allSuggestions.filter((s) => ['analyze', 'security', 'deploy', 'fix'].includes(s.id));
  }

  const lowerMessage = lastMessage?.toLowerCase() || '';

  for (const [keyword, suggestionIds] of Object.entries(contextualSuggestions)) {
    if (lowerMessage.includes(keyword)) {
      return allSuggestions
        .filter((s) => suggestionIds.includes(s.id))
        .sort((a, b) => a.priority - b.priority);
    }
  }

  return allSuggestions.filter((s) => s.category === 'popular').slice(0, 4);
}

export function SmartSuggestions({ lastMessage, isLoading, onSelect, hasFiles }: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [visible, setVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      const relevant = getRelevantSuggestions(lastMessage, hasFiles || false);
      setSuggestions(relevant);
      setVisible(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [lastMessage, isLoading, hasFiles]);

  if (!visible || suggestions.length === 0) return null;

  return (
    <div className="border-t border-border/50 bg-muted/10">
      {/* Collapsed header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Suggested next steps</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
            {suggestions.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Expandable suggestions */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 flex flex-wrap gap-1.5">
              {suggestions.map((suggestion, index) => (
                <motion.button
                  key={suggestion.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onSelect(suggestion.text);
                    setIsExpanded(false);
                  }}
                  className={cn(
                    'group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
                    'bg-card/50 hover:bg-primary/10 border border-border hover:border-primary/30',
                    'text-xs text-foreground/80 hover:text-primary',
                    'transition-all duration-200',
                  )}
                >
                  <suggestion.icon className="h-3 w-3 text-primary" />
                  <span>{suggestion.text}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
