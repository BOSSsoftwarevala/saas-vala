 import { useState, useEffect } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { 
   Loader2, 
   CheckCircle2, 
   Package, 
   Search, 
   Shield, 
   Sparkles,
   Globe,
   TrendingUp,
   Zap
 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import { Badge } from '@/components/ui/badge';
 import { Progress } from '@/components/ui/progress';
 
 export interface SeoActivityItem {
   id: string;
   type: 'product' | 'keyword' | 'security' | 'competitor' | 'voice';
   name: string;
   status: 'pending' | 'processing' | 'completed' | 'failed';
   progress?: number;
   details?: string;
 }
 
 interface LiveSeoActivityPanelProps {
   isActive: boolean;
   activities: SeoActivityItem[];
   currentStep: string;
   overallProgress: number;
   market: 'india' | 'africa';
 }
 
 const getIcon = (type: SeoActivityItem['type']) => {
   switch (type) {
     case 'product': return Package;
     case 'keyword': return Search;
     case 'security': return Shield;
     case 'competitor': return TrendingUp;
     case 'voice': return Globe;
     default: return Sparkles;
   }
 };
 
 export function LiveSeoActivityPanel({
   isActive,
   activities,
   currentStep,
   overallProgress,
   market
 }: LiveSeoActivityPanelProps) {
   const [animatedProgress, setAnimatedProgress] = useState(0);
 
   useEffect(() => {
     const timer = setTimeout(() => {
       setAnimatedProgress(overallProgress);
     }, 100);
     return () => clearTimeout(timer);
   }, [overallProgress]);
 
   if (!isActive) return null;
 
   const completedCount = activities.filter(a => a.status === 'completed').length;
   const processingActivity = activities.find(a => a.status === 'processing');
 
   return (
     <motion.div
       initial={{ opacity: 0, y: 20, scale: 0.95 }}
       animate={{ opacity: 1, y: 0, scale: 1 }}
       exit={{ opacity: 0, y: -20, scale: 0.95 }}
       className="fixed bottom-24 right-6 w-80 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden z-50"
     >
       {/* Header */}
       <div className="p-4 bg-gradient-to-r from-primary/20 to-orange-500/20 border-b border-border/30">
         <div className="flex items-center justify-between mb-2">
           <div className="flex items-center gap-2">
             <motion.div
               animate={{ rotate: 360 }}
               transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
             >
               <Zap className="h-5 w-5 text-primary" />
             </motion.div>
             <span className="font-semibold text-sm">SEO Engine Active</span>
           </div>
           <Badge variant="outline" className="text-xs">
             {market === 'india' ? '🇮🇳' : '🌍'} {market.toUpperCase()}
           </Badge>
         </div>
         
         {/* Overall Progress */}
         <div className="space-y-1">
           <div className="flex justify-between text-xs text-muted-foreground">
             <span>{currentStep}</span>
             <span>{Math.round(animatedProgress)}%</span>
           </div>
           <Progress value={animatedProgress} className="h-2" />
         </div>
       </div>
 
       {/* Activity List */}
       <div className="max-h-64 overflow-y-auto p-3 space-y-2">
         <AnimatePresence mode="popLayout">
           {activities.slice(-6).map((activity, index) => {
             const Icon = getIcon(activity.type);
             return (
               <motion.div
                 key={activity.id}
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: 20 }}
                 transition={{ delay: index * 0.05 }}
                 className={cn(
                   "flex items-center gap-3 p-2.5 rounded-lg transition-all duration-300",
                   activity.status === 'processing' && "bg-primary/10 border border-primary/20",
                   activity.status === 'completed' && "bg-green-500/10",
                   activity.status === 'pending' && "bg-muted/30 opacity-50",
                   activity.status === 'failed' && "bg-red-500/10"
                 )}
               >
                 {/* Status Icon */}
                 <div className={cn(
                   "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                   activity.status === 'completed' && "bg-green-500/20",
                   activity.status === 'processing' && "bg-primary/20",
                   activity.status === 'pending' && "bg-muted",
                   activity.status === 'failed' && "bg-red-500/20"
                 )}>
                   {activity.status === 'completed' ? (
                     <motion.div
                       initial={{ scale: 0 }}
                       animate={{ scale: 1 }}
                       transition={{ type: "spring", stiffness: 500 }}
                     >
                       <CheckCircle2 className="h-4 w-4 text-green-500" />
                     </motion.div>
                   ) : activity.status === 'processing' ? (
                     <motion.div
                       animate={{ rotate: 360 }}
                       transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                     >
                       <Loader2 className="h-4 w-4 text-primary" />
                     </motion.div>
                   ) : (
                     <Icon className="h-4 w-4 text-muted-foreground" />
                   )}
                 </div>
 
                 {/* Content */}
                 <div className="flex-1 min-w-0">
                   <p className={cn(
                     "text-sm font-medium truncate",
                     activity.status === 'completed' && "text-green-500",
                     activity.status === 'processing' && "text-primary",
                     activity.status === 'failed' && "text-red-500"
                   )}>
                     {activity.name}
                   </p>
                   {activity.details && (
                     <p className="text-xs text-muted-foreground truncate">
                       {activity.details}
                     </p>
                   )}
                 </div>
 
                 {/* Progress for processing items */}
                 {activity.status === 'processing' && activity.progress !== undefined && (
                   <div className="w-12">
                     <Progress value={activity.progress} className="h-1" />
                   </div>
                 )}
               </motion.div>
             );
           })}
         </AnimatePresence>
       </div>
 
       {/* Footer Stats */}
       <div className="p-3 border-t border-border/30 bg-muted/20">
         <div className="flex items-center justify-between text-xs">
           <span className="text-muted-foreground">
             {completedCount}/{activities.length} completed
           </span>
           {processingActivity && (
             <motion.span
               animate={{ opacity: [0.5, 1, 0.5] }}
               transition={{ duration: 1.5, repeat: Infinity }}
               className="text-primary font-medium"
             >
               Processing...
             </motion.span>
           )}
         </div>
       </div>
     </motion.div>
   );
 }