-- ============================================================
-- Backfill: missing tables from un-timestamped migration files
-- reseller_applications, reseller_license_keys,
-- marketplace_product_controls
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. reseller_applications
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reseller_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    business_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_applications_status
    ON public.reseller_applications(status);
CREATE INDEX IF NOT EXISTS idx_reseller_applications_email
    ON public.reseller_applications(email);
CREATE INDEX IF NOT EXISTS idx_reseller_applications_user_id
    ON public.reseller_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_reseller_applications_created_at
    ON public.reseller_applications(created_at);

ALTER TABLE public.reseller_applications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reseller_applications'
    AND policyname = 'Users can view own applications'
  ) THEN
    CREATE POLICY "Users can view own applications"
      ON public.reseller_applications
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reseller_applications'
    AND policyname = 'Users can create applications'
  ) THEN
    CREATE POLICY "Users can create applications"
      ON public.reseller_applications
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reseller_applications'
    AND policyname = 'Super admin full access applications'
  ) THEN
    CREATE POLICY "Super admin full access applications"
      ON public.reseller_applications
      FOR ALL USING (has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_reseller_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_reseller_applications_updated_at
    ON public.reseller_applications;
CREATE TRIGGER update_reseller_applications_updated_at
    BEFORE UPDATE ON public.reseller_applications
    FOR EACH ROW EXECUTE FUNCTION public.update_reseller_applications_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 2. reseller_license_keys
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reseller_license_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    license_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_license_keys_user_id
    ON public.reseller_license_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_reseller_license_keys_product_id
    ON public.reseller_license_keys(product_id);
CREATE INDEX IF NOT EXISTS idx_reseller_license_keys_license_key
    ON public.reseller_license_keys(license_key);
CREATE INDEX IF NOT EXISTS idx_reseller_license_keys_status
    ON public.reseller_license_keys(status);
CREATE INDEX IF NOT EXISTS idx_reseller_license_keys_expires_at
    ON public.reseller_license_keys(expires_at);

ALTER TABLE public.reseller_license_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reseller_license_keys'
    AND policyname = 'Users can view own license keys'
  ) THEN
    CREATE POLICY "Users can view own license keys"
      ON public.reseller_license_keys
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reseller_license_keys'
    AND policyname = 'Super admin full access license keys'
  ) THEN
    CREATE POLICY "Super admin full access license keys"
      ON public.reseller_license_keys
      FOR ALL USING (has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_reseller_license_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_reseller_license_keys_updated_at
    ON public.reseller_license_keys;
CREATE TRIGGER update_reseller_license_keys_updated_at
    BEFORE UPDATE ON public.reseller_license_keys
    FOR EACH ROW EXECUTE FUNCTION public.update_reseller_license_keys_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3. marketplace_product_controls columns + table
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS demo_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS buy_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS apk_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS download_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS requires_api_key BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS api_documentation_url TEXT;

CREATE INDEX IF NOT EXISTS idx_products_demo_enabled
    ON public.products(demo_enabled);
CREATE INDEX IF NOT EXISTS idx_products_buy_enabled
    ON public.products(buy_enabled);
CREATE INDEX IF NOT EXISTS idx_products_apk_enabled
    ON public.products(apk_enabled);
CREATE INDEX IF NOT EXISTS idx_products_is_visible
    ON public.products(is_visible);

CREATE TABLE IF NOT EXISTS public.marketplace_product_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    demo_enabled BOOLEAN NOT NULL DEFAULT false,
    buy_enabled BOOLEAN NOT NULL DEFAULT true,
    apk_enabled BOOLEAN NOT NULL DEFAULT false,
    download_enabled BOOLEAN NOT NULL DEFAULT false,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    controlled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_controls_product_id
    ON public.marketplace_product_controls(product_id);
CREATE INDEX IF NOT EXISTS idx_product_controls_changed_at
    ON public.marketplace_product_controls(changed_at DESC);

ALTER TABLE public.marketplace_product_controls ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'marketplace_product_controls'
    AND policyname = 'Super admin full access controls'
  ) THEN
    CREATE POLICY "Super admin full access controls"
      ON public.marketplace_product_controls
      FOR ALL USING (has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'marketplace_product_controls'
    AND policyname = 'Users can view controls'
  ) THEN
    CREATE POLICY "Users can view controls"
      ON public.marketplace_product_controls
      FOR SELECT USING (true);
  END IF;
END $$;
