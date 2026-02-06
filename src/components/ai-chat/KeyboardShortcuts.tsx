import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts: Shortcut[] = [
  { keys: ['Ctrl', 'K'], description: 'Search in chat', category: 'Navigation' },
  { keys: ['Ctrl', 'N'], description: 'New chat', category: 'Navigation' },
  { keys: ['Ctrl', 'E'], description: 'Export chat', category: 'Actions' },
  { keys: ['Ctrl', 'H'], description: 'Show history', category: 'Navigation' },
  { keys: ['Ctrl', '/'], description: 'Show shortcuts', category: 'Help' },
  { keys: ['Ctrl', 'L'], description: 'Clear current chat', category: 'Actions' },
  { keys: ['Ctrl', 'B'], description: 'Toggle sidebar', category: 'Navigation' },
  { keys: ['Ctrl', 'T'], description: 'Open templates', category: 'Actions' },
  { keys: ['Escape'], description: 'Close dialogs', category: 'Navigation' },
  { keys: ['Enter'], description: 'Send message', category: 'Actions' },
  { keys: ['Shift', 'Enter'], description: 'New line in message', category: 'Actions' },
];

const categories = ['Navigation', 'Actions', 'Help'];

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
   return (
     <Dialog open={isOpen} onOpenChange={onClose}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Keyboard className="h-5 w-5 text-primary" />
             Keyboard Shortcuts
           </DialogTitle>
         </DialogHeader>
 
         <div className="space-y-6 py-2">
           {categories.map((category) => (
             <div key={category}>
               <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                 {category}
               </h4>
               <div className="space-y-2">
                 {shortcuts
                   .filter((s) => s.category === category)
                   .map((shortcut, index) => (
                     <motion.div
                       key={shortcut.description}
                       initial={{ opacity: 0, x: -10 }}
                       animate={{ opacity: 1, x: 0 }}
                       transition={{ delay: index * 0.03 }}
                       className="flex items-center justify-between py-1.5"
                     >
                       <span className="text-sm text-foreground/90">
                         {shortcut.description}
                       </span>
                       <div className="flex items-center gap-1">
                         {shortcut.keys.map((key, keyIndex) => (
                           <span key={keyIndex} className="flex items-center">
                             <kbd className="px-2 py-1 text-xs font-medium bg-muted rounded border border-border shadow-sm">
                               {key}
                             </kbd>
                             {keyIndex < shortcut.keys.length - 1 && (
                               <span className="mx-1 text-muted-foreground text-xs">+</span>
                             )}
                           </span>
                         ))}
                       </div>
                     </motion.div>
                   ))}
               </div>
             </div>
           ))}
         </div>
 
         <div className="pt-4 border-t border-border">
           <p className="text-xs text-muted-foreground text-center">
             Press <kbd className="px-1.5 py-0.5 text-[10px] bg-muted rounded mx-1">Ctrl</kbd> + 
            <kbd className="px-1.5 py-0.5 text-[10px] bg-muted rounded mx-1">/</kbd> anytime to view
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

 // Hook for global keyboard shortcuts
 export function useKeyboardShortcuts({
   onNewChat,
   onExport,
   onSearch,
   onHistory,
   onClear,
   onToggleSidebar,
   onShowShortcuts,
 }: {
   onNewChat: () => void;
   onExport: () => void;
   onSearch: () => void;
   onHistory: () => void;
   onClear: () => void;
   onToggleSidebar: () => void;
   onShowShortcuts: () => void;
 }) {
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       // Check for Ctrl/Cmd key
       const isModifier = e.ctrlKey || e.metaKey;
       
       if (!isModifier) return;
       
       switch (e.key.toLowerCase()) {
         case 'k':
           e.preventDefault();
           onSearch();
           break;
         case 'n':
           e.preventDefault();
           onNewChat();
           break;
         case 'e':
           e.preventDefault();
           onExport();
           break;
         case 'h':
           e.preventDefault();
           onHistory();
           break;
         case 'l':
           e.preventDefault();
           onClear();
           break;
         case 'b':
           e.preventDefault();
           onToggleSidebar();
           break;
         case '/':
           e.preventDefault();
           onShowShortcuts();
           break;
       }
     };
 
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, [onNewChat, onExport, onSearch, onHistory, onClear, onToggleSidebar, onShowShortcuts]);
 }