import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart, Bell, Heart, Star,
  Package, Play, Box
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { MarketplaceProduct } from '@/hooks/useMarketplaceProducts';

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

  const handleDemo = () => {
    if (product.demoUrl) {
      window.open(product.demoUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Show demo credentials popup or fallback
      toast.info(`Demo for ${product.title} — Contact us at saasvala.com/demo`, {
        duration: 4000,
        action: {
          label: 'Request',
          onClick: () => window.open('mailto:demo@saasvala.com?subject=Demo Request: ' + product.title, '_blank'),
        },
      });
    }
  };

  const cardRank = rank ?? index + 1;

  return (
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
        {/* ── TOP ICON AREA ── exact match to screenshot */}
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
          <div className="mt-1">
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
                {/* DEMO */}
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-10 text-[12px] font-bold gap-1.5 rounded-xl border-border hover:border-primary/50 hover:text-primary"
                  onClick={handleDemo}
                >
                  <Play style={{ width: 14, height: 14 }} />
                  DEMO
                </Button>
                {/* ADD TO CART (heart) */}
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
                {/* BUY */}
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
          </div>
        </div>
      </div>
    </motion.div>
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
