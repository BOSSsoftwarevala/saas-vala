-- Ultra micro engines foundation for SEO + Ads + Leads automation

CREATE TABLE IF NOT EXISTS public.seo_indexing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'index_request' CHECK (action IN ('sitemap_submit', 'index_request', 'reindex_request')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'indexed', 'failed')),
  provider TEXT NOT NULL DEFAULT 'google',
  provider_ref TEXT,
  message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_seo_indexing_queue_status ON public.seo_indexing_queue(status, requested_at DESC);

CREATE TABLE IF NOT EXISTS public.seo_canonical_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  duplicate_group TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (url)
);

CREATE TABLE IF NOT EXISTS public.seo_page_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  lcp_ms INTEGER,
  inp_ms INTEGER,
  cls NUMERIC(8,4),
  ttfb_ms INTEGER,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  image_optimization JSONB NOT NULL DEFAULT '{}'::jsonb,
  script_optimization JSONB NOT NULL DEFAULT '{}'::jsonb,
  lazy_load_enabled BOOLEAN NOT NULL DEFAULT true,
  sampled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (url, sampled_at)
);

CREATE TABLE IF NOT EXISTS public.seo_keyword_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  search_engine TEXT NOT NULL DEFAULT 'google',
  country_code TEXT NOT NULL DEFAULT 'IN',
  device TEXT NOT NULL DEFAULT 'mobile',
  position INTEGER,
  previous_position INTEGER,
  change_delta INTEGER,
  trend TEXT NOT NULL DEFAULT 'stable' CHECK (trend IN ('up', 'down', 'stable')),
  tracked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_keyword_positions_product_time ON public.seo_keyword_positions(product_id, tracked_at DESC);

CREATE TABLE IF NOT EXISTS public.seo_competitor_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  competitor_domain TEXT NOT NULL,
  competitor_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  missing_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  ranking_gap_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  suggested_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_content_gap_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  gap_keyword TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT 'explore' CHECK (intent IN ('buy', 'explore', 'compare')),
  suggested_title TEXT NOT NULL,
  suggested_outline JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_blog_automation_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  content_md TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  published_at TIMESTAMPTZ,
  linked_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  linked_product_urls TEXT[] NOT NULL DEFAULT '{}'::text[],
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.seo_backlink_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  domain_authority NUMERIC(5,2) NOT NULL DEFAULT 0,
  spam_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  quality_tier TEXT NOT NULL DEFAULT 'medium' CHECK (quality_tier IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'lost', 'pending')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_url, target_url)
);

CREATE TABLE IF NOT EXISTS public.lead_spam_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  email TEXT,
  ip_address INET,
  captcha_verified BOOLEAN NOT NULL DEFAULT false,
  fake_email_detected BOOLEAN NOT NULL DEFAULT false,
  duplicate_detected BOOLEAN NOT NULL DEFAULT false,
  risk_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'allow' CHECK (verdict IN ('allow', 'review', 'block')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_scoring_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  interest_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  intent_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  segment TEXT NOT NULL DEFAULT 'cold' CHECK (segment IN ('cold', 'warm', 'hot')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  target_system TEXT NOT NULL DEFAULT 'internal_crm',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.lead_followup_automation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL DEFAULT 'lead_capture_ack',
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  channel TEXT NOT NULL DEFAULT 'email',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.marketing_funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  order_id UUID,
  source_channel TEXT NOT NULL CHECK (source_channel IN ('seo', 'ads', 'organic', 'referral', 'social')),
  stage TEXT NOT NULL CHECK (stage IN ('traffic', 'lead', 'qualified', 'sale')),
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_marketing_funnel_events_product_time ON public.marketing_funnel_events(product_id, event_time DESC);

CREATE TABLE IF NOT EXISTS public.product_roi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seo_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  ads_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  attributed_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  seo_roi NUMERIC(10,4) NOT NULL DEFAULT 0,
  ads_roi NUMERIC(10,4) NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, captured_at)
);

CREATE TABLE IF NOT EXISTS public.ads_budget_control_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('increase_budget', 'reduce_budget', 'pause_campaign', 'resume_campaign')),
  old_budget NUMERIC(12,2),
  new_budget NUMERIC(12,2),
  reason TEXT,
  roi_signal NUMERIC(10,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ads_fatigue_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  ad_unit_key TEXT NOT NULL,
  ctr NUMERIC(8,4) NOT NULL DEFAULT 0,
  ctr_drop_percent NUMERIC(8,4) NOT NULL DEFAULT 0,
  fatigue_detected BOOLEAN NOT NULL DEFAULT false,
  refresh_suggested BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ads_variant_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL CHECK (test_type IN ('headline', 'cta', 'landing_variant')),
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  winner TEXT CHECK (winner IN ('a', 'b', 'tie')),
  confidence NUMERIC(6,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'stopped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.click_fraud_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  ip_address INET,
  fingerprint TEXT,
  risk_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  blocked BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geo_expansion_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  source_country TEXT NOT NULL,
  recommended_country TEXT NOT NULL,
  conversion_signal NUMERIC(8,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'applied', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ads_time_slot_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  best_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  schedule_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_change_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  seo_data_id UUID REFERENCES public.seo_data(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  performance_baseline JSONB NOT NULL DEFAULT '{}'::jsonb,
  rollback_eligible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.seo_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('traffic_drop', 'conversion_drop', 'ranking_drop')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  metric_before NUMERIC(12,4),
  metric_after NUMERIC(12,4),
  threshold_percent NUMERIC(8,4),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.seo_indexing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_canonical_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_page_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_keyword_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_competitor_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_content_gap_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_blog_automation_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_backlink_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_spam_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scoring_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_followup_automation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_roi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_budget_control_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_fatigue_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_variant_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.click_fraud_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_expansion_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_time_slot_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_change_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_alert_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'seo_indexing_queue','seo_canonical_registry','seo_page_vitals','seo_keyword_positions',
    'seo_competitor_insights','seo_content_gap_suggestions','seo_blog_automation_posts',
    'seo_backlink_inventory','lead_spam_checks','lead_scoring_snapshots','crm_sync_jobs',
    'lead_followup_automation','marketing_funnel_events','product_roi_snapshots',
    'ads_budget_control_actions','ads_fatigue_signals','ads_variant_tests','click_fraud_events',
    'geo_expansion_recommendations','ads_time_slot_optimizations','seo_change_snapshots','seo_alert_events'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Super admin full access %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Super admin full access %s" ON public.%I FOR ALL USING (has_role(auth.uid(), ''super_admin''))', t, t);
  END LOOP;
END $$;
