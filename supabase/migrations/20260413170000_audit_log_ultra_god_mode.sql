-- Audit Log Ultra God Mode
-- Forensic, immutable, chained, searchable audit logging with queue + anomaly hooks.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS role_name TEXT,
  ADD COLUMN IF NOT EXISTS action_type TEXT,
  ADD COLUMN IF NOT EXISTS table_name TEXT,
  ADD COLUMN IF NOT EXISTS record_id TEXT,
  ADD COLUMN IF NOT EXISTS event_source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS system_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_sensitive_action BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS old_value JSONB,
  ADD COLUMN IF NOT EXISTS new_value JSONB,
  ADD COLUMN IF NOT EXISTS diff_value JSONB,
  ADD COLUMN IF NOT EXISTS occurred_at_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone_name TEXT,
  ADD COLUMN IF NOT EXISTS occurred_at_local TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS trace_id TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS chain_id TEXT,
  ADD COLUMN IF NOT EXISTS tenant_scope TEXT,
  ADD COLUMN IF NOT EXISTS api_path TEXT,
  ADD COLUMN IF NOT EXISTS http_method TEXT,
  ADD COLUMN IF NOT EXISTS response_status INTEGER,
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS request_payload JSONB,
  ADD COLUMN IF NOT EXISTS response_payload JSONB,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS ip_country TEXT,
  ADD COLUMN IF NOT EXISTS ip_city TEXT,
  ADD COLUMN IF NOT EXISTS bulk_group_id TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_before JSONB,
  ADD COLUMN IF NOT EXISTS snapshot_after JSONB,
  ADD COLUMN IF NOT EXISTS replay_steps JSONB,
  ADD COLUMN IF NOT EXISTS anomaly_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anomaly_reason TEXT,
  ADD COLUMN IF NOT EXISTS risk_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hash_algo TEXT NOT NULL DEFAULT 'sha256',
  ADD COLUMN IF NOT EXISTS prev_hash TEXT,
  ADD COLUMN IF NOT EXISTS event_hash TEXT,
  ADD COLUMN IF NOT EXISTS hash_verified BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata_ext JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE
  has_entity_type BOOLEAN;
  has_entity_id BOOLEAN;
  has_old_data BOOLEAN;
  has_new_data BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'entity_type'
  ) INTO has_entity_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'entity_id'
  ) INTO has_entity_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'old_data'
  ) INTO has_old_data;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'new_data'
  ) INTO has_new_data;

  EXECUTE format(
    'UPDATE public.audit_logs
     SET
       action_type = COALESCE(action_type, action::text),
       occurred_at_utc = COALESCE(occurred_at_utc, created_at),
       table_name = COALESCE(table_name, %s),
       record_id = COALESCE(record_id, %s),
       old_value = COALESCE(old_value, %s),
       new_value = COALESCE(new_value, %s)
     WHERE action_type IS NULL
        OR occurred_at_utc IS NULL
        OR table_name IS NULL
        OR record_id IS NULL
        OR old_value IS NULL
        OR new_value IS NULL',
    CASE WHEN has_entity_type THEN 'entity_type' ELSE 'table_name' END,
    CASE WHEN has_entity_id THEN 'entity_id' ELSE 'record_id' END,
    CASE WHEN has_old_data THEN 'old_data' ELSE 'old_value' END,
    CASE WHEN has_new_data THEN 'new_data' ELSE 'new_value' END
  );
END $$;

CREATE TABLE IF NOT EXISTS public.audit_log_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT,
  trace_id TEXT,
  event_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retry', 'done', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id UUID REFERENCES public.audit_logs(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  alert_type TEXT NOT NULL,
  alert_message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_name TEXT NOT NULL UNIQUE,
  endpoint_url TEXT NOT NULL,
  secret_ref TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  event_filter TEXT[] NOT NULL DEFAULT '{critical,sensitive,anomaly}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_webhook_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID REFERENCES public.audit_webhook_endpoints(id) ON DELETE CASCADE,
  audit_log_id UUID REFERENCES public.audit_logs(id) ON DELETE CASCADE,
  dispatch_status TEXT NOT NULL DEFAULT 'queued' CHECK (dispatch_status IN ('queued', 'sent', 'failed')),
  response_code INTEGER,
  response_body TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.audit_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id UUID REFERENCES public.audit_logs(id) ON DELETE CASCADE,
  viewed_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (audit_log_id, viewed_by)
);

CREATE TABLE IF NOT EXISTS public.audit_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL UNIQUE,
  hot_days INTEGER NOT NULL DEFAULT 90,
  cold_days INTEGER NOT NULL DEFAULT 730,
  archive_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_delete_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.audit_retention_policies(scope_key, hot_days, cold_days, archive_enabled, auto_delete_enabled)
VALUES ('default', 90, 730, true, false)
ON CONFLICT (scope_key) DO UPDATE SET
  hot_days = EXCLUDED.hot_days,
  cold_days = EXCLUDED.cold_days,
  archive_enabled = EXCLUDED.archive_enabled,
  auto_delete_enabled = EXCLUDED.auto_delete_enabled,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.audit_clock_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_name TEXT NOT NULL,
  offset_ms NUMERIC(12,4) NOT NULL,
  drift_status TEXT NOT NULL CHECK (drift_status IN ('in_sync', 'drift', 'critical')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.audit_mask_sensitive(input_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  k TEXT;
  v JSONB;
  out_json JSONB := '{}'::jsonb;
BEGIN
  IF input_data IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(input_data) <> 'object' THEN
    RETURN input_data;
  END IF;

  FOR k, v IN SELECT key, value FROM jsonb_each(input_data)
  LOOP
    IF lower(k) ~ '(password|token|secret|api[_-]?key|card|cvv|pin|authorization)' THEN
      out_json := out_json || jsonb_build_object(k, '***masked***');
    ELSIF jsonb_typeof(v) = 'object' THEN
      out_json := out_json || jsonb_build_object(k, public.audit_mask_sensitive(v));
    ELSE
      out_json := out_json || jsonb_build_object(k, v);
    END IF;
  END LOOP;

  RETURN out_json;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_json_diff(oldj JSONB, newj JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  k TEXT;
  oldv JSONB;
  newv JSONB;
  result JSONB := '{}'::jsonb;
BEGIN
  oldj := COALESCE(oldj, '{}'::jsonb);
  newj := COALESCE(newj, '{}'::jsonb);

  FOR k IN
    SELECT key FROM (
      SELECT jsonb_object_keys(oldj) AS key
      UNION
      SELECT jsonb_object_keys(newj) AS key
    ) s
  LOOP
    oldv := oldj -> k;
    newv := newj -> k;
    IF oldv IS DISTINCT FROM newv THEN
      result := result || jsonb_build_object(k, jsonb_build_object('before', oldv, 'after', newv));
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_logs_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  last_hash TEXT;
  base_payload TEXT;
BEGIN
  NEW.occurred_at_utc := COALESCE(NEW.occurred_at_utc, now());
  NEW.action_type := COALESCE(NEW.action_type, NEW.action::text, 'unknown');
  NEW.request_id := COALESCE(NEW.request_id, gen_random_uuid()::text);
  NEW.trace_id := COALESCE(NEW.trace_id, NEW.request_id);
  NEW.chain_id := COALESCE(NEW.chain_id, NEW.trace_id);
  NEW.timezone_name := COALESCE(NEW.timezone_name, 'UTC');
  NEW.occurred_at_local := COALESCE(NEW.occurred_at_local, to_char(NEW.occurred_at_utc AT TIME ZONE NEW.timezone_name, 'YYYY-MM-DD"T"HH24:MI:SS'));

  NEW.old_value := COALESCE(NEW.old_value, NEW.old_data);
  NEW.new_value := COALESCE(NEW.new_value, NEW.new_data);
  NEW.old_value := public.audit_mask_sensitive(NEW.old_value);
  NEW.new_value := public.audit_mask_sensitive(NEW.new_value);
  NEW.request_payload := public.audit_mask_sensitive(NEW.request_payload);
  NEW.response_payload := public.audit_mask_sensitive(NEW.response_payload);

  NEW.diff_value := COALESCE(NEW.diff_value, public.audit_json_diff(NEW.old_value, NEW.new_value));

  NEW.is_sensitive_action := COALESCE(
    NEW.is_sensitive_action,
    NEW.action_type ILIKE '%delete%'
    OR NEW.action_type ILIKE '%payment%'
    OR NEW.action_type ILIKE '%permission%'
    OR NEW.action_type ILIKE '%role%'
    OR NEW.action_type ILIKE '%revoke%'
  );

  SELECT event_hash INTO last_hash
  FROM public.audit_logs
  ORDER BY occurred_at_utc DESC, created_at DESC
  LIMIT 1;

  NEW.prev_hash := COALESCE(NEW.prev_hash, last_hash);

  base_payload := COALESCE(NEW.prev_hash, '') || '|' ||
    COALESCE(NEW.user_id::text, '') || '|' ||
    COALESCE(NEW.role_name, '') || '|' ||
    COALESCE(NEW.action_type, '') || '|' ||
    COALESCE(NEW.table_name, '') || '|' ||
    COALESCE(NEW.record_id, '') || '|' ||
    COALESCE(NEW.request_id, '') || '|' ||
    COALESCE(NEW.trace_id, '') || '|' ||
    COALESCE(NEW.occurred_at_utc::text, '') || '|' ||
    COALESCE(NEW.old_value::text, '') || '|' ||
    COALESCE(NEW.new_value::text, '');

  NEW.event_hash := COALESCE(NEW.event_hash, encode(digest(base_payload, 'sha256'), 'hex'));

  IF NEW.risk_score = 0 THEN
    NEW.risk_score := CASE
      WHEN NEW.is_sensitive_action THEN 0.8
      WHEN NEW.response_status >= 500 THEN 0.9
      ELSE 0.2
    END;
  END IF;

  IF NEW.anomaly_score = 0 THEN
    NEW.anomaly_score := CASE
      WHEN NEW.latency_ms > 5000 THEN 0.7
      WHEN NEW.response_status >= 500 THEN 0.9
      ELSE 0.1
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_before_insert ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_before_insert
BEFORE INSERT ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.audit_logs_before_insert();

CREATE OR REPLACE FUNCTION public.audit_logs_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is immutable: update/delete is not allowed';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_block_update ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_block_update
BEFORE UPDATE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.audit_logs_block_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_block_delete ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_block_delete
BEFORE DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.audit_logs_block_mutation();

CREATE OR REPLACE FUNCTION public.audit_logs_after_insert_alerts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  recent_count INT;
BEGIN
  IF NEW.is_sensitive_action THEN
    INSERT INTO public.audit_anomaly_alerts(audit_log_id, severity, alert_type, alert_message, payload)
    VALUES (NEW.id, 'warning', 'sensitive_action', 'Sensitive action detected', jsonb_build_object('action', NEW.action_type, 'table', NEW.table_name));
  END IF;

  IF NEW.response_status IS NOT NULL AND NEW.response_status >= 500 THEN
    INSERT INTO public.audit_anomaly_alerts(audit_log_id, severity, alert_type, alert_message, payload)
    VALUES (NEW.id, 'critical', 'system_error', 'Audit captured server-side failure', jsonb_build_object('status', NEW.response_status, 'path', NEW.api_path));
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM public.audit_logs
  WHERE user_id = NEW.user_id
    AND occurred_at_utc >= now() - interval '2 minutes';

  IF recent_count > 120 THEN
    INSERT INTO public.audit_anomaly_alerts(audit_log_id, severity, alert_type, alert_message, payload)
    VALUES (NEW.id, 'critical', 'high_frequency_activity', 'High-frequency activity detected for user', jsonb_build_object('count_2m', recent_count));
  END IF;

  IF NEW.anomaly_score >= 0.85 THEN
    INSERT INTO public.audit_anomaly_alerts(audit_log_id, severity, alert_type, alert_message, payload)
    VALUES (NEW.id, 'critical', 'anomaly_score', 'High anomaly score detected', jsonb_build_object('anomaly_score', NEW.anomaly_score, 'reason', NEW.anomaly_reason));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_after_insert_alerts ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_after_insert_alerts
AFTER INSERT ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.audit_logs_after_insert_alerts();

CREATE OR REPLACE FUNCTION public.audit_mark_read(p_audit_log_id UUID, p_viewed_by UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.audit_read_receipts(audit_log_id, viewed_by)
  VALUES (p_audit_log_id, p_viewed_by)
  ON CONFLICT (audit_log_id, viewed_by) DO NOTHING;

  UPDATE public.audit_logs
  SET
    read_count = read_count + 1,
    first_read_at = COALESCE(first_read_at, now()),
    last_read_at = now()
  WHERE id = p_audit_log_id;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_request_trace ON public.audit_logs(trace_id, request_id, occurred_at_utc DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON public.audit_logs(session_id, occurred_at_utc DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_table_time ON public.audit_logs(action_type, table_name, occurred_at_utc DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_sensitive ON public.audit_logs(is_sensitive_action, occurred_at_utc DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_anomaly ON public.audit_logs(anomaly_score DESC, occurred_at_utc DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hash ON public.audit_logs(event_hash, prev_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_bulk_group ON public.audit_logs(bulk_group_id, occurred_at_utc DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_queue_status_retry ON public.audit_log_queue(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_audit_anomaly_alerts_open ON public.audit_anomaly_alerts(resolved, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_read_receipts_user_time ON public.audit_read_receipts(viewed_by, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_search_text
  ON public.audit_logs
  USING GIN (to_tsvector('simple',
    COALESCE(action_type, '') || ' ' ||
    COALESCE(table_name, '') || ' ' ||
    COALESCE(record_id::text, '') || ' ' ||
    COALESCE(ip_country, '') || ' ' ||
    COALESCE(ip_city, '') || ' ' ||
    COALESCE(api_path, '')
  ));

ALTER TABLE public.audit_log_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_anomaly_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_webhook_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_clock_sync_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access audit_log_queue" ON public.audit_log_queue;
CREATE POLICY "Super admin full access audit_log_queue" ON public.audit_log_queue
FOR ALL USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access audit_anomaly_alerts" ON public.audit_anomaly_alerts;
CREATE POLICY "Super admin full access audit_anomaly_alerts" ON public.audit_anomaly_alerts
FOR ALL USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access audit_webhook_endpoints" ON public.audit_webhook_endpoints;
CREATE POLICY "Super admin full access audit_webhook_endpoints" ON public.audit_webhook_endpoints
FOR ALL USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access audit_webhook_dispatches" ON public.audit_webhook_dispatches;
CREATE POLICY "Super admin full access audit_webhook_dispatches" ON public.audit_webhook_dispatches
FOR ALL USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access audit_read_receipts" ON public.audit_read_receipts;
CREATE POLICY "Super admin full access audit_read_receipts" ON public.audit_read_receipts
FOR ALL USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access audit_retention_policies" ON public.audit_retention_policies;
CREATE POLICY "Super admin full access audit_retention_policies" ON public.audit_retention_policies
FOR ALL USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access audit_clock_sync_events" ON public.audit_clock_sync_events;
CREATE POLICY "Super admin full access audit_clock_sync_events" ON public.audit_clock_sync_events
FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- Existing audit_logs table may carry broader historical policies; keep super-admin full access policy ensured.
DROP POLICY IF EXISTS "Super admin full access audit_logs" ON public.audit_logs;
CREATE POLICY "Super admin full access audit_logs" ON public.audit_logs
FOR ALL USING (has_role(auth.uid(), 'super_admin'));