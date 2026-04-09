-- Enterprise AI SEO + Country Engine (ultra micro final)

CREATE TABLE IF NOT EXISTS public.seo_input_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  intent TEXT NOT NULL CHECK (intent IN ('buy', 'info', 'compare')),
  niche TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('b2b', 'b2c', 'mixed')),
  confidence NUMERIC(6,2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'ai_inference',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id)
);

CREATE TABLE IF NOT EXISTS public.seo_keyword_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL DEFAULT 'IN',
  language_code TEXT NOT NULL DEFAULT 'en',
  primary_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  long_tail_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  semantic_clusters JSONB NOT NULL DEFAULT '{}'::jsonb,
  high_intent_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  low_competition_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  trending_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_keyword_clusters_product_country ON public.seo_keyword_clusters(product_id, country_code, created_at DESC);

CREATE TABLE IF NOT EXISTS public.seo_meta_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variant_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  og_title TEXT,
  og_description TEXT,
  twitter_title TEXT,
  twitter_description TEXT,
  ctr_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  conversion_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, variant_key)
);

CREATE TABLE IF NOT EXISTS public.seo_content_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  seo_data_id UUID REFERENCES public.seo_data(id) ON DELETE SET NULL,
  readability_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  keyword_density_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  structure_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  overall_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  weak_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  rewritten_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_trust_signal_injections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  secure_payment BOOLEAN NOT NULL DEFAULT true,
  support_24x7 BOOLEAN NOT NULL DEFAULT true,
  trusted_users_count INTEGER NOT NULL DEFAULT 0,
  compliance_badges TEXT[] NOT NULL DEFAULT '{}'::text[],
  injected_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id)
);

CREATE TABLE IF NOT EXISTS public.seo_generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  region_mode TEXT NOT NULL DEFAULT 'india',
  landing_content TEXT,
  feature_descriptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  faq_content JSONB NOT NULL DEFAULT '[]'::jsonb,
  voice_search_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  intent_matching_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_keyword_heatmap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'IN',
  conversions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  heat_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'stable' CHECK (status IN ('rising', 'dropping', 'stable')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_serp_rank_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'IN',
  old_position INTEGER,
  new_position INTEGER,
  drop_detected BOOLEAN NOT NULL DEFAULT false,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_auto_fix_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  fix_type TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'skipped', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_live_competitor_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL DEFAULT 'IN',
  competitor_domain TEXT NOT NULL,
  competitor_url TEXT,
  extracted_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  extracted_backlinks TEXT[] NOT NULL DEFAULT '{}'::text[],
  strategy_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_backlink_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  target_domain TEXT NOT NULL,
  contact_hint TEXT,
  outreach_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  readiness TEXT NOT NULL DEFAULT 'ready' CHECK (readiness IN ('ready', 'pending', 'sent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_internal_link_graph (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  target_product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  link_context TEXT,
  weight NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_product_id, target_product_id)
);

CREATE TABLE IF NOT EXISTS public.seo_image_optimization_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT,
  optimized_file_name TEXT,
  alt_text TEXT,
  compressed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.seo_sitemap_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  index_state TEXT NOT NULL DEFAULT 'index' CHECK (index_state IN ('index', 'noindex')),
  sitemap_included BOOLEAN NOT NULL DEFAULT true,
  submitted_to_google BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (url)
);

CREATE TABLE IF NOT EXISTS public.google_sync_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('gsc', 'ga4', 'google_ads')),
  account_label TEXT,
  property_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.google_sync_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  property_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.google_ads_auto_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  headlines TEXT[] NOT NULL DEFAULT '{}'::text[],
  descriptions TEXT[] NOT NULL DEFAULT '{}'::text[],
  keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'created', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('click', 'lead', 'purchase')),
  source_channel TEXT NOT NULL DEFAULT 'seo',
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  country_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_region_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL UNIQUE,
  region_mode TEXT NOT NULL,
  intent_tone TEXT NOT NULL,
  language_code TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  cta_text TEXT NOT NULL,
  timezone TEXT NOT NULL,
  search_engines TEXT[] NOT NULL DEFAULT '{google}'::text[],
  payment_priority TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.seo_region_profiles (country_code, region_mode, intent_tone, language_code, currency_code, cta_text, timezone, search_engines, payment_priority)
VALUES
  ('IN', 'india', 'budget-value', 'en-IN', 'INR', 'Start Free Trial', 'Asia/Kolkata', ARRAY['google'], ARRAY['upi', 'wallet', 'wise']),
  ('US', 'usa', 'premium-scalable', 'en-US', 'USD', 'Book Demo', 'America/New_York', ARRAY['google', 'bing'], ARRAY['card', 'wallet']),
  ('GB', 'uk', 'business-corporate', 'en-GB', 'GBP', 'Book Consultation', 'Europe/London', ARRAY['google', 'bing'], ARRAY['card', 'wallet']),
  ('AE', 'uae', 'enterprise-luxury', 'ar-AE', 'AED', 'Enterprise Contact', 'Asia/Dubai', ARRAY['google'], ARRAY['crypto', 'card', 'wise'])
ON CONFLICT (country_code) DO UPDATE SET
  region_mode = EXCLUDED.region_mode,
  intent_tone = EXCLUDED.intent_tone,
  language_code = EXCLUDED.language_code,
  currency_code = EXCLUDED.currency_code,
  cta_text = EXCLUDED.cta_text,
  timezone = EXCLUDED.timezone,
  search_engines = EXCLUDED.search_engines,
  payment_priority = EXCLUDED.payment_priority,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.seo_regional_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  page_path TEXT NOT NULL,
  language_code TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  title TEXT,
  description TEXT,
  content_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, country_code, page_path)
);

CREATE TABLE IF NOT EXISTS public.seo_geo_intel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET,
  browser_language TEXT,
  device_locale TEXT,
  detected_country TEXT,
  fallback_country TEXT,
  mismatch BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_country_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  keyword TEXT NOT NULL,
  position INTEGER,
  competition_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  tracked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_local_competitor_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  competitor_domain TEXT NOT NULL,
  strategy_shift JSONB NOT NULL DEFAULT '{}'::jsonb,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_country_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  seo_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  ads_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  leads_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  traffic NUMERIC(12,2) NOT NULL DEFAULT 0,
  conversions NUMERIC(12,2) NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_cdn_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  cdn_provider TEXT NOT NULL DEFAULT 'edge-default',
  edge_region TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code)
);

CREATE TABLE IF NOT EXISTS public.server_geo_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  target_server_id UUID REFERENCES public.servers(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, target_server_id)
);

CREATE TABLE IF NOT EXISTS public.country_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  price_multiplier NUMERIC(8,4) NOT NULL DEFAULT 1,
  override_price NUMERIC(12,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, country_code)
);

CREATE TABLE IF NOT EXISTS public.country_payment_priority (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL UNIQUE,
  payment_methods TEXT[] NOT NULL DEFAULT '{}'::text[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.country_payment_priority (country_code, payment_methods) VALUES
  ('IN', ARRAY['upi', 'wallet', 'wise']),
  ('US', ARRAY['card', 'wallet']),
  ('AE', ARRAY['crypto', 'card', 'wise'])
ON CONFLICT (country_code) DO UPDATE SET payment_methods = EXCLUDED.payment_methods, updated_at = now();

CREATE TABLE IF NOT EXISTS public.region_ads_run_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL UNIQUE,
  auto_run_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 25,
  bid_strategy TEXT NOT NULL DEFAULT 'maximize_conversions',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_domain_strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL UNIQUE,
  strategy_type TEXT NOT NULL DEFAULT 'subdomain' CHECK (strategy_type IN ('subdomain', 'subfolder', 'ccTLD')),
  host_value TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_run_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily_light', 'weekly_deep')),
  cron_expression TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schedule_type)
);

INSERT INTO public.seo_run_schedules (schedule_type, cron_expression, is_active)
VALUES
  ('daily_light', '15 2 * * *', true),
  ('weekly_deep', '30 3 * * 1', true)
ON CONFLICT (schedule_type) DO UPDATE SET
  cron_expression = EXCLUDED.cron_expression,
  is_active = EXCLUDED.is_active;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'seo_input_intelligence','seo_keyword_clusters','seo_meta_variants','seo_content_scores',
    'seo_trust_signal_injections','seo_generated_content','seo_keyword_heatmap','seo_serp_rank_alerts',
    'seo_auto_fix_logs','seo_live_competitor_pages','seo_backlink_outreach','seo_internal_link_graph',
    'seo_image_optimization_jobs','seo_sitemap_control','google_sync_connections','google_sync_snapshots',
    'google_ads_auto_campaigns','seo_conversion_events','seo_region_profiles','seo_regional_pages',
    'seo_geo_intel_logs','seo_country_rankings','seo_local_competitor_signals','seo_country_dashboards',
    'geo_cdn_routes','server_geo_routing_rules','country_pricing_rules','country_payment_priority',
    'region_ads_run_settings','seo_domain_strategy','seo_run_schedules'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Super admin full access %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Super admin full access %s" ON public.%I FOR ALL USING (has_role(auth.uid(), ''super_admin''))', t, t);
  END LOOP;
END $$;
