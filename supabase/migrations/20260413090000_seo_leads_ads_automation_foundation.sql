-- SEO + Leads + Ads automation foundation

CREATE TABLE IF NOT EXISTS public.seo_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL DEFAULT 'full_scan',
  status TEXT NOT NULL DEFAULT 'queued',
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_product_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seo_data_id UUID REFERENCES public.seo_data(id) ON DELETE SET NULL,
  seo_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  keyword_coverage NUMERIC(5,2) NOT NULL DEFAULT 0,
  readability_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  ctr_estimate NUMERIC(5,2) NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  target_countries TEXT[] NOT NULL DEFAULT '{}'::text[],
  hashtags TEXT[] NOT NULL DEFAULT '{}'::text[],
  ai_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id)
);

CREATE TABLE IF NOT EXISTS public.lead_automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  score_delta INTEGER NOT NULL DEFAULT 0,
  routing_target UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ads_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google_ads',
  external_campaign_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  country_code TEXT,
  language_code TEXT,
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  target_cpa NUMERIC(12,2),
  bid_strategy TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  negatives TEXT[] NOT NULL DEFAULT '{}'::text[],
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ads_campaign_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  ctr NUMERIC(8,4) NOT NULL DEFAULT 0,
  cpc NUMERIC(12,4) NOT NULL DEFAULT 0,
  cpa NUMERIC(12,4) NOT NULL DEFAULT 0,
  roas NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, metric_date)
);

CREATE TABLE IF NOT EXISTS public.seo_automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'global',
  scope_id UUID,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  run_interval_hours INTEGER NOT NULL DEFAULT 24,
  auto_publish BOOLEAN NOT NULL DEFAULT false,
  min_seo_score_threshold NUMERIC(5,2) NOT NULL DEFAULT 75,
  lead_auto_assign BOOLEAN NOT NULL DEFAULT true,
  ads_auto_optimize BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope, scope_id)
);

INSERT INTO public.seo_automation_settings (scope, scope_id, run_interval_hours, auto_publish, created_by)
SELECT 'global', NULL, 24, false, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.seo_automation_settings WHERE scope = 'global' AND scope_id IS NULL
);

CREATE INDEX IF NOT EXISTS idx_seo_automation_runs_status_created ON public.seo_automation_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_product_metrics_product ON public.seo_product_metrics(product_id);
CREATE INDEX IF NOT EXISTS idx_lead_automation_events_lead ON public.lead_automation_events(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_campaigns_product_status ON public.ads_campaigns(product_id, status);
CREATE INDEX IF NOT EXISTS idx_ads_campaign_daily_metrics_campaign_date ON public.ads_campaign_daily_metrics(campaign_id, metric_date DESC);

ALTER TABLE public.seo_automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_product_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_campaign_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access seo_automation_runs"
ON public.seo_automation_runs FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin full access seo_product_metrics"
ON public.seo_product_metrics FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin full access lead_automation_events"
ON public.lead_automation_events FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin full access ads_campaigns"
ON public.ads_campaigns FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin full access ads_campaign_daily_metrics"
ON public.ads_campaign_daily_metrics FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin full access seo_automation_settings"
ON public.seo_automation_settings FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Resellers read own seo_product_metrics"
ON public.seo_product_metrics FOR SELECT
USING (
  has_role(auth.uid(), 'reseller')
  AND product_id IN (SELECT id FROM public.products WHERE created_by = auth.uid())
);

CREATE POLICY "Resellers manage own ads_campaigns"
ON public.ads_campaigns FOR ALL
USING (
  has_role(auth.uid(), 'reseller')
  AND product_id IN (SELECT id FROM public.products WHERE created_by = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'reseller')
  AND product_id IN (SELECT id FROM public.products WHERE created_by = auth.uid())
);

CREATE POLICY "Resellers read own ads_campaign_daily_metrics"
ON public.ads_campaign_daily_metrics FOR SELECT
USING (
  has_role(auth.uid(), 'reseller')
  AND campaign_id IN (
    SELECT c.id
    FROM public.ads_campaigns c
    JOIN public.products p ON p.id = c.product_id
    WHERE p.created_by = auth.uid()
  )
);

CREATE POLICY "Resellers read own lead_automation_events"
ON public.lead_automation_events FOR SELECT
USING (
  has_role(auth.uid(), 'reseller')
  AND lead_id IN (
    SELECT id FROM public.leads
    WHERE assigned_to = auth.uid() OR product_id IN (SELECT id FROM public.products WHERE created_by = auth.uid())
  )
);

CREATE TRIGGER update_seo_product_metrics_updated_at
BEFORE UPDATE ON public.seo_product_metrics
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ads_campaigns_updated_at
BEFORE UPDATE ON public.ads_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seo_automation_settings_updated_at
BEFORE UPDATE ON public.seo_automation_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    BEGIN
      PERFORM cron.unschedule('seo-automation-runner');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'seo-automation-runner',
      '15 */6 * * *',
      $job$
      SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/seo-automation-engine',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object('trigger', 'cron', 'run_type', 'scheduled')
      ) AS request_id;
      $job$
    );
  END IF;
END $$;
