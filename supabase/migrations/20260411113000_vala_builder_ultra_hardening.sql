-- Ultra hardening for VALA Builder runtime

-- 1) Extend run metadata for deterministic execution, retries, priority, locking, environments.
ALTER TABLE public.vala_builder_runs
  ADD COLUMN IF NOT EXISTS project_key TEXT,
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'staging',
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS step_timeout_seconds INT NOT NULL DEFAULT 600,
  ADD COLUMN IF NOT EXISTS resume_from_step TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS deterministic_hash TEXT,
  ADD COLUMN IF NOT EXISTS prompt_normalized TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS build_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS db_schema_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS run_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS build_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lock_token UUID,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS safe_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fallback_server_id UUID REFERENCES public.servers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.vala_builder_runs
    ADD CONSTRAINT vala_builder_runs_environment_chk
    CHECK (environment IN ('dev', 'staging', 'production'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.vala_builder_runs
    ADD CONSTRAINT vala_builder_runs_priority_chk
    CHECK (priority BETWEEN 1 AND 10);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.vala_builder_runs
    ADD CONSTRAINT vala_builder_runs_timeout_chk
    CHECK (step_timeout_seconds BETWEEN 30 AND 3600);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.vala_builder_runs
SET project_key = COALESCE(project_key, app_slug)
WHERE project_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_vala_builder_runs_priority_queue
  ON public.vala_builder_runs(status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_vala_builder_runs_project_status
  ON public.vala_builder_runs(project_key, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vala_builder_runs_correlation
  ON public.vala_builder_runs(correlation_id);

-- 2) Step state (checkpoint table) for resume/retry and dependency enforcement.
CREATE TABLE IF NOT EXISTS public.vala_builder_step_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.vala_builder_runs(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'fail', 'skipped')),
  attempts INT NOT NULL DEFAULT 0,
  output_hash TEXT,
  error_type TEXT,
  error_code TEXT,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_vala_builder_step_state_run
  ON public.vala_builder_step_state(run_id, status, updated_at DESC);

ALTER TABLE public.vala_builder_step_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own vala_builder_step_state" ON public.vala_builder_step_state;
CREATE POLICY "Users view own vala_builder_step_state"
  ON public.vala_builder_step_state
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.vala_builder_runs r
      WHERE r.id = run_id
        AND r.requested_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages vala_builder_step_state" ON public.vala_builder_step_state;
CREATE POLICY "Service role manages vala_builder_step_state"
  ON public.vala_builder_step_state
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3) Versioning and project history.
CREATE TABLE IF NOT EXISTS public.vala_builder_project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key TEXT NOT NULL,
  run_id UUID REFERENCES public.vala_builder_runs(id) ON DELETE SET NULL,
  build_version TEXT NOT NULL,
  db_schema_version TEXT NOT NULL,
  apk_build_queue_id UUID REFERENCES public.apk_build_queue(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  code_hash TEXT,
  schema_hash TEXT,
  deploy_url TEXT,
  rollback_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_key, build_version)
);

CREATE INDEX IF NOT EXISTS idx_vala_builder_project_versions_project
  ON public.vala_builder_project_versions(project_key, created_at DESC);

ALTER TABLE public.vala_builder_project_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own vala_builder_project_versions" ON public.vala_builder_project_versions;
CREATE POLICY "Users view own vala_builder_project_versions"
  ON public.vala_builder_project_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.vala_builder_runs r
      WHERE r.id = run_id
        AND r.requested_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages vala_builder_project_versions" ON public.vala_builder_project_versions;
CREATE POLICY "Service role manages vala_builder_project_versions"
  ON public.vala_builder_project_versions
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.vala_builder_project_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key TEXT NOT NULL,
  run_id UUID REFERENCES public.vala_builder_runs(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vala_builder_project_history_project
  ON public.vala_builder_project_history(project_key, created_at DESC);

ALTER TABLE public.vala_builder_project_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own vala_builder_project_history" ON public.vala_builder_project_history;
CREATE POLICY "Users view own vala_builder_project_history"
  ON public.vala_builder_project_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.vala_builder_runs r
      WHERE r.id = run_id
        AND r.requested_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages vala_builder_project_history" ON public.vala_builder_project_history;
CREATE POLICY "Service role manages vala_builder_project_history"
  ON public.vala_builder_project_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4) Environment/project config isolation.
CREATE TABLE IF NOT EXISTS public.vala_builder_project_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('dev', 'staging', 'production')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_key, environment)
);

CREATE INDEX IF NOT EXISTS idx_vala_builder_project_configs_project
  ON public.vala_builder_project_configs(project_key, environment);

ALTER TABLE public.vala_builder_project_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own vala_builder_project_configs" ON public.vala_builder_project_configs;
CREATE POLICY "Users view own vala_builder_project_configs"
  ON public.vala_builder_project_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.vala_builder_runs r
      WHERE r.project_key = project_key
        AND r.requested_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages vala_builder_project_configs" ON public.vala_builder_project_configs;
CREATE POLICY "Service role manages vala_builder_project_configs"
  ON public.vala_builder_project_configs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5) Templates and plugins.
CREATE TABLE IF NOT EXISTS public.vala_builder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL,
  description TEXT,
  default_prompt TEXT NOT NULL,
  default_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.vala_builder_templates (template_key, template_name, description, default_prompt, default_modules)
VALUES
  ('erp', 'ERP Template', 'Enterprise resource planning baseline', 'Generate an ERP with admin dashboard, inventory, HR, accounting, and reports', '["admin","inventory","hr","accounting","reports"]'::jsonb),
  ('crm', 'CRM Template', 'Customer relationship management baseline', 'Generate a CRM with leads, pipeline, activities, and automation', '["admin","leads","pipeline","activities","automation"]'::jsonb),
  ('booking', 'Booking Template', 'Booking and scheduling baseline', 'Generate a booking platform with slots, payments, reminders, and dashboards', '["admin","scheduling","payments","reminders","analytics"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.vala_builder_plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_key TEXT NOT NULL UNIQUE,
  plugin_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6) Secret refs (vault pointers only; no plaintext values).
CREATE TABLE IF NOT EXISTS public.vala_builder_secret_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  ref_path TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vala_builder_secret_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct reads vala_builder_secret_refs" ON public.vala_builder_secret_refs;
CREATE POLICY "No direct reads vala_builder_secret_refs"
  ON public.vala_builder_secret_refs
  FOR SELECT
  USING (false);

DROP POLICY IF EXISTS "Service role manages vala_builder_secret_refs" ON public.vala_builder_secret_refs;
CREATE POLICY "Service role manages vala_builder_secret_refs"
  ON public.vala_builder_secret_refs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7) Event bus and dead-letter queue.
CREATE TABLE IF NOT EXISTS public.vala_builder_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.vala_builder_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vala_builder_events_run
  ON public.vala_builder_events(run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vala_builder_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.vala_builder_runs(id) ON DELETE SET NULL,
  step_key TEXT,
  error_type TEXT,
  error_code TEXT,
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vala_builder_dlq_created
  ON public.vala_builder_dead_letter_queue(created_at DESC);

-- 8) Helpers
CREATE OR REPLACE FUNCTION public.builder_next_version(p_current TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_clean TEXT;
  v_major INT;
  v_minor INT;
BEGIN
  v_clean := regexp_replace(COALESCE(p_current, 'v1'), '^v', '', 'g');

  IF position('.' in v_clean) > 0 THEN
    v_major := split_part(v_clean, '.', 1)::INT;
    v_minor := split_part(v_clean, '.', 2)::INT;
    v_minor := v_minor + 1;
    RETURN format('v%s.%s', v_major, v_minor);
  END IF;

  v_major := COALESCE(NULLIF(v_clean, '')::INT, 1) + 1;
  RETURN format('v%s', v_major);
EXCEPTION WHEN OTHERS THEN
  RETURN 'v1';
END;
$$;

GRANT EXECUTE ON FUNCTION public.builder_next_version(TEXT) TO authenticated;
