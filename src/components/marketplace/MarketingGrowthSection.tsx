import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_MARKETING_CLONES = [
  {
    id: 'mktg-clone-1', title: 'Mailchimp Marketing Automation Clone',
    subtitle: 'Email marketing automation platform used to manage campaigns and audiences.',
    category: 'Marketing', description: 'Email marketing automation platform used to manage campaigns and audiences.',
    features: ['Email Campaign Builder', 'Marketing Automation', 'Audience Segmentation', 'Campaign Analytics', 'A/B Testing'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/mailchimp-marketing-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'mailchimp-marketing-clone-software',
  },
  {
    id: 'mktg-clone-2', title: 'HubSpot Marketing Platform Clone',
    subtitle: 'All-in-one marketing platform with CRM, email campaigns, and analytics.',
    category: 'Marketing', description: 'All-in-one marketing platform with CRM, email campaigns, and analytics.',
    features: ['CRM Integration', 'Email Marketing', 'Lead Management', 'Marketing Analytics', 'Campaign Automation'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/hubspot-marketing-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'hubspot-marketing-clone-software',
  },
  {
    id: 'mktg-clone-3', title: 'ActiveCampaign Automation Clone',
    subtitle: 'Customer experience automation platform for email marketing and sales.',
    category: 'Marketing', description: 'Customer experience automation platform for email marketing and sales.',
    features: ['Marketing Automation', 'Email Campaigns', 'Contact Management', 'Sales Automation', 'Customer Segmentation'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/activecampaign-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'activecampaign-clone-software',
  },
  {
    id: 'mktg-clone-4', title: 'Klaviyo Marketing Automation Clone',
    subtitle: 'E-commerce marketing automation platform for email and SMS campaigns.',
    category: 'Marketing', description: 'E-commerce marketing automation platform for email and SMS campaigns.',
    features: ['Email & SMS Campaigns', 'Audience Segmentation', 'Campaign Analytics', 'Automation Flows', 'Marketing Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/klaviyo-marketing-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'klaviyo-marketing-clone-software',
  },
  {
    id: 'mktg-clone-5', title: 'Marketo Marketing Platform Clone',
    subtitle: 'Enterprise marketing automation platform for lead nurturing and campaigns.',
    category: 'Marketing', description: 'Enterprise marketing automation platform for lead nurturing and campaigns.',
    features: ['Lead Management', 'Campaign Automation', 'Marketing Analytics', 'CRM Integration', 'Email Campaign Builder'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/marketo-marketing-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'marketo-marketing-clone-software',
  },
];

export function MarketingGrowthSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['marketing', 'email', 'campaign', 'branding', 'advertising']);
  const generatedProducts = fillToTarget(dbProducts as any, 'marketing_growth', 'Marketing', 45);
  const displayProducts = [...TOP_5_MARKETING_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="📣"
        title="Marketing & Growth Tools"
        subtitle="Email Marketing, CRM, Campaigns & Growth Automation."
        badge="GROWTH"
        badgeVariant="trending"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Marketing" />}
      </SectionSlider>
    </section>
  );
}
