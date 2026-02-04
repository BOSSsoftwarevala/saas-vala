-- ================================================
-- PHASE 1.2: PRODUCT/DEMO/APK DATABASE FOUNDATION
-- ================================================

-- 1. Add missing columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS product_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS short_description TEXT,
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'software',
ADD COLUMN IF NOT EXISTS icon_path TEXT,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private'));

-- Generate product codes for existing products
UPDATE public.products 
SET product_code = 'PRD-' || UPPER(SUBSTRING(id::text, 1, 8))
WHERE product_code IS NULL;

-- Make product_code NOT NULL after populating
ALTER TABLE public.products 
ALTER COLUMN product_code SET NOT NULL;

-- Create function to auto-generate product code
CREATE OR REPLACE FUNCTION public.generate_product_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.product_code IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(product_code FROM 5) AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.products
    WHERE product_code ~ '^PRD-[0-9]+$';
    
    NEW.product_code := 'PRD-' || LPAD(next_num::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for auto product code
DROP TRIGGER IF EXISTS trigger_generate_product_code ON public.products;
CREATE TRIGGER trigger_generate_product_code
BEFORE INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.generate_product_code();

-- 2. Create apk_versions table for version history
CREATE TABLE IF NOT EXISTS public.apk_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  apk_id UUID NOT NULL REFERENCES public.apks(id) ON DELETE CASCADE,
  version_name TEXT NOT NULL,
  version_code INTEGER NOT NULL,
  file_path TEXT,
  file_size BIGINT,
  checksum TEXT,
  release_notes TEXT,
  is_stable BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add current_version_id to apks table
ALTER TABLE public.apks
ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES public.apk_versions(id),
ADD COLUMN IF NOT EXISTS architecture TEXT DEFAULT 'arm64-v8a';

-- Enable RLS on apk_versions
ALTER TABLE public.apk_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for apk_versions
CREATE POLICY "Super admin full access apk_versions" ON public.apk_versions
FOR ALL USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Resellers view apk_versions" ON public.apk_versions
FOR SELECT USING (
  has_role(auth.uid(), 'reseller') AND 
  apk_id IN (SELECT id FROM public.apks WHERE status = 'published')
);

-- 3. Create health_checks table
CREATE TABLE IF NOT EXISTS public.health_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  server_status TEXT DEFAULT 'unknown' CHECK (server_status IN ('ok', 'warning', 'error', 'unknown')),
  license_status TEXT DEFAULT 'unknown' CHECK (license_status IN ('ok', 'warning', 'error', 'unknown')),
  apk_status TEXT DEFAULT 'unknown' CHECK (apk_status IN ('ok', 'warning', 'error', 'unknown')),
  demo_status TEXT DEFAULT 'unknown' CHECK (demo_status IN ('ok', 'warning', 'error', 'unknown')),
  overall_status TEXT DEFAULT 'unknown' CHECK (overall_status IN ('ok', 'warning', 'error', 'unknown')),
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on health_checks
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;

-- RLS policies for health_checks
CREATE POLICY "Super admin full access health_checks" ON public.health_checks
FOR ALL USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Resellers view own product health" ON public.health_checks
FOR SELECT USING (
  has_role(auth.uid(), 'reseller') AND
  product_id IN (SELECT id FROM public.products WHERE status = 'active')
);

-- 4. Add product_id to servers table (optional link)
ALTER TABLE public.servers
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS server_type TEXT DEFAULT 'vercel' CHECK (server_type IN ('vercel', 'self', 'cloud', 'hybrid'));

-- 5. Add product_id to ai_usage table (optional link)
ALTER TABLE public.ai_usage
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- 6. Create activity_logs table for comprehensive audit
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_performed_by ON public.activity_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Enable RLS on activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity_logs
CREATE POLICY "Super admin full access activity_logs" ON public.activity_logs
FOR ALL USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can create activity logs" ON public.activity_logs
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Add indexes for performance (5000+ products scale)
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_product_code ON public.products(product_code);

CREATE INDEX IF NOT EXISTS idx_demos_product ON public.demos(product_id);
CREATE INDEX IF NOT EXISTS idx_demos_status ON public.demos(status);

CREATE INDEX IF NOT EXISTS idx_apks_product ON public.apks(product_id);
CREATE INDEX IF NOT EXISTS idx_apks_status ON public.apks(status);

CREATE INDEX IF NOT EXISTS idx_apk_versions_apk ON public.apk_versions(apk_id);
CREATE INDEX IF NOT EXISTS idx_apk_versions_stable ON public.apk_versions(is_stable) WHERE is_stable = true;

CREATE INDEX IF NOT EXISTS idx_license_keys_product ON public.license_keys(product_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON public.license_keys(status);

CREATE INDEX IF NOT EXISTS idx_health_checks_product ON public.health_checks(product_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_overall ON public.health_checks(overall_status);

CREATE INDEX IF NOT EXISTS idx_categories_level ON public.categories(level);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);

-- 8. Create function to update health check
CREATE OR REPLACE FUNCTION public.update_product_health(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demo_status TEXT := 'unknown';
  v_apk_status TEXT := 'unknown';
  v_license_status TEXT := 'unknown';
  v_server_status TEXT := 'unknown';
  v_overall TEXT := 'ok';
BEGIN
  -- Check demo status
  SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'warning'
    WHEN COUNT(*) FILTER (WHERE status = 'active') > 0 THEN 'ok'
    ELSE 'error'
  END INTO v_demo_status
  FROM public.demos WHERE product_id = p_product_id;

  -- Check APK status
  SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'warning'
    WHEN COUNT(*) FILTER (WHERE status = 'published') > 0 THEN 'ok'
    ELSE 'error'
  END INTO v_apk_status
  FROM public.apks WHERE product_id = p_product_id;

  -- Check license status
  SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'warning'
    WHEN COUNT(*) FILTER (WHERE status = 'active') > 0 THEN 'ok'
    ELSE 'error'
  END INTO v_license_status
  FROM public.license_keys WHERE product_id = p_product_id;

  -- Check server status
  SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'warning'
    WHEN COUNT(*) FILTER (WHERE status = 'live') > 0 THEN 'ok'
    ELSE 'error'
  END INTO v_server_status
  FROM public.servers WHERE product_id = p_product_id;

  -- Calculate overall status
  IF v_demo_status = 'error' OR v_apk_status = 'error' OR v_license_status = 'error' OR v_server_status = 'error' THEN
    v_overall := 'error';
  ELSIF v_demo_status = 'warning' OR v_apk_status = 'warning' OR v_license_status = 'warning' OR v_server_status = 'warning' THEN
    v_overall := 'warning';
  ELSE
    v_overall := 'ok';
  END IF;

  -- Upsert health check
  INSERT INTO public.health_checks (product_id, demo_status, apk_status, license_status, server_status, overall_status, last_checked_at, updated_at)
  VALUES (p_product_id, v_demo_status, v_apk_status, v_license_status, v_server_status, v_overall, now(), now())
  ON CONFLICT (product_id) 
  DO UPDATE SET
    demo_status = EXCLUDED.demo_status,
    apk_status = EXCLUDED.apk_status,
    license_status = EXCLUDED.license_status,
    server_status = EXCLUDED.server_status,
    overall_status = EXCLUDED.overall_status,
    last_checked_at = EXCLUDED.last_checked_at,
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- Add unique constraint for health_checks on product_id
ALTER TABLE public.health_checks DROP CONSTRAINT IF EXISTS health_checks_product_id_key;
ALTER TABLE public.health_checks ADD CONSTRAINT health_checks_product_id_key UNIQUE (product_id);

-- 9. Create function to log activity
CREATE OR REPLACE FUNCTION public.log_activity(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.activity_logs (entity_type, entity_id, action, performed_by, details)
  VALUES (p_entity_type, p_entity_id, p_action, auth.uid(), p_details)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 10. Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.health_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;