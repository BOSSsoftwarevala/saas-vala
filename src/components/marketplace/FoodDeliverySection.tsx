import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_FOOD_CLONES = [
  {
    id: 'food-clone-1', title: 'Uber Eats Clone',
    subtitle: 'Food delivery platform connecting restaurants, customers, and delivery partners.',
    category: 'Food', description: 'Food delivery platform connecting restaurants, customers, and delivery partners.',
    features: ['Restaurant Marketplace', 'Real-Time Delivery Tracking', 'Customer Ordering', 'Restaurant Dashboard', 'Delivery Partner App'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/ubereats-fooddelivery-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'ubereats-fooddelivery-clone-software',
  },
  {
    id: 'food-clone-2', title: 'Zomato Clone',
    subtitle: 'Restaurant discovery and food delivery platform.',
    category: 'Food', description: 'Restaurant discovery and food delivery platform.',
    features: ['Restaurant Listings', 'Online Food Ordering', 'Customer Reviews', 'Restaurant Profiles', 'Order Tracking'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/zomato-fooddelivery-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'zomato-fooddelivery-clone-software',
  },
  {
    id: 'food-clone-3', title: 'Swiggy Clone',
    subtitle: 'Food delivery and restaurant ordering platform with fast logistics.',
    category: 'Food', description: 'Food delivery and restaurant ordering platform with fast logistics.',
    features: ['Restaurant Marketplace', 'Order Management', 'Delivery Tracking', 'Restaurant Dashboard', 'Customer Wallet'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/swiggy-fooddelivery-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'swiggy-fooddelivery-clone-software',
  },
  {
    id: 'food-clone-4', title: 'DoorDash Clone',
    subtitle: 'Large-scale food delivery marketplace connecting restaurants and customers.',
    category: 'Food', description: 'Large-scale food delivery marketplace connecting restaurants and customers.',
    features: ['Food Ordering', 'Restaurant Dashboard', 'Delivery Partner System', 'Order Tracking', 'Payment Integration'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/doordash-fooddelivery-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'doordash-fooddelivery-clone-software',
  },
  {
    id: 'food-clone-5', title: 'Talabat Food Delivery Clone',
    subtitle: 'Online food ordering and restaurant marketplace platform.',
    category: 'Food', description: 'Online food ordering and restaurant marketplace platform.',
    features: ['Restaurant Listings', 'Online Ordering', 'Order Tracking', 'Restaurant Management', 'Customer Accounts'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/talabat-fooddelivery-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'talabat-fooddelivery-clone-software',
  },
];

export function FoodDeliverySection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['food', 'restaurant', 'delivery', 'catering']);
  const generatedProducts = fillToTarget(dbProducts as any, 'food', 'Food', 45);
  const displayProducts = [...TOP_5_FOOD_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🍽️"
        title="Food Delivery & Restaurant Systems"
        subtitle="Restaurant, Delivery, Catering & Cloud Kitchen solutions."
        badge="TRENDING"
        badgeVariant="trending"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Food Delivery" />}
      </SectionSlider>
    </section>
  );
}
