import { useState, useRef } from 'react';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { LazySection } from '@/components/marketplace/LazySection';
import { MarketplaceCategoryRow } from '@/components/marketplace/MarketplaceCategoryRow';
import { MARKETPLACE_CATEGORIES } from '@/data/marketplaceCategories';
import { useMarketplaceProducts } from '@/hooks/useMarketplaceProducts';
import { toast } from 'sonner';
import { useApkPurchase } from '@/hooks/useApkPurchase';
import { useFraudDetection } from '@/hooks/useFraudDetection';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { HeroBannerSlider } from '@/components/marketplace/HeroBannerSlider';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ShoppingCart, CreditCard, Wallet, Loader2, ChevronDown, ChevronUp, Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: string; title: string; subtitle: string; image: string;
  status: 'upcoming' | 'live' | 'bestseller' | 'draft'; price: number;
}

const bankDetails = {
  accountName: 'SOFTWARE VALA', bankName: 'INDIAN BANK',
  accountNumber: '8045924772', ifsc: 'IDIB000K196',
  branchName: 'KANKAR BAGH', upiId: 'softwarevala@indianbank',
};


type BuyPayMethod = 'wallet' | 'upi' | 'bank' | 'crypto';

export default function Marketplace() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [generatedLicenseKey, setGeneratedLicenseKey] = useState('');
  const [showMorePayment, setShowMorePayment] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [buyPayMethod, setBuyPayMethod] = useState<BuyPayMethod>('wallet');
  const [manualTxnRef, setManualTxnRef] = useState('');
  const [_manualSubmitted, setManualSubmitted] = useState(false);
  const paymentLockRef = useRef(false);
  const { purchaseApk, processing } = useApkPurchase();
  const { checkUserStatus } = useFraudDetection();
  const { user } = useAuth();
  
  useMarketplaceProducts();

  const handleBuyNow = async (product: Product) => {
    if (!user) { toast.error('Please sign in to purchase'); return; }
    const fraud = await checkUserStatus(user.id, user.email || '');
    if (fraud.isBlocked) { toast.error(fraud.message); return; }
    setSelectedProduct(product); setShowPayment(true); setPaymentSuccess(false);
    setGeneratedLicenseKey(''); setShowMorePayment(false); setPaymentSubmitting(false);
    setBuyPayMethod('wallet'); setManualTxnRef(''); setManualSubmitted(false);
    paymentLockRef.current = false;
  };

  const handleWalletPayment = async () => {
    if (!selectedProduct || paymentLockRef.current) return;
    paymentLockRef.current = true; setPaymentSubmitting(true);
    const result = await purchaseApk(selectedProduct);
    if (result.success) {
      setPaymentSuccess(true); setGeneratedLicenseKey(result.licenseKey || '');
      toast.success('🎉 Payment successful!');
    } else {
      toast.error(result.error || 'Payment failed'); paymentLockRef.current = false;
    }
    setPaymentSubmitting(false);
  };

  const handleManualPayment = async () => {
    if (!manualTxnRef.trim() || !selectedProduct || !user) return;
    setPaymentSubmitting(true);
    try {
      const { data: w } = await supabase.from('wallets').select('id').eq('user_id', user.id).maybeSingle();
      if (w) {
        await supabase.from('transactions').insert({
          wallet_id: w.id, type: 'credit', amount: selectedProduct.price, status: 'pending',
          description: `${buyPayMethod.toUpperCase()} for ${selectedProduct.title}`,
          created_by: user.id, reference_id: manualTxnRef, reference_type: buyPayMethod,
          meta: { payment_method: buyPayMethod, transaction_ref: manualTxnRef, product_id: selectedProduct.id },
        });
      }
      setManualSubmitted(true);
    } catch { toast.error('Submission failed'); }
    setPaymentSubmitting(false);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text); toast.success(`${label} copied!`);
  };

  return (
    <div className="min-h-screen" style={{ background: '#0B1020' }}>
      <MarketplaceHeader />
      <main className="pt-16 pb-8">
        <HeroBannerSlider />

        {/* All categories as dynamic rows — no duplicate hardcoded sections */}
        {MARKETPLACE_CATEGORIES.map((cat) => (
          <LazySection key={cat.id} height={280}>
            <MarketplaceCategoryRow category={cat} onBuyNow={handleBuyNow} />
          </LazySection>
        ))}

        {/* Simple Pricing */}
        <section id="pricing" className="py-12 px-4 md:px-8 border-t border-border">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-black text-foreground mb-3">💰 Simple Pricing</h2>
            <p className="text-muted-foreground mb-6">Every software. One price. No hidden fees.</p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border p-5 flex flex-col items-center gap-2">
                <h3 className="font-bold text-foreground">Free Trial</h3>
                <p className="text-3xl font-black text-foreground">$0</p>
                <p className="text-xs text-muted-foreground">7-day demo access</p>
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Browse</Button>
              </div>
              <div className="rounded-xl border-2 border-primary p-5 flex flex-col items-center gap-2 relative bg-primary/5">
                <Badge className="absolute -top-2.5 bg-primary text-primary-foreground text-[10px] font-black px-2">POPULAR</Badge>
                <h3 className="font-bold text-foreground">Pro License</h3>
                <p className="text-3xl font-black text-primary">$5</p>
                <p className="text-xs text-muted-foreground">Source + APK + 30 days</p>
                <Button size="sm" className="w-full mt-2" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Buy Now</Button>
              </div>
              <div className="rounded-xl border border-border p-5 flex flex-col items-center gap-2">
                <h3 className="font-bold text-foreground">Enterprise</h3>
                <p className="text-3xl font-black text-foreground">Custom</p>
                <p className="text-xs text-muted-foreground">White-label + deploy</p>
                <Button variant="outline" size="sm" className="w-full mt-2">Contact</Button>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="py-12 px-4 md:px-8 border-t border-border">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-black text-foreground mb-4">📬 Contact Us</h2>
            <div className="grid gap-3 text-left">
              <a href="mailto:support@saasvala.com" className="rounded-xl border border-border p-4 flex items-center gap-3 hover:border-primary/50 transition-colors">
                <span className="text-xl">📧</span>
                <div><p className="font-bold text-sm text-foreground">Email</p><p className="text-xs text-muted-foreground">support@saasvala.com</p></div>
              </a>
              <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-border p-4 flex items-center gap-3 hover:border-primary/50 transition-colors">
                <span className="text-xl">💬</span>
                <div><p className="font-bold text-sm text-foreground">WhatsApp</p><p className="text-xs text-muted-foreground">Chat instantly</p></div>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-4 px-4"><p className="text-center text-xs text-muted-foreground">Powered by <span className="font-semibold text-primary">SoftwareVala™</span></p></footer>

      {/* Payment Dialog */}
      {showPayment && (
        <Dialog open={showPayment} onOpenChange={o => { if (!paymentSubmitting) { setShowPayment(o); paymentLockRef.current = false; } }}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            {!paymentSuccess ? (
              <div className="space-y-3">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-sm"><ShoppingCart className="h-4 w-4 text-primary" />Complete Purchase</DialogTitle>
                  <DialogDescription>{selectedProduct?.title} — ${selectedProduct?.price}</DialogDescription>
                </DialogHeader>
                <div className={cn('rounded-xl border-2 cursor-pointer p-3', buyPayMethod === 'wallet' ? 'border-primary bg-primary/5' : 'border-border')} onClick={() => setBuyPayMethod('wallet')}>
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-primary" />
                    <div><p className="font-semibold text-sm">Wallet</p><p className="text-xs text-muted-foreground">Instant checkout</p></div>
                  </div>
                </div>
                {buyPayMethod === 'wallet' && (
                  <Button className="w-full h-11" onClick={handleWalletPayment} disabled={paymentSubmitting || processing}>
                    {paymentSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</> : `Pay $${selectedProduct?.price} from Wallet`}
                  </Button>
                )}
                <button className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground py-1" onClick={() => setShowMorePayment(!showMorePayment)}>
                  {showMorePayment ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} More Options
                </button>
                {showMorePayment && (
                  <div className="space-y-2">
                    <div className={cn('rounded-xl border cursor-pointer', buyPayMethod === 'upi' ? 'border-primary bg-primary/5' : 'border-border')} onClick={() => setBuyPayMethod('upi')}>
                      <div className="flex items-center gap-3 p-3"><Wallet className="h-4 w-4" /><div><p className="font-medium text-sm">UPI</p><p className="text-xs text-muted-foreground">GPay, PhonePe, Paytm</p></div></div>
                      {buyPayMethod === 'upi' && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                          <div className="bg-background rounded-lg p-2 flex items-center justify-between">
                            <div><p className="text-xs text-muted-foreground">UPI ID</p><p className="font-mono font-semibold text-sm">{bankDetails.upiId}</p></div>
                            <button className="text-xs text-primary border border-primary/30 px-2 py-1 rounded" onClick={e => { e.stopPropagation(); handleCopy(bankDetails.upiId, 'UPI ID'); }}><Copy className="h-3 w-3 inline mr-1" />Copy</button>
                          </div>
                          <Input placeholder="Transaction ID" value={manualTxnRef} onChange={e => setManualTxnRef(e.target.value)} onClick={e => e.stopPropagation()} />
                          <Button className="w-full h-9" onClick={handleManualPayment} disabled={paymentSubmitting || !manualTxnRef.trim()}>Submit</Button>
                        </div>
                      )}
                    </div>
                    <div className={cn('rounded-xl border cursor-pointer', buyPayMethod === 'bank' ? 'border-primary bg-primary/5' : 'border-border')} onClick={() => setBuyPayMethod('bank')}>
                      <div className="flex items-center gap-3 p-3"><CreditCard className="h-4 w-4" /><div><p className="font-medium text-sm">Bank Transfer</p><p className="text-xs text-muted-foreground">NEFT/IMPS</p></div></div>
                      {buyPayMethod === 'bank' && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-background rounded p-2"><p className="text-muted-foreground">A/C</p><p className="font-mono font-bold">{bankDetails.accountNumber}</p></div>
                            <div className="bg-background rounded p-2"><p className="text-muted-foreground">IFSC</p><p className="font-mono font-bold">{bankDetails.ifsc}</p></div>
                          </div>
                          <Input placeholder="Transaction Ref" value={manualTxnRef} onChange={e => setManualTxnRef(e.target.value)} onClick={e => e.stopPropagation()} />
                          <Button className="w-full h-9" onClick={handleManualPayment} disabled={paymentSubmitting || !manualTxnRef.trim()}>Submit</Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center space-y-4 py-6">
                <div className="text-5xl">✅</div>
                <h3 className="text-lg font-black text-foreground">Payment Successful!</h3>
                {generatedLicenseKey && (
                  <div className="bg-muted rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Your License Key</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-bold text-primary flex-1 break-all">{generatedLicenseKey}</code>
                      <Button size="sm" variant="outline" onClick={() => handleCopy(generatedLicenseKey, 'License Key')}><Copy className="h-3 w-3" /></Button>
                    </div>
                  </div>
                )}
                <Button className="w-full" onClick={() => setShowPayment(false)}>Done</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
