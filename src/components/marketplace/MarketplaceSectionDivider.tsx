import { motion } from 'framer-motion';

interface MarketplaceSectionDividerProps {
  label?: string;
}

export function MarketplaceSectionDivider({ label }: MarketplaceSectionDividerProps) {
  return (
    <div className="px-4 md:px-8 my-6 flex items-center gap-4">
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6 }}
        className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent"
        style={{ transformOrigin: 'left' }}
      />
      {label && (
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap px-2">
          {label}
        </span>
      )}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6 }}
        className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent"
        style={{ transformOrigin: 'right' }}
      />
    </div>
  );
}
