-- Lead Sources + Lead Analytics Ultra Deep Automation

CREATE TABLE IF NOT EXISTS public.lead_source_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  priority_weight NUMERIC(8,4) NOT NULL DEFAULT 1,
  auto_tracking_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_assignment_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.lead_source_settings (source_code, is_enabled, priority_weight)
SELECT c.source_code, true, 1
FROM public.lead_source_catalog c
ON CONFLICT (source_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.lead_tracking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code TEXT NOT NULL,
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
  link_code TEXT NOT NULL UNIQUE,
  tracking_url TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  click_count INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_source_fraud_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code TEXT NOT NULL,
  ip_address INET,
  fingerprint TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('fake_click', 'bot_traffic', 'duplicate_submit')),
  risk_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  blocked BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_ads_channel_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code TEXT NOT NULL DEFAULT 'ads',
  campaign_id TEXT,
  country_code TEXT,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  metric_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_code, campaign_id, metric_date)
);

CREATE TABLE IF NOT EXISTS public.lead_search_console_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code TEXT NOT NULL DEFAULT 'seo',
  keyword TEXT NOT NULL,
  country_code TEXT,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC(8,4) NOT NULL DEFAULT 0,
  avg_position NUMERIC(8,2) NOT NULL DEFAULT 0,
  metric_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_code, keyword, country_code, metric_date)
);

CREATE TABLE IF NOT EXISTS public.lead_source_optimizer_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('increase_allocation', 'decrease_allocation', 'pause_source', 'resume_source')),
  old_priority NUMERIC(8,4),
  new_priority NUMERIC(8,4),
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL CHECK (period_type IN ('today', '7d', '30d', 'custom')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  funnel JSONB NOT NULL DEFAULT '{}'::jsonb,
  conversion_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  revenue_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  country_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  language_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  reseller_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  agent_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  trend_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  prediction_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_analytics_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('conversion_drop', 'high_source_performance', 'source_fraud_spike')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  source_code TEXT,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL CHECK (format IN ('pdf', 'excel', 'csv')),
  period_type TEXT NOT NULL CHECK (period_type IN ('today', '7d', '30d', 'custom')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  file_url TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_tracking_links_source_reseller ON public.lead_tracking_links(source_code, reseller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_source_fraud_events_source_time ON public.lead_source_fraud_events(source_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_ads_channel_metrics_source_date ON public.lead_ads_channel_metrics(source_code, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_lead_search_console_metrics_source_date ON public.lead_search_console_metrics(source_code, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_lead_analytics_snapshots_period_created ON public.lead_analytics_snapshots(period_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_analytics_alerts_unresolved ON public.lead_analytics_alerts(is_resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_export_jobs_status_created ON public.lead_export_jobs(status, created_at DESC);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lead_source_settings',
    'lead_tracking_links',
    'lead_source_fraud_events',
    'lead_ads_channel_metrics',
    'lead_search_console_metrics',
    'lead_source_optimizer_actions',
    'lead_analytics_snapshots',
    'lead_analytics_alerts',
    'lead_export_jobs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Super admin full access %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Super admin full access %s" ON public.%I FOR ALL USING (has_role(auth.uid(), ''super_admin''))', t, t);
  END LOOP;
END $$;
