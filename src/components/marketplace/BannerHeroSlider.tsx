import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowRight, ShoppingCart, Play, TrendingUp } from 'lucide-react';

interface BannerSlide {
  id: string;
  slide_type: string;
  product_id?: string;
  title?: string;
  description?: string;
  cta_text?: string;
  cta_link?: string;
  background_gradient?: string;
  is_active: boolean;
  sort_order: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  thumbnail_url?: string;
  rating?: number;
}

interface BannerSettings {
  banner_enabled: boolean;
  banner_speed: number;
  banner_auto_rotate: boolean;
}

const gradientPresets = [
  'from-blue-600 to-purple-600',
  'from-orange-500 to-red-500',
  'from-green-500 to-teal-500',
  'from-purple-500 to-pink-500',
  'from-indigo-600 to-blue-600',
  'from-rose-500 to-orange-500',
];

export function BannerHeroSlider() {
  const [slides, setSlides] = useState<BannerSlide[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<BannerSettings | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentGradient, setCurrentGradient] = useState(gradientPresets[0]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBannerData();
  }, []);

  useEffect(() => {
    if (!settings || !settings.banner_enabled || !settings.banner_auto_rotate || slides.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
      setCurrentGradient(gradientPresets[Math.floor(Math.random() * gradientPresets.length)]);
    }, settings.banner_speed * 1000);

    return () => clearInterval(interval);
  }, [settings, slides]);

  const fetchBannerData = async () => {
    setIsLoading(true);
    try {
      const [slidesRes, settingsRes, productsRes] = await Promise.all([
        supabase
          .from('marketplace_banner_slides')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('marketplace_banner_settings')
          .select('*')
          .single(),
        supabase
          .from('marketplace_products')
          .select('id, name, slug, price, thumbnail_url, rating')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (slidesRes.data) {
        setSlides(slidesRes.data);
      }
      if (settingsRes.data) {
        setSettings(settingsRes.data);
      }
      if (productsRes.data) {
        setProducts(productsRes.data);
      }
    } catch (error) {
      console.error('Error fetching banner data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
    setCurrentGradient(gradientPresets[Math.floor(Math.random() * gradientPresets.length)]);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    setCurrentGradient(gradientPresets[Math.floor(Math.random() * gradientPresets.length)]);
  };

  const renderSlideContent = (slide: BannerSlide) => {
    switch (slide.slide_type) {
      case 'product':
        const product = products.find(p => p.id === slide.product_id);
        if (!product) return null;
        return (
          <div className="flex items-center gap-8">
            {product.thumbnail_url && (
              <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-2xl bg-white/10 backdrop-blur-sm">
                <img src={product.thumbnail_url} alt={product.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-4xl font-bold mb-4">{product.name}</h2>
              <div className="flex items-center gap-4 mb-4">
                <span className="text-3xl font-bold">₹{product.price}</span>
                {product.rating && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-5 h-5 text-yellow-400" />
                    <span className="text-lg">{product.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                <Button size="lg" className="gap-2">
                  <ShoppingCart className="w-5 h-5" /> Buy Now
                </Button>
                <Button size="lg" variant="outline" className="gap-2 bg-white/10 border-white/30 text-white hover:bg-white/20">
                  <Play className="w-5 h-5" /> View Demo
                </Button>
              </div>
            </div>
          </div>
        );

      case 'offer':
        return (
          <div className="text-center">
            <h2 className="text-6xl font-black mb-4">{slide.title || 'ALL SOFTWARE ₹5'}</h2>
            <p className="text-2xl mb-8 opacity-90">{slide.description || 'Limited time offer - Don\'t miss out!'}</p>
            <Button size="lg" className="gap-2 text-lg px-8 py-6">
              Explore Now <ArrowRight className="w-6 h-6" />
            </Button>
          </div>
        );

      case 'franchise':
        return (
          <div className="text-center">
            <h2 className="text-5xl font-bold mb-4">{slide.title || 'Start Your Software Business'}</h2>
            <p className="text-xl mb-8 opacity-90">{slide.description || 'Become a reseller with 0 investment and earn daily'}</p>
            <Button size="lg" className="gap-2 text-lg px-8 py-6">
              Apply as Reseller <ArrowRight className="w-6 h-6" />
            </Button>
          </div>
        );

      case 'category':
        return (
          <div className="text-center">
            <h2 className="text-5xl font-bold mb-4">{slide.title || 'Top ERP Systems 2026'}</h2>
            <p className="text-xl mb-8 opacity-90">{slide.description || 'Discover the best ERP solutions for your business'}</p>
            <Button size="lg" className="gap-2 text-lg px-8 py-6">
              Browse Category <ArrowRight className="w-6 h-6" />
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-96 bg-gradient-to-r from-blue-600 to-purple-600 animate-pulse" />
    );
  }

  if (!settings || !settings.banner_enabled || slides.length === 0) {
    return null;
  }

  const currentSlide = slides[currentIndex];
  const gradient = currentSlide.background_gradient ? currentSlide.background_gradient.replace(/from-[\w-]+ to-[\w-]+/, (match) => {
    // Convert database format to Tailwind format
    return match;
  }) : currentGradient;

  return (
    <div className="w-full h-96 relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide.id}
          className={`absolute inset-0 bg-gradient-to-r ${gradient} flex items-center justify-center p-8`}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5 }}
        >
          <div className="max-w-7xl mx-auto w-full">
            {renderSlideContent(currentSlide)}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      <button
        onClick={handlePrevious}
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm p-3 rounded-full transition-all"
      >
        <ArrowRight className="w-6 h-6 rotate-180" />
      </button>
      <button
        onClick={handleNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm p-3 rounded-full transition-all"
      >
        <ArrowRight className="w-6 h-6" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentIndex ? 'bg-white w-8' : 'bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
