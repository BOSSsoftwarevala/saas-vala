
-- Fix the overly permissive notify_me INSERT policy - require authenticated users
DROP POLICY IF EXISTS "Anyone can insert notify_me" ON public.product_notify_me;

CREATE POLICY "Authenticated can insert notify_me" ON public.product_notify_me
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
