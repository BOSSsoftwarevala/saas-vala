import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_ANALYTICS_CLONES = [
  {
    id: 'analytics-clone-1', title: 'Google Analytics Dashboard Clone',
    subtitle: 'Web analytics platform used for tracking and analyzing website traffic.',
    category: 'Analytics', description: 'Web analytics platform used for tracking and analyzing website traffic.',
    features: ['Traffic Analytics', 'Real-Time Visitors', 'Data Dashboards', 'Conversion Tracking', 'User Behavior Reports'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/google-analytics-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'google-analytics-clone-software',
  },
  {
    id: 'analytics-clone-2', title: 'Tableau BI Dashboard Clone',
    subtitle: 'Powerful business intelligence platform for visualizing and analyzing data.',
    category: 'Analytics', description: 'Powerful business intelligence platform for visualizing and analyzing data.',
    features: ['Data Visualization', 'Custom Dashboards', 'Interactive Charts', 'Data Filters', 'Analytics Reports'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/tableau-bi-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'tableau-bi-clone-software',
  },
  {
    id: 'analytics-clone-3', title: 'Power BI Analytics Clone',
    subtitle: 'Business analytics platform used to create reports and dashboards.',
    category: 'Analytics', description: 'Business analytics platform used to create reports and dashboards.',
    features: ['Data Dashboards', 'Visual Reports', 'Data Integration', 'Real-Time Metrics', 'Business Insights'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/powerbi-analytics-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'powerbi-analytics-clone-software',
  },
  {
    id: 'analytics-clone-4', title: 'Mixpanel Product Analytics Clone',
    subtitle: 'Product analytics platform for tracking user interactions and behaviors.',
    category: 'Analytics', description: 'Product analytics platform for tracking user interactions and behaviors.',
    features: ['Event Tracking', 'Funnel Analysis', 'Retention Metrics', 'User Segmentation', 'Analytics Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/mixpanel-analytics-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'mixpanel-analytics-clone-software',
  },
  {
    id: 'analytics-clone-5', title: 'Metabase Analytics Platform Clone',
    subtitle: 'Open-source business intelligence tool for querying and visualizing data.',
    category: 'Analytics', description: 'Open-source business intelligence tool for querying and visualizing data.',
    features: ['SQL Query Builder', 'Data Dashboards', 'Visual Charts', 'Data Export', 'Team Reporting'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/metabase-analytics-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'metabase-analytics-clone-software',
  },
];

export function DataAnalyticsSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['analytics', 'bi', 'dashboard', 'reporting', 'data']);
  const generatedProducts = fillToTarget(dbProducts as any, 'analytics', 'Analytics', 45);
  const displayProducts = [...TOP_5_ANALYTICS_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="📊"
        title="Data Analytics & Business Intelligence"
        subtitle="Dashboards, BI Tools, Reporting & Data Visualization."
        badge="INSIGHTS"
        badgeVariant="trending"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Analytics" />}
      </SectionSlider>
    </section>
  );
}
