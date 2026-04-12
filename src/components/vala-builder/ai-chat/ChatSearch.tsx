import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Message } from './ChatMessage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ChatSearchProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onNavigateToMessage: (messageId: string) => void;
}

interface SearchResult {
  message: Message;
  matchStart: number;
  matchEnd: number;
  preview: string;
}

export function ChatSearch({ isOpen, onClose, messages, onNavigateToMessage }: ChatSearchProps) {
   const [query, setQuery] = useState('');
   const [selectedIndex, setSelectedIndex] = useState(0);
 
   // Search results
   const results = useMemo<SearchResult[]>(() => {
     if (!query.trim()) return [];
     
     const searchTerm = query.toLowerCase();
     const matches: SearchResult[] = [];
     
     messages.forEach((message) => {
       const content = message.content.toLowerCase();
       const matchIndex = content.indexOf(searchTerm);
       
       if (matchIndex !== -1) {
         // Get surrounding context
         const start = Math.max(0, matchIndex - 40);
         const end = Math.min(message.content.length, matchIndex + query.length + 40);
         let preview = message.content.slice(start, end);
         
         if (start > 0) preview = '...' + preview;
         if (end < message.content.length) preview = preview + '...';
         
         matches.push({
           message,
           matchStart: matchIndex - start + (start > 0 ? 3 : 0),
           matchEnd: matchIndex - start + query.length + (start > 0 ? 3 : 0),
           preview,
         });
       }
     });
     
     return matches;
   }, [query, messages]);
 
   // Keyboard navigation
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if (!isOpen) return;
       
       if (e.key === 'ArrowDown') {
         e.preventDefault();
         setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
       } else if (e.key === 'ArrowUp') {
         e.preventDefault();
         setSelectedIndex(prev => Math.max(prev - 1, 0));
       } else if (e.key === 'Enter' && results[selectedIndex]) {
         e.preventDefault();
         onNavigateToMessage(results[selectedIndex].message.id);
         onClose();
       } else if (e.key === 'Escape') {
         onClose();
       }
     };
 
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, [isOpen, results, selectedIndex, onNavigateToMessage, onClose]);
 
   // Reset on open
   useEffect(() => {
     if (isOpen) {
       setQuery('');
       setSelectedIndex(0);
     }
   }, [isOpen]);
 
   const highlightMatch = (text: string, start: number, length: number) => {
     const before = text.slice(0, start);
     const match = text.slice(start, start + length);
     const after = text.slice(start + length);
     
     return (
       <>
         {before}
         <span className="bg-primary/30 text-primary font-medium rounded px-0.5">{match}</span>
         {after}
       </>
     );
   };
 
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl p-0 gap-0">
        <DialogHeader className="p-4 pb-0 sr-only">
          <DialogTitle>Search Chat</DialogTitle>
        </DialogHeader>
        
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search messages..."
            className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0 h-auto text-base"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Type to search through your conversation</p>
              <p className="text-xs mt-1 opacity-70">Use ↑↓ to navigate, Enter to select</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No messages found for "{query}"</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-2 py-1 text-xs text-muted-foreground">
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </div>
              
              {results.map((result, index) => (
                <motion.button
                  key={result.message.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => {
                    onNavigateToMessage(result.message.id);
                    onClose();
                  }}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-colors",
                    index === selectedIndex
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge 
                      variant={result.message.role === 'user' ? 'secondary' : 'default'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {result.message.role === 'user' ? 'You' : 'AI'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {result.message.timestamp.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 line-clamp-2">
                    {highlightMatch(result.preview, result.matchStart, query.length)}
                  </p>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="flex items-center justify-between p-3 border-t border-border bg-muted/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">↓</kbd>
              <span>to navigate</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Enter</kbd>
              <span>to select</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}