BEGIN;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'master_reseller';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY (_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission_name(
  p_user_id UUID,
  p_permission_name TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permission_map rpm
      ON rpm.role = ur.role
     AND rpm.granted = true
    JOIN public.permissions p
      ON p.id = rpm.permission_id
    WHERE ur.user_id = p_user_id
      AND p.name = p_permission_name
  )
  OR public.has_role(p_user_id, 'super_admin'::public.app_role)
  OR public.has_role(p_user_id, 'admin'::public.app_role);
$$;

INSERT INTO public.permissions (name, description, module, action)
VALUES
  ('controls.marketplace', 'Manage marketplace controls', 'marketplace', 'control'),
  ('license.blacklist', 'Blacklist or unblock licenses', 'license', 'blacklist'),
  ('license.expire', 'Expire licenses', 'license', 'expire'),
  ('payments.manual_approve', 'Approve manual payments', 'payments', 'manual_approve'),
  ('reseller.generate', 'Generate reseller licenses', 'reseller', 'generate')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permission_map (role, permission_id, granted)
SELECT 'admin'::public.app_role, p.id, true
FROM public.permissions p
WHERE p.name IN (
  'products.view',
  'products.create',
  'products.edit',
  'products.delete',
  'controls.marketplace',
  'license.blacklist',
  'license.expire',
  'payments.manual_approve',
  'resellers.view',
  'resellers.manage',
  'audit.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permission_map (role, permission_id, granted)
SELECT 'master_reseller'::public.app_role, p.id, true
FROM public.permissions p
WHERE p.name IN (
  'products.view',
  'keys.view',
  'keys.create',
  'wallet.view',
  'marketplace.view',
  'marketplace.buy',
  'marketplace.sell',
  'reseller.generate'
)
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permission_map (role, permission_id, granted)
SELECT 'reseller'::public.app_role, p.id, true
FROM public.permissions p
WHERE p.name IN (
  'products.view',
  'keys.view',
  'keys.create',
  'wallet.view',
  'marketplace.view',
  'marketplace.buy',
  'reseller.generate'
)
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permission_map (role, permission_id, granted)
SELECT 'user'::public.app_role, p.id, true
FROM public.permissions p
WHERE p.name IN (
  'products.view',
  'marketplace.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_reseller_scope_allowed(
  p_actor_user_id UUID,
  p_target_reseller_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_reseller_id UUID;
BEGIN
  IF p_actor_user_id IS NULL OR p_target_reseller_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_any_role(p_actor_user_id, ARRAY['super_admin'::public.app_role, 'admin'::public.app_role]) THEN
    RETURN true;
  END IF;

  SELECT r.id
  INTO v_actor_reseller_id
  FROM public.resellers r
  WHERE r.user_id = p_actor_user_id
  LIMIT 1;

  IF v_actor_reseller_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_actor_reseller_id = p_target_reseller_id THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    WITH RECURSIVE tree AS (
      SELECT id, parent_reseller_id
      FROM public.resellers
      WHERE id = p_target_reseller_id
      UNION ALL
      SELECT r.id, r.parent_reseller_id
      FROM public.resellers r
      JOIN tree t ON t.parent_reseller_id = r.id
    )
    SELECT 1
    FROM tree
    WHERE id = v_actor_reseller_id
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.license_apk_compatibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  min_apk_version_code INTEGER,
  max_apk_version_code INTEGER,
  min_app_version TEXT,
  max_app_version TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_license_apk_compat_rules_product_active
  ON public.license_apk_compatibility_rules(product_id, active);

ALTER TABLE public.license_apk_compatibility_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin manage license_apk_compatibility_rules" ON public.license_apk_compatibility_rules;
CREATE POLICY "Super admin manage license_apk_compatibility_rules"
ON public.license_apk_compatibility_rules
FOR ALL
USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::public.app_role, 'admin'::public.app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::public.app_role, 'admin'::public.app_role]));

DROP POLICY IF EXISTS "Authenticated can read active license_apk_compatibility_rules" ON public.license_apk_compatibility_rules;
CREATE POLICY "Authenticated can read active license_apk_compatibility_rules"
ON public.license_apk_compatibility_rules
FOR SELECT
USING (active = true AND auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.semver_to_int(p_version TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_major BIGINT := 0;
  v_minor BIGINT := 0;
  v_patch BIGINT := 0;
  v_parts TEXT[];
BEGIN
  IF p_version IS NULL OR trim(p_version) = '' THEN
    RETURN 0;
  END IF;

  v_parts := regexp_split_to_array(regexp_replace(lower(trim(p_version)), '[^0-9.]', '', 'g'), '\\.');

  IF array_length(v_parts, 1) >= 1 AND COALESCE(v_parts[1], '') <> '' THEN
    v_major := COALESCE(v_parts[1]::BIGINT, 0);
  END IF;
  IF array_length(v_parts, 1) >= 2 AND COALESCE(v_parts[2], '') <> '' THEN
    v_minor := COALESCE(v_parts[2]::BIGINT, 0);
  END IF;
  IF array_length(v_parts, 1) >= 3 AND COALESCE(v_parts[3], '') <> '' THEN
    v_patch := COALESCE(v_parts[3]::BIGINT, 0);
  END IF;

  RETURN (v_major * 1000000) + (v_minor * 1000) + v_patch;
EXCEPTION WHEN OTHERS THEN
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_license_apk_compatibility(
  p_product_id UUID,
  p_apk_version_code INTEGER DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_app_semver BIGINT := public.semver_to_int(p_app_version);
BEGIN
  IF p_product_id IS NULL THEN
    RETURN jsonb_build_object('compatible', false, 'message', 'Missing product id');
  END IF;

  SELECT *
  INTO v_rule
  FROM public.license_apk_compatibility_rules r
  WHERE r.product_id = p_product_id
    AND r.active = true
  ORDER BY r.created_at DESC
  LIMIT 1;

  IF v_rule.id IS NULL THEN
    RETURN jsonb_build_object('compatible', true, 'message', 'No compatibility rule configured');
  END IF;

  IF p_apk_version_code IS NOT NULL AND v_rule.min_apk_version_code IS NOT NULL AND p_apk_version_code < v_rule.min_apk_version_code THEN
    RETURN jsonb_build_object('compatible', false, 'message', 'APK version below minimum supported version');
  END IF;

  IF p_apk_version_code IS NOT NULL AND v_rule.max_apk_version_code IS NOT NULL AND p_apk_version_code > v_rule.max_apk_version_code THEN
    RETURN jsonb_build_object('compatible', false, 'message', 'APK version above maximum allowed version');
  END IF;

  IF p_app_version IS NOT NULL AND v_rule.min_app_version IS NOT NULL AND v_app_semver < public.semver_to_int(v_rule.min_app_version) THEN
    RETURN jsonb_build_object('compatible', false, 'message', 'App version below minimum supported version');
  END IF;

  IF p_app_version IS NOT NULL AND v_rule.max_app_version IS NOT NULL AND v_app_semver > public.semver_to_int(v_rule.max_app_version) THEN
    RETURN jsonb_build_object('compatible', false, 'message', 'App version above maximum allowed version');
  END IF;

  RETURN jsonb_build_object('compatible', true, 'message', 'Compatibility check passed');
END;
$$;

CREATE TABLE IF NOT EXISTS public.license_revocation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key_id UUID NOT NULL REFERENCES public.license_keys(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
  old_status TEXT,
  new_status TEXT,
  reason TEXT,
  event_type TEXT NOT NULL DEFAULT 'revocation_sync',
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id TEXT,
  ip_address TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_license_revocation_events_key_created
  ON public.license_revocation_events(license_key_id, created_at DESC);

ALTER TABLE public.license_revocation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access license_revocation_events" ON public.license_revocation_events;
CREATE POLICY "Super admin full access license_revocation_events"
ON public.license_revocation_events
FOR ALL
USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::public.app_role, 'admin'::public.app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::public.app_role, 'admin'::public.app_role]));

CREATE OR REPLACE FUNCTION public.capture_license_revocation_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status TEXT := COALESCE(OLD.key_status::text, OLD.status::text, 'unknown');
  v_new_status TEXT := COALESCE(NEW.key_status::text, NEW.status::text, 'unknown');
BEGIN
  IF v_old_status = v_new_status THEN
    RETURN NEW;
  END IF;

  IF v_new_status IN ('revoked', 'blocked', 'expired', 'suspended') THEN
    INSERT INTO public.license_revocation_events (
      license_key_id,
      product_id,
      reseller_id,
      old_status,
      new_status,
      reason,
      event_type,
      triggered_by,
      meta,
      created_at
    ) VALUES (
      NEW.id,
      NEW.product_id,
      NEW.reseller_id,
      v_old_status,
      v_new_status,
      COALESCE(NEW.meta->>'blacklist_reason', NEW.meta->>'expire_reason', NEW.meta->>'revoke_reason'),
      'status_change',
      auth.uid(),
      COALESCE(NEW.meta, '{}'::jsonb),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_license_revocation_event ON public.license_keys;
CREATE TRIGGER trg_capture_license_revocation_event
AFTER UPDATE ON public.license_keys
FOR EACH ROW
EXECUTE FUNCTION public.capture_license_revocation_event();

CREATE OR REPLACE FUNCTION public.sync_license_revocation_status(
  p_license_key TEXT,
  p_device_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key RECORD;
  v_revoked BOOLEAN := false;
  v_reason TEXT := NULL;
BEGIN
  SELECT *
  INTO v_key
  FROM public.license_keys
  WHERE license_key = trim(upper(p_license_key))
  LIMIT 1;

  IF v_key.id IS NULL THEN
    RETURN jsonb_build_object('revoked', true, 'reason', 'license_not_found');
  END IF;

  v_revoked := COALESCE(v_key.key_status::text, '') IN ('revoked', 'blocked', 'expired')
               OR COALESCE(v_key.status::text, '') IN ('revoked', 'suspended', 'expired');

  IF v_revoked THEN
    v_reason := COALESCE(v_key.meta->>'blacklist_reason', v_key.meta->>'revoke_reason', v_key.meta->>'expire_reason', 'revoked_status');

    INSERT INTO public.license_revocation_events (
      license_key_id,
      product_id,
      reseller_id,
      old_status,
      new_status,
      reason,
      event_type,
      triggered_by,
      device_id,
      meta,
      created_at
    ) VALUES (
      v_key.id,
      v_key.product_id,
      v_key.reseller_id,
      COALESCE(v_key.key_status::text, v_key.status::text, 'unknown'),
      COALESCE(v_key.key_status::text, v_key.status::text, 'unknown'),
      v_reason,
      'sync_check',
      p_user_id,
      p_device_id,
      jsonb_build_object('source', 'sync_license_revocation_status'),
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'revoked', v_revoked,
    'reason', v_reason,
    'license_key_id', v_key.id
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.enterprise_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_health_events_time
  ON public.enterprise_health_events(event_time DESC);

ALTER TABLE public.enterprise_health_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access enterprise_health_events" ON public.enterprise_health_events;
CREATE POLICY "Super admin full access enterprise_health_events"
ON public.enterprise_health_events
FOR ALL
USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::public.app_role, 'admin'::public.app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::public.app_role, 'admin'::public.app_role]));

CREATE OR REPLACE FUNCTION public.log_enterprise_health_event(
  p_component TEXT,
  p_severity TEXT,
  p_title TEXT,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.enterprise_health_events (
    component,
    severity,
    title,
    details,
    event_time,
    created_by,
    created_at
  ) VALUES (
    COALESCE(NULLIF(trim(p_component), ''), 'system'),
    CASE
      WHEN lower(COALESCE(p_severity, '')) IN ('warning', 'critical', 'info') THEN lower(p_severity)
      ELSE 'info'
    END,
    COALESCE(NULLIF(trim(p_title), ''), 'Health event'),
    COALESCE(p_details, '{}'::jsonb),
    now(),
    auth.uid(),
    now()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_enterprise_data(
  p_idempotency_days INTEGER DEFAULT 30,
  p_verification_log_days INTEGER DEFAULT 180,
  p_fraud_event_days INTEGER DEFAULT 365,
  p_health_event_days INTEGER DEFAULT 365
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idempotency_deleted INTEGER := 0;
  v_verification_deleted INTEGER := 0;
  v_fraud_deleted INTEGER := 0;
  v_health_deleted INTEGER := 0;
BEGIN
  DELETE FROM public.reseller_idempotency_requests
  WHERE status IN ('completed', 'failed')
    AND created_at < now() - make_interval(days => GREATEST(1, p_idempotency_days));
  GET DIAGNOSTICS v_idempotency_deleted = ROW_COUNT;

  DELETE FROM public.license_verification_logs
  WHERE created_at < now() - make_interval(days => GREATEST(30, p_verification_log_days));
  GET DIAGNOSTICS v_verification_deleted = ROW_COUNT;

  DELETE FROM public.reseller_fraud_events
  WHERE resolved = true
    AND created_at < now() - make_interval(days => GREATEST(30, p_fraud_event_days));
  GET DIAGNOSTICS v_fraud_deleted = ROW_COUNT;

  DELETE FROM public.enterprise_health_events
  WHERE event_time < now() - make_interval(days => GREATEST(30, p_health_event_days));
  GET DIAGNOSTICS v_health_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'idempotency_deleted', v_idempotency_deleted,
    'verification_logs_deleted', v_verification_deleted,
    'fraud_events_deleted', v_fraud_deleted,
    'health_events_deleted', v_health_deleted,
    'cleanup_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reseller_generate_license_key_atomic_locked(
  p_request_id text,
  p_user_id uuid,
  p_reseller_id uuid,
  p_wallet_id uuid,
  p_product_id uuid,
  p_amount numeric,
  p_plan_duration text,
  p_license_key text,
  p_key_signature text,
  p_key_type text,
  p_expires_at timestamptz,
  p_client_id uuid default null,
  p_sell_price numeric default null,
  p_delivery_status text default 'pending',
  p_notes text default null,
  p_meta jsonb default '{}'::jsonb,
  p_device_limit integer default 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(COALESCE(p_reseller_id::text, ''), 72311));
  PERFORM pg_advisory_xact_lock(hashtextextended(COALESCE(p_wallet_id::text, ''), 91357));

  RETURN public.reseller_generate_license_key_atomic(
    p_request_id,
    p_user_id,
    p_reseller_id,
    p_wallet_id,
    p_product_id,
    p_amount,
    p_plan_duration,
    p_license_key,
    p_key_signature,
    p_key_type,
    p_expires_at,
    p_client_id,
    p_sell_price,
    p_delivery_status,
    p_notes,
    p_meta,
    p_device_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reseller_generate_license_key_atomic_locked(text, uuid, uuid, uuid, uuid, numeric, text, text, text, text, timestamptz, uuid, numeric, text, text, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reseller_generate_license_key_atomic_locked(text, uuid, uuid, uuid, uuid, numeric, text, text, text, text, timestamptz, uuid, numeric, text, text, jsonb, integer) TO authenticated;

COMMIT;
