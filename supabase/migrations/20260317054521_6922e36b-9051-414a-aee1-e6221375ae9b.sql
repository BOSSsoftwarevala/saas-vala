
-- Marketplace banners table (admin-managed hero slides)
CREATE TABLE public.marketplace_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  badge TEXT,
  badge_color TEXT DEFAULT 'from-blue-500 to-indigo-500',
  offer_text TEXT,
  coupon_code TEXT,
  link_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Marketplace coupons table
CREATE TABLE public.marketplace_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC DEFAULT 0,
  min_order NUMERIC DEFAULT 0,
  max_uses INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Marketplace offer ticker items
CREATE TABLE public.marketplace_tickers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies - admin only write, public read for banners/tickers
ALTER TABLE public.marketplace_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_tickers ENABLE ROW LEVEL SECURITY;

-- Public read for banners (marketplace is public)
CREATE POLICY "Anyone can read active banners" ON public.marketplace_banners
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage banners" ON public.marketplace_banners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Public read for tickers
CREATE POLICY "Anyone can read tickers" ON public.marketplace_tickers
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage tickers" ON public.marketplace_tickers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Coupons admin only
CREATE POLICY "Admins can manage coupons" ON public.marketplace_coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated can read active coupons" ON public.marketplace_coupons
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Add discount and rating columns to products if missing
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 4.5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS apk_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS license_enabled BOOLEAN DEFAULT true;
