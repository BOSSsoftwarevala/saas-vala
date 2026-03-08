import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_HOTEL_CLONES = [
  {
    id: 'hotel-clone-1', title: 'Booking.com Clone',
    subtitle: 'Global hotel booking platform for travelers to reserve accommodations.',
    category: 'Hospitality', description: 'Global hotel booking platform for travelers to reserve accommodations.',
    features: ['Hotel Listings', 'Room Booking System', 'Availability Calendar', 'Guest Reviews', 'Payment Gateway'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/booking-hotel-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'booking-hotel-clone-software',
  },
  {
    id: 'hotel-clone-2', title: 'Airbnb Rental Clone',
    subtitle: 'Vacation rental marketplace connecting property owners and travelers.',
    category: 'Hospitality', description: 'Vacation rental marketplace connecting property owners and travelers.',
    features: ['Property Listings', 'Host Dashboard', 'Booking Requests', 'Guest Messaging', 'Secure Payments'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/airbnb-rental-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'airbnb-rental-clone-software',
  },
  {
    id: 'hotel-clone-3', title: 'Agoda Hotel Clone',
    subtitle: 'Online travel booking platform focused on hotels and resorts.',
    category: 'Hospitality', description: 'Online travel booking platform focused on hotels and resorts.',
    features: ['Hotel Listings', 'Price Comparison', 'Booking System', 'User Reviews', 'Travel Deals'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/agoda-hotel-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'agoda-hotel-clone-software',
  },
  {
    id: 'hotel-clone-4', title: 'OYO Rooms Clone',
    subtitle: 'Hotel franchise booking platform for affordable stays.',
    category: 'Hospitality', description: 'Hotel franchise booking platform for affordable stays.',
    features: ['Hotel Listings', 'Instant Room Booking', 'Hotel Owner Dashboard', 'Booking Management', 'Payment System'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/oyo-hotel-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'oyo-hotel-clone-software',
  },
  {
    id: 'hotel-clone-5', title: 'Expedia Travel Clone',
    subtitle: 'Travel booking platform for hotels, flights, and vacation packages.',
    category: 'Hospitality', description: 'Travel booking platform for hotels, flights, and vacation packages.',
    features: ['Hotel Booking', 'Travel Packages', 'Booking Management', 'Payment Integration', 'User Reviews'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/expedia-travel-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'expedia-travel-clone-software',
  },
];

export function HospitalitySection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['hotel', 'resort', 'hospitality', 'pms', 'tourism']);
  const generatedProducts = fillToTarget(dbProducts as any, 'hotel', 'Hospitality', 45);
  const displayProducts = [...TOP_5_HOTEL_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🏨"
        title="Hospitality & Hotel Booking Systems"
        subtitle="PMS, Booking, Revenue & Guest Management."
        badge="PREMIUM"
        badgeVariant="new"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Hospitality" />}
      </SectionSlider>
    </section>
  );
}
