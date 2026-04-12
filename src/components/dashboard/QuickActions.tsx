import { Button } from '@/components/ui/button';
import { Plus, Key, Upload, Server, Wallet, Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.href}
            asChild
            className={cn('h-14 justify-start gap-3 rounded-xl shadow-sm', action.color)}
          >
            <a href={action.href}>
              <Icon className="h-5 w-5" />
              <span>{action.label}</span>
            </a>
          </Button>
        );
      })}
    </div>
  );
}