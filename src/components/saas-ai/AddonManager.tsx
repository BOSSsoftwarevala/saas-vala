import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Puzzle, 
  CreditCard, 
  Wallet, 
  Globe, 
  Bell, 
  BarChart3, 
  Search,
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Addon {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'available' | 'installing' | 'installed' | 'incompatible';
  category: string;
}

const addons: Addon[] = [
  {
    id: 'payment',
    name: 'Payment Gateway',
    description: 'Stripe, PayPal, Razorpay integration',
    icon: CreditCard,
    status: 'available',
    category: 'Commerce'
  },
  {
    id: 'wallet',
    name: 'Wallet System',
    description: 'User wallet with balance & transactions',
    icon: Wallet,
    status: 'available',
    category: 'Commerce'
  },
  {
    id: 'language',
    name: 'Language Pack',
    description: 'Multi-language support with auto-translation',
    icon: Globe,
    status: 'installed',
    category: 'Localization'
  },
  {
    id: 'notification',
    name: 'Notifications',
    description: 'Email, SMS, Push notifications',
    icon: Bell,
    status: 'available',
    category: 'Communication'
  },
  {
    id: 'analytics',
    name: 'Analytics Dashboard',
    description: 'User tracking & conversion metrics',
    icon: BarChart3,
    status: 'available',
    category: 'Insights'
  },
  {
    id: 'seo',
    name: 'SEO Tools',
    description: 'Meta tags, sitemap, structured data',
    icon: Search,
    status: 'installed',
    category: 'Marketing'
  },
  {
    id: 'ai-tools',
    name: 'AI Tools',
    description: 'Chatbot, content generation, auto-support',
    icon: Sparkles,
    status: 'available',
    category: 'AI'
  }
];

export function AddonManager() {
  const [addonList, setAddonList] = useState(addons);

  const installAddon = (id: string) => {
    // Start installation
    setAddonList(prev => prev.map(a => 
      a.id === id ? { ...a, status: 'installing' as const } : a
    ));

    // Simulate AI compatibility check and installation
    setTimeout(() => {
      setAddonList(prev => prev.map(a => 
        a.id === id ? { ...a, status: 'installed' as const } : a
      ));
      toast.success('Addon installed', {
        description: 'AI verified compatibility and integrated successfully'
      });
    }, 2500);
  };

  const uninstallAddon = (id: string) => {
    setAddonList(prev => prev.map(a => 
      a.id === id ? { ...a, status: 'available' as const } : a
    ));
    toast.success('Addon removed');
  };

  const categories = [...new Set(addonList.map(a => a.category))];

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Puzzle className="h-5 w-5 text-accent" />
          </div>
          <div>
            <CardTitle className="text-lg">Addon & Feature Manager</CardTitle>
            <CardDescription className="text-xs">
              AI-powered compatibility check & auto-integration
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[360px]">
          <div className="space-y-6 pr-4">
            {categories.map(category => (
              <div key={category}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {category}
                </p>
                <div className="space-y-2">
                  {addonList.filter(a => a.category === category).map((addon) => {
                    const Icon = addon.icon;
                    
                    return (
                      <div
                        key={addon.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                          addon.status === 'installed' && 'bg-success/5 border-success/30',
                          addon.status === 'installing' && 'bg-secondary/5 border-secondary/30',
                          addon.status === 'incompatible' && 'bg-destructive/5 border-destructive/30 opacity-60',
                          addon.status === 'available' && 'bg-muted/20 border-border hover:border-primary/30'
                        )}
                      >
                        <div className={cn(
                          'p-2 rounded-lg shrink-0',
                          addon.status === 'installed' ? 'bg-success/10' : 'bg-muted'
                        )}>
                          <Icon className={cn(
                            'h-4 w-4',
                            addon.status === 'installed' ? 'text-success' : 'text-muted-foreground'
                          )} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{addon.name}</p>
                            {addon.status === 'installed' && (
                              <Badge className="bg-success/20 text-success border-success/30 text-[10px]">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                                Active
                              </Badge>
                            )}
                            {addon.status === 'installing' && (
                              <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-[10px]">
                                <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                                Installing
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{addon.description}</p>
                        </div>

                        <div className="shrink-0">
                          {addon.status === 'available' && (
                            <Button
                              size="sm"
                              onClick={() => installAddon(addon.id)}
                              className="h-7 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30"
                            >
                              Install
                            </Button>
                          )}
                          {addon.status === 'installed' && (
                            <Switch
                              checked={true}
                              onCheckedChange={() => uninstallAddon(addon.id)}
                            />
                          )}
                          {addon.status === 'incompatible' && (
                            <Badge variant="outline" className="text-destructive border-destructive/30">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Incompatible
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
