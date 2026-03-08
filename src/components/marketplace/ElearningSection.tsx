import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_ELEARNING_CLONES = [
  {
    id: 'elearn-clone-1', title: 'Udemy Course Marketplace Clone',
    subtitle: 'Online learning marketplace where instructors publish and sell courses.',
    category: 'Education', description: 'Online learning marketplace where instructors publish and sell courses.',
    features: ['Course Marketplace', 'Video Lessons', 'Instructor Dashboard', 'Student Progress Tracking', 'Course Reviews'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/udemy-course-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'udemy-course-clone-software',
  },
  {
    id: 'elearn-clone-2', title: 'Coursera Learning Platform Clone',
    subtitle: 'Online education platform offering university-level courses.',
    category: 'Education', description: 'Online education platform offering university-level courses.',
    features: ['Course Library', 'Instructor Profiles', 'Certification System', 'Video Lectures', 'Learning Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/coursera-learning-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'coursera-learning-clone-software',
  },
  {
    id: 'elearn-clone-3', title: 'Skillshare Creative Learning Clone',
    subtitle: 'Online learning community for creative and professional skills.',
    category: 'Education', description: 'Online learning community for creative and professional skills.',
    features: ['Video Lessons', 'Community Projects', 'Instructor Tools', 'Course Library', 'Student Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/skillshare-learning-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'skillshare-learning-clone-software',
  },
  {
    id: 'elearn-clone-4', title: 'Teachable Course Platform Clone',
    subtitle: 'Platform allowing creators to build and sell online courses.',
    category: 'Education', description: 'Platform allowing creators to build and sell online courses.',
    features: ['Course Builder', 'Video Hosting', 'Student Enrollment', 'Payment Integration', 'Course Analytics'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/teachable-course-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'teachable-course-clone-software',
  },
  {
    id: 'elearn-clone-5', title: 'Khan Academy Learning Clone',
    subtitle: 'Educational platform offering free learning resources and courses.',
    category: 'Education', description: 'Educational platform offering free learning resources and courses.',
    features: ['Course Library', 'Learning Dashboard', 'Progress Tracking', 'Quizzes & Exercises', 'Student Profiles'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/khanacademy-learning-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'khanacademy-learning-clone-software',
  },
];

export function ElearningSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['elearning', 'lms', 'course', 'online_learning', 'edtech']);
  const generatedProducts = fillToTarget(dbProducts as any, 'education_lms', 'Education', 45);
  const displayProducts = [...TOP_5_ELEARNING_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🎓"
        title="Education & E-Learning Platforms"
        subtitle="LMS, Course Marketplaces & Online Learning solutions."
        badge="LEARNING"
        badgeVariant="new"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Education" />}
      </SectionSlider>
    </section>
  );
}
