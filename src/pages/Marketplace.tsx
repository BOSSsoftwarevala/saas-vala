import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { LazySection } from '@/components/marketplace/LazySection';
import { MarketplaceCategoryRow } from '@/components/marketplace/MarketplaceCategoryRow';
import { MARKETPLACE_CATEGORIES } from '@/data/marketplaceCategories';
import { useMarketplaceProducts, type MarketplaceProduct } from '@/hooks/useMarketplaceProducts';
import { toast } from 'sonner';
import { useFraudDetection } from '@/hooks/useFraudDetection';
import { useAuth } from '@/hooks/useAuth';
import { dashboardApi } from '@/lib/dashboardApi';
import { publicMarketplaceApi } from '@/lib/api';
import { HeroBannerSlider } from '@/components/marketplace/HeroBannerSlider';
import { supabase } from '@/integrations/supabase/client';
import { generateSecureOfflineLicenseKey } from '@/lib/licenseUtils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ShoppingCart, CreditCard, Wallet, Loader2, ChevronDown, ChevronUp, Copy, Key, Download,
  Send, Paperclip, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const WISE_PAY_LINK = 'https://wise.com/pay/business/manojkumar21?utm_source=quick_pay';

const bankDetails = {
  accountName: 'SOFTWARE VALA', bankName: 'INDIAN BANK',
  accountNumber: '8045924772', ifsc: 'IDIB000K196',
  branchName: 'KANKAR BAGH', upiId: 'softwarevala@indianbank',
};


type BuyPayMethod = 'wallet' | 'wise' | 'upi' | 'bank' | 'crypto';

const offers = [
  'Festival Buy 3 Get 1 FREE',
  'India Special ₹99',
  'Eid Sale RTL Ready',
  'Transport & Logistics NEW',
  'Finance & Banking HOT',
];

const bannerSlides = [
  {
    id: 'healthcare-banner',
    title: 'Healthcare & Medical Software',
    subtitle: 'Hospital, clinic and pharmacy systems with APK downloads.',
    image: 'https://images.unsplash.com/photo-1580281657521-90c5213f4876?w=1200&h=520&fit=crop',
    linkedCategory: 'Healthcare',
  },
  {
    id: 'finance-banner',
    title: 'Banking & Finance Tools',
    subtitle: 'Loan originating, accounting and payment platforms.',
    image: 'https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?w=1200&h=520&fit=crop',
    linkedCategory: 'Finance',
  },
  {
    id: 'transport-banner',
    title: 'Transport & Logistics Suite',
    subtitle: 'Fleet management, delivery tracking and logistics apps.',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&h=520&fit=crop',
    linkedCategory: 'Transport',
  },
];

export default function Marketplace() {
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [generatedLicenseKey, setGeneratedLicenseKey] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [showMorePayment, setShowMorePayment] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [buyPayMethod, setBuyPayMethod] = useState<BuyPayMethod>('wise');
  const [manualTxnRef, setManualTxnRef] = useState('');
  const [_manualSubmitted, setManualSubmitted] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const paymentLockRef = useRef(false);
  const purchaseLockRef = useRef<Record<string, boolean>>({});
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [resellerCredits, setResellerCredits] = useState<number | null>(null);
  const [ownedLicenseKeys, setOwnedLicenseKeys] = useState<any[]>([]);
  const navigate = useNavigate();
  const buyParamHandled = useRef(false);
  const { checkUserStatus } = useFraudDetection();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { products } = useMarketplaceProducts();
  const [searchQuery, setSearchQuery] = useState('');

  const healthcareCategory = useMemo(
    () => MARKETPLACE_CATEGORIES.find((category) => category.id === 'healthcare'),
    []
  );

  const healthcareProducts = useMemo(() => {
    if (!healthcareCategory) return [];
    const keywords = healthcareCategory.keywords.map((keyword) => keyword.toLowerCase());
    return products.filter((product) => {
      const category = (product.category || '').toLowerCase();
      const businessType = (product.businessType || '').toLowerCase();
      return keywords.some((keyword) => category.includes(keyword) || businessType.includes(keyword));
    });
  }, [products, healthcareCategory]);

  const filteredHealthcareProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return healthcareProducts;
    return healthcareProducts.filter((product) =>
      product.title.toLowerCase().includes(query) ||
      product.subtitle.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query) ||
      product.businessType.toLowerCase().includes(query)
    );
  }, [healthcareProducts, searchQuery]);

  const visibleProducts = useMemo(() => filteredHealthcareProducts.slice(0, 10), [filteredHealthcareProducts]);

  const loadResellerData = async () => {
    if (!user) {
      setResellerId(null);
      setResellerCredits(null);
      setOwnedLicenseKeys([]);
      return;
    }

    try {
      const { data: reseller, error: resellerError } = await supabase
        .from('resellers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (resellerError || !reseller) {
        setResellerId(null);
        setResellerCredits(null);
        setOwnedLicenseKeys([]);
        return;
      }

      setResellerId(reseller.id);

      const { data: wallet } = await (supabase as any)
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      setResellerCredits(Number(wallet?.balance || 0));

      const { data: keys, error: keysError } = await (supabase as any)
        .from('license_keys')
        .select('*')
        .eq('assigned_to', reseller.id);

      if (!keysError && Array.isArray(keys)) {
        setOwnedLicenseKeys(keys);
      }
    } catch (loadError) {
      console.error('Failed to load reseller data:', loadError);
    }
  };

  useEffect(() => {
    loadResellerData();
  }, [user]);

  const openPaymentDialog = (product: MarketplaceProduct) => {
    setSelectedProduct(product);
    setBuyPayMethod('wise');
    setManualTxnRef('');
    setProofFile(null);
    setPaymentSuccess(false);
    setGeneratedLicenseKey('');
    setDownloadUrl('');
    setShowMorePayment(false);
    setShowPayment(true);
  };

  const handleDemo = (product: MarketplaceProduct) => {
    if (user?.id && product.id) {
      publicMarketplaceApi
        .logDemoAccess(product.id, crypto.randomUUID())
        .catch(() => {});
    }
    const demoUrl = product.demoUrl || (product as any).demo_url;
    if (demoUrl) {
      window.open(demoUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(`/demo/${product.id}`);
  };

  // Handle ?buy=PRODUCT_ID query param coming from cart checkout
  useEffect(() => {
    if (buyParamHandled.current) return;
    const buyId = searchParams.get('buy');
    if (!buyId || !products.length) return;
    buyParamHandled.current = true;
    const product = products.find((p) => p.id === buyId);
    if (product) {
      setSearchParams((prev) => { prev.delete('buy'); return prev; }, { replace: true });
      handleBuyNow(product);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, searchParams]);

  const handleBuyNow = async (product: MarketplaceProduct) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    // Block mock products
    if (product.id.startsWith('gen-')) {
      toast.error('This is a demo product and cannot be purchased.');
      return;
    }

    if (purchaseLockRef.current[product.id]) {
      return;
    }

    purchaseLockRef.current[product.id] = true;

    try {
      const fraudStatus = await checkUserStatus(user.id, user.email || '');
      if (fraudStatus.isBlocked) {
        toast.error(fraudStatus.message);
        return;
      }

      const { data: roleRows, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (roleError || !Array.isArray(roleRows)) {
        toast.error('Unable to verify account role. Please try again.');
        return;
      }

      const isReseller = roleRows.some((row: any) => row.role === 'reseller');
      if (!isReseller) {
        openPaymentDialog(product);
        return;
      }

      const { data: reseller, error: resellerError } = await supabase
        .from('resellers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (resellerError || !reseller) {
        toast.error('Unable to verify reseller account.');
        return;
      }

      const { data: wallet } = await (supabase as any)
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (Number(wallet?.balance || 0) < Number(product.price || 0)) {
        toast.error('Insufficient balance');
        return;
      }

      const result = await dashboardApi.resellerPurchaseProduct(product.id, user.id);

      if (result.success) {
        toast.success('🎉 Purchase successful! License key generated and saved.');
        if (result.wallet && typeof result.wallet.balance === 'number') {
          setResellerCredits(result.wallet.balance);
        }
        if (result.licenseKey) {
          setOwnedLicenseKeys((prev) => [...prev, result.licenseKey]);
        }

        if (!resellerId && result.reseller?.id) {
          setResellerId(result.reseller.id);
        }
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Purchase failed. Please try again.');
    } finally {
      purchaseLockRef.current[product.id] = false;
    }
  };

  const handleWalletPayment = async () => {
    if (!selectedProduct || paymentLockRef.current) return;
    paymentLockRef.current = true;
    setPaymentSubmitting(true);
    try {
      const result = await publicMarketplaceApi.initiatePayment({
        product_id: selectedProduct.id,
        duration_days: 30,
        payment_method: 'wallet',
        amount: Number(selectedProduct.price || 0),
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Payment failed');
      }

      setPaymentSuccess(true);
      setGeneratedLicenseKey(String(result.license_key || ''));
      setDownloadUrl('');
      toast.success('Payment successful. Order created and license issued.');
    } catch (error: any) {
      toast.error(error?.message || 'Payment failed');
    } finally {
      paymentLockRef.current = false;
      setPaymentSubmitting(false);
    }
  };

  const handleManualPayment = async () => {
    if (!manualTxnRef.trim() || !selectedProduct || !user) return;
    setPaymentSubmitting(true);
    try {
      const paymentMethodForApi = buyPayMethod === 'crypto' ? 'binance' : buyPayMethod;
      const orderResponse = await publicMarketplaceApi.initiatePayment({
        product_id: selectedProduct.id,
        duration_days: 30,
        payment_method: paymentMethodForApi as 'wallet' | 'upi' | 'bank' | 'wise' | 'payu' | 'binance',
        amount: Number(selectedProduct.price || 0),
      });
      if (!orderResponse?.success || !orderResponse?.order_id) {
        throw new Error(orderResponse?.error || 'Failed to create order');
      }

      const { data: w } = await supabase.from('wallets').select('id').eq('user_id', user.id).maybeSingle();
      if (!w) {
        toast.error('Wallet not found. Please contact support.');
        return;
      }

      const normalizedRefType =
        buyPayMethod === 'bank'
          ? 'bank_transfer'
          : buyPayMethod === 'crypto'
          ? 'crypto_transfer'
          : buyPayMethod;

      // Create pending transaction (payment not yet verified by admin)
      const { data: transaction, error: txError } = await (supabase as any).from('transactions').insert({
        wallet_id: w.id,
        order_id: orderResponse.order_id,
        type: 'debit',
        amount: selectedProduct.price,
        status: 'pending',
        description: `${buyPayMethod.toUpperCase()} for ${selectedProduct.title}`,
        created_by: user.id,
        reference_id: manualTxnRef,
        reference_type: normalizedRefType,
        product_id: selectedProduct.id,
        meta: {
          payment_method: buyPayMethod,
          transaction_ref: manualTxnRef,
          product_id: selectedProduct.id,
          product_title: selectedProduct.title,
          transaction_proof: null,
          pending_order_id: orderResponse.order_id,
          payment_mode: 'manual',
          requires_admin_approval: true,
          buyer_user_id: user.id,
        },
      }).select().single();

      if (txError) throw txError;

      // Upload proof file and patch transaction meta if available.
      const proofUrl = await uploadProofFile(user.id, transaction.id);
      if (proofUrl) {
        await (supabase as any).from('transactions').update({
          meta: {
            payment_method: buyPayMethod,
            transaction_ref: manualTxnRef,
            product_id: selectedProduct.id,
            product_title: selectedProduct.title,
            transaction_proof: proofUrl,
            pending_order_id: orderResponse.order_id,
            payment_mode: 'manual',
            requires_admin_approval: true,
            buyer_user_id: user.id,
          },
        }).eq('id', transaction.id);
      }

      // Generate license key immediately; key_status='unused' until admin approves payment
      const secureKeyBundle = await generateSecureOfflineLicenseKey({
        productId: selectedProduct.id,
        assignedTo: user.id,
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Insert license key (not yet active for download — awaiting admin approval)
      await (supabase as any).from('license_keys').insert({
        product_id: selectedProduct.id,
        license_key: secureKeyBundle.key,
        key_signature: secureKeyBundle.signature,
        key_type: 'monthly',
        key_status: 'unused',
        status: 'active',
        owner_email: user.email || null,
        owner_name: user.user_metadata?.full_name || null,
        max_devices: 1,
        activated_devices: 0,
        activated_at: null,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
        purchase_transaction_id: transaction.id,
        notes: `Manual payment (${buyPayMethod.toUpperCase()}): ${manualTxnRef}`,
        meta: {
          product_title: selectedProduct.title,
          transaction_id: transaction.id,
          product_id: selectedProduct.id,
          order_id: orderResponse.order_id,
          payment_method: buyPayMethod,
          transaction_ref: manualTxnRef,
          offline_payload: secureKeyBundle.payload,
          requires_admin_approval: true,
        },
      });

      // Insert APK download record linked to transaction
      await (supabase as any).from('apk_downloads').insert({
        user_id: user.id,
        product_id: selectedProduct.id,
        transaction_id: transaction.id,
        license_key: secureKeyBundle.key,
        is_verified: false,
        verification_attempts: 0,
        is_blocked: false,
      }).catch(() => { /* non-critical */ });

      // Notify admins (fire-and-forget)
      supabase.functions.invoke('send-admin-notification', {
        body: {
          transaction_id: transaction.id,
          amount: selectedProduct.price,
          payment_method: buyPayMethod,
          reference_id: manualTxnRef,
          user_email: user.email ?? 'unknown',
          product_title: selectedProduct.title,
          context: 'product_purchase',
        },
      }).catch(() => {});

      setPaymentSuccess(true);
      setGeneratedLicenseKey(secureKeyBundle.key);
      setDownloadUrl('');
      setManualSubmitted(true);
      setProofFile(null);
      toast.success('Payment submitted. License key generated — download available after admin approval.');
    } catch (error) {
      console.error('Manual payment error:', error);
      toast.error('Submission failed. Please try again.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text); toast.success(`${label} copied!`);
  };

  /** Upload proof file to Supabase Storage, return signed URL or null. */
  const uploadProofFile = async (userId: string, txId: string): Promise<string | null> => {
    if (!proofFile) return null;
    try {
      const ext = proofFile.name.split('.').pop() ?? 'jpg';
      const path = `${userId}/${txId}.${ext}`;
      const { error } = await supabase.storage.from('payment-proofs').upload(path, proofFile, { upsert: true, contentType: proofFile.type });
      if (error) return null;
      const { data: signed } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 60 * 60 * 24 * 365);
      return signed?.signedUrl ?? null;
    } catch { return null; }
  };

  /** Wise product purchase — creates a pending marketplace_order directly. */
  const handleWiseProductPayment = async () => {
    if (!manualTxnRef.trim() || !selectedProduct || !user) return;
    setPaymentSubmitting(true);
    try {
      const orderResponse = await publicMarketplaceApi.initiatePayment({
        product_id: selectedProduct.id,
        duration_days: 30,
        payment_method: 'wise',
        amount: Number(selectedProduct.price || 0),
      });
      if (!orderResponse?.success || !orderResponse?.order_id) {
        throw new Error(orderResponse?.error || 'Failed to create order');
      }

      const { data: w } = await supabase.from('wallets').select('id').eq('user_id', user.id).maybeSingle();
      if (!w) { toast.error('Wallet not found'); return; }

      // 2. Create pending transaction linked to the order
      const { data: tx, error: txErr } = await (supabase as any).from('transactions').insert({
        wallet_id: w.id,
        order_id: orderResponse.order_id,
        type: 'debit',
        amount: selectedProduct.price,
        status: 'pending',
        description: `Wise Payment for ${selectedProduct.title}`,
        created_by: user.id,
        reference_id: manualTxnRef,
        reference_type: 'wise_transfer',
        product_id: selectedProduct.id,
        meta: {
          payment_method: 'wise',
          transaction_ref: manualTxnRef,
          transaction_proof: null,
          product_id: selectedProduct.id,
          product_title: selectedProduct.title,
          pending_order_id: orderResponse.order_id,
          requires_admin_approval: true,
          buyer_user_id: user.id,
        },
      }).select('id').single();

      if (txErr) throw txErr;

      // 3. Upload proof and patch transaction
      const proofUrl = await uploadProofFile(user.id, tx.id);
      if (proofUrl) {
        await (supabase as any).from('transactions').update({
          meta: {
            payment_method: 'wise',
            transaction_ref: manualTxnRef,
            transaction_proof: proofUrl,
            product_id: selectedProduct.id,
            product_title: selectedProduct.title,
            pending_order_id: orderResponse.order_id,
            requires_admin_approval: true,
            buyer_user_id: user.id,
          },
        }).eq('id', tx.id);
      }

      // 4. Generate license key (status=unused until admin approves)
      const secureKeyBundle = await generateSecureOfflineLicenseKey({ productId: selectedProduct.id, assignedTo: user.id });
      const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 30);
      await (supabase as any).from('license_keys').insert({
        product_id: selectedProduct.id,
        license_key: secureKeyBundle.key,
        key_signature: secureKeyBundle.signature,
        key_type: 'monthly', key_status: 'unused', status: 'active',
        owner_email: user.email ?? null,
        owner_name: user.user_metadata?.full_name ?? null,
        max_devices: 1, activated_devices: 0,
        expires_at: expiresAt.toISOString(), created_by: user.id,
        purchase_transaction_id: tx.id,
        notes: `Wise payment pending: ${manualTxnRef}`,
        meta: { product_title: selectedProduct.title, order_id: orderResponse.order_id, transaction_id: tx.id, payment_method: 'wise', offline_payload: secureKeyBundle.payload, requires_admin_approval: true },
      });

      // 5. Notify admins (fire-and-forget)
      supabase.functions.invoke('send-admin-notification', {
        body: {
          transaction_id: tx.id,
          amount: selectedProduct.price,
          payment_method: 'wise',
          reference_id: manualTxnRef,
          user_email: user.email ?? 'unknown',
          product_title: selectedProduct.title,
          context: 'product_purchase',
        },
      }).catch(() => {});

      setManualSubmitted(true);
      setPaymentSuccess(true);
      setGeneratedLicenseKey(secureKeyBundle.key);
      setDownloadUrl('');
      setProofFile(null);
      toast.success('Wise payment submitted! License key ready — download unlocks after admin approval.');
    } catch (err) {
      console.error('Wise product payment error:', err);
      toast.error('Submission failed. Please try again.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleSearchSubmit = () => {
    setSearchQuery((prev) => prev.trim());
    document.getElementById('marketplace-healthcare-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleOfferClick = (offer: string) => {
    setSearchQuery(offer);
  };

  const handleBannerClick = (linkedCategory?: string) => {
    if (!linkedCategory) {
      setSearchQuery('');
      return;
    }
    setSearchQuery(linkedCategory);
  };

  return (
    <div className="min-h-screen" style={{ background: '#0B1020' }}>
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
      />
      <div className="pt-16">
        {/* Top Offers Strip */}
        <div className="bg-primary/10 border-b border-primary/20 py-2 overflow-hidden">
          <div className="flex items-center whitespace-nowrap animate-marquee">
            {offers.map((offer, i) => (
              <button
                type="button"
                key={i}
                className="inline-flex items-center mx-6 text-sm font-medium text-primary cursor-pointer hover:text-primary/80 transition-colors"
                onClick={() => handleOfferClick(offer)}
              >
                {offer}
              </button>
            ))}
          </div>
        </div>

        <main className="pb-8">
          <HeroBannerSlider slides={bannerSlides} onBannerClick={handleBannerClick} />

        <div id="marketplace-healthcare-section" className="px-4 md:px-8 mt-4 mb-4 text-sm text-muted-foreground">
          {searchQuery.trim()
            ? `${filteredHealthcareProducts.length} Healthcare products matching “${searchQuery.trim()}”`
            : `${healthcareProducts.length} Healthcare & Medical products available`}
        </div>

        {/* Healthcare & Medical Category Only */}
        {MARKETPLACE_CATEGORIES
          .filter(cat => cat.title === 'Healthcare & Medical')
          .map((cat) => (
            <LazySection key={cat.id} height={280}>
              <MarketplaceCategoryRow
                category={cat}
                onBuyNow={handleBuyNow}
                onDemo={handleDemo}
                productsOverride={visibleProducts}
              />
            </LazySection>
          ))}
      </main>

      {/* Payment Dialog */}
      {/* Payment Dialog */}
      {showPayment && (
        <Dialog open={showPayment} onOpenChange={o => {
          if (!paymentSubmitting) {
            setShowPayment(o); paymentLockRef.current = false;
            setProofFile(null); setManualTxnRef('');
          }
        }}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            {/* Hidden proof file input shared across payment methods */}
            <input
              ref={proofInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              className="hidden"
              onChange={(e) => { setProofFile(e.target.files?.[0] ?? null); }}
            />
            {!paymentSuccess ? (
              <div className="space-y-3">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-sm"><ShoppingCart className="h-4 w-4 text-primary" />Complete Purchase</DialogTitle>
                  <DialogDescription>{selectedProduct?.title} — ₹{selectedProduct?.price}</DialogDescription>
                </DialogHeader>

                {/* ── WISE (PRIMARY) ── */}
                <div className={cn('rounded-xl border-2 cursor-pointer', buyPayMethod === 'wise' ? 'border-primary bg-primary/5' : 'border-border')} onClick={() => { setBuyPayMethod('wise'); setManualTxnRef(''); }}>
                  <div className="flex items-center gap-3 p-3">
                    <Send className="h-5 w-5 text-primary" />
                    <div className="flex-1"><p className="font-semibold text-sm">Wise Payment</p><p className="text-xs text-muted-foreground">Global transfer — QR + direct link</p></div>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Recommended</Badge>
                  </div>
                  {buyPayMethod === 'wise' && (
                    <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                      <div className="flex items-start gap-3">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(WISE_PAY_LINK)}`}
                          alt="Wise QR"
                          className="h-20 w-20 rounded-lg border border-border bg-white p-1"
                        />
                        <div className="flex-1 space-y-1.5">
                          <p className="text-xs text-muted-foreground">Scan or open Wise and pay ₹{selectedProduct?.price?.toLocaleString()}.</p>
                          <div className="flex gap-1.5">
                            <button className="text-xs text-primary border border-primary/30 px-2 py-1 rounded" onClick={e => { e.stopPropagation(); window.open(WISE_PAY_LINK, '_blank', 'noopener,noreferrer'); }}>Open Wise</button>
                            <button className="text-xs text-primary border border-primary/30 px-2 py-1 rounded" onClick={e => { e.stopPropagation(); handleCopy(WISE_PAY_LINK, 'Wise link'); }}><Copy className="h-3 w-3 inline mr-0.5" />Copy</button>
                          </div>
                        </div>
                      </div>
                      <Input placeholder="Wise transfer reference / order ID" value={manualTxnRef} onChange={e => setManualTxnRef(e.target.value)} onClick={e => e.stopPropagation()} />
                      {proofFile ? (
                        <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 text-xs" onClick={e => e.stopPropagation()}>
                          <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="flex-1 truncate text-foreground">{proofFile.name}</span>
                          <button type="button" onClick={() => { setProofFile(null); if (proofInputRef.current) proofInputRef.current.value = ''; }} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <button type="button" onClick={e => { e.stopPropagation(); proofInputRef.current?.click(); }} className="w-full flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 transition-colors">
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />Attach proof screenshot / PDF (optional)
                        </button>
                      )}
                      <Button className="w-full h-9 bg-primary" onClick={handleWiseProductPayment} disabled={paymentSubmitting || !manualTxnRef.trim()}>
                        {paymentSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : 'Submit Wise Payment'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* ── WALLET ── */}
                <div className={cn('rounded-xl border-2 cursor-pointer p-3', buyPayMethod === 'wallet' ? 'border-primary bg-primary/5' : 'border-border')} onClick={() => setBuyPayMethod('wallet')}>
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-primary" />
                    <div><p className="font-semibold text-sm">Wallet</p><p className="text-xs text-muted-foreground">Instant checkout</p></div>
                  </div>
                </div>
                {buyPayMethod === 'wallet' && (
                  <Button className="w-full h-11" onClick={handleWalletPayment} disabled={paymentSubmitting}>
                    {paymentSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</> : `Pay ₹${selectedProduct?.price} from Wallet`}
                  </Button>
                )}

                <button className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground py-1" onClick={() => setShowMorePayment(!showMorePayment)}>
                  {showMorePayment ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} More Options
                </button>
                {showMorePayment && (
                  <div className="space-y-2">
                    <div className={cn('rounded-xl border cursor-pointer', buyPayMethod === 'upi' ? 'border-primary bg-primary/5' : 'border-border')} onClick={() => { setBuyPayMethod('upi'); setManualTxnRef(''); }}>
                      <div className="flex items-center gap-3 p-3"><Wallet className="h-4 w-4" /><div><p className="font-medium text-sm">UPI</p><p className="text-xs text-muted-foreground">GPay, PhonePe, Paytm</p></div></div>
                      {buyPayMethod === 'upi' && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                          <div className="bg-background rounded-lg p-2 flex items-center justify-between">
                            <div><p className="text-xs text-muted-foreground">UPI ID</p><p className="font-mono font-semibold text-sm">{bankDetails.upiId}</p></div>
                            <button className="text-xs text-primary border border-primary/30 px-2 py-1 rounded" onClick={e => { e.stopPropagation(); handleCopy(bankDetails.upiId, 'UPI ID'); }}><Copy className="h-3 w-3 inline mr-1" />Copy</button>
                          </div>
                          <Input placeholder="Transaction ID" value={manualTxnRef} onChange={e => setManualTxnRef(e.target.value)} onClick={e => e.stopPropagation()} />
                          {proofFile ? (
                            <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 text-xs" onClick={e => e.stopPropagation()}>
                              <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="flex-1 truncate">{proofFile.name}</span>
                              <button type="button" onClick={() => { setProofFile(null); if (proofInputRef.current) proofInputRef.current.value = ''; }}><X className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : (
                            <button type="button" onClick={e => { e.stopPropagation(); proofInputRef.current?.click(); }} className="w-full flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 transition-colors">
                              <Paperclip className="h-3 w-3 shrink-0" />Attach proof (optional)
                            </button>
                          )}
                          <Button className="w-full h-9" onClick={handleManualPayment} disabled={paymentSubmitting || !manualTxnRef.trim()}>Submit</Button>
                        </div>
                      )}
                    </div>
                    <div className={cn('rounded-xl border cursor-pointer', buyPayMethod === 'bank' ? 'border-primary bg-primary/5' : 'border-border')} onClick={() => { setBuyPayMethod('bank'); setManualTxnRef(''); }}>
                      <div className="flex items-center gap-3 p-3"><CreditCard className="h-4 w-4" /><div><p className="font-medium text-sm">Bank Transfer</p><p className="text-xs text-muted-foreground">NEFT/IMPS</p></div></div>
                      {buyPayMethod === 'bank' && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-background rounded p-2"><p className="text-muted-foreground">A/C</p><p className="font-mono font-bold">{bankDetails.accountNumber}</p></div>
                            <div className="bg-background rounded p-2"><p className="text-muted-foreground">IFSC</p><p className="font-mono font-bold">{bankDetails.ifsc}</p></div>
                          </div>
                          <Input placeholder="Transaction Ref" value={manualTxnRef} onChange={e => setManualTxnRef(e.target.value)} onClick={e => e.stopPropagation()} />
                          {proofFile ? (
                            <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 text-xs" onClick={e => e.stopPropagation()}>
                              <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="flex-1 truncate">{proofFile.name}</span>
                              <button type="button" onClick={() => { setProofFile(null); if (proofInputRef.current) proofInputRef.current.value = ''; }}><X className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : (
                            <button type="button" onClick={e => { e.stopPropagation(); proofInputRef.current?.click(); }} className="w-full flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 transition-colors">
                              <Paperclip className="h-3 w-3 shrink-0" />Attach proof (optional)
                            </button>
                          )}
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
                <div className="flex flex-col gap-2">
                  <Link to="/keys" className="w-full">
                    <Button className="w-full gap-2" variant="outline">
                      <Key className="h-4 w-4" /> View My Licenses
                    </Button>
                  </Link>
                  {downloadUrl && (
                    <a href={downloadUrl} className="w-full">
                      <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white">
                        <Download className="h-4 w-4" /> Download APK
                      </Button>
                    </a>
                  )}
                  <Button variant="ghost" className="w-full" onClick={() => setShowPayment(false)}>Done</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
    </div>
  );
}
