import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ShoppingCart, Heart, Share2, Star, Download, Play, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useMarketplacePayment, useFavorites, useProductRatings, useLicenseKeys } from '@/hooks/useMarketplace';
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

interface PricingOption {
  duration_days: number;
  base_price: number;
  currency: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  short_description: string;
  category: string;
  thumbnail_url: string;
  demo_url: string;
  apk_url: string;
  rating: number;
  created_at: string;
  updated_at: string;
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFavorited, toggleFavorite } = useFavorites();
  const { ratings, submitRating, averageRating } = useProductRatings(id || '');
  const { initiatePayment, processing } = useMarketplacePayment();

  const [product, setProduct] = useState<Product | null>(null);
  const [pricing, setPricing] = useState<PricingOption[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Fetch product details
      const { data: prod, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProduct(prod);

      // Fetch pricing options
      const { data: prices } = await supabase
        .from('product_pricing')
        .select('*')
        .eq('product_id', id)
        .order('duration_days', { ascending: true });

      if (prices && prices.length > 0) {
        setPricing(prices);
        setSelectedDuration(prices[0].duration_days);
      } else {
        // Default pricing if none found
        setPricing([
          { duration_days: 30, base_price: 5, currency: 'USD' },
          { duration_days: 90, base_price: 12, currency: 'USD' },
          { duration_days: 180, base_price: 22, currency: 'USD' },
          { duration_days: 365, base_price: 40, currency: 'USD' },
        ]);
      }
    } catch (err) {
      console.error('Failed to fetch product:', err);
      toast.error('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!product) return;

    const selectedPrice = pricing.find((p) => p.duration_days === selectedDuration);
    if (!selectedPrice) {
      toast.error('Invalid pricing selection');
      return;
    }

    const result = await initiatePayment(
      product.id,
      selectedDuration,
      'wallet',
      selectedPrice.base_price
    );

    if (result.success) {
      setShowPurchaseDialog(false);
      toast.success('Order placed successfully!');
      // Redirect to orders page or show confirmation
      setTimeout(() => navigate('/orders'), 2000);
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
          {/* Product Image */}
          <div className="lg:col-span-1">
            <img
              src={product.thumbnail_url}
              alt={product.name}
              className="w-full rounded-lg object-cover aspect-square"
            />
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
                      <p className="font-semibold">
                        {option.duration_days === 30 && '1 Month'}
                        {option.duration_days === 90 && '3 Months'}
                        {option.duration_days === 180 && '6 Months'}
                        {option.duration_days === 365 && '1 Year'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ${option.base_price.toFixed(2)}/{option.currency}
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
                  onClick={() => setShowPurchaseDialog(true)}
                  disabled={processing}
                >
                  <ShoppingCart className="h-5 w-5" />
                  Buy Now - ${currentPrice?.base_price.toFixed(2)}
                </Button>
                {product.demo_url && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => window.open(product.demo_url, '_blank')}
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
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Full APK Download</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Active License Key</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Email Delivery</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>24/7 Support</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mt-12">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
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
              You're about to purchase {product.name} for {currentPrice?.duration_days} days at $
              {currentPrice?.base_price.toFixed(2)}
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
              <Button onClick={handlePurchase} disabled={processing}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Complete Purchase
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
                  <button
                    key={val}
                    onClick={() => setRating(val)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-6 w-6 ${val <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                    />
                  </button>
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
    </div>
  );
}

// Add missing import
import { Alert, AlertDescription } from '@/components/ui/alert';
