import { SectionHeader } from './SectionHeader';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';

const staticPopular = [
  { id: 'pp-1', title: 'WHATSAPP BUSINESS PRO', subtitle: 'Automation & bulk messaging platform', category: 'Marketing', features: ['Bulk Messages', 'Auto-Reply', 'Analytics', 'Campaigns'] },
  { id: 'pp-2', title: 'GST BILLING MASTER', subtitle: "India's #1 GST billing & accounting", category: 'Finance', features: ['GST Filing', 'E-Invoice', 'P&L Reports', 'Multi-GSTIN'] },
  { id: 'pp-3', title: 'MULTI STORE RETAIL POS', subtitle: 'Centralized retail chain management', category: 'Retail', features: ['Multi-store', 'Barcode', 'Inventory', 'Reports'] },
  { id: 'pp-4', title: 'STUDENT LMS PORTAL', subtitle: 'Modern learning management system', category: 'Education', features: ['Live Classes', 'Assignments', 'Quizzes', 'Progress'] },
  { id: 'pp-5', title: 'HOTEL & RESORT PMS', subtitle: 'Full property management solution', category: 'Food', features: ['Reservations', 'Room Service', 'Billing', 'Reports'] },
  { id: 'pp-6', title: 'PAYROLL SMART SUITE', subtitle: 'Complete HR & payroll automation', category: 'HR', features: ['Salary Calc', 'PF/ESI', 'Leave Mgmt', 'Payslips'] },
  { id: 'pp-7', title: 'DELIVERY PARTNER APP', subtitle: 'Last-mile delivery management platform', category: 'Logistics', features: ['Live Tracking', 'Driver App', 'Route AI', 'Analytics'] },
  { id: 'pp-8', title: 'CONSTRUCTION ERP', subtitle: 'Site management & contractor billing', category: 'Finance', features: ['Site Mgmt', 'Labour Track', 'Material', 'Billing'] },
];

export function PopularProductsSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['marketing', 'finance', 'hr', 'crm', 'accounting', 'hospitality', 'logistics', 'construction']);

  const showStatic = dbProducts.length === 0;

  const staticProducts = staticPopular.map((p, i) => ({
    ...p,
    price: 5,
    image: '',
    isAvailable: true,
    status: 'live' as const,
    trending: i < 2,
    featured: i === 0,
    demoUrl: '',
    description: p.subtitle,
  }));

  const displayProducts = showStatic ? staticProducts : dbProducts;

  return (
    <section className="py-4">
      <SectionHeader
        icon="🌟"
        title="Popular Products"
        subtitle="Community-loved software. Trusted by thousands of businesses."
        badge="COMMUNITY CHOICE"
        badgeVariant="trending"
        totalCount={displayProducts.length}
      />

      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard
            key={product.id}
            product={product as any}
            index={i}
            onBuyNow={onBuyNow}
            rank={i + 1}
          />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Popular" />}
      </SectionSlider>
    </section>
  );
}
