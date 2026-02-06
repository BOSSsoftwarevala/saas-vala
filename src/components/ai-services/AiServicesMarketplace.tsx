import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard,
  Zap,
  Video,
  Globe,
  Search,
  Megaphone,
  Target,
  Brain,
  Sparkles,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertCircle,
  Crown,
  Rocket
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AiService {
  id: string;
  name: string;
  description: string;
  icon: typeof Zap;
  price: number;
  priceUnit: 'month' | '6months' | 'year';
  discount6Month: number;
  features: string[];
  status: 'active' | 'inactive' | 'upgrade_available';
  usage: number;
  limit: number;
  category: 'core' | 'seo' | 'marketing' | 'content';
  autoEnabled: boolean;
  isPremium: boolean;
}

const services: AiService[] = [
  {
    id: 'lovable-ai',
    name: 'Lovable AI Gateway',
    description: 'GPT-5, Gemini 3, Claude - All models in one',
    icon: Brain,
    price: 5,
    priceUnit: 'month',
    discount6Month: 20,
    features: ['All AI Models', 'Auto Failover', 'Unlimited Requests', 'Priority Support'],
    status: 'active',
    usage: 45000,
    limit: 100000,
    category: 'core',
    autoEnabled: true,
    isPremium: false
  },
  {
    id: 'auto-seo',
    name: 'Auto SEO Engine',
    description: 'AI-powered SEO optimization, auto meta tags, sitemap',
    icon: Search,
    price: 3,
    priceUnit: 'month',
    discount6Month: 25,
    features: ['Auto Meta Tags', 'Smart Keywords', 'Google Indexing', 'Competitor Analysis'],
    status: 'active',
    usage: 120,
    limit: 500,
    category: 'seo',
    autoEnabled: true,
    isPremium: false
  },
  {
    id: 'auto-google-ads',
    name: 'Auto Google Ads',
    description: 'AI creates & manages your Google Ads campaigns',
    icon: Megaphone,
    price: 10,
    priceUnit: 'month',
    discount6Month: 30,
    features: ['Auto Campaign Creation', 'Budget Optimization', 'A/B Testing', 'ROI Tracking'],
    status: 'inactive',
    usage: 0,
    limit: 100,
    category: 'marketing',
    autoEnabled: false,
    isPremium: true
  },
  {
    id: 'auto-video',
    name: 'Auto Video Creator',
    description: 'AI generates product videos & overviews automatically',
    icon: Video,
    price: 8,
    priceUnit: 'month',
    discount6Month: 25,
    features: ['Product Videos', 'Auto Voiceover', 'Multi-Language', 'Auto Upload'],
    status: 'inactive',
    usage: 0,
    limit: 50,
    category: 'content',
    autoEnabled: false,
    isPremium: true
  },
  {
    id: 'auto-country-targeting',
    name: 'Auto Country Targeting',
    description: 'Auto select best AI model & content per country',
    icon: Globe,
    price: 4,
    priceUnit: 'month',
    discount6Month: 20,
    features: ['India/Africa Focus', 'Local Languages', 'Regional SEO', 'Currency Auto'],
    status: 'active',
    usage: 35,
    limit: 100,
    category: 'marketing',
    autoEnabled: true,
    isPremium: false
  },
  {
    id: 'auto-posting',
    name: 'Auto Social Posting',
    description: 'Auto post to Google, Facebook, LinkedIn, Twitter',
    icon: Target,
    price: 5,
    priceUnit: 'month',
    discount6Month: 25,
    features: ['Multi-Platform', 'Scheduled Posts', 'Auto Hashtags', 'Analytics'],
    status: 'inactive',
    usage: 0,
    limit: 200,
    category: 'marketing',
    autoEnabled: false,
    isPremium: false
  },
  {
    id: 'auto-audience',
    name: 'Target Audience AI',
    description: 'AI finds & targets your perfect customers',
    icon: Sparkles,
    price: 6,
    priceUnit: 'month',
    discount6Month: 30,
    features: ['Audience Discovery', 'Lookalike Finder', 'Interest Mapping', 'Retargeting'],
    status: 'inactive',
    usage: 0,
    limit: 100,
    category: 'marketing',
    autoEnabled: false,
    isPremium: true
  }
];

const categoryColors = {
  core: 'bg-primary/10 text-primary border-primary/20',
  seo: 'bg-cyan/10 text-cyan border-cyan/20',
  marketing: 'bg-warning/10 text-warning border-warning/20',
  content: 'bg-success/10 text-success border-success/20'
};

const categoryLabels = {
  core: 'Core AI',
  seo: 'SEO',
  marketing: 'Marketing',
  content: 'Content'
};

export function AiServicesMarketplace() {
  const [serviceList, setServiceList] = useState(services);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | '6months'>('6months');

  const calculatePrice = (service: AiService) => {
    if (selectedPlan === '6months') {
      const discounted = service.price * (1 - service.discount6Month / 100);
      return { 
        monthly: discounted, 
        total: discounted * 6,
        saved: (service.price * 6) - (discounted * 6)
      };
    }
    return { monthly: service.price, total: service.price, saved: 0 };
  };

  const handlePayNow = (service: AiService) => {
    const pricing = calculatePrice(service);
    const amount = selectedPlan === '6months' ? pricing.total : pricing.monthly;
    
    toast.success(`💳 Redirecting to payment for ${service.name}`, {
      description: `Amount: $${amount.toFixed(2)} (${selectedPlan === '6months' ? '6 months' : 'monthly'})`
    });
    
    // Redirect to wallet
    window.location.href = '/wallet';
  };

  const handleToggleAuto = (serviceId: string) => {
    setServiceList(prev => prev.map(s => 
      s.id === serviceId ? { ...s, autoEnabled: !s.autoEnabled } : s
    ));
    toast.success('Auto-mode updated');
  };

  const handleActivate = (service: AiService) => {
    setServiceList(prev => prev.map(s => 
      s.id === service.id ? { ...s, status: 'active' } : s
    ));
    toast.success(`✅ ${service.name} activated!`);
  };

  const totalMonthly = serviceList
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + calculatePrice(s).monthly, 0);

  const activeCount = serviceList.filter(s => s.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Plan Selector & Summary */}
      <Card className="glass-card border-primary/20">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
                <Button
                  size="sm"
                  variant={selectedPlan === 'monthly' ? 'default' : 'ghost'}
                  onClick={() => setSelectedPlan('monthly')}
                  className="text-xs"
                >
                  Monthly
                </Button>
                <Button
                  size="sm"
                  variant={selectedPlan === '6months' ? 'default' : 'ghost'}
                  onClick={() => setSelectedPlan('6months')}
                  className="text-xs gap-1"
                >
                  <Crown className="h-3 w-3" />
                  6 Months (Save 25%)
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">${totalMonthly.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedPlan === '6months' ? 'per month (billed 6mo)' : 'per month'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Active Services</p>
              </div>
              <Button className="gap-2 bg-gradient-to-r from-primary to-cyan">
                <CreditCard className="h-4 w-4" />
                Pay All Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Upgrade Notice */}
      <div className="flex items-center gap-3 p-3 bg-success/10 border border-success/20 rounded-lg">
        <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-success">Auto-Upgrade Mode Active</p>
          <p className="text-xs text-muted-foreground">
            When limits are reached, services auto-upgrade. You'll be notified, never asked.
          </p>
        </div>
        <Badge variant="outline" className="bg-success/20 text-success border-success/30">
          Enabled
        </Badge>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {serviceList.map((service) => {
          const pricing = calculatePrice(service);
          const Icon = service.icon;
          
          return (
            <Card 
              key={service.id} 
              className={cn(
                'glass-card-hover overflow-hidden transition-all',
                service.status === 'active' && 'border-primary/30',
                service.isPremium && 'border-warning/30'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-10 w-10 rounded-lg flex items-center justify-center',
                      service.status === 'active' ? 'bg-primary/20' : 'bg-muted'
                    )}>
                      <Icon className={cn(
                        'h-5 w-5',
                        service.status === 'active' ? 'text-primary' : 'text-muted-foreground'
                      )} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm">{service.name}</CardTitle>
                        {service.isPremium && (
                          <Crown className="h-3 w-3 text-warning" />
                        )}
                      </div>
                      <Badge variant="outline" className={cn('text-[10px] mt-1', categoryColors[service.category])}>
                        {categoryLabels[service.category]}
                      </Badge>
                    </div>
                  </div>
                  
                  <Badge 
                    variant="outline"
                    className={cn(
                      service.status === 'active' 
                        ? 'bg-success/20 text-success border-success/30'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {service.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">{service.description}</p>
                
                {/* Features */}
                <div className="flex flex-wrap gap-1">
                  {service.features.slice(0, 3).map((f) => (
                    <span key={f} className="text-[10px] px-2 py-0.5 bg-muted rounded-full">
                      {f}
                    </span>
                  ))}
                  {service.features.length > 3 && (
                    <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full">
                      +{service.features.length - 3}
                    </span>
                  )}
                </div>
                
                {/* Usage (if active) */}
                {service.status === 'active' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Usage</span>
                      <span>{service.usage.toLocaleString()} / {service.limit.toLocaleString()}</span>
                    </div>
                    <Progress 
                      value={(service.usage / service.limit) * 100} 
                      className="h-1.5"
                    />
                  </div>
                )}
                
                {/* Pricing */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-foreground">
                        ${pricing.monthly.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground">/mo</span>
                    </div>
                    {selectedPlan === '6months' && pricing.saved > 0 && (
                      <p className="text-[10px] text-success">
                        Save ${pricing.saved.toFixed(2)} on 6mo
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {service.status === 'active' ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">Auto</span>
                          <Switch
                            checked={service.autoEnabled}
                            onCheckedChange={() => handleToggleAuto(service.id)}
                            className="scale-75"
                          />
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handlePayNow(service)}
                        >
                          Renew
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm" 
                        className="h-7 text-xs gap-1 bg-gradient-to-r from-primary to-cyan"
                        onClick={() => handlePayNow(service)}
                      >
                        <CreditCard className="h-3 w-3" />
                        Pay Now
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <Card className="glass-card bg-gradient-to-r from-primary/5 to-cyan/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Rocket className="h-10 w-10 text-primary" />
              <div>
                <h3 className="font-bold text-lg">Full Auto-Pilot Bundle</h3>
                <p className="text-sm text-muted-foreground">
                  All 7 services • $25/mo (Save 40%) • Best in market
                </p>
              </div>
            </div>
            <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-cyan">
              <Crown className="h-4 w-4" />
              Get Full Bundle - $150 for 6 Months
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
