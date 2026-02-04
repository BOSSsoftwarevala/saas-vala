import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Mic, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, isLoading, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isLoading || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    'Help me manage my products',
    'Generate license keys',
    'Check server status',
    'Explain my analytics'
  ];

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-sm">
      {/* Quick Suggestions */}
      {!input && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setInput(suggestion)}
              className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4">
        <div className="relative flex items-end gap-2 bg-muted/50 rounded-2xl border border-border p-2 focus-within:border-primary/50 transition-colors">
          {/* Attachment Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* Text Input */}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message SaaS VALA AI..."
            disabled={isLoading || disabled}
            className={cn(
              'flex-1 min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent px-2 py-2',
              'text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0'
            )}
            rows={1}
          />

          {/* Voice Input */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Mic className="h-4 w-4" />
          </Button>

          {/* Send Button */}
          <Button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading || disabled}
            className={cn(
              'h-9 w-9 shrink-0 rounded-xl transition-all duration-200',
              input.trim() 
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-2">
          <Sparkles className="h-3 w-3 text-primary" />
          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
          </p>
        </div>
      </div>
    </div>
  );
}
