import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';

import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { OnDemandRequestModal } from './OnDemandRequestModal';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

const staticOnDemand = [
  { id: 'od-1', title: 'SCHOOL ERP PRO', subtitle: 'Complete K-12 school management suite', category: 'Education', features: ['Admissions', 'Fee Mgmt', 'Attendance', 'Reports'] },
  { id: 'od-2', title: 'HOSPITAL CRM AI', subtitle: 'Patient relationship & appointment AI', category: 'Healthcare', features: ['Patient Records', 'Appointments', 'AI Triage', 'Billing'] },
  { id: 'od-3', title: 'RESTAURANT POS MAX', subtitle: 'Multi-outlet restaurant management', category: 'Food', features: ['Table Mgmt', 'KOT System', 'Delivery', 'Reports'] },
  { id: 'od-4', title: 'FLEET TRACKER GPS', subtitle: 'Real-time vehicle tracking & dispatch', category: 'Transport', features: ['GPS Live', 'Driver App', 'Route AI', 'Analytics'] },
  { id: 'od-5', title: 'PROPERTY MANAGER CRM', subtitle: 'End-to-end real estate & rental CRM', category: 'Finance', features: ['Lead Mgmt', 'Listings', 'Rental Track', 'Reports'] },
  { id: 'od-6', title: 'WAREHOUSE WMS PRO', subtitle: 'Intelligent warehouse & inventory system', category: 'Logistics', features: ['Barcode Scan', 'Stock Mgmt', 'Purchase', 'Reports'] },
  { id: 'od-7', title: 'CLINIC MANAGER LITE', subtitle: 'Fast clinic & pharmacy management', category: 'Healthcare', features: ['Patient OPD', 'Pharmacy', 'Lab Reports', 'Billing'] },
  { id: 'od-8', title: 'GOVT CITIZEN PORTAL', subtitle: 'Municipal services & citizen app platform', category: 'Marketing', features: ['Online Forms', 'e-Payments', 'Grievance', 'Reports'] },
];

export function OnDemandSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const [requestModal, setRequestModal] = useState<{ open: boolean; product?: any }>({ open: false });
  const { products: dbProducts, loading } = useProductsByCategory(['saas', 'cloud', 'on_demand', 'erp', 'crm', 'pos', 'software']);

  const openRequest = (product: any) => setRequestModal({ open: true, product });

  const showStatic = dbProducts.length === 0;

  const staticProducts = staticOnDemand.map((p, i) => ({
    ...p,
    price: 5,
    image: '',
    isAvailable: true,
    status: 'live' as const,
    trending: i < 3,
    featured: i === 0,
    demoUrl: '',
    description: p.subtitle,
  }));

  const displayProducts = showStatic ? staticProducts : dbProducts;

  return (
    <section className="py-4">
      {/* Section header with REQUEST DOWNLOAD CTA */}
      <div className="px-4 md:px-8 mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">⚡</span>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase text-foreground">
              On-Demand Software
            </h2>
            <Badge className="bg-green-500 text-white text-[10px] font-black px-2 py-0.5 uppercase tracking-widest">
              INSTANT DEPLOY
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground ml-9">
            Instantly deploy. No setup. Live in minutes.
            <span className="ml-2 text-primary font-semibold">{displayProducts.length} products</span>
          </p>
        </div>
        {/* Prominent REQUEST DOWNLOAD button */}
        <Button
          className="gap-2 h-9 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          onClick={() => openRequest({ id: '', title: 'Custom Software', category: 'General' })}
        >
          <Download className="h-4 w-4" />
          REQUEST DOWNLOAD
        </Button>
      </div>

      <SectionSlider>
        {displayProducts.map((product, i) => (
          <div key={product.id} className="flex flex-col gap-2">
            <MarketplaceProductCard
              product={product as any}
              index={i}
              onBuyNow={onBuyNow}
              rank={i + 1}
            />
            {/* REQUEST DOWNLOAD per card */}
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-[10px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10 rounded-xl"
              onClick={() => openRequest(product)}
            >
              <Download className="h-3.5 w-3.5" />
              REQUEST DOWNLOAD
            </Button>
          </div>
        ))}

        {!loading && displayProducts.length === 0 && (
          <ComingSoonCard label="On-Demand" />
        )}
      </SectionSlider>

      {/* On-Demand Request Modal */}
      <OnDemandRequestModal
        open={requestModal.open}
        onOpenChange={(v) => setRequestModal({ open: v })}
        productName={requestModal.product?.title}
        productId={requestModal.product?.id}
        productCategory={requestModal.product?.category}
      />
    </section>
  );
}
