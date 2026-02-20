
-- On-demand download requests table
CREATE TABLE IF NOT EXISTS public.ondemand_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID,
  product_name TEXT NOT NULL,
  product_category TEXT,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  requirements TEXT,
  advance_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  payment_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ondemand_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own requests" ON public.ondemand_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own requests" ON public.ondemand_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super admin full access ondemand_requests" ON public.ondemand_requests
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Product wishlist table
CREATE TABLE IF NOT EXISTS public.product_wishlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.product_wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wishlist" ON public.product_wishlists
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Product notify_me table
CREATE TABLE IF NOT EXISTS public.product_notify_me (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email, product_id)
);

ALTER TABLE public.product_notify_me ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert notify_me" ON public.product_notify_me
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users view own notify_me" ON public.product_notify_me
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Super admin full access notify_me" ON public.product_notify_me
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
