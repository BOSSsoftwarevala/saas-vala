import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_REALESTATE_CLONES = [
  {
    id: 'realestate-clone-1', title: 'Zillow Property Marketplace Clone',
    subtitle: 'Real estate marketplace for buying, selling, and renting properties.',
    category: 'Real Estate', description: 'Real estate marketplace for buying, selling, and renting properties.',
    features: ['Property Listings', 'Map-Based Search', 'Agent Profiles', 'Property Photos', 'Price Estimates'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/zillow-property-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'zillow-property-clone-software',
  },
  {
    id: 'realestate-clone-2', title: 'Airbnb Property Rental Clone',
    subtitle: 'Vacation rental marketplace connecting hosts with travelers.',
    category: 'Real Estate', description: 'Vacation rental marketplace connecting hosts with travelers.',
    features: ['Property Listings', 'Booking System', 'Host Dashboard', 'Guest Reviews', 'Payment Integration'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/airbnb-property-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'airbnb-property-clone-software',
  },
  {
    id: 'realestate-clone-3', title: '99acres Property Portal Clone',
    subtitle: 'Online real estate portal for buying and renting properties.',
    category: 'Real Estate', description: 'Online real estate portal for buying and renting properties.',
    features: ['Property Listings', 'Advanced Search Filters', 'Agent Profiles', 'Property Images', 'Lead Management'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/99acres-property-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: '99acres-property-clone-software',
  },
  {
    id: 'realestate-clone-4', title: 'MagicBricks Property Marketplace Clone',
    subtitle: 'Indian real estate platform for buying, selling, and renting homes.',
    category: 'Real Estate', description: 'Indian real estate platform for buying, selling, and renting homes.',
    features: ['Property Listings', 'Map Search', 'Property Alerts', 'Agent Dashboard', 'Property Comparison'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/magicbricks-property-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'magicbricks-property-clone-software',
  },
  {
    id: 'realestate-clone-5', title: 'Realtor.com Property Platform Clone',
    subtitle: 'Real estate marketplace providing property listings and market insights.',
    category: 'Real Estate', description: 'Real estate marketplace providing property listings and market insights.',
    features: ['Property Listings', 'Market Insights', 'Agent Profiles', 'Property Photos', 'Contact Agents'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/realtor-property-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'realtor-property-clone-software',
  },
];

export function RealEstateMarketplaceSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['property', 'rental', 'real_estate', 'housing', 'realty']);
  const generatedProducts = fillToTarget(dbProducts as any, 'real_estate_mp', 'Real Estate', 45);
  const displayProducts = [...TOP_5_REALESTATE_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🏘️"
        title="Real Estate & Property Marketplaces"
        subtitle="Property Listings, Rental Platforms & Agent Management."
        badge="PROPERTY"
        badgeVariant="hot"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Real Estate" />}
      </SectionSlider>
    </section>
  );
}
