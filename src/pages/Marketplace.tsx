import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { ProductSlider } from '@/components/marketplace/ProductSlider';
import { UpcomingSection } from '@/components/marketplace/UpcomingSection';
import { OnDemandSection } from '@/components/marketplace/OnDemandSection';
import { TopSellingSection } from '@/components/marketplace/TopSellingSection';
import { PopularProductsSection } from '@/components/marketplace/PopularProductsSection';
import { EducationSection } from '@/components/marketplace/EducationSection';
import { MarketplaceSectionDivider } from '@/components/marketplace/MarketplaceSectionDivider';
import { row1Software, row2Software, row3Software, row4Software } from '@/data/topSoftwareData';
import { useMarketplaceProducts } from '@/hooks/useMarketplaceProducts';
import { toast } from 'sonner';
import { useApkPurchase } from '@/hooks/useApkPurchase';
import { useFraudDetection } from '@/hooks/useFraudDetection';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import saasValaBanner from '@/assets/saas-vala-banner.jpg';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, Download, ShoppingCart, CreditCard, AlertTriangle, Shield,
  Wallet, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';

interface Product {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  status: 'upcoming' | 'live' | 'bestseller' | 'draft';
  price: number;
}

export default function Marketplace() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [generatedLicenseKey, setGeneratedLicenseKey] = useState<string>('');
  const [_transactionId, setTransactionId] = useState<string>('');
  const [showMorePayment, setShowMorePayment] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const paymentLockRef = useRef(false);
  const { purchaseApk, processing } = useApkPurchase();
  const { checkUserStatus } = useFraudDetection();
  const { user } = useAuth();
  const { allRows } = useMarketplaceProducts();

  const logPaymentAttempt = async (
    product: Product, 
    method: string, 
    status: string, 
    attempt: number = 1,
    errorMsg?: string
  ) => {
    if (!user) return;
    try {
      await supabase.from('payment_attempt_log').insert({
        user_id: user.id,
        product_id: product.id,
        product_name: product.title,
        amount: product.price,
        payment_method: method,
        status,
        attempt_number: attempt,
        error_message: errorMsg || null,
      });
    } catch (e) {
      console.error('Failed to log payment attempt:', e);
    }
  };

  const handleBuyNow = async (product: Product) => {
    if (!user) {
      toast.error('Please sign in to make a purchase');
      return;
    }
    
    const fraudStatus = await checkUserStatus(user.id, user.email || '');
    if (fraudStatus.isBlocked) {
      toast.error(fraudStatus.message);
      return;
    }
    
    setSelectedProduct(product);
    setShowPayment(true);
    setPaymentSuccess(false);
    setGeneratedLicenseKey('');
    setTransactionId('');
    setShowMorePayment(false);
    setPaymentSubmitting(false);
    paymentLockRef.current = false;
  };

  const handlePayment = async () => {
    if (!selectedProduct || paymentLockRef.current) return;
    
    // Double-submit prevention
    paymentLockRef.current = true;
    setPaymentSubmitting(true);

    await logPaymentAttempt(selectedProduct, 'wallet', 'initiated');
    
    const result = await purchaseApk(selectedProduct);
    
    if (result.success) {
      setPaymentSuccess(true);
      setGeneratedLicenseKey(result.licenseKey || '');
      setTransactionId(result.transactionId || '');
      await logPaymentAttempt(selectedProduct, 'wallet', 'completed');
      toast.success('🎉 Payment successful!');
    } else {
      await logPaymentAttempt(selectedProduct, 'wallet', 'failed', 1, result.error);
      toast.error(result.error || 'Payment failed');
      // Allow retry
      paymentLockRef.current = false;
    }
    
    setPaymentSubmitting(false);
  };

  const handleFavorite = (product: Product) => {
    toast.success(`${product.title} added to favorites`);
  };

  const handleNotify = (product: Product) => {
    toast.success(`You'll be notified when ${product.title} launches`);
  };

  const handleDownloadApk = (product: Product) => {
    if (!user) {
      toast.error('Please sign in to download APK');
      return;
    }
    handleBuyNow(product);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <MarketplaceHeader />

      {/* Main Content */}
      <main className="pt-20 pb-8">
        {/* Hero Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 md:px-8 mb-6"
        >
          <div className="relative rounded-2xl overflow-hidden">
            <img
              src={saasValaBanner}
              alt="SaaS VALA - All Software Only $5 per month"
              className="w-full h-auto object-contain rounded-2xl"
            />
          </div>
        </motion.div>

        {/* ━━━ SECTION 1: UPCOMING SOFTWARE ━━━ */}
        <UpcomingSection />

        <MarketplaceSectionDivider label="on-demand" />

        {/* ━━━ SECTION 2: ON-DEMAND SOFTWARE ━━━ */}
        <OnDemandSection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="this week" />

        {/* ━━━ SECTION 3: THIS WEEK TOP SELLING ━━━ */}
        <TopSellingSection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="popular" />

        {/* ━━━ SECTION 4: POPULAR PRODUCTS ━━━ */}
        <PopularProductsSection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="education" />

        {/* ━━━ SECTION 5: EDUCATION & SKILL DEVELOPMENT ━━━ */}
        <EducationSection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="all software" />

        {/* ━━━ FEATURED TOP SOFTWARE ROWS ━━━ */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <ProductSlider title="🔥 TOP SOFTWARE ROW 1" products={row1Software} onBuyNow={handleBuyNow} onFavorite={handleFavorite} onNotify={handleNotify} onDownloadApk={handleDownloadApk} showTechStack={true} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <ProductSlider title="⚡ TOP SOFTWARE ROW 2" products={row2Software} onBuyNow={handleBuyNow} onFavorite={handleFavorite} onNotify={handleNotify} onDownloadApk={handleDownloadApk} showTechStack={true} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <ProductSlider title="💼 TOP SOFTWARE ROW 3" products={row3Software} onBuyNow={handleBuyNow} onFavorite={handleFavorite} onNotify={handleNotify} onDownloadApk={handleDownloadApk} showTechStack={true} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <ProductSlider title="🚀 TOP SOFTWARE ROW 4" products={row4Software} onBuyNow={handleBuyNow} onFavorite={handleFavorite} onNotify={handleNotify} onDownloadApk={handleDownloadApk} showTechStack={true} />
        </motion.div>

        {/* ━━━ DATABASE CATALOG ROWS ━━━ */}
        {allRows.map((row, rowIndex) => (
          <motion.div key={`db-row-${rowIndex}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (rowIndex + 5) * 0.05 }}>
            <ProductSlider title={`📦 SOFTWARE CATALOG ROW ${rowIndex + 1}`} products={row} onBuyNow={handleBuyNow} onFavorite={handleFavorite} onNotify={handleNotify} onDownloadApk={handleDownloadApk} showTechStack={true} />
          </motion.div>
        ))}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4 md:px-8">
        <p className="text-center text-sm text-muted-foreground">
          Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
        </p>
      </footer>

      {/* Simplified Payment Dialog — No nested scroll, single vertical layout */}
      {showPayment && (
        <Dialog open={showPayment} onOpenChange={(open) => {
          if (!paymentSubmitting) {
            setShowPayment(open);
            paymentLockRef.current = false;
          }
        }}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            {!paymentSuccess ? (
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    Complete Purchase
                  </DialogTitle>
                  <DialogDescription>
                    Purchase {selectedProduct?.title}
                  </DialogDescription>
                </DialogHeader>

                {/* Product Summary */}
                <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
                  <img
                    src={selectedProduct?.image}
                    alt={selectedProduct?.title}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{selectedProduct?.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{selectedProduct?.subtitle}</p>
                    <p className="text-lg font-bold text-primary mt-1">
                      ${selectedProduct?.price.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Primary: Wallet Balance (UPI-style instant) */}
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border-2 border-primary bg-primary/5">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Wallet Balance</span>
                      <Badge className="ml-auto bg-primary/10 text-primary border-primary/20 text-[10px]">
                        Instant
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Deduct directly from your wallet — fastest checkout
                    </p>
                  </div>

                  {/* Pay Button — Disabled after first click */}
                  <Button 
                    className="w-full gap-2 h-12" 
                    onClick={handlePayment}
                    disabled={paymentSubmitting || processing}
                  >
                    {paymentSubmitting || processing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing... Do not close
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4" />
                        Pay ${selectedProduct?.price.toLocaleString()} from Wallet
                      </>
                    )}
                  </Button>

                  {/* More Payment Options — Expandable */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2 text-muted-foreground"
                    onClick={() => setShowMorePayment(!showMorePayment)}
                    disabled={paymentSubmitting}
                  >
                    {showMorePayment ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    More Payment Options
                  </Button>

                  {showMorePayment && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2"
                    >
                      <Button variant="outline" size="sm" className="w-full justify-start gap-2" disabled>
                        <CreditCard className="h-4 w-4" /> Card Payment
                        <Badge variant="outline" className="ml-auto text-[10px]">Coming Soon</Badge>
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start gap-2" disabled>
                        <Wallet className="h-4 w-4" /> UPI
                        <Badge variant="outline" className="ml-auto text-[10px]">Coming Soon</Badge>
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start gap-2" disabled>
                        <CreditCard className="h-4 w-4" /> Net Banking
                        <Badge variant="outline" className="ml-auto text-[10px]">Coming Soon</Badge>
                      </Button>
                    </motion.div>
                  )}
                </div>

                {/* Transaction = License Key Info */}
                <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                  <div className="flex items-center gap-2 text-primary text-xs font-medium">
                    <Shield className="h-3.5 w-3.5" />
                    Transaction ID = License Key
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Your payment Transaction ID becomes your software license key automatically
                  </p>
                </div>

                {/* Fraud Warning */}
                <div className="p-3 bg-destructive/5 border border-destructive/10 rounded-lg">
                  <div className="flex items-center gap-2 text-destructive text-xs font-medium">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Fraud Protection Active
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    1st violation: $2 fine | 2nd: $5 fine | 3rd: Permanent block
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
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
                    <p className="text-sm text-muted-foreground">Transaction ID = License Key</p>
                    {generatedLicenseKey && (
                      <div className="mt-3 p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Your License Key:</p>
                        <p className="font-mono font-bold text-primary text-lg">{generatedLicenseKey}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          ⚠️ Save this key - proof of purchase & activation key
                        </p>
                      </div>
                    )}
                  </div>
                  <Button className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    Download Now
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setShowPayment(false)}>
                    Continue Shopping
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
