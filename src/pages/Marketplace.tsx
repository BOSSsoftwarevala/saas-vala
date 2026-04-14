import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { MarketplaceProductCard } from '@/components/marketplace/MarketplaceProductCard';
import { HeroBannerSlider } from '@/components/marketplace/HeroBannerSlider';
import { useMarketplaceProducts, type MarketplaceProduct } from '@/hooks/useMarketplaceProducts';
import { toast } from 'sonner';
import { useFraudDetection } from '@/hooks/useFraudDetection';
import { useAuth } from '@/hooks/useAuth';
import { dashboardApi } from '@/lib/dashboardApi';
import { publicMarketplaceApi } from '@/lib/api';
import { resolveMaskedDemoUrl } from '@/lib/demoMasking';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ShoppingCart, CreditCard, Wallet, Loader2, ChevronDown, ChevronUp, Copy, Key, Download,
  Send, Paperclip, X, Grid, List, Filter, SlidersHorizontal, Star, TrendingUp,
  Clock, DollarSign, Zap, Sparkles, Award, Flame, Moon, Sun, Heart, Share2, GitCompare,
  MessageSquare, CheckCircle, XCircle, ThumbsUp, ThumbsDown, Eye,
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

export default function Marketplace() {
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentAwaitingVerification, setPaymentAwaitingVerification] = useState(false);
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
  const [bannerSlides, setBannerSlides] = useState<any[] | undefined>(undefined);
  const [serverSearchProducts, setServerSearchProducts] = useState<MarketplaceProduct[] | null>(null);
  const navigate = useNavigate();
  const buyParamHandled = useRef(false);
  const { checkUserStatus } = useFraudDetection();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { products, loading: productsLoading, totalCount } = useMarketplaceProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(50); // Start with 50 visible items
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'rating' | 'newest' | 'trending'>('default');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [minRating, setMinRating] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(false);
  
  // Phase 2: Reviews, Wishlist, Recently Viewed, Share, Dark Mode
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviews, setShowReviews] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedProductsForComparison, setSelectedProductsForComparison] = useState<MarketplaceProduct[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category || 'Other'));
    return ['all', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = serverSearchProducts && searchQuery.trim() ? serverSearchProducts : products;

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Price range filter
    filtered = filtered.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);

    // Rating filter
    if (minRating > 0) {
      filtered = filtered.filter(p => p.rating >= minRating);
    }

    // Sorting
    switch (sortBy) {
      case 'price-asc':
        filtered = [...filtered].sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        filtered = [...filtered].sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        filtered = [...filtered].sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        filtered = [...filtered].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        break;
      case 'trending':
        filtered = [...filtered].sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
        break;
    }

    return filtered;
  }, [products, serverSearchProducts, searchQuery, selectedCategory, priceRange, minRating, sortBy]);

  const activeProducts = useMemo(
    () => filteredProducts,
    [filteredProducts]
  );

  // Implement lazy loading - show more products as user scrolls
  const visibleProducts = useMemo(
    () => activeProducts.slice(0, visibleCount),
    [activeProducts, visibleCount]
  );

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + 50, activeProducts.length));
  }, [activeProducts.length]);

  // Auto-load more when scrolling near bottom
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= 
          document.documentElement.offsetHeight - 1000) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  // Phase 2: Load wishlist from localStorage
  useEffect(() => {
    const savedWishlist = localStorage.getItem('marketplace_wishlist');
    if (savedWishlist) {
      setWishlist(new Set(JSON.parse(savedWishlist)));
    }
  }, []);

  // Phase 2: Load recently viewed from localStorage
  useEffect(() => {
    const savedRecentlyViewed = localStorage.getItem('marketplace_recently_viewed');
    if (savedRecentlyViewed) {
      setRecentlyViewed(JSON.parse(savedRecentlyViewed));
    }
  }, []);

  // Phase 2: Load dark mode preference
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('marketplace_dark_mode');
    if (savedDarkMode) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  // Phase 2: Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('marketplace_dark_mode', JSON.stringify(newMode));
    document.documentElement.classList.toggle('dark', newMode);
  };

  // Phase 2: Add to wishlist
  const toggleWishlist = (productId: string) => {
    const newWishlist = new Set(wishlist);
    if (newWishlist.has(productId)) {
      newWishlist.delete(productId);
      toast.success('Removed from wishlist');
    } else {
      newWishlist.add(productId);
      toast.success('Added to wishlist');
    }
    setWishlist(newWishlist);
    localStorage.setItem('marketplace_wishlist', JSON.stringify(Array.from(newWishlist)));
  };

  // Phase 2: Add to recently viewed
  const addToRecentlyViewed = (productId: string) => {
    const newRecentlyViewed = [productId, ...recentlyViewed.filter(id => id !== productId)].slice(0, 10);
    setRecentlyViewed(newRecentlyViewed);
    localStorage.setItem('marketplace_recently_viewed', JSON.stringify(newRecentlyViewed));
  };

  // Phase 2: Share product
  const shareProduct = (product: MarketplaceProduct) => {
    const url = `${window.location.origin}/marketplace?product=${product.slug}`;
    if (navigator.share) {
      navigator.share({
        title: product.title,
        text: product.subtitle,
        url: url,
      });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  };

  // Phase 2: Add to comparison
  const toggleComparison = (product: MarketplaceProduct) => {
    if (selectedProductsForComparison.find(p => p.id === product.id)) {
      setSelectedProductsForComparison(selectedProductsForComparison.filter(p => p.id !== product.id));
      toast.success('Removed from comparison');
    } else {
      if (selectedProductsForComparison.length >= 3) {
        toast.error('Maximum 3 products can be compared');
        return;
      }
      setSelectedProductsForComparison([...selectedProductsForComparison, product]);
      toast.success('Added to comparison');
    }
  };

  // Phase 2: Fetch reviews for product
  const fetchReviews = async (productId: string) => {
    try {
      // product_reviews table may not exist yet, handle gracefully
      const { data, error } = await (supabase as any)
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Failed to fetch reviews:', error);
        setReviews([]);
      } else {
        setReviews(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch reviews:', e);
      setReviews([]);
    }
  };

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

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setServerSearchProducts(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const searchResult = await publicMarketplaceApi.search(query);
        const rawProducts = Array.isArray(searchResult?.products) ? searchResult.products : [];
        setServerSearchProducts(rawProducts as MarketplaceProduct[]);
      } catch {
        setServerSearchProducts([]);
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    const loadBanners = async () => {
      // Banners feature removed - using static data
      const staticBanners = [
        {
          id: '1',
          title: 'SaaS Vala Marketplace',
          subtitle: 'Discover amazing software',
          image: '/api/placeholder/800/400',
          linkedCategory: undefined,
          badge: 'Featured',
          badgeColor: undefined,
          offerText: undefined,
          couponCode: undefined,
        }
      ];

      setBannerSlides(staticBanners);
    };

    loadBanners();
  }, []);

  const openPaymentDialog = (product: MarketplaceProduct) => {
    setSelectedProduct(product);
    setBuyPayMethod('wise');
    setManualTxnRef('');
    setProofFile(null);
    setPaymentSuccess(false);
    setPaymentAwaitingVerification(false);
    setGeneratedLicenseKey('');
    setDownloadUrl('');
    setShowMorePayment(false);
    setShowPayment(true);
  };

  const handleDemo = useCallback(async (product: MarketplaceProduct) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      // Check if product has demo enabled
      if (!product.demo_enabled) {
        toast.info('Demo not available for this product');
        return;
      }

      const demoUrl = await resolveMaskedDemoUrl(product.id);
      if (demoUrl) {
        window.open(demoUrl, '_blank', 'noopener,noreferrer');
      } else {
        // Fallback to demo page if masked URL fails
        navigate(`/demo/${product.slug || product.id}`);
      }
    } catch (error) {
      console.error('Demo error:', error);
      toast.error('Failed to load demo');
    }
  }, [user, navigate]);

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
      setPaymentAwaitingVerification(false);
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
        setPaymentAwaitingVerification(true);
        setGeneratedLicenseKey('');
      setDownloadUrl('');
      setManualSubmitted(true);
      setProofFile(null);
        toast.success('Payment submitted. Order is pending verification before license activation.');
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

      // 4. Notify admins (fire-and-forget)
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
      setPaymentAwaitingVerification(true);
      setGeneratedLicenseKey('');
      setDownloadUrl('');
      setProofFile(null);
      toast.success('Wise payment submitted. Order is pending verification before license activation.');
    } catch (err) {
      console.error('Wise product payment error:', err);
      toast.error('Submission failed. Please try again.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleSearchSubmit = () => {
    const trimmedQuery = searchQuery.trim();
    setSearchQuery(trimmedQuery);
    if (trimmedQuery) {
      // Navigate to search results page
      navigate(`/marketplace/search?q=${encodeURIComponent(trimmedQuery)}`);
    } else {
      document.getElementById('marketplace-products-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOfferClick = (offer: string) => {
    setSearchQuery(offer);
    // Scroll to products section
    setTimeout(() => {
      document.getElementById('marketplace-products-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleBannerClick = (linkedCategory?: string) => {
    if (!linkedCategory) {
      setSearchQuery('');
      return;
    }
    setSearchQuery(linkedCategory);
    // Navigate to category page
    navigate(`/marketplace/category/${linkedCategory.toLowerCase()}`);
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

        <div id="marketplace-healthcare-section" className="px-4 md:px-8 mt-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">All Products</h2>
              <p className="text-sm text-muted-foreground">
                {searchQuery.trim()
                  ? `${visibleProducts.length} of ${activeProducts.length} products matching "${searchQuery.trim()}"`
                  : productsLoading
                    ? 'Loading products...'
                    : `${visibleProducts.length} of ${totalCount} products available (${totalCount} total from GitHub)`}
              </p>
            </div>

            {/* View Toggle, Filter, Dark Mode, Wishlist, Comparison Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>
              <button
                type="button"
                onClick={toggleDarkMode}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
                title="Toggle Dark Mode"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              {selectedProductsForComparison.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowComparison(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <GitCompare className="h-4 w-4" />
                  Compare ({selectedProductsForComparison.length})
                </button>
              )}
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-accent'}`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-accent'}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-card border border-border rounded-lg space-y-4">
              {/* Category Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {cat === 'all' ? 'All Categories' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Price Range: ₹{priceRange[0]} - ₹{priceRange[1]}</label>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="100"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                  className="w-full"
                />
              </div>

              {/* Rating Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Minimum Rating</label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setMinRating(rating)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                        minRating === rating
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {rating === 0 ? 'All' : `${rating}+`}
                      {rating > 0 && <Star className="h-3 w-3 fill-current" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort By */}
              <div>
                <label className="text-sm font-medium mb-2 block">Sort By</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'default', label: 'Default', icon: Sparkles },
                    { value: 'price-asc', label: 'Price: Low to High', icon: DollarSign },
                    { value: 'price-desc', label: 'Price: High to Low', icon: DollarSign },
                    { value: 'rating', label: 'Highest Rated', icon: Star },
                    { value: 'newest', label: 'Newest', icon: Clock },
                    { value: 'trending', label: 'Trending', icon: TrendingUp },
                  ].map(sort => (
                    <button
                      key={sort.value}
                      type="button"
                      onClick={() => setSortBy(sort.value as any)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                        sortBy === sort.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      <sort.icon className="h-3 w-3" />
                      {sort.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Collections Section */}
        <div className="px-4 md:px-8 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Featured Collections</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: 'Best for Startup', icon: Zap, color: 'from-blue-500 to-cyan-500' },
              { name: 'Top 2026 Tools', icon: Flame, color: 'from-orange-500 to-red-500' },
              { name: 'Most Popular', icon: TrendingUp, color: 'from-purple-500 to-pink-500' },
              { name: 'New Arrivals', icon: Sparkles, color: 'from-green-500 to-emerald-500' },
            ].map((collection, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSearchQuery(collection.name)}
                className={`p-4 rounded-xl bg-gradient-to-br ${collection.color} text-white text-left hover:opacity-90 transition-opacity`}
              >
                <collection.icon className="h-6 w-6 mb-2" />
                <p className="font-semibold text-sm">{collection.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Phase 2: Wishlist Section */}
        {wishlist.size > 0 && (
          <div className="px-4 md:px-8 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="h-5 w-5 text-pink-500" />
              <h3 className="text-lg font-bold text-foreground">Your Wishlist ({wishlist.size})</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.filter(p => wishlist.has(p.id)).slice(0, 3).map(product => (
                <MarketplaceProductCard
                  key={product.id}
                  product={product}
                  onBuyNow={handleBuyNow}
                  onDemo={handleDemo}
                  onWishlistToggle={toggleWishlist}
                  onComparisonToggle={toggleComparison}
                  onShare={shareProduct}
                  onRecentlyViewed={addToRecentlyViewed}
                  isWishlisted={wishlist.has(product.id)}
                  isInComparison={selectedProductsForComparison.find(p => p.id === product.id) !== undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Phase 2: Recently Viewed Section */}
        {recentlyViewed.length > 0 && (
          <div className="px-4 md:px-8 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground">Recently Viewed</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.filter(p => recentlyViewed.includes(p.id)).slice(0, 3).map(product => (
                <MarketplaceProductCard
                  key={product.id}
                  product={product}
                  onBuyNow={handleBuyNow}
                  onDemo={handleDemo}
                  onWishlistToggle={toggleWishlist}
                  onComparisonToggle={toggleComparison}
                  onShare={shareProduct}
                  onRecentlyViewed={addToRecentlyViewed}
                  isWishlisted={wishlist.has(product.id)}
                  isInComparison={selectedProductsForComparison.find(p => p.id === product.id) !== undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Multi-row Grid/List Display */}
        <div className="px-4 md:px-8">
          <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-4'}`}>
            {productsLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                <div key={`marketplace-skeleton-${index}`} className="h-[420px] rounded-2xl border border-border/40 bg-card/40 animate-pulse" />
              ))
              : visibleProducts.map((product, i) => (
                <MarketplaceProductCard
                  key={product.id}
                  product={product}
                  index={i}
                  onBuyNow={handleBuyNow}
                  onDemo={handleDemo}
                  rank={i + 1}
                  onWishlistToggle={toggleWishlist}
                  onComparisonToggle={toggleComparison}
                  onShare={shareProduct}
                  onRecentlyViewed={addToRecentlyViewed}
                  isWishlisted={wishlist.has(product.id)}
                  isInComparison={selectedProductsForComparison.find(p => p.id === product.id) !== undefined}
                />
              ))}
          </div>
          {!productsLoading && visibleProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No products found matching your search.</p>
            </div>
          )}

          {/* Load More Button */}
          {!productsLoading && visibleProducts.length < activeProducts.length && (
            <div className="text-center mt-8">
              <button
                onClick={loadMore}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Load More Products ({visibleProducts.length} of {activeProducts.length})
              </button>
            </div>
          )}

          {/* Show All Loaded Message */}
          {!productsLoading && visibleProducts.length === activeProducts.length && activeProducts.length > 0 && (
            <div className="text-center mt-8 py-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                ✅ All {activeProducts.length} products loaded (Total: {totalCount} from GitHub)
              </p>
            </div>
          )}
        </div>
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
                <h3 className="text-lg font-black text-foreground">
                  {paymentAwaitingVerification ? 'Payment Submitted' : 'Payment Successful!'}
                </h3>
                {paymentAwaitingVerification && (
                  <p className="text-sm text-muted-foreground">
                    Your payment is pending verification. License and APK download will unlock after approval.
                  </p>
                )}
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

      {/* Phase 2: Comparison Dialog */}
      {showComparison && selectedProductsForComparison.length > 0 && (
        <Dialog open={showComparison} onOpenChange={setShowComparison}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Compare Products ({selectedProductsForComparison.length})
              </DialogTitle>
              <DialogDescription>Compare features, pricing, and ratings</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-4 mt-4">
              {selectedProductsForComparison.map(product => (
                <div key={product.id} className="border border-border rounded-lg p-4 space-y-3">
                  <h4 className="font-bold text-sm">{product.title}</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price:</span>
                      <span className="font-bold">₹{product.price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rating:</span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {product.rating}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span>{product.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Demo:</span>
                      <span>{product.demo_enabled ? '✓' : '✗'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">APK:</span>
                      <span>{product.apk_enabled ? '✓' : '✗'}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full h-8 text-xs"
                    onClick={() => {
                      setSelectedProductsForComparison(selectedProductsForComparison.filter(p => p.id !== product.id));
                    }}
                    variant="outline"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Phase 2: Reviews Dialog */}
      {showReviews && selectedProduct && (
        <Dialog open={showReviews} onOpenChange={setShowReviews}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Reviews - {selectedProduct.title}
              </DialogTitle>
              <DialogDescription>Customer reviews and ratings</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="text-4xl font-bold">{selectedProduct.rating}</div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${star <= Math.round(selectedProduct.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">Based on {reviews.length} reviews</p>
                </div>
              </div>
              <div className="space-y-3">
                {reviews.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No reviews yet</p>
                ) : (
                  reviews.map(review => (
                    <div key={review.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            {(review.user_name || 'U')[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-sm">{review.user_name || 'Anonymous'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star
                              key={star}
                              className={`h-3 w-3 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-foreground">{review.comment}</p>
                      <p className="text-xs text-muted-foreground mt-2">{new Date(review.created_at).toLocaleDateString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
    </div>
  );
}
