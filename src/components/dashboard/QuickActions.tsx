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
  console.log('QUICKACTIONS COMPONENT IS RENDERING!!!');
  
  return (
    <div style={{
      backgroundColor: 'red',
      color: 'white',
      padding: '20px',
      border: '5px solid yellow',
      fontSize: '24px',
      fontWeight: 'bold'
    }}>
      🚨 QUICKACTIONS COMPONENT IS WORKING! 🚨
      <br />
      If you can see this, the component is rendering!
      <br />
      <button 
        onClick={() => alert('BUTTON CLICK WORKS!')}
        style={{
          backgroundColor: 'blue',
          color: 'white',
          padding: '10px 20px',
          fontSize: '18px',
          border: 'none',
          borderRadius: '5px',
          marginTop: '10px',
          cursor: 'pointer'
        }}
      >
        CLICK ME TO TEST
      </button>
    </div>
  );
}