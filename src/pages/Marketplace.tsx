import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { UpcomingSection } from '@/components/marketplace/UpcomingSection';
import { OnDemandSection } from '@/components/marketplace/OnDemandSection';
import { TopSellingSection } from '@/components/marketplace/TopSellingSection';
import { PopularProductsSection } from '@/components/marketplace/PopularProductsSection';
import { EducationSection } from '@/components/marketplace/EducationSection';
import { HealthcareSection } from '@/components/marketplace/HealthcareSection';
import { RealEstateSection } from '@/components/marketplace/RealEstateSection';
import { EcommerceSection } from '@/components/marketplace/EcommerceSection';
import { RetailSection } from '@/components/marketplace/RetailSection';
import { FoodDeliverySection } from '@/components/marketplace/FoodDeliverySection';
import { HospitalitySection } from '@/components/marketplace/HospitalitySection';
import { TransportationSection } from '@/components/marketplace/TransportationSection';
import { FinanceSection } from '@/components/marketplace/FinanceSection';
import { MediaStreamingSection } from '@/components/marketplace/MediaStreamingSection';
import { SocialMediaSection } from '@/components/marketplace/SocialMediaSection';
import { AiAutomationSection } from '@/components/marketplace/AiAutomationSection';
import { DevToolsSection } from '@/components/marketplace/DevToolsSection';
import { ProductivitySection } from '@/components/marketplace/ProductivitySection';
import { CybersecuritySection } from '@/components/marketplace/CybersecuritySection';
import { DataAnalyticsSection } from '@/components/marketplace/DataAnalyticsSection';
import { ElearningSection } from '@/components/marketplace/ElearningSection';
import { TelemedicineSection } from '@/components/marketplace/TelemedicineSection';
import { RealEstateMarketplaceSection } from '@/components/marketplace/RealEstateMarketplaceSection';
import { GamingPlatformSection } from '@/components/marketplace/GamingPlatformSection';
import { MarketingGrowthSection } from '@/components/marketplace/MarketingGrowthSection';
import { CustomerSupportSection } from '@/components/marketplace/CustomerSupportSection';
import { HrRecruitmentSection } from '@/components/marketplace/HrRecruitmentSection';
import { LegalTechSection } from '@/components/marketplace/LegalTechSection';
import { LogisticsDeliverySection } from '@/components/marketplace/LogisticsDeliverySection';
import { IoTSmartDeviceSection } from '@/components/marketplace/IoTSmartDeviceSection';
import { BlockchainWeb3Section } from '@/components/marketplace/BlockchainWeb3Section';
import { DesignCreativeSection } from '@/components/marketplace/DesignCreativeSection';
import { TravelBookingSection } from '@/components/marketplace/TravelBookingSection';
import { FoodDeliveryPlatformSection } from '@/components/marketplace/FoodDeliveryPlatformSection';
import { HealthcareTelemedicineSection } from '@/components/marketplace/HealthcareTelemedicineSection';
import { EducationElearningSection } from '@/components/marketplace/EducationElearningSection';
import { FinanceFintechSection } from '@/components/marketplace/FinanceFintechSection';
import { RecruitmentJobSection } from '@/components/marketplace/RecruitmentJobSection';
import { RealEstatePropertySection } from '@/components/marketplace/RealEstatePropertySection';
import { MarketplaceSectionDivider } from '@/components/marketplace/MarketplaceSectionDivider';
import { MarketplaceCategoryRow } from '@/components/marketplace/MarketplaceCategoryRow';
import { MARKETPLACE_CATEGORIES } from '@/data/marketplaceCategories';
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
import { Input } from '@/components/ui/input';
import { 
  CheckCircle2, Download, ShoppingCart, CreditCard, AlertTriangle, Shield,
  Wallet, Loader2, ChevronDown, ChevronUp, Copy, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  status: 'upcoming' | 'live' | 'bestseller' | 'draft';
  price: number;
}

const bankDetails = {
  accountName: 'SOFTWARE VALA',
  bankName: 'INDIAN BANK',
  accountNumber: '8045924772',
  accountNumberMasked: '••••••4772',
  ifsc: 'IDIB000K196',
  ifscMasked: 'IDIB•••196',
  branchName: 'KANKAR BAGH',
  upiId: 'softwarevala@indianbank',
};

const cryptoDetails = {
  binanceId: '1078928519',
  binanceIdMasked: '•••••8519',
};

type BuyPayMethod = 'wallet' | 'upi' | 'bank' | 'crypto';

export default function Marketplace() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [generatedLicenseKey, setGeneratedLicenseKey] = useState<string>('');
  const [_transactionId, setTransactionId] = useState<string>('');
  const [showMorePayment, setShowMorePayment] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [buyPayMethod, setBuyPayMethod] = useState<BuyPayMethod>('wallet');
  const [manualTxnRef, setManualTxnRef] = useState('');
  const [manualSubmitted, setManualSubmitted] = useState(false);
  const paymentLockRef = useRef(false);
  const { purchaseApk, processing } = useApkPurchase();
  const { checkUserStatus } = useFraudDetection();
  const { user } = useAuth();
  const navigate = useNavigate();
  useMarketplaceProducts(); // warm cache

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
    setBuyPayMethod('wallet');
    setManualTxnRef('');
    setManualSubmitted(false);
    paymentLockRef.current = false;
  };

  const handleWalletPayment = async () => {
    if (!selectedProduct || paymentLockRef.current) return;
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
      paymentLockRef.current = false;
    }
    setPaymentSubmitting(false);
  };

  const handleManualPayment = async () => {
    if (!manualTxnRef.trim()) {
      toast.error('Please enter your transaction reference');
      return;
    }
    if (!selectedProduct || !user) return;
    setPaymentSubmitting(true);
    try {
      const { data: walletData } = await supabase
        .from('wallets').select('id').eq('user_id', user.id).maybeSingle();
      if (walletData) {
        await supabase.from('transactions').insert({
          wallet_id: walletData.id,
          type: 'credit',
          amount: selectedProduct.price,
          balance_after: null,
          status: 'pending',
          description: `${buyPayMethod.toUpperCase()} Payment for ${selectedProduct.title} - Awaiting Verification`,
          created_by: user.id,
          reference_id: manualTxnRef,
          reference_type: buyPayMethod,
          meta: { payment_method: buyPayMethod, transaction_ref: manualTxnRef, product_id: selectedProduct.id },
        });
      }
      await logPaymentAttempt(selectedProduct, buyPayMethod, 'pending');
      setManualSubmitted(true);
    } catch {
      toast.error('Submission failed. Please try again.');
    }
    setPaymentSubmitting(false);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const _handleFavorite = (product: Product) => {
    toast.success(`${product.title} added to favorites`);
  };

  const _handleNotify = (product: Product) => {
    toast.success(`You'll be notified when ${product.title} launches`);
  };

  const _handleDownloadApk = (product: Product) => {
    if (!user) {
      toast.error('Please sign in to download APK');
      return;
    }
    handleBuyNow(product);
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0B1020 0%, #0d1428 50%, #0B1020 100%)' }}>
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

        <MarketplaceSectionDivider label="evergreen" />

        {/* ━━━ SECTION 4: POPULAR PRODUCTS ━━━ */}
        <PopularProductsSection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="education" />

        {/* ━━━ SECTION 5: EDUCATION & SKILL DEVELOPMENT ━━━ */}
        <EducationSection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="healthcare" />

        {/* ━━━ SECTION 6: HEALTHCARE & MEDICAL SERVICES ━━━ */}
        <HealthcareSection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="real_estate" />

        {/* ━━━ SECTION 7: REAL ESTATE & PROPERTY SERVICES ━━━ */}
        <RealEstateSection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="ecommerce" />

        {/* ━━━ SECTION 8: E-COMMERCE & ONLINE MARKETPLACES ━━━ */}
        <EcommerceSection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="retail" />

        {/* ━━━ SECTION 9: RETAIL & POS SYSTEMS ━━━ */}
        <RetailSection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="food" />

        {/* ━━━ SECTION 10: FOOD DELIVERY & RESTAURANT SYSTEMS ━━━ */}
        <FoodDeliverySection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="hotel" />

        {/* ━━━ SECTION 11: HOSPITALITY & HOTEL BOOKING SYSTEMS ━━━ */}
        <HospitalitySection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="transport" />

        {/* ━━━ SECTION 12: TRANSPORTATION & RIDE SHARING APPS ━━━ */}
        <TransportationSection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="finance" />

        {/* ━━━ SECTION 13: FINANCE & FINTECH PLATFORMS ━━━ */}
        <FinanceSection onBuyNow={handleBuyNow} />

        <MarketplaceSectionDivider label="media" />

        {/* ━━━ SECTION 14: MEDIA, STREAMING & ENTERTAINMENT ━━━ */}
        <MediaStreamingSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 15: SOCIAL MEDIA & COMMUNITY ━━━ */}
        <SocialMediaSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 16: AI & AUTOMATION ━━━ */}
        <AiAutomationSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 17: DEVELOPER TOOLS & DEVOPS ━━━ */}
        <DevToolsSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 18: PRODUCTIVITY & WORKSPACE ━━━ */}
        <ProductivitySection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 19: CYBERSECURITY & PRIVACY ━━━ */}
        <CybersecuritySection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 20: DATA ANALYTICS & BI ━━━ */}
        <DataAnalyticsSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 21: EDUCATION & E-LEARNING ━━━ */}
        <ElearningSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 22: HEALTHCARE & TELEMEDICINE ━━━ */}
        <TelemedicineSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 23: REAL ESTATE & PROPERTY ━━━ */}
        <RealEstateMarketplaceSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 24: GAMING PLATFORMS ━━━ */}
        <GamingPlatformSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 25: MARKETING & GROWTH ━━━ */}
        <MarketingGrowthSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 26: CUSTOMER SUPPORT & HELP DESK ━━━ */}
        <CustomerSupportSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 27: HR & RECRUITMENT ━━━ */}
        <HrRecruitmentSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 28: LEGAL TECH & DOCUMENT AUTOMATION ━━━ */}
        <LegalTechSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 29: LOGISTICS & DELIVERY MANAGEMENT ━━━ */}
        <LogisticsDeliverySection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 30: IoT & SMART DEVICE PLATFORMS ━━━ */}
        <IoTSmartDeviceSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 31: BLOCKCHAIN & WEB3 PLATFORMS ━━━ */}
        <BlockchainWeb3Section onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 32: DESIGN & CREATIVE TOOLS ━━━ */}
        <DesignCreativeSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 33: TRAVEL & BOOKING PLATFORMS ━━━ */}
        <TravelBookingSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 34: FOOD DELIVERY & RESTAURANT PLATFORMS ━━━ */}
        <FoodDeliveryPlatformSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 35: HEALTHCARE & TELEMEDICINE PLATFORMS ━━━ */}
        <HealthcareTelemedicineSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 36: EDUCATION & E-LEARNING PLATFORMS ━━━ */}
        <EducationElearningSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 37: FINANCE & FINTECH PLATFORMS ━━━ */}
        <FinanceFintechSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 38: RECRUITMENT & JOB PLATFORMS ━━━ */}
        <RecruitmentJobSection onBuyNow={handleBuyNow} />

        {/* ━━━ SECTION 39: REAL ESTATE & PROPERTY PLATFORMS ━━━ */}
        <RealEstatePropertySection onBuyNow={handleBuyNow} />

        {/* ━━━ DYNAMIC CATEGORY ROWS (Rows 41+) ━━━ */}
        {MARKETPLACE_CATEGORIES.filter(cat => !['healthcare', 'real_estate', 'ecommerce', 'retail', 'restaurant', 'hotel', 'transport', 'finance', 'media_gaming', 'marketing', 'ai_automation', 'cloud_devops', 'it_software', 'cybersecurity', 'investment', 'logistics', 'manufacturing', 'construction', 'automotive', 'agriculture', 'energy', 'telecom', 'legal', 'beauty_fashion', 'home_services', 'security_systems', 'government', 'gym_sports', 'research', 'environment', 'mining', 'wholesale', 'pharma', 'travel', 'property'].includes(cat.id)).map((cat, idx) => (
          <motion.div key={cat.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (idx + 6) * 0.03 }}>
            <MarketplaceCategoryRow category={cat} onBuyNow={handleBuyNow} />
            {idx < MARKETPLACE_CATEGORIES.length - 1 && (
              <MarketplaceSectionDivider label={cat.id} />
            )}
          </motion.div>
        ))}
      </main>

      {/* ━━━ PRICING SECTION ━━━ */}
      <section id="pricing" className="py-16 px-4 md:px-8 border-t border-border">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-4xl font-black uppercase text-foreground mb-4">
            💰 Simple Pricing
          </h2>
          <p className="text-muted-foreground mb-8">Every software. One price. No hidden fees.</p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="rounded-2xl border border-border p-6 flex flex-col items-center gap-3">
              <h3 className="font-bold text-lg text-foreground">Free Trial</h3>
              <p className="text-4xl font-black text-foreground">$0</p>
              <p className="text-sm text-muted-foreground">7-day demo access</p>
              <ul className="text-sm text-muted-foreground space-y-2 mt-3">
                <li>✅ Live demo access</li>
                <li>✅ View all features</li>
                <li>❌ No source code</li>
                <li>❌ No license key</li>
              </ul>
              <Button variant="outline" className="w-full mt-4" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                Browse Software
              </Button>
            </div>

            {/* Pro — highlighted */}
            <div className="rounded-2xl border-2 border-primary p-6 flex flex-col items-center gap-3 relative bg-primary/5">
              <Badge className="absolute -top-3 bg-primary text-primary-foreground text-xs font-black px-3">MOST POPULAR</Badge>
              <h3 className="font-bold text-lg text-foreground">Pro License</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-sm line-through text-muted-foreground">$10</span>
                <p className="text-4xl font-black text-primary">$5</p>
                <span className="text-sm text-muted-foreground">/software</span>
              </div>
              <p className="text-sm text-muted-foreground">30-day license + source code</p>
              <ul className="text-sm text-muted-foreground space-y-2 mt-3">
                <li>✅ Full source code</li>
                <li>✅ License key</li>
                <li>✅ APK download</li>
                <li>✅ 30-day access</li>
              </ul>
              <Button className="w-full mt-4" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                Buy Now — $5
              </Button>
            </div>

            {/* Enterprise */}
            <div className="rounded-2xl border border-border p-6 flex flex-col items-center gap-3">
              <h3 className="font-bold text-lg text-foreground">Enterprise</h3>
              <p className="text-4xl font-black text-foreground">Custom</p>
              <p className="text-sm text-muted-foreground">White-label + deployment</p>
              <ul className="text-sm text-muted-foreground space-y-2 mt-3">
                <li>✅ Everything in Pro</li>
                <li>✅ White-label branding</li>
                <li>✅ Custom deployment</li>
                <li>✅ Priority support</li>
              </ul>
              <Button variant="outline" className="w-full mt-4" onClick={() => {
                const el = document.getElementById('contact');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}>
                Contact Sales
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ━━━ DEMO SECTION ━━━ */}
      <section id="demo" className="py-16 px-4 md:px-8 border-t border-border">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-4xl font-black uppercase text-foreground mb-4">
            🎮 Try Live Demos
          </h2>
          <p className="text-muted-foreground mb-8">Every product has a live demo. Click "DEMO" on any product card to try instantly.</p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border p-6 text-center">
              <div className="text-4xl mb-3">🖥️</div>
              <h3 className="font-bold text-foreground mb-2">Instant Access</h3>
              <p className="text-sm text-muted-foreground">Click the green "LIVE DEMO" badge on any product card to get demo credentials instantly.</p>
            </div>
            <div className="rounded-2xl border border-border p-6 text-center">
              <div className="text-4xl mb-3">🔑</div>
              <h3 className="font-bold text-foreground mb-2">Demo Credentials</h3>
              <p className="text-sm text-muted-foreground">Each demo comes with pre-configured login credentials. Copy & paste to access.</p>
            </div>
            <div className="rounded-2xl border border-border p-6 text-center">
              <div className="text-4xl mb-3">📱</div>
              <h3 className="font-bold text-foreground mb-2">GitHub Source</h3>
              <p className="text-sm text-muted-foreground">Most products link directly to GitHub repos. Browse code before you buy.</p>
            </div>
          </div>

          <Button className="mt-8 gap-2" size="lg" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Browse All 2000+ Products
          </Button>
        </motion.div>
      </section>

      {/* ━━━ CONTACT SECTION ━━━ */}
      <section id="contact" className="py-16 px-4 md:px-8 border-t border-border">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-4xl font-black uppercase text-foreground mb-4">
            📬 Contact Us
          </h2>
          <p className="text-muted-foreground mb-8">Have questions? Need custom software? We're here to help.</p>

          <div className="grid gap-4 text-left">
            <a
              href="mailto:support@saasvala.com"
              className="rounded-2xl border border-border p-5 flex items-center gap-4 hover:border-primary/50 transition-colors"
            >
              <div className="text-2xl">📧</div>
              <div>
                <p className="font-bold text-foreground">Email</p>
                <p className="text-sm text-muted-foreground">support@saasvala.com</p>
              </div>
            </a>
            <a
              href="https://wa.me/919876543210"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-border p-5 flex items-center gap-4 hover:border-primary/50 transition-colors"
            >
              <div className="text-2xl">💬</div>
              <div>
                <p className="font-bold text-foreground">WhatsApp</p>
                <p className="text-sm text-muted-foreground">Chat with us instantly</p>
              </div>
            </a>
            <a
              href="https://github.com/softwarevala"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-border p-5 flex items-center gap-4 hover:border-primary/50 transition-colors"
            >
              <div className="text-2xl">🐙</div>
              <div>
                <p className="font-bold text-foreground">GitHub</p>
                <p className="text-sm text-muted-foreground">View our open-source repos</p>
              </div>
            </a>
          </div>
        </motion.div>
      </section>

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
                    {selectedProduct?.title} — ${selectedProduct?.price ?? ''}
                  </DialogDescription>
                </DialogHeader>

                {/* ── WALLET (Primary) ── */}
                <div
                  className={cn(
                    'rounded-xl border-2 cursor-pointer transition-all p-4',
                    buyPayMethod === 'wallet' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  )}
                  onClick={() => setBuyPayMethod('wallet')}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Wallet Balance</p>
                      <p className="text-xs text-muted-foreground">Deduct directly from your wallet — fastest checkout</p>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Instant</Badge>
                  </div>
                </div>

                {/* ── PAY FROM WALLET BUTTON ── */}
                {buyPayMethod === 'wallet' && (
                  <Button
                    className="w-full gap-2 h-12"
                    onClick={handleWalletPayment}
                    disabled={paymentSubmitting || processing}
                  >
                    {paymentSubmitting || processing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Processing... Do not close</>
                    ) : (
                      <><ShoppingCart className="h-4 w-4" /> Pay ${selectedProduct?.price} from Wallet</>
                    )}
                  </Button>
                )}

                {/* ── MORE PAYMENT OPTIONS ── */}
                <button
                  className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
                  onClick={() => setShowMorePayment(!showMorePayment)}
                >
                  {showMorePayment ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showMorePayment ? 'Hide' : 'More'} Payment Options (UPI / Bank / Crypto)
                </button>

                {showMorePayment && (
                  <div className="space-y-2">
                    {/* UPI */}
                    <div
                      className={cn(
                        'rounded-xl border cursor-pointer transition-all',
                        buyPayMethod === 'upi' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                      )}
                      onClick={() => setBuyPayMethod('upi')}
                    >
                      <div className="flex items-center gap-3 p-3">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">UPI Payment</p>
                          <p className="text-xs text-muted-foreground">GPay, PhonePe, Paytm, BHIM 🇮🇳</p>
                        </div>
                      </div>
                      {buyPayMethod === 'upi' && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
                          <div className="bg-background rounded-lg p-2 flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">UPI ID</p>
                              <p className="font-mono font-semibold text-sm">{bankDetails.upiId}</p>
                            </div>
                            <button
                              className="text-xs text-primary border border-primary/30 px-2 py-1 rounded hover:bg-primary/10"
                              onClick={(e) => { e.stopPropagation(); handleCopy(bankDetails.upiId, 'UPI ID'); }}
                            >
                              <Copy className="h-3 w-3 inline mr-1" />Copy
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">Send ${selectedProduct?.price} → enter Transaction ID below</p>
                          <Input placeholder="UPI Transaction ID" value={manualTxnRef} onChange={e => setManualTxnRef(e.target.value)} onClick={e => e.stopPropagation()} />
                          <Button className="w-full h-10" onClick={handleManualPayment} disabled={paymentSubmitting || !manualTxnRef.trim()}>
                            {paymentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit UPI Payment'}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Bank Transfer */}
                    <div
                      className={cn(
                        'rounded-xl border cursor-pointer transition-all',
                        buyPayMethod === 'bank' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                      )}
                      onClick={() => setBuyPayMethod('bank')}
                    >
                      <div className="flex items-center gap-3 p-3">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">Bank Transfer (NEFT/IMPS)</p>
                          <p className="text-xs text-muted-foreground">🇮🇳 India • Verify in 2-4 hrs</p>
                        </div>
                      </div>
                      {buyPayMethod === 'bank' && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-background rounded-lg p-2">
                              <p className="text-muted-foreground">Account No.</p>
                              <p className="font-mono font-semibold">{bankDetails.accountNumberMasked}</p>
                              <button className="text-primary text-[10px]" onClick={e => { e.stopPropagation(); handleCopy(bankDetails.accountNumber, 'Account Number'); }}>Copy</button>
                            </div>
                            <div className="bg-background rounded-lg p-2">
                              <p className="text-muted-foreground">IFSC</p>
                              <p className="font-mono font-semibold">{bankDetails.ifscMasked}</p>
                              <button className="text-primary text-[10px]" onClick={e => { e.stopPropagation(); handleCopy(bankDetails.ifsc, 'IFSC'); }}>Copy</button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{bankDetails.bankName} • {bankDetails.branchName}</p>
                          <Input placeholder="UTR / Transaction Reference" value={manualTxnRef} onChange={e => setManualTxnRef(e.target.value)} onClick={e => e.stopPropagation()} />
                          <Button className="w-full h-10" onClick={handleManualPayment} disabled={paymentSubmitting || !manualTxnRef.trim()}>
                            {paymentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "I've Paid — Submit"}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Crypto */}
                    <div
                      className={cn(
                        'rounded-xl border cursor-pointer transition-all',
                        buyPayMethod === 'crypto' ? 'border-amber-500 bg-amber-500/5' : 'border-border hover:border-amber-500/30'
                      )}
                      onClick={() => setBuyPayMethod('crypto')}
                    >
                      <div className="flex items-center gap-3 p-3">
                        <span className="text-amber-500 font-bold text-sm">₿</span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">Crypto (BTC / USDT)</p>
                          <p className="text-xs text-muted-foreground">🌍 Binance Pay • Borderless</p>
                        </div>
                      </div>
                      {buyPayMethod === 'crypto' && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
                          <div className="bg-background rounded-lg p-2 flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">Binance Pay ID</p>
                              <p className="font-mono font-semibold">{cryptoDetails.binanceIdMasked}</p>
                            </div>
                            <button className="text-xs text-primary border border-primary/30 px-2 py-1 rounded" onClick={e => { e.stopPropagation(); handleCopy(cryptoDetails.binanceId, 'Binance ID'); }}>
                              <Copy className="h-3 w-3 inline mr-1" />Copy
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">USDT (TRC20), BTC, BEP20 supported</p>
                          <Input placeholder="Txn Hash / Binance Order ID" value={manualTxnRef} onChange={e => setManualTxnRef(e.target.value)} onClick={e => e.stopPropagation()} />
                          <Button className="w-full h-10 border-amber-500 text-amber-400 hover:bg-amber-500/10" variant="outline" onClick={handleManualPayment} disabled={paymentSubmitting || !manualTxnRef.trim()}>
                            {paymentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Crypto Payment'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pending confirmation after manual submit */}
                {manualSubmitted && (
                  <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Payment Submitted!</p>
                      <p className="text-[11px] text-muted-foreground">Will be verified in 2-4 hours. Ref: {manualTxnRef}</p>
                    </div>
                  </div>
                )}

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
                        <p className="text-xs text-muted-foreground mt-2">⚠️ Save this key — proof of purchase & activation key</p>
                      </div>
                    )}
                  </div>
                  <Button className="w-full gap-2" onClick={async () => {
                    if (selectedProduct && generatedLicenseKey) {
                      try {
                        const { data } = await supabase.functions.invoke('download-apk', {
                          body: { product_id: selectedProduct.id, license_key: generatedLicenseKey },
                        });
                        if (data?.success && data?.download_url) {
                          window.open(data.download_url, '_blank');
                          toast.success('APK download started!');
                        } else {
                          toast.info('APK file will be uploaded soon. Your license key is saved.');
                          navigate('/keys');
                        }
                      } catch {
                        toast.info('APK will be available soon. License key saved.');
                        navigate('/keys');
                      }
                    }
                    setShowPayment(false);
                  }}>
                    <Download className="h-4 w-4" />
                    Download APK
                  </Button>
                  <Button variant="outline" className="w-full gap-2" onClick={() => { setShowPayment(false); navigate('/keys'); }}>
                    View License Keys
                  </Button>
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setShowPayment(false)}>
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
