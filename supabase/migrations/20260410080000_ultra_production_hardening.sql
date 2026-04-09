-- Ultra Production Hardening Migration
-- Covers: comprehensive indexes, soft-delete, feature flags, metrics, background
--         job queue, cron logs, version compatibility, force-logout, admin alerts,
--         geo blocks, cache invalidation signals, atomic payment PL/pgSQL function,
--         anti-sharing detection, and storage path helpers.

-- ─────────────────────────────────────────────
-- 1. SOFT DELETE on products
-- ─────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE;

-- Partial index: fast lookup of non-deleted active products
CREATE INDEX IF NOT EXISTS idx_products_active_not_deleted
  ON products(created_at DESC)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- Replace hard DELETE with a soft-delete trigger guard
CREATE OR REPLACE FUNCTION prevent_hard_delete_products()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletes on products are disabled. Set deleted_at = NOW() instead.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_product_delete ON products;
CREATE TRIGGER trg_prevent_product_delete
  BEFORE DELETE ON products
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL)
  EXECUTE FUNCTION prevent_hard_delete_products();

-- ─────────────────────────────────────────────
-- 2. COMPREHENSIVE PERFORMANCE INDEXES
-- ─────────────────────────────────────────────

-- license_keys
CREATE INDEX IF NOT EXISTS idx_license_keys_user_status
  ON license_keys(owner_email, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_license_keys_expires
  ON license_keys(expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_license_keys_product_active
  ON license_keys(product_id, status)
  WHERE status = 'active';

-- orders
CREATE INDEX IF NOT EXISTS idx_orders_user_status_created
  ON orders(user_id, payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_completed_at
  ON orders(completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- product_ratings  (for paginated reviews)
CREATE INDEX IF NOT EXISTS idx_product_ratings_product_created
  ON product_ratings(product_id, created_at DESC);

-- wallet_transactions (for paginated history)
CREATE INDEX IF NOT EXISTS idx_wallet_txn_wallet_created
  ON wallet_transactions(wallet_id, created_at DESC);

-- notifications (unread badge count)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE is_read = FALSE;

-- apk_downloads (per-user download history)
CREATE INDEX IF NOT EXISTS idx_apk_downloads_user_created
  ON apk_downloads(user_id, created_at DESC);

-- audit_logs (already created in previous migration; add composite)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action
  ON audit_logs(user_id, action, created_at DESC);

-- ─────────────────────────────────────────────
-- 3. FEATURE FLAGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key      TEXT NOT NULL UNIQUE,        -- e.g. 'payment_upi', 'reseller_plans'
  is_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  description   TEXT,
  rollout_pct   INTEGER NOT NULL DEFAULT 100 CHECK (rollout_pct BETWEEN 0 AND 100),
  metadata      JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read enabled flags"
  ON feature_flags FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage flags"
  ON feature_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Seed core flags
INSERT INTO feature_flags (flag_key, is_enabled, description) VALUES
  ('payment_wallet',     TRUE,  'Allow wallet balance payments'),
  ('payment_upi',        TRUE,  'Allow UPI payments'),
  ('payment_wise',       FALSE, 'Allow Wise bank-transfer payments'),
  ('payment_payu',       FALSE, 'Allow PayU gateway payments'),
  ('payment_binance',    FALSE, 'Allow Binance crypto payments'),
  ('reseller_plans',     TRUE,  'Enable reseller plan purchases'),
  ('demo_access',        TRUE,  'Allow product demo sessions'),
  ('apk_download',       TRUE,  'Allow APK downloads'),
  ('marketplace_public', TRUE,  'Marketplace visible to unauthenticated users'),
  ('ab_banner_v2',       FALSE, 'A/B test: new banner design')
ON CONFLICT (flag_key) DO NOTHING;

-- ─────────────────────────────────────────────
-- 4. API METRICS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path          TEXT NOT NULL,
  method        TEXT NOT NULL,
  status_code   INTEGER NOT NULL,
  duration_ms   INTEGER NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address    INET,
  error_msg     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Default partition for current month range (add more as needed)
CREATE TABLE IF NOT EXISTS api_metrics_2026_q2
  PARTITION OF api_metrics
  FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS api_metrics_2026_q3
  PARTITION OF api_metrics
  FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');

ALTER TABLE api_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read metrics"
  ON api_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
CREATE POLICY "System can insert metrics"
  ON api_metrics FOR INSERT WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_api_metrics_path_created
  ON api_metrics(path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_metrics_status
  ON api_metrics(status_code, created_at DESC);

-- ─────────────────────────────────────────────
-- 5. BACKGROUND JOB QUEUE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type      TEXT NOT NULL,   -- 'send_license_email', 'expire_licenses', 'cleanup_tokens', etc.
  payload       JSONB NOT NULL DEFAULT '{}'::JSONB,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending, running, done, failed
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 3,
  run_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  error_msg     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage jobs"
  ON job_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
CREATE POLICY "System can insert and update jobs"
  ON job_queue FOR INSERT WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_job_queue_pending
  ON job_queue(run_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_job_queue_type_status
  ON job_queue(job_type, status);

-- ─────────────────────────────────────────────
-- 6. CRON JOB LOGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cron_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name      TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'running', -- running, success, error
  rows_affected INTEGER,
  error_msg     TEXT
);

ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read cron logs"
  ON cron_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
CREATE POLICY "System can insert cron logs"
  ON cron_logs FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "System can update cron logs"
  ON cron_logs FOR UPDATE USING (TRUE);

-- ─────────────────────────────────────────────
-- 7. APP VERSION COMPATIBILITY
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_version_compatibility (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  app_version       TEXT NOT NULL,         -- e.g., "2.1.0" (license was issued for this)
  min_apk_version   TEXT NOT NULL,         -- minimum APK version required
  is_blocked        BOOLEAN NOT NULL DEFAULT FALSE,
  block_reason      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, app_version)
);

ALTER TABLE app_version_compatibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can check version compat"
  ON app_version_compatibility FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage version compat"
  ON app_version_compatibility FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────
-- 8. FORCE LOGOUT / SESSION REVOCATION
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revoked_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL,  -- 'password_change', 'suspicious_activity', 'admin_revoke'
  revoked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_before TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- sessions issued before this time are invalid
);

ALTER TABLE revoked_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can check their own revocations"
  ON revoked_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can manage revocations"
  ON revoked_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
CREATE POLICY "System can insert revocations"
  ON revoked_sessions FOR INSERT WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_user
  ON revoked_sessions(user_id, revoked_at DESC);

-- ─────────────────────────────────────────────
-- 9. ADMIN ALERTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type    TEXT NOT NULL,   -- 'high_failure_rate', 'suspicious_activity', 'payment_down', 'duplicate_key'
  severity      TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  is_resolved   BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata      JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage alerts"
  ON admin_alerts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
CREATE POLICY "System can insert alerts"
  ON admin_alerts FOR INSERT WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_unresolved
  ON admin_alerts(severity, created_at DESC)
  WHERE is_resolved = FALSE;

-- ─────────────────────────────────────────────
-- 10. GEO BLOCKS (optional restriction by country)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo_blocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code  CHAR(2) NOT NULL UNIQUE,   -- ISO 3166-1 alpha-2
  reason        TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE geo_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage geo blocks"
  ON geo_blocks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
CREATE POLICY "Anyone can read geo blocks"
  ON geo_blocks FOR SELECT USING (TRUE);

-- ─────────────────────────────────────────────
-- 11. CACHE INVALIDATION SIGNALS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cache_invalidations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key     TEXT NOT NULL,    -- e.g., 'products:list', 'categories'
  invalidated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_invalidations_key
  ON cache_invalidations(cache_key, invalidated_at DESC);

-- Trigger: invalidate product cache on any product change
CREATE OR REPLACE FUNCTION signal_product_cache_invalidation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO cache_invalidations(cache_key) VALUES ('products:list');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_cache_invalidate ON products;
CREATE TRIGGER trg_product_cache_invalidate
  AFTER INSERT OR UPDATE ON products
  FOR EACH STATEMENT
  EXECUTE FUNCTION signal_product_cache_invalidation();

-- ─────────────────────────────────────────────
-- 12. ANTI-SHARING: automatic flag on multi-device abuse
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION flag_license_sharing(p_license_key TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_product_id UUID;
  v_max_devices INTEGER;
  v_active_devices INTEGER;
BEGIN
  SELECT p.id, p.max_devices
  INTO v_product_id, v_max_devices
  FROM products p
  JOIN license_keys lk ON lk.product_id = p.id
  WHERE lk.license_key = p_license_key
  LIMIT 1;

  IF v_product_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_active_devices
  FROM device_activations
  WHERE license_key = p_license_key AND revoked_at IS NULL;

  -- If active device count exceeds max, raise an alert and deactivate excess
  IF v_active_devices > v_max_devices THEN
    INSERT INTO admin_alerts(
      alert_type, severity, title, message, entity_type, entity_id, metadata
    ) VALUES (
      'license_sharing',
      'warning',
      'Suspected License Sharing Detected',
      format('License %s has %s active devices (max: %s)', p_license_key, v_active_devices, v_max_devices),
      'license_key',
      p_license_key,
      jsonb_build_object('active_devices', v_active_devices, 'max_devices', v_max_devices)
    )
    ON CONFLICT DO NOTHING;

    -- Suspend the key to protect against sharing
    UPDATE license_keys
    SET status = 'suspended'
    WHERE license_key = p_license_key;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────
-- 13. ATOMIC PAYMENT FUNCTION
--     Single database transaction: wallet debit → order create →
--     license generate → notifications queue
--     Uses SELECT ... FOR UPDATE to prevent race conditions.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION process_wallet_payment(
  p_user_id         UUID,
  p_product_id      UUID,
  p_duration_days   INTEGER,
  p_amount          NUMERIC,
  p_idempotency_key TEXT,
  p_order_number    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id       UUID;
  v_balance         NUMERIC;
  v_order_id        UUID;
  v_license_key     TEXT;
  v_license_id      UUID;
  v_existing_order  UUID;
  v_chars           TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_key_part        TEXT;
  i                 INTEGER;
  v_rand_bytes      BYTEA;
BEGIN
  -- ── 0. Idempotency: return existing result if same key already processed ──
  SELECT id INTO v_existing_order
  FROM orders
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_existing_order IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'idempotent', TRUE,
      'order_id', v_existing_order
    );
  END IF;

  -- ── 1. Lock the wallet row to prevent concurrent deductions ──
  SELECT id, balance
  INTO v_wallet_id, v_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;              -- row-level lock until transaction commits

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Wallet not found');
  END IF;

  -- ── 2. Validate sufficient balance ──
  IF v_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', format('Insufficient balance. Need $%s, have $%s', p_amount, v_balance)
    );
  END IF;

  -- ── 3. Deduct wallet (still inside the same transaction / lock) ──
  UPDATE wallets
  SET balance    = balance - p_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO wallet_transactions(
    wallet_id, type, amount, balance_before, balance_after, description
  ) VALUES (
    v_wallet_id, 'debit', p_amount, v_balance, v_balance - p_amount,
    format('Purchase – product %s (%s days)', p_product_id, p_duration_days)
  );

  -- ── 4. Create order ──
  INSERT INTO orders(
    user_id, product_id, amount, currency, payment_method,
    payment_status, subscription_duration_days, order_number,
    idempotency_key, completed_at
  ) VALUES (
    p_user_id, p_product_id, p_amount, 'USD', 'wallet',
    'completed', p_duration_days,
    COALESCE(p_order_number, 'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::TEXT, 1, 8))),
    p_idempotency_key,
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- ── 5. Generate unique license key ──
  -- Rejection-sampling loop to guarantee no collision
  LOOP
    v_license_key := '';
    v_rand_bytes  := gen_random_bytes(16);
    FOR i IN 0..15 LOOP
      IF i IN (4, 8, 12) THEN
        v_license_key := v_license_key || '-';
      END IF;
      v_license_key := v_license_key || substr(v_chars, (get_byte(v_rand_bytes, i) % 36) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM license_keys WHERE license_key = v_license_key
    );
  END LOOP;

  INSERT INTO license_keys(
    product_id, license_key, key_type, status,
    expires_at, duration_days, order_id, created_by
  ) VALUES (
    p_product_id,
    v_license_key,
    CASE
      WHEN p_duration_days <= 30   THEN 'monthly'
      WHEN p_duration_days <= 90   THEN 'quarterly'
      WHEN p_duration_days <= 180  THEN 'semi_annual'
      ELSE 'yearly'
    END,
    'active',
    NOW() + make_interval(days => p_duration_days),
    p_duration_days,
    v_order_id,
    p_user_id
  )
  RETURNING id INTO v_license_id;

  -- ── 6. Link license to order ──
  UPDATE orders SET license_key_id = v_license_id WHERE id = v_order_id;

  -- ── 7. Queue email delivery job ──
  INSERT INTO job_queue(job_type, payload, run_at) VALUES (
    'send_license_email',
    jsonb_build_object(
      'user_id',     p_user_id,
      'order_id',    v_order_id,
      'license_key', v_license_key,
      'product_id',  p_product_id,
      'expires_at',  (NOW() + make_interval(days => p_duration_days))::TEXT
    ),
    NOW()
  );

  -- ── 8. Create in-app notification ──
  INSERT INTO notifications(user_id, type, title, message, related_order_id, related_product_id)
  VALUES (
    p_user_id,
    'payment_success',
    'Purchase Successful!',
    format('Your license key is: %s — valid for %s days', v_license_key, p_duration_days),
    v_order_id,
    p_product_id
  );

  -- ── 9. Audit log ──
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, new_data)
  VALUES (
    p_user_id, 'PURCHASE', 'order', v_order_id::TEXT,
    jsonb_build_object(
      'amount', p_amount, 'product_id', p_product_id,
      'license_key', v_license_key, 'duration_days', p_duration_days
    )
  );

  RETURN jsonb_build_object(
    'success',      TRUE,
    'order_id',     v_order_id,
    'license_key',  v_license_key,
    'license_id',   v_license_id,
    'expires_at',   (NOW() + make_interval(days => p_duration_days))::TEXT
  );

EXCEPTION WHEN OTHERS THEN
  -- Any failure rolls back the entire transaction automatically.
  RETURN jsonb_build_object(
    'success', FALSE,
    'error',   SQLERRM
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 14. BACKGROUND JOB: expire licenses
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION expire_old_licenses()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
  v_log_id UUID;
BEGIN
  INSERT INTO cron_logs(job_name) VALUES ('expire_old_licenses') RETURNING id INTO v_log_id;

  UPDATE license_keys
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Queue expiry reminder emails 7 days before expiry
  INSERT INTO job_queue(job_type, payload, run_at)
  SELECT
    'send_expiry_reminder',
    jsonb_build_object(
      'license_id', id,
      'product_id', product_id,
      'expires_at', expires_at
    ),
    NOW()
  FROM license_keys
  WHERE status = 'active'
    AND expires_at BETWEEN NOW() + INTERVAL '6 days' AND NOW() + INTERVAL '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM job_queue
      WHERE job_type = 'send_expiry_reminder'
        AND payload->>'license_id' = license_keys.id::TEXT
        AND status IN ('pending', 'done')
        AND created_at > NOW() - INTERVAL '8 days'
    );

  UPDATE cron_logs
  SET status = 'success', finished_at = NOW(), rows_affected = v_count
  WHERE id = v_log_id;

  RETURN jsonb_build_object('expired', v_count);
EXCEPTION WHEN OTHERS THEN
  UPDATE cron_logs
  SET status = 'error', finished_at = NOW(), error_msg = SQLERRM
  WHERE id = v_log_id;
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- ─────────────────────────────────────────────
-- 15. BACKGROUND JOB: cleanup expired tokens & old logs
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tokens    INTEGER;
  v_idem_keys INTEGER;
  v_metrics   INTEGER;
  v_log_id    UUID;
BEGIN
  INSERT INTO cron_logs(job_name) VALUES ('cleanup_expired_data') RETURNING id INTO v_log_id;

  -- Download tokens older than 2 hours
  DELETE FROM download_tokens WHERE expires_at < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_tokens = ROW_COUNT;

  -- Idempotency keys older than 25 hours
  DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '25 hours';
  GET DIAGNOSTICS v_idem_keys = ROW_COUNT;

  -- API metrics older than 90 days (keep recent for dashboards)
  DELETE FROM api_metrics WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_metrics = ROW_COUNT;

  UPDATE cron_logs
  SET status = 'success', finished_at = NOW(),
      rows_affected = v_tokens + v_idem_keys + v_metrics
  WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'download_tokens_removed', v_tokens,
    'idempotency_keys_removed', v_idem_keys,
    'old_metrics_removed', v_metrics
  );
EXCEPTION WHEN OTHERS THEN
  UPDATE cron_logs
  SET status = 'error', finished_at = NOW(), error_msg = SQLERRM
  WHERE id = v_log_id;
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- ─────────────────────────────────────────────
-- 16. HEALTH CHECK helper function
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION system_health_check()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_db_ok       BOOLEAN := TRUE;
  v_pending_jobs INTEGER;
  v_failed_jobs  INTEGER;
  v_alerts       INTEGER;
BEGIN
  -- DB connectivity check (just counting)
  SELECT COUNT(*) INTO v_pending_jobs FROM job_queue WHERE status = 'pending';
  SELECT COUNT(*) INTO v_failed_jobs  FROM job_queue WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour';
  SELECT COUNT(*) INTO v_alerts       FROM admin_alerts WHERE is_resolved = FALSE AND severity = 'critical';

  RETURN jsonb_build_object(
    'status',         CASE WHEN v_alerts > 0 OR v_failed_jobs > 5 THEN 'degraded' ELSE 'healthy' END,
    'database',       'ok',
    'pending_jobs',   v_pending_jobs,
    'failed_jobs_1h', v_failed_jobs,
    'critical_alerts',v_alerts,
    'checked_at',     NOW()
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 17. PAYMENT FAILURE → admin alert trigger
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION alert_on_payment_failure()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_fail_count INTEGER;
BEGIN
  IF NEW.payment_status = 'failed' THEN
    -- Count failures in last 10 minutes
    SELECT COUNT(*) INTO v_fail_count
    FROM orders
    WHERE payment_status = 'failed'
      AND created_at > NOW() - INTERVAL '10 minutes';

    IF v_fail_count >= 5 THEN
      INSERT INTO admin_alerts(
        alert_type, severity, title, message, entity_type, entity_id
      ) VALUES (
        'high_failure_rate',
        'critical',
        'High Payment Failure Rate',
        format('%s payment failures in the last 10 minutes', v_fail_count),
        'order',
        NEW.id::TEXT
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_payment_failure ON orders;
CREATE TRIGGER trg_alert_payment_failure
  AFTER INSERT OR UPDATE OF payment_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION alert_on_payment_failure();

-- ─────────────────────────────────────────────
-- 18. FORCE LOGOUT trigger: revoke on suspicious abuse
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION revoke_session_on_block()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.blocked_until IS NOT NULL AND OLD.blocked_until IS NULL THEN
    INSERT INTO revoked_sessions(user_id, reason, revoked_before)
    VALUES (NEW.user_id, 'abuse_detected', NOW())
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_on_abuse ON abuse_rate_limits;
CREATE TRIGGER trg_revoke_on_abuse
  AFTER UPDATE OF blocked_until ON abuse_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION revoke_session_on_block();

-- ─────────────────────────────────────────────
-- 19. STORAGE BUCKET policies (SQL side)
--     Bucket names: apk-files, banners, assets
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('apk-files', 'apk-files', FALSE, 104857600,
   ARRAY['application/vnd.android.package-archive', 'application/octet-stream']),
  ('banners',   'banners',   TRUE,  5242880,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('assets',    'assets',    TRUE,  10485760,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- APK bucket: only admins can upload; users access via signed URLs
CREATE POLICY "Admins can upload APKs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'apk-files' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "No public APK access (use signed URLs)"
  ON storage.objects FOR SELECT
  USING (
    bucket_id != 'apk-files' OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Banners and assets: public read, admin write
CREATE POLICY "Public read for banners and assets"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('banners', 'assets'));

CREATE POLICY "Admins can manage banner & asset files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('banners', 'assets') AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
