import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Download, Star, Zap } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

interface OnDemandProduct {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  category: string;
  rating: number;
  downloads: number;
  badge: 'NEW' | 'HOT' | 'TRENDING' | 'AI-POWERED' | 'BESTSELLER';
  features: { icon: string; text: string }[];
  techStack: string[];
  price: number;
}

const badgeCfg = {
  NEW: 'bg-secondary/20 text-secondary border-secondary/30',
  HOT: 'bg-destructive/20 text-destructive border-destructive/30 animate-pulse',
  TRENDING: 'bg-accent/20 text-accent border-accent/30',
  'AI-POWERED': 'bg-primary/20 text-primary border-primary/30',
  BESTSELLER: 'bg-warning/20 text-warning border-warning/30',
};

const onDemandProducts: OnDemandProduct[] = [
  {
    id: 'od-1', title: 'SCHOOL ERP PRO', subtitle: 'Complete K-12 school management suite',
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop',
    category: 'Education', rating: 4.9, downloads: 12400, badge: 'BESTSELLER',
    features: [{ icon: 'Users', text: 'Student Portal' }, { icon: 'Calendar', text: 'Timetable' }, { icon: 'FileText', text: 'Report Cards' }, { icon: 'Wallet', text: 'Fee Mgmt' }],
    techStack: ['React', 'Node.js', 'PostgreSQL'], price: 5,
  },
  {
    id: 'od-2', title: 'HOSPITAL CRM AI', subtitle: 'Patient relationship & appointment AI',
    image: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=400&h=300&fit=crop',
    category: 'Healthcare', rating: 4.8, downloads: 8900, badge: 'AI-POWERED',
    features: [{ icon: 'Brain', text: 'AI Diagnosis' }, { icon: 'Calendar', text: 'Scheduling' }, { icon: 'Shield', text: 'HIPAA Safe' }, { icon: 'Bell', text: 'Alerts' }],
    techStack: ['Next.js', 'Python', 'MongoDB'], price: 5,
  },
  {
    id: 'od-3', title: 'RESTAURANT POS MAX', subtitle: 'Multi-outlet restaurant management platform',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop',
    category: 'Food & Hospitality', rating: 4.7, downloads: 21000, badge: 'HOT',
    features: [{ icon: 'Receipt', text: 'Quick Billing' }, { icon: 'LayoutGrid', text: 'Table View' }, { icon: 'Package', text: 'Inventory' }, { icon: 'BarChart3', text: 'Analytics' }],
    techStack: ['React', 'Electron', 'SQLite'], price: 5,
  },
  {
    id: 'od-4', title: 'FLEET TRACKER GPS', subtitle: 'Real-time vehicle tracking & dispatch',
    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&h=300&fit=crop',
    category: 'Transport', rating: 4.6, downloads: 5600, badge: 'TRENDING',
    features: [{ icon: 'MapPin', text: 'Live GPS' }, { icon: 'Route', text: 'Route AI' }, { icon: 'Fuel', text: 'Fuel Logs' }, { icon: 'AlertTriangle', text: 'Alerts' }],
    techStack: ['React', 'Socket.io', 'Redis'], price: 5,
  },
  {
    id: 'od-5', title: 'PROPERTY MANAGER CRM', subtitle: 'End-to-end real estate & rental CRM',
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop',
    category: 'Real Estate', rating: 4.8, downloads: 7200, badge: 'NEW',
    features: [{ icon: 'Home', text: 'Listings' }, { icon: 'Users', text: 'Tenant CRM' }, { icon: 'Wallet', text: 'Rent Collect' }, { icon: 'FileText', text: 'Agreements' }],
    techStack: ['Vue.js', 'Laravel', 'MySQL'], price: 5,
  },
  {
    id: 'od-6', title: 'WAREHOUSE WMS PRO', subtitle: 'Intelligent warehouse & inventory system',
    image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&h=300&fit=crop',
    category: 'Logistics', rating: 4.7, downloads: 4300, badge: 'AI-POWERED',
    features: [{ icon: 'ScanBarcode', text: 'Barcode Scan' }, { icon: 'Package', text: 'Stock AI' }, { icon: 'Truck', text: 'Dispatch' }, { icon: 'BarChart3', text: 'Reports' }],
    techStack: ['React', 'Node.js', 'PostgreSQL'], price: 5,
  },
  {
    id: 'od-7', title: 'CLINIC MANAGER LITE', subtitle: 'Fast clinic & pharmacy management solution',
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&h=300&fit=crop',
    category: 'Healthcare', rating: 4.9, downloads: 18600, badge: 'BESTSELLER',
    features: [{ icon: 'Pill', text: 'Pharmacy' }, { icon: 'Users', text: 'Patients' }, { icon: 'Receipt', text: 'Billing' }, { icon: 'FileText', text: 'Prescriptions' }],
    techStack: ['React', 'Express', 'SQLite'], price: 5,
  },
  {
    id: 'od-8', title: 'GOVT CITIZEN PORTAL', subtitle: 'Municipal services & citizen app platform',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop',
    category: 'Government', rating: 4.5, downloads: 3100, badge: 'TRENDING',
    features: [{ icon: 'FileText', text: 'Applications' }, { icon: 'Wallet', text: 'Tax Pay' }, { icon: 'Bell', text: 'Notices' }, { icon: 'MapPin', text: 'GIS Maps' }],
    techStack: ['Angular', 'Java', 'Oracle'], price: 5,
  },
];

export function OnDemandSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  return (
    <section className="py-4">
      <SectionHeader
        icon="⚡"
        title="On-Demand Software"
        subtitle="Instantly deploy. No setup. Live in minutes."
        badge="INSTANT DEPLOY"
        badgeVariant="live"
        totalCount={onDemandProducts.length}
      />

      <SectionSlider>
        {onDemandProducts.map((product, index) => {
          const IconKey = product.features[0]?.icon as keyof typeof LucideIcons;
          const IconComp = (LucideIcons[IconKey] as React.ComponentType<{ className?: string }>) || LucideIcons.Box;

          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, type: 'spring', stiffness: 260, damping: 24 }}
              whileHover={{ scale: 1.03, zIndex: 10 }}
              className="flex-shrink-0 w-[280px] md:w-[300px]"
            >
              <div className="relative rounded-xl overflow-hidden bg-card border border-border shadow-lg h-full flex flex-col">
                {/* Image */}
                <div className="relative h-[100px] overflow-hidden">
                  <img src={product.image} alt={product.title} className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                  <Badge className={cn('absolute top-2 left-2 text-[10px] font-black border', badgeCfg[product.badge])}>
                    {product.badge}
                  </Badge>
                  {/* Rating */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/80 rounded-full px-2 py-0.5">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    <span className="text-[10px] font-bold text-warning">{product.rating}</span>
                  </div>
                  {/* Downloads */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1">
                    <Download className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{(product.downloads / 1000).toFixed(1)}k</span>
                  </div>
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center">
                      <IconComp className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-[9px] border-primary/20 text-primary">{product.category}</Badge>
                  </div>

                  <h3 className="font-bold text-sm text-foreground uppercase leading-tight mb-1">{product.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{product.subtitle}</p>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {product.features.map((f, i) => {
                      const FIcon = (LucideIcons[f.icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>) || LucideIcons.CheckCircle2;
                      return (
                        <Badge key={i} variant="outline" className="text-[9px] bg-muted/30 border-border gap-1 items-center">
                          <FIcon className="h-2.5 w-2.5" />
                          {f.text}
                        </Badge>
                      );
                    })}
                  </div>

                  {/* Tech Stack */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {product.techStack.map((t, i) => (
                      <Badge key={i} variant="secondary" className="text-[8px] bg-primary/10 text-primary border-0 px-1.5 py-0">{t}</Badge>
                    ))}
                  </div>

                  {/* Price + CTA */}
                  <div className="mt-auto">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-xs line-through text-muted-foreground">$49/mo</span>
                      <span className="text-xl font-bold text-primary">$5</span>
                      <span className="text-xs text-muted-foreground">/mo</span>
                      <Badge className="bg-destructive/20 text-destructive border-0 text-[9px]">90% OFF</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] gap-1 border-primary/30 text-primary">
                        <Zap className="h-3.5 w-3.5" />
                        DEMO
                      </Button>
                      <Button size="sm" className="flex-1 h-8 text-[10px] gap-1" onClick={() => onBuyNow(product)}>
                        <ShoppingCart className="h-3.5 w-3.5" />
                        BUY $5
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </SectionSlider>
    </section>
  );
}
