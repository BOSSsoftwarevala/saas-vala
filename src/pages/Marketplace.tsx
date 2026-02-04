import { useState } from 'react';
import { motion } from 'framer-motion';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { ProductSlider } from '@/components/marketplace/ProductSlider';
import { categories, generateProducts } from '@/data/marketplaceData';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Download, ShoppingCart, CreditCard } from 'lucide-react';

interface Product {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  status: 'upcoming' | 'live' | 'bestseller';
  price: number;
}

export default function Marketplace() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleBuyNow = (product: Product) => {
    setSelectedProduct(product);
    setShowPayment(true);
    setPaymentSuccess(false);
  };

  const handlePayment = async () => {
    setProcessing(true);
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    setProcessing(false);
    setPaymentSuccess(true);
    toast.success('Payment successful! License activated.');
  };

  const handleFavorite = (product: Product) => {
    toast.success(`${product.title} added to favorites`);
  };

  const handleNotify = (product: Product) => {
    toast.success(`You'll be notified when ${product.title} launches`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <MarketplaceHeader />

      {/* Main Content - with top padding for fixed header */}
      <main className="pt-20 pb-8">
        {/* Hero Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 md:px-8 mb-6"
        >
          <div className="relative h-[200px] md:h-[300px] rounded-2xl overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=1600&h=600&fit=crop"
              alt="Business Software Marketplace"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent flex items-center">
              <div className="px-6 md:px-12 max-w-xl">
                <Badge className="mb-3 bg-primary/20 text-primary border-primary/30">
                  ENTERPRISE SOFTWARE
                </Badge>
                <h1 className="text-2xl md:text-4xl font-display font-bold text-foreground mb-2">
                  Business Software Marketplace
                </h1>
                <p className="text-sm md:text-base text-muted-foreground mb-4">
                  One-click install. Lifetime license. Instant support.
                </p>
                <Button className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Browse All
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Category Rows - All 29 categories */}
        {categories.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <ProductSlider
              title={`${category.icon} ${category.title}`}
              products={generateProducts(category.id, 10)}
              onBuyNow={handleBuyNow}
              onFavorite={handleFavorite}
              onNotify={handleNotify}
            />
          </motion.div>
        ))}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4 md:px-8">
        <p className="text-center text-sm text-muted-foreground">
          Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
        </p>
      </footer>

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="sm:max-w-md">
          {!paymentSuccess ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Complete Purchase
                </DialogTitle>
                <DialogDescription>
                  You're about to purchase {selectedProduct?.title}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Product Summary */}
                <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
                  <img
                    src={selectedProduct?.image}
                    alt={selectedProduct?.title}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                  <div>
                    <h3 className="font-semibold">{selectedProduct?.title}</h3>
                    <p className="text-sm text-muted-foreground">{selectedProduct?.subtitle}</p>
                    <p className="text-lg font-bold text-primary mt-1">
                      ₹{selectedProduct?.price.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Payment Options */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Pay using:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm">Wallet Balance</Button>
                    <Button variant="outline" size="sm">UPI</Button>
                    <Button variant="outline" size="sm">Card</Button>
                    <Button variant="outline" size="sm">Net Banking</Button>
                  </div>
                </div>

                <Button 
                  className="w-full gap-2" 
                  onClick={handlePayment}
                  disabled={processing}
                >
                  {processing ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      Pay ₹{selectedProduct?.price.toLocaleString()}
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  Payment Successful!
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4 text-center">
                <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedProduct?.title}</h3>
                  <p className="text-sm text-muted-foreground">License automatically activated</p>
                </div>
                <Button className="w-full gap-2">
                  <Download className="h-4 w-4" />
                  Download Now
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setShowPayment(false)}>
                  Continue Shopping
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
