import { Button } from '@/components/ui/button';
import { Plus, Key, Upload, Server, Wallet, Headphones } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const actions = [
  {
    label: 'Add Product',
    icon: Plus,
    href: '/products/create',
    color: 'bg-primary hover:bg-primary/90 text-primary-foreground',
  },
  {
    label: 'Generate Key',
    icon: Key,
    href: '/keys',
    color: 'bg-cyan hover:opacity-90 text-primary-foreground',
  },
  {
    label: 'Upload APK',
    icon: Upload,
    href: '/apk-pipeline',
    color: 'bg-purple hover:opacity-90 text-white',
  },
  {
    label: 'Deploy Server',
    icon: Server,
    href: '/servers',
    color: 'bg-muted hover:bg-muted/80 text-foreground',
  },
  {
    label: 'Add Credits',
    icon: Wallet,
    href: '/wallet',
    color: 'bg-green hover:opacity-90 text-white',
  },
  {
    label: 'Support',
    icon: Headphones,
    href: '/support',
    color: 'bg-primary hover:bg-primary/90 text-primary-foreground',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.95 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: 'spring' as const, 
      stiffness: 400, 
      damping: 25 
    },
  },
};

export function QuickActions() {
  const navigate = useNavigate();

  const handleActionClick = (action: typeof actions[0]) => {
    console.log('Quick action clicked:', action.label, 'navigating to:', action.href);
    
    try {
      // Show loading feedback
      toast.loading(`Opening ${action.label}...`, { id: `quick-action-${action.label}` });
      
      // Navigate after a small delay to show feedback
      setTimeout(() => {
        navigate(action.href);
        toast.success(`Opened ${action.label}`, { id: `quick-action-${action.label}` });
      }, 300);
    } catch (error) {
      console.error('Navigation error:', error);
      toast.error(`Failed to navigate to ${action.label}`, { id: `quick-action-${action.label}` });
    }
  };

  // Test function to verify all actions work
  const testAllActions = () => {
    console.log('Testing all quick actions...');
    actions.forEach((action, index) => {
      setTimeout(() => {
        console.log(`Testing action ${index + 1}: ${action.label} -> ${action.href}`);
        toast.info(`Test: ${action.label} -> ${action.href}`, { duration: 2000 });
      }, index * 1000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="neon-card rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Quick Actions
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={testAllActions}
          className="text-xs"
        >
          Test All
        </Button>
      </div>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex flex-wrap gap-3"
      >
        {actions.map((action) => (
          <motion.div key={action.label} variants={itemVariants}>
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={() => handleActionClick(action)}
                className={cn('gap-2 shadow-lg', action.color)}
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </Button>
            </motion.div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}