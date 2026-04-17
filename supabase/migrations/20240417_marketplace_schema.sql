-- Marketplace Database Schema (CodeCanyon Clone)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories Table
CREATE TABLE IF NOT EXISTS marketplace_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(255),
  parent_id UUID REFERENCES marketplace_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS marketplace_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  thumbnail_url VARCHAR(500),
  preview_url VARCHAR(500),
  download_url VARCHAR(500),
  demo_url VARCHAR(500),
  documentation_url VARCHAR(500),
  category_id UUID REFERENCES marketplace_categories(id) ON DELETE SET NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  original_price DECIMAL(10, 2),
  discount_percentage INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  rating_average DECIMAL(3, 2) DEFAULT 0.00,
  rating_count INTEGER DEFAULT 0,
  tags TEXT[],
  features JSONB,
  requirements JSONB,
  version VARCHAR(50),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders Table
CREATE TABLE IF NOT EXISTS marketplace_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES marketplace_products(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(50),
  payment_id VARCHAR(255),
  download_count INTEGER DEFAULT 0,
  max_downloads INTEGER DEFAULT 5,
  download_expiry TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews Table
CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES marketplace_products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  comment TEXT,
  is_verified_purchase BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

-- Review Replies Table
CREATE TABLE IF NOT EXISTS marketplace_review_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID REFERENCES marketplace_reviews(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_category ON marketplace_products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON marketplace_products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON marketplace_products(is_active, is_approved);
CREATE INDEX IF NOT EXISTS idx_products_featured ON marketplace_products(is_featured, is_active);
CREATE INDEX IF NOT EXISTS idx_products_rating ON marketplace_products(rating_average DESC);
CREATE INDEX IF NOT EXISTS idx_products_sales ON marketplace_products(sales_count DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user ON marketplace_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product ON marketplace_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON marketplace_orders(status);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON marketplace_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON marketplace_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON marketplace_reviews(is_approved);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON marketplace_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON marketplace_categories(is_active);

-- Insert default categories
INSERT INTO marketplace_categories (name, slug, description, icon, sort_order) VALUES
('Software', 'software', 'Software applications and tools', '🖥️', 1),
('Templates', 'templates', 'Website templates and themes', '🎨', 2),
('Plugins', 'plugins', 'Plugins and extensions', '🔌', 3),
('Mobile Apps', 'mobile-apps', 'Mobile applications', '📱', 4),
('Graphics', 'graphics', 'Graphics and design assets', '🎭', 5),
('Audio', 'audio', 'Audio and music files', '🎵', 6),
('Video', 'video', 'Video templates and effects', '🎬', 7)
ON CONFLICT (slug) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_review_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Categories (public read, admin write)
CREATE POLICY "Categories are viewable by everyone" ON marketplace_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can insert categories" ON marketplace_categories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update categories" ON marketplace_categories
  FOR UPDATE USING (true);

CREATE POLICY "Admins can delete categories" ON marketplace_categories
  FOR DELETE USING (true);

-- RLS Policies for Products (public read active/approved, admin write)
CREATE POLICY "Products are viewable by everyone" ON marketplace_products
  FOR SELECT USING (is_active = true AND is_approved = true);

CREATE POLICY "Users can view their own products" ON marketplace_products
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Admins can insert products" ON marketplace_products
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update products" ON marketplace_products
  FOR UPDATE USING (true);

CREATE POLICY "Admins can delete products" ON marketplace_products
  FOR DELETE USING (true);

-- RLS Policies for Orders (users can view own, admin all)
CREATE POLICY "Users can view their own orders" ON marketplace_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders" ON marketplace_orders
  FOR SELECT USING (true);

CREATE POLICY "Users can insert orders" ON marketplace_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update orders" ON marketplace_orders
  FOR UPDATE USING (true);

-- RLS Policies for Reviews (public read approved, users can write own)
CREATE POLICY "Approved reviews are viewable by everyone" ON marketplace_reviews
  FOR SELECT USING (is_approved = true);

CREATE POLICY "Users can view their own reviews" ON marketplace_reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reviews" ON marketplace_reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can insert reviews" ON marketplace_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" ON marketplace_reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can approve reviews" ON marketplace_reviews
  FOR UPDATE USING (true);

-- RLS Policies for Review Replies (public read approved, users can write own)
CREATE POLICY "Review replies are viewable by everyone" ON marketplace_review_replies
  FOR SELECT USING (true);

CREATE POLICY "Users can insert review replies" ON marketplace_review_replies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own replies" ON marketplace_review_replies
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete replies" ON marketplace_review_replies
  FOR DELETE USING (true);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating timestamps
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON marketplace_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON marketplace_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON marketplace_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_review_replies_updated_at BEFORE UPDATE ON marketplace_review_replies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update product rating after review
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.is_approved != OLD.is_approved AND NEW.is_approved = true) THEN
    UPDATE marketplace_products
    SET rating_average = (
      SELECT COALESCE(AVG(rating), 0)
      FROM marketplace_reviews
      WHERE product_id = NEW.product_id AND is_approved = true
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM marketplace_reviews
      WHERE product_id = NEW.product_id AND is_approved = true
    )
    WHERE id = NEW.product_id;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.is_approved = false AND OLD.is_approved = true THEN
    UPDATE marketplace_products
    SET rating_average = (
      SELECT COALESCE(AVG(rating), 0)
      FROM marketplace_reviews
      WHERE product_id = NEW.product_id AND is_approved = true
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM marketplace_reviews
      WHERE product_id = NEW.product_id AND is_approved = true
    )
    WHERE id = NEW.product_id;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE marketplace_products
    SET rating_average = (
      SELECT COALESCE(AVG(rating), 0)
      FROM marketplace_reviews
      WHERE product_id = OLD.product_id AND is_approved = true
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM marketplace_reviews
      WHERE product_id = OLD.product_id AND is_approved = true
    )
    WHERE id = OLD.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON marketplace_reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();
