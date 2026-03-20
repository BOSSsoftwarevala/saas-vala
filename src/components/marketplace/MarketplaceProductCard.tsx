import React, { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart, Bell, Heart, Star, Info, Download,
  Package, Play, Box, Copy, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import type { MarketplaceProduct } from '@/hooks/useMarketplaceProducts';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface MarketplaceProductCardProps {
  product: MarketplaceProduct;
  index?: number;
  onBuyNow: (p: any) => void;
  rank?: number;
}

const catColors: Record<string, string> = {
  Healthcare: '#60a5fa', Finance: '#4ade80', Education: '#a78bfa',
  Retail: '#fb923c', Food: '#f87171', Transport: '#22d3ee',
  Marketing: '#e879f9', HR: '#818cf8', Logistics: '#facc15',
};

export const MarketplaceProductCard = React.memo<MarketplaceProductCardProps>(({
  product, index = 0, onBuyNow, rank,
}) => {
  const [favorited, setFavorited] = useState(false);
  const [notified, setNotified] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [downloadChecking, setDownloadChecking] = useState(false);
  const { user } = useAuth();
  const { isInCart, toggleItem } = useCart();
  const inCart = isInCart(product.id);

  const isPipeline = !product.isAvailable || product.status === 'draft' || product.status === 'upcoming';
  const iconColor = catColors[product.category] || '#f97316';
  const cardRank = rank ?? index + 1;

  // Dynamic fields from DB
  const price = product.price || 5;
  const discount = (product as any).discount_percent || 0;
  const rating = (product as any).rating || 4.5;
  const originalPrice = discount > 0 ? Math.round(price / (1 - discount / 100)) : price * 2;
  const apkEnabled = (product as any).apk_enabled !== false;
  const licenseEnabled = (product as any).license_enabled !== false;

  const features: string[] = Array.isArray(product.features)
    ? product.features.slice(0, 4).map((f: any) => typeof f === 'string' ? f : f.text)
    : ['Dashboard', 'Reports', 'Analytics', 'API'];

  const getDemoUrl = useCallback((): string | null => {
    // Priority: GitHub repo URL first (user requirement), then demo_url fallback
    const g = (product as any).gitRepoUrl || (product as any).git_repo_url;
    if (g && g.startsWith('http')) return g;
    const d = (product as any).demoUrl || (product as any).demo_url;
    if (d && d.startsWith('http')) return d;
    return null;
  }, [product]);

  const isIframeable = (url: string | null) => url ? !url.includes('github.com') : false;
  const hasDemoAvailable = getDemoUrl() !== null;

  const handleFavorite = useCallback(() => {
    if (!user) { toast.error('Sign in to add to favorites'); return; }
    setFavorited(p => !p);
    toast.success(favorited ? 'Removed from favorites' : `❤️ Added to favorites!`);
  }, [user, favorited]);

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
    const url = getDemoUrl();
    if (!url) { setFeaturesOpen(true); return; }
    if (!isIframeable(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      setDemoOpen(true);
    }
  }, [getDemoUrl]);

  const handleDownloadApk = useCallback(async () => {
    if (!apkEnabled) { toast.info('APK download is currently disabled for this product.'); return; }
    if (!user) { toast.error('Please sign in to download APK'); return; }
    setDownloadChecking(true);
    try {
      const { data: licenseRecord } = await supabase
        .from('license_keys').select('license_key, status, expires_at, meta')
        .eq('created_by', user.id).eq('status', 'active').limit(50);
      const match = licenseRecord?.find((l: any) => {
        const m = l.meta as any;
        return m?.product_id === product.id || m?.product_title === product.title;
      });
      if (!match?.license_key) {
        toast.error('Please purchase first', { action: { label: 'BUY NOW', onClick: () => onBuyNow(product) } });
        setDownloadChecking(false); return;
      }
      if (match.expires_at && new Date(match.expires_at) < new Date()) {
        toast.error('License expired. Please renew.'); setDownloadChecking(false); return;
      }
      const isUuid = /^[0-9a-f]{8}-/.test(product.id);
      if (isUuid) {
        const { data, error } = await supabase.functions.invoke('download-apk', {
          body: { product_id: product.id, license_key: match.license_key },
        });
        if (!error && data?.success) { window.open(data.download_url, '_blank'); setDownloadChecking(false); return; }
      }
      toast.success(`✅ License Key: ${match.license_key}`, {
        duration: 10000,
        action: { label: 'Copy', onClick: () => navigator.clipboard.writeText(match.license_key) },
      });
    } catch { toast.info('APK download will be available soon.'); }
    setDownloadChecking(false);
  }, [user, product, onBuyNow, apkEnabled]);

  const demoUrl = getDemoUrl();

  return (
    <>
      <div
        className="flex-shrink-0 rounded-2xl overflow-hidden flex flex-col group cursor-pointer snap-start card-10d card-stagger"
        style={{
          width: 'clamp(220px, 28vw, 280px)',
          minWidth: 220,
          maxWidth: 280,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          animationDelay: `${index * 80}ms`,
        }}
      >
        {/* Header */}
        <div className="relative px-4 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, rgba(37,99,235,0.08), transparent)` }}>
          <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.25)' }}>
            <Box style={{ width: 24, height: 24, color: iconColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[13px] text-foreground truncate leading-tight">{product.title}</h3>
            <p className="text-[11px] truncate" style={{ color: iconColor }}>{product.category}</p>
          </div>
          {!isPipeline ? (
            <span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full" style={{ background: 'linear-gradient(90deg,#22C55E,#16A34A)' }}>LIVE</span>
          ) : (
            <span className="text-[9px] font-black text-black px-2 py-0.5 rounded-full bg-amber-400">PIPELINE</span>
          )}
          <span className="absolute top-2 right-3 text-[10px] font-bold text-white/20">#{cardRank}</span>
        </div>

        {/* Body */}
        <div className="flex-1 px-4 py-3 flex flex-col gap-2">
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {product.subtitle || 'Complete solution with all features, reports, and integrations.'}
          </p>
          <div className="flex flex-wrap gap-1">
            {features.slice(0, 3).map((f, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-muted/80 text-muted-foreground border border-border/50">{f}</span>
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
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleFavorite}>
                <Heart style={{ width: 14, height: 14 }} className={favorited ? 'fill-pink-400 text-pink-400' : 'text-muted-foreground'} />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] font-bold rounded-lg border-white/10 text-foreground/70 hover:border-white/20 btn-glow ripple-container" onClick={handleDemo}>
                  <Play style={{ width: 11, height: 11 }} className="mr-1" />{hasDemoAvailable ? 'DEMO' : 'VIEW'}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 ripple-container" onClick={handleFavorite}>
                  <Heart style={{ width: 14, height: 14 }} className={cn('transition-transform duration-200', favorited ? 'fill-pink-400 text-pink-400 scale-110' : 'text-muted-foreground')} />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 ripple-container" onClick={handleAddToCart}>
                  <ShoppingCart style={{ width: 14, height: 14 }} className={cn('transition-transform duration-200', inCart ? 'text-primary scale-110' : 'text-muted-foreground')} />
                </Button>
              </div>
              <Button size="sm" className="w-full h-9 text-[11px] font-black rounded-lg text-white border-0 btn-glow ripple-container" style={{ background: 'linear-gradient(135deg,#2563EB,#1D4ED8,#3B82F6)' }} onClick={() => onBuyNow(product)}>
                <Package style={{ width: 13, height: 13 }} className="mr-1" /> BUY NOW — ${price}
              </Button>
            </>
          )}
          <div className="flex gap-1.5">
            {apkEnabled && (
              <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] font-bold rounded-lg text-white border-0 btn-glow ripple-container" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9,#8B5CF6)' }} onClick={handleDownloadApk} disabled={downloadChecking || isPipeline}>
                <Download style={{ width: 11, height: 11 }} className="mr-1" />{downloadChecking ? '...' : isPipeline ? 'PIPELINE' : 'APK'}
              </Button>
            )}
            <Button size="sm" variant="outline" className={cn('h-7 text-[10px] font-bold rounded-lg border-white/10 text-muted-foreground btn-glow ripple-container', apkEnabled ? 'flex-1' : 'w-full')} onClick={() => setFeaturesOpen(true)}>
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
              <DialogDescription className="text-xs">{(product as any).demoLogin || 'demo@softwarevala.com'} / {(product as any).demoPassword || 'Demo@2026'}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 relative bg-muted/30 overflow-hidden">
              {demoUrl && isIframeable(demoUrl) ? (
                <iframe src={demoUrl} className="w-full h-full border-0" title="Demo" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" loading="lazy" />
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
                  <Button size="sm" className="h-7 text-xs" onClick={() => window.open(demoUrl, '_blank')}>
                    <ExternalLink style={{ width: 12, height: 12 }} className="mr-1" /> Open
                  </Button>
                </>
              )}
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

export function ComingSoonCard({ label }: { label: string }) {
  return (
    <div className="flex-shrink-0 snap-start" style={{ width: 'clamp(220px, 28vw, 280px)', minWidth: 220, maxWidth: 280 }}>
      <div className="rounded-2xl border border-dashed flex flex-col items-center justify-center gap-3 text-center"
        style={{ minHeight: 320, borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
        <Package style={{ width: 28, height: 28 }} className="text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Coming Soon</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        <Badge variant="outline" className="text-[10px]">ON PIPELINE</Badge>
      </div>
    </div>
  );
}
