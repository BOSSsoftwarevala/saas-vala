import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShoppingCart, Heart, Share2, Star, Download, Play, ArrowLeft, Check, AlertCircle, ChevronLeft, ChevronRight, FileText, Package, Shield, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useFavorites';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { publicMarketplaceApi } from '@/lib/api';
import { resolveMaskedDemoUrl } from '@/lib/demoMasking';
import { usePaymentAvailability } from '@/hooks/useFeatureFlags';
import { cn } from '@/lib/utils';

// Simple helper functions to replace marketplaceUtils
const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

const getFallbackImage = (category: string) => {
  return 'https://via.placeholder.com/400x300?text=No+Image';
};

const durationLabel = (days: number) => {
  if (days === 30) return '1 Month';
  if (days === 90) return '3 Months';
  if (days === 180) return '6 Months';
  if (days === 365) return '1 Year';
  return `${days} Days`;
};

const generateIdempotencyKey = () => {
  return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

interface PricingOption {
  duration_days: number;
  base_price: number;
  currency: string;
}

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  short_description: string;
  category?: string;
  thumbnail_url: string;
  demo_url: string | null;
  demo_enabled?: boolean | null;
  apk_url: string | null;
  rating: number;
  created_at: string;
  updated_at: string;
  // Phase 3 fields
  screenshots?: string[];
  features?: string[];
  version?: string;
  version_code?: number;
  apk_enabled?: boolean;
  license_enabled?: boolean;
  file_size?: number;
  min_android_version?: string;
  system_requirements?: string[];
  changelog?: string;
}

interface ProductSeo {
  id: string;
  product_id: string;
  slug: string;
  title: string;
  meta_description: string;
  keywords: string[];
  hashtags: string[];
  seo_score: number;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  twitter_card?: string;
  canonical_url?: string;
  target_country?: string;
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFavorited, toggleFavorite } = useFavorites();
  const { walletEnabled, disabledReason } = usePaymentAvailability();
  const [searchParams] = useSearchParams();
  const [ratings] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [productSeo, setProductSeo] = useState<ProductSeo | null>(null);
  const [pricing, setPricing] = useState<PricingOption[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Phase 3: Screenshots gallery
  const [currentScreenshotIndex, setCurrentScreenshotIndex] = useState(0);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);

  // Phase 3: APK versions
  const [apkVersions, setApkVersions] = useState<any[]>([]);
  const [apkVersionsLoading, setApkVersionsLoading] = useState(false);

  // Phase 3: Download management
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [ownedLicenses, setOwnedLicenses] = useState<any[]>([]);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);

  /**
   * Ref-based lock: prevents concurrent purchase calls (double-click,
   * fast keyboard repeat, etc.).
   */
  const purchaseLockRef = useRef(false);
  /** Per-dialog idempotency key locked in when the dialog opens. */
  const purchaseIdempotencyKey = useRef<string>('');
  const maskedDemoUrl = product
    ? resolveMaskedDemoUrl({
        slug: product.slug,
        demo_url: product.demo_url,
        demo_enabled: product.demo_enabled,
      })
    : null;

  useEffect(() => {
    if (!id) return;
    fetchProduct();
  }, [id]);

  // Update meta tags based on SEO data
  useEffect(() => {
    if (!product) return;

    const seoTitle = productSeo?.title || product.name || 'SaaS Vala Marketplace';
    const seoDescription = productSeo?.meta_description || product.short_description || product.description || 'Browse and buy premium software solutions';
    const seoKeywords = productSeo?.keywords?.join(', ') || 'software, saas, marketplace';
    const ogTitle = productSeo?.og_title || product.name;
    const ogDescription = productSeo?.og_description || seoDescription;
    const ogImage = productSeo?.og_image || product.thumbnail_url;
    const canonicalUrl = productSeo?.canonical_url || window.location.href;

    // Update document title
    document.title = seoTitle;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, property?: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement ||
                 document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      
      if (!tag) {
        tag = document.createElement('meta');
        if (property) {
          tag.setAttribute('property', property);
        } else {
          tag.setAttribute('name', name);
        }
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // Basic SEO tags
    updateMetaTag('description', seoDescription);
    updateMetaTag('keywords', seoKeywords);
    updateMetaTag('og:title', ogTitle, 'og:title');
    updateMetaTag('og:description', ogDescription, 'og:description');
    updateMetaTag('og:image', ogImage, 'og:image');
    updateMetaTag('og:type', 'product', 'og:type');
    updateMetaTag('twitter:card', productSeo?.twitter_card || 'summary_large_image', 'twitter:card');
    updateMetaTag('twitter:title', ogTitle, 'twitter:title');
    updateMetaTag('twitter:description', ogDescription, 'twitter:description');
    updateMetaTag('twitter:image', ogImage, 'twitter:image');
    
    // Canonical URL
    let canonicalTag = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute('href', canonicalUrl);

  }, [product, productSeo]);

  useEffect(() => {
    if (searchParams.get('action') !== 'buy') return;
    if (!product || showPurchaseDialog) return;
    if (!purchaseIdempotencyKey.current) {
      purchaseIdempotencyKey.current = generateIdempotencyKey();
    }
    setShowPurchaseDialog(true);
  }, [searchParams, product, showPurchaseDialog]);

  const fetchProduct = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Fetch product details
      const { data: prod, error } = await (supabase as any)
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProduct({
        ...prod,
        category: prod.category || prod.category_id || 'General',
      });

      // Build pricing from product's own price field
      const basePrice = Number(prod.price || 0);
      const currency = String(prod.currency || 'USD');
      if (basePrice > 0) {
        setPricing([
          { duration_days: 30, base_price: basePrice, currency },
          { duration_days: 90, base_price: Math.round(basePrice * 2.5), currency },
          { duration_days: 180, base_price: Math.round(basePrice * 4.5), currency },
          { duration_days: 365, base_price: Math.round(basePrice * 8), currency },
        ]);
      } else {
        setPricing([
          { duration_days: 30, base_price: 0, currency },
        ]);
      }

      // Phase 3: Fetch APK versions
      fetchApkVersions(id);

      // Phase 3: Check if user owns this product
      if (user) {
        fetchOwnedLicenses(id);
      }
    } catch (err) {
      console.error('Failed to fetch product:', err);
      toast.error('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  // Phase 3: Fetch APK versions
  const fetchApkVersions = async (productId: string) => {
    setApkVersionsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('apks')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch APK versions:', error);
        setApkVersions([]);
      } else {
        setApkVersions(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch APK versions:', e);
      setApkVersions([]);
    } finally {
      setApkVersionsLoading(false);
    }
  };

  // Phase 3: Fetch owned licenses
  const fetchOwnedLicenses = async (productId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('marketplace_licenses')
        .select('*')
        .eq('product_id', productId)
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (error) {
        console.error('Failed to fetch licenses:', error);
        setOwnedLicenses([]);
      } else {
        setOwnedLicenses(data || []);
        if (data && data.length > 0) {
          setLicenseKey(data[0].license_key);
        }
      }
    } catch (e) {
      console.error('Failed to fetch licenses:', e);
      setOwnedLicenses([]);
    }
  };

  // Phase 3: Generate secure download URL
  const generateDownloadUrl = async () => {
    if (!user || !product || !licenseKey) {
      toast.error('You need to purchase this product to download');
      return;
    }

    setDownloadLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('marketplace_licenses')
        .select('download_url, expires_at')
        .eq('license_key', licenseKey)
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        toast.error('Failed to generate download link');
        return;
      }

      // Check if download link is expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        // Generate new download link
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        const { data: updateData, error: updateError } = await (supabase as any)
          .from('marketplace_licenses')
          .update({
            download_url: `https://www.saasvala.com/api/download/${licenseKey}`,
            expires_at: expiresAt.toISOString(),
          })
          .eq('license_key', licenseKey);

        if (updateError) {
          toast.error('Failed to generate download link');
          return;
        }
        setDownloadUrl(`https://www.saasvala.com/api/download/${licenseKey}`);
      } else {
        setDownloadUrl(data.download_url);
      }

      toast.success('Download link generated successfully');
    } catch (e) {
      console.error('Failed to generate download link:', e);
      toast.error('Failed to generate download link');
    } finally {
      setDownloadLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!product) return;

    // Prevent double-submission
    if (purchaseLockRef.current || processing) return;

    const selectedPrice = pricing.find((p) => p.duration_days === selectedDuration);
    if (!selectedPrice) {
      toast.error('Invalid pricing selection');
      return;
    }

    purchaseLockRef.current = true;

    try {
      const result = await initiatePayment(
        product.id,
        selectedDuration,
        'wallet',
        selectedPrice.base_price,
        purchaseIdempotencyKey.current
      );

      if (result?.success) {
        setShowPurchaseDialog(false);
        // Reset key so a re-open of the dialog gets a fresh key
        purchaseIdempotencyKey.current = '';
        setTimeout(() => navigate('/orders'), 2000);
      }
    } finally {
      purchaseLockRef.current = false;
    }
  };

  const handleSubmitRating = async () => {
    if (!reviewTitle.trim() || !reviewText.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmittingRating(true);
    const success = await submitRating(rating, reviewTitle, reviewText);
    if (success) {
      setShowRatingDialog(false);
      setReviewTitle('');
      setReviewText('');
      setRating(5);
    }
    setSubmittingRating(false);
  };

  const handleShareProduct = () => {
    const url = `${window.location.origin}/marketplace/product/${product?.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Product link copied to clipboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">Product not found</p>
        <Button onClick={() => navigate('/marketplace')}>Back to Marketplace</Button>
      </div>
    );
  }

  const currentPrice = pricing.find((p) => p.duration_days === selectedDuration);
  const screenshots = product?.screenshots || [product?.thumbnail_url].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleFavorite(product.id)}
              className={isFavorited(product.id) ? 'text-red-500' : ''}
            >
              <Heart className={`h-5 w-5 ${isFavorited(product.id) ? 'fill-current' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleShareProduct}>
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product Image & Screenshots */}
          <div className="lg:col-span-1 space-y-4">
            {/* Main Image */}
            <div 
              className="relative rounded-lg overflow-hidden aspect-square cursor-pointer"
              onClick={() => setShowScreenshotModal(true)}
            >
              <img
                src={screenshots[currentScreenshotIndex] || product.thumbnail_url || getFallbackImage(product.category || 'general')}
                alt={product.name ?? 'Product image'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.src = getFallbackImage(product.category || 'general');
                }}
              />
              {screenshots.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {currentScreenshotIndex + 1} / {screenshots.length}
                </div>
              )}
            </div>

            {/* Screenshots Thumbnails */}
            {screenshots.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {screenshots.map((screenshot, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentScreenshotIndex(index)}
                    className={cn(
                      'rounded-lg overflow-hidden aspect-square border-2 transition-all',
                      currentScreenshotIndex === index ? 'border-primary' : 'border-transparent hover:border-primary/50'
                    )}
                  >
                    <img
                      src={screenshot}
                      alt={`Screenshot ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Rating */}
            <div>
              <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < Math.round(averageRating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                      }`}
                    />
                  ))}
                  <span className="text-sm text-muted-foreground ml-2">
                    {averageRating.toFixed(1)} ({ratings.length} reviews)
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <p className="text-muted-foreground">{product.description}</p>
            </div>

            {/* Pricing Options */}
            <div className="space-y-4">
              <div>
                <p className="font-semibold mb-3">Select Plan Duration</p>
                <div className="grid grid-cols-2 gap-3">
                  {pricing.map((option) => (
                    <button
                      key={option.duration_days}
                      onClick={() => setSelectedDuration(option.duration_days)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedDuration === option.duration_days
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="font-semibold">{durationLabel(option.duration_days)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(option.base_price ?? 0, option.currency ?? 'USD')}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  size="lg"
                  className="flex-1 gap-2"
                  onClick={() => {
                    // Generate a fresh idempotency key each time the purchase dialog opens
                    if (!purchaseIdempotencyKey.current) {
                      purchaseIdempotencyKey.current = generateIdempotencyKey();
                    }
                    setShowPurchaseDialog(true);
                  }}
                  disabled={processing || purchaseLockRef.current}
                >
                  <ShoppingCart className="h-5 w-5" />
                  Buy Now — {formatCurrency(currentPrice?.base_price ?? 0, currentPrice?.currency ?? 'USD')}
                </Button>
                {maskedDemoUrl && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => {
                      if (user?.id && product.id) {
                        publicMarketplaceApi.logDemoAccess(product.id, crypto.randomUUID()).catch(() => {});
                      }
                      window.location.assign(maskedDemoUrl);
                    }}
                  >
                    <Play className="h-5 w-5" />
                    Try Demo
                  </Button>
                )}
              </div>
            </div>

            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What's Included</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(product.features || [
                  'Full APK Download',
                  'Active License Key',
                  'Email Delivery',
                  '24/7 Support'
                ]).map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Phase 3: Version Info */}
            {(product.version || apkVersions.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Version Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Current Version</p>
                      <p className="font-semibold">{product.version || apkVersions[0]?.version || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">File Size</p>
                      <p className="font-semibold">
                        {product.file_size ? `${(product.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Min Android</p>
                      <p className="font-semibold">{product.min_android_version || '5.0+'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Updated</p>
                      <p className="font-semibold">
                        {product.updated_at ? new Date(product.updated_at).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Phase 3: Download Section */}
            {ownedLicenses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-green-500" />
                    <span>You own this product</span>
                  </div>
                  {licenseKey && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">License Key</p>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{licenseKey}</code>
                    </div>
                  )}
                  <Button
                    className="w-full gap-2"
                    onClick={generateDownloadUrl}
                    disabled={downloadLoading}
                  >
                    {downloadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {downloadLoading ? 'Generating Link...' : 'Download APK'}
                  </Button>
                  {downloadUrl && (
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Download link valid for 24 hours
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mt-12">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="changelog">Changelog</TabsTrigger>
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
              <TabsTrigger value="faq">FAQ</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold mb-2">Category</p>
                      <Badge>{product.category}</Badge>
                    </div>
                    <div>
                      <p className="font-semibold mb-2">Full Description</p>
                      <p className="text-muted-foreground">{product.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Phase 3: Changelog */}
            <TabsContent value="changelog" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Version History
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {apkVersionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : apkVersions.length > 0 ? (
                    apkVersions.map((version) => (
                      <div key={version.id} className="border-b border-border pb-4 last:border-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{version.version}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(version.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {version.is_stable && (
                            <Badge className="bg-green-500">Stable</Badge>
                          )}
                        </div>
                        {version.changelog && (
                          <p className="text-sm text-muted-foreground">{version.changelog}</p>
                        )}
                      </div>
                    ))
                  ) : product.changelog ? (
                    <p className="text-sm text-muted-foreground">{product.changelog}</p>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No changelog available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Phase 3: System Requirements */}
            <TabsContent value="requirements" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    System Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {product.system_requirements && product.system_requirements.length > 0 ? (
                    <ul className="space-y-2">
                      {product.system_requirements.map((req, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Android 5.0 (Lollipop) or higher</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Minimum 2GB RAM</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Minimum 100MB free storage space</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Stable internet connection for activation</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <div className="space-y-6">
                {/* Rating Summary */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Average Rating</p>
                        <p className="text-3xl font-bold">{averageRating.toFixed(1)}</p>
                      </div>
                      <Button onClick={() => setShowRatingDialog(true)}>Write Review</Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Reviews List */}
                <div className="space-y-4">
                  {ratings.length > 0 ? (
                    ratings.map((review: any) => (
                      <Card key={review.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-4">
                            <div className="flex-1">
                              <p className="font-semibold">{review.review_title}</p>
                              <div className="flex items-center gap-2 my-2">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3 w-3 ${
                                      i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                                    }`}
                                  />
                                ))}
                              </div>
                              <p className="text-muted-foreground text-sm">{review.review_text}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                By {review.owner_name || 'Anonymous'} • {new Date(review.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No reviews yet. Be the first to review!</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="faq" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold mb-2">How do I download the APK?</p>
                      <p className="text-muted-foreground">After purchase, you'll receive a license key via email. Use it to download the APK.</p>
                    </div>
                    <div>
                      <p className="font-semibold mb-2">Can I use the license on multiple devices?</p>
                      <p className="text-muted-foreground">Each license is valid for the duration selected at purchase.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Purchase Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              You're about to purchase {product.name ?? 'this product'} for{' '}
              {durationLabel(currentPrice?.duration_days ?? selectedDuration)} at{' '}
              {formatCurrency(currentPrice?.base_price ?? 0, currentPrice?.currency ?? 'USD')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A license key will be generated and sent to your email after payment is confirmed.
              </AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handlePurchase}
                disabled={processing || purchaseLockRef.current || !walletEnabled}
                title={!walletEnabled ? disabledReason : undefined}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {processing ? 'Processing…' : 'Complete Purchase'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rating Dialog */}
      <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
            <DialogDescription>Share your experience with this product</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Rating */}
            <div>
              <p className="font-semibold mb-3">Rate this product</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((val) => (
                  <Button
                    key={val}
                    type="button"
                    variant={val <= rating ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setRating(val)}
                    disabled={submittingRating}
                  >
                    <Star
                      className={`h-6 w-6 ${val <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                    />
                  </Button>
                ))}
              </div>
            </div>

            {/* Review Title */}
            <div>
              <label className="text-sm font-medium">Review Title</label>
              <Input
                placeholder="e.g., Great product!"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
              />
            </div>

            {/* Review Text */}
            <div>
              <label className="text-sm font-medium">Your Review</label>
              <Textarea
                placeholder="Share details about your experience..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowRatingDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitRating} disabled={submittingRating}>
                {submittingRating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Phase 3: Screenshot Modal */}
      <Dialog open={showScreenshotModal} onOpenChange={setShowScreenshotModal}>
        <DialogContent className="max-w-4xl">
          <div className="relative">
            <img
              src={screenshots[currentScreenshotIndex] || product.thumbnail_url || getFallbackImage(product.category || 'general')}
              alt={`Screenshot ${currentScreenshotIndex + 1}`}
              className="w-full rounded-lg"
            />
            {screenshots.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                  onClick={() => setCurrentScreenshotIndex((prev) => (prev > 0 ? prev - 1 : screenshots.length - 1))}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                  onClick={() => setCurrentScreenshotIndex((prev) => (prev < screenshots.length - 1 ? prev + 1 : 0))}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                  {currentScreenshotIndex + 1} / {screenshots.length}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
