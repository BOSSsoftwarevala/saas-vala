import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_ECOMMERCE_CLONES = [
  {
    id: 'ecom-clone-1', title: 'Amazon Marketplace Clone',
    subtitle: 'Multi-vendor e-commerce platform where sellers list products and buyers purchase online.',
    category: 'E-Commerce', description: 'Multi-vendor e-commerce platform where sellers list products and buyers purchase online.',
    features: ['Multi-Vendor Marketplace', 'Product Catalog', 'Order Tracking', 'Seller Dashboard', 'Product Reviews', 'Recommendation Engine'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/amazon-marketplace-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'amazon-marketplace-clone-software',
  },
  {
    id: 'ecom-clone-2', title: 'Shopify Store Clone',
    subtitle: 'Online store builder platform allowing businesses to create and manage e-commerce shops.',
    category: 'E-Commerce', description: 'Online store builder platform allowing businesses to create and manage e-commerce shops.',
    features: ['Store Builder', 'Product Management', 'Payment Gateway Integration', 'Store Analytics', 'Inventory System'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/shopify-store-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'shopify-store-clone-software',
  },
  {
    id: 'ecom-clone-3', title: 'Flipkart Marketplace Clone',
    subtitle: 'Large-scale e-commerce marketplace supporting sellers and buyers.',
    category: 'E-Commerce', description: 'Large-scale e-commerce marketplace supporting sellers and buyers.',
    features: ['Seller Dashboard', 'Product Listings', 'Order Processing', 'Product Reviews', 'Delivery Tracking'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/flipkart-marketplace-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'flipkart-marketplace-clone-software',
  },
  {
    id: 'ecom-clone-4', title: 'eBay Marketplace Clone',
    subtitle: 'Auction-based and fixed-price online marketplace platform.',
    category: 'E-Commerce', description: 'Auction-based and fixed-price online marketplace platform.',
    features: ['Auction Listings', 'Bidding System', 'Seller Profiles', 'Payment Processing', 'Product Ratings'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/ebay-marketplace-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'ebay-marketplace-clone-software',
  },
  {
    id: 'ecom-clone-5', title: 'Alibaba B2B Marketplace Clone',
    subtitle: 'B2B marketplace platform connecting wholesalers and global buyers.',
    category: 'E-Commerce', description: 'B2B marketplace platform connecting wholesalers and global buyers.',
    features: ['Supplier Listings', 'Bulk Order System', 'Trade Assurance', 'RFQ System', 'Supplier Verification'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/alibaba-b2b-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'alibaba-b2b-clone-software',
  },
];

export function EcommerceSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['ecommerce', 'marketplace', 'vendor', 'commerce']);
  const generatedProducts = fillToTarget(dbProducts as any, 'ecommerce', 'E-Commerce', 45);
  const displayProducts = [...TOP_5_ECOMMERCE_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🛍️"
        title="E-Commerce & Online Marketplaces"
        subtitle="Multi Vendor, B2B, Dropshipping & Social Commerce."
        badge="MEGA"
        badgeVariant="hot"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="E-Commerce" />}
      </SectionSlider>
    </section>
  );
}
