import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_DESIGN_CLONES = [
  {
    id: 'design-clone-1', title: 'Canva Design Studio Clone',
    subtitle: 'Online graphic design platform with templates for social media, presentations, and marketing.',
    category: 'Design', description: 'Online graphic design platform with templates for social media, presentations, and marketing.',
    features: ['Design Templates', 'Drag & Drop Editor', 'Asset Library', 'Collaboration Tools', 'Export Tools'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/canva-design-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'canva-design-clone-software',
  },
  {
    id: 'design-clone-2', title: 'Figma Design Collaboration Clone',
    subtitle: 'Collaborative interface design platform used by product design teams.',
    category: 'Design', description: 'Collaborative interface design platform used by product design teams.',
    features: ['UI Design Editor', 'Real-Time Collaboration', 'Layer Editing', 'Design Components', 'Design Dashboard'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/figma-design-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'figma-design-clone-software',
  },
  {
    id: 'design-clone-3', title: 'Adobe XD Design Tool Clone',
    subtitle: 'UI/UX design and prototyping platform for digital products.',
    category: 'Design', description: 'UI/UX design and prototyping platform for digital products.',
    features: ['Interface Design', 'Prototype Builder', 'Design Components', 'Asset Library', 'Export Tools'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/adobexd-design-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'adobexd-design-clone-software',
  },
  {
    id: 'design-clone-4', title: 'Sketch UI Design Clone',
    subtitle: 'Vector-based UI design tool used for designing mobile and web interfaces.',
    category: 'Design', description: 'Vector-based UI design tool used for designing mobile and web interfaces.',
    features: ['Vector Design Tools', 'UI Components', 'Design Libraries', 'Layer Editing', 'Export Tools'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/sketch-ui-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'sketch-ui-clone-software',
  },
  {
    id: 'design-clone-5', title: 'Dribbble Creative Community Clone',
    subtitle: 'Creative community platform where designers share work and portfolios.',
    category: 'Design', description: 'Creative community platform where designers share work and portfolios.',
    features: ['Design Portfolio', 'Creative Gallery', 'User Profiles', 'Project Sharing', 'Design Community'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/dribbble-design-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'dribbble-design-clone-software',
  },
];

export function DesignCreativeSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['design', 'creative', 'graphic', 'ui', 'ux']);
  const generatedProducts = fillToTarget(dbProducts as any, 'design_creative', 'Design & Creative', 45);
  const displayProducts = [...TOP_5_DESIGN_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🎨"
        title="Design & Creative Tools"
        subtitle="Graphic Editors, Design Templates, Collaboration & Creative Workflows."
        badge="CREATIVE"
        badgeVariant="new"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Design & Creative" />}
      </SectionSlider>
    </section>
  );
}
