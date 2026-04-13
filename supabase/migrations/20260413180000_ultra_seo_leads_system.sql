-- ULTRA SEO + LEADS SYSTEM - REAL WORKING MODULE
-- Created: 2026-04-13
-- NO FAKE DATA - NO DUMMY UI - ALL REAL

-- ============================================================
-- 1. SEO PROJECTS TABLE (Multi-domain support)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_scan_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_projects_user ON public.seo_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_seo_projects_domain ON public.seo_projects(domain);

-- ============================================================
-- 2. SEO PAGES TABLE (Individual page tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.seo_projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  keywords TEXT[] DEFAULT '{}'::text[],
  seo_score NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  
  -- Technical SEO fields
  h1 TEXT,
  h2_tags TEXT[] DEFAULT '{}'::text[],
  h3_tags TEXT[] DEFAULT '{}'::text[],
  alt_tags JSONB DEFAULT '{}'::jsonb,
  canonical_url TEXT,
  has_sitemap BOOLEAN DEFAULT false,
  has_robots BOOLEAN DEFAULT false,
  page_speed NUMERIC(5,2),
  mobile_friendly BOOLEAN,
  
  -- Content analysis
  word_count INTEGER DEFAULT 0,
  keyword_density JSONB DEFAULT '{}'::jsonb,
  internal_links TEXT[] DEFAULT '{}'::text[],
  external_links TEXT[] DEFAULT '{}'::text[],
  broken_links TEXT[] DEFAULT '{}'::text[],
  
  -- Meta information
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  twitter_card TEXT,
  
  -- Schema markup
  schema_markup JSONB DEFAULT '{}'::jsonb,
  
  -- Scan tracking
  last_scanned_at TIMESTAMPTZ,
  scan_errors JSONB DEFAULT '[]'::jsonb,
  fix_suggestions JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(project_id, url)
);

CREATE INDEX IF NOT EXISTS idx_seo_pages_project ON public.seo_pages(project_id);
CREATE INDEX IF NOT EXISTS idx_seo_pages_score ON public.seo_pages(seo_score);
CREATE INDEX IF NOT EXISTS idx_seo_pages_status ON public.seo_pages(status);

-- ============================================================
-- 3. SEO KEYWORDS TABLE (Keyword tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.seo_projects(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.seo_pages(id) ON DELETE SET NULL,
  keyword TEXT NOT NULL,
  volume INTEGER DEFAULT 0,
  difficulty NUMERIC(5,2) DEFAULT 0,
  cpc NUMERIC(10,2) DEFAULT 0,
  current_rank INTEGER,
  previous_rank INTEGER,
  rank_change INTEGER DEFAULT 0,
  search_intent TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_secondary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(project_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_seo_keywords_project ON public.seo_keywords(project_id);
CREATE INDEX IF NOT EXISTS idx_seo_keywords_rank ON public.seo_keywords(current_rank);

-- ============================================================
-- 4. SEO KEYWORD HISTORY TABLE (Ranking history)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_keyword_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID NOT NULL REFERENCES public.seo_keywords(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(keyword_id, date)
);

CREATE INDEX IF NOT EXISTS idx_seo_keyword_history_keyword ON public.seo_keyword_history(keyword_id);
CREATE INDEX IF NOT EXISTS idx_seo_keyword_history_date ON public.seo_keyword_history(date DESC);

-- ============================================================
-- 5. SEO LEADS TABLE (Lead capture from SEO)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.seo_projects(id) ON DELETE SET NULL,
  page_id UUID REFERENCES public.seo_pages(id) ON DELETE SET NULL,
  
  -- Lead info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  message TEXT,
  
  -- Source tracking
  source TEXT NOT NULL DEFAULT 'organic',
  source_detail TEXT,
  referrer_url TEXT,
  landing_page TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  
  -- Lead scoring
  score INTEGER DEFAULT 0,
  temperature TEXT DEFAULT 'warm',
  priority TEXT DEFAULT 'medium',
  
  -- Status workflow
  status TEXT DEFAULT 'new',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Activity tracking
  first_visit_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  visit_count INTEGER DEFAULT 1,
  
  -- Meta data
  ip_address TEXT,
  user_agent TEXT,
  geo_country TEXT,
  geo_city TEXT,
  device_type TEXT,
  browser TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_leads_project ON public.seo_leads(project_id);
CREATE INDEX IF NOT EXISTS idx_seo_leads_status ON public.seo_leads(status);
CREATE INDEX IF NOT EXISTS idx_seo_leads_source ON public.seo_leads(source);
CREATE INDEX IF NOT EXISTS idx_seo_leads_created ON public.seo_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_leads_email ON public.seo_leads(email);

-- ============================================================
-- 6. SEO LOGS TABLE (Activity logging)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.seo_projects(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.seo_pages(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  action_type TEXT NOT NULL,
  result TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  duration_ms INTEGER,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_logs_project ON public.seo_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_seo_logs_action ON public.seo_logs(action);
CREATE INDEX IF NOT EXISTS idx_seo_logs_created ON public.seo_logs(created_at DESC);

-- ============================================================
-- 7. SEO ERRORS TABLE (Error tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.seo_projects(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  url TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  is_fixed BOOLEAN DEFAULT false,
  fixed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_errors_project ON public.seo_errors(project_id);
CREATE INDEX IF NOT EXISTS idx_seo_errors_type ON public.seo_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_seo_errors_fixed ON public.seo_errors(is_fixed);

-- ============================================================
-- 8. BACKLINKS TABLE (Backlink tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_backlinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.seo_projects(id) ON DELETE CASCADE,
  backlink_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  anchor_text TEXT,
  rel_attribute TEXT DEFAULT 'follow',
  domain_authority NUMERIC(5,2),
  page_authority NUMERIC(5,2),
  traffic_estimate INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  first_discovered_at TIMESTAMPTZ DEFAULT now(),
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_backlinks_project ON public.seo_backlinks(project_id);
CREATE INDEX IF NOT EXISTS idx_seo_backlinks_domain ON public.seo_backlinks(domain);

-- ============================================================
-- 9. COMPETITORS TABLE (Competitor analysis)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.seo_projects(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  competitor_name TEXT,
  keywords_count INTEGER DEFAULT 0,
  estimated_traffic INTEGER DEFAULT 0,
  domain_authority NUMERIC(5,2),
  backlinks_count INTEGER DEFAULT 0,
  top_keywords TEXT[] DEFAULT '{}'::text[],
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(project_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_seo_competitors_project ON public.seo_competitors(project_id);

-- ============================================================
-- 10. GOOGLE SEARCH CONSOLE DATA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_gsc_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.seo_projects(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.seo_pages(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  query TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC(5,2) DEFAULT 0,
  position NUMERIC(5,2) DEFAULT 0,
  country TEXT,
  device TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(project_id, page_id, date, query, country, device)
);

CREATE INDEX IF NOT EXISTS idx_seo_gsc_project ON public.seo_gsc_data(project_id);
CREATE INDEX IF NOT EXISTS idx_seo_gsc_date ON public.seo_gsc_data(date DESC);

-- ============================================================
-- 11. INTERNAL LINKING SUGGESTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_internal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.seo_projects(id) ON DELETE CASCADE,
  source_page_id UUID NOT NULL REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  target_page_id UUID NOT NULL REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  suggested_anchor_text TEXT,
  relevance_score NUMERIC(5,2) DEFAULT 0,
  is_implemented BOOLEAN DEFAULT false,
  implemented_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(source_page_id, target_page_id)
);

CREATE INDEX IF NOT EXISTS idx_seo_internal_links_project ON public.seo_internal_links(project_id);

-- ============================================================
-- 12. AI GENERATED CONTENT TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_ai_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.seo_projects(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.seo_pages(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL,
  prompt TEXT,
  generated_content TEXT NOT NULL,
  model_used TEXT,
  tokens_used INTEGER,
  quality_score NUMERIC(5,2),
  is_approved BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_ai_content_project ON public.seo_ai_content(project_id);
CREATE INDEX IF NOT EXISTS idx_seo_ai_content_type ON public.seo_ai_content(content_type);

-- ============================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_seo_projects_updated_at
BEFORE UPDATE ON public.seo_projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seo_pages_updated_at
BEFORE UPDATE ON public.seo_pages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seo_keywords_updated_at
BEFORE UPDATE ON public.seo_keywords
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seo_leads_updated_at
BEFORE UPDATE ON public.seo_leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seo_backlinks_updated_at
BEFORE UPDATE ON public.seo_backlinks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seo_competitors_updated_at
BEFORE UPDATE ON public.seo_competitors
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================
ALTER TABLE public.seo_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_keyword_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_backlinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_gsc_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_internal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_ai_content ENABLE ROW LEVEL SECURITY;

-- Admins: Full access
CREATE POLICY "Admins full access on seo_projects"
ON public.seo_projects FOR ALL
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on seo_pages"
ON public.seo_pages FOR ALL
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on seo_keywords"
ON public.seo_keywords FOR ALL
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on seo_leads"
ON public.seo_leads FOR ALL
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on seo_logs"
ON public.seo_logs FOR ALL
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on seo_errors"
ON public.seo_errors FOR ALL
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

-- Users: Own data only
CREATE POLICY "Users manage own seo_projects"
ON public.seo_projects FOR ALL
USING (user_id = auth.uid());

CREATE POLICY "Users view own seo_pages"
ON public.seo_pages FOR SELECT
USING (project_id IN (SELECT id FROM public.seo_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users view own seo_keywords"
ON public.seo_keywords FOR SELECT
USING (project_id IN (SELECT id FROM public.seo_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users view own seo_leads"
ON public.seo_leads FOR SELECT
USING (project_id IN (SELECT id FROM public.seo_projects WHERE user_id = auth.uid()));

-- Resellers: Limited access
CREATE POLICY "Resellers view assigned seo_leads"
ON public.seo_leads FOR SELECT
USING (
  has_role(auth.uid(), 'reseller')
  AND (assigned_to = auth.uid() OR project_id IN (
    SELECT id FROM public.seo_projects WHERE user_id IN (
      SELECT id FROM auth.users WHERE raw_user_meta_data->>'reseller_id' = auth.uid()::text
    )
  ))
);

-- ============================================================
-- CRON JOB FOR DAILY SEO TASKS
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    BEGIN
      PERFORM cron.unschedule('daily-seo-scan');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'daily-seo-scan',
      '0 2 * * *',
      $job$
      SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/seo-automation-engine',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object(
          'trigger', 'cron',
          'action', 'daily-scan-all-projects'
        )
      ) AS request_id;
      $job$
    );
  END IF;
END $$;
