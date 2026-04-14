-- Lead Generation Extension System Database Schema

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,
  rating NUMERIC(3, 1),
  reviews_count INTEGER DEFAULT 0,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'IN',
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  business_type TEXT,
  source TEXT NOT NULL DEFAULT 'maps', -- 'maps', 'website', 'linkedin', 'social'
  lead_score TEXT DEFAULT 'cold', -- 'hot', 'warm', 'cold'
  lead_score_value INTEGER DEFAULT 0 CHECK (lead_score_value >= 0 AND lead_score_value <= 100),
  status TEXT DEFAULT 'new', -- 'new', 'contacted', 'interested', 'converted', 'lost'
  email_status TEXT DEFAULT 'unknown', -- 'unknown', 'valid', 'invalid', 'risky', 'disposable'
  email_verified BOOLEAN DEFAULT FALSE,
  is_duplicate BOOLEAN DEFAULT FALSE,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  indexed_at TIMESTAMPTZ,
  auto_generated BOOLEAN DEFAULT FALSE
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  target_city TEXT,
  target_country TEXT DEFAULT 'IN',
  target_business_types TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'completed'
  total_leads INTEGER DEFAULT 0,
  contacted_leads INTEGER DEFAULT 0,
  interested_leads INTEGER DEFAULT 0,
  converted_leads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_run_at TIMESTAMPTZ
);

-- Outreach messages table
CREATE TABLE IF NOT EXISTS outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  channel TEXT NOT NULL, -- 'email', 'whatsapp', 'linkedin'
  template TEXT NOT NULL,
  personalized_content TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'opened', 'replied', 'failed'
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  error_message TEXT,
  follow_up_sequence INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  status TEXT DEFAULT 'unknown', -- 'unknown', 'valid', 'invalid', 'risky', 'disposable'
  smtp_check BOOLEAN DEFAULT FALSE,
  mx_record BOOLEAN DEFAULT FALSE,
  disposable BOOLEAN DEFAULT FALSE,
  score INTEGER DEFAULT 0,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEO analysis table
CREATE TABLE IF NOT EXISTS seo_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  competition_score INTEGER,
  current_ranking INTEGER,
  backlinks_count INTEGER,
  on_page_score INTEGER,
  overall_score INTEGER,
  suggestions TEXT[],
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API integrations table
CREATE TABLE IF NOT EXISTS api_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL, -- 'hunter', 'snov', 'apollo', 'serpapi', 'dataforseo', 'apify', 'phantombuster'
  api_key TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  rate_limit_per_hour INTEGER DEFAULT 100,
  requests_today INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead activities table (for CRM pipeline)
CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'note', 'call', 'email', 'meeting', 'task'
  description TEXT,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics metrics table
CREATE TABLE IF NOT EXISTS analytics_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  total_leads INTEGER DEFAULT 0,
  new_leads INTEGER DEFAULT 0,
  contacted_leads INTEGER DEFAULT 0,
  interested_leads INTEGER DEFAULT 0,
  converted_leads INTEGER DEFAULT 0,
  email_sent INTEGER DEFAULT 0,
  email_opened INTEGER DEFAULT 0,
  email_replied INTEGER DEFAULT 0,
  whatsapp_sent INTEGER DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  conversion_rate NUMERIC(5, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_website ON leads(website);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(country);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);

CREATE INDEX IF NOT EXISTS idx_outreach_lead_id ON outreach_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_campaign_id ON outreach_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_messages(status);
CREATE INDEX IF NOT EXISTS idx_outreach_sent_at ON outreach_messages(sent_at);

CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_status ON email_verifications(status);

CREATE INDEX IF NOT EXISTS idx_seo_analysis_lead_id ON seo_analysis(lead_id);
CREATE INDEX IF NOT EXISTS idx_seo_analysis_keyword ON seo_analysis(keyword);

CREATE INDEX IF NOT EXISTS idx_api_integrations_provider ON api_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_api_integrations_is_active ON api_integrations(is_active);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON lead_activities(created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_metric_date ON analytics_metrics(metric_date);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users)
CREATE POLICY "Users can read all leads" ON leads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert leads" ON leads FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update leads" ON leads FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete leads" ON leads FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read all campaigns" ON campaigns FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert campaigns" ON campaigns FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update campaigns" ON campaigns FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete campaigns" ON campaigns FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read all outreach messages" ON outreach_messages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert outreach messages" ON outreach_messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update outreach messages" ON outreach_messages FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read all email verifications" ON email_verifications FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert email verifications" ON email_verifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update email verifications" ON email_verifications FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read all seo analysis" ON seo_analysis FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert seo analysis" ON seo_analysis FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can read all api integrations" ON api_integrations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert api integrations" ON api_integrations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update api integrations" ON api_integrations FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read all lead activities" ON lead_activities FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert lead activities" ON lead_activities FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can read all analytics metrics" ON analytics_metrics FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert analytics metrics" ON analytics_metrics FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update analytics metrics" ON analytics_metrics FOR UPDATE USING (auth.role() = 'authenticated');

-- Functions for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_verifications_updated_at BEFORE UPDATE ON email_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_integrations_updated_at BEFORE UPDATE ON api_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check for duplicate leads
CREATE OR REPLACE FUNCTION check_duplicate_lead(
  p_email TEXT,
  p_phone TEXT,
  p_website TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM leads
    WHERE (p_email IS NOT NULL AND email = p_email)
       OR (p_phone IS NOT NULL AND phone = p_phone)
       OR (p_website IS NOT NULL AND website = p_website)
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;
