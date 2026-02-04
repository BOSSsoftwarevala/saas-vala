import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Image, Sparkles } from 'lucide-react';
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

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (!input.trim() || isLoading || disabled) return;
    onSend(input.trim());
    setInput('');
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickSuggestions = [
    'Upload source code',
    'Analyze my project',
    'Deploy to server',
    'Add payment addon'
  ];

  return (
    <div className="border-t border-border bg-background">
      {/* Quick Suggestions */}
      {!input && (
        <div className="px-4 pt-3 flex flex-wrap gap-2 max-w-3xl mx-auto">
          {quickSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setInput(suggestion)}
              className="text-xs px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-all"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2 bg-muted/30 rounded-2xl border border-border p-2 focus-within:border-primary/50 focus-within:bg-muted/50 transition-all">
          {/* Attachment Buttons */}
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground rounded-xl"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground rounded-xl"
            >
              <Image className="h-5 w-5" />
            </Button>
          </div>

          {/* Text Input */}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message SaaS VALA AI..."
            disabled={isLoading || disabled}
            className={cn(
              'flex-1 min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent px-2 py-2.5',
              'text-base placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0'
            )}
            rows={1}
          />

          {/* Send Button */}
          <Button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading || disabled}
            size="icon"
            className={cn(
              'h-10 w-10 shrink-0 rounded-xl transition-all duration-200',
              input.trim() 
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25' 
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isLoading ? (
              <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <Sparkles className="h-3 w-3 text-primary" />
          <p className="text-xs text-muted-foreground">
            SaaS VALA AI may produce inaccurate information. <span className="text-primary font-medium">Powered by SoftwareVala™</span>
          </p>
        </div>
      </div>
    </div>
  );
}
