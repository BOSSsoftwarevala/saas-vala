-- Vala Builder runtime additions: missing RLS, APK tracking, cost tracking, and queue automation

-- 1) RLS for vala_builder_events (missing from ultra hardening migration)
ALTER TABLE public.vala_builder_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own vala_builder_events" ON public.vala_builder_events;
CREATE POLICY "Users view own vala_builder_events"
  ON public.vala_builder_events
  FOR SELECT
  USING (
    run_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.vala_builder_runs r
      WHERE r.id = run_id AND r.requested_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages vala_builder_events" ON public.vala_builder_events;
CREATE POLICY "Service role manages vala_builder_events"
  ON public.vala_builder_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2) RLS for vala_builder_dead_letter_queue
ALTER TABLE public.vala_builder_dead_letter_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view vala_builder_dead_letter_queue" ON public.vala_builder_dead_letter_queue;
CREATE POLICY "Admins view vala_builder_dead_letter_queue"
  ON public.vala_builder_dead_letter_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin', 'support')
    )
  );

DROP POLICY IF EXISTS "Service role manages vala_builder_dead_letter_queue" ON public.vala_builder_dead_letter_queue;
CREATE POLICY "Service role manages vala_builder_dead_letter_queue"
  ON public.vala_builder_dead_letter_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3) RLS for vala_builder_plugins (open reads, service role writes)
ALTER TABLE public.vala_builder_plugins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read vala_builder_plugins" ON public.vala_builder_plugins;
CREATE POLICY "Authenticated read vala_builder_plugins"
  ON public.vala_builder_plugins
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role manages vala_builder_plugins" ON public.vala_builder_plugins;
CREATE POLICY "Service role manages vala_builder_plugins"
  ON public.vala_builder_plugins
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4) RLS for vala_builder_templates (public read, service write)
ALTER TABLE public.vala_builder_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read vala_builder_templates" ON public.vala_builder_templates;
CREATE POLICY "Authenticated read vala_builder_templates"
  ON public.vala_builder_templates
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

DROP POLICY IF EXISTS "Service role manages vala_builder_templates" ON public.vala_builder_templates;
CREATE POLICY "Service role manages vala_builder_templates"
  ON public.vala_builder_templates
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5) Add APK artifact tracking columns to runs (if missing)
ALTER TABLE public.vala_builder_runs
  ADD COLUMN IF NOT EXISTS apk_status TEXT CHECK (apk_status IN ('none', 'queued', 'building', 'success', 'fail')) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS apk_url TEXT,
  ADD COLUMN IF NOT EXISTS apk_version TEXT,
  ADD COLUMN IF NOT EXISTS ai_provider_primary TEXT DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS ai_provider_used TEXT,
  ADD COLUMN IF NOT EXISTS plan_hash TEXT,
  ADD COLUMN IF NOT EXISTS run_started_at TIMESTAMPTZ;

-- 6) Add step-level timing and cost to step logs
ALTER TABLE public.vala_builder_step_logs
  ADD COLUMN IF NOT EXISTS ai_provider TEXT,
  ADD COLUMN IF NOT EXISTS tokens_used INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS step_cost_usd NUMERIC(12,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_ms INT;

-- 7) Add index on project_key for project-scoped queries
CREATE INDEX IF NOT EXISTS idx_vala_builder_runs_project_key
  ON public.vala_builder_runs(project_key, created_at DESC)
  WHERE project_key IS NOT NULL;

-- 8) Queue monitoring view for admins
CREATE OR REPLACE VIEW public.vala_builder_queue_stats AS
SELECT
  status,
  environment,
  COUNT(*) AS run_count,
  AVG(priority) AS avg_priority,
  MIN(created_at) AS oldest_queued,
  MAX(created_at) AS newest_queued
FROM public.vala_builder_runs
WHERE status IN ('pending','running')
GROUP BY status, environment;

GRANT SELECT ON public.vala_builder_queue_stats TO authenticated;

-- 9) Project summary view for frontend status display
CREATE OR REPLACE VIEW public.vala_builder_project_summary AS
SELECT
  project_key,
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE status = 'success') AS successful_runs,
  COUNT(*) FILTER (WHERE status = 'fail') AS failed_runs,
  COUNT(*) FILTER (WHERE status IN ('pending','running')) AS active_runs,
  MAX(completed_at) AS last_completed,
  MAX(demo_url) AS latest_demo_url,
  MAX(github_repo_url) AS latest_repo_url,
  MAX(product_id::text) AS latest_product_id,
  requested_by
FROM public.vala_builder_runs
GROUP BY project_key, requested_by;

GRANT SELECT ON public.vala_builder_project_summary TO authenticated;

-- 10) Function: get pending queue for worker (priority-ordered, per-project isolation)
CREATE OR REPLACE FUNCTION public.builder_dequeue(
  p_limit INT DEFAULT 3,
  p_exclude_projects TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS SETOF public.vala_builder_runs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.vala_builder_runs
  WHERE status = 'pending'
    AND (cancelled_at IS NULL)
    AND (
      ARRAY_LENGTH(p_exclude_projects, 1) IS NULL
      OR COALESCE(project_key, app_slug) != ALL(p_exclude_projects)
    )
  ORDER BY priority ASC, created_at ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.builder_dequeue(INT, TEXT[]) TO service_role;

-- 11) pg_cron auto-queue runner (runs every 2 minutes if pg_cron extension available)
DO $cron$
BEGIN
  -- Only schedule if pg_cron is installed
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'vala-builder-queue-runner',
      '*/2 * * * *',
      $$
        SELECT net.http_post(
          url := current_setting('app.supabase_url') || '/functions/v1/vala-builder-orchestrator',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
          ),
          body := '{"operation":"trigger_worker","limit":3}'::jsonb
        ) AS request_id;
      $$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not available; queue processed via manual trigger_worker operations
  NULL;
END $cron$;
