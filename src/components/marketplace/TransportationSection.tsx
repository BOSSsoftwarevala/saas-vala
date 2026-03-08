import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_TRANSPORT_CLONES = [
  {
    id: 'transport-clone-1', title: 'Uber Ride Sharing Clone',
    subtitle: 'On-demand ride booking platform connecting riders with nearby drivers.',
    category: 'Transport', description: 'On-demand ride booking platform connecting riders with nearby drivers.',
    features: ['Ride Booking', 'Real-Time GPS Tracking', 'Driver App', 'Fare Estimation', 'Trip History'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/uber-ride-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'uber-ride-clone-software',
  },
  {
    id: 'transport-clone-2', title: 'Ola Taxi Clone',
    subtitle: 'Ride-hailing platform allowing users to book taxis and drivers to accept rides.',
    category: 'Transport', description: 'Ride-hailing platform allowing users to book taxis and drivers to accept rides.',
    features: ['Ride Booking', 'Driver Dashboard', 'Fare Calculation', 'GPS Navigation', 'Ride Analytics'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/ola-ride-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'ola-ride-clone-software',
  },
  {
    id: 'transport-clone-3', title: 'Lyft Ride Sharing Clone',
    subtitle: 'Ride-sharing platform designed for fast urban transportation.',
    category: 'Transport', description: 'Ride-sharing platform designed for fast urban transportation.',
    features: ['Ride Matching', 'Driver Earnings Dashboard', 'Payment Integration', 'Trip Tracking', 'Ratings & Reviews'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/lyft-ride-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'lyft-ride-clone-software',
  },
  {
    id: 'transport-clone-4', title: 'Bolt Taxi Clone',
    subtitle: 'Fast ride-hailing platform used in many global cities.',
    category: 'Transport', description: 'Fast ride-hailing platform used in many global cities.',
    features: ['Instant Ride Booking', 'GPS Tracking', 'Driver Dashboard', 'Fare Estimation', 'Ride History'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/bolt-ride-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'bolt-ride-clone-software',
  },
  {
    id: 'transport-clone-5', title: 'Grab Ride Sharing Clone',
    subtitle: 'Multi-service transportation platform offering ride booking and delivery services.',
    category: 'Transport', description: 'Multi-service transportation platform offering ride booking and delivery services.',
    features: ['Ride Booking', 'GPS Tracking', 'Driver System', 'Payments & Wallet', 'Trip History'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/grab-ride-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'grab-ride-clone-software',
  },
];

export function TransportationSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['transport', 'taxi', 'ride', 'fleet', 'logistics']);
  const generatedProducts = fillToTarget(dbProducts as any, 'transport', 'Transport', 45);
  const displayProducts = [...TOP_5_TRANSPORT_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🚗"
        title="Transportation & Ride Sharing Apps"
        subtitle="Taxi, Fleet, Ride-Hailing & Logistics solutions."
        badge="TRENDING"
        badgeVariant="trending"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Transportation" />}
      </SectionSlider>
    </section>
  );
}
