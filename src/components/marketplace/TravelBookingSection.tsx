import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_TRAVEL_CLONES = [
  {
    id: 'travel-clone-1', title: 'Booking.com Hotel Booking Clone',
    subtitle: 'Online travel platform for booking hotels, apartments, and vacation stays.',
    category: 'Travel', description: 'Online travel platform for booking hotels, apartments, and vacation stays.',
    features: ['Hotel Listings', 'Booking System', 'Guest Reviews', 'Map Search', 'Booking Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/booking-hotel-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'booking-hotel-clone-software',
  },
  {
    id: 'travel-clone-2', title: 'Expedia Travel Booking Clone',
    subtitle: 'Travel booking platform offering flights, hotels, and vacation packages.',
    category: 'Travel', description: 'Travel booking platform offering flights, hotels, and vacation packages.',
    features: ['Flight Search', 'Hotel Booking', 'Travel Packages', 'Booking Management', 'Travel Dashboard'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/expedia-travel-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'expedia-travel-clone-software',
  },
  {
    id: 'travel-clone-3', title: 'TripAdvisor Travel Reviews Clone',
    subtitle: 'Travel platform providing reviews for hotels, restaurants, and attractions.',
    category: 'Travel', description: 'Travel platform providing reviews for hotels, restaurants, and attractions.',
    features: ['Travel Reviews', 'Hotel Listings', 'Rating System', 'Travel Guides', 'User Profiles'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/tripadvisor-travel-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'tripadvisor-travel-clone-software',
  },
  {
    id: 'travel-clone-4', title: 'Airbnb Travel Marketplace Clone',
    subtitle: 'Global travel marketplace for booking unique stays and experiences.',
    category: 'Travel', description: 'Global travel marketplace for booking unique stays and experiences.',
    features: ['Property Listings', 'Booking System', 'Host Dashboard', 'Guest Reviews', 'Payment Integration'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/airbnb-travel-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'airbnb-travel-clone-software',
  },
  {
    id: 'travel-clone-5', title: 'MakeMyTrip Travel Booking Clone',
    subtitle: 'Indian travel booking platform for flights, hotels, and holiday packages.',
    category: 'Travel', description: 'Indian travel booking platform for flights, hotels, and holiday packages.',
    features: ['Flight Booking', 'Hotel Booking', 'Travel Packages', 'Booking Dashboard', 'Travel Deals'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/makemytrip-travel-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'makemytrip-travel-clone-software',
  },
];

export function TravelBookingSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['travel', 'booking', 'hotel', 'flight', 'tourism']);
  const generatedProducts = fillToTarget(dbProducts as any, 'travel_booking', 'Travel & Booking', 45);
  const displayProducts = [...TOP_5_TRAVEL_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="✈️"
        title="Travel & Booking Platforms"
        subtitle="Hotel Booking, Flight Search, Travel Packages & Booking Management."
        badge="TRAVEL"
        badgeVariant="trending"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Travel & Booking" />}
      </SectionSlider>
    </section>
  );
}
