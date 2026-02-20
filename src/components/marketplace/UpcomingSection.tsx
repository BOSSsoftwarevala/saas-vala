import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Clock, Zap, Users } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UpcomingProduct {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  category: string;
  expectedDate: string;
  notifyCount: number;
  hypeLevel: 'HIGH' | 'MEGA' | 'EXTREME';
  features: string[];
  price: number;
}

const upcomingProducts: UpcomingProduct[] = [
  {
    id: 'up-1', title: 'AI HOSPITAL ERP 2.0', subtitle: 'Next-gen AI-powered hospital management',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=300&fit=crop',
    category: 'Healthcare', expectedDate: 'March 2025', notifyCount: 1240, hypeLevel: 'MEGA',
    features: ['AI Diagnosis', 'Smart Scheduling', 'IoT Integration', 'Predictive Analytics'],
    price: 5,
  },
  {
    id: 'up-2', title: 'BLOCKCHAIN FINANCE SUITE', subtitle: 'DeFi + Traditional finance in one platform',
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=300&fit=crop',
    category: 'Finance', expectedDate: 'April 2025', notifyCount: 980, hypeLevel: 'EXTREME',
    features: ['Crypto Wallet', 'DeFi Protocols', 'Smart Contracts', 'Multi-currency'],
    price: 5,
  },
  {
    id: 'up-3', title: 'SMART SCHOOL METAVERSE', subtitle: 'Virtual classrooms in 3D learning space',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=300&fit=crop',
    category: 'Education', expectedDate: 'May 2025', notifyCount: 2100, hypeLevel: 'MEGA',
    features: ['VR Classes', 'AI Tutor', 'Live Exams', 'Parent Portal'],
    price: 5,
  },
  {
    id: 'up-4', title: 'DRONE FLEET MANAGER', subtitle: 'Complete drone logistics & delivery system',
    image: 'https://images.unsplash.com/photo-1527977966861-9b90794f6e98?w=400&h=300&fit=crop',
    category: 'Logistics', expectedDate: 'June 2025', notifyCount: 560, hypeLevel: 'HIGH',
    features: ['Fleet Tracking', 'Route AI', 'Weather API', 'FAA Compliance'],
    price: 5,
  },
  {
    id: 'up-5', title: 'AI LEGAL ASSISTANT', subtitle: 'Automate contracts, compliance & legal docs',
    image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&h=300&fit=crop',
    category: 'Legal', expectedDate: 'March 2025', notifyCount: 3400, hypeLevel: 'EXTREME',
    features: ['Contract AI', 'E-Signatures', 'Compliance Check', 'Court Filing'],
    price: 5,
  },
  {
    id: 'up-6', title: 'SMART AGRI PLATFORM', subtitle: 'IoT + AI for precision farming at scale',
    image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop',
    category: 'Agriculture', expectedDate: 'July 2025', notifyCount: 720, hypeLevel: 'HIGH',
    features: ['Soil Sensors', 'Crop AI', 'Market Prices', 'Weather Alerts'],
    price: 5,
  },
  {
    id: 'up-7', title: 'HYPER POS V3', subtitle: 'Next-gen point of sale for all retail formats',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop',
    category: 'Retail', expectedDate: 'April 2025', notifyCount: 1800, hypeLevel: 'MEGA',
    features: ['Offline Mode', 'Multi-store', 'AI Pricing', 'Loyalty Points'],
    price: 5,
  },
  {
    id: 'up-8', title: 'ENERGY GRID AI', subtitle: 'Smart utility & energy management system',
    image: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=300&fit=crop',
    category: 'Energy', expectedDate: 'August 2025', notifyCount: 430, hypeLevel: 'HIGH',
    features: ['Grid Monitor', 'Solar AI', 'Billing Engine', 'IoT Control'],
    price: 5,
  },
];

const hypeBadge = {
  HIGH: { label: 'HIGH HYPE', cls: 'bg-warning/20 text-warning border-warning/30' },
  MEGA: { label: '🔥 MEGA HYPE', cls: 'bg-destructive/20 text-destructive border-destructive/30 animate-pulse' },
  EXTREME: { label: '⚡ EXTREME HYPE', cls: 'bg-accent/20 text-accent border-accent/30 animate-pulse' },
};

export function UpcomingSection() {
  const handleNotify = (p: UpcomingProduct) => {
    toast.success(`🔔 You'll be notified when ${p.title} launches!`);
  };

  return (
    <section className="py-4">
      <SectionHeader
        icon="🚀"
        title="Upcoming Software"
        subtitle="Be first. Get early access before public launch."
        badge="DROPPING SOON"
        badgeVariant="hot"
        totalCount={upcomingProducts.length}
      />

      {/* Horizontal scroll slider with arrows */}
      <SectionSlider>
        {upcomingProducts.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, type: 'spring', stiffness: 260, damping: 24 }}
            whileHover={{ scale: 1.03, zIndex: 10 }}
            className="flex-shrink-0 w-[280px] md:w-[300px]"
          >
            <div className="relative rounded-xl overflow-hidden bg-card border border-border shadow-lg h-full flex flex-col">
              {/* Countdown banner */}
              <div className="relative h-[110px] overflow-hidden">
                <img src={product.image} alt={product.title} className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
                {/* Hype badge */}
                <Badge className={cn('absolute top-2 left-2 text-[10px] font-black border', hypeBadge[product.hypeLevel].cls)}>
                  {hypeBadge[product.hypeLevel].label}
                </Badge>
                {/* Notify count */}
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/80 rounded-full px-2 py-0.5">
                  <Users className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold text-primary">{product.notifyCount.toLocaleString()}</span>
                </div>
                {/* Expected date */}
                <div className="absolute bottom-2 left-2 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-warning" />
                  <span className="text-[10px] font-medium text-warning">{product.expectedDate}</span>
                </div>
              </div>

              <div className="p-4 flex flex-col flex-1">
                <Badge variant="outline" className="w-fit text-[9px] mb-2 border-primary/30 text-primary">
                  {product.category}
                </Badge>
                <h3 className="font-bold text-sm text-foreground uppercase leading-tight mb-1">{product.title}</h3>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{product.subtitle}</p>

                {/* Features */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {product.features.map((f, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] bg-muted/30 border-border">
                      {f}
                    </Badge>
                  ))}
                </div>

                {/* Price + CTA */}
                <div className="mt-auto flex items-center gap-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs line-through text-muted-foreground">$49</span>
                    <span className="text-lg font-bold text-primary">$5</span>
                    <Badge className="bg-destructive/20 text-destructive border-0 text-[9px]">90% OFF</Badge>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-[11px] gap-1.5 bg-warning text-warning-foreground hover:bg-warning/90"
                    onClick={() => handleNotify(product)}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    NOTIFY ME
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-[11px] gap-1 border-primary/30 text-primary" disabled>
                    <Zap className="h-3.5 w-3.5" />
                    PRE-ORDER
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </SectionSlider>
    </section>
  );
}
