import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Subscribe to global activity state
let isWorking = false;
let workingListeners: Set<(working: boolean) => void> = new Set();

export const setGlobalWorking = (working: boolean) => {
  isWorking = working;
  workingListeners.forEach(fn => fn(working));
};

export const getGlobalWorking = () => isWorking;

export function WorkingDeveloperIndicator() {
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const listener = (w: boolean) => setWorking(w);
    workingListeners.add(listener);
    listener(isWorking);
    return () => { workingListeners.delete(listener); };
  }, []);

  return (
    <AnimatePresence>
      {working && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-4 left-4 z-[100]"
        >
          <div className="flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 shadow-lg">
            {/* Human-like developer avatar with typing animation */}
            <div className="relative">
              <motion.div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-orange-500/30 flex items-center justify-center"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <span className="text-sm">👨‍💻</span>
              </motion.div>
              {/* Typing indicator dot */}
              <motion.div
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-background"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            </div>
            
            {/* Typing dots */}
            <div className="flex items-center gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 h-1 bg-primary rounded-full"
                  animate={{ 
                    y: [0, -3, 0],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{ 
                    duration: 0.5, 
                    repeat: Infinity, 
                    delay: i * 0.12 
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}