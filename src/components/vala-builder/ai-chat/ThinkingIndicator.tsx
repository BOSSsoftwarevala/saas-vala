 import { motion, AnimatePresence } from 'framer-motion';
 import { Brain, Code, Search, Shield, Wrench, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
 import { useState, useEffect } from 'react';
 import { cn } from '@/lib/utils';
 
 interface ThinkingStep {
   id: string;
   label: string;
   icon: typeof Brain;
   status: 'pending' | 'active' | 'completed';
 }
 
 interface ThinkingIndicatorProps {
   isActive: boolean;
   context?: 'analyzing' | 'fixing' | 'deploying' | 'general';
 }
 
 const getStepsForContext = (context: string): ThinkingStep[] => {
   const baseSteps: Record<string, ThinkingStep[]> = {
     analyzing: [
       { id: 'read', label: 'Reading your request', icon: Search, status: 'pending' },
       { id: 'analyze', label: 'Analyzing code structure', icon: Code, status: 'pending' },
       { id: 'security', label: 'Checking security issues', icon: Shield, status: 'pending' },
       { id: 'solution', label: 'Preparing solution', icon: Sparkles, status: 'pending' },
     ],
     fixing: [
       { id: 'identify', label: 'Identifying issues', icon: Search, status: 'pending' },
       { id: 'fix', label: 'Applying auto-fixes', icon: Wrench, status: 'pending' },
       { id: 'verify', label: 'Verifying changes', icon: CheckCircle2, status: 'pending' },
       { id: 'complete', label: 'Finalizing response', icon: Sparkles, status: 'pending' },
     ],
     deploying: [
       { id: 'prepare', label: 'Preparing deployment', icon: Code, status: 'pending' },
       { id: 'security', label: 'Security scan', icon: Shield, status: 'pending' },
       { id: 'deploy', label: 'Deploying to server', icon: Wrench, status: 'pending' },
       { id: 'verify', label: 'Verifying deployment', icon: CheckCircle2, status: 'pending' },
     ],
     general: [
       { id: 'think', label: 'Understanding request', icon: Brain, status: 'pending' },
       { id: 'process', label: 'Processing information', icon: Code, status: 'pending' },
       { id: 'generate', label: 'Generating response', icon: Sparkles, status: 'pending' },
     ],
   };
   return baseSteps[context] || baseSteps.general;
 };
 
 export function ThinkingIndicator({ isActive, context = 'general' }: ThinkingIndicatorProps) {
   const [steps, setSteps] = useState<ThinkingStep[]>(() => getStepsForContext(context));
   const [currentStepIndex, setCurrentStepIndex] = useState(0);
 
   useEffect(() => {
     if (!isActive) {
       setSteps(getStepsForContext(context));
       setCurrentStepIndex(0);
       return;
     }
 
     // Progress through steps
     const interval = setInterval(() => {
       setCurrentStepIndex(prev => {
         if (prev >= steps.length - 1) {
           return prev; // Stay on last step
         }
         return prev + 1;
       });
     }, 1500);
 
     return () => clearInterval(interval);
   }, [isActive, context, steps.length]);
 
   // Update step statuses based on current index
   useEffect(() => {
     setSteps(prev => prev.map((step, idx) => ({
       ...step,
       status: idx < currentStepIndex ? 'completed' : idx === currentStepIndex ? 'active' : 'pending'
     })));
   }, [currentStepIndex]);
 
   if (!isActive) return null;
 
   return (
     <motion.div
       initial={{ opacity: 0, y: 20 }}
       animate={{ opacity: 1, y: 0 }}
       exit={{ opacity: 0, y: -10 }}
       className="py-6 px-4 md:px-6 bg-muted/10"
     >
       <div className="max-w-3xl mx-auto">
         <div className="flex gap-4">
           {/* Avatar with pulse */}
           <motion.div
             animate={{ scale: [1, 1.05, 1] }}
             transition={{ duration: 2, repeat: Infinity }}
             className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-orange-500/20 flex items-center justify-center shrink-0 ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
           >
             <motion.div
               animate={{ rotate: 360 }}
               transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
             >
               <Brain className="h-4 w-4 text-primary" />
             </motion.div>
           </motion.div>
 
           <div className="flex-1 space-y-4">
             {/* Header */}
             <div className="flex items-center gap-2">
               <span className="text-sm font-semibold text-primary">SaaS VALA AI</span>
               <motion.span
                 animate={{ opacity: [0.5, 1, 0.5] }}
                 transition={{ duration: 1.5, repeat: Infinity }}
                 className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
               >
                 thinking...
               </motion.span>
             </div>
 
             {/* Steps */}
             <div className="space-y-2">
               <AnimatePresence mode="popLayout">
                 {steps.map((step, index) => (
                   <motion.div
                     key={step.id}
                     initial={{ opacity: 0, x: -20 }}
                     animate={{ 
                       opacity: step.status === 'pending' ? 0.4 : 1, 
                       x: 0 
                     }}
                     transition={{ delay: index * 0.1 }}
                     className={cn(
                       "flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-300",
                       step.status === 'active' && "bg-primary/5 border border-primary/20",
                       step.status === 'completed' && "bg-success/5"
                     )}
                   >
                     {/* Icon */}
                     <div className={cn(
                       "h-7 w-7 rounded-lg flex items-center justify-center transition-all",
                       step.status === 'completed' && "bg-success/10",
                       step.status === 'active' && "bg-primary/10",
                       step.status === 'pending' && "bg-muted/50"
                     )}>
                       {step.status === 'completed' ? (
                         <motion.div
                           initial={{ scale: 0 }}
                           animate={{ scale: 1 }}
                           transition={{ type: "spring", stiffness: 500 }}
                         >
                           <CheckCircle2 className="h-4 w-4 text-success" />
                         </motion.div>
                       ) : step.status === 'active' ? (
                         <motion.div
                           animate={{ rotate: 360 }}
                           transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                         >
                           <Loader2 className="h-4 w-4 text-primary" />
                         </motion.div>
                       ) : (
                         <step.icon className="h-4 w-4 text-muted-foreground" />
                       )}
                     </div>
 
                     {/* Label */}
                     <span className={cn(
                       "text-sm transition-colors",
                       step.status === 'completed' && "text-success",
                       step.status === 'active' && "text-primary font-medium",
                       step.status === 'pending' && "text-muted-foreground"
                     )}>
                       {step.label}
                     </span>
 
                     {/* Progress indicator for active step */}
                     {step.status === 'active' && (
                       <motion.div
                         initial={{ width: 0 }}
                         animate={{ width: '100%' }}
                         transition={{ duration: 1.5, ease: "linear" }}
                         className="flex-1 h-1 bg-primary/20 rounded-full overflow-hidden ml-auto max-w-[100px]"
                       >
                         <motion.div
                           initial={{ x: '-100%' }}
                           animate={{ x: '100%' }}
                           transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                           className="h-full w-1/2 bg-primary rounded-full"
                         />
                       </motion.div>
                     )}
                   </motion.div>
                 ))}
               </AnimatePresence>
             </div>
 
             {/* Typing dots */}
             <div className="flex gap-1.5 pt-2">
               {[0, 1, 2].map((i) => (
                 <motion.span
                   key={i}
                   animate={{ y: [-2, 2, -2], opacity: [0.3, 1, 0.3] }}
                   transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                   className="w-2 h-2 bg-primary rounded-full"
                 />
               ))}
             </div>
           </div>
         </div>
       </div>
     </motion.div>
   );
 }