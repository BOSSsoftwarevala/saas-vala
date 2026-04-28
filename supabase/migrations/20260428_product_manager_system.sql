-- =====================================================
-- PRODUCT MANAGER SYSTEM - CODECANYON LEVEL
-- =====================================================
-- STRICT MODE: NO UI CHANGE • ONLY BACKEND UPGRADE
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- MODULE 7: CATEGORY SYSTEM
-- =====================================================
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- EXTENDED PRODUCTS TABLE (MODULE 1, 2, 5)
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  full_description TEXT,
  description TEXT, -- Legacy field
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  tags TEXT[],
  price DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'draft', -- active, draft, suspended
  business_type TEXT DEFAULT 'software',
  target_industry TEXT DEFAULT 'software',
  
  -- Demo System (MODULE 4)
  demo_url TEXT,
  demo_enabled BOOLEAN DEFAULT false,
  demo_credentials JSONB DEFAULT '{}'::jsonb,
  demo_video_url TEXT,
  
  -- File System (MODULE 3)
  main_file_url TEXT,
  documentation_url TEXT,
  video_url TEXT,
  apk_url TEXT,
  apk_enabled BOOLEAN DEFAULT false,
  
  -- SEO Fields (MODULE 5)
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[],
  og_image TEXT,
  canonical_url TEXT,
  
  -- Marketplace Fields
  thumbnail_url TEXT,
  featured BOOLEAN DEFAULT false,
  trending BOOLEAN DEFAULT false,
  marketplace_visible BOOLEAN DEFAULT false,
  discount_percent INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 4.5,
  license_enabled BOOLEAN DEFAULT true,
  buy_enabled BOOLEAN DEFAULT true,
  
  -- Git Import (MODULE 10)
  git_repo_url TEXT,
  git_repo_owner TEXT,
  git_repo_name TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  
  -- Legacy Fields
  features TEXT[],
  git_repo_url TEXT,
  demo_login TEXT,
  demo_password TEXT,
  deploy_status TEXT DEFAULT 'pending',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 3: FILE & VERSION SYSTEM
-- =====================================================
CREATE TABLE IF NOT EXISTS product_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL, -- main, documentation, extra, apk
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_mime_type TEXT,
  version TEXT,
  changelog TEXT,
  release_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  download_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 8: LICENSE SYSTEM
-- =====================================================
CREATE TABLE IF NOT EXISTS licenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  license_key TEXT NOT NULL UNIQUE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID,
  device_id TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active', -- active, suspended, expired, revoked
  expires_at TIMESTAMP WITH TIME ZONE,
  max_activations INTEGER DEFAULT 5,
  current_activations INTEGER DEFAULT 0,
  last_validated_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 9: DOWNLOAD LOGS
-- =====================================================
CREATE TABLE IF NOT EXISTS download_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES product_files(id) ON DELETE CASCADE,
  license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  download_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 6: BLOG SYSTEM
-- =====================================================
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT,
  excerpt TEXT,
  thumbnail_url TEXT,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft', -- published, draft, archived
  tags TEXT[],
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  
  -- SEO Fields
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[],
  og_image TEXT,
  canonical_url TEXT,
  
  -- Internal Linking
  linked_product_ids UUID[] REFERENCES products(id),
  
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 5: SEO ENGINE - SITEMAP TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS sitemap_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- product, blog, category, static
  resource_id UUID,
  priority DECIMAL(3,2) DEFAULT 0.5,
  change_frequency TEXT DEFAULT 'weekly',
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE (MODULE 12)
-- =====================================================

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_marketplace_visible ON products(marketplace_visible);
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Product files indexes
CREATE INDEX IF NOT EXISTS idx_product_files_product_id ON product_files(product_id);
CREATE INDEX IF NOT EXISTS idx_product_files_type ON product_files(file_type);
CREATE INDEX IF NOT EXISTS idx_product_files_version ON product_files(version);

-- Licenses indexes
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_product_id ON licenses(product_id);
CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

-- Download logs indexes
CREATE INDEX IF NOT EXISTS idx_download_logs_file_id ON download_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_user_id ON download_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_created_at ON download_logs(created_at DESC);

-- Blog posts indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON blog_posts USING GIN(tags);

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_product_categories_slug ON product_categories(slug);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent_id ON product_categories(parent_id);

-- Sitemap indexes
CREATE INDEX IF NOT EXISTS idx_sitemap_entries_url ON sitemap_entries(url);
CREATE INDEX IF NOT EXISTS idx_sitemap_entries_type ON sitemap_entries(type);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for products" ON products
  FOR SELECT TO anon, authenticated USING (marketplace_visible = true OR status = 'active');
CREATE POLICY "Authenticated insert products" ON products
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update products" ON products
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete products" ON products
  FOR DELETE TO authenticated USING (true);

-- Product files
ALTER TABLE product_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for product files" ON product_files
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Authenticated insert product files" ON product_files
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update product files" ON product_files
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete product files" ON product_files
  FOR DELETE TO authenticated USING (true);

-- Licenses
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own licenses" ON licenses
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Authenticated insert licenses" ON licenses
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update licenses" ON licenses
  FOR UPDATE TO authenticated USING (true);

-- Download logs
ALTER TABLE download_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own download logs" ON download_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Authenticated insert download logs" ON download_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Blog posts
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published blog posts" ON blog_posts
  FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "Authenticated insert blog posts" ON blog_posts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update blog posts" ON blog_posts
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete blog posts" ON blog_posts
  FOR DELETE TO authenticated USING (true);

-- Product categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON product_categories
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Authenticated insert categories" ON product_categories
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update categories" ON product_categories
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete categories" ON product_categories
  FOR DELETE TO authenticated USING (true);

-- Sitemap entries
ALTER TABLE sitemap_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sitemap" ON sitemap_entries
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated insert sitemap" ON sitemap_entries
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update sitemap" ON sitemap_entries
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete sitemap" ON sitemap_entries
  FOR DELETE TO authenticated USING (true);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_files_updated_at BEFORE UPDATE ON product_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTIONS: AUTO-GENERATE SLUG
-- =====================================================

CREATE OR REPLACE FUNCTION generate_slug(text_param TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(regexp_replace(regexp_replace(text_param, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTIONS: LICENSE KEY GENERATION
-- =====================================================

CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..25 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    IF i IN (5, 10, 15, 20) THEN
      result := result || '-';
    END IF;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
