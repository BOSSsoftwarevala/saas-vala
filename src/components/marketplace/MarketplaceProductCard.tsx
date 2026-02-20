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

// Category → icon color mapping
const categoryColors: Record<string, { bg: string; text: string; dot: string }> = {
  Healthcare: { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: '🏥' },
  Finance: { bg: 'bg-green-500/20', text: 'text-green-400', dot: '💰' },
  Education: { bg: 'bg-purple-500/20', text: 'text-purple-400', dot: '📚' },
  Retail: { bg: 'bg-orange-500/20', text: 'text-orange-400', dot: '🛒' },
  Food: { bg: 'bg-red-500/20', text: 'text-red-400', dot: '🍽️' },
  Transport: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', dot: '🚗' },
  Marketing: { bg: 'bg-pink-500/20', text: 'text-pink-400', dot: '📣' },
  HR: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', dot: '👥' },
  Logistics: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: '📦' },
  default: { bg: 'bg-primary/20', text: 'text-primary', dot: '⚡' },
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
  const catStyle = getCatStyle(product.category);

  // Features and tech stack from product
  const features: string[] = Array.isArray(product.features)
    ? product.features.slice(0, 4).map((f: any) => typeof f === 'string' ? f : f.text)
    : [];
  const techStack: string[] = Array.isArray((product as any).techStack)
    ? (product as any).techStack.slice(0, 5)
    : ['React', 'Node.js', 'PostgreSQL', 'AWS', 'SSL'];

  const handleWishlist = async () => {
    if (!user) { toast.error('Sign in to save to wishlist'); return; }
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
      // Optimistic update anyway
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
      toast.info('Demo not available yet');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 280, damping: 26 }}
      whileHover={{ scale: 1.02, zIndex: 10 }}
      className="flex-shrink-0 w-[300px] md:w-[340px]"
    >
      <div className="relative rounded-2xl overflow-hidden bg-card border border-border/60 shadow-xl h-full flex flex-col"
        style={{ background: 'hsl(var(--card))' }}>

        {/* ── TOP SECTION: Icon + LIVE DEMO badge + Rank ── */}
        <div className="relative flex items-start justify-between p-4 pb-2">
          {/* Icon box */}
          <div className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center text-2xl shadow-lg',
            catStyle.bg
          )}>
            <span>{catStyle.dot}</span>
          </div>

          {/* LIVE DEMO badge (center-ish) */}
          {!isPipeline && (
            <div className="absolute left-1/2 -translate-x-1/2 top-4">
              <span className="flex items-center gap-1 bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg shadow-green-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse inline-block" />
                LIVE DEMO
              </span>
            </div>
          )}
          {isPipeline && (
            <div className="absolute left-1/2 -translate-x-1/2 top-4">
              <span className="flex items-center gap-1 bg-warning/90 text-black text-[10px] font-black px-3 py-1 rounded-full shadow-lg">
                ON PIPELINE
              </span>
            </div>
          )}

          {/* Rank number */}
          <div className="text-right">
            {rank && (
              <span className="text-muted-foreground text-xs font-bold">#{rank}</span>
            )}
            {!rank && (
              <span className="text-muted-foreground text-xs font-bold">#{index + 1}</span>
            )}
          </div>
        </div>

        {/* ── PRODUCT INFO ── */}
        <div className="px-4 pb-1">
          <h3 className="font-black text-sm text-foreground uppercase leading-tight mb-0.5">
            {product.title}
          </h3>
          <p className={cn('text-[11px] font-semibold flex items-center gap-1', catStyle.text)}>
            <span>📍</span> {product.category}
            {product.subtitle && <span className="text-muted-foreground font-normal ml-1">— {product.subtitle.slice(0, 30)}{product.subtitle.length > 30 ? '…' : ''}</span>}
          </p>
        </div>

        {/* Description */}
        <div className="px-4 pb-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
            {(product as any).description || product.subtitle || 'Complete solution with all features, reports, and integrations...'}
          </p>
        </div>

        {/* ── FEATURES / TECH STACK TABS ── */}
        <div className="px-4 pb-2 flex-1">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setActiveTab('features')}
              className={cn(
                'text-[10px] font-bold px-3 py-1 rounded-full border transition-all',
                activeTab === 'features'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              )}
            >
              Features
            </button>
            <button
              onClick={() => setActiveTab('tech')}
              className={cn(
                'text-[10px] font-bold px-3 py-1 rounded-full border transition-all',
                activeTab === 'tech'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              )}
            >
              Tech Stack
            </button>
          </div>

          {/* Feature chips */}
          {activeTab === 'features' && (
            <div className="flex flex-wrap gap-1.5 min-h-[48px]">
              {features.length > 0 ? features.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-muted/40 border border-border/60 text-foreground px-2 py-0.5 rounded-md">
                  <Box className="h-2.5 w-2.5 text-muted-foreground" />
                  {f}
                </span>
              )) : (
                ['Dashboard', 'Reports', 'Analytics', 'API'].map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-muted/40 border border-border/60 text-foreground px-2 py-0.5 rounded-md">
                    <Box className="h-2.5 w-2.5 text-muted-foreground" />
                    {f}
                  </span>
                ))
              )}
            </div>
          )}

          {/* Tech stack chips */}
          {activeTab === 'tech' && (
            <div className="flex flex-wrap gap-1.5 min-h-[48px]">
              {techStack.map((t, i) => (
                <span key={i} className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-md border',
                  i === 0 ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  i === 1 ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  i === 2 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                  'bg-muted/40 text-muted-foreground border-border/60'
                )}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── PRICE ── */}
        <div className="px-4 py-2 flex items-center gap-2">
          <span className="text-xs line-through text-muted-foreground">$0</span>
          <span className="text-2xl font-black text-primary">$5</span>
          <span className="text-xs line-through text-muted-foreground ml-1 hidden">$49</span>
          <Badge className="bg-destructive/20 text-destructive border border-destructive/30 text-[9px] font-black">90% OFF</Badge>
          <div className="ml-auto flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-warning text-warning" />
            <span className="text-[10px] font-bold text-warning">4.9</span>
          </div>
        </div>

        {/* ── BUTTONS ── */}
        <div className="px-4 pb-4">
          {isPipeline ? (
            /* Pipeline state: NOTIFY ME + heart + disabled BUY */
            <div className="flex gap-2">
              <Button
                size="sm"
                className={cn(
                  'flex-1 h-9 text-[11px] font-bold gap-1 rounded-xl',
                  notified
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-warning text-black hover:bg-warning/90'
                )}
                onClick={handleNotifyMe}
              >
                <Bell className="h-3.5 w-3.5" />
                {notified ? 'NOTIFIED' : 'NOTIFY ME'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  'h-9 w-10 p-0 rounded-xl border-pink-400/40',
                  wishlisted ? 'bg-pink-500/20 text-pink-400 border-pink-400/60' : 'text-muted-foreground hover:text-pink-400 hover:border-pink-400/40'
                )}
                onClick={handleWishlist}
                title="Add to Cart"
              >
                <Heart className={cn('h-4 w-4', wishlisted && 'fill-pink-400 text-pink-400')} />
              </Button>
              <Button size="sm" disabled className="flex-1 h-9 text-[11px] font-bold rounded-xl opacity-40 gap-1">
                <ShoppingCart className="h-3.5 w-3.5" />
                BUY $5
              </Button>
            </div>
          ) : (
            /* Available: DEMO + heart(cart) + BUY $5 */
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-9 text-[11px] font-bold gap-1 rounded-xl border-border hover:border-primary/50 hover:text-primary"
                onClick={handleDemo}
              >
                <Play className="h-3.5 w-3.5" />
                DEMO
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  'h-9 w-10 p-0 rounded-xl',
                  wishlisted ? 'bg-pink-500/20 text-pink-400 border-pink-400/60' : 'border-border text-muted-foreground hover:text-pink-400 hover:border-pink-400/40'
                )}
                onClick={handleWishlist}
                title="Add to Cart"
              >
                <Heart className={cn('h-4 w-4', wishlisted && 'fill-pink-400 text-pink-400')} />
              </Button>
              <Button
                size="sm"
                className="flex-1 h-9 text-[11px] font-black gap-1 rounded-xl bg-primary hover:bg-primary/90"
                onClick={() => onBuyNow(product)}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                BUY $5
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── COMING SOON PLACEHOLDER CARD ─── */
export function ComingSoonCard({ label }: { label: string }) {
  return (
    <div className="flex-shrink-0 w-[300px] md:w-[340px]">
      <div className="rounded-2xl border border-dashed border-border bg-card/50 h-full min-h-[380px] flex flex-col items-center justify-center p-6 gap-3 text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
          <Package className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Coming Soon</p>
          <p className="text-xs text-muted-foreground mt-1">{label} products launching soon</p>
        </div>
        <Badge variant="outline" className="text-[9px]">ON PIPELINE</Badge>
      </div>
    </div>
  );
}
