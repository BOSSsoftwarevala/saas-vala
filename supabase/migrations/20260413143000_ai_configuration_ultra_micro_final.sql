-- AI Configuration Ultra Micro Final
-- Adds advanced AI routing, failover, cost/speed controls, memory/learning, health, rate-limit, role access, and control-panel data tables.

ALTER TABLE public.ai_provider_configs
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC(8,4) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supports_fast_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_quality_mode BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_api_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_api_key_ref TEXT;

ALTER TABLE public.ai_provider_configs
  DROP CONSTRAINT IF EXISTS ai_provider_configs_provider_check;

ALTER TABLE public.ai_provider_configs
  ADD CONSTRAINT ai_provider_configs_provider_check
  CHECK (provider IN ('openai', 'gemini', 'claude', 'custom_api'));

INSERT INTO public.ai_provider_configs (
  provider, is_enabled, priority_order, speed_score, cost_score, quality_score, health_status, supports_fast_mode, supports_quality_mode
)
VALUES
  ('custom_api', false, 4, 0.70, 0.50, 0.80, 'healthy', false, true)
ON CONFLICT (provider) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  priority_order = EXCLUDED.priority_order,
  speed_score = EXCLUDED.speed_score,
  cost_score = EXCLUDED.cost_score,
  quality_score = EXCLUDED.quality_score,
  health_status = EXCLUDED.health_status,
  supports_fast_mode = EXCLUDED.supports_fast_mode,
  supports_quality_mode = EXCLUDED.supports_quality_mode,
  updated_at = now();

UPDATE public.ai_provider_configs
SET supports_fast_mode = true,
    quality_score = GREATEST(quality_score, 0.90)
WHERE provider = 'gemini';

UPDATE public.ai_provider_configs
SET supports_quality_mode = true,
    quality_score = GREATEST(quality_score, 0.95)
WHERE provider IN ('openai', 'claude');

ALTER TABLE public.ai_task_model_routing
  DROP CONSTRAINT IF EXISTS ai_task_model_routing_task_type_check;

ALTER TABLE public.ai_task_model_routing
  DROP CONSTRAINT IF EXISTS ai_task_model_routing_primary_provider_check;

ALTER TABLE public.ai_task_model_routing
  ADD CONSTRAINT ai_task_model_routing_task_type_check
  CHECK (task_type IN (
    'content', 'seo', 'analysis', 'fast_task',
    'meta_tags', 'blog', 'keyword_analysis', 'lead_scoring', 'ads_copy',
    'image_generation', 'video_generation'
  ));

ALTER TABLE public.ai_task_model_routing
  ADD CONSTRAINT ai_task_model_routing_primary_provider_check
  CHECK (primary_provider IN ('openai', 'gemini', 'claude', 'custom_api'));

INSERT INTO public.ai_task_model_routing (task_type, primary_provider, fallback_providers)
VALUES
  ('fast_task', 'gemini', ARRAY['openai', 'claude']),
  ('meta_tags', 'gemini', ARRAY['openai', 'claude']),
  ('blog', 'openai', ARRAY['claude', 'gemini']),
  ('keyword_analysis', 'gemini', ARRAY['claude', 'openai']),
  ('lead_scoring', 'claude', ARRAY['openai', 'gemini']),
  ('ads_copy', 'openai', ARRAY['claude', 'gemini']),
  ('image_generation', 'openai', ARRAY['gemini', 'claude']),
  ('video_generation', 'openai', ARRAY['gemini', 'claude'])
ON CONFLICT (task_type) DO UPDATE SET
  primary_provider = EXCLUDED.primary_provider,
  fallback_providers = EXCLUDED.fallback_providers,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.ai_model_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'gemini', 'claude', 'custom_api')),
  model_key TEXT NOT NULL UNIQUE,
  model_family TEXT NOT NULL CHECK (model_family IN ('flash', 'standard', 'quality', 'custom')),
  input_cost_per_1k NUMERIC(12,6) NOT NULL DEFAULT 0,
  output_cost_per_1k NUMERIC(12,6) NOT NULL DEFAULT 0,
  max_context_tokens INTEGER NOT NULL DEFAULT 8192,
  is_active BOOLEAN NOT NULL DEFAULT true,
  release_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ai_model_catalog (provider, model_key, model_family, input_cost_per_1k, output_cost_per_1k, max_context_tokens, is_active, release_date)
VALUES
  ('gemini', 'gemini-2.0-flash', 'flash', 0.00010, 0.00040, 1048576, true, CURRENT_DATE - INTERVAL '30 days'),
  ('gemini', 'gemini-1.5-pro', 'quality', 0.00125, 0.00500, 1048576, true, CURRENT_DATE - INTERVAL '120 days'),
  ('openai', 'gpt-4o-mini', 'standard', 0.00015, 0.00060, 128000, true, CURRENT_DATE - INTERVAL '90 days'),
  ('openai', 'gpt-4.1', 'quality', 0.00500, 0.01500, 128000, true, CURRENT_DATE - INTERVAL '15 days'),
  ('claude', 'claude-3-5-haiku', 'standard', 0.00080, 0.00400, 200000, true, CURRENT_DATE - INTERVAL '80 days')
ON CONFLICT (model_key) DO UPDATE SET
  provider = EXCLUDED.provider,
  model_family = EXCLUDED.model_family,
  input_cost_per_1k = EXCLUDED.input_cost_per_1k,
  output_cost_per_1k = EXCLUDED.output_cost_per_1k,
  max_context_tokens = EXCLUDED.max_context_tokens,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.ai_task_execution_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key TEXT NOT NULL UNIQUE,
  module_name TEXT NOT NULL,
  default_mode TEXT NOT NULL DEFAULT 'balanced' CHECK (default_mode IN ('fast', 'balanced', 'quality', 'cheap')),
  preferred_provider TEXT NOT NULL CHECK (preferred_provider IN ('openai', 'gemini', 'claude', 'custom_api')),
  fallback_providers TEXT[] NOT NULL DEFAULT '{}'::text[],
  preferred_model_key TEXT,
  min_quality_score NUMERIC(8,4) NOT NULL DEFAULT 0.70,
  max_cost_per_request NUMERIC(12,6) NOT NULL DEFAULT 0.050000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ai_task_execution_map (
  task_key, module_name, default_mode, preferred_provider, fallback_providers, preferred_model_key, min_quality_score, max_cost_per_request, is_active
)
VALUES
  ('seo', 'seo_engine', 'balanced', 'gemini', ARRAY['openai', 'claude'], 'gemini-1.5-pro', 0.85, 0.020000, true),
  ('content', 'content_engine', 'quality', 'openai', ARRAY['claude', 'gemini'], 'gpt-4.1', 0.90, 0.040000, true),
  ('analysis', 'analysis_engine', 'quality', 'claude', ARRAY['openai', 'gemini'], 'claude-3-5-haiku', 0.92, 0.030000, true),
  ('fast_task', 'ops_engine', 'fast', 'gemini', ARRAY['openai', 'claude'], 'gemini-2.0-flash', 0.70, 0.010000, true),
  ('meta_tags', 'seo_engine', 'fast', 'gemini', ARRAY['openai', 'claude'], 'gemini-2.0-flash', 0.75, 0.010000, true),
  ('blog', 'content_engine', 'quality', 'openai', ARRAY['claude', 'gemini'], 'gpt-4.1', 0.90, 0.050000, true),
  ('keyword_analysis', 'seo_engine', 'balanced', 'gemini', ARRAY['claude', 'openai'], 'gemini-1.5-pro', 0.85, 0.025000, true),
  ('lead_scoring', 'lead_engine', 'quality', 'claude', ARRAY['openai', 'gemini'], 'claude-3-5-haiku', 0.90, 0.030000, true),
  ('ads_copy', 'ads_engine', 'quality', 'openai', ARRAY['claude', 'gemini'], 'gpt-4o-mini', 0.86, 0.025000, true)
ON CONFLICT (task_key) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  default_mode = EXCLUDED.default_mode,
  preferred_provider = EXCLUDED.preferred_provider,
  fallback_providers = EXCLUDED.fallback_providers,
  preferred_model_key = EXCLUDED.preferred_model_key,
  min_quality_score = EXCLUDED.min_quality_score,
  max_cost_per_request = EXCLUDED.max_cost_per_request,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.ai_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key TEXT NOT NULL,
  module_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_key TEXT,
  request_mode TEXT NOT NULL DEFAULT 'balanced' CHECK (request_mode IN ('fast', 'balanced', 'quality', 'cheap')),
  actor_role TEXT NOT NULL DEFAULT 'system',
  success BOOLEAN NOT NULL DEFAULT true,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(12,6) NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_dynamic_prompt_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  language_code TEXT NOT NULL,
  product_type TEXT NOT NULL,
  task_key TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, language_code, product_type, task_key)
);

CREATE TABLE IF NOT EXISTS public.ai_context_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  niche TEXT NOT NULL,
  language_code TEXT,
  previous_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  best_performing_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, niche)
);

CREATE TABLE IF NOT EXISTS public.ai_learning_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  ranking_delta NUMERIC(10,4) NOT NULL DEFAULT 0,
  conversion_delta NUMERIC(10,4) NOT NULL DEFAULT 0,
  performance_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  insight_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_api_health_monitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model_key TEXT,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  uptime_percent NUMERIC(8,4) NOT NULL DEFAULT 100,
  health_status TEXT NOT NULL DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'degraded', 'down')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_rate_limit_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'gemini', 'claude', 'custom_api', 'all')),
  rpm_limit INTEGER NOT NULL DEFAULT 120,
  rph_limit INTEGER NOT NULL DEFAULT 2000,
  rpd_limit INTEGER NOT NULL DEFAULT 20000,
  burst_limit INTEGER NOT NULL DEFAULT 40,
  block_seconds INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_name, provider)
);

INSERT INTO public.ai_rate_limit_controls (role_name, provider, rpm_limit, rph_limit, rpd_limit, burst_limit, block_seconds, is_active)
VALUES
  ('admin', 'all', 600, 10000, 120000, 120, 20, true),
  ('reseller', 'all', 200, 4000, 40000, 70, 30, true),
  ('user', 'all', 80, 1200, 9000, 30, 60, true)
ON CONFLICT (role_name, provider) DO UPDATE SET
  rpm_limit = EXCLUDED.rpm_limit,
  rph_limit = EXCLUDED.rph_limit,
  rpd_limit = EXCLUDED.rpd_limit,
  burst_limit = EXCLUDED.burst_limit,
  block_seconds = EXCLUDED.block_seconds,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.ai_abuse_block_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_role TEXT NOT NULL,
  provider TEXT,
  reason TEXT NOT NULL,
  fingerprint TEXT,
  ip_address TEXT,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_role_access_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  can_use_openai BOOLEAN NOT NULL DEFAULT true,
  can_use_gemini BOOLEAN NOT NULL DEFAULT true,
  can_use_claude BOOLEAN NOT NULL DEFAULT true,
  can_use_custom_api BOOLEAN NOT NULL DEFAULT false,
  can_control_ads BOOLEAN NOT NULL DEFAULT false,
  can_control_payments BOOLEAN NOT NULL DEFAULT false,
  can_edit_router BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ai_role_access_controls (
  role_name, can_use_openai, can_use_gemini, can_use_claude, can_use_custom_api, can_control_ads, can_control_payments, can_edit_router
)
VALUES
  ('admin', true, true, true, true, true, true, true),
  ('reseller', true, true, true, false, false, false, false),
  ('user', true, true, false, false, false, false, false)
ON CONFLICT (role_name) DO UPDATE SET
  can_use_openai = EXCLUDED.can_use_openai,
  can_use_gemini = EXCLUDED.can_use_gemini,
  can_use_claude = EXCLUDED.can_use_claude,
  can_use_custom_api = EXCLUDED.can_use_custom_api,
  can_control_ads = EXCLUDED.can_control_ads,
  can_control_payments = EXCLUDED.can_control_payments,
  can_edit_router = EXCLUDED.can_edit_router,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.ai_offline_fallback_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key TEXT NOT NULL,
  priority_order INTEGER NOT NULL DEFAULT 1,
  rule_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_key, priority_order)
);

INSERT INTO public.ai_offline_fallback_rules (task_key, priority_order, rule_payload, is_active)
VALUES
  ('meta_tags', 1, '{"strategy":"template","title_pattern":"{product} | {country}","desc_pattern":"{product} automation for {audience}"}', true),
  ('ads_copy', 1, '{"strategy":"rules","headline_count":5,"keyword_inject":true}', true),
  ('lead_scoring', 1, '{"strategy":"weighted","weights":{"intent":0.4,"budget":0.3,"behavior":0.3}}', true)
ON CONFLICT (task_key, priority_order) DO UPDATE SET
  rule_payload = EXCLUDED.rule_payload,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.ai_model_update_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  current_model_key TEXT,
  suggested_model_key TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ai_usage_module_rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rollup_date DATE NOT NULL DEFAULT CURRENT_DATE,
  module_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  calls_count INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost NUMERIC(12,6) NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10,2) NOT NULL DEFAULT 0,
  success_rate NUMERIC(8,4) NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rollup_date, module_name, provider)
);

CREATE TABLE IF NOT EXISTS public.ai_google_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('search', 'display')),
  campaign_name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  headlines TEXT[] NOT NULL DEFAULT '{}'::text[],
  descriptions TEXT[] NOT NULL DEFAULT '{}'::text[],
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  cpc_cap NUMERIC(12,4) NOT NULL DEFAULT 0,
  ab_test_group TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_pixel_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('facebook_pixel', 'gtm', 'conversion_api')),
  event_name TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  event_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_request_logs_task_time ON public.ai_request_logs(task_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_health_provider_time ON public.ai_api_health_monitor_snapshots(provider, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_rollups_date_module ON public.ai_usage_module_rollups(rollup_date, module_name);
CREATE INDEX IF NOT EXISTS idx_ai_learning_feedback_product_time ON public.ai_learning_feedback(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pixel_tracking_channel_time ON public.ai_pixel_tracking_events(channel, created_at DESC);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_model_catalog','ai_task_execution_map','ai_request_logs','ai_dynamic_prompt_profiles','ai_context_memory',
    'ai_learning_feedback','ai_api_health_monitor_snapshots','ai_rate_limit_controls','ai_abuse_block_events',
    'ai_role_access_controls','ai_offline_fallback_rules','ai_model_update_suggestions','ai_usage_module_rollups',
    'ai_google_ads_campaigns','ai_pixel_tracking_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Super admin full access %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Super admin full access %s" ON public.%I FOR ALL USING (has_role(auth.uid(), ''super_admin''))', t, t);
  END LOOP;
END $$;