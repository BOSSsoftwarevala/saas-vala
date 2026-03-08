import { useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Heart, Play, ShoppingCart, GraduationCap, Bell, Download, Copy, Eye, EyeOff, ExternalLink,
  Wallet, User, ArrowLeft, ChevronLeft, ChevronRight, Star, Box
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';
import { educationProducts, EDUCATION_SUBCATEGORIES, type EducationProduct } from '@/data/educationData';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const statusConfig = {
  live: { label: 'LIVE', color: '#16a34a' },
  bestseller: { label: 'BEST SELLER', color: '#eab308' },
  upcoming: { label: 'UPCOMING', color: '#3b82f6' },
};

/* ─── Product Card ─── */
function EduProductCard({ product, onBuyNow }: { product: EducationProduct; onBuyNow: (p: EducationProduct) => void }) {
  const [wishlisted, setWishlisted] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { user } = useAuth();
  const isPipeline = product.status === 'upcoming';
  const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);

  // Build live demo URL (not GitHub)
  const getDemoUrl = (): string => {
    if (product.demoUrl && !product.demoUrl.includes('github.com')) return product.demoUrl;
    return `https://${product.slug}.saasvala.com`;
  };

  const handleDemo = () => {
    setDemoOpen(true);
    setShowPassword(false);
  };

  const handleDownload = () => {
    if (!user) { toast.error('Please sign in to download'); return; }
    const url = product.github_repo || `https://github.com/saasvala/${product.slug}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.success(`Opening source code for ${product.title}`);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const handleWishlist = async () => {
    if (!user) { toast.error('Sign in to add to wishlist'); return; }
    setWishlisted(!wishlisted);
    toast.success(wishlisted ? 'Removed from wishlist' : `❤️ ${product.title} added to wishlist!`);
    try {
      if (!wishlisted) {
        await supabase.from('product_wishlists').insert({
          user_id: user.id,
          product_id: String(product.id),
          product_name: product.title,
        });
      }
    } catch { /* ok */ }
  };

  return (
    <>
      <motion.div
        className="flex-shrink-0 w-[320px]"
        whileHover={{ scale: 1.015, zIndex: 10 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      >
        <div className="rounded-2xl overflow-hidden border border-border/50 shadow-xl h-full flex flex-col" style={{ background: 'hsl(var(--card))' }}>
          {/* Header area */}
          <div className="relative h-[140px] overflow-hidden">
            <img src={product.image} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />

            <span
              className="absolute top-3 right-3 text-[10px] font-black text-white px-2.5 py-0.5 rounded-full"
              style={{ background: statusConfig[product.status].color, boxShadow: `0 0 10px ${statusConfig[product.status].color}50` }}
            >
              {product.status === 'live' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-1" />}
              {statusConfig[product.status].label}
            </span>

            <Button variant="ghost" size="icon"
              className={cn('absolute top-3 left-3 h-8 w-8 rounded-full backdrop-blur-sm', wishlisted ? 'bg-pink-500/20 text-pink-400' : 'bg-background/50 text-foreground hover:text-pink-400')}
              onClick={handleWishlist}
            >
              <Heart className={cn('h-4 w-4', wishlisted && 'fill-pink-400 text-pink-400')} />
            </Button>

            <Badge className="absolute bottom-3 left-3 text-[9px] font-bold bg-primary/20 text-primary border-primary/30">
              {product.subcategory}
            </Badge>
          </div>

          <div className="flex flex-col flex-1 p-4 gap-2">
            <h4 className="font-black text-[14px] text-foreground uppercase leading-tight line-clamp-2">{product.title}</h4>
            <p className="text-[11px] text-muted-foreground line-clamp-1">{product.subtitle}</p>

            <div className="flex flex-wrap gap-1 mt-1">
              {product.features.slice(0, 4).map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] border border-border/50 text-foreground px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <Box style={{ width: 10, height: 10, color: '#9ca3af' }} />{f}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-1 mt-1">
              {product.techStack.slice(0, 4).map((t, i) => (
                <span key={i} className="text-[10px] font-semibold px-1.5 py-0.5 rounded border"
                  style={i === 0 ? { background: 'rgba(59,130,246,0.15)', color: '#60a5fa', borderColor: 'rgba(59,130,246,0.3)' }
                    : i === 1 ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80', borderColor: 'rgba(34,197,94,0.3)' }
                    : { background: 'rgba(249,115,22,0.15)', color: '#fb923c', borderColor: 'rgba(249,115,22,0.3)' }}
                >{t}</span>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs line-through text-muted-foreground">₹{product.originalPrice.toLocaleString()}</span>
              <span className="text-xl font-black text-primary">₹{product.price.toLocaleString()}</span>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{discount}% OFF</span>
              <div className="ml-auto flex items-center gap-0.5">
                <Star className="fill-yellow-400 text-yellow-400" style={{ width: 12, height: 12 }} />
                <span className="text-[10px] font-bold text-yellow-400">4.9</span>
              </div>
            </div>

            <div className="flex gap-1.5 mt-1">
              {isPipeline ? (
                <>
                  <Button size="sm" className="flex-1 h-9 text-[11px] font-bold gap-1 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black">
                    <Bell style={{ width: 13, height: 13 }} /> NOTIFY ME
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 w-9 p-0 rounded-xl" onClick={handleWishlist}>
                    <Heart style={{ width: 14, height: 14 }} className={wishlisted ? 'fill-pink-400 text-pink-400' : ''} />
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" className="flex-1 h-9 text-[11px] font-bold gap-1 rounded-xl border-border hover:border-primary/50 hover:text-primary" onClick={handleDemo}>
                    <Play style={{ width: 13, height: 13 }} /> DEMO
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 w-9 p-0 rounded-xl border-border hover:border-emerald-400/50 hover:text-emerald-400" onClick={handleDownload} title="Source Code">
                    <Download style={{ width: 14, height: 14 }} />
                  </Button>
                  <Button size="sm" variant="outline"
                    className={cn('h-9 w-9 p-0 rounded-xl', wishlisted ? 'border-pink-500/60 text-pink-400 bg-pink-500/10' : 'border-border text-muted-foreground hover:text-pink-400 hover:border-pink-400/50')}
                    onClick={handleWishlist} title="Wishlist"
                  >
                    <Heart style={{ width: 14, height: 14 }} className={wishlisted ? 'fill-pink-400 text-pink-400' : ''} />
                  </Button>
                  <Button size="sm" className="flex-1 h-9 text-[11px] font-black gap-1 rounded-xl" onClick={() => onBuyNow(product)}>
                    <ShoppingCart style={{ width: 13, height: 13 }} /> BUY
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── DEMO CREDENTIALS DIALOG ── */}
      <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase">
              <Play className="text-primary" style={{ width: 18, height: 18 }} />
              {product.title} — Live Demo
            </DialogTitle>
            <DialogDescription className="sr-only">Demo credentials for {product.title}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Live URL */}
            <div className="rounded-xl border border-border/60 p-3 flex flex-col gap-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Live Demo URL</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono text-primary flex-1 break-all">{getDemoUrl()}</p>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0 shrink-0" onClick={() => handleCopy(getDemoUrl(), 'URL')}>
                  <Copy style={{ width: 13, height: 13 }} />
                </Button>
              </div>
            </div>

            {/* Credentials */}
            <div className="rounded-xl border border-border/60 p-3 flex flex-col gap-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Demo Login Credentials</p>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Email</span>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded flex-1">demo@softwarevala.com</code>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => handleCopy('demo@softwarevala.com', 'Email')}>
                    <Copy style={{ width: 12, height: 12 }} />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Password</span>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded flex-1">{showPassword ? 'Demo@2026' : '••••••••'}</code>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setShowPassword(v => !v)}>
                    {showPassword ? <EyeOff style={{ width: 12, height: 12 }} /> : <Eye style={{ width: 12, height: 12 }} />}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => handleCopy('Demo@2026', 'Password')}>
                    <Copy style={{ width: 12, height: 12 }} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Open button */}
            <Button className="w-full h-11 text-sm font-black gap-2" onClick={() => {
              window.open(getDemoUrl(), '_blank', 'noopener,noreferrer');
              toast.success(`Opening live demo for ${product.title}`);
            }}>
              <ExternalLink style={{ width: 15, height: 15 }} /> OPEN LIVE DEMO
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              ⚠️ Demo credentials are for evaluation only. Purchase to get your own license & source code.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Subcategory Row Slider ─── */
function SubcategoryRow({ title, products, onBuyNow }: { title: string; products: EducationProduct[]; onBuyNow: (p: EducationProduct) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' });
  };

  if (products.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-3 px-4 md:px-8 mb-3">
        <h3 className="text-base md:text-lg font-bold text-foreground uppercase tracking-wide">{title}</h3>
        <Badge variant="outline" className="text-[9px] font-bold border-border text-muted-foreground">{products.length} products</Badge>
      </div>
      <div className="relative group/slider">
        <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/90 border border-border shadow-xl flex items-center justify-center opacity-0 group-hover/slider:opacity-100 transition-opacity ml-1" aria-label="Scroll left">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/90 border border-border shadow-xl flex items-center justify-center opacity-0 group-hover/slider:opacity-100 transition-opacity mr-1" aria-label="Scroll right">
          <ChevronRight className="h-5 w-5" />
        </button>
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto px-4 md:px-8 pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {products.map((p) => (
            <EduProductCard key={p.id} product={p} onBuyNow={onBuyNow} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Main Page ─── */
export default function EducationCategory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeSubcat, setActiveSubcat] = useState<string>('All');
  const [buyProduct, setBuyProduct] = useState<EducationProduct | null>(null);
  const [paySuccess, setPaySuccess] = useState(false);

  const filteredProducts = useMemo(() => {
    if (activeSubcat === 'All') return educationProducts;
    return educationProducts.filter(p => p.subcategory === activeSubcat);
  }, [activeSubcat]);

  // Group by subcategory for "All" view
  const groupedRows = useMemo(() => {
    if (activeSubcat !== 'All') return [{ title: activeSubcat, products: filteredProducts }];
    const groups: Record<string, EducationProduct[]> = {};
    educationProducts.forEach(p => {
      if (!groups[p.subcategory]) groups[p.subcategory] = [];
      groups[p.subcategory].push(p);
    });
    return Object.entries(groups).map(([title, products]) => ({ title, products }));
  }, [activeSubcat, filteredProducts]);

  const handleBuyNow = (product: EducationProduct) => {
    if (!user) { toast.error('Please sign in to purchase'); return; }
    setBuyProduct(product);
    setPaySuccess(false);
  };

  const handlePay = async () => {
    if (!buyProduct || !user) return;
    // Navigate to marketplace buy flow
    navigate('/marketplace');
    toast.info(`Redirecting to checkout for ${buyProduct.title}`);
    setBuyProduct(null);
  };

  const handlePostPurchaseDownload = () => {
    if (buyProduct) {
      const url = buyProduct.github_repo || `https://github.com/saasvala/${buyProduct.slug}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setBuyProduct(null);
    setPaySuccess(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="h-full px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/marketplace')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/marketplace')}>
              <img src={saasValaLogo} alt="SaaS VALA" className="h-10 w-10 rounded-xl object-cover border border-primary/20" />
              <span className="font-bold text-lg text-foreground hidden sm:block">SaaS VALA</span>
            </div>
          </div>
          <h1 className="absolute left-1/2 -translate-x-1/2 font-bold text-foreground text-sm md:text-base uppercase flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> EDUCATION
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={() => navigate('/wallet')}>
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">₹0</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <User className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="pt-20 pb-16">
        {/* Hero */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 px-4 md:px-8">
          <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-border rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground uppercase">SCHOOL MANAGEMENT SOFTWARE</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {educationProducts.length} Solutions — School ERP, Attendance, Fees, LMS & More
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Subcategory Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto px-4 md:px-8 mb-6 pb-1" style={{ scrollbarWidth: 'none' }}>
          {EDUCATION_SUBCATEGORIES.map((cat) => (
            <Badge
              key={cat}
              variant={activeSubcat === cat ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer whitespace-nowrap text-[11px] py-1.5 px-4 shrink-0 transition-all font-bold',
                activeSubcat === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
              )}
              onClick={() => setActiveSubcat(cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>

        {/* Product Rows */}
        {groupedRows.map((row, i) => (
          <motion.div key={row.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <SubcategoryRow title={row.title} products={row.products} onBuyNow={handleBuyNow} />
          </motion.div>
        ))}

        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No products in this subcategory yet.</p>
          </div>
        )}
      </main>

      {/* Buy Dialog */}
      <Dialog open={!!buyProduct} onOpenChange={() => setBuyProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase text-base">
              {paySuccess ? '✅ Purchase Complete' : 'Complete Purchase'}
            </DialogTitle>
            <DialogDescription className="sr-only">Purchase dialog for {buyProduct?.title}</DialogDescription>
          </DialogHeader>

          {!paySuccess ? (
            <div className="space-y-4">
              {buyProduct && (
                <div className="bg-muted/30 rounded-xl p-4">
                  <h4 className="font-bold text-foreground text-sm uppercase mb-1">{buyProduct.title}</h4>
                  <p className="text-xs text-muted-foreground mb-3">{buyProduct.subtitle}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {buyProduct.techStack.map((t, i) => (
                      <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Total</span>
                    <span className="font-bold text-xl text-primary">₹{buyProduct.price.toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handlePay}>
                  <Wallet className="h-4 w-4 mr-1" /> PAY WITH WALLET
                </Button>
              </div>
              <p className="text-[10px] text-center text-muted-foreground">
                You'll be redirected to the marketplace checkout for secure payment.
              </p>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <GraduationCap className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-1">License Activated!</h4>
                <p className="text-sm text-muted-foreground">Your software is ready for download</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setBuyProduct(null); setPaySuccess(false); }}>CLOSE</Button>
                <Button className="flex-1 gap-1" onClick={handlePostPurchaseDownload}>
                  <Download className="h-4 w-4" /> DOWNLOAD
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground">
          POWERED BY <span className="font-bold text-foreground">SOFTWARE VALA™</span>
        </p>
      </footer>
    </div>
  );
}
