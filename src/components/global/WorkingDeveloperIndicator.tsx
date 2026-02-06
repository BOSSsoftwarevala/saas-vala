import { useEffect, useRef, useState } from "react";
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

export function WorkingDeveloperIndicator({
  forceWorking,
}: {
  forceWorking?: boolean;
}) {
  const [working, setWorking] = useState(false);

  // Subscribe to global state only when not forced by parent
  useEffect(() => {
    if (typeof forceWorking === "boolean") return;

    const listener = (w: boolean) => setWorking(w);
    workingListeners.add(listener);
    listener(isWorking);

    return () => {
      workingListeners.delete(listener);
    };
  }, [forceWorking]);

  const effectiveWorking = typeof forceWorking === "boolean" ? forceWorking : working;

  // Keep it visible a bit longer so users can actually notice it
  const [show, setShow] = useState(false);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    if (effectiveWorking) {
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      setShow(true);
      return;
    }

    hideTimer.current = window.setTimeout(() => setShow(false), 650);

    return () => {
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
  }, [effectiveWorking]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          // Main screen (right side) so it’s not hidden by the left sidebar
          className="pointer-events-none fixed right-6 bottom-24 sm:bottom-28 z-[110]"
          aria-label="Working developer indicator"
        >
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/80 px-2.5 py-1.5 shadow-lg backdrop-blur-sm">
            {/* Small, realistic avatar */}
            <motion.div
              className="relative grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/20 ring-1 ring-border/50"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <UserRound className="h-4 w-4 text-foreground/80" />
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
