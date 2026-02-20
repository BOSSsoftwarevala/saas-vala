import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, GraduationCap, Users, Zap, Star, Plus } from 'lucide-react';
import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { cn } from '@/lib/utils';

const eduProducts = [
  { id: 'ed-1', title: 'SCHOOL ERP COMPLETE', subtitle: 'K-12 all-in-one management system', image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop', subCategory: 'School Management', badge: 'BESTSELLER' as const, rating: 4.9, institutions: 1240, features: ['Timetable', 'Attendance', 'Fee Mgmt', 'Parent App', 'Report Cards'], price: 5 },
  { id: 'ed-2', title: 'ONLINE LMS PRO', subtitle: 'Complete learning management system', image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=300&fit=crop', subCategory: 'E-Learning', badge: 'AI-ENHANCED' as const, rating: 4.8, institutions: 890, features: ['Live Classes', 'AI Quizzes', 'Certificates', 'Progress Track'], price: 5 },
  { id: 'ed-3', title: 'COLLEGE ERP SUITE', subtitle: 'Higher education institution ERP', image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=300&fit=crop', subCategory: 'College Management', badge: 'GOVT APPROVED' as const, rating: 4.7, institutions: 320, features: ['Admission Portal', 'Exam Module', 'Library', 'Hostel Mgmt'], price: 5 },
  { id: 'ed-4', title: 'COACHING CENTRE ERP', subtitle: 'Tuition & coaching management platform', image: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=400&h=300&fit=crop', subCategory: 'Coaching', badge: 'CERTIFIED' as const, rating: 4.8, institutions: 2100, features: ['Batch Mgmt', 'Test Series', 'Results', 'Fee Collection'], price: 5 },
  { id: 'ed-5', title: 'SKILL DEVELOPMENT APP', subtitle: 'Vocational training & certification system', image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop', subCategory: 'Skill Training', badge: 'GOVT APPROVED' as const, rating: 4.6, institutions: 560, features: ['Trade Courses', 'Assessments', 'Job Board', 'E-Certificates'], price: 5 },
  { id: 'ed-6', title: 'UNIVERSITY ADMISSION', subtitle: 'End-to-end admission management portal', image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=400&h=300&fit=crop', subCategory: 'University', badge: 'NEW LAUNCH' as const, rating: 4.5, institutions: 180, features: ['Online Apply', 'Merit Lists', 'Document Upload', 'Fee Payment'], price: 5 },
  { id: 'ed-7', title: 'LIBRARY MANAGEMENT', subtitle: 'Smart library with RFID & e-resources', image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop', subCategory: 'Library', badge: 'CERTIFIED' as const, rating: 4.7, institutions: 1680, features: ['Book Catalog', 'RFID Issue', 'E-Books', 'Fine Calc'], price: 5 },
  { id: 'ed-8', title: 'EXAM & TEST ENGINE', subtitle: 'Online examination & assessment platform', image: 'https://images.unsplash.com/photo-1606326608690-4e0281b1e588?w=400&h=300&fit=crop', subCategory: 'Examination', badge: 'AI-ENHANCED' as const, rating: 4.8, institutions: 740, features: ['Question Bank', 'AI Proctoring', 'Auto Grade', 'Rank Lists'], price: 5 },
];

const badgeCfg = {
  CERTIFIED: 'bg-green-500/20 text-green-400 border-green-500/30',
  'AI-ENHANCED': 'bg-primary/20 text-primary border-primary/30',
  'GOVT APPROVED': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'NEW LAUNCH': 'bg-secondary/20 text-secondary border-secondary/30',
  BESTSELLER: 'bg-warning/20 text-warning border-warning/30 animate-pulse',
};

const subCats = ['All', 'School', 'College', 'Coaching', 'E-Learning', 'Skill Training', 'University', 'Library', 'Examination'];

export function EducationSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory([
    'education', 'school', 'college', 'coaching', 'elearning', 'e-learning', 'training', 'skill', 'university', 'library', 'examination'
  ]);

  const showStatic = dbProducts.length === 0;

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
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[9px] font-black">CATEGORY</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Empowering 10,000+ institutions across India. From K-12 to university.{' '}
            <span className="text-blue-400 font-semibold">{(dbProducts.length || eduProducts.length)} products</span>
          </p>
        </div>
        <div className="hidden md:flex flex-col items-end shrink-0">
          <p className="text-2xl font-black text-blue-400">10K+</p>
          <p className="text-[10px] text-muted-foreground">Institutions</p>
        </div>
      </div>

      {/* Sub-categories strip */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 md:px-8 mb-4 pb-1" style={{ scrollbarWidth: 'none' }}>
        {subCats.map((cat) => (
          <Badge
            key={cat}
            variant={cat === 'All' ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer whitespace-nowrap text-[10px] py-1 px-3 shrink-0 transition-all',
              cat === 'All' ? 'bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
            )}
          >
            {cat}
          </Badge>
        ))}
      </div>

      <SectionSlider>
        {/* DB education products */}
        {!showStatic && dbProducts.map((p, i) => (
          <MarketplaceProductCard
            key={p.id}
            product={p}
            index={i}
            onBuyNow={onBuyNow}
            borderColor="border-blue-500/20"
            iconColor="text-blue-400"
          />
        ))}

        {/* Static fallback */}
        {showStatic && eduProducts.map((product) => (
          <div key={product.id} className="flex-shrink-0 w-[280px] md:w-[300px]">
            <div className="relative rounded-xl overflow-hidden bg-card border border-blue-500/20 shadow-lg h-full flex flex-col">
              <div className="relative h-[108px] overflow-hidden">
                <img src={product.image} alt={product.title} className="w-full h-full object-cover opacity-50" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                <Badge className={cn('absolute top-2 left-2 text-[9px] font-black border', badgeCfg[product.badge])}>
                  {product.badge}
                </Badge>
                <div className="absolute bottom-2 left-2">
                  <Badge variant="outline" className="text-[9px] border-blue-400/30 text-blue-400 bg-blue-950/50">
                    {product.subCategory}
                  </Badge>
                </div>
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/80 rounded-full px-2 py-0.5">
                  <Users className="h-2.5 w-2.5 text-blue-400" />
                  <span className="text-[9px] font-bold text-blue-400">{product.institutions.toLocaleString()} inst.</span>
                </div>
              </div>

              <div className="p-3 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-5 w-5 rounded bg-blue-500/20 flex items-center justify-center">
                    <GraduationCap className="h-3 w-3 text-blue-400" />
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    <span className="text-[9px] font-bold text-warning">{product.rating}</span>
                  </div>
                </div>
                <h3 className="font-black text-xs text-foreground uppercase leading-tight mb-1">{product.title}</h3>
                <p className="text-[11px] text-muted-foreground mb-2 line-clamp-1">{product.subtitle}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {product.features.slice(0, 3).map((f, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] bg-muted/30 border-blue-500/20 text-blue-300">{f}</Badge>
                  ))}
                </div>
                <div className="flex items-baseline gap-1 mb-3 mt-auto">
                  <span className="text-xs line-through text-muted-foreground">$49</span>
                  <span className="text-xl font-black text-primary">$5</span>
                  <Badge className="bg-destructive/20 text-destructive border-0 text-[9px]">90% OFF</Badge>
                </div>
                {/* EXACTLY 3 buttons */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button size="sm" variant="outline" className="h-8 text-[10px] gap-1 border-blue-400/30 text-blue-400 hover:bg-blue-500/10">
                      <Zap className="h-3 w-3" /> DEMO
                    </Button>
                    <Button size="sm" className="h-8 text-[10px] gap-1 bg-blue-600 hover:bg-blue-500 text-white border-0" onClick={() => onBuyNow(product)}>
                      <ShoppingCart className="h-3 w-3" /> BUY NOW
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" className="w-full h-8 text-[10px] gap-1 border-blue-400/20 text-blue-400/70 hover:text-blue-400">
                    <Plus className="h-3 w-3" /> ADD PRODUCT
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {dbProducts.length === 0 && eduProducts.length === 0 && <ComingSoonCard label="Education" />}
      </SectionSlider>
    </section>
  );
}
