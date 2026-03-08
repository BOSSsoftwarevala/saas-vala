import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_DEVTOOLS_CLONES = [
  {
    id: 'devtools-clone-1', title: 'GitHub Developer Platform Clone',
    subtitle: 'Collaborative code hosting platform with repositories, pull requests, and issues.',
    category: 'Developer Tools', description: 'Collaborative code hosting platform with repositories, pull requests, and issues.',
    features: ['Git Repository Hosting', 'Pull Requests', 'Code Reviews', 'Issue Tracking', 'Project Boards'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/github-dev-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'github-dev-clone-software',
  },
  {
    id: 'devtools-clone-2', title: 'GitLab DevOps Platform Clone',
    subtitle: 'Complete DevOps lifecycle platform for source control, CI/CD, and monitoring.',
    category: 'Developer Tools', description: 'Complete DevOps lifecycle platform for source control, CI/CD, and monitoring.',
    features: ['Git Repositories', 'CI/CD Pipelines', 'DevOps Automation', 'Issue Tracking', 'Deployment Tools'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/gitlab-devops-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'gitlab-devops-clone-software',
  },
  {
    id: 'devtools-clone-3', title: 'Bitbucket Code Repository Clone',
    subtitle: 'Git repository hosting platform designed for professional teams.',
    category: 'Developer Tools', description: 'Git repository hosting platform designed for professional teams.',
    features: ['Git Repository Hosting', 'Pull Requests', 'Code Reviews', 'Access Control', 'Team Collaboration'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/bitbucket-dev-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'bitbucket-dev-clone-software',
  },
  {
    id: 'devtools-clone-4', title: 'Jenkins CI/CD Automation Clone',
    subtitle: 'Automation server used for building, testing, and deploying software.',
    category: 'Developer Tools', description: 'Automation server used for building, testing, and deploying software.',
    features: ['CI/CD Pipelines', 'Build Automation', 'Plugin System', 'Deployment Workflows', 'Developer Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/jenkins-cicd-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'jenkins-cicd-clone-software',
  },
  {
    id: 'devtools-clone-5', title: 'Docker Container Platform Clone',
    subtitle: 'Platform for building, shipping, and running containerized applications.',
    category: 'Developer Tools', description: 'Platform for building, shipping, and running containerized applications.',
    features: ['Container Management', 'Image Repository', 'Deployment Tools', 'Container Monitoring', 'DevOps Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/docker-container-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'docker-container-clone-software',
  },
];

export function DevToolsSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['devops', 'developer', 'cicd', 'docker', 'kubernetes', 'cloud']);
  const generatedProducts = fillToTarget(dbProducts as any, 'cloud_devops', 'Developer Tools', 45);
  const displayProducts = [...TOP_5_DEVTOOLS_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="💻"
        title="Developer Tools & DevOps Platforms"
        subtitle="Code Hosting, CI/CD, Containers & DevOps Automation."
        badge="DEVOPS"
        badgeVariant="live"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Developer Tools" />}
      </SectionSlider>
    </section>
  );
}
