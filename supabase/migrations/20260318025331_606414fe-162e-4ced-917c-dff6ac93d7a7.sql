-- STEP 1: Header Menu control table
CREATE TABLE IF NOT EXISTS public.marketplace_header_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  target_id TEXT,
  link_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_header_menus ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'marketplace_header_menus' AND policyname = 'Anyone can read active header menus'
  ) THEN
    CREATE POLICY "Anyone can read active header menus"
    ON public.marketplace_header_menus
    FOR SELECT
    USING (is_active = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'marketplace_header_menus' AND policyname = 'Admins can manage header menus'
  ) THEN
    CREATE POLICY "Admins can manage header menus"
    ON public.marketplace_header_menus
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'))
    WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_marketplace_header_menus_active_order
  ON public.marketplace_header_menus (is_active, sort_order);

DROP TRIGGER IF EXISTS trg_marketplace_header_menus_updated_at ON public.marketplace_header_menus;
CREATE TRIGGER trg_marketplace_header_menus_updated_at
BEFORE UPDATE ON public.marketplace_header_menus
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- STEP 2: Payment gateway control table
CREATE TABLE IF NOT EXISTS public.marketplace_payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_code TEXT NOT NULL UNIQUE,
  gateway_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_payment_gateways ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'marketplace_payment_gateways' AND policyname = 'Public can read enabled gateways'
  ) THEN
    CREATE POLICY "Public can read enabled gateways"
    ON public.marketplace_payment_gateways
    FOR SELECT
    USING (is_enabled = true OR public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'marketplace_payment_gateways' AND policyname = 'Admins can manage gateways'
  ) THEN
    CREATE POLICY "Admins can manage gateways"
    ON public.marketplace_payment_gateways
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'))
    WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_marketplace_payment_gateways_enabled_order
  ON public.marketplace_payment_gateways (is_enabled, sort_order);

DROP TRIGGER IF EXISTS trg_marketplace_payment_gateways_updated_at ON public.marketplace_payment_gateways;
CREATE TRIGGER trg_marketplace_payment_gateways_updated_at
BEFORE UPDATE ON public.marketplace_payment_gateways
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- STEP 3: Discount rules (country/region/festival offers)
CREATE TABLE IF NOT EXISTS public.marketplace_discount_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_code TEXT,
  region TEXT,
  festival TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  min_order NUMERIC NOT NULL DEFAULT 0,
  coupon_code TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_discount_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'marketplace_discount_rules' AND policyname = 'Public can read active discount rules'
  ) THEN
    CREATE POLICY "Public can read active discount rules"
    ON public.marketplace_discount_rules
    FOR SELECT
    USING (is_active = true OR public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'marketplace_discount_rules' AND policyname = 'Admins can manage discount rules'
  ) THEN
    CREATE POLICY "Admins can manage discount rules"
    ON public.marketplace_discount_rules
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'))
    WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_marketplace_discount_rules_filter
  ON public.marketplace_discount_rules (is_active, country_code, region, sort_order);

DROP TRIGGER IF EXISTS trg_marketplace_discount_rules_updated_at ON public.marketplace_discount_rules;
CREATE TRIGGER trg_marketplace_discount_rules_updated_at
BEFORE UPDATE ON public.marketplace_discount_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- STEP 4: Extend orders for full order tracking
ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC;

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_created_status
  ON public.marketplace_orders (created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_product_status
  ON public.marketplace_orders (product_id, status);

-- STEP 5: APK pipeline -> auto switch product status
CREATE OR REPLACE FUNCTION public.sync_product_from_apk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'published' THEN
    UPDATE public.products
    SET
      status = 'active'::product_status,
      apk_enabled = true,
      apk_url = COALESCE(NULLIF(NEW.file_url, ''), apk_url),
      updated_at = now()
    WHERE id = NEW.product_id;
  ELSIF NEW.status = 'draft' THEN
    UPDATE public.products
    SET
      status = CASE WHEN status = 'active'::product_status THEN 'draft'::product_status ELSE status END,
      apk_enabled = false,
      updated_at = now()
    WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_from_apk ON public.apks;
CREATE TRIGGER trg_sync_product_from_apk
AFTER INSERT OR UPDATE OF status, file_url ON public.apks
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_from_apk();