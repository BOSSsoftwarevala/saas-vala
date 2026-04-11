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
  const handleProductClick = () => {
    console.log('Add Product clicked');
    window.location.href = '/products/create';
  };

  const handleKeyClick = () => {
    console.log('Generate Key clicked');
    window.location.href = '/keys';
  };

  const handleApkClick = () => {
    console.log('Upload APK clicked');
    window.location.href = '/apk-pipeline';
  };

  const handleServerClick = () => {
    console.log('Deploy Server clicked');
    window.location.href = '/servers';
  };

  const handleWalletClick = () => {
    console.log('Add Credits clicked');
    window.location.href = '/wallet';
  };

  const handleSupportClick = () => {
    console.log('Support clicked');
    window.location.href = '/support';
  };

  return (
    <div className="neon-card rounded-xl p-5">
      <h3 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        Quick Actions
      </h3>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleProductClick}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          ➕ Add Product
        </button>
        
        <button
          onClick={handleKeyClick}
          style={{
            backgroundColor: '#06b6d4',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          🔑 Generate Key
        </button>
        
        <button
          onClick={handleApkClick}
          style={{
            backgroundColor: '#9333ea',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          📤 Upload APK
        </button>
        
        <button
          onClick={handleServerClick}
          style={{
            backgroundColor: '#6b7280',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          🖥️ Deploy Server
        </button>
        
        <button
          onClick={handleWalletClick}
          style={{
            backgroundColor: '#10b981',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          💳 Add Credits
        </button>
        
        <button
          onClick={handleSupportClick}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          🎧 Support
        </button>
      </div>
    </div>
  );
}