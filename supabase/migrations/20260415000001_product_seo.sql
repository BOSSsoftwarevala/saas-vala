-- Product SEO Table
-- Migration for per-product SEO management

CREATE TABLE IF NOT EXISTS product_seo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  
  -- Basic SEO
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  meta_description TEXT,
  keywords TEXT[],
  hashtags TEXT[],
  
  -- SEO Metrics
  seo_score INTEGER DEFAULT 0 CHECK (seo_score BETWEEN 0 AND 100),
  
  -- Targeting
  target_country TEXT DEFAULT 'IN',
  target_language TEXT DEFAULT 'en',
  
  -- Performance Tracking
  keyword_positions JSONB DEFAULT '{}',
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL DEFAULT 0,
  
  -- Content Analysis
  content_score INTEGER DEFAULT 0 CHECK (content_score BETWEEN 0 AND 100),
  content_gap JSONB DEFAULT '{}',
  
  -- Indexing
  indexed_at TIMESTAMP WITH TIME ZONE,
  last_indexed_at TIMESTAMP WITH TIME ZONE,
  index_status TEXT DEFAULT 'pending' CHECK (index_status IN ('pending', 'indexed', 'error')),
  
  -- Technical SEO
  page_speed_score INTEGER DEFAULT 0 CHECK (page_speed_score BETWEEN 0 AND 100),
  schema_status TEXT DEFAULT 'pending' CHECK (schema_status IN ('pending', 'valid', 'error')),
  hreflang_status TEXT DEFAULT 'pending' CHECK (hreflang_status IN ('pending', 'valid', 'error')),
  
  -- Backlinks
  backlink_count INTEGER DEFAULT 0,
  backlink_quality_score INTEGER DEFAULT 0 CHECK (backlink_quality_score BETWEEN 0 AND 100),
  
  -- Internal Linking
  internal_link_score INTEGER DEFAULT 0 CHECK (internal_link_score BETWEEN 0 AND 100),
  
  -- Auto-optimization
  auto_update_enabled BOOLEAN DEFAULT false,
  auto_update_timer INTEGER DEFAULT 7, -- days
  
  -- Trending
  trend_match_score INTEGER DEFAULT 0 CHECK (trend_match_score BETWEEN 0 AND 100),
  
  -- Competitor Analysis
  competitor_data JSONB DEFAULT '{}',
  
  -- Revenue Link
  revenue_generated DECIMAL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_seo_product_id ON product_seo(product_id);
CREATE INDEX IF NOT EXISTS idx_product_seo_slug ON product_seo(slug);
CREATE INDEX IF NOT EXISTS idx_product_seo_seo_score ON product_seo(seo_score);
CREATE INDEX IF NOT EXISTS idx_product_seo_index_status ON product_seo(index_status);
CREATE INDEX IF NOT EXISTS idx_product_seo_target_country ON product_seo(target_country);

-- Enable Row Level Security
ALTER TABLE product_seo ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow read access for authenticated users" ON product_seo
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all access for service role" ON product_seo
  FOR ALL USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_seo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER product_seo_updated_at
  BEFORE UPDATE ON product_seo
  FOR EACH ROW
  EXECUTE FUNCTION update_product_seo_updated_at();
