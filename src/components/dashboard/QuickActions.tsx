import { Button } from '@/components/ui/button';
import { Plus, Key, Upload, Server, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const actions = [
  {
    label: 'Add Product',
    icon: Plus,
    href: '/products',
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
    href: '/products',
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
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="glass-card rounded-xl p-4">
      <h3 className="font-display text-lg font-bold text-foreground mb-4">
        Quick Actions
      </h3>
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            onClick={() => navigate(action.href)}
            className={cn('gap-2', action.color)}
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
