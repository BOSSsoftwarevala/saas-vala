import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface HeroSlide {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  offerText?: string;
  couponCode?: string;
}

interface TickerItem {
  id: string;
  text: string;
}

const fallbackSlides: HeroSlide[] = [
  { id: 'fallback-1', image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=400&fit=crop', title: '🔥 ALL SOFTWARE — ONLY $5', subtitle: '2000+ products with source code.', badge: 'MEGA SALE', badgeColor: 'from-red-500 to-orange-500' },
];

const fallbackTickers: TickerItem[] = [
  { id: 'ft-1', text: '🔥 ALL SOFTWARE $5 ONLY' },
  { id: 'ft-2', text: '⚡ 2000+ Software Products' },
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

export function HeroBannerSlider({ autoPlayInterval = 4000 }: { autoPlayInterval?: number }) {
  const [slides, setSlides] = useState<HeroSlide[]>(fallbackSlides);
  const [tickerItems, setTickerItems] = useState<TickerItem[]>(fallbackTickers);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch banners, tickers, and festival offers in parallel
      const [bannersRes, tickersRes, festivalRes, location] = await Promise.all([
        supabase.from('marketplace_banners').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('marketplace_tickers').select('*').eq('is_active', true).order('sort_order'),
        (supabase as any).from('festival_offers').select('*').eq('is_active', true),
        getUserCountry(),
      ]);

      // Process banners
      if (bannersRes.data && bannersRes.data.length > 0) {
        const now = new Date();
        const valid = bannersRes.data.filter((b: any) => {
          if (b.start_date && new Date(b.start_date) > now) return false;
          if (b.end_date && new Date(b.end_date) < now) return false;
          return true;
        });
        if (valid.length > 0) {
          setSlides(valid.map((b: any) => ({
            id: b.id,
            image: b.image_url || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=400&fit=crop',
            title: b.title,
            subtitle: b.subtitle || '',
            badge: b.badge || undefined,
            badgeColor: b.badge_color || 'from-blue-500 to-indigo-500',
            offerText: b.offer_text || undefined,
            couponCode: b.coupon_code || undefined,
          })));
        }
      }

      // Process tickers — merge with festival offers
      const baseTickers: TickerItem[] = [];
      if (tickersRes.data && tickersRes.data.length > 0) {
        tickersRes.data.forEach((t: any) => baseTickers.push({ id: t.id, text: t.text }));
      }

      // Process festival offers — filter by location & date
      if (festivalRes.data && festivalRes.data.length > 0) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const activeOffers = (festivalRes.data as any[]).filter((f) => {
          // Date check
          if (f.start_date > todayStr || f.end_date < todayStr) return false;
          // Location check
          if (f.country_code === 'ALL') return true;
          if (f.country_code !== location.country) return false;
          // State/region check if specified
          if (f.state_region && !location.region.toLowerCase().includes(f.state_region.toLowerCase())) return false;
          return true;
        });

        // Add festival offers to ticker
        activeOffers.forEach((f) => {
          baseTickers.push({ id: `fest-${f.id}`, text: f.offer_text });
        });

        // Add festival banners to slides
        const festivalSlides: HeroSlide[] = activeOffers
          .filter((f) => f.banner_image_url)
          .map((f) => ({
            id: `fest-slide-${f.id}`,
            image: f.banner_image_url,
            title: f.festival_name,
            subtitle: f.description || '',
            badge: f.badge_text || undefined,
            badgeColor: f.badge_color || 'from-amber-500 to-orange-500',
            offerText: f.offer_text || undefined,
            couponCode: f.coupon_code || undefined,
          }));
        
        if (festivalSlides.length > 0) {
          setSlides(prev => [...festivalSlides, ...prev]);
        }
      }

      if (baseTickers.length > 0) setTickerItems(baseTickers);
    };
    fetchData();
  }, []);

  const next = useCallback(() => setCurrent(p => (p + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setCurrent(p => (p - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const t = setInterval(next, autoPlayInterval);
    return () => clearInterval(t);
  }, [paused, next, autoPlayInterval, slides.length]);

  const slide = slides[current] || slides[0];
  if (!slide) return null;

  return (
    <div className="mb-4">
      {/* Offer Ticker */}
      <div className="overflow-hidden" style={{ background: 'linear-gradient(90deg, #dc2626, #ea580c, #d97706)', height: 32 }}>
        <div className="flex items-center h-full animate-marquee whitespace-nowrap" style={{ width: 'max-content' }}>
          {[...tickerItems, ...tickerItems].map((t, i) => (
            <span key={`${t.id}-${i}`} className="text-white text-[11px] font-bold mx-6">{t.text}</span>
          ))}
        </div>
      </div>

      {/* Banner */}
      <div
        className="relative overflow-hidden mx-2 sm:mx-4 md:mx-6 mt-2 rounded-xl group"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="relative h-[160px] sm:h-[220px] md:h-[300px] w-full">
          {slides.map((s, i) => (
            <div key={s.id} className={cn('absolute inset-0 transition-opacity duration-500', i === current ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
              <img src={s.image} alt={s.title} className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
            </div>
          ))}

          <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 md:p-8 z-10">
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
          </div>
        </div>

        {slides.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
              {slides.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)} className={cn('h-1.5 rounded-full transition-all', i === current ? 'w-6 bg-white' : 'w-1.5 bg-white/40')} aria-label={`Slide ${i + 1}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
