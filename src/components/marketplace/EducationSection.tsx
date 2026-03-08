import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { Badge } from '@/components/ui/badge';
import { GraduationCap } from 'lucide-react';

const subCats = ['All', 'School', 'College', 'Coaching', 'E-Learning', 'Skill Training', 'University', 'Library', 'Examination'];

// Top 5 Education Software Clones — Row 05 featured products
const TOP_5_EDUCATION_CLONES = [
  {
    id: 'edu-clone-1',
    title: 'School Management Software',
    subtitle: 'Comprehensive school management system — real SaaS Vala product.',
    category: 'Education',
    description: 'A comprehensive school management software with student records, attendance, timetable, and fee management.',
    features: ['Student Records', 'Attendance System', 'Timetable Manager', 'Fee Management', 'Teacher Dashboard', 'Report Cards'],
    techStack: ['React', 'Node.js', 'PostgreSQL', 'JWT Auth'],
    github_repo: 'https://github.com/saasvala/schoolmanagementsoftware',
    demoUrl: 'https://schoolmanagementsoftware.vercel.app',
    price: 5,
    old_price: 10,
    rating: 4.9,
    isAvailable: true,
    status: 'active',
    slug: 'schoolmanagementsoftware',
  },
  {
    id: 'edu-clone-2',
    title: 'Moodle LMS Clone',
    subtitle: 'Open-source learning management system for schools and universities.',
    category: 'Education',
    description: 'Open-source learning management system for schools and universities.',
    features: ['Course Builder', 'Quiz System', 'Certificates', 'Student Progress Tracking', 'Teacher Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/moodle-lms-clone-software',
    price: 5,
    old_price: 10,
    rating: 4.9,
    isAvailable: true,
    status: 'active',
    slug: 'moodle-lms-clone-software',
  },
  {
    id: 'edu-clone-3',
    title: 'Canvas LMS Clone',
    subtitle: 'Modern LMS used by universities for course delivery and grading.',
    category: 'Education',
    description: 'Modern LMS used by universities for course delivery and grading.',
    features: ['Course Modules', 'Assignments', 'Discussion Boards', 'Grade Analytics', 'Mobile Learning'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/canvas-lms-clone-software',
    price: 5,
    old_price: 10,
    rating: 4.9,
    isAvailable: true,
    status: 'active',
    slug: 'canvas-lms-clone-software',
  },
  {
    id: 'edu-clone-4',
    title: 'Blackboard Learn Clone',
    subtitle: 'Enterprise education system for universities and online learning.',
    category: 'Education',
    description: 'Enterprise education system for universities and online learning.',
    features: ['Virtual Classroom', 'Content Library', 'Exams & Assessments', 'Instructor Tools', 'Student Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/blackboard-learn-clone-software',
    price: 5,
    old_price: 10,
    rating: 4.9,
    isAvailable: true,
    status: 'active',
    slug: 'blackboard-learn-clone-software',
  },
  {
    id: 'edu-clone-5',
    title: 'Schoology LMS Clone',
    subtitle: 'Social learning platform combining classroom and collaboration tools.',
    category: 'Education',
    description: 'Social learning platform combining classroom and collaboration tools.',
    features: ['Social Classroom Feed', 'Assignments', 'Attendance', 'Gradebook', 'Parent Portal'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/schoology-lms-clone-software',
    price: 5,
    old_price: 10,
    rating: 4.9,
    isAvailable: true,
    status: 'active',
    slug: 'schoology-lms-clone-software',
  },
];

export function EducationSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory([
    'education', 'school', 'college', 'coaching', 'elearning', 'e-learning', 'training', 'skill', 'university', 'library', 'examination'
  ]);

  const generatedProducts = fillToTarget(dbProducts as any, 'education', 'Education', 45);
  // Merge top 5 clones at the front, then fill remaining
  const displayProducts = [...TOP_5_EDUCATION_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      {/* Themed section banner */}
      <div className="mx-4 md:mx-8 mb-5 rounded-xl bg-gradient-to-r from-blue-950/80 via-indigo-950/60 to-card border border-blue-500/20 p-4 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
          <GraduationCap className="h-6 w-6 text-blue-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">Education, Training & Skill Development</h2>
            <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-black">CATEGORY</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Empowering 10,000+ institutions across India. From K-12 to university.{' '}
            <span className="text-blue-400 font-semibold">{displayProducts.length} products</span>
          </p>
        </div>
        <div className="hidden md:flex flex-col items-end shrink-0">
          <p className="text-2xl font-black text-blue-400">10K+</p>
          <p className="text-[10px] text-muted-foreground">Institutions</p>
        </div>
      </div>

      {/* Sub-categories strip */}
      <div className="flex gap-2 overflow-x-auto px-4 md:px-8 mb-4 pb-1" style={{ scrollbarWidth: 'none' }}>
        {subCats.map((cat) => (
          <Badge
            key={cat}
            variant={cat === 'All' ? 'default' : 'outline'}
            className="cursor-pointer whitespace-nowrap text-[10px] py-1 px-3 shrink-0 transition-all border-border text-muted-foreground hover:border-primary hover:text-primary"
          >
            {cat}
          </Badge>
        ))}
      </div>

      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard
            key={product.id}
            product={product as any}
            index={i}
            onBuyNow={onBuyNow}
            rank={i + 1}
          />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Education" />}
      </SectionSlider>
    </section>
  );
}
