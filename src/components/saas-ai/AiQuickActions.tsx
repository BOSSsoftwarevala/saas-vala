import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Play, 
  RefreshCw, 
  FileText,
  Zap,
  Shield,
  Bug,
  Rocket
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface ActionButton {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: 'default' | 'outline' | 'secondary';
  onClick: () => void;
}

export function AiQuickActions() {
  const handleAction = (action: string) => {
    toast.success(`${action} initiated`, {
      description: 'This operation is now running...'
    });
  };

  const primaryActions: ActionButton[] = [
    {
      label: 'Add AI Model',
      icon: Plus,
      variant: 'default',
      onClick: () => handleAction('Add AI Model')
    },
    {
      label: 'Test AI (Live)',
      icon: Play,
      variant: 'secondary',
      onClick: () => handleAction('Live AI Test')
    },
    {
      label: 'Force Sync',
      icon: RefreshCw,
      variant: 'outline',
      onClick: () => handleAction('Force Sync')
    },
    {
      label: 'View Logs',
      icon: FileText,
      variant: 'outline',
      onClick: () => handleAction('View Logs')
    }
  ];

  const autoActions: ActionButton[] = [
    {
      label: 'Auto Bug Fix',
      icon: Bug,
      variant: 'outline',
      onClick: () => handleAction('Auto Bug Detection & Fix')
    },
    {
      label: 'Security Scan',
      icon: Shield,
      variant: 'outline',
      onClick: () => handleAction('Auto Security Scan')
    },
    {
      label: 'Performance Fix',
      icon: Zap,
      variant: 'outline',
      onClick: () => handleAction('Auto Performance Fix')
    },
    {
      label: 'Auto Deploy',
      icon: Rocket,
      variant: 'outline',
      onClick: () => handleAction('Auto Deploy')
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-4"
    >
      {/* Primary Actions */}
      <div className="flex flex-wrap gap-2">
        {primaryActions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant}
            onClick={action.onClick}
            className="gap-2"
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Auto Actions */}
      <div className="flex flex-wrap gap-2">
        {autoActions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant}
            size="sm"
            onClick={action.onClick}
            className="gap-2 text-xs"
          >
            <action.icon className="h-3.5 w-3.5" />
            {action.label}
          </Button>
        ))}
      </div>
    </motion.div>
  );
}
