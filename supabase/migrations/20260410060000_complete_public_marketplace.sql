-- Complete Public Marketplace System
-- Includes: Products, Pricing, Orders, Payments, Licenses, Ratings, Favorites, Wallet, etc.
-- Date: 2026-04-10
-- ====================================================================
-- 1) PRICING & SUBSCRIPTION PLANS
-- ====================================================================

-- Product pricing with multiple subscription duration options
CREATE TABLE IF NOT EXISTS public.product_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  duration_days INTEGER NOT NULL,  -- 30, 90, 180, 365
  base_price NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_pricing_unique UNIQUE (product_id, duration_days)
);

CREATE INDEX IF NOT EXISTS idx_product_pricing_product ON public.product_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_duration ON public.product_pricing(duration_days);

-- ====================================================================
-- 2) ORDERS & TRANSACTIONS
-- ====================================================================

-- Enhanced orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  payment_method VARCHAR(50),  -- 'wallet', 'upi', 'bank', 'wise', 'payu', 'binance'
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, completed, failed, refunded
  license_key_id UUID REFERENCES public.license_keys(id) ON DELETE SET NULL,
  subscription_duration_days INTEGER,
  order_number VARCHAR(50) UNIQUE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product ON public.orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_reseller ON public.orders(reseller_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at DESC);

-- Enhanced transactions table (extends existing)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50),  -- 'upi_gateway', 'wise', 'payu', 'binance'
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- ====================================================================
-- 3) PAYMENT INTEGRATIONS
-- ====================================================================

-- Payment gateway credentials (encrypted in production)
CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL UNIQUE,  -- 'upi', 'wise', 'payu', 'binance'
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  base_url TEXT,
  credentials JSONB DEFAULT '{}'::jsonb,  -- encrypted in practice
  webhook_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment logs for audit trail
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  request_data JSONB,
  response_data JSONB,
  status VARCHAR(50),  -- initiated, processing, succeeded, failed
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_order ON public.payment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_provider ON public.payment_logs(provider);

-- ====================================================================
-- 4. WALLET & CREDITS
-- ====================================================================

-- Enhanced wallet table (if not exists)
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);

-- Wallet transactions  
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,  -- 'credit', 'debit', 'refund'
  amount NUMERIC(12,2) NOT NULL,
  balance_before NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON public.wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order ON public.wallet_transactions(order_id);

-- ====================================================================
-- 5) RATINGS & REVIEWS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.product_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_title VARCHAR(255),
  review_text TEXT,
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  helpful_count INTEGER DEFAULT 0,
  unhelpful_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'published',  -- published, pending, rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_ratings_unique_per_user UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_ratings_product ON public.product_ratings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ratings_user ON public.product_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_product_ratings_status ON public.product_ratings(status);
CREATE INDEX IF NOT EXISTS idx_product_ratings_verified ON public.product_ratings(is_verified_purchase);

-- ====================================================================
-- 6) FAVORITES / WISHLIST
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_favorites_unique UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_product ON public.user_favorites(product_id);

-- ====================================================================
-- 7) BANNERS & MARKETING
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  linked_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  linked_category VARCHAR(100),
  position_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_banners_active ON public.marketplace_banners(is_active);
CREATE INDEX IF NOT EXISTS idx_marketplace_banners_order ON public.marketplace_banners(position_order);

-- ====================================================================
-- 8) APK DOWNLOADS & DELIVERY
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.apk_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  license_key_id UUID REFERENCES public.license_keys(id) ON DELETE SET NULL,
  download_link_token VARCHAR(255) UNIQUE,
  download_link_expires_at TIMESTAMPTZ,
  download_count INTEGER DEFAULT 0,
  max_downloads INTEGER DEFAULT 1,  -- null = unlimited
  last_downloaded_at TIMESTAMPTZ,
  is_verified BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apk_downloads_user ON public.apk_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_apk_downloads_product ON public.apk_downloads(product_id);
CREATE INDEX IF NOT EXISTS idx_apk_downloads_license_key ON public.apk_downloads(license_key_id);
CREATE INDEX IF NOT EXISTS idx_apk_downloads_token ON public.apk_downloads(download_link_token);

-- ====================================================================
-- 9) DEMO ACCESS CONTROL
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.demo_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_demo_access_logs_product ON public.demo_access_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_demo_access_logs_user ON public.demo_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_demo_access_logs_accessed ON public.demo_access_logs(accessed_at DESC);

-- ====================================================================
-- 10) RESELLER COMMISSIONS & EARNINGS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.reseller_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10,
  amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, earned, paid, disputed
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_earnings_reseller ON public.reseller_earnings(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_earnings_order ON public.reseller_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_reseller_earnings_status ON public.reseller_earnings(status);

-- ====================================================================
-- 11) RESELLER PLANS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.reseller_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  duration_days INTEGER NOT NULL DEFAULT 365,
  max_monthly_keys INTEGER,  -- null = unlimited
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10,
  features JSONB DEFAULT '[]'::jsonb,  -- array of features
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reseller_plan_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.reseller_plans(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_plan_subscriptions_reseller ON public.reseller_plan_subscriptions(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_plan_subscriptions_plan ON public.reseller_plan_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_reseller_plan_subscriptions_active ON public.reseller_plan_subscriptions(is_active, expires_at);

-- ====================================================================
-- 12) PRODUCT CATEGORIES (ENHANCED)
-- ====================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS featured_position INTEGER,
  ADD COLUMN IF NOT EXISTS trending BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketplace_visible BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_products_public_featured ON public.products(is_public, featured_position);
CREATE INDEX IF NOT EXISTS idx_products_trending ON public.products(trending);

-- ====================================================================
-- 13) LICENSE KEY ENHANCEMENTS
-- ====================================================================

ALTER TABLE public.license_keys
  ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS plan_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_used BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_license_keys_duration ON public.license_keys(duration_days);
CREATE INDEX IF NOT EXISTS idx_license_keys_is_used ON public.license_keys(is_used);

-- ====================================================================
-- 14) NOTIFICATIONS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,  -- 'payment_success', 'license_generated', 'expiry_reminder', 'order_status'
  title VARCHAR(255) NOT NULL,
  message TEXT,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  related_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- ====================================================================
-- 15) EMAIL LOGS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_type VARCHAR(50) NOT NULL,  -- 'license_key', 'payment_receipt', 'expiry_reminder'
  subject VARCHAR(255),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_delivered BOOLEAN DEFAULT FALSE,
  delivery_status TEXT,  -- 'sent', 'bounced', 'complained'
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON public.email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent ON public.email_logs(sent_at DESC);

-- ====================================================================
-- POLICIES & SECURITY
-- ====================================================================

-- RLS for orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_users_select" ON public.orders;
CREATE POLICY "orders_users_select" ON public.orders
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.resellers
      WHERE resellers.id = orders.reseller_id AND resellers.user_id = auth.uid()
    )
  );

-- RLS for favorites
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_users_select" ON public.user_favorites;
CREATE POLICY "favorites_users_select" ON public.user_favorites
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_users_insert" ON public.user_favorites;
CREATE POLICY "favorites_users_insert" ON public.user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_users_delete" ON public.user_favorites;
CREATE POLICY "favorites_users_delete" ON public.user_favorites
  FOR DELETE USING (auth.uid() = user_id);
