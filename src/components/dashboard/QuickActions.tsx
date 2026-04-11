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
  // Debug: Check if component renders
  console.log('QuickActions component rendering...');
  
  // Test basic click event
  const testClick = () => {
    console.log('TEST CLICK WORKING!');
    alert('Button click is working!');
  };

  const handleProductClick = (e: React.MouseEvent) => {
    console.log('Add Product clicked - event:', e);
    alert('Add Product button clicked!');
    window.location.href = '/products/create';
  };

  const handleKeyClick = (e: React.MouseEvent) => {
    console.log('Generate Key clicked - event:', e);
    alert('Generate Key button clicked!');
    window.location.href = '/keys';
  };

  const handleApkClick = (e: React.MouseEvent) => {
    console.log('Upload APK clicked - event:', e);
    alert('Upload APK button clicked!');
    window.location.href = '/apk-pipeline';
  };

  const handleServerClick = (e: React.MouseEvent) => {
    console.log('Deploy Server clicked - event:', e);
    alert('Deploy Server button clicked!');
    window.location.href = '/servers';
  };

  const handleWalletClick = (e: React.MouseEvent) => {
    console.log('Add Credits clicked - event:', e);
    alert('Add Credits button clicked!');
    window.location.href = '/wallet';
  };

  const handleSupportClick = (e: React.MouseEvent) => {
    console.log('Support clicked - event:', e);
    alert('Support button clicked!');
    window.location.href = '/support';
  };

  return (
    <div className="neon-card rounded-xl p-5" style={{border: '2px solid red'}}>
      <h3 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        Quick Actions (DEBUG VERSION)
      </h3>
      
      {/* Debug test button */}
      <div style={{marginBottom: '20px', padding: '10px', backgroundColor: 'yellow', border: '2px solid black'}}>
        <p style={{fontWeight: 'bold', marginBottom: '10px'}}>DEBUG TEST ZONE:</p>
        <button 
          onClick={testClick}
          style={{
            backgroundColor: 'red',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          🔴 CLICK ME TO TEST
        </button>
      </div>
      
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleProductClick}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            border: '2px solid black',
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
            border: '2px solid black',
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
            border: '2px solid black',
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
            border: '2px solid black',
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
            border: '2px solid black',
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
            border: '2px solid black',
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