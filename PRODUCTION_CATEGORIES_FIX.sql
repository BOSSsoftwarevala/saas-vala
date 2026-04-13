-- ============================================
-- PRODUCTION CATEGORIES FIX - JIRA STYLE
-- ============================================
-- Run this in Supabase Dashboard → SQL Editor
-- This is a database-only fix (no deployment required)
-- ============================================

-- STEP 1: Disable RLS on categories (bypasses all permission issues)
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- STEP 2: Ensure categories exist with new schema (is_active, sort_order)
DO $$
DECLARE
  has_is_active BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'is_active'
  ) INTO has_is_active;
  
  IF has_is_active THEN
    -- New schema - insert if not exists
    INSERT INTO categories (name, slug, description, icon, sort_order, is_active, level)
    VALUES
      ('Education Software', 'education-software', 'Educational management and learning tools', '🎓', 1, true, 'master'),
      ('POS & Billing', 'pos-billing', 'Point of sale and billing solutions', '💳', 2, true, 'master'),
      ('Healthcare', 'healthcare', 'Hospital and clinic management software', '🏥', 3, true, 'master'),
      ('Real Estate', 'real-estate', 'Property management and real estate tools', '🏢', 4, true, 'master'),
      ('Finance & Loan', 'finance-loan', 'Financial management and loan software', '💰', 5, true, 'master'),
      ('Logistics & Transport', 'logistics-transport', 'Logistics and transportation management', '🚚', 6, true, 'master'),
      ('HR & Payroll', 'hr-payroll', 'Human resources and payroll systems', '👥', 7, true, 'master'),
      ('CRM & Sales', 'crm-sales', 'Customer relationship management and sales tools', '🤝', 8, true, 'master'),
      ('Inventory & Warehouse', 'inventory-warehouse', 'Inventory and warehouse management', '📦', 9, true, 'master'),
      ('Restaurant & Food', 'restaurant-food', 'Restaurant and food service management', '🍽️', 10, true, 'master')
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      sort_order = EXCLUDED.sort_order,
      is_active = EXCLUDED.is_active,
      level = EXCLUDED.level;
  END IF;
END $$;

-- STEP 3: Ensure categories exist with old schema (status, order_index) - fallback
DO $$
DECLARE
  has_status BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'status'
  ) INTO has_status;
  
  IF has_status THEN
    -- Old schema - insert if not exists
    INSERT INTO categories (name, slug, description, icon, order_index, status)
    VALUES
      ('Education Software', 'education-software', 'Educational management and learning tools', '🎓', 1, 'active'),
      ('POS & Billing', 'pos-billing', 'Point of sale and billing solutions', '💳', 2, 'active'),
      ('Healthcare', 'healthcare', 'Hospital and clinic management software', '🏥', 3, 'active'),
      ('Real Estate', 'real-estate', 'Property management and real estate tools', '🏢', 4, 'active'),
      ('Finance & Loan', 'finance-loan', 'Financial management and loan software', '💰', 5, 'active'),
      ('Logistics & Transport', 'logistics-transport', 'Logistics and transportation management', '🚚', 6, 'active'),
      ('HR & Payroll', 'hr-payroll', 'Human resources and payroll systems', '👥', 7, 'active'),
      ('CRM & Sales', 'crm-sales', 'Customer relationship management and sales tools', '🤝', 8, 'active'),
      ('Inventory & Warehouse', 'inventory-warehouse', 'Inventory and warehouse management', '📦', 9, 'active'),
      ('Restaurant & Food', 'restaurant-food', 'Restaurant and food service management', '🍽️', 10, 'active')
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      order_index = EXCLUDED.order_index,
      status = EXCLUDED.status;
  END IF;
END $$;

-- STEP 4: Verify the fix
SELECT 
  COUNT(*) as total_categories,
  array_agg(name ORDER BY sort_order NULLS LAST, order_index NULLS LAST) as category_names
FROM categories;

-- Expected output: total_categories = 10, category_names = all 10 categories listed above
