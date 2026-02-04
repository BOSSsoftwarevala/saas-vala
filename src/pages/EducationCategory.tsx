import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, Play, ShoppingCart, GraduationCap, Bell,
  Wallet, User, ArrowLeft, Search
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default function EducationCategory() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<EducationProduct | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const filteredProducts = educationProducts.filter(product =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <main className="pt-20 pb-16 px-4 md:px-8">
        
        {/* CATEGORY HEADER */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-border rounded-2xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
                    <GraduationCap className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground uppercase">
                      EDUCATION SYSTEMS
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {educationProducts.length} Management Solutions
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                  Complete education management systems for schools, colleges, coaching centers, 
                  training institutes, and specialized academies.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search systems..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-[200px] md:w-[280px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* PRODUCT GRID */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="group"
              >
                <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
                  {/* IMAGE */}
                  <div className="relative h-[160px] overflow-hidden">
                    <img 
                      src={product.image} 
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
                    <h3 className="font-bold text-foreground text-sm uppercase leading-tight mb-1 line-clamp-2">
                      {product.title}
                    </h3>
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

          {filteredProducts.length === 0 && (
            <div className="text-center py-16">
              <GraduationCap className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No systems found</h3>
              <p className="text-muted-foreground">Try adjusting your search query</p>
            </div>
          )}
        </motion.section>
      </main>

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

      {/* FOOTER */}
      <footer className="border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground">
          POWERED BY <span className="font-bold text-foreground">SOFTWARE VALA™</span>
        </p>
      </footer>
    </div>
  );
}
