import React, { useState, useCallback, useEffect, memo, useRef, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart, Bell, Heart, Star, Info, Download,
  Package, Play, Box, Copy, ExternalLink, Eye, X, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { publicMarketplaceApi } from '@/lib/api';
import { buildDemoProxyUrl, resolveMaskedDemoUrl } from '@/lib/demoMasking';
import type { MarketplaceProduct } from '@/hooks/useMarketplaceProducts';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { rateLimiter } from '@/lib/errorHandling';

interface MarketplaceProductCardProps {
  product: MarketplaceProduct;
  index?: number;
  onBuyNow: (p: any) => void;
  onDemo?: (p: any) => void;
  rank?: number;
}

const catColors: Record<string, string> = {
  Healthcare: '#60a5fa', Finance: '#4ade80', Education: '#a78bfa',
  Retail: '#fb923c', Food: '#f87171', Transport: '#22d3ee',
  Marketing: '#e879f9', HR: '#818cf8', Logistics: '#facc15',
};

const MarketplaceProductCard: React.FC<MarketplaceProductCardProps> = memo(({ product, index = 0, onBuyNow, onDemo, rank }) => {
  const { user } = useAuth();
  const { isInCart, toggleItem } = useCart();
  const inCart = isInCart(product.id);

  const isAdmin = user?.role === 'admin';
  const isReseller = user?.role === 'reseller';
  const isUser = user?.role === 'user' || !user?.role;

  const [favorited, setFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [notified, setNotified] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [downloadChecking, setDownloadChecking] = useState(false);
  const [buttonLoading, setButtonLoading] = useState<string | null>(null);
  const [showQuickView, setShowQuickView] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Performance optimizations
  const cardRef = useRef<HTMLDivElement>(null);
  const isPreloaded = useRef(false);
  const cleanupRef = useRef<(() => void)[]>([]);

  const isPipeline = !product.isAvailable || product.status === 'draft' || product.status === 'upcoming';
  const iconColor = catColors[product.category] || '#f97316';
  const cardRank = rank ?? index + 1;

  // Dynamic fields from DB
  const price = product.price || 5;
  const discount = (product as any).discount_percent || 0;
  const rating = (product as any).rating || 4.5;
  const originalPrice = discount > 0 ? Math.round(price / (1 - discount / 100)) : price * 2;
  
  // Control flags from admin
  const demoEnabled = (product as any).demo_enabled === true;
    const buyEnabled = product.buy_enabled !== false;
  const apkEnabled = (product as any).apk_enabled === true || (product as any).download_enabled === true;
  const licenseEnabled = (product as any).license_enabled !== false;

  const features: string[] = Array.isArray(product.features)
    ? product.features.slice(0, 4).map((f: any) => typeof f === 'string' ? f : f.text)
      : ['APK Download', 'License Key', 'Auto Updates', '24/7 Support'];

  const getDemoUrl = useCallback((): string | null => {
    return resolveMaskedDemoUrl({
      slug: product.slug,
      demo_url: (product as any).demoUrl || (product as any).demo_url,
      demo_enabled: demoEnabled,
    });
  }, [product, demoEnabled]);

  const hasDemoAvailable = getDemoUrl() !== null;

  useEffect(() => {
    let cancelled = false;

    const loadFavoriteState = async () => {
      if (!user) {
        setFavorited(false);
        return;
      }

      try {
        const result = await publicMarketplaceApi.isFavorite(product.id);
        if (!cancelled) {
          setFavorited(Boolean(result?.is_favorite));
        }
      } catch {
        if (!cancelled) {
          setFavorited(false);
        }
      }
    };

    // Preload critical UI
    if (!isPreloaded.current && index < 4) {
      isPreloaded.current = true;
    }

    loadFavoriteState();
    
    // Memory cleanup
    return () => {
      cancelled = true;
      cleanupRef.current.forEach(cleanup => cleanup());
      cleanupRef.current = [];
    };
  }, [user, product.id, index]);

  const handleFavorite = useCallback(() => {
    if (!user) {
      toast.error('Sign in to add to favorites');
      return;
    }
    if (favoriteLoading || buttonLoading === 'favorite') {
      return;
    }

    const wasFavorited = favorited;
    setFavorited(!wasFavorited);
    setFavoriteLoading(true);
    setButtonLoading('favorite');

    const request = wasFavorited
      ? publicMarketplaceApi.removeFavorite(product.id)
      : publicMarketplaceApi.addFavorite(product.id);

    request
      .then(() => {
        toast.success(wasFavorited ? 'Removed from favorites' : 'Added to favorites');
      })
      .catch((error: any) => {
        setFavorited(wasFavorited);
        toast.error(error?.message || 'Failed to update favorites');
      })
      .finally(() => {
        setFavoriteLoading(false);
        setButtonLoading(null);
      });
  }, [user, favorited, favoriteLoading, buttonLoading, product.id]);

  const handleAddToCart = useCallback(() => {
    toggleItem({ id: product.id, title: product.title, subtitle: product.subtitle || '', image: product.image || '', price, category: product.category });
    toast.success(inCart ? 'Removed from cart' : `🛒 Added to cart!`);
  }, [product, inCart, toggleItem, price]);

  const handleNotifyMe = useCallback(() => {
    if (!user) { toast.error('Sign in to get notified'); return; }
    setNotified(true);
    toast.success(`🔔 You'll be notified when ${product.title} is ready!`);
  }, [user, product.title]);

  const handleDemo = useCallback(() => {
    if (onDemo) {
      onDemo(product);
      return;
    }

    const demoUrl = (product as any).demoUrl || (product as any).demo_url;
    const maskedDemoUrl = resolveMaskedDemoUrl({
      slug: product.slug,
      demo_url: demoUrl,
      demo_enabled: demoEnabled,
    });

    if (maskedDemoUrl) {
      window.location.assign(maskedDemoUrl);
    } else {
      toast.info('Demo not available for this product');
    }
  }, [demoEnabled, onDemo, product]);

  const handleDownloadApk = useCallback(async () => {
    if (!apkEnabled) {
      toast.info('APK download is currently disabled for this product.');
      return;
    }
    if (!user) {
      toast.error('Please sign in to download APK');
      return;
    }

    // Rate limit: max 3 download attempts per product per minute
    const dlRateKey = `apk-download:${user.id}:${product.id}`;
    if (!rateLimiter.checkLimit(dlRateKey, 3, 60 * 1000)) {
      toast.error('Too many download attempts. Please wait a minute before trying again.');
      return;
    }

    setDownloadChecking(true);
    try {
      const downloadRes = await publicMarketplaceApi.getDownloadUrl(product.id);
      const secureUrl = downloadRes?.download_url || downloadRes?.signed_url || downloadRes?.url;

      if (!downloadRes?.success || !secureUrl) {
        throw new Error(downloadRes?.error || 'No valid license found for this product');
      }

      window.open(secureUrl, '_blank', 'noopener,noreferrer');
      toast.success('APK download started. Secure link is time-limited.');
    } catch (error: any) {
      console.error('Error requesting APK download:', error);
      toast.error(error?.message || 'Failed to verify license. Please try again.');
    } finally {
      setDownloadChecking(false);
    }
  }, [user, product, apkEnabled]);

  const demoUrl = getDemoUrl();

  return (
    <>
      <div
        className="flex-shrink-0 rounded-2xl overflow-hidden flex flex-col group cursor-pointer snap-start"
        style={{
          width: 260,
          minWidth: 260,
          maxWidth: 260,
          height: 420,
          minHeight: 420,
          maxHeight: 420,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border-color 0.3s ease',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.08)',
          willChange: 'transform, box-shadow',
        }}
        onMouseEnter={e => {
          setIsHovered(true);
          e.currentTarget.style.transform = 'scale(1.05) translateY(-6px)';
          e.currentTarget.style.boxShadow = '0 20px 60px rgba(37,99,235,0.25), inset 0 1px 1px rgba(255,255,255,0.12), inset 0 0 30px rgba(37,99,235,0.1)';
          e.currentTarget.style.borderColor = 'rgba(37,99,235,0.5)';
        }}
        onMouseLeave={e => {
          setIsHovered(false);
          e.currentTarget.style.transform = 'scale(1) translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.08)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
        }}
      >
        {/* Header */}
        <div className="relative px-4 py-4 flex items-center gap-3 backdrop-blur-sm" style={{ background: `linear-gradient(135deg, rgba(37,99,235,0.12), rgba(37,99,235,0.04))` }}>
          <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(37,99,235,0.35)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1), 0 2px 8px rgba(37,99,235,0.1)' }}>
            <Box style={{ width: 24, height: 24, color: iconColor, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[13px] text-foreground truncate leading-tight">{product.title}</h3>
            <p className="text-[11px] truncate" style={{ color: iconColor }}>{product.category}</p>
          </div>
          {!isPipeline ? (
            <span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(90deg,#22C55E,#16A34A)', boxShadow: '0 2px 8px rgba(34,197,94,0.3)' }}>LIVE</span>
          ) : (
            <span className="text-[9px] font-black text-black px-2 py-0.5 rounded-full bg-amber-400 flex-shrink-0" style={{ boxShadow: '0 2px 8px rgba(251,191,36,0.3)' }}>PIPELINE</span>
          )}
          <span className="absolute top-2 right-3 text-[10px] font-bold text-white/15">#{cardRank}</span>
          {/* Quick View Button on Hover */}
          {isHovered && (
            <button
              type="button"
              onClick={() => setShowQuickView(true)}
              className="absolute top-2 right-10 p-1.5 rounded-full bg-primary/90 text-white hover:bg-primary transition-all"
              title="Quick View"
            >
              <Eye className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 px-4 py-3 flex flex-col gap-2 overflow-hidden">
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed overflow-hidden text-ellipsis">
            {product.subtitle || 'Complete solution with all features, reports, and integrations.'}
          </p>
          <div className="flex flex-wrap gap-1 overflow-hidden">
            {features.slice(0, 3).map((f, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-muted/80 text-muted-foreground border border-border/50 truncate max-w-[80px] overflow-hidden">{f}</span>
            ))}
          </div>
          {/* Price row — dynamic from DB */}
          <div className="flex items-center gap-2 mt-auto pt-1">
            <span className="text-xs line-through text-muted-foreground/40">${originalPrice}</span>
            <span className="text-xl font-black text-primary">${price}</span>
            {discount > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>{discount}% OFF</span>}
            <div className="ml-auto flex items-center gap-0.5">
              <Star className="fill-yellow-400 text-yellow-400" style={{ width: 11, height: 11 }} />
              <span className="text-[10px] font-bold text-yellow-400">{rating}</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="px-4 pb-4 flex flex-col gap-1.5">
          {isPipeline ? (
            <div className="flex gap-1.5">
              <Button size="sm" className={cn('flex-1 h-8 text-[10px] font-bold rounded-lg', notified ? 'bg-emerald-600' : 'bg-amber-500 text-black hover:bg-amber-400')} onClick={handleNotifyMe}>
                <Bell style={{ width: 12, height: 12 }} className="mr-1" />{notified ? 'NOTIFIED' : 'NOTIFY ME'}
              </Button>
              {/* Role-based: Show favorite for all logged-in users */}
              {user && (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleFavorite}>
                  <Heart style={{ width: 14, height: 14 }} className={favorited ? 'fill-pink-400 text-pink-400' : 'text-muted-foreground'} />
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex gap-1.5">
                {/* DEMO BUTTON - Show only if demo_enabled is true */}
                {demoEnabled && (
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] font-bold rounded-lg border-white/10 text-foreground/70 hover:border-white/20" onClick={handleDemo}>
                    <Play style={{ width: 11, height: 11 }} className="mr-1" />{hasDemoAvailable ? 'DEMO' : 'N/A'}
                  </Button>
                )}
                {/* Role-based: Show favorite for all logged-in users */}
                {user && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 min-h-[44px] min-w-[44px]" onClick={handleFavorite}>
                    <Heart style={{ width: 14, height: 14 }} className={favorited ? 'fill-pink-400 text-pink-400' : 'text-muted-foreground'} />
                  </Button>
                )}
                {/* Role-based: Show cart for users and resellers */}
                {(isUser || isReseller) && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 min-h-[44px] min-w-[44px]" onClick={handleAddToCart} disabled={!buyEnabled}>
                    <ShoppingCart style={{ width: 14, height: 14 }} className={inCart ? 'text-primary' : 'text-muted-foreground'} />
                  </Button>
                )}
              </div>
              {/* BUY NOW BUTTON - Show only if buy_enabled is true */}
              {buyEnabled && (
                <Button size="sm" className="w-full h-9 text-[11px] font-black rounded-lg text-white border-0" style={{ background: 'linear-gradient(90deg,#2563EB,#1D4ED8)' }} onClick={() => onBuyNow(product)}>
                  <Package style={{ width: 13, height: 13 }} className="mr-1" /> BUY NOW — ${price}
                </Button>
              )}
            </>
          )}
          <div className="flex gap-1.5">
            {apkEnabled && (
              <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] font-bold rounded-lg text-white border-0" style={{ background: 'linear-gradient(90deg,#7C3AED,#6D28D9)' }} onClick={handleDownloadApk} disabled={downloadChecking || isPipeline}>
                <Download style={{ width: 11, height: 11 }} className="mr-1" />{downloadChecking ? '...' : isPipeline ? 'PIPELINE' : 'APK'}
              </Button>
            )}
            <Button size="sm" variant="outline" className={cn('h-7 text-[10px] font-bold rounded-lg border-white/10 text-muted-foreground', apkEnabled ? 'flex-1' : 'w-full')} onClick={() => setFeaturesOpen(true)}>
              <Info style={{ width: 11, height: 11 }} className="mr-1" /> FEATURES
            </Button>
          </div>
        </div>
      </div>

      {/* Demo Dialog */}
      {demoOpen && (
        <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
          <DialogContent className="max-w-4xl w-[95vw] h-[80vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-4 pt-3 pb-2 border-b border-border shrink-0">
              <DialogTitle className="text-sm font-black uppercase">{product.title} — Live Demo</DialogTitle>
              <DialogDescription className="text-xs">{(product as any).demoLogin && (product as any).demoPassword ? `${(product as any).demoLogin} / ${(product as any).demoPassword}` : 'Demo credentials available'}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 relative bg-muted/30 overflow-hidden">
              {demoUrl ? (
                <iframe src={buildDemoProxyUrl(product.slug)} className="w-full h-full border-0" title="Demo" sandbox="allow-scripts allow-same-origin allow-forms allow-modals" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Demo coming soon</p></div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-border flex items-center gap-2 shrink-0">
              {demoUrl && (
                <>
                  <code className="text-xs bg-muted px-2 py-1 rounded truncate flex-1">{demoUrl}</code>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => { navigator.clipboard.writeText(demoUrl); toast.success('Copied!'); }}>
                    <Copy style={{ width: 12, height: 12 }} />
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={() => window.location.assign(demoUrl)}>
                    <ExternalLink style={{ width: 12, height: 12 }} className="mr-1" /> Open
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quick View Dialog */}
      {showQuickView && (
        <Dialog open={showQuickView} onOpenChange={setShowQuickView}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <DialogTitle className="text-lg font-bold">{product.title}</DialogTitle>
                  <DialogDescription className="text-sm mt-1">{product.category} • {rating} ★ • {(product as any).sales_count || 0} sales</DialogDescription>
                </div>
                <Badge className={cn(isPipeline ? 'bg-amber-500' : 'bg-green-500')}>
                  {isPipeline ? 'PIPELINE' : 'LIVE'}
                </Badge>
              </div>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Price */}
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-primary">${price}</span>
                {originalPrice && <span className="text-lg text-muted-foreground line-through">${originalPrice}</span>}
                {discount > 0 && <Badge variant="destructive">{discount}% OFF</Badge>}
              </div>

              {/* Description */}
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-foreground">{product.subtitle || 'Complete solution with all features, reports, and integrations.'}</p>
              </div>

              {/* Features */}
              <div>
                <h4 className="text-sm font-bold mb-2">Key Features</h4>
                <div className="flex flex-wrap gap-2">
                  {features.slice(0, 6).map((f, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {buyEnabled && (
                  <Button className="flex-1" onClick={() => { setShowQuickView(false); onBuyNow(product); }}>
                    <Package className="mr-2 h-4 w-4" /> Buy Now
                  </Button>
                )}
                {demoEnabled && (
                  <Button variant="outline" className="flex-1" onClick={() => { setShowQuickView(false); if (onDemo) onDemo(product); }}>
                    <Play className="mr-2 h-4 w-4" /> Demo
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Features Dialog */}
      {featuresOpen && (
        <Dialog open={featuresOpen} onOpenChange={setFeaturesOpen}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm font-black uppercase">{product.title}</DialogTitle>
              <DialogDescription>Features & details</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="rounded-lg border border-border/60 p-3">
                <h4 className="text-[11px] font-black text-primary uppercase mb-2">Features</h4>
                <ul className="space-y-1">
                  {features.map((f, i) => <li key={i} className="text-[12px] text-foreground flex gap-2"><span className="text-primary">✓</span>{f}</li>)}
                  <li className="text-[12px] text-foreground flex gap-2"><span className="text-primary">✓</span>Full Source Code</li>
                  {licenseEnabled && <li className="text-[12px] text-foreground flex gap-2"><span className="text-primary">✓</span>Lifetime License</li>}
                </ul>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 h-10 text-xs font-black" onClick={() => { setFeaturesOpen(false); onBuyNow(product); }}>
                  <ShoppingCart style={{ width: 14, height: 14 }} className="mr-1" /> BUY — ${price}
                </Button>
                <Button variant="outline" className="flex-1 h-10 text-xs font-bold" onClick={() => { setFeaturesOpen(false); handleDemo(); }}>
                  <Play style={{ width: 14, height: 14 }} className="mr-1" /> DEMO
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
});
MarketplaceProductCard.displayName = 'MarketplaceProductCard';

export default MarketplaceProductCard;
export { MarketplaceProductCard };

export const ComingSoonCard = memo(function ComingSoonCard({ label }: { label: string }) {
  return (
    <div className="flex-shrink-0" style={{ width: 280 }}>
      <div className="rounded-2xl border border-dashed flex flex-col items-center justify-center gap-3 text-center"
        style={{ minHeight: 320, borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
        <Package style={{ width: 28, height: 28 }} className="text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Coming Soon</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        <Badge variant="outline" className="text-[10px]">ON PIPELINE</Badge>
      </div>
    </div>
  );
});
