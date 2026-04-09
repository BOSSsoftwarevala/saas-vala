-- Production hardening migration
-- Adds: APK versioning, audit logs, abuse limits, idempotency keys, slugs,
--        device activations, and deduplication constraints.

-- ─────────────────────────────────────────────
-- 1. SLUG on products
-- ─────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS max_devices INTEGER NOT NULL DEFAULT 3;

-- Backfill slugs for existing rows (lowercase name, replace spaces/special chars)
UPDATE products
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9 ]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug)
  WHERE slug IS NOT NULL;

-- ─────────────────────────────────────────────
-- 2. IDEMPOTENCY KEYS (24-hour TTL)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idem_key      TEXT NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  method        TEXT NOT NULL DEFAULT 'POST', -- GET/POST/PUT
  path          TEXT NOT NULL,
  status_code   INTEGER,
  response_body JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_idempotency_key_user
  ON idempotency_keys(idem_key, user_id, path);

-- Auto-expire rows older than 24 hours via partial index (cleanup can use this)
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON idempotency_keys(created_at);

-- ─────────────────────────────────────────────
-- 3. IDEMPOTENCY KEY column on orders
-- ─────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_orders_idempotency_key
  ON orders(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Prevent double license generation per order
CREATE UNIQUE INDEX IF NOT EXISTS uidx_license_keys_order_id
  ON license_keys(order_id)
  WHERE order_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- 4. APK VERSIONS (with force-update support)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apk_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version               TEXT NOT NULL,               -- e.g., "2.1.3"
  version_code          INTEGER NOT NULL,             -- monotonically increasing integer
  apk_url               TEXT NOT NULL,
  apk_size_bytes        BIGINT,
  sha256_checksum       TEXT,                         -- integrity check
  release_notes         TEXT,
  is_force_update       BOOLEAN NOT NULL DEFAULT FALSE,
  min_required_version  TEXT,                         -- minimum version that can skip the update
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, version_code)
);

ALTER TABLE apk_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active APK versions"
  ON apk_versions FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage APK versions"
  ON apk_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_apk_versions_product ON apk_versions(product_id, version_code DESC);

-- ─────────────────────────────────────────────
-- 5. DEVICE ACTIVATIONS (device limit enforcement)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_activations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key   TEXT NOT NULL,
  device_id     TEXT NOT NULL,                     -- fingerprint / UUID from client
  device_name   TEXT,                              -- optional human-readable label
  user_agent    TEXT,
  ip_address    INET,
  activated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ,
  UNIQUE(license_key, device_id)
);

ALTER TABLE device_activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own device activations"
  ON device_activations FOR SELECT
  USING (
    license_key IN (
      SELECT lk.license_key
      FROM license_keys lk
      JOIN orders o ON lk.order_id = o.id
      WHERE o.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_device_activations_license ON device_activations(license_key)
  WHERE revoked_at IS NULL;

-- ─────────────────────────────────────────────
-- 6. AUDIT LOGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,           -- e.g., PURCHASE, KEY_VALIDATE, DOWNLOAD, API_CALL
  entity_type TEXT,                    -- e.g., order, product, license_key
  entity_id   TEXT,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  user_agent  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can read their own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- No UPDATE or DELETE allowed on audit logs to preserve integrity
CREATE POLICY "Insert only for authenticated users"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ─────────────────────────────────────────────
-- 7. ABUSE / RATE LIMIT TRACKING
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS abuse_rate_limits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address     INET,
  action_type    TEXT NOT NULL,   -- e.g., payment_attempt, demo_access, download
  attempt_count  INTEGER NOT NULL DEFAULT 1,
  window_start   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE abuse_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage abuse limits"
  ON abuse_rate_limits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS uidx_abuse_rate_limits_user_action
  ON abuse_rate_limits(user_id, action_type, window_start)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_abuse_rate_limits_ip_action
  ON abuse_rate_limits(ip_address, action_type, window_start)
  WHERE ip_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_abuse_rate_limits_blocked
  ON abuse_rate_limits(blocked_until)
  WHERE blocked_until IS NOT NULL;

-- ─────────────────────────────────────────────
-- 8. DOWNLOAD TOKENS (signed, single-use APK download links)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS download_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  order_id    UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  apk_version_id UUID REFERENCES apk_versions(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ,                     -- NULL = unused
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE download_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can use their own download tokens"
  ON download_tokens FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_download_tokens_user ON download_tokens(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_download_tokens_expires ON download_tokens(expires_at)
  WHERE used_at IS NULL;

-- ─────────────────────────────────────────────
-- 9. Helper function: cleanup expired idempotency keys
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM idempotency_keys
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- ─────────────────────────────────────────────
-- 10. Helper function: enforce device limit on license activation
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_device_limit(p_license_key TEXT, p_device_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_devices INTEGER;
  v_active_count INTEGER;
  v_already_activated BOOLEAN;
BEGIN
  -- Get max_devices from the product linked to this license key
  SELECT p.max_devices INTO v_max_devices
  FROM products p
  JOIN license_keys lk ON lk.product_id = p.id
  WHERE lk.license_key = p_license_key
  LIMIT 1;

  IF v_max_devices IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'License key not found');
  END IF;

  -- Check if this device is already activated
  SELECT EXISTS(
    SELECT 1 FROM device_activations
    WHERE license_key = p_license_key
      AND device_id = p_device_id
      AND revoked_at IS NULL
  ) INTO v_already_activated;

  IF v_already_activated THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'Device already activated');
  END IF;

  -- Count active devices
  SELECT COUNT(*) INTO v_active_count
  FROM device_activations
  WHERE license_key = p_license_key
    AND revoked_at IS NULL;

  IF v_active_count >= v_max_devices THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Device limit reached (%s/%s)', v_active_count, v_max_devices)
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'current', v_active_count, 'max', v_max_devices);
END;
$$;
