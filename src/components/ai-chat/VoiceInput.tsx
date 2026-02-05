 import { useState, useCallback, useRef } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { Mic, MicOff } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { cn } from '@/lib/utils';
 import { toast } from 'sonner';
 
 interface VoiceInputProps {
   onTranscript: (text: string) => void;
   isProcessing?: boolean;
   className?: string;
 }
 
 // Extend Window interface for SpeechRecognition
 interface SpeechRecognitionEvent extends Event {
   results: SpeechRecognitionResultList;
   resultIndex: number;
 }
 
 interface SpeechRecognitionErrorEvent extends Event {
   error: string;
 }
 
 interface SpeechRecognitionInstance extends EventTarget {
   continuous: boolean;
   interimResults: boolean;
   lang: string;
   start: () => void;
   stop: () => void;
   onstart: ((ev: Event) => void) | null;
   onresult: ((ev: SpeechRecognitionEvent) => void) | null;
   onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
   onend: ((ev: Event) => void) | null;
 }
 
 declare global {
   interface Window {
     SpeechRecognition: new () => SpeechRecognitionInstance;
     webkitSpeechRecognition: new () => SpeechRecognitionInstance;
   }
 }
 
 type VoiceState = 'idle' | 'listening' | 'processing';
 
 export function VoiceInput({ onTranscript, isProcessing, className }: VoiceInputProps) {
   const [state, setState] = useState<VoiceState>('idle');
   const [transcript, setTranscript] = useState('');
   const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
 
   const isSupported = typeof window !== 'undefined' && 
     ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
 
   const startListening = useCallback(() => {
     if (!isSupported) {
       toast.error('Voice input not supported in this browser');
       return;
     }
 
     const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
     const recognizer = new SpeechRecognitionConstructor();
 
     recognizer.continuous = true;
     recognizer.interimResults = true;
     recognizer.lang = 'en-US';
 
     let finalTranscript = '';
 
     recognizer.onstart = () => {
       setState('listening');
       setTranscript('');
       toast.info('🎤 Listening...', { duration: 2000 });
     };
 
     recognizer.onresult = (event: SpeechRecognitionEvent) => {
       let interim = '';
       for (let i = event.resultIndex; i < event.results.length; i++) {
         const result = event.results[i];
         if (result.isFinal) {
           finalTranscript += result[0].transcript + ' ';
         } else {
           interim += result[0].transcript;
         }
       }
       setTranscript(finalTranscript + interim);
     };
 
     recognizer.onerror = (event: SpeechRecognitionErrorEvent) => {
       console.error('Speech recognition error:', event.error);
       setState('idle');
       if (event.error !== 'aborted') {
         toast.error(`Voice error: ${event.error}`);
       }
     };
 
     recognizer.onend = () => {
       if (finalTranscript.trim()) {
         setState('processing');
         onTranscript(finalTranscript.trim());
         setTimeout(() => setState('idle'), 500);
       } else {
         setState('idle');
       }
     };
 
     recognizer.start();
     recognitionRef.current = recognizer;
   }, [isSupported, onTranscript]);
 
   const stopListening = useCallback(() => {
     if (recognitionRef.current) {
       recognitionRef.current.stop();
       recognitionRef.current = null;
     }
   }, []);
 
   const toggleVoice = useCallback(() => {
     if (state === 'listening') {
       stopListening();
     } else if (state === 'idle') {
       startListening();
     }
   }, [state, startListening, stopListening]);
 
   if (!isSupported) {
     return null;
   }
 
   return (
     <div className={cn("relative", className)}>
       <AnimatePresence>
         {state === 'listening' && transcript && (
           <motion.div
             initial={{ opacity: 0, y: 10, scale: 0.95 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: -10, scale: 0.95 }}
             className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 max-w-[90vw]"
           >
             <div className="bg-card border border-border rounded-xl p-3 shadow-xl">
               <div className="flex items-center gap-2 mb-2">
                 <motion.div
                   animate={{ scale: [1, 1.2, 1] }}
                   transition={{ duration: 0.5, repeat: Infinity }}
                   className="w-2 h-2 rounded-full bg-destructive"
                 />
                 <span className="text-xs font-medium text-destructive">Recording...</span>
               </div>
               <p className="text-sm text-foreground/90 leading-relaxed">
                 {transcript || 'Speak now...'}
               </p>
             </div>
           </motion.div>
         )}
       </AnimatePresence>
 
       <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
         <Button
           type="button"
           variant="ghost"
           size="icon"
           onClick={toggleVoice}
           disabled={isProcessing}
           className={cn(
             "h-9 w-9 rounded-xl transition-all duration-300",
             state === 'listening' && [
               "bg-destructive/20 text-destructive hover:bg-destructive/30",
               "ring-2 ring-destructive/50 ring-offset-2 ring-offset-background"
             ],
             state === 'processing' && [
               "bg-primary/20 text-primary hover:bg-primary/30"
             ],
             state === 'idle' && [
               "text-muted-foreground hover:text-primary hover:bg-primary/10"
             ]
           )}
           title={
             state === 'idle' ? "🎤 Voice command (Hindi/English)" :
             state === 'listening' ? "Click to stop" :
             "Processing..."
           }
         >
           {state === 'listening' ? (
             <motion.div
               animate={{ scale: [1, 1.3, 1] }}
               transition={{ duration: 0.5, repeat: Infinity }}
             >
               <MicOff className="h-5 w-5" />
             </motion.div>
           ) : state === 'processing' ? (
             <motion.div
               animate={{ rotate: 360 }}
               transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
               className="h-5 w-5 border-2 border-current border-t-transparent rounded-full"
             />
           ) : (
             <Mic className="h-5 w-5" />
           )}
         </Button>
       </motion.div>
     </div>
   );
 }