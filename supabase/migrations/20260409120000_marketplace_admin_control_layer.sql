-- Marketplace Admin Control Layer
-- Adds granular admin permissions, approval workflow, rollback/versioning,
-- payout controls, blacklist, templates, and system configuration.
-- 1) Expand role enum to support granular admin matrix.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'admin';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'support'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'support';
  END IF;
END$$;

-- 2) Granular permissions for marketplace admin actions.
INSERT INTO public.permissions (name, description, module, action) VALUES
  ('marketplace.products.view', 'View marketplace products', 'marketplace-admin', 'products_view'),
  ('marketplace.products.edit', 'Create/edit marketplace products', 'marketplace-admin', 'products_edit'),
  ('marketplace.products.delete', 'Soft delete marketplace products', 'marketplace-admin', 'products_delete'),
  ('marketplace.products.publish', 'Approve/publish marketplace products', 'marketplace-admin', 'products_publish'),
  ('marketplace.pricing.edit', 'Edit product pricing', 'marketplace-admin', 'pricing_edit'),
  ('marketplace.apk.manage', 'Manage APK versions and force-update', 'marketplace-admin', 'apk_manage'),
  ('marketplace.banner.manage', 'Manage banners', 'marketplace-admin', 'banner_manage'),
  ('marketplace.category.manage', 'Manage categories', 'marketplace-admin', 'category_manage'),
  ('marketplace.order.view', 'View and filter orders', 'marketplace-admin', 'order_view'),
  ('marketplace.order.refund', 'Refund orders', 'marketplace-admin', 'order_refund'),
  ('marketplace.order.override', 'Manual payment override', 'marketplace-admin', 'order_override'),
  ('marketplace.license.view', 'View/search licenses', 'marketplace-admin', 'license_view'),
  ('marketplace.license.revoke', 'Revoke/extend/regenerate licenses', 'marketplace-admin', 'license_revoke'),
  ('marketplace.reseller.manage', 'Manage reseller linkage and access', 'marketplace-admin', 'reseller_manage'),
  ('marketplace.reseller.payout', 'Approve/reject reseller payouts', 'marketplace-admin', 'reseller_payout'),
  ('marketplace.review.moderate', 'Moderate reviews', 'marketplace-admin', 'review_moderate'),
  ('marketplace.analytics.view', 'View admin analytics and realtime status', 'marketplace-admin', 'analytics_view'),
  ('marketplace.feature.toggle', 'Enable/disable features and payment methods', 'marketplace-admin', 'feature_toggle'),
  ('marketplace.config.manage', 'Manage system config and templates', 'marketplace-admin', 'config_manage'),
  ('marketplace.export', 'Export operational data', 'marketplace-admin', 'data_export')
ON CONFLICT (name) DO NOTHING;

-- 3) Role-permission mappings.
INSERT INTO public.role_permission_map (role, permission_id, granted)
SELECT 'super_admin'::public.app_role, p.id, TRUE
FROM public.permissions p
WHERE p.name LIKE 'marketplace.%'
ON CONFLICT (role, permission_id) DO UPDATE SET granted = EXCLUDED.granted;

INSERT INTO public.role_permission_map (role, permission_id, granted)
SELECT 'admin'::public.app_role, p.id,
  CASE
    WHEN p.name IN (
      'marketplace.products.view',
      'marketplace.products.edit',
      'marketplace.products.delete',
      'marketplace.products.publish',
      'marketplace.pricing.edit',
      'marketplace.apk.manage',
      'marketplace.banner.manage',
      'marketplace.category.manage',
      'marketplace.order.view',
      'marketplace.order.refund',
      'marketplace.order.override',
      'marketplace.license.view',
      'marketplace.license.revoke',
      'marketplace.reseller.manage',
      'marketplace.reseller.payout',
      'marketplace.review.moderate',
      'marketplace.analytics.view',
      'marketplace.feature.toggle',
      'marketplace.config.manage',
      'marketplace.export'
    ) THEN TRUE
    ELSE FALSE
  END
FROM public.permissions p
WHERE p.name LIKE 'marketplace.%'
ON CONFLICT (role, permission_id) DO UPDATE SET granted = EXCLUDED.granted;

INSERT INTO public.role_permission_map (role, permission_id, granted)
SELECT 'support'::public.app_role, p.id,
  CASE
    WHEN p.name IN (
      'marketplace.products.view',
      'marketplace.order.view',
      'marketplace.license.view',
      'marketplace.review.moderate',
      'marketplace.analytics.view'
    ) THEN TRUE
    ELSE FALSE
  END
FROM public.permissions p
WHERE p.name LIKE 'marketplace.%'
ON CONFLICT (role, permission_id) DO UPDATE SET granted = EXCLUDED.granted;

-- 4) Approval workflow requests.
CREATE TABLE IF NOT EXISTS public.marketplace_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('product_publish', 'price_change', 'reseller_plan_activation')),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_marketplace_approval_requests_status
  ON public.marketplace_approval_requests(status, created_at DESC);

-- 5) Product version snapshots for compare + rollback.
CREATE TABLE IF NOT EXISTS public.product_change_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'pricing', 'apk', 'rollback')),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_product_change_versions_product
  ON public.product_change_versions(product_id, version_no DESC);

-- 6) Reseller commission overrides and payouts.
CREATE TABLE IF NOT EXISTS public.reseller_commission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  commission_percent NUMERIC(6,2) NOT NULL CHECK (commission_percent >= 0 AND commission_percent <= 100),
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reseller_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.reseller_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  requested_amount NUMERIC(12,2) NOT NULL CHECK (requested_amount > 0),
  approved_amount NUMERIC(12,2),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  payout_reference TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_reseller_payout_requests_status
  ON public.reseller_payout_requests(status, requested_at DESC);

-- 7) Blacklist controls.
CREATE TABLE IF NOT EXISTS public.access_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_type TEXT NOT NULL CHECK (block_type IN ('user', 'ip', 'device')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET,
  device_id TEXT,
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT access_blacklist_target_required CHECK (
    (block_type = 'user' AND user_id IS NOT NULL) OR
    (block_type = 'ip' AND ip_address IS NOT NULL) OR
    (block_type = 'device' AND device_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_access_blacklist_active
  ON public.access_blacklist(block_type, is_active, created_at DESC);

-- 8) Config + templates.
CREATE TABLE IF NOT EXISTS public.marketplace_system_config (
  config_key TEXT PRIMARY KEY,
  config_value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.marketplace_system_config (config_key, config_value) VALUES
  ('default_pricing', jsonb_build_object('base_usd', 5, 'durations', jsonb_build_array(30, 90, 180, 365))),
  ('default_license_duration_days', '30'::jsonb),
  ('download_limits', jsonb_build_object('max_per_user', 3, 'window_hours', 24)),
  ('demo_limits', jsonb_build_object('max_per_user', 10, 'window_hours', 1))
ON CONFLICT (config_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_templates (template_key, subject_template, body_template)
VALUES
  ('license_email', 'Your License Key for {{product_name}}', 'Hello {{user_name}}, your license key is {{license_key}}.'),
  ('payment_success', 'Payment Successful - {{order_number}}', 'Payment received. Amount: {{amount}} {{currency}}.'),
  ('expiry_reminder', 'License Expiry Reminder', 'Your license for {{product_name}} expires on {{expires_at}}.')
ON CONFLICT (template_key) DO NOTHING;

-- 9) Manual override logs (force success/regenerate/unlock).
CREATE TABLE IF NOT EXISTS public.manual_override_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_type TEXT NOT NULL CHECK (override_type IN ('payment_success', 'regenerate_license', 'unlock_download')),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_override_logs_created
  ON public.manual_override_logs(created_at DESC);

-- 10) RLS policies.
ALTER TABLE public.marketplace_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_change_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_commission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_override_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage approval requests" ON public.marketplace_approval_requests;
CREATE POLICY "Admins manage approval requests" ON public.marketplace_approval_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins view product versions" ON public.product_change_versions;
CREATE POLICY "Admins view product versions" ON public.product_change_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin', 'support')
    )
  );

DROP POLICY IF EXISTS "Admins manage product versions" ON public.product_change_versions;
CREATE POLICY "Admins manage product versions" ON public.product_change_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins manage commission overrides" ON public.reseller_commission_overrides;
CREATE POLICY "Admins manage commission overrides" ON public.reseller_commission_overrides
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins manage payout requests" ON public.reseller_payout_requests;
CREATE POLICY "Admins manage payout requests" ON public.reseller_payout_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Reseller create own payout request" ON public.reseller_payout_requests;
CREATE POLICY "Reseller create own payout request" ON public.reseller_payout_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.resellers r
      WHERE r.id = reseller_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Reseller view own payout request" ON public.reseller_payout_requests;
CREATE POLICY "Reseller view own payout request" ON public.reseller_payout_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.resellers r
      WHERE r.id = reseller_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage access blacklist" ON public.access_blacklist;
CREATE POLICY "Admins manage access blacklist" ON public.access_blacklist
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins manage system config" ON public.marketplace_system_config;
CREATE POLICY "Admins manage system config" ON public.marketplace_system_config
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins manage email templates" ON public.email_templates;
CREATE POLICY "Admins manage email templates" ON public.email_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins manage manual overrides" ON public.manual_override_logs;
CREATE POLICY "Admins manage manual overrides" ON public.manual_override_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin')
    )
  );
