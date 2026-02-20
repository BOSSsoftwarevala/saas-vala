import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

const staticTopSelling = [
  { id: 'ts-1', rank: 1, title: 'BAR & BISTRO POS', subtitle: 'Restaurant management powerhouse', category: 'Food', features: ['Table Management', 'KOT System', 'Billing', 'Reports'] },
  { id: 'ts-2', rank: 2, title: 'SCHOOL ERP PRO', subtitle: 'K-12 education management leader', category: 'Education', features: ['Admissions', 'Attendance', 'Exams', 'Fee Management'] },
  { id: 'ts-3', rank: 3, title: 'CLINIC MANAGER AI', subtitle: 'Healthcare SaaS for modern clinics', category: 'Healthcare', features: ['Patient Records', 'Appointments', 'Billing', 'Reports'] },
  { id: 'ts-4', rank: 4, title: 'FLEET TRACKER GPS', subtitle: 'Real-time transport & logistics AI', category: 'Transport', features: ['GPS Tracking', 'Route AI', 'Driver App', 'Analytics'] },
  { id: 'ts-5', rank: 5, title: 'WHATSAPP CRM PRO', subtitle: 'Business messaging automation suite', category: 'Marketing', features: ['Bulk Messages', 'Automation', 'Analytics', 'Campaigns'] },
  { id: 'ts-6', rank: 6, title: 'RETAIL POS MAX', subtitle: 'Multi-store billing & inventory', category: 'Retail', features: ['Barcode Scan', 'Inventory', 'Multi-store', 'Reports'] },
  { id: 'ts-7', rank: 7, title: 'PROPERTY CRM SUITE', subtitle: 'Real estate & rental management', category: 'Finance', features: ['Lead Management', 'Listings', 'Rental Tracking', 'Reports'] },
  { id: 'ts-8', rank: 8, title: 'ACCOUNTING MASTER', subtitle: 'GST billing & tally-compatible ERP', category: 'Finance', features: ['GST Filing', 'Tally Import', 'P&L Reports', 'Invoicing'] },
];

export function TopSellingSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['retail', 'pos', 'food', 'restaurant', 'billing', 'erp']);

  const showStatic = dbProducts.length === 0;

  const staticProducts = staticTopSelling.map(p => ({
    ...p,
    price: 5,
    image: '',
    isAvailable: true,
    status: 'live' as const,
    trending: p.rank <= 3,
    featured: p.rank === 1,
    demoUrl: '',
    description: p.subtitle,
  }));

  const displayProducts = showStatic ? staticProducts : dbProducts;

  return (
    <section className="py-4">
      <SectionHeader
        icon="🏆"
        title="This Week Top Selling"
        subtitle="Real sales data. Updated every 24 hours. Don't miss the trend."
        badge="LIVE RANKINGS"
        badgeVariant="live"
        totalCount={displayProducts.length}
      />

      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard
            key={product.id}
            product={product as any}
            index={i}
            onBuyNow={onBuyNow}
            rank={(product as any).rank || i + 1}
            borderColor={i < 3 ? 'border-warning/40' : 'border-border'}
          />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Top Selling" />}
      </SectionSlider>
    </section>
  );
}
