-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  order_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create softwares table
CREATE TABLE IF NOT EXISTS softwares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  description TEXT,
  tagline TEXT,
  icon TEXT,
  demo_url TEXT,
  details_url TEXT,
  price DECIMAL(10,2) DEFAULT 5.00,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'out_of_stock')),
  featured BOOLEAN DEFAULT FALSE,
  download_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create software_notifications table for notify me feature
CREATE TABLE IF NOT EXISTS software_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  software_id UUID REFERENCES softwares(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(software_id, email)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);
CREATE INDEX IF NOT EXISTS idx_softwares_category_id ON softwares(category_id);
CREATE INDEX IF NOT EXISTS idx_softwares_slug ON softwares(slug);
CREATE INDEX IF NOT EXISTS idx_softwares_status ON softwares(status);
CREATE INDEX IF NOT EXISTS idx_softwares_featured ON softwares(featured);
CREATE INDEX IF NOT EXISTS idx_software_notifications_software_id ON software_notifications(software_id);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE softwares ENABLE ROW LEVEL SECURITY;
ALTER TABLE software_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Categories are viewable by everyone" ON categories FOR SELECT USING (status = 'active');
CREATE POLICY "Softwares are viewable by everyone" ON softwares FOR SELECT USING (status = 'active');
CREATE POLICY "Anyone can insert notifications" ON software_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own notifications" ON software_notifications FOR SELECT USING (true);

-- Insert default categories
INSERT INTO categories (name, slug, description, icon, order_index) VALUES
('Education Software', 'education-software', 'Educational management and learning tools', '🎓', 1),
('POS & Billing', 'pos-billing', 'Point of sale and billing solutions', '💳', 2),
('Healthcare', 'healthcare', 'Hospital and clinic management software', '🏥', 3),
('Real Estate', 'real-estate', 'Property management and real estate tools', '🏢', 4),
('Finance & Loan', 'finance-loan', 'Financial management and loan software', '💰', 5),
('Logistics & Transport', 'logistics-transport', 'Logistics and transportation management', '🚚', 6),
('HR & Payroll', 'hr-payroll', 'Human resources and payroll systems', '👥', 7),
('CRM & Sales', 'crm-sales', 'Customer relationship management and sales tools', '🤝', 8),
('Inventory & Warehouse', 'inventory-warehouse', 'Inventory and warehouse management', '📦', 9),
('Restaurant & Food', 'restaurant-food', 'Restaurant and food service management', '🍽️', 10),
('Salon & Gym', 'salon-gym', 'Salon and gym management software', '💇‍♂️', 11),
('Construction', 'construction', 'Construction project management', '🏗️', 12),
('Legal', 'legal', 'Legal practice management software', '⚖️', 13),
('Agriculture', 'agriculture', 'Agricultural management tools', '🌾', 14),
('Travel', 'travel', 'Travel and tourism management', '✈️', 15),
('Event Management', 'event-management', 'Event planning and management', '📅', 16),
('Security & Surveillance', 'security-surveillance', 'Security and surveillance systems', '🔒', 17),
('Franchise System', 'franchise-system', 'Franchise management software', '🏪', 18),
('E-commerce Tools', 'ecommerce-tools', 'E-commerce and online store tools', '🛒', 19),
('AI Tools', 'ai-tools', 'Artificial intelligence and machine learning tools', '🤖', 20),
('Document Management', 'document-management', 'Document and file management systems', '📄', 21),
('Call Center', 'call-center', 'Call center and customer support software', '📞', 22),
('Marketing Tools', 'marketing-tools', 'Marketing automation and tools', '📢', 23),
('Analytics & BI', 'analytics-bi', 'Business intelligence and analytics', '📊', 24),
('School ERP', 'school-erp', 'School management ERP systems', '🏫', 25),
('Hospital ERP', 'hospital-erp', 'Hospital management ERP systems', '🏥', 26),
('Retail ERP', 'retail-erp', 'Retail business ERP solutions', '🏬', 27),
('Manufacturing ERP', 'manufacturing-erp', 'Manufacturing ERP systems', '🏭', 28),
('SaaS Tools', 'saas-tools', 'Software as a Service tools and platforms', '☁️', 29),
('Offline Software', 'offline-software', 'Offline desktop and standalone software', '💻', 30)
ON CONFLICT (slug) DO NOTHING;

-- Insert sample software data
INSERT INTO softwares (name, slug, category_id, description, tagline, icon, demo_url, price) VALUES
('School Management Pro', 'school-management-pro', (SELECT id FROM categories WHERE slug = 'education-software'), 'Complete school management system with student tracking, attendance, and grading', 'Manage your school efficiently', '🎓', '/demo/school-management-pro', 5.00),
('Restaurant POS System', 'restaurant-pos-system', (SELECT id FROM categories WHERE slug = 'pos-billing'), 'Point of sale system for restaurants with order management and billing', 'Streamline your restaurant operations', '🍽️', '/demo/restaurant-pos-system', 5.00),
('Hospital Management', 'hospital-management', (SELECT id FROM categories WHERE slug = 'healthcare'), 'Comprehensive hospital management system with patient records and appointments', 'Modern healthcare management', '🏥', '/demo/hospital-management', 5.00),
('Property Manager', 'property-manager', (SELECT id FROM categories WHERE slug = 'real-estate'), 'Real estate property management with tenant tracking and maintenance', 'Manage properties with ease', '🏢', '/demo/property-manager', 5.00),
('Finance Tracker', 'finance-tracker', (SELECT id FROM categories WHERE slug = 'finance-loan'), 'Personal and business finance tracking with loan management', 'Take control of your finances', '💰', '/demo/finance-tracker', 5.00)
ON CONFLICT (slug) DO NOTHING;
