 import { useState, useEffect } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { Sparkles, Zap, Shield, Upload, Server, Code, Wrench, ArrowRight } from 'lucide-react';
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
   'upload': ['analyze', 'security', 'deploy'],
   'error': ['fix', 'analyze', 'security'],
   'deploy': ['security', 'database', 'optimize'],
   'security': ['fix', 'deploy', 'analyze'],
   'php': ['analyze', 'security', 'database'],
   'react': ['analyze', 'optimize', 'deploy'],
   'database': ['security', 'optimize', 'deploy'],
 };
 
 function getRelevantSuggestions(lastMessage: string | undefined, hasFiles: boolean): Suggestion[] {
   if (!lastMessage && !hasFiles) {
     return allSuggestions.filter(s => s.category === 'quick').slice(0, 4);
   }
 
   if (hasFiles) {
     return allSuggestions.filter(s => ['analyze', 'security', 'deploy', 'fix'].includes(s.id));
   }
 
   const lowerMessage = lastMessage?.toLowerCase() || '';
   
   for (const [keyword, suggestionIds] of Object.entries(contextualSuggestions)) {
     if (lowerMessage.includes(keyword)) {
       return allSuggestions
         .filter(s => suggestionIds.includes(s.id))
         .sort((a, b) => a.priority - b.priority);
     }
   }
 
   return allSuggestions.filter(s => s.category === 'popular').slice(0, 4);
 }
 
 export function SmartSuggestions({ lastMessage, isLoading, onSelect, hasFiles }: SmartSuggestionsProps) {
   const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
   const [visible, setVisible] = useState(true);
 
   useEffect(() => {
     if (isLoading) {
       setVisible(false);
       return;
     }
 
     // Delay showing suggestions after response
     const timer = setTimeout(() => {
       const relevant = getRelevantSuggestions(lastMessage, hasFiles || false);
       setSuggestions(relevant);
       setVisible(true);
     }, 500);
 
     return () => clearTimeout(timer);
   }, [lastMessage, isLoading, hasFiles]);
 
   if (!visible || suggestions.length === 0) return null;
 
   return (
     <AnimatePresence>
       <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         exit={{ opacity: 0, y: 10 }}
         className="px-4 py-3 border-t border-border/50 bg-gradient-to-t from-muted/20 to-transparent"
       >
         <div className="max-w-3xl mx-auto">
           <div className="flex items-center gap-2 mb-3">
             <Sparkles className="h-4 w-4 text-primary" />
             <span className="text-xs font-medium text-muted-foreground">
               Suggested next steps
             </span>
           </div>
           
           <div className="flex flex-wrap gap-2">
             {suggestions.map((suggestion, index) => (
               <motion.button
                 key={suggestion.id}
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 transition={{ delay: index * 0.05 }}
                 whileHover={{ scale: 1.02, x: 2 }}
                 whileTap={{ scale: 0.98 }}
                 onClick={() => onSelect(suggestion.text)}
                 className={cn(
                   "group flex items-center gap-2 px-3 py-2 rounded-xl",
                   "bg-card/50 hover:bg-primary/10 border border-border hover:border-primary/30",
                   "text-sm text-foreground/80 hover:text-primary",
                   "transition-all duration-200"
                 )}
               >
                 <div className="h-6 w-6 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                   <suggestion.icon className="h-3.5 w-3.5 text-primary" />
                 </div>
                 <span>{suggestion.text}</span>
                 <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 -ml-1 group-hover:ml-0 transition-all" />
               </motion.button>
             ))}
           </div>
         </div>
       </motion.div>
     </AnimatePresence>
   );
 }