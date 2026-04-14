-- Marketplace Banner and Ticker Configuration
-- Migration for dynamic banner and ticker system

-- Ticker messages table
CREATE TABLE IF NOT EXISTS marketplace_ticker_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_type TEXT NOT NULL CHECK (message_type IN ('offer', 'franchise', 'product', 'lead')),
  message TEXT NOT NULL,
  emoji TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Banner slides table
CREATE TABLE IF NOT EXISTS marketplace_banner_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_type TEXT NOT NULL CHECK (slide_type IN ('product', 'offer', 'franchise', 'category')),
  product_id UUID REFERENCES marketplace_products(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  cta_text TEXT,
  cta_link TEXT,
  background_gradient TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Banner settings table
CREATE TABLE IF NOT EXISTS marketplace_banner_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_enabled BOOLEAN DEFAULT true,
  ticker_speed INTEGER DEFAULT 10, -- seconds per rotation
  ticker_color_theme TEXT DEFAULT 'orange', -- orange, blue, purple, green
  banner_enabled BOOLEAN DEFAULT true,
  banner_speed INTEGER DEFAULT 5, -- seconds per slide
  banner_auto_rotate BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ticker_messages_active ON marketplace_ticker_messages(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_banner_slides_active ON marketplace_banner_slides(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_banner_slides_product ON marketplace_banner_slides(product_id);

-- Insert default ticker messages
INSERT INTO marketplace_ticker_messages (message_type, message, emoji, sort_order) VALUES
('offer', 'ALL SOFTWARE ₹5 ONLY', '🔥', 1),
('offer', 'BUY 3 GET 1 FREE', '🎁', 2),
('offer', 'LIMITED TIME DEAL', '⚡', 3),
('franchise', 'Become Reseller – Earn Daily', '🚀', 4),
('franchise', 'Start Franchise with SaaS Vala', '💼', 5),
('franchise', '0 Investment Reseller Model', '💰', 6),
('product', 'CRM Software Trending', '🔥', 7),
('product', 'POS System Bestseller', '📊', 8),
('product', 'ERP System Live Now', '⚙️', 9),
('lead', 'Get Free Demo Today', '📞', 10),
('lead', 'Contact for Bulk Deals', '📩', 11)
ON CONFLICT DO NOTHING;

-- Insert default banner settings
INSERT INTO marketplace_banner_settings (ticker_enabled, ticker_speed, ticker_color_theme, banner_enabled, banner_speed, banner_auto_rotate)
VALUES (true, 10, 'orange', true, 5, true)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE marketplace_ticker_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_banner_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_banner_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow read access for authenticated users" ON marketplace_ticker_messages
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all access for service role" ON marketplace_ticker_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow read access for authenticated users" ON marketplace_banner_slides
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all access for service role" ON marketplace_banner_slides
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow read access for authenticated users" ON marketplace_banner_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all access for service role" ON marketplace_banner_settings
  FOR ALL USING (auth.role() = 'service_role');
