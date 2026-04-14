import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { Badge } from '@/components/ui/badge';
import { GraduationCap } from 'lucide-react';

const subCats = ['All', 'School', 'College', 'Coaching', 'E-Learning', 'Skill Training', 'University', 'Library', 'Examination'];

export function EducationSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory([
    'education', 'school', 'college', 'coaching', 'elearning', 'e-learning', 'training', 'skill', 'university', 'library', 'examination'
  ]);

  const displayProducts = fillToTarget(dbProducts as any, 'education', 'Education', 50);

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
