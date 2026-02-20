import { useState } from 'react';
import { Bell } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { toast } from 'sonner';

const staticUpcoming = [
  { id: 'up-1', title: 'AI HOSPITAL ERP 2.0', subtitle: 'Next-gen AI-powered hospital management', category: 'Healthcare', features: ['AI Diagnosis', 'Smart Scheduling', 'IoT Integration', 'Reports'] },
  { id: 'up-2', title: 'BLOCKCHAIN FINANCE SUITE', subtitle: 'DeFi + Traditional finance in one platform', category: 'Finance', features: ['Crypto Wallet', 'DeFi Protocols', 'Smart Contracts', 'Analytics'] },
  { id: 'up-3', title: 'SMART SCHOOL METAVERSE', subtitle: 'Virtual classrooms in 3D learning space', category: 'Education', features: ['VR Classes', 'AI Tutor', 'Live Exams', 'Dashboard'] },
  { id: 'up-4', title: 'DRONE FLEET MANAGER', subtitle: 'Complete drone logistics & delivery system', category: 'Logistics', features: ['Fleet Tracking', 'Route AI', 'Weather API', 'Reports'] },
  { id: 'up-5', title: 'AI LEGAL ASSISTANT', subtitle: 'Automate contracts, compliance & legal docs', category: 'Marketing', features: ['Contract AI', 'E-Signatures', 'Compliance Check', 'Analytics'] },
  { id: 'up-6', title: 'SMART AGRI PLATFORM', subtitle: 'IoT + AI for precision farming at scale', category: 'Transport', features: ['Soil Sensors', 'Crop AI', 'Market Prices', 'Dashboard'] },
  { id: 'up-7', title: 'HYPER POS V3', subtitle: 'Next-gen point of sale for all retail formats', category: 'Retail', features: ['Offline Mode', 'Multi-store', 'AI Pricing', 'Reports'] },
  { id: 'up-8', title: 'ENERGY GRID AI', subtitle: 'Smart utility & energy management system', category: 'Finance', features: ['Grid Monitor', 'Solar AI', 'Billing Engine', 'Analytics'] },
];

export function UpcomingSection() {
  const { products: dbDraft } = useProductsByCategory(['upcoming', 'pipeline', 'coming_soon']);

  // Map static to product shape
  const staticProducts = staticUpcoming.map(p => ({
    ...p,
    price: 5,
    image: '',
    isAvailable: false,
    status: 'upcoming' as const,
    trending: false,
    featured: false,
    demoUrl: '',
    description: p.subtitle,
  }));

  const allProducts = [...dbDraft.map(p => ({ ...p, isAvailable: false, status: 'upcoming' as const })), ...staticProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🚀"
        title="Upcoming Software"
        subtitle="Be first. Get early access before public launch."
        badge="DROPPING SOON"
        badgeVariant="hot"
        totalCount={allProducts.length}
      />

      <SectionSlider>
        {allProducts.map((product, i) => (
          <MarketplaceProductCard
            key={product.id}
            product={product as any}
            index={i}
            onBuyNow={() => {}}
            rank={i + 1}
          />
        ))}
        {allProducts.length === 0 && <ComingSoonCard label="Upcoming" />}
      </SectionSlider>
    </section>
  );
}
