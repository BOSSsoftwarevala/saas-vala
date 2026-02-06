import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { UserRound } from "lucide-react";

// Subscribe to global activity state
let isWorking = false;
let workingListeners: Set<(working: boolean) => void> = new Set();

export const setGlobalWorking = (working: boolean) => {
  isWorking = working;
  workingListeners.forEach((fn) => fn(working));
};

export const getGlobalWorking = () => isWorking;

export function WorkingDeveloperIndicator() {
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const listener = (w: boolean) => setWorking(w);
    workingListeners.add(listener);
    listener(isWorking);
    return () => {
      workingListeners.delete(listener);
    };
  }, []);

  return (
    <AnimatePresence>
      {working && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          className="pointer-events-none fixed left-4 bottom-20 sm:bottom-4 z-[110]"
        >
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/80 px-2.5 py-1.5 shadow-lg backdrop-blur-sm">
            {/* Human-ish avatar */}
            <motion.div
              className="relative grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/20 ring-1 ring-border/50"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <UserRound className="h-4 w-4 text-foreground/80" />

              {/* Online dot (uses semantic success token) */}
              <span className="absolute -bottom-0.5 -right-0.5 status-dot status-online border border-background" />
            </motion.div>

            {/* Typing dots */}
            <div className="flex items-center gap-0.5" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1 w-1 rounded-full bg-primary/80"
                  animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{
                    duration: 0.55,
                    repeat: Infinity,
                    delay: i * 0.12,
                    ease: "easeInOut",
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
