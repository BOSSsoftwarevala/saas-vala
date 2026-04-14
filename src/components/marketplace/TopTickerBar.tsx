import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface TickerMessage {
  id: string;
  message_type: string;
  message: string;
  emoji?: string;
  is_active: boolean;
  sort_order: number;
}

interface TickerSettings {
  ticker_enabled: boolean;
  ticker_speed: number;
  ticker_color_theme: string;
}

const colorThemes = {
  orange: 'from-orange-500 to-red-500',
  blue: 'from-blue-500 to-purple-500',
  purple: 'from-purple-500 to-pink-500',
  green: 'from-green-500 to-teal-500',
};

export function TopTickerBar() {
  const [messages, setMessages] = useState<TickerMessage[]>([]);
  const [settings, setSettings] = useState<TickerSettings | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTheme, setCurrentTheme] = useState('orange');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTickerData();
  }, []);

  useEffect(() => {
    if (!settings || !settings.ticker_enabled || messages.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, settings.ticker_speed * 1000);

    const themeInterval = setInterval(() => {
      const themes = Object.keys(colorThemes);
      const currentIndex = themes.indexOf(currentTheme);
      const nextIndex = (currentIndex + 1) % themes.length;
      setCurrentTheme(themes[nextIndex]);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(themeInterval);
    };
  }, [settings, messages, currentTheme]);

  const fetchTickerData = async () => {
    const [messagesRes, settingsRes] = await Promise.all([
      supabase
        .from('marketplace_ticker_messages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('marketplace_banner_settings')
        .select('*')
        .single(),
    ]);

    if (messagesRes.data) {
      setMessages(messagesRes.data);
    }
    if (settingsRes.data) {
      setSettings(settingsRes.data);
      setCurrentTheme(settingsRes.data.ticker_color_theme || 'orange');
    }
  };

  if (!settings || !settings.ticker_enabled || messages.length === 0) {
    return null;
  }

  const currentMessage = messages[currentIndex];
  const gradientClass = colorThemes[currentTheme as keyof typeof colorThemes];

  return (
    <div className="w-full overflow-hidden">
      <motion.div
        ref={containerRef}
        className={`bg-gradient-to-r ${gradientClass} text-white py-2 px-4`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMessage.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2"
            >
              {currentMessage.emoji && (
                <span className="text-xl">{currentMessage.emoji}</span>
              )}
              <span className="text-sm font-semibold">
                {currentMessage.message}
              </span>
              <span className="text-xs px-2 py-1 bg-white/20 rounded-full">
                {currentMessage.message_type.toUpperCase()}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
