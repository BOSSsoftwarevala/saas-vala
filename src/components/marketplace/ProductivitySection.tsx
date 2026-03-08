import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_PRODUCTIVITY_CLONES = [
  {
    id: 'prod-clone-1', title: 'Notion Workspace Clone',
    subtitle: 'All-in-one productivity workspace for notes, tasks, documents, and collaboration.',
    category: 'Productivity', description: 'All-in-one productivity workspace for notes, tasks, documents, and collaboration.',
    features: ['Notes Editor', 'Task Manager', 'Workspace Dashboard', 'Knowledge Base', 'Collaboration Tools'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/notion-workspace-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'notion-workspace-clone-software',
  },
  {
    id: 'prod-clone-2', title: 'Trello Project Board Clone',
    subtitle: 'Visual project management platform using boards, lists, and cards.',
    category: 'Productivity', description: 'Visual project management platform using boards, lists, and cards.',
    features: ['Kanban Boards', 'Task Cards', 'Drag & Drop Workflow', 'Team Collaboration', 'Project Tracking'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/trello-project-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'trello-project-clone-software',
  },
  {
    id: 'prod-clone-3', title: 'Asana Project Manager Clone',
    subtitle: 'Team project management platform for planning and tracking work.',
    category: 'Productivity', description: 'Team project management platform for planning and tracking work.',
    features: ['Task Assignment', 'Project Timelines', 'Team Collaboration', 'Workflow Tracking', 'Progress Analytics'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/asana-project-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'asana-project-clone-software',
  },
  {
    id: 'prod-clone-4', title: 'ClickUp Workspace Clone',
    subtitle: 'All-in-one productivity platform for tasks, docs, goals, and chat.',
    category: 'Productivity', description: 'All-in-one productivity platform for tasks, docs, goals, and chat.',
    features: ['Task Management', 'Document Editor', 'Goal Tracking', 'Team Collaboration', 'Workflow Automation'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/clickup-workspace-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'clickup-workspace-clone-software',
  },
  {
    id: 'prod-clone-5', title: 'Monday.com Work OS Clone',
    subtitle: 'Work operating system used to manage projects, teams, and workflows.',
    category: 'Productivity', description: 'Work operating system used to manage projects, teams, and workflows.',
    features: ['Workflow Builder', 'Project Boards', 'Automation Tools', 'Team Dashboard', 'Data Visualization'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/monday-workos-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'monday-workos-clone-software',
  },
];

export function ProductivitySection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['productivity', 'workspace', 'project', 'task', 'collaboration']);
  const generatedProducts = fillToTarget(dbProducts as any, 'it_software', 'Productivity', 45);
  const displayProducts = [...TOP_5_PRODUCTIVITY_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="📋"
        title="Productivity & Workspace Apps"
        subtitle="Task Management, Project Boards & Team Collaboration."
        badge="WORKSPACE"
        badgeVariant="top"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Productivity" />}
      </SectionSlider>
    </section>
  );
}
