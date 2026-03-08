import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_RETAIL_CLONES = [
  {
    id: 'retail-clone-1', title: 'Square POS Clone',
    subtitle: 'Modern cloud-based POS system used by retail stores and restaurants.',
    category: 'Retail', description: 'Modern cloud-based POS system used by retail stores and restaurants.',
    features: ['POS Billing', 'Inventory Management', 'Sales Reports', 'Payment Integration', 'Customer Profiles', 'Receipt System'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/square-pos-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'square-pos-clone-software',
  },
  {
    id: 'retail-clone-2', title: 'Shopify POS Clone',
    subtitle: 'Retail POS system integrated with e-commerce store management.',
    category: 'Retail', description: 'Retail POS system integrated with e-commerce store management.',
    features: ['POS Checkout', 'Product Inventory', 'Store Analytics', 'Staff Management', 'Customer Profiles'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/shopify-pos-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'shopify-pos-clone-software',
  },
  {
    id: 'retail-clone-3', title: 'Lightspeed Retail Clone',
    subtitle: 'Advanced retail POS platform designed for growing businesses.',
    category: 'Retail', description: 'Advanced retail POS platform designed for growing businesses.',
    features: ['Multi-Store Management', 'Inventory Tracking', 'Supplier Orders', 'Retail Analytics', 'Customer Loyalty System'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/lightspeed-retail-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'lightspeed-retail-clone-software',
  },
  {
    id: 'retail-clone-4', title: 'Vend POS Clone',
    subtitle: 'Cloud-based POS platform for retail stores and franchises.',
    category: 'Retail', description: 'Cloud-based POS platform for retail stores and franchises.',
    features: ['POS Billing', 'Inventory Control', 'Barcode System', 'Staff Management', 'Sales Analytics'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/vend-pos-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'vend-pos-clone-software',
  },
  {
    id: 'retail-clone-5', title: 'Loyverse POS Clone',
    subtitle: 'Free POS system used by small retail businesses worldwide.',
    category: 'Retail', description: 'Free POS system used by small retail businesses worldwide.',
    features: ['POS Billing', 'Inventory Tracking', 'Employee Management', 'Sales Dashboard', 'Customer Loyalty Program'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/loyverse-pos-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'loyverse-pos-clone-software',
  },
];

export function RetailSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['retail', 'pos', 'store', 'shop']);
  const generatedProducts = fillToTarget(dbProducts as any, 'retail', 'Retail', 45);
  const displayProducts = [...TOP_5_RETAIL_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🛒"
        title="Retail & POS Systems"
        subtitle="Point of Sale for every store type."
        badge="BESTSELLER"
        badgeVariant="trending"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Retail" />}
      </SectionSlider>
    </section>
  );
}
