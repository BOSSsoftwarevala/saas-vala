import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_EDTECH_CLONES = [
  {
    id: 'edtech-clone-1', title: 'Udemy Course Marketplace Clone',
    subtitle: 'Online course marketplace for instructors to sell courses and students to learn.',
    category: 'Education', description: 'Online course marketplace for instructors to sell courses and students to learn.',
    features: ['Course Marketplace', 'Video Lessons', 'Instructor Dashboard', 'Student Progress Tracking', 'Course Reviews'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/udemy-course-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'udemy-course-clone-software',
  },
  {
    id: 'edtech-clone-2', title: 'Coursera Online Learning Clone',
    subtitle: 'Online learning platform offering courses from universities and instructors.',
    category: 'Education', description: 'Online learning platform offering courses from universities and instructors.',
    features: ['Course Catalog', 'Video Lectures', 'Certificates', 'Student Dashboard', 'Learning Progress'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/coursera-elearning-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'coursera-elearning-clone-software',
  },
  {
    id: 'edtech-clone-3', title: 'Skillshare Learning Platform Clone',
    subtitle: 'Creative learning platform offering video classes across multiple categories.',
    category: 'Education', description: 'Creative learning platform offering video classes across multiple categories.',
    features: ['Course Marketplace', 'Video Lessons', 'Instructor Panel', 'Student Dashboard', 'Course Reviews'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/skillshare-elearning-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'skillshare-elearning-clone-software',
  },
  {
    id: 'edtech-clone-4', title: 'Teachable Course Platform Clone',
    subtitle: 'Platform enabling creators to build and sell online courses.',
    category: 'Education', description: 'Platform enabling creators to build and sell online courses.',
    features: ['Course Builder', 'Student Management', 'Payment Integration', 'Course Dashboard', 'Certificates'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/teachable-course-platform-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'teachable-course-platform-clone-software',
  },
  {
    id: 'edtech-clone-5', title: 'Khan Academy Learning Platform Clone',
    subtitle: 'Educational learning platform offering free courses and interactive lessons.',
    category: 'Education', description: 'Educational learning platform offering free courses and interactive lessons.',
    features: ['Course Library', 'Video Lessons', 'Student Progress Tracking', 'Learning Dashboard', 'Quiz System'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/khanacademy-learning-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'khanacademy-learning-clone-software',
  },
];

export function EducationElearningSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['elearning', 'lms', 'course', 'edtech', 'online_learning']);
  const generatedProducts = fillToTarget(dbProducts as any, 'education_elearning', 'Education & E-Learning', 45);
  const displayProducts = [...TOP_5_EDTECH_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🎓"
        title="Education & E-Learning Platforms"
        subtitle="Course Marketplace, Video Lessons, Certificates & Student Progress Tracking."
        badge="EDTECH"
        badgeVariant="new"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Education & E-Learning" />}
      </SectionSlider>
    </section>
  );
}
