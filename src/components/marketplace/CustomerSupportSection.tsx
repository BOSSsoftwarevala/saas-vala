import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_SUPPORT_CLONES = [
  {
    id: 'support-clone-1', title: 'Zendesk Help Desk Clone',
    subtitle: 'Customer support platform providing ticketing, live chat, and help desk tools.',
    category: 'Customer Support', description: 'Customer support platform providing ticketing, live chat, and help desk tools.',
    features: ['Ticket Management', 'Customer Inbox', 'Live Chat Support', 'Knowledge Base', 'Automation Rules'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/zendesk-helpdesk-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'zendesk-helpdesk-clone-software',
  },
  {
    id: 'support-clone-2', title: 'Freshdesk Support Platform Clone',
    subtitle: 'Customer support software designed for managing help desk tickets.',
    category: 'Customer Support', description: 'Customer support software designed for managing help desk tickets.',
    features: ['Ticketing System', 'Customer Support Inbox', 'Knowledge Base', 'Automation Workflows', 'Support Analytics'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/freshdesk-support-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'freshdesk-support-clone-software',
  },
  {
    id: 'support-clone-3', title: 'Intercom Customer Messaging Clone',
    subtitle: 'Customer messaging platform with chat support and engagement tools.',
    category: 'Customer Support', description: 'Customer messaging platform with chat support and engagement tools.',
    features: ['Live Chat', 'Customer Messaging', 'Support Inbox', 'Automation Bots', 'Customer Profiles'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/intercom-support-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'intercom-support-clone-software',
  },
  {
    id: 'support-clone-4', title: 'Help Scout Support Platform Clone',
    subtitle: 'Help desk software designed for managing customer communication.',
    category: 'Customer Support', description: 'Help desk software designed for managing customer communication.',
    features: ['Shared Inbox', 'Ticket System', 'Customer Profiles', 'Knowledge Base', 'Customer Feedback'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/helpscout-support-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'helpscout-support-clone-software',
  },
  {
    id: 'support-clone-5', title: 'LiveAgent Help Desk Clone',
    subtitle: 'Multi-channel customer support platform with ticketing and live chat.',
    category: 'Customer Support', description: 'Multi-channel customer support platform with ticketing and live chat.',
    features: ['Ticket Management', 'Live Chat Support', 'Knowledge Base', 'Support Automation', 'Customer Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/liveagent-helpdesk-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'liveagent-helpdesk-clone-software',
  },
];

export function CustomerSupportSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['helpdesk', 'support', 'ticketing', 'live_chat', 'customer']);
  const generatedProducts = fillToTarget(dbProducts as any, 'customer_support', 'Customer Support', 45);
  const displayProducts = [...TOP_5_SUPPORT_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🎧"
        title="Customer Support & Help Desk Platforms"
        subtitle="Ticketing, Live Chat, Knowledge Base & Support Automation."
        badge="SUPPORT"
        badgeVariant="live"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Customer Support" />}
      </SectionSlider>
    </section>
  );
}
