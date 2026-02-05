 import { useState } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { History, RotateCcw, Clock, MessageSquare, ChevronRight, X, AlertTriangle } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { cn } from '@/lib/utils';
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
 } from '@/components/ui/alert-dialog';
 import { toast } from 'sonner';
 
 interface HistoryEntry {
   id: string;
   messageIndex: number;
   content: string;
   timestamp: Date;
   role: 'user' | 'assistant';
 }
 
 interface ChatHistoryPanelProps {
   isOpen: boolean;
   onClose: () => void;
   messages: Array<{
     id: string;
     role: 'user' | 'assistant';
     content: string;
     timestamp: Date;
   }>;
   onRestore: (messageIndex: number) => void;
 }
 
 export function ChatHistoryPanel({ isOpen, onClose, messages, onRestore }: ChatHistoryPanelProps) {
   const [selectedEntry, setSelectedEntry] = useState<number | null>(null);
   const [confirmRestore, setConfirmRestore] = useState<number | null>(null);
 
   const historyEntries: HistoryEntry[] = messages.map((msg, index) => ({
     id: msg.id,
     messageIndex: index,
     content: msg.content.slice(0, 100) + (msg.content.length > 100 ? '...' : ''),
     timestamp: msg.timestamp,
     role: msg.role,
   }));
 
   const handleRestore = (index: number) => {
     onRestore(index);
     setConfirmRestore(null);
     toast.success('Chat restored to selected point', {
       description: 'Messages after this point have been removed'
     });
     onClose();
   };
 
   const formatTime = (date: Date) => {
     const now = new Date();
     const diff = now.getTime() - date.getTime();
     const minutes = Math.floor(diff / 60000);
     const hours = Math.floor(diff / 3600000);
     
     if (minutes < 1) return 'Just now';
     if (minutes < 60) return `${minutes}m ago`;
     if (hours < 24) return `${hours}h ago`;
     return date.toLocaleDateString();
   };
 
   return (
     <>
       <AnimatePresence>
         {isOpen && (
           <>
             {/* Backdrop */}
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={onClose}
               className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
             />
             
             {/* Panel */}
             <motion.div
               initial={{ x: '100%' }}
               animate={{ x: 0 }}
               exit={{ x: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border shadow-2xl z-50 flex flex-col"
             >
               {/* Header */}
               <div className="p-4 border-b border-border flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                     <History className="h-5 w-5 text-primary" />
                   </div>
                   <div>
                     <h2 className="font-semibold text-foreground">Chat History</h2>
                     <p className="text-xs text-muted-foreground">Restore to any previous state</p>
                   </div>
                 </div>
                 <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
                   <X className="h-5 w-5" />
                 </Button>
               </div>
 
               {/* History List */}
               <ScrollArea className="flex-1">
                 <div className="p-4 space-y-2">
                   {historyEntries.length === 0 ? (
                     <div className="text-center py-12">
                       <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                       <p className="text-muted-foreground">No messages yet</p>
                       <p className="text-xs text-muted-foreground/60 mt-1">Start a conversation to see history</p>
                     </div>
                   ) : (
                     historyEntries.map((entry, index) => (
                       <motion.div
                         key={entry.id}
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: index * 0.03 }}
                         onClick={() => setSelectedEntry(selectedEntry === index ? null : index)}
                         className={cn(
                           "group p-3 rounded-xl border cursor-pointer transition-all duration-200",
                           selectedEntry === index
                             ? "bg-primary/5 border-primary/30"
                             : "bg-muted/30 border-border hover:bg-muted/50 hover:border-primary/20"
                         )}
                       >
                         <div className="flex items-start gap-3">
                           {/* Index Badge */}
                           <div className={cn(
                             "h-7 w-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0",
                             entry.role === 'user' 
                               ? "bg-secondary/10 text-secondary" 
                               : "bg-primary/10 text-primary"
                           )}>
                             {index + 1}
                           </div>
 
                           {/* Content */}
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 mb-1">
                               <span className={cn(
                                 "text-xs font-medium",
                                 entry.role === 'user' ? "text-secondary" : "text-primary"
                               )}>
                                 {entry.role === 'user' ? 'You' : 'AI'}
                               </span>
                               <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                 <Clock className="h-3 w-3" />
                                 {formatTime(entry.timestamp)}
                               </span>
                             </div>
                             <p className="text-sm text-foreground/80 line-clamp-2">
                               {entry.content}
                             </p>
                           </div>
 
                           {/* Restore Button */}
                           <ChevronRight className={cn(
                             "h-4 w-4 text-muted-foreground transition-transform",
                             selectedEntry === index && "rotate-90"
                           )} />
                         </div>
 
                         {/* Expanded Actions */}
                         <AnimatePresence>
                           {selectedEntry === index && (
                             <motion.div
                               initial={{ height: 0, opacity: 0 }}
                               animate={{ height: 'auto', opacity: 1 }}
                               exit={{ height: 0, opacity: 0 }}
                               className="overflow-hidden"
                             >
                               <div className="pt-3 mt-3 border-t border-border/50 flex gap-2">
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     setConfirmRestore(index);
                                   }}
                                   className="flex-1 gap-2 h-9"
                                 >
                                   <RotateCcw className="h-4 w-4" />
                                   Restore to here
                                 </Button>
                               </div>
                             </motion.div>
                           )}
                         </AnimatePresence>
                       </motion.div>
                     ))
                   )}
                 </div>
               </ScrollArea>
 
               {/* Footer */}
               <div className="p-4 border-t border-border bg-muted/20">
                 <p className="text-xs text-muted-foreground text-center">
                   <AlertTriangle className="h-3 w-3 inline mr-1" />
                   Restoring will remove all messages after the selected point
                 </p>
               </div>
             </motion.div>
           </>
         )}
       </AnimatePresence>
 
       {/* Confirm Dialog */}
       <AlertDialog open={confirmRestore !== null} onOpenChange={() => setConfirmRestore(null)}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Restore Chat History?</AlertDialogTitle>
             <AlertDialogDescription>
               This will restore the chat to message #{confirmRestore !== null ? confirmRestore + 1 : 0}. 
               All messages after this point will be removed. This action cannot be undone.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancel</AlertDialogCancel>
             <AlertDialogAction onClick={() => confirmRestore !== null && handleRestore(confirmRestore)}>
               Restore
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     </>
   );
 }