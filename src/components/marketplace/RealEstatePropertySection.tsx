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
    features: ['Property Listings', 'Advanced Property Search', 'Agent Profiles', 'Map Integration', 'Property Inquiry System'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/zillow-property-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'zillow-property-clone-software',
  },
  {
    id: 'realestate-clone-2', title: 'Realtor.com Property Listing Clone',
    subtitle: 'Property listing platform helping buyers and sellers connect with agents.',
    category: 'Real Estate', description: 'Property listing platform helping buyers and sellers connect with agents.',
    features: ['Property Listings', 'Agent Profiles', 'Property Search', 'Inquiry Management', 'Listing Dashboard'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/realtor-property-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'realtor-property-clone-software',
  },
  {
    id: 'realestate-clone-3', title: 'MagicBricks Real Estate Clone',
    subtitle: 'Indian property marketplace for residential and commercial properties.',
    category: 'Real Estate', description: 'Indian property marketplace for residential and commercial properties.',
    features: ['Property Listings', 'Property Search', 'Agent Dashboard', 'Property Inquiry', 'Map Integration'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/magicbricks-realestate-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'magicbricks-realestate-clone-software',
  },
  {
    id: 'realestate-clone-4', title: '99acres Property Marketplace Clone',
    subtitle: 'Online property marketplace connecting buyers, sellers, and agents.',
    category: 'Real Estate', description: 'Online property marketplace connecting buyers, sellers, and agents.',
    features: ['Property Listings', 'Property Filters', 'Agent Profiles', 'Inquiry System', 'Listing Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/99acres-property-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: '99acres-property-clone-software',
  },
  {
    id: 'realestate-clone-5', title: 'Redfin Real Estate Platform Clone',
    subtitle: 'Real estate platform providing home listings, tours, and agent services.',
    category: 'Real Estate', description: 'Real estate platform providing home listings, tours, and agent services.',
    features: ['Property Listings', 'Virtual Tours', 'Map Integration', 'Agent Profiles', 'Inquiry Management'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/redfin-realestate-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'redfin-realestate-clone-software',
  },
];

export function RealEstatePropertySection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['real_estate', 'property', 'housing', 'rental', 'realty']);
  const generatedProducts = fillToTarget(dbProducts as any, 'real_estate_property', 'Real Estate & Property', 45);
  const displayProducts = [...TOP_5_REALESTATE_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🏠"
        title="Real Estate & Property Platforms"
        subtitle="Property Listings, Advanced Search, Agent Profiles & Virtual Tours."
        badge="PROPERTY"
        badgeVariant="trending"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Real Estate & Property" />}
      </SectionSlider>
    </section>
  );
}
