import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, Play, ShoppingCart, GraduationCap, Bell,
  Wallet, User, ArrowLeft, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';
import { educationProducts, EducationProduct } from '@/data/educationData';
import { toast } from 'sonner';

const statusConfig = {
  live: { label: 'LIVE', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  bestseller: { label: 'BEST SELLER', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  upcoming: { label: 'UPCOMING', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
};

// Group products into rows
const rows = [
  { title: 'SCHOOLS & COLLEGES', products: educationProducts.slice(0, 9) },
  { title: 'RELIGIOUS & TRADITIONAL', products: educationProducts.slice(9, 12) },
  { title: 'VOCATIONAL & IT TRAINING', products: educationProducts.slice(12, 17) },
  { title: 'ARTS & PERFORMANCE', products: educationProducts.slice(17, 26) },
  { title: 'PROFESSIONAL & MEDICAL', products: educationProducts.slice(26, 33) },
  { title: 'SPORTS & FITNESS', products: educationProducts.slice(33, 37) },
  { title: 'SPECIALIZED EDUCATION', products: educationProducts.slice(37, 45) },
];

function ProductSlider({ title, products }: { title: string; products: EducationProduct[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<EducationProduct | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 340;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const toggleFavorite = (id: number) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
    toast.success(favorites.includes(id) ? 'Removed from favorites' : 'Added to favorites');
  };

  const handleBuyNow = (product: EducationProduct) => {
    setSelectedProduct(product);
    setShowPaymentDialog(true);
  };

  const handlePayment = () => {
    setPaymentSuccess(true);
    toast.success('Payment successful! License activated.');
  };

  const handleNotify = (product: EducationProduct) => {
    toast.success(`You will be notified when ${product.title} is available`);
  };

  const discount = (product: EducationProduct) => 
    Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);

  return (
    <section className="mb-8">
      {/* ROW TITLE */}
      <h3 className="text-lg md:text-xl font-bold text-foreground uppercase mb-4 px-4 md:px-8">
        {title}
      </h3>

      {/* SLIDER CONTAINER */}
      <div className="relative group/slider">
        {/* LEFT ARROW */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-full bg-gradient-to-r from-background to-transparent opacity-0 group-hover/slider:opacity-100 transition-opacity flex items-center justify-center"
        >
          <ChevronLeft className="h-8 w-8 text-foreground" />
        </button>

        {/* RIGHT ARROW */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-full bg-gradient-to-l from-background to-transparent opacity-0 group-hover/slider:opacity-100 transition-opacity flex items-center justify-center"
        >
          <ChevronRight className="h-8 w-8 text-foreground" />
        </button>

        {/* SCROLLABLE ROW */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map((product) => (
            <motion.div
              key={product.id}
              className="flex-shrink-0 w-[320px] group/card"
              whileHover={{ scale: 1.02, zIndex: 10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-xl hover:shadow-primary/10 transition-all duration-300">
                {/* IMAGE */}
                <div className="relative h-[160px] overflow-hidden">
                  <img 
                    src={product.image} 
                    alt={product.title}
                    className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                  
                  {/* STATUS BADGE */}
                  <Badge className={cn(
                    'absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5',
                    statusConfig[product.status].className
                  )}>
                    {statusConfig[product.status].label}
                  </Badge>

                  {/* FAVORITE BUTTON */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 left-3 h-8 w-8 bg-background/50 backdrop-blur-sm hover:bg-background/80"
                    onClick={() => toggleFavorite(product.id)}
                  >
                    <Heart 
                      className={cn(
                        'h-4 w-4 transition-colors',
                        favorites.includes(product.id) ? 'fill-red-500 text-red-500' : 'text-foreground'
                      )} 
                    />
                  </Button>
                </div>

                {/* CONTENT */}
                <div className="p-4">
                  <h4 className="font-bold text-foreground text-sm uppercase leading-tight mb-1 line-clamp-2">
                    {product.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    {product.subtitle}
                  </p>

                  {/* FEATURES */}
                  <div className="space-y-1 mb-4">
                    {product.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-1 h-1 rounded-full bg-primary" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  {/* PRICING */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs text-muted-foreground line-through">
                      ₹{product.originalPrice.toLocaleString()}
                    </span>
                    <span className="font-bold text-lg text-primary">
                      ₹{product.price.toLocaleString()}
                    </span>
                    <Badge className="bg-destructive/20 text-destructive border-0 text-[10px]">
                      {discount(product)}% OFF
                    </Badge>
                  </div>

                  {/* BUTTONS */}
                  <div className="flex gap-2">
                    {product.status === 'upcoming' ? (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 text-xs"
                          disabled
                        >
                          COMING SOON
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 text-xs gap-1"
                          onClick={() => handleNotify(product)}
                        >
                          <Bell className="h-3 w-3" />
                          NOTIFY
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 text-xs gap-1"
                        >
                          <Play className="h-3 w-3" />
                          DEMO
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 text-xs gap-1"
                          onClick={() => handleBuyNow(product)}
                        >
                          <ShoppingCart className="h-3 w-3" />
                          BUY NOW
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* PAYMENT DIALOG */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase">
              {paymentSuccess ? 'Payment Successful' : 'Complete Purchase'}
            </DialogTitle>
          </DialogHeader>
          
          {!paymentSuccess ? (
            <div className="space-y-4">
              {selectedProduct && (
                <div className="bg-muted/30 rounded-xl p-4">
                  <h4 className="font-bold text-foreground text-sm uppercase mb-1">
                    {selectedProduct.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">{selectedProduct.subtitle}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Total Amount</span>
                    <span className="font-bold text-xl text-primary">
                      ₹{selectedProduct.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              <Button className="w-full" onClick={handlePayment}>
                PAY NOW
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <GraduationCap className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-1">License Activated!</h4>
                <p className="text-sm text-muted-foreground">
                  Your software is ready for download
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setShowPaymentDialog(false);
                    setPaymentSuccess(false);
                  }}
                >
                  CLOSE
                </Button>
                <Button className="flex-1">
                  DOWNLOAD
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function EducationCategory() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* GLOBAL HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="h-full px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/marketplace')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => navigate('/marketplace')}
            >
              <img 
                src={saasValaLogo} 
                alt="SaaS VALA" 
                className="h-10 w-10 rounded-xl object-cover border border-primary/20"
              />
              <span className="font-display font-bold text-lg text-foreground hidden sm:block">
                SaaS VALA
              </span>
            </div>
          </div>

          <h1 className="absolute left-1/2 -translate-x-1/2 font-display font-bold text-foreground text-sm md:text-base uppercase flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            EDUCATION
          </h1>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-1 px-2"
              onClick={() => navigate('/wallet')}
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">₹0</span>
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/settings')}
            >
              <User className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="pt-20 pb-16">
        
        {/* CATEGORY HERO */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 px-4 md:px-8"
        >
          <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-border rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground uppercase">
                  EDUCATION SYSTEMS
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {educationProducts.length} Management Solutions for Schools, Colleges & Institutes
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* NETFLIX-STYLE ROWS */}
        {rows.map((row, index) => (
          <motion.div
            key={row.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <ProductSlider title={row.title} products={row.products} />
          </motion.div>
        ))}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground">
          POWERED BY <span className="font-bold text-foreground">SOFTWARE VALA™</span>
        </p>
      </footer>
    </div>
  );
}
