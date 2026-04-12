 import { useState } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { Button } from '@/components/ui/button';
 import { 
  Heart, ThumbsUp, Lightbulb, Rocket, 
  Pin, PinOff, Star, Zap,
   MoreHorizontal
 } from 'lucide-react';
 import {
   Popover,
   PopoverContent,
   PopoverTrigger,
 } from '@/components/ui/popover';
 import { cn } from '@/lib/utils';
 import { toast } from 'sonner';
 
 interface Reaction {
   emoji: string;
   icon: typeof Heart;
   label: string;
   color: string;
 }
 
 interface MessageReactionsProps {
   messageId: string;
   isPinned?: boolean;
   onPin?: (messageId: string) => void;
   onUnpin?: (messageId: string) => void;
 }
 
 const reactions: Reaction[] = [
   { emoji: '👍', icon: ThumbsUp, label: 'Like', color: 'text-success' },
   { emoji: '❤️', icon: Heart, label: 'Love', color: 'text-destructive' },
   { emoji: '💡', icon: Lightbulb, label: 'Insightful', color: 'text-yellow-500' },
   { emoji: '🚀', icon: Rocket, label: 'Helpful', color: 'text-primary' },
   { emoji: '⭐', icon: Star, label: 'Excellent', color: 'text-orange-500' },
   { emoji: '⚡', icon: Zap, label: 'Quick', color: 'text-cyan-500' },
 ];
 
 export function MessageReactions({ messageId, isPinned, onPin, onUnpin }: MessageReactionsProps) {
   const [selectedReactions, setSelectedReactions] = useState<string[]>([]);
   const [showPicker, setShowPicker] = useState(false);
 
   const toggleReaction = (emoji: string) => {
     setSelectedReactions(prev => 
       prev.includes(emoji) 
         ? prev.filter(e => e !== emoji)
         : [...prev, emoji]
     );
   };
 
   const handlePin = () => {
     if (isPinned) {
       onUnpin?.(messageId);
       toast.success('Message unpinned');
     } else {
       onPin?.(messageId);
       toast.success('Message pinned');
     }
   };
 
   return (
     <div className="flex items-center gap-1">
       {/* Selected Reactions Display */}
       <AnimatePresence>
         {selectedReactions.length > 0 && (
           <motion.div
             initial={{ opacity: 0, scale: 0.8 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.8 }}
             className="flex items-center gap-0.5 mr-1"
           >
             {selectedReactions.map((emoji) => (
               <motion.button
                 key={emoji}
                 initial={{ scale: 0 }}
                 animate={{ scale: 1 }}
                 exit={{ scale: 0 }}
                 whileHover={{ scale: 1.2 }}
                 onClick={() => toggleReaction(emoji)}
                 className="text-base hover:bg-muted/50 rounded-full p-1 transition-colors"
               >
                 {emoji}
               </motion.button>
             ))}
           </motion.div>
         )}
       </AnimatePresence>
 
       {/* Reaction Picker */}
       <Popover open={showPicker} onOpenChange={setShowPicker}>
         <PopoverTrigger asChild>
           <Button
             variant="ghost"
             size="sm"
             className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full"
           >
             <MoreHorizontal className="h-4 w-4" />
           </Button>
         </PopoverTrigger>
         <PopoverContent 
           className="w-auto p-2" 
           align="start"
           side="top"
         >
           <div className="flex flex-col gap-2">
             {/* Emoji Reactions */}
             <div className="flex items-center gap-1">
               {reactions.map((reaction) => (
                 <motion.button
                   key={reaction.emoji}
                   whileHover={{ scale: 1.2, y: -2 }}
                   whileTap={{ scale: 0.9 }}
                   onClick={() => {
                     toggleReaction(reaction.emoji);
                     setShowPicker(false);
                   }}
                   className={cn(
                     "p-2 rounded-lg hover:bg-muted transition-colors",
                     selectedReactions.includes(reaction.emoji) && "bg-primary/10"
                   )}
                   title={reaction.label}
                 >
                   <span className="text-lg">{reaction.emoji}</span>
                 </motion.button>
               ))}
             </div>
             
             {/* Pin Action */}
             <div className="border-t border-border pt-2">
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={() => {
                   handlePin();
                   setShowPicker(false);
                 }}
                 className={cn(
                   "w-full justify-start gap-2 h-8",
                   isPinned && "text-primary"
                 )}
               >
                 {isPinned ? (
                   <>
                     <PinOff className="h-4 w-4" />
                     Unpin message
                   </>
                 ) : (
                   <>
                     <Pin className="h-4 w-4" />
                     Pin message
                   </>
                 )}
               </Button>
             </div>
           </div>
         </PopoverContent>
       </Popover>
 
       {/* Pin indicator */}
       {isPinned && (
         <motion.div
           initial={{ opacity: 0, scale: 0 }}
           animate={{ opacity: 1, scale: 1 }}
           className="ml-1"
         >
           <Pin className="h-3.5 w-3.5 text-primary fill-primary" />
         </motion.div>
       )}
     </div>
   );
 }