-- Runtime tables for VALA Builder pipeline orchestration

CREATE TABLE IF NOT EXISTS public.vala_builder_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name TEXT NOT NULL,
  app_description TEXT NOT NULL,
  app_slug TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'create_app',
    'clone_software',
    'generate_ui',
    'generate_backend',
    'fix_errors',
    'build_project',
    'deploy_demo',
    'publish_marketplace'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'fail')),
  current_step TEXT,
  selected_server_id UUID REFERENCES public.servers(id) ON DELETE SET NULL,
  source_ref TEXT,
  github_repo_url TEXT,
  demo_url TEXT,
  apk_build_queue_id UUID REFERENCES public.apk_build_queue(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_primary TEXT NOT NULL DEFAULT 'openai',
  model_fallbacks JSONB NOT NULL DEFAULT '["gemini","claude"]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vala_builder_runs_requested_by_created
  ON public.vala_builder_runs(requested_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vala_builder_runs_status_created
  ON public.vala_builder_runs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vala_builder_step_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.vala_builder_runs(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  step_order INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'fail')),
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vala_builder_step_logs_run_step
  ON public.vala_builder_step_logs(run_id, step_order, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vala_builder_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.vala_builder_runs(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN (
    'plan',
    'ui',
    'code',
    'db_schema',
    'api_schema',
    'debug_report',
    'fix_report',
    'build_report',
    'deploy_report',
    'marketplace_report'
  )),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vala_builder_artifacts_run_type
  ON public.vala_builder_artifacts(run_id, artifact_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vala_builder_generated_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.vala_builder_runs(id) ON DELETE CASCADE,
  app_slug TEXT NOT NULL,
  route_path TEXT NOT NULL,
  method TEXT NOT NULL,
  is_protected BOOLEAN NOT NULL DEFAULT TRUE,
  module_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id, route_path, method)
);

CREATE INDEX IF NOT EXISTS idx_vala_builder_generated_routes_slug
  ON public.vala_builder_generated_routes(app_slug, created_at DESC);

ALTER TABLE public.vala_builder_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vala_builder_step_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vala_builder_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vala_builder_generated_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own vala_builder_runs" ON public.vala_builder_runs;
CREATE POLICY "Users manage own vala_builder_runs"
  ON public.vala_builder_runs
  FOR ALL
  USING (requested_by = auth.uid())
  WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "Users view own vala_builder_step_logs" ON public.vala_builder_step_logs;
CREATE POLICY "Users view own vala_builder_step_logs"
  ON public.vala_builder_step_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.vala_builder_runs r
      WHERE r.id = run_id
        AND r.requested_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role writes vala_builder_step_logs" ON public.vala_builder_step_logs;
CREATE POLICY "Service role writes vala_builder_step_logs"
  ON public.vala_builder_step_logs
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own vala_builder_artifacts" ON public.vala_builder_artifacts;
CREATE POLICY "Users view own vala_builder_artifacts"
  ON public.vala_builder_artifacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.vala_builder_runs r
      WHERE r.id = run_id
        AND r.requested_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role writes vala_builder_artifacts" ON public.vala_builder_artifacts;
CREATE POLICY "Service role writes vala_builder_artifacts"
  ON public.vala_builder_artifacts
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own vala_builder_generated_routes" ON public.vala_builder_generated_routes;
CREATE POLICY "Users view own vala_builder_generated_routes"
  ON public.vala_builder_generated_routes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.vala_builder_runs r
      WHERE r.id = run_id
        AND r.requested_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role writes vala_builder_generated_routes" ON public.vala_builder_generated_routes;
CREATE POLICY "Service role writes vala_builder_generated_routes"
  ON public.vala_builder_generated_routes
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.builder_generate_dynamic_schema(
  p_app_slug TEXT,
  p_modules JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
  v_users_table TEXT;
  v_roles_table TEXT;
  v_modules_table TEXT;
BEGIN
  v_slug := regexp_replace(lower(coalesce(p_app_slug, '')), '[^a-z0-9_]+', '_', 'g');
  v_slug := regexp_replace(v_slug, '^_+|_+$', '', 'g');

  IF v_slug = '' THEN
    RAISE EXCEPTION 'Invalid app slug';
  END IF;

  v_users_table := v_slug || '_users';
  v_roles_table := v_slug || '_roles';
  v_modules_table := v_slug || '_modules';

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS public.%I (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      role_key TEXT NOT NULL UNIQUE,
      role_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  ', v_roles_table);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS public.%I (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      full_name TEXT,
      role_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT ''active'',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  ', v_users_table);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS public.%I (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_key TEXT NOT NULL UNIQUE,
      module_name TEXT NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT true,
      meta JSONB NOT NULL DEFAULT ''{}''::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  ', v_modules_table);

  IF jsonb_typeof(p_modules) = 'array' THEN
    EXECUTE format('DELETE FROM public.%I', v_modules_table);
    EXECUTE format(
      'INSERT INTO public.%I (module_key, module_name, meta)
       SELECT
         COALESCE(regexp_replace(lower(value->>''name''), ''[^a-z0-9_]+'', ''_'', ''g''), ''module_'' || row_number() over ()) AS module_key,
         COALESCE(value->>''name'', ''Module'') AS module_name,
         value
       FROM jsonb_array_elements($1) AS value',
      v_modules_table
    ) USING p_modules;
  END IF;

  RETURN jsonb_build_object(
    'slug', v_slug,
    'users_table', v_users_table,
    'roles_table', v_roles_table,
    'modules_table', v_modules_table
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.builder_generate_dynamic_schema(TEXT, JSONB) TO authenticated;
