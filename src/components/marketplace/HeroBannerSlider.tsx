import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Zap, Users, Briefcase, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface HeroSlide {
  id: string;
  type: 'banner' | 'product' | 'reseller' | 'influencer' | 'franchise';
  image: string;
  title: string;
  subtitle: string;
  linkedCategory?: string;
  badge?: string;
  badgeColor?: string;
  offerText?: string;
  couponCode?: string;
  gradient?: string;
  productId?: string;
  ctaText?: string;
  ctaLink?: string;
}

interface TickerItem {
  id: string;
  text: string;
  link?: string;
}

// Dynamic color gradients
const gradientPool = [
  'from-blue-600/30 to-purple-600/30',
  'from-orange-500/30 to-red-600/30',
  'from-emerald-500/30 to-cyan-600/30',
  'from-pink-500/30 to-violet-600/30',
  'from-yellow-500/30 to-orange-600/30',
  'from-indigo-500/30 to-blue-600/30',
  'from-rose-500/30 to-pink-600/30',
  'from-teal-500/30 to-emerald-600/30',
];

const fallbackSlides: HeroSlide[] = [
  { id: 'fallback-1', type: 'banner', image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=400&fit=crop', title: 'Healthcare Software Sale', subtitle: 'Discover hospital, clinic & pharmacy products.', linkedCategory: 'Health Care', badge: 'MEGA SALE', badgeColor: 'from-red-500 to-orange-500', gradient: gradientPool[0] },
  { id: 'fallback-2', type: 'banner', image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=400&fit=crop', title: 'Finance & Banking Tools', subtitle: 'Banking portals, loan apps and payment workflows.', linkedCategory: 'Finance', badge: 'HOT DEAL', badgeColor: 'from-emerald-500 to-teal-500', gradient: gradientPool[1] },
  { id: 'fallback-3', type: 'banner', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=400&fit=crop', title: 'Transport & Logistics Suite', subtitle: 'Fleet, delivery and route management solutions.', linkedCategory: 'Transport', badge: 'NEW', badgeColor: 'from-sky-500 to-indigo-500', gradient: gradientPool[2] },
];

// CTA Slides
const ctaSlides: HeroSlide[] = [
  {
    id: 'cta-reseller',
    type: 'reseller',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=400&fit=crop',
    title: 'Become a Reseller',
    subtitle: 'Start your software business with zero investment. Earn up to 50% commission on every sale.',
    badge: 'EARN MONEY',
    badgeColor: 'from-green-500 to-emerald-500',
    gradient: gradientPool[3],
    ctaText: 'Join Now',
    ctaLink: '/resellers',
  },
  {
    id: 'cta-influencer',
    type: 'influencer',
    image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&h=400&fit=crop',
    title: 'Earn with Influencer Program',
    subtitle: 'Promote our products and earn commissions. Perfect for content creators and social media influencers.',
    badge: 'PARTNER WITH US',
    badgeColor: 'from-purple-500 to-pink-500',
    gradient: gradientPool[4],
    ctaText: 'Start Earning',
    ctaLink: '/influencer',
  },
  {
    id: 'cta-franchise',
    type: 'franchise',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=400&fit=crop',
    title: 'Open Your Software Business',
    subtitle: 'Get complete software marketplace franchise. Full support, training, and branding included.',
    badge: 'FRANCHISE AVAILABLE',
    badgeColor: 'from-orange-500 to-red-500',
    gradient: gradientPool[5],
    ctaText: 'Apply Now',
    ctaLink: '/franchise',
  },
];

const fallbackTickers: TickerItem[] = [
  { id: 'ft-1', text: '🔥 ALL SOFTWARE $5 ONLY' },
  { id: 'ft-2', text: '⚡ 2000+ Software Products' },
  { id: 'ft-3', text: '💰 Become Reseller & Earn' },
  { id: 'ft-4', text: '🎯 Franchise Available Now' },
  { id: 'ft-5', text: '🚀 New Products Added Daily' },
];

async function getUserCountry(): Promise<{ country: string; region: string }> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('fail');
    const data = await res.json();
    return { country: data.country_code || 'ALL', region: data.region || '' };
  } catch {
    return { country: 'ALL', region: '' };
  }
}

export function HeroBannerSlider({ autoPlayInterval = 4000, onBannerClick, slides: slidesProp }: { autoPlayInterval?: number; onBannerClick?: (linkedCategory?: string) => void; slides?: HeroSlide[] }) {
  const [slides, setSlides] = useState<HeroSlide[]>(slidesProp && slidesProp.length > 0 ? slidesProp : fallbackSlides);
  const [tickerItems, setTickerItems] = useState<TickerItem[]>(fallbackTickers);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slidesProp && slidesProp.length > 0) {
      setSlides(slidesProp);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch banners, tickers, festival offers, and featured products in parallel
        const [bannersRes, tickersRes, festivalRes, location, productsRes] = await Promise.all([
          supabase.from('marketplace_banners').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('marketplace_tickers').select('*').eq('is_active', true).order('sort_order'),
          (supabase as any).from('festival_offers').select('*').eq('is_active', true),
          getUserCountry(),
          supabase.from('products').select('*').eq('marketplace_visible', true).eq('featured', true).limit(5),
        ]);

        const allSlides: HeroSlide[] = [];
        const baseTickers: TickerItem[] = [];

        // Process banners
        if (bannersRes.data && bannersRes.data.length > 0) {
          const now = new Date();
          const valid = bannersRes.data.filter((b: any) => {
            if (b.start_date && new Date(b.start_date) > now) return false;
            if (b.end_date && new Date(b.end_date) < now) return false;
            return true;
          });
          valid.forEach((b: any, idx) => {
            allSlides.push({
              id: b.id,
              type: 'banner',
              image: b.image_url || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=400&fit=crop',
              title: b.title,
              subtitle: b.subtitle || '',
              linkedCategory: b.link_url || undefined,
              badge: b.badge || undefined,
              badgeColor: b.badge_color || 'from-blue-500 to-indigo-500',
              offerText: b.offer_text || undefined,
              couponCode: b.coupon_code || undefined,
              gradient: gradientPool[idx % gradientPool.length],
            });
          });
        }

        // Process featured products
        if (productsRes.data && productsRes.data.length > 0) {
          productsRes.data.forEach((p: any, idx) => {
            allSlides.push({
              id: `product-${p.id}`,
              type: 'product',
              image: p.thumbnail_url || p.og_image || 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=400&fit=crop',
              title: p.name,
              subtitle: p.short_description || p.description?.substring(0, 100) + '...' || 'Amazing software product',
              linkedCategory: p.category_id || undefined,
              badge: 'FEATURED',
              badgeColor: 'from-violet-500 to-purple-500',
              gradient: gradientPool[(idx + 3) % gradientPool.length],
              productId: p.id,
              ctaText: 'View Details',
              ctaLink: `/product/${p.slug}`,
            });
          });
        }

        // Add CTA slides
        ctaSlides.forEach((slide, idx) => {
          allSlides.push({
            ...slide,
            gradient: gradientPool[(idx + 6) % gradientPool.length],
          });
        });

        // Add fallback if no slides
        if (allSlides.length === 0) {
          allSlides.push(...fallbackSlides);
        }

        setSlides(allSlides);

        // Process tickers
        if (tickersRes.data && tickersRes.data.length > 0) {
          tickersRes.data.forEach((t: any) => baseTickers.push({ id: t.id, text: t.text }));
        }

        // Process festival offers
        if (festivalRes.data && festivalRes.data.length > 0) {
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          
          const activeOffers = (festivalRes.data as any[]).filter((f) => {
            if (f.start_date > todayStr || f.end_date < todayStr) return false;
            if (f.country_code === 'ALL') return true;
            if (f.country_code !== location.country) return false;
            if (f.state_region && !location.region.toLowerCase().includes(f.state_region.toLowerCase())) return false;
            return true;
          });

          activeOffers.forEach((f) => {
            baseTickers.push({ id: `fest-${f.id}`, text: f.offer_text });
          });

          const festivalSlides: HeroSlide[] = activeOffers
            .filter((f) => f.banner_image_url)
            .map((f, idx) => ({
              id: `fest-slide-${f.id}`,
              type: 'banner',
              image: f.banner_image_url,
              title: f.festival_name,
              subtitle: f.description || '',
              linkedCategory: f.link_url || undefined,
              badge: f.badge_text || undefined,
              badgeColor: f.badge_color || 'from-amber-500 to-orange-500',
              offerText: f.offer_text || undefined,
              couponCode: f.coupon_code || undefined,
              gradient: gradientPool[idx % gradientPool.length],
            }));
          
          if (festivalSlides.length > 0) {
            setSlides(prev => [...festivalSlides, ...prev]);
          }
        }

        if (baseTickers.length > 0) {
          setTickerItems(baseTickers);
        }
      } catch (error) {
        console.error('Error fetching slider data:', error);
        setSlides(fallbackSlides);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slidesProp]);

  const next = useCallback(() => setCurrent(p => (p + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setCurrent(p => (p - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const t = setInterval(next, autoPlayInterval);
    return () => clearInterval(t);
  }, [paused, next, autoPlayInterval, slides.length]);

  const slide = slides[current] || slides[0];
  if (!slide) return null;

  // Get icon based on slide type
  const getSlideIcon = () => {
    switch (slide.type) {
      case 'reseller':
        return <Briefcase className="h-6 w-6" />;
      case 'influencer':
        return <Users className="h-6 w-6" />;
      case 'franchise':
        return <TrendingUp className="h-6 w-6" />;
      case 'product':
        return <Zap className="h-6 w-6" />;
      default:
        return null;
    }
  };

  return (
    <div className="mb-4">
      {/* Offer Ticker - Running Marquee */}
      <div className="overflow-hidden" style={{ background: 'linear-gradient(90deg, #dc2626, #ea580c, #d97706)', height: 32 }}>
        <div className="flex items-center h-full animate-marquee whitespace-nowrap" style={{ width: 'max-content', animationDuration: '30s' }}>
          {[...tickerItems, ...tickerItems, ...tickerItems].map((t, i) => (
            <span 
              key={`${t.id}-${i}`} 
              className="text-white text-[11px] font-bold mx-6 cursor-pointer hover:text-yellow-200 transition-colors"
              onClick={() => t.link && window.open(t.link, '_blank')}
            >
              {t.text}
            </span>
          ))}
        </div>
      </div>

      {/* Banner */}
      <div
        className="relative overflow-hidden mx-2 sm:mx-4 md:mx-6 mt-2 rounded-xl group cursor-pointer"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Progress Bar */}
        {slides.length > 1 && !paused && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-30">
            <div 
              className="h-full bg-white transition-all duration-100 ease-linear"
              style={{ width: '0%', animation: `progress ${autoPlayInterval}ms linear forwards` }}
            />
          </div>
        )}

        <div className="relative h-[160px] sm:h-[220px] md:h-[300px] w-full">
          {slides.map((s, i) => (
            <div
              key={s.id}
              className={cn('absolute inset-0 transition-opacity duration-700 ease-in-out', i === current ? 'opacity-100' : 'opacity-0 pointer-events-none')}
              onClick={() => {
                if (s.ctaLink) {
                  window.location.href = s.ctaLink;
                } else {
                  onBannerClick?.(s.linkedCategory);
                }
              }}
            >
              <img 
                src={s.image} 
                alt={s.title} 
                className="w-full h-full object-cover" 
                loading={i === current || i === current + 1 ? 'eager' : 'lazy'}
                decoding="async"
              />
              {/* Dynamic Gradient Overlay */}
              <div className={cn('absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent', s.gradient)} />
            </div>
          ))}

          {/* Loading Skeleton */}
          {loading && (
            <div className="absolute inset-0 bg-muted animate-pulse" />
          )}

          <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 md:p-8 z-10">
            {/* Icon for CTA slides */}
            {slide.type !== 'banner' && slide.type !== 'product' && (
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-full bg-white/20 backdrop-blur-sm">
                  {getSlideIcon()}
                </div>
              </div>
            )}
            
            {slide.badge && (
              <span className={cn('inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase text-white mb-2 bg-gradient-to-r', slide.badgeColor)}>
                {slide.badge}
              </span>
            )}
            <h2 className="text-lg sm:text-xl md:text-3xl font-black text-white mb-1 max-w-xl" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
              {slide.title}
            </h2>
            <p className="text-xs sm:text-sm text-white/80 max-w-md" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              {slide.subtitle}
            </p>
            {slide.couponCode && (
              <span className="inline-flex w-fit items-center mt-2 px-3 py-1 rounded-lg text-[10px] font-black text-white bg-white/20 backdrop-blur-sm border border-white/10">
                🎟️ CODE: {slide.couponCode}
              </span>
            )}
            {slide.ctaText && (
              <button 
                className="mt-3 px-4 py-2 bg-white text-black font-bold text-xs rounded-lg hover:bg-white/90 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (slide.ctaLink) window.location.href = slide.ctaLink;
                }}
              >
                {slide.ctaText}
              </button>
            )}
          </div>
        </div>

        {slides.length > 1 && !loading && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); prev(); }} 
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60" 
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); next(); }} 
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60" 
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
              {slides.map((_, i) => (
                <button 
                  key={i} 
                  onClick={(e) => { e.stopPropagation(); setCurrent(i); }} 
                  className={cn('h-1.5 rounded-full transition-all duration-300', i === current ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60')} 
                  aria-label={`Slide ${i + 1}`} 
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add CSS for progress animation */}
      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
