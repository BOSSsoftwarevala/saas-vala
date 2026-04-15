-- AI API Management System Migration
-- This migration creates tables for managing 105+ AI APIs with priority, failover, and cost control

-- AI API Integrations table
CREATE TABLE IF NOT EXISTS ai_api_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  category TEXT NOT NULL, -- 1-12 categories
  sub_category TEXT,
  api_key TEXT,
  api_endpoint TEXT,
  priority INTEGER DEFAULT 1 CHECK (priority >= 1), -- 1 = primary, 2+ = fallback
  is_active BOOLEAN DEFAULT TRUE,
  is_enabled BOOLEAN DEFAULT TRUE, -- Master on/off switch
  billing_enabled BOOLEAN DEFAULT TRUE, -- Billing control
  cost_per_1k_tokens NUMERIC(10, 4) DEFAULT 0.0001,
  max_tokens_per_request INTEGER DEFAULT 4096,
  daily_budget_limit NUMERIC(10, 2),
  daily_cost_today NUMERIC(10, 2) DEFAULT 0,
  tokens_used_today INTEGER DEFAULT 0,
  requests_today INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  fail_count INTEGER DEFAULT 0,
  auto_failover_enabled BOOLEAN DEFAULT TRUE,
  usage_mapping TEXT[] DEFAULT '{}', -- ['seo', 'chat', 'critical', etc.]
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI API Usage Logs table
CREATE TABLE IF NOT EXISTS ai_api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_integration_id UUID NOT NULL REFERENCES ai_api_integrations(id) ON DELETE CASCADE,
  user_id UUID,
  request_type TEXT NOT NULL, -- 'seo', 'chat', 'critical', etc.
  tokens_used INTEGER DEFAULT 0,
  cost NUMERIC(10, 4),
  response_time_ms INTEGER,
  status TEXT DEFAULT 'success', -- 'success', 'failed', 'fallback'
  fallback_from_id UUID REFERENCES ai_api_integrations(id),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI API Categories table (for the 12 categories)
CREATE TABLE IF NOT EXISTS ai_api_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id INTEGER NOT NULL UNIQUE, -- 1-12
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the 12 categories
INSERT INTO ai_api_categories (category_id, name, description, icon, sort_order) VALUES
(1, 'Core AI Models', 'Primary AI models for text generation', 'cpu', 1),
(2, 'SEO Content Generation', 'High-value SEO content generation tools', 'file-text', 2),
(3, 'Keyword + SEO Data', 'Keyword research and SEO data APIs', 'search', 3),
(4, 'Scraping + Lead Extraction', 'Web scraping and lead extraction services', 'globe', 4),
(5, 'Email + Lead Enrichment', 'Email finding and lead enrichment APIs', 'mail', 5),
(6, 'Social Media Automation', 'Social media management and automation', 'share-2', 6),
(7, 'Chat + Support AI', 'Chatbot and customer support AI', 'message-square', 7),
(8, 'Voice + Translation', 'Speech recognition and translation services', 'mic', 8),
(9, 'Image / Design AI', 'Image generation and design AI', 'image', 9),
(10, 'Automation + Workflow', 'Workflow automation and integration', 'zap', 10),
(11, 'Analytics + Tracking', 'Analytics and tracking platforms', 'bar-chart', 11),
(12, 'Bonus (High Impact)', 'High-impact bonus integrations', 'star', 12)
ON CONFLICT (category_id) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_api_integrations_category ON ai_api_integrations(category);
CREATE INDEX IF NOT EXISTS idx_ai_api_integrations_provider ON ai_api_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_ai_api_integrations_priority ON ai_api_integrations(priority);
CREATE INDEX IF NOT EXISTS idx_ai_api_integrations_is_active ON ai_api_integrations(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_api_integrations_is_enabled ON ai_api_integrations(is_enabled);
CREATE INDEX IF NOT EXISTS idx_ai_api_usage_logs_api_id ON ai_api_usage_logs(api_integration_id);
CREATE INDEX IF NOT EXISTS idx_ai_api_usage_logs_user_id ON ai_api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_api_usage_logs_request_type ON ai_api_usage_logs(request_type);
CREATE INDEX IF NOT EXISTS idx_ai_api_usage_logs_created_at ON ai_api_usage_logs(created_at);

-- Updated at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_ai_api_integrations_updated_at BEFORE UPDATE ON ai_api_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE ai_api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_api_categories ENABLE ROW LEVEL SECURITY;

-- RLS for ai_api_integrations
CREATE POLICY "Admins can view all AI API integrations" ON ai_api_integrations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

CREATE POLICY "Admins can insert AI API integrations" ON ai_api_integrations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

CREATE POLICY "Admins can update AI API integrations" ON ai_api_integrations
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

CREATE POLICY "Admins can delete AI API integrations" ON ai_api_integrations
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

-- RLS for ai_api_usage_logs
CREATE POLICY "Admins can view all AI API usage logs" ON ai_api_usage_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

CREATE POLICY "Users can view their own AI API usage logs" ON ai_api_usage_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert AI API usage logs" ON ai_api_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- RLS for ai_api_categories (public read, admin write)
CREATE POLICY "Anyone can view AI API categories" ON ai_api_categories
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert AI API categories" ON ai_api_categories
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

CREATE POLICY "Admins can update AI API categories" ON ai_api_categories
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

-- Function to reset daily usage
CREATE OR REPLACE FUNCTION reset_daily_ai_api_usage()
RETURNS void AS $$
BEGIN
  UPDATE ai_api_integrations
  SET 
    daily_cost_today = 0,
    tokens_used_today = 0,
    requests_today = 0
  WHERE is_enabled = true;
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_ai_api_usage(
  p_api_id UUID,
  p_tokens INTEGER DEFAULT 0,
  p_cost NUMERIC DEFAULT 0,
  p_status TEXT DEFAULT 'success',
  p_fallback_from_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE ai_api_integrations
  SET 
    tokens_used_today = tokens_used_today + p_tokens,
    daily_cost_today = daily_cost_today + p_cost,
    requests_today = requests_today + 1,
    last_used_at = NOW(),
    fail_count = CASE WHEN p_status = 'failed' THEN fail_count + 1 ELSE 0 END
  WHERE id = p_api_id;
END;
$$ LANGUAGE plpgsql;
