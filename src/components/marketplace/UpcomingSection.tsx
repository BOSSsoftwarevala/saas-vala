import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Clock, Rocket, Users } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { toast } from 'sonner';

// Hardcoded upcoming products that show what's coming — not DB driven (per design)
// But DB products with status=draft also merge in
const staticUpcoming = [
  {
    id: 'up-1', title: 'AI HOSPITAL ERP 2.0', subtitle: 'Next-gen AI-powered hospital management',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=300&fit=crop',
    category: 'Healthcare', expectedDate: 'Mar 2025', notifyCount: 1240, hypeLevel: 'MEGA' as const,
    features: ['AI Diagnosis', 'Smart Scheduling', 'IoT Integration'], price: 5,
  },
  {
    id: 'up-2', title: 'BLOCKCHAIN FINANCE SUITE', subtitle: 'DeFi + Traditional finance in one platform',
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=300&fit=crop',
    category: 'Finance', expectedDate: 'Apr 2025', notifyCount: 980, hypeLevel: 'EXTREME' as const,
    features: ['Crypto Wallet', 'DeFi Protocols', 'Smart Contracts'], price: 5,
  },
  {
    id: 'up-3', title: 'SMART SCHOOL METAVERSE', subtitle: 'Virtual classrooms in 3D learning space',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=300&fit=crop',
    category: 'Education', expectedDate: 'May 2025', notifyCount: 2100, hypeLevel: 'MEGA' as const,
    features: ['VR Classes', 'AI Tutor', 'Live Exams'], price: 5,
  },
  {
    id: 'up-4', title: 'DRONE FLEET MANAGER', subtitle: 'Complete drone logistics & delivery system',
    image: 'https://images.unsplash.com/photo-1527977966861-9b90794f6e98?w=400&h=300&fit=crop',
    category: 'Logistics', expectedDate: 'Jun 2025', notifyCount: 560, hypeLevel: 'HIGH' as const,
    features: ['Fleet Tracking', 'Route AI', 'Weather API'], price: 5,
  },
  {
    id: 'up-5', title: 'AI LEGAL ASSISTANT', subtitle: 'Automate contracts, compliance & legal docs',
    image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&h=300&fit=crop',
    category: 'Legal', expectedDate: 'Mar 2025', notifyCount: 3400, hypeLevel: 'EXTREME' as const,
    features: ['Contract AI', 'E-Signatures', 'Compliance Check'], price: 5,
  },
  {
    id: 'up-6', title: 'SMART AGRI PLATFORM', subtitle: 'IoT + AI for precision farming at scale',
    image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop',
    category: 'Agriculture', expectedDate: 'Jul 2025', notifyCount: 720, hypeLevel: 'HIGH' as const,
    features: ['Soil Sensors', 'Crop AI', 'Market Prices'], price: 5,
  },
  {
    id: 'up-7', title: 'HYPER POS V3', subtitle: 'Next-gen point of sale for all retail formats',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop',
    category: 'Retail', expectedDate: 'Apr 2025', notifyCount: 1800, hypeLevel: 'MEGA' as const,
    features: ['Offline Mode', 'Multi-store', 'AI Pricing'], price: 5,
  },
  {
    id: 'up-8', title: 'ENERGY GRID AI', subtitle: 'Smart utility & energy management system',
    image: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=300&fit=crop',
    category: 'Energy', expectedDate: 'Aug 2025', notifyCount: 430, hypeLevel: 'HIGH' as const,
    features: ['Grid Monitor', 'Solar AI', 'Billing Engine'], price: 5,
  },
];

const hypeBadge = {
  HIGH: { label: 'HIGH HYPE', cls: 'bg-warning/20 text-warning border-warning/30' },
  MEGA: { label: '🔥 MEGA HYPE', cls: 'bg-destructive/20 text-destructive border-destructive/30 animate-pulse' },
  EXTREME: { label: '⚡ EXTREME', cls: 'bg-accent/20 text-accent border-accent/30 animate-pulse' },
};

export function UpcomingSection() {
  const [notified, setNotified] = useState<Set<string>>(new Set());
  // Also fetch DB draft products
  const { products: dbDraft } = useProductsByCategory(['upcoming', 'pipeline', 'coming_soon']);

  const handleNotify = (id: string, title: string) => {
    setNotified(prev => new Set(prev).add(id));
    toast.success(`🔔 You'll be notified when ${title} launches!`);
  };

  // Combine static + DB draft products
  const allProducts = staticUpcoming;

  return (
    <section className="py-4">
      <SectionHeader
        icon="🚀"
        title="Upcoming Software"
        subtitle="Be first. Get early access before public launch."
        badge="DROPPING SOON"
        badgeVariant="hot"
        totalCount={allProducts.length + dbDraft.length}
      />

      <SectionSlider>
        {/* DB draft products first */}
        {dbDraft.map((p, i) => (
          <MarketplaceProductCard
            key={p.id}
            product={{ ...p, isAvailable: false, status: 'upcoming' }}
            index={i}
            onBuyNow={() => {}}
          />
        ))}

        {/* Static upcoming cards */}
        {allProducts.map((product) => (
          <div key={product.id} className="flex-shrink-0 w-[280px] md:w-[300px]">
            <div className="relative rounded-xl overflow-hidden bg-card border border-border shadow-lg h-full flex flex-col">
              <div className="relative h-[108px] overflow-hidden">
                <img src={product.image} alt={product.title} className="w-full h-full object-cover opacity-60" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
                <Badge className={`absolute top-2 left-2 text-[9px] font-black border ${hypeBadge[product.hypeLevel].cls}`}>
                  {hypeBadge[product.hypeLevel].label}
                </Badge>
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/80 rounded-full px-2 py-0.5">
                  <Users className="h-3 w-3 text-primary" />
                  <span className="text-[9px] font-bold text-primary">{product.notifyCount.toLocaleString()}</span>
                </div>
                <div className="absolute bottom-2 left-2 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-warning" />
                  <span className="text-[9px] font-medium text-warning">{product.expectedDate}</span>
                </div>
              </div>

              <div className="p-3 flex flex-col flex-1">
                <Badge variant="outline" className="w-fit text-[9px] mb-2 border-primary/30 text-primary">{product.category}</Badge>
                <h3 className="font-black text-xs text-foreground uppercase leading-tight mb-1">{product.title}</h3>
                <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2">{product.subtitle}</p>

                <div className="flex flex-wrap gap-1 mb-2">
                  {product.features.map((f, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] bg-muted/30 border-border">{f}</Badge>
                  ))}
                </div>

                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-xs line-through text-muted-foreground">$49</span>
                  <span className="text-xl font-black text-primary">$5</span>
                  <Badge className="bg-destructive/20 text-destructive border-0 text-[9px]">90% OFF</Badge>
                </div>

                {/* EXACTLY 3 buttons for upcoming: NOTIFY ME, PRE-ORDER (disabled), ADD */}
                <div className="mt-auto space-y-1.5">
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className={`flex-1 h-8 text-[10px] gap-1 ${notified.has(product.id) ? 'bg-green-600 hover:bg-green-500' : 'bg-warning text-warning-foreground hover:bg-warning/90'}`}
                      onClick={() => handleNotify(product.id, product.title)}
                    >
                      <Bell className="h-3 w-3" />
                      {notified.has(product.id) ? 'NOTIFIED' : 'NOTIFY ME'}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] gap-1 border-primary/30 text-primary" disabled>
                      <Rocket className="h-3 w-3" /> PRE-ORDER
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" className="w-full h-8 text-[10px] gap-1 border-border text-muted-foreground">
                    + ADD PRODUCT
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Coming soon fallback if nothing */}
        {allProducts.length === 0 && dbDraft.length === 0 && (
          <ComingSoonCard label="Upcoming" />
        )}
      </SectionSlider>
    </section>
  );
}
