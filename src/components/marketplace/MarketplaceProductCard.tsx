import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart, Zap, Plus, Bell, Heart, Star,
  Package
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
}

const stockImages = [
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop',
];

export function MarketplaceProductCard({
  product,
  index = 0,
  onBuyNow,
  onAddProduct,
  accentColor = 'text-primary',
  borderColor = 'border-border',
  iconColor = 'text-primary',
}: MarketplaceProductCardProps) {
  const [wishlisted, setWishlisted] = useState(false);
  const [notified, setNotified] = useState(false);
  const { user } = useAuth();

  const imgSrc = product.image && product.image.startsWith('http')
    ? product.image
    : stockImages[index % stockImages.length];

  const isNew = product.status === 'live' || product.status === 'bestseller';
  const isPipeline = !product.isAvailable || product.status === 'draft' || product.status === 'upcoming';

  const handleWishlist = async () => {
    if (!user) {
      toast.error('Sign in to save to wishlist');
      return;
    }
    try {
      if (wishlisted) {
        await supabase.from('product_wishlists').delete()
          .eq('user_id', user.id).eq('product_id', product.id);
        setWishlisted(false);
        toast('Removed from wishlist');
      } else {
        await supabase.from('product_wishlists').insert({
          user_id: user.id,
          product_id: product.id,
          product_name: product.title,
        });
        setWishlisted(true);
        toast.success(`❤️ ${product.title} saved to wishlist`);
      }
    } catch {
      toast.error('Failed to update wishlist');
    }
  };

  const handleNotifyMe = async () => {
    if (!user) {
      toast.error('Sign in to get notified');
      return;
    }
    try {
      await supabase.from('product_notify_me').insert({
        user_id: user.id,
        email: user.email || '',
        product_id: product.id,
        product_name: product.title,
      });
      setNotified(true);
      toast.success(`🔔 You'll be notified when ${product.title} is ready!`);
    } catch {
      // Already registered or duplicate - still mark as done
      setNotified(true);
      toast.success(`🔔 You're on the notification list!`);
    }
  };

  const handleDemo = () => {
    if (product.demoUrl) {
      window.open(product.demoUrl, '_blank', 'noopener,noreferrer');
    } else {
      toast.info('Demo not available yet');
    }
  };

  const handleAddProduct = () => {
    if (onAddProduct) {
      onAddProduct(product);
    } else {
      toast.info('Product added to your list');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 260, damping: 24 }}
      whileHover={{ scale: 1.02, zIndex: 10 }}
      className="flex-shrink-0 w-[280px] md:w-[300px]"
    >
      <div className={cn(
        'relative rounded-xl overflow-hidden bg-card border shadow-lg h-full flex flex-col',
        borderColor
      )}>
        {/* Thumbnail */}
        <div className="relative h-[108px] overflow-hidden">
          <img
            src={imgSrc}
            alt={product.title}
            className="w-full h-full object-cover opacity-60"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = stockImages[index % stockImages.length];
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />

          {/* Status badge */}
          <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
            {isPipeline ? (
              <Badge className="bg-warning/20 text-warning border border-warning/30 text-[9px] font-black">
                ON PIPELINE
              </Badge>
            ) : product.trending ? (
              <Badge className="bg-destructive/20 text-destructive border border-destructive/30 text-[9px] font-black animate-pulse">
                TRENDING
              </Badge>
            ) : product.featured ? (
              <Badge className="bg-accent/20 text-accent border border-accent/30 text-[9px] font-black">
                FEATURED
              </Badge>
            ) : (
              <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 text-[9px] font-black">
                LIVE
              </Badge>
            )}
          </div>

          {/* NEW badge */}
          {isNew && !isPipeline && (
            <Badge className="absolute top-2 right-10 bg-primary/20 text-primary border border-primary/30 text-[9px]">
              NEW
            </Badge>
          )}

          {/* Wishlist heart */}
          <button
            onClick={handleWishlist}
            className={cn(
              'absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center transition-all',
          wishlisted
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-background/80 text-muted-foreground hover:text-destructive'
            )}
          >
            <Heart className={cn('h-3 w-3', wishlisted && 'fill-current')} />
          </button>

          {/* Category pill */}
          <div className="absolute bottom-2 left-2">
            <Badge variant="outline" className={cn('text-[9px] bg-background/70', iconColor, 'border-current/30')}>
              {product.category}
            </Badge>
          </div>

          {/* Rating (fake but consistent) */}
          <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-background/70 rounded-full px-1.5 py-0.5">
            <Star className="h-2.5 w-2.5 fill-warning text-warning" />
            <span className="text-[9px] font-bold text-warning">4.8</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 flex flex-col flex-1">
          <h3 className="font-black text-xs text-foreground uppercase leading-tight mb-1 line-clamp-2">
            {product.title}
          </h3>
          <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2 leading-relaxed">
            {product.subtitle}
          </p>

          {/* Features */}
          <div className="flex flex-wrap gap-1 mb-2">
            {product.features.slice(0, 3).map((f, i) => (
              <Badge key={i} variant="outline" className="text-[9px] bg-muted/30 border-border/60">
                {typeof f === 'string' ? f : f.text}
              </Badge>
            ))}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-xs line-through text-muted-foreground">$49</span>
            <span className={cn('text-xl font-black', accentColor)}>$5</span>
            <Badge className="bg-destructive/20 text-destructive border-0 text-[9px]">90% OFF</Badge>
          </div>

          {/* ── BUTTONS — EXACTLY 3 ── */}
          <div className="mt-auto space-y-1.5">
            {isPipeline ? (
              /* On Pipeline: Notify Me + Wishlist row */
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className={cn(
                    'flex-1 h-8 text-[10px] gap-1',
                    notified
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-warning text-warning-foreground hover:bg-warning/90'
                  )}
                  onClick={handleNotifyMe}
                >
                  <Bell className="h-3 w-3" />
                  {notified ? 'NOTIFIED' : 'NOTIFY ME'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 border-pink-400/40 text-pink-400 hover:bg-pink-500/10"
                  onClick={handleWishlist}
                >
                  <Heart className={cn('h-3.5 w-3.5', wishlisted && 'fill-current')} />
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] gap-1" onClick={handleAddProduct}>
                  <Plus className="h-3 w-3" /> ADD
                </Button>
              </div>
            ) : (
              /* Available: DEMO | BUY NOW | ADD PRODUCT */
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={handleDemo}
                  >
                    <Zap className="h-3 w-3" />
                    DEMO
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-[10px] gap-1"
                    onClick={() => onBuyNow(product)}
                  >
                    <ShoppingCart className="h-3 w-3" />
                    BUY NOW
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-[10px] gap-1 border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                  onClick={handleAddProduct}
                >
                  <Plus className="h-3 w-3" />
                  ADD PRODUCT
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── COMING SOON PLACEHOLDER CARD ─── */
export function ComingSoonCard({ label }: { label: string }) {
  return (
    <div className="flex-shrink-0 w-[280px] md:w-[300px]">
      <div className="rounded-xl border border-dashed border-border bg-card/50 h-full min-h-[320px] flex flex-col items-center justify-center p-6 gap-3 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Package className="h-6 w-6 text-muted-foreground" />
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
