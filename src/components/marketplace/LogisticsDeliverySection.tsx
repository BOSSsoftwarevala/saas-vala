import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_LOGISTICS_CLONES = [
  {
    id: 'logistics-clone-1', title: 'Uber Freight Logistics Clone',
    subtitle: 'Logistics marketplace connecting shippers with freight carriers.',
    category: 'Logistics', description: 'Logistics marketplace connecting shippers with freight carriers.',
    features: ['Shipment Listings', 'Carrier Dashboard', 'Freight Booking', 'Route Optimization', 'Shipment Tracking'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/uber-freight-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'uber-freight-clone-software',
  },
  {
    id: 'logistics-clone-2', title: 'ShipStation Delivery Platform Clone',
    subtitle: 'Shipping and logistics management platform for e-commerce businesses.',
    category: 'Logistics', description: 'Shipping and logistics management platform for e-commerce businesses.',
    features: ['Shipment Management', 'Shipping Labels', 'Order Tracking', 'Delivery Analytics', 'Logistics Dashboard'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/shipstation-delivery-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'shipstation-delivery-clone-software',
  },
  {
    id: 'logistics-clone-3', title: 'Delhivery Logistics Clone',
    subtitle: 'Indian logistics platform providing delivery and supply chain services.',
    category: 'Logistics', description: 'Indian logistics platform providing delivery and supply chain services.',
    features: ['Parcel Tracking', 'Delivery Management', 'Logistics Dashboard', 'Route Optimization', 'Fleet Management'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/delhivery-logistics-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'delhivery-logistics-clone-software',
  },
  {
    id: 'logistics-clone-4', title: 'Postmates Delivery Clone',
    subtitle: 'On-demand delivery platform connecting couriers with customers.',
    category: 'Logistics', description: 'On-demand delivery platform connecting couriers with customers.',
    features: ['Delivery Requests', 'Courier Dashboard', 'Real-Time Tracking', 'Payment Integration', 'Order Management'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/postmates-delivery-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'postmates-delivery-clone-software',
  },
  {
    id: 'logistics-clone-5', title: 'DoorDash Delivery Platform Clone',
    subtitle: 'On-demand food and goods delivery platform with driver management.',
    category: 'Logistics', description: 'On-demand food and goods delivery platform with driver management.',
    features: ['Delivery Orders', 'Driver App', 'Real-Time Tracking', 'Payment System', 'Delivery Analytics'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/doordash-delivery-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'doordash-delivery-clone-software',
  },
];

export function LogisticsDeliverySection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['logistics', 'delivery', 'shipping', 'freight', 'courier']);
  const generatedProducts = fillToTarget(dbProducts as any, 'logistics_delivery', 'Logistics & Delivery', 45);
  const displayProducts = [...TOP_5_LOGISTICS_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="📦"
        title="Logistics & Delivery Management"
        subtitle="Delivery Tracking, Route Optimization, Fleet Management & Logistics Analytics."
        badge="DELIVERY"
        badgeVariant="trending"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Logistics & Delivery" />}
      </SectionSlider>
    </section>
  );
}
