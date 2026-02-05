 import { useState, useEffect } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { 
   Loader2, 
   CheckCircle2, 
   Package, 
   Zap,
   X,
   Minimize2,
   Maximize2
 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Progress } from '@/components/ui/progress';
 
 export interface GlobalActivity {
   id: string;
   type: 'seo' | 'deploy' | 'analyze' | 'ai';
   title: string;
   status: 'pending' | 'processing' | 'completed' | 'failed';
   progress: number;
   details?: string;
   startedAt: Date;
 }
 
 // Global state for activities (simple pub/sub pattern)
 let globalActivities: GlobalActivity[] = [];
 let listeners: Set<() => void> = new Set();
 
 export const addGlobalActivity = (activity: Omit<GlobalActivity, 'startedAt'>) => {
   globalActivities = [...globalActivities, { ...activity, startedAt: new Date() }];
   listeners.forEach(fn => fn());
 };
 
 export const updateGlobalActivity = (id: string, updates: Partial<GlobalActivity>) => {
   globalActivities = globalActivities.map(a => 
     a.id === id ? { ...a, ...updates } : a
   );
   listeners.forEach(fn => fn());
 };
 
 export const removeGlobalActivity = (id: string) => {
   globalActivities = globalActivities.filter(a => a.id !== id);
   listeners.forEach(fn => fn());
 };
 
 export const clearCompletedActivities = () => {
   globalActivities = globalActivities.filter(a => a.status !== 'completed');
   listeners.forEach(fn => fn());
 };
 
 export function GlobalActivityPanel() {
   const [activities, setActivities] = useState<GlobalActivity[]>([]);
   const [isMinimized, setIsMinimized] = useState(false);
   const [isVisible, setIsVisible] = useState(true);
 
   useEffect(() => {
     const update = () => setActivities([...globalActivities]);
     listeners.add(update);
     update();
     return () => { listeners.delete(update); };
   }, []);
 
   const activeActivities = activities.filter(a => a.status !== 'completed' || 
     (new Date().getTime() - a.startedAt.getTime()) < 5000);
 
   if (activeActivities.length === 0 || !isVisible) return null;
 
   const processingCount = activeActivities.filter(a => a.status === 'processing').length;
   const completedCount = activeActivities.filter(a => a.status === 'completed').length;
   const currentActivity = activeActivities.find(a => a.status === 'processing');
 
   return (
     <AnimatePresence>
       <motion.div
         initial={{ opacity: 0, y: 100, scale: 0.9 }}
         animate={{ opacity: 1, y: 0, scale: 1 }}
         exit={{ opacity: 0, y: 100, scale: 0.9 }}
         className={cn(
           "fixed bottom-6 right-6 z-[100] bg-card/95 backdrop-blur-xl border border-primary/30 rounded-2xl shadow-2xl overflow-hidden",
           isMinimized ? "w-auto" : "w-80"
         )}
       >
         {/* Header */}
         <div className="p-3 bg-gradient-to-r from-primary/20 to-orange-500/20 border-b border-border/30">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
               <motion.div
                 animate={{ rotate: processingCount > 0 ? 360 : 0 }}
                 transition={{ duration: 2, repeat: processingCount > 0 ? Infinity : 0, ease: "linear" }}
               >
                 <Zap className="h-4 w-4 text-primary" />
               </motion.div>
               {!isMinimized && (
                 <span className="font-semibold text-sm">
                   {processingCount > 0 ? 'Working...' : 'Tasks Complete'}
                 </span>
               )}
               {isMinimized && processingCount > 0 && (
                 <Badge variant="default" className="text-xs animate-pulse">
                   {processingCount}
                 </Badge>
               )}
             </div>
             <div className="flex items-center gap-1">
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-6 w-6"
                 onClick={() => setIsMinimized(!isMinimized)}
               >
                 {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
               </Button>
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-6 w-6"
                 onClick={() => {
                   clearCompletedActivities();
                   if (processingCount === 0) setIsVisible(false);
                 }}
               >
                 <X className="h-3 w-3" />
               </Button>
             </div>
           </div>
         </div>
 
         {/* Content */}
         {!isMinimized && (
           <motion.div
             initial={{ height: 0, opacity: 0 }}
             animate={{ height: 'auto', opacity: 1 }}
             exit={{ height: 0, opacity: 0 }}
             className="p-3 space-y-2"
           >
             {/* Current Activity Progress */}
             {currentActivity && (
               <div className="space-y-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
                 <div className="flex items-center gap-2">
                   <motion.div
                     animate={{ rotate: 360 }}
                     transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                   >
                     <Loader2 className="h-4 w-4 text-primary" />
                   </motion.div>
                   <span className="text-sm font-medium text-primary truncate">
                     {currentActivity.title}
                   </span>
                 </div>
                 <Progress value={currentActivity.progress} className="h-1.5" />
                 {currentActivity.details && (
                   <p className="text-xs text-muted-foreground truncate">
                     {currentActivity.details}
                   </p>
                 )}
               </div>
             )}
 
             {/* Activity List */}
             <div className="space-y-1.5 max-h-40 overflow-y-auto">
               {activeActivities.slice(0, 5).map((activity) => (
                 <motion.div
                   key={activity.id}
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   className={cn(
                     "flex items-center gap-2 p-2 rounded-lg text-xs",
                     activity.status === 'completed' && "bg-green-500/10",
                     activity.status === 'processing' && "bg-primary/10",
                     activity.status === 'pending' && "bg-muted/30 opacity-60"
                   )}
                 >
                   {activity.status === 'completed' ? (
                     <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                   ) : activity.status === 'processing' ? (
                     <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                   ) : (
                     <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                   )}
                   <span className={cn(
                     "truncate flex-1",
                     activity.status === 'completed' && "text-green-500",
                     activity.status === 'processing' && "text-primary font-medium"
                   )}>
                     {activity.title}
                   </span>
                   {activity.status === 'completed' && (
                     <span className="text-green-500">✓</span>
                   )}
                 </motion.div>
               ))}
             </div>
 
             {/* Footer Stats */}
             <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border/30">
               <span>{completedCount}/{activeActivities.length} complete</span>
               <motion.span
                 animate={{ opacity: processingCount > 0 ? [0.5, 1, 0.5] : 1 }}
                 transition={{ duration: 1.5, repeat: processingCount > 0 ? Infinity : 0 }}
                 className="text-primary"
               >
                 {processingCount > 0 ? 'Processing...' : 'Done!'}
               </motion.span>
             </div>
           </motion.div>
         )}
       </motion.div>
     </AnimatePresence>
   );
 }