-- Create marketplace_listings table
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create marketplace_orders table
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'completed', 'refunded', 'cancelled')),
  payment_method TEXT,
  transaction_id UUID REFERENCES public.transactions(id),
  license_key_id UUID REFERENCES public.license_keys(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create marketplace_reviews table
CREATE TABLE IF NOT EXISTS public.marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create marketplace_payouts table
CREATE TABLE IF NOT EXISTS public.marketplace_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payment_details JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'paused')),
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  current_period_start TIMESTAMPTZ DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create ai_requests table
CREATE TABLE IF NOT EXISTS public.ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id TEXT,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create ai_responses table
CREATE TABLE IF NOT EXISTS public.ai_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.ai_requests(id) ON DELETE CASCADE NOT NULL,
  response TEXT,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create error_logs table
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB DEFAULT '{}',
  severity TEXT DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create debug_logs table
CREATE TABLE IF NOT EXISTS public.debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create usage_metrics table
CREATE TABLE IF NOT EXISTS public.usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketplace_listings
CREATE POLICY "Public can view approved listings" ON public.marketplace_listings
  FOR SELECT USING (status = 'approved');
CREATE POLICY "Sellers can manage own listings" ON public.marketplace_listings
  FOR ALL USING (seller_id = auth.uid());
CREATE POLICY "Super admin full access marketplace_listings" ON public.marketplace_listings
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for marketplace_orders
CREATE POLICY "Users can view own orders" ON public.marketplace_orders
  FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());
CREATE POLICY "Super admin full access marketplace_orders" ON public.marketplace_orders
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for marketplace_reviews
CREATE POLICY "Public can view verified reviews" ON public.marketplace_reviews
  FOR SELECT USING (is_verified = true);
CREATE POLICY "Users can create own reviews" ON public.marketplace_reviews
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY "Super admin full access marketplace_reviews" ON public.marketplace_reviews
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for marketplace_payouts
CREATE POLICY "Sellers can view own payouts" ON public.marketplace_payouts
  FOR SELECT USING (seller_id = auth.uid());
CREATE POLICY "Super admin full access marketplace_payouts" ON public.marketplace_payouts
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Super admin full access subscriptions" ON public.subscriptions
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for ai_requests
CREATE POLICY "Users can view own ai_requests" ON public.ai_requests
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create own ai_requests" ON public.ai_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Super admin full access ai_requests" ON public.ai_requests
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for ai_responses
CREATE POLICY "Users can view own ai_responses" ON public.ai_responses
  FOR SELECT USING (request_id IN (SELECT id FROM public.ai_requests WHERE user_id = auth.uid()));
CREATE POLICY "Super admin full access ai_responses" ON public.ai_responses
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for error_logs
CREATE POLICY "Super admin full access error_logs" ON public.error_logs
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for debug_logs
CREATE POLICY "Super admin full access debug_logs" ON public.debug_logs
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Super admin full access notifications" ON public.notifications
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for usage_metrics
CREATE POLICY "Users can view own usage_metrics" ON public.usage_metrics
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Super admin full access usage_metrics" ON public.usage_metrics
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));