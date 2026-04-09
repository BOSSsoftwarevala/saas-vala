-- Google Integration + Sitemap/Schema + Automation/AI Ultra Layer

CREATE TABLE IF NOT EXISTS public.google_oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('gsc', 'ga4', 'google_ads')),
  account_email TEXT,
  account_id TEXT,
  access_scope TEXT[] NOT NULL DEFAULT '{}'::text[],
  token_ref TEXT,
  refresh_ref TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, account_id)
);

CREATE TABLE IF NOT EXISTS public.google_domain_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.google_oauth_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gsc', 'ga4', 'google_ads')),
  domain_host TEXT NOT NULL,
  property_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, domain_host, property_id)
);

CREATE TABLE IF NOT EXISTS public.google_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('gsc', 'ga4', 'google_ads')),
  domain_host TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  fetched_keywords INTEGER NOT NULL DEFAULT 0,
  fetched_pages INTEGER NOT NULL DEFAULT 0,
  fetched_metrics INTEGER NOT NULL DEFAULT 0,
  indexing_issues INTEGER NOT NULL DEFAULT 0,
  crawl_errors INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.seo_sitemap_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_host TEXT NOT NULL,
  sitemap_key TEXT NOT NULL,
  sitemap_url TEXT NOT NULL,
  sitemap_type TEXT NOT NULL CHECK (sitemap_type IN ('master', 'products', 'blogs', 'pages', 'images', 'videos')),
  total_urls INTEGER NOT NULL DEFAULT 0,
  indexed_urls INTEGER NOT NULL DEFAULT 0,
  pending_urls INTEGER NOT NULL DEFAULT 0,
  success_percent NUMERIC(8,4) NOT NULL DEFAULT 0,
  last_submitted_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (domain_host, sitemap_key)
);

CREATE TABLE IF NOT EXISTS public.seo_sitemap_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id UUID REFERENCES public.seo_sitemap_manifests(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  page_type TEXT NOT NULL CHECK (page_type IN ('homepage', 'product', 'category', 'blog', 'landing', 'image', 'video')),
  page_url TEXT NOT NULL,
  priority NUMERIC(4,2) NOT NULL DEFAULT 0.5,
  change_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (change_frequency IN ('daily', 'weekly', 'monthly')),
  last_modified TIMESTAMPTZ,
  indexed BOOLEAN NOT NULL DEFAULT false,
  submit_status TEXT NOT NULL DEFAULT 'pending' CHECK (submit_status IN ('pending', 'submitted', 'indexed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (manifest_id, page_url)
);

CREATE TABLE IF NOT EXISTS public.seo_schema_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  page_type TEXT NOT NULL CHECK (page_type IN ('homepage', 'product', 'blog', 'faq', 'landing')),
  schema_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  schema_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_status TEXT NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid', 'warning', 'invalid')),
  auto_fixed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_url)
);

CREATE TABLE IF NOT EXISTS public.seo_schema_validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id UUID REFERENCES public.seo_schema_registry(id) ON DELETE CASCADE,
  error_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  fixed BOOLEAN NOT NULL DEFAULT false,
  fixed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_hreflang_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_url TEXT NOT NULL,
  country_code TEXT NOT NULL,
  language_code TEXT NOT NULL,
  href_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_url, country_code, language_code)
);

CREATE TABLE IF NOT EXISTS public.seo_index_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  reason TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_traffic_lead_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  keyword TEXT,
  source_channel TEXT NOT NULL DEFAULT 'seo',
  landing_url TEXT,
  attributed_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_automation_control_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_index_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_recrawl_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_schema_fix_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_content_refresh_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_keyword_boost_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_backlink_builder_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_page_creator_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_geo_switch_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_language_engine_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_performance_boost_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_security_seo_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.seo_automation_control_settings (
  auto_index_enabled,
  auto_recrawl_enabled,
  auto_schema_fix_enabled,
  auto_content_refresh_enabled,
  auto_keyword_boost_enabled,
  auto_backlink_builder_enabled,
  auto_page_creator_enabled,
  auto_geo_switch_enabled,
  auto_language_engine_enabled,
  auto_performance_boost_enabled,
  auto_security_seo_enabled
)
SELECT true, true, true, true, true, true, true, true, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.seo_automation_control_settings);

CREATE TABLE IF NOT EXISTS public.seo_auto_healing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('missing_meta', 'broken_link', 'slow_page', 'schema_error', 'indexing_issue')),
  fix_action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_content_refresh_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  page_url TEXT,
  trigger_reason TEXT NOT NULL,
  old_score NUMERIC(8,4),
  new_score NUMERIC(8,4),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.seo_keyword_boost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  injected_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  target_areas TEXT[] NOT NULL DEFAULT '{meta,content,headings}'::text[],
  status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_backlink_builder_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  internal_links_added INTEGER NOT NULL DEFAULT 0,
  smart_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_ai_page_creator_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  generated_page_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.seo_performance_boost_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  lazy_load_enabled BOOLEAN NOT NULL DEFAULT true,
  image_compression_enabled BOOLEAN NOT NULL DEFAULT true,
  cdn_pushed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('spam_link_detected', 'bad_bot_blocked')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE CHECK (provider IN ('openai', 'gemini', 'claude')),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  priority_order INTEGER NOT NULL DEFAULT 1,
  speed_score NUMERIC(8,4) NOT NULL DEFAULT 1,
  cost_score NUMERIC(8,4) NOT NULL DEFAULT 1,
  health_status TEXT NOT NULL DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'degraded', 'down')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ai_provider_configs (provider, is_enabled, priority_order, speed_score, cost_score, health_status)
VALUES
  ('openai', true, 1, 0.92, 0.70, 'healthy'),
  ('gemini', true, 2, 0.95, 0.60, 'healthy'),
  ('claude', true, 3, 0.88, 0.82, 'healthy')
ON CONFLICT (provider) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  priority_order = EXCLUDED.priority_order,
  speed_score = EXCLUDED.speed_score,
  cost_score = EXCLUDED.cost_score,
  health_status = EXCLUDED.health_status,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.ai_task_model_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL UNIQUE CHECK (task_type IN ('content', 'seo', 'analysis')),
  primary_provider TEXT NOT NULL CHECK (primary_provider IN ('openai', 'gemini', 'claude')),
  fallback_providers TEXT[] NOT NULL DEFAULT '{}'::text[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ai_task_model_routing (task_type, primary_provider, fallback_providers)
VALUES
  ('content', 'openai', ARRAY['gemini', 'claude']),
  ('seo', 'gemini', ARRAY['openai', 'claude']),
  ('analysis', 'claude', ARRAY['gemini', 'openai'])
ON CONFLICT (task_type) DO UPDATE SET
  primary_provider = EXCLUDED.primary_provider,
  fallback_providers = EXCLUDED.fallback_providers,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.ai_failover_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  failed_provider TEXT NOT NULL,
  fallback_provider TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage_cost_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  task_type TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(12,6) NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_sync_runs_provider_time ON public.google_sync_runs(provider, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_sitemap_manifests_domain ON public.seo_sitemap_manifests(domain_host, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_sitemap_urls_manifest_status ON public.seo_sitemap_urls(manifest_id, submit_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_schema_registry_page_type ON public.seo_schema_registry(page_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_index_retry_queue_status ON public.seo_index_retry_queue(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_seo_traffic_lead_mapping_keyword ON public.seo_traffic_lead_mapping(keyword, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_priority ON public.ai_provider_configs(priority_order, is_enabled);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'google_oauth_connections','google_domain_properties','google_sync_runs','seo_sitemap_manifests','seo_sitemap_urls',
    'seo_schema_registry','seo_schema_validation_logs','seo_hreflang_mappings','seo_index_retry_queue','seo_traffic_lead_mapping',
    'seo_automation_control_settings','seo_auto_healing_events','seo_content_refresh_jobs','seo_keyword_boost_events',
    'seo_backlink_builder_events','seo_ai_page_creator_jobs','seo_performance_boost_jobs','seo_security_events',
    'ai_provider_configs','ai_task_model_routing','ai_failover_logs','ai_usage_cost_snapshots'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Super admin full access %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Super admin full access %s" ON public.%I FOR ALL USING (has_role(auth.uid(), ''super_admin''))', t, t);
  END LOOP;
END $$;
