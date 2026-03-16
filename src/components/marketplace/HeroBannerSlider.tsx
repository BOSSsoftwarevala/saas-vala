import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeroSlide {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
}

const defaultSlides: HeroSlide[] = [
  {
    id: 'mega-sale',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=400&fit=crop',
    title: '🔥 ALL SOFTWARE — ONLY $5',
    subtitle: 'Full source code, APK, license key & 30-day access. 2000+ products.',
    badge: 'MEGA SALE', badgeColor: 'from-red-500 to-orange-500',
  },
  {
    id: 'healthcare',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&h=400&fit=crop',
    title: '🏥 Healthcare Software Suite',
    subtitle: 'Hospital ERP, Clinic Manager, Lab System, Telemedicine — deploy instantly.',
    badge: 'NEW LAUNCH', badgeColor: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'education',
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&h=400&fit=crop',
    title: '📚 Education & E-Learning',
    subtitle: 'School ERP, LMS, Coaching — Google Classroom & Moodle clones included.',
    badge: 'TOP RATED', badgeColor: 'from-blue-500 to-indigo-500',
  },
  {
    id: 'realestate',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=400&fit=crop',
    title: '🏠 Real Estate & Property CRM',
    subtitle: 'Broker suite, rental management, listing portal — white-label ready.',
    badge: 'HOT', badgeColor: 'from-purple-500 to-pink-500',
  },
  {
    id: 'festival',
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&h=400&fit=crop',
    title: '🎉 Festival Offer — Extra 20% OFF',
    subtitle: 'Limited time — buy 3 software, get 1 FREE. Code: FESTIVAL2026',
    badge: 'LIMITED', badgeColor: 'from-amber-500 to-yellow-500',
  },
  {
    id: 'diwali',
    image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=400&fit=crop',
    title: '🪔 Diwali Dhamaka Sale — India Special',
    subtitle: 'India ke liye special price — ₹99 mein koi bhi software. Limited offer!',
    badge: '🇮🇳 INDIA', badgeColor: 'from-orange-500 to-green-500',
  },
  {
    id: 'eid',
    image: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1200&h=400&fit=crop',
    title: '🌙 Eid Special — Middle East Offer',
    subtitle: 'Arabic RTL software ready. POS, Hospital, School — all localized.',
    badge: 'EID SALE', badgeColor: 'from-emerald-600 to-teal-600',
  },
];

const offerTicker = [
  '🔥 ALL SOFTWARE $5 ONLY',
  '🏥 Healthcare Suite LIVE',
  '📚 Education 50+ Products',
  '🎉 Festival: Buy 3 Get 1 FREE',
  '🪔 India Special ₹99',
  '🌙 Eid Sale — Arabic RTL Ready',
  '🚗 Transport & Logistics NEW',
  '💰 Finance & Banking HOT',
  '🛒 Retail POS BESTSELLER',
  '⚡ 2000+ Software Products',
];

interface HeroBannerSliderProps {
  slides?: HeroSlide[];
  autoPlayInterval?: number;
}

export function HeroBannerSlider({ slides = defaultSlides, autoPlayInterval = 4000 }: HeroBannerSliderProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setCurrent(p => (p + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setCurrent(p => (p - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(next, autoPlayInterval);
    return () => clearInterval(t);
  }, [paused, next, autoPlayInterval]);

  const slide = slides[current];

  return (
    <div className="mb-4">
      {/* Offer Ticker */}
      <div className="overflow-hidden" style={{ background: 'linear-gradient(90deg, #dc2626, #ea580c, #d97706)', height: 32 }}>
        <div className="flex items-center h-full animate-marquee whitespace-nowrap">
          {[...offerTicker, ...offerTicker].map((t, i) => (
            <span key={i} className="text-white text-[11px] font-bold mx-6">{t}</span>
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
              <span className={cn('inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase text-white mb-2 bg-gradient-to-r', slide.badgeColor || 'from-primary to-blue-600')}>
                {slide.badge}
              </span>
            )}
            <h2 className="text-lg sm:text-xl md:text-3xl font-black text-white mb-1 max-w-xl" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
              {slide.title}
            </h2>
            <p className="text-xs sm:text-sm text-white/80 max-w-md" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              {slide.subtitle}
            </p>
          </div>
        </div>

        {/* Arrows */}
        <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className={cn('h-1.5 rounded-full transition-all', i === current ? 'w-6 bg-white' : 'w-1.5 bg-white/40')} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
