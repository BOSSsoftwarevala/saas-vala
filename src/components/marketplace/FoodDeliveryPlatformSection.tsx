import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_FOOD_DELIVERY_CLONES = [
  {
    id: 'food-del-clone-1', title: 'Uber Eats Food Delivery Clone',
    subtitle: 'Food delivery platform connecting restaurants with customers.',
    category: 'Food Delivery', description: 'Food delivery platform connecting restaurants with customers.',
    features: ['Restaurant Listings', 'Menu Management', 'Food Ordering', 'Delivery Tracking', 'Payment Integration'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/ubereats-delivery-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'ubereats-delivery-clone-software',
  },
  {
    id: 'food-del-clone-2', title: 'DoorDash Food Delivery Clone',
    subtitle: 'On-demand food delivery platform with driver and restaurant management.',
    category: 'Food Delivery', description: 'On-demand food delivery platform with driver and restaurant management.',
    features: ['Food Ordering', 'Delivery Tracking', 'Driver Dashboard', 'Restaurant Panel', 'Order Management'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/doordash-food-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'doordash-food-clone-software',
  },
  {
    id: 'food-del-clone-3', title: 'Zomato Restaurant Platform Clone',
    subtitle: 'Restaurant discovery and food delivery platform with reviews.',
    category: 'Food Delivery', description: 'Restaurant discovery and food delivery platform with reviews.',
    features: ['Restaurant Listings', 'Menu Display', 'Customer Reviews', 'Table Booking', 'Order Management'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/zomato-restaurant-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'zomato-restaurant-clone-software',
  },
  {
    id: 'food-del-clone-4', title: 'Swiggy Food Delivery Clone',
    subtitle: 'Indian food delivery platform connecting users with nearby restaurants.',
    category: 'Food Delivery', description: 'Indian food delivery platform connecting users with nearby restaurants.',
    features: ['Food Ordering', 'Real-Time Delivery Tracking', 'Restaurant Dashboard', 'Payment Integration', 'Customer Notifications'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/swiggy-delivery-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'swiggy-delivery-clone-software',
  },
  {
    id: 'food-del-clone-5', title: 'Grubhub Food Delivery Clone',
    subtitle: 'Online food ordering and delivery marketplace for restaurants.',
    category: 'Food Delivery', description: 'Online food ordering and delivery marketplace for restaurants.',
    features: ['Restaurant Listings', 'Food Ordering', 'Delivery Tracking', 'Payment System', 'Customer Reviews'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/grubhub-delivery-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'grubhub-delivery-clone-software',
  },
];

export function FoodDeliveryPlatformSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['food_delivery', 'restaurant_delivery', 'ordering', 'meal']);
  const generatedProducts = fillToTarget(dbProducts as any, 'food_delivery_platform', 'Food Delivery', 45);
  const displayProducts = [...TOP_5_FOOD_DELIVERY_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🍕"
        title="Food Delivery & Restaurant Platforms"
        subtitle="Restaurant Listings, Food Ordering, Delivery Tracking & Payment Integration."
        badge="FOOD"
        badgeVariant="hot"
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
