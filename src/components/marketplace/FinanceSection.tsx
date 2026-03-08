import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_FINTECH_CLONES = [
  {
    id: 'fintech-clone-1', title: 'PayPal Digital Wallet Clone',
    subtitle: 'Online payment system allowing users to send and receive digital payments.',
    category: 'Finance', description: 'Online payment system allowing users to send and receive digital payments.',
    features: ['Digital Wallet', 'Send & Receive Payments', 'Transaction History', 'User Accounts', 'Payment Security'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/paypal-wallet-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'paypal-wallet-clone-software',
  },
  {
    id: 'fintech-clone-2', title: 'Stripe Payment Platform Clone',
    subtitle: 'Payment processing platform for online businesses.',
    category: 'Finance', description: 'Payment processing platform for online businesses.',
    features: ['Payment Gateway', 'Subscription Billing', 'Transaction Analytics', 'Fraud Protection', 'Developer APIs'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/stripe-payment-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'stripe-payment-clone-software',
  },
  {
    id: 'fintech-clone-3', title: 'Wise (TransferWise) Clone',
    subtitle: 'Global money transfer platform with low transaction fees.',
    category: 'Finance', description: 'Global money transfer platform with low transaction fees.',
    features: ['International Transfers', 'Currency Conversion', 'Payment Tracking', 'User Wallet', 'Transaction History'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/wise-money-transfer-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'wise-money-transfer-clone-software',
  },
  {
    id: 'fintech-clone-4', title: 'Revolut Digital Bank Clone',
    subtitle: 'Digital banking platform offering accounts, cards, and payments.',
    category: 'Finance', description: 'Digital banking platform offering accounts, cards, and payments.',
    features: ['Digital Bank Accounts', 'Card Payments', 'Budget Analytics', 'Money Transfers', 'Security Controls'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/revolut-bank-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'revolut-bank-clone-software',
  },
  {
    id: 'fintech-clone-5', title: 'Cash App Clone',
    subtitle: 'Mobile payment platform for sending money and managing digital wallets.',
    category: 'Finance', description: 'Mobile payment platform for sending money and managing digital wallets.',
    features: ['Peer-to-Peer Payments', 'Wallet Balance', 'Transaction History', 'QR Code Payments', 'Payment Notifications'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/cashapp-wallet-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'cashapp-wallet-clone-software',
  },
];

export function FinanceSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['finance', 'banking', 'fintech', 'payment', 'wallet']);
  const generatedProducts = fillToTarget(dbProducts as any, 'finance', 'Finance', 45);
  const displayProducts = [...TOP_5_FINTECH_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="💰"
        title="Finance & FinTech Platforms"
        subtitle="Digital Banking, Payments, Wallets & Investment."
        badge="TOP RATED"
        badgeVariant="top"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Finance" />}
      </SectionSlider>
    </section>
  );
}
