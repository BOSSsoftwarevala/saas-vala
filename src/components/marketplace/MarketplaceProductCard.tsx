import { useState } from 'react';
import { motion } from 'framer-motion';
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
import type { MarketplaceProduct } from '@/hooks/useMarketplaceProducts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MarketplaceProductCardProps {
  product: MarketplaceProduct;
  index?: number;
  onBuyNow: (p: any) => void;
  onAddProduct?: (p: MarketplaceProduct) => void;
  accentColor?: string;
  borderColor?: string;
  iconColor?: string;
  rank?: number;
}

// Category → icon color + emoji
const categoryColors: Record<string, { bg: string; icon: string; dot: string }> = {
  Healthcare: { bg: '#1a3a5c', icon: '#60a5fa', dot: '🏥' },
  Finance:    { bg: '#1a3b2a', icon: '#4ade80', dot: '💰' },
  Education:  { bg: '#2d1f5a', icon: '#a78bfa', dot: '📚' },
  Retail:     { bg: '#3b2010', icon: '#fb923c', dot: '🛒' },
  Food:       { bg: '#3b1a1a', icon: '#f87171', dot: '🍽️' },
  Transport:  { bg: '#0f3040', icon: '#22d3ee', dot: '🚗' },
  Marketing:  { bg: '#3a1040', icon: '#e879f9', dot: '📣' },
  HR:         { bg: '#1a1f5a', icon: '#818cf8', dot: '👥' },
  Logistics:  { bg: '#3a3010', icon: '#facc15', dot: '📦' },
  default:    { bg: '#1e2235', icon: '#f97316', dot: '⚡' },
};

function getCatStyle(cat: string) {
  return categoryColors[cat] || categoryColors.default;
}


export function MarketplaceProductCard({
  product,
  index = 0,
  onBuyNow,
  rank,
}: MarketplaceProductCardProps) {
  const [wishlisted, setWishlisted] = useState(false);
  const [notified, setNotified] = useState(false);
  const [activeTab, setActiveTab] = useState<'features' | 'tech'>('features');
  const [demoOpen, setDemoOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const { user } = useAuth();

  const isPipeline = !product.isAvailable || product.status === 'draft' || product.status === 'upcoming';
  const cat = getCatStyle(product.category);

  // Features list
  const features: string[] = Array.isArray(product.features)
    ? product.features.slice(0, 4).map((f: any) => typeof f === 'string' ? f : f.text)
    : [];
  const defaultFeatures = ['Dashboard', 'Reports', 'Analytics', 'API'];
  const showFeatures = features.length > 0 ? features : defaultFeatures;

  const techStack: string[] = Array.isArray((product as any).techStack)
    ? (product as any).techStack.slice(0, 5)
    : ['React', 'Node.js', 'PostgreSQL', 'AWS', 'SSL'];

  const handleWishlist = async () => {
    if (!user) { toast.error('Sign in to add to cart'); return; }
    try {
      if (wishlisted) {
        await supabase.from('product_wishlists').delete()
          .eq('user_id', user.id).eq('product_id', product.id);
        setWishlisted(false);
        toast('Removed from cart');
      } else {
        await supabase.from('product_wishlists').insert({
          user_id: user.id,
          product_id: product.id,
          product_name: product.title,
        });
        setWishlisted(true);
        toast.success(`🛒 ${product.title} added to cart!`);
      }
    } catch {
      setWishlisted(!wishlisted);
      toast.success(wishlisted ? 'Removed from cart' : `🛒 Added to cart!`);
    }
  };

  const handleNotifyMe = async () => {
    if (!user) { toast.error('Sign in to get notified'); return; }
    try {
      await supabase.from('product_notify_me').insert({
        user_id: user.id,
        email: user.email || '',
        product_id: product.id,
        product_name: product.title,
      });
    } catch { /* duplicate ok */ }
    setNotified(true);
    toast.success(`🔔 You'll be notified when ${product.title} is ready!`);
  };

  // Helper: check if an ID looks like a valid UUID
  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // Get the best available demo/source URL
  const getDemoUrl = (): string | null => {
    // 1. Explicit demo URL from database (trust DB values — they were set intentionally)
    const demoUrl = (product as any).demoUrl || (product as any).demo_url;
    if (demoUrl && demoUrl.startsWith('http') && !demoUrl.includes('github.com')) return demoUrl;
    // 2. Live URL if available
    const liveUrl = (product as any).liveUrl || (product as any).live_url;
    if (liveUrl && liveUrl.startsWith('http')) return liveUrl;
    // 3. GitHub repo URL (always real & accessible)
    const gitRepo = (product as any).github_repo || (product as any).gitRepoUrl || (product as any).git_repo_url || (product as any).githubUrl;
    if (gitRepo && gitRepo.startsWith('http')) return gitRepo;
    // 4. No demo available
    return null;
  };

  // Check if the URL can be embedded in iframe (not GitHub)
  const isIframeable = (url: string | null): boolean => {
    if (!url) return false;
    if (url.includes('github.com')) return false;
    return true;
  };

  const _getApkUrl = (): string | null => {
    return (product as any).apkUrl || (product as any).apk_url || null;
  };

  const hasDemoAvailable = getDemoUrl() !== null;

  const handleDemo = () => {
    const demoUrl = getDemoUrl();
    if (!demoUrl) {
      // No URL available — open features panel instead
      setFeaturesOpen(true);
      toast.info(`${product.title} — View features & details`, { duration: 3000 });
      return;
    }
    // GitHub or non-iframeable URLs → open in new tab
    if (!isIframeable(demoUrl)) {
      const w = window.open(demoUrl, '_blank', 'noopener,noreferrer');
      if (!w) {
        // Popup blocked fallback
        navigator.clipboard.writeText(demoUrl);
        toast.success(`Link copied! Open: ${demoUrl}`);
      } else {
        toast.success(`Opening ${product.title} source code`);
      }
    } else {
      // Actual deployed app → open in iframe dialog
      setDemoOpen(true);
      toast.success(`Loading live demo for ${product.title}`);
    }
    if (isUuid(product.id)) {
      supabase.from('activity_logs').insert({
        entity_type: 'demo', entity_id: product.id, action: 'demo_opened',
        performed_by: user?.id || null,
        details: { product_id: product.id, product_name: product.title, demo_url: demoUrl },
      });
    }
  };

  const [downloadChecking, setDownloadChecking] = useState(false);

  const handleDownloadApk = async () => {
    if (!user) {
      toast.error('Please sign in to download APK');
      return;
    }

    setDownloadChecking(true);

    try {
      // Check if user has purchased this product (has a valid license)
      const { data: license } = await supabase
        .from('apk_downloads')
        .select('license_key')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .eq('is_blocked', false)
        .maybeSingle();

      if (!license) {
        toast.error('Please purchase this software first to download the APK');
        setDownloadChecking(false);
        return;
      }

      // User has license → trigger secure download via edge function
      const { data, error } = await supabase.functions.invoke('download-apk', {
        body: { product_id: product.id, license_key: license.license_key },
      });

      if (error || !data?.success) {
        // Fallback: if no APK file uploaded yet
        toast.info('APK file will be available for download soon. Your license key is valid.');
        setDownloadChecking(false);
        return;
      }

      // Open signed download URL
      window.open(data.download_url, '_blank');
      toast.success(`Downloading APK for ${product.title}`);
    } catch {
      toast.info('APK download will be available soon.');
    }
    setDownloadChecking(false);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const cardRank = rank ?? index + 1;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, type: 'spring', stiffness: 280, damping: 26 }}
        whileHover={{ scale: 1.015, zIndex: 10 }}
        className="flex-shrink-0"
        style={{ width: '340px' }}
      >
        <div
          className="rounded-2xl overflow-hidden border border-border/50 shadow-xl h-full flex flex-col"
          style={{ background: 'hsl(var(--card))' }}
        >
          {/* ── TOP ICON AREA ── */}
          <div
            className="relative flex items-center justify-between px-5 py-5"
            style={{ backgroundColor: cat.bg, minHeight: '100px' }}
          >
            {/* Orange icon box — left */}
            <div
              className="flex items-center justify-center rounded-xl shadow-lg"
              style={{
                width: 64,
                height: 64,
                background: 'rgba(249,115,22,0.25)',
                border: '1.5px solid rgba(249,115,22,0.4)',
              }}
            >
              <Box
                className="text-orange-400"
                style={{ width: 30, height: 30, color: '#f97316' }}
              />
            </div>

            {/* LIVE DEMO badge — center */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              {!isPipeline ? (
                <span
                  className="flex items-center gap-1.5 font-black text-white text-[11px] px-3 py-1 rounded-full"
                  style={{ background: '#16a34a', boxShadow: '0 0 12px rgba(22,163,74,0.5)' }}
                >
                  <span
                    className="inline-block rounded-full animate-pulse"
                    style={{ width: 6, height: 6, background: '#fff' }}
                  />
                  LIVE DEMO
                </span>
              ) : (
                <span
                  className="flex items-center gap-1.5 font-black text-black text-[11px] px-3 py-1 rounded-full"
                  style={{ background: '#eab308' }}
                >
                  ON PIPELINE
                </span>
              )}
            </div>

            {/* Rank — right */}
            <span className="text-xs font-bold text-white/50 self-start">#{cardRank}</span>
          </div>

          {/* ── CARD BODY ── */}
          <div className="flex flex-col flex-1 p-5 gap-2">

            {/* Product name */}
            <h3 className="font-black text-[15px] text-foreground uppercase leading-tight">
              {product.title}
            </h3>

            {/* Category + short subtitle */}
            <p className="text-[12px] font-semibold flex items-center gap-1" style={{ color: cat.icon }}>
              <span>📍</span>
              <span>{product.category}</span>
              {product.subtitle && (
                <span className="text-muted-foreground font-normal ml-1 truncate">
                  — {product.subtitle.slice(0, 28)}{product.subtitle.length > 28 ? '…' : ''}
                </span>
              )}
            </p>

            {/* Description */}
            <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
              {(product as any).description || product.subtitle || 'Complete solution with all features, reports, and integrations...'}
            </p>

            {/* ── FEATURES / TECH TABS ── */}
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setActiveTab('features')}
                className={cn(
                  'text-[11px] font-bold px-3 py-1 rounded-full border transition-all',
                  activeTab === 'features'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-primary'
                )}
              >
                Features
              </button>
              <button
                onClick={() => setActiveTab('tech')}
                className={cn(
                  'text-[11px] font-bold px-3 py-1 rounded-full border transition-all',
                  activeTab === 'tech'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-primary'
                )}
              >
                Tech Stack
              </button>
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-1.5 min-h-[52px]">
              {activeTab === 'features'
                ? showFeatures.map((f, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[11px] border border-border/50 text-foreground px-2 py-0.5 rounded-md"
                      style={{ background: 'rgba(255,255,255,0.04)' }}
                    >
                      <Box style={{ width: 11, height: 11, color: '#9ca3af' }} />
                      {f}
                    </span>
                  ))
                : techStack.map((t, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md border"
                      style={
                        i === 0 ? { background: 'rgba(59,130,246,0.15)', color: '#60a5fa', borderColor: 'rgba(59,130,246,0.3)' }
                        : i === 1 ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80', borderColor: 'rgba(34,197,94,0.3)' }
                        : i === 2 ? { background: 'rgba(249,115,22,0.15)', color: '#fb923c', borderColor: 'rgba(249,115,22,0.3)' }
                        : { background: 'rgba(255,255,255,0.05)', color: '#9ca3af', borderColor: 'rgba(255,255,255,0.1)' }
                      }
                    >
                      {t}
                    </span>
                  ))
              }
            </div>

            {/* ── PRICE ── */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm line-through text-muted-foreground">$10</span>
              <span className="text-[28px] font-black text-primary leading-none">$5</span>
              <span
                className="text-[11px] font-black px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                90% OFF
              </span>
              <div className="ml-auto flex items-center gap-0.5">
                <Star className="fill-yellow-400 text-yellow-400" style={{ width: 13, height: 13 }} />
                <span className="text-[11px] font-bold text-yellow-400">4.9</span>
              </div>
            </div>

            {/* ── BUTTONS ── */}
            <div className="mt-1 flex flex-col gap-2">
              {isPipeline ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className={cn(
                      'flex-1 h-10 text-[12px] font-bold gap-1.5 rounded-xl',
                      notified ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-yellow-500 hover:bg-yellow-400 text-black'
                    )}
                    onClick={handleNotifyMe}
                  >
                    <Bell style={{ width: 14, height: 14 }} />
                    {notified ? 'NOTIFIED' : 'NOTIFY ME'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      'h-10 w-11 p-0 rounded-xl',
                      wishlisted ? 'border-pink-500/60 text-pink-400' : 'border-border text-muted-foreground hover:text-pink-400 hover:border-pink-400/50'
                    )}
                    onClick={handleWishlist}
                    title="Add to Cart"
                  >
                    <Heart style={{ width: 16, height: 16 }} className={wishlisted ? 'fill-pink-400 text-pink-400' : ''} />
                  </Button>
                  <Button
                    size="sm"
                    disabled
                    className="flex-1 h-10 text-[12px] font-bold rounded-xl opacity-40 gap-1.5"
                  >
                    <ShoppingCart style={{ width: 14, height: 14 }} />
                    BUY $5
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "flex-1 h-10 text-[12px] font-bold gap-1.5 rounded-xl border-border",
                      hasDemoAvailable ? "hover:border-primary/50 hover:text-primary" : "opacity-70"
                    )}
                    onClick={handleDemo}
                  >
                    <Play style={{ width: 14, height: 14 }} />
                    {hasDemoAvailable ? 'DEMO' : 'VIEW'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      'h-10 w-11 p-0 rounded-xl',
                      wishlisted ? 'border-pink-500/60 text-pink-400 bg-pink-500/10' : 'border-border text-muted-foreground hover:text-pink-400 hover:border-pink-400/50'
                    )}
                    onClick={handleWishlist}
                    title="Add to Cart"
                  >
                    <Heart style={{ width: 16, height: 16 }} className={wishlisted ? 'fill-pink-400 text-pink-400' : ''} />
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-10 text-[12px] font-black gap-1.5 rounded-xl"
                    onClick={() => onBuyNow(product)}
                  >
                    <ShoppingCart style={{ width: 14, height: 14 }} />
                    BUY $5
                  </Button>
                </div>
              )}
              {/* DOWNLOAD APK + FEATURES BUTTONS */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-9 text-[11px] font-bold gap-1.5 rounded-xl border-border hover:border-green-500/50 hover:text-green-500"
                  onClick={handleDownloadApk}
                  disabled={downloadChecking}
                >
                  <Download style={{ width: 13, height: 13 }} />
                  {downloadChecking ? 'CHECKING...' : 'DOWNLOAD APK'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-9 text-[11px] font-bold gap-1.5 rounded-xl border-border hover:border-accent hover:bg-accent/10"
                  onClick={() => setFeaturesOpen(true)}
                >
                  <Info style={{ width: 13, height: 13 }} />
                  FEATURES
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── LIVE DEMO iFrame DIALOG ── */}
      <Dialog open={demoOpen} onOpenChange={(open) => { setDemoOpen(open); if (!open) setIframeLoaded(false); }}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase">
              <Play className="text-primary" style={{ width: 18, height: 18 }} />
              {product.title} — Live Demo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Interactive preview • Login: demo@softwarevala.com / Demo@2026
            </DialogDescription>
          </DialogHeader>

          {/* iFrame Demo */}
          <div className="flex-1 relative bg-muted/30 overflow-hidden">
            {getDemoUrl() && isIframeable(getDemoUrl()) ? (
              <>
                <iframe
                  src={getDemoUrl()!}
                  className="w-full h-full border-0"
                  title={`${product.title} Live Demo`}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  loading="lazy"
                  onLoad={() => setIframeLoaded(true)}
                />
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 pointer-events-none">
                    <div className="text-center space-y-2">
                      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground">Loading demo...</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-3 p-8">
                  <div className="text-5xl">🚧</div>
                  <p className="text-lg font-bold text-foreground">Live demo will be available soon</p>
                  <p className="text-sm text-muted-foreground">This product is being prepared for launch. Check back later!</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 shrink-0">
            {getDemoUrl() && (
              <>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[200px] md:max-w-[400px]">{getDemoUrl()}</code>
                  <Button size="sm" variant="outline" className="h-7 px-2 shrink-0" onClick={() => handleCopy(getDemoUrl()!, 'Demo URL')}>
                    <Copy style={{ width: 12, height: 12 }} />
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => handleCopy('demo@softwarevala.com', 'Email')}>
                    📧 Copy Login
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => handleCopy('Demo@2026', 'Password')}>
                    🔑 Copy Password
                  </Button>
                  <Button size="sm" className="h-8 text-xs gap-1 font-bold" onClick={() => window.open(getDemoUrl()!, '_blank', 'noopener,noreferrer')}>
                    <ExternalLink style={{ width: 13, height: 13 }} />
                    Open Full Screen
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── FEATURES & ADVANTAGES DIALOG ── */}
      <Dialog open={featuresOpen} onOpenChange={setFeaturesOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase">
              <Info className="text-primary" style={{ width: 18, height: 18 }} />
              {product.title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Complete features, benefits & use cases
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-2">
            {/* APP FEATURES */}
            <div className="rounded-xl border border-border/60 p-4">
              <h4 className="text-[12px] font-black text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                <Box style={{ width: 14, height: 14 }} /> App Features
              </h4>
              <ul className="space-y-2">
                {showFeatures.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
                <li className="flex items-start gap-2 text-[13px] text-foreground">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Full Source Code Included</span>
                </li>
                <li className="flex items-start gap-2 text-[13px] text-foreground">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Lifetime License Key</span>
                </li>
              </ul>
            </div>

            {/* TECH STACK */}
            <div className="rounded-xl border border-border/60 p-4">
              <h4 className="text-[12px] font-black text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                <Box style={{ width: 14, height: 14 }} /> Tech Stack
              </h4>
              <div className="flex flex-wrap gap-2">
                {techStack.map((t, i) => (
                  <span key={i} className="text-[12px] font-semibold px-3 py-1 rounded-lg bg-muted text-foreground border border-border/50">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* ADVANTAGES */}
            <div className="rounded-xl border border-border/60 p-4">
              <h4 className="text-[12px] font-black text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                <Star style={{ width: 14, height: 14 }} /> Advantages
              </h4>
              <ul className="space-y-2">
                {[
                  'Ready-to-deploy business solution',
                  'Offline demo included — test before you buy',
                  'Full source architecture visible',
                  'Fast deployment — live in minutes',
                  'Low cost licensing — one-time $5 payment',
                  'No recurring fees or subscriptions',
                  'White-label ready — rebrand as your own',
                ].map((adv, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                    <span className="text-primary mt-0.5">⚡</span>
                    <span>{adv}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* USE CASES */}
            <div className="rounded-xl border border-border/60 p-4">
              <h4 className="text-[12px] font-black text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                <Play style={{ width: 14, height: 14 }} /> Use Cases
              </h4>
              <ul className="space-y-2">
                {[
                  `Launch your own ${product.category} business`,
                  'Resell as a white-label SaaS product',
                  'Use as a base for custom client projects',
                  'Internal tool for your organization',
                  'Portfolio showcase & demonstration',
                ].map((uc, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                    <span className="text-primary mt-0.5">→</span>
                    <span>{uc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="flex gap-2">
              <Button
                className="flex-1 h-11 text-sm font-black gap-2"
                onClick={() => { setFeaturesOpen(false); onBuyNow(product); }}
              >
                <ShoppingCart style={{ width: 15, height: 15 }} />
                BUY NOW — $5
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-11 text-sm font-bold gap-2"
                onClick={() => { setFeaturesOpen(false); handleDemo(); }}
              >
                <Play style={{ width: 15, height: 15 }} />
                VIEW DEMO
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── COMING SOON PLACEHOLDER ─── */
export function ComingSoonCard({ label }: { label: string }) {
  return (
    <div className="flex-shrink-0" style={{ width: '340px' }}>
      <div className="rounded-2xl border border-dashed border-border bg-card/50 flex flex-col items-center justify-center gap-3 text-center" style={{ minHeight: 420 }}>
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Package style={{ width: 28, height: 28 }} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Coming Soon</p>
          <p className="text-xs text-muted-foreground mt-1">{label} products launching soon</p>
        </div>
        <Badge variant="outline" className="text-[10px]">ON PIPELINE</Badge>
      </div>
    </div>
  );
}
