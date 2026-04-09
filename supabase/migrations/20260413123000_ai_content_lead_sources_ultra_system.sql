-- AI Content Generator + Lead Sources Ultra Micro Automation System

CREATE TABLE IF NOT EXISTS public.ai_content_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  intent TEXT NOT NULL DEFAULT 'info' CHECK (intent IN ('buy', 'info', 'compare')),
  goal TEXT NOT NULL DEFAULT 'conversion',
  content_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  detected_language TEXT NOT NULL DEFAULT 'en',
  tone_profile TEXT NOT NULL DEFAULT 'balanced',
  country_code TEXT NOT NULL DEFAULT 'IN',
  audience TEXT NOT NULL DEFAULT 'mixed',
  keyword_set TEXT[] NOT NULL DEFAULT '{}'::text[],
  cta_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.ai_content_generation_jobs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('landing', 'blog', 'faq', 'product_description', 'ads_copy', 'social_post', 'thumbnail', 'banner', 'creative', 'voice', 'video')),
  language_code TEXT NOT NULL DEFAULT 'en',
  title TEXT,
  content_text TEXT,
  file_url TEXT,
  file_name TEXT,
  seo_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  hashtags TEXT[] NOT NULL DEFAULT '{}'::text[],
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'pending', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_video_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  content_job_id UUID REFERENCES public.ai_content_generation_jobs(id) ON DELETE SET NULL,
  video_type TEXT NOT NULL CHECK (video_type IN ('demo', 'explainer', 'promo')),
  script_text TEXT,
  voice_provider TEXT NOT NULL DEFAULT 'elevenlabs',
  voice_accent TEXT NOT NULL DEFAULT 'US',
  visuals_engine TEXT NOT NULL DEFAULT 'ai_video_engine',
  output_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rendering', 'ready', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ai_voice_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  content_job_id UUID REFERENCES public.ai_content_generation_jobs(id) ON DELETE SET NULL,
  language_code TEXT NOT NULL DEFAULT 'en',
  accent TEXT NOT NULL DEFAULT 'US',
  voice_provider TEXT NOT NULL DEFAULT 'elevenlabs',
  script_text TEXT,
  output_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_image_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  content_job_id UUID REFERENCES public.ai_content_generation_jobs(id) ON DELETE SET NULL,
  image_type TEXT NOT NULL CHECK (image_type IN ('thumbnail', 'banner', 'social_creative')),
  prompt_text TEXT,
  seo_file_name TEXT,
  output_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_content_quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.ai_content_assets(id) ON DELETE CASCADE,
  grammar_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  duplication_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  seo_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  auto_fixed BOOLEAN NOT NULL DEFAULT false,
  fix_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_content_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.ai_content_assets(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'marketplace',
  views INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC(8,4) NOT NULL DEFAULT 0,
  conversion_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_content_optimization_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.ai_content_assets(id) ON DELETE SET NULL,
  trigger_reason TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  old_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  new_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  old_cta TEXT,
  new_cta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_content_scheduler_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.ai_content_assets(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('instagram', 'linkedin', 'twitter', 'marketplace_blog', 'ads')),
  schedule_type TEXT NOT NULL DEFAULT 'daily' CHECK (schedule_type IN ('daily', 'weekly')),
  best_time_slot TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  scheduled_for TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_marketplace_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  sync_target TEXT NOT NULL CHECK (sync_target IN ('product_page', 'banner', 'ads_section', 'blog')),
  asset_id UUID REFERENCES public.ai_content_assets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'synced' CHECK (status IN ('synced', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  formats TEXT[] NOT NULL DEFAULT '{text,image,video}'::text[],
  export_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_content_category_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  detected_category TEXT NOT NULL,
  detected_sub_category TEXT,
  confidence NUMERIC(6,2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'ai_content_analysis',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id)
);

CREATE TABLE IF NOT EXISTS public.lead_source_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code TEXT NOT NULL UNIQUE,
  source_label TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('website_form', 'whatsapp', 'seo_organic', 'google_ads', 'demo_request', 'contact_page', 'custom')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.lead_source_catalog (source_code, source_label, source_type) VALUES
  ('website', 'Website Forms', 'website_form'),
  ('whatsapp', 'WhatsApp Click', 'whatsapp'),
  ('seo', 'SEO Organic', 'seo_organic'),
  ('ads', 'Google Ads', 'google_ads'),
  ('demo', 'Demo Requests', 'demo_request'),
  ('contact', 'Contact Page', 'contact_page'),
  ('custom', 'Custom Source', 'custom')
ON CONFLICT (source_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.lead_source_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.lead_source_catalog(id) ON DELETE SET NULL,
  source_code TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  click_count INTEGER NOT NULL DEFAULT 0,
  converted BOOLEAN NOT NULL DEFAULT false,
  attributed_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_enrichment_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  country_code TEXT,
  language_code TEXT,
  timezone TEXT,
  device_type TEXT,
  ip_address INET,
  browser_language TEXT,
  enriched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);

CREATE TABLE IF NOT EXISTS public.lead_assignment_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('location', 'language', 'product', 'reseller_priority', 'fallback')),
  assignment_reason TEXT,
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_response_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  language_code TEXT NOT NULL DEFAULT 'en',
  template_key TEXT NOT NULL DEFAULT 'lead_auto_reply',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  send_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('call_lead', 'send_demo', 'send_pricing', 'follow_up')),
  deadline_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_channel_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'ads', 'seo')),
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click', 'reply', 'submit')),
  event_value NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_duplicate_merge_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  merged_lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  merge_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (primary_lead_id, merged_lead_id)
);

CREATE TABLE IF NOT EXISTS public.reseller_commission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  order_id UUID,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'credited' CHECK (status IN ('credited', 'pending', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reseller_language_cost_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code TEXT NOT NULL UNIQUE,
  cost_multiplier NUMERIC(8,4) NOT NULL DEFAULT 1,
  fixed_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.reseller_language_cost_rules (language_code, cost_multiplier, fixed_cost) VALUES
  ('en', 1, 0.50),
  ('hi', 1, 0.75),
  ('ar', 1.35, 1.50),
  ('fr', 1.25, 1.20)
ON CONFLICT (language_code) DO UPDATE SET
  cost_multiplier = EXCLUDED.cost_multiplier,
  fixed_cost = EXCLUDED.fixed_cost,
  is_active = true,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.lead_pipeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  old_stage TEXT,
  new_stage TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_content_generation_jobs_product_created ON public.ai_content_generation_jobs(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_content_assets_product_type ON public.ai_content_assets(product_id, asset_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_source_events_source_time ON public.lead_source_events(source_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_enrichment_profiles_country_lang ON public.lead_enrichment_profiles(country_code, language_code, enriched_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_assignment_audit_lead ON public.lead_assignment_audit(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_response_jobs_status_send ON public.lead_response_jobs(status, send_at);
CREATE INDEX IF NOT EXISTS idx_lead_task_assignments_status_deadline ON public.lead_task_assignments(status, deadline_at);
CREATE INDEX IF NOT EXISTS idx_lead_channel_tracking_lead ON public.lead_channel_tracking(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reseller_commission_events_reseller ON public.reseller_commission_events(reseller_id, created_at DESC);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_content_generation_jobs','ai_content_assets','ai_video_generation_jobs','ai_voice_generation_jobs','ai_image_generation_jobs',
    'ai_content_quality_checks','ai_content_performance_metrics','ai_content_optimization_events','ai_content_scheduler_queue',
    'ai_marketplace_sync_logs','ai_export_jobs','product_content_category_mapping','lead_source_catalog','lead_source_events',
    'lead_enrichment_profiles','lead_assignment_audit','lead_response_jobs','lead_task_assignments','lead_channel_tracking',
    'lead_duplicate_merge_logs','reseller_commission_events','reseller_language_cost_rules','lead_pipeline_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Super admin full access %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Super admin full access %s" ON public.%I FOR ALL USING (has_role(auth.uid(), ''super_admin''))', t, t);
  END LOOP;
END $$;
