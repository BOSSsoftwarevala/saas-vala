-- Ensure categories exist regardless of schema version
-- This migration tries both old and new schemas to guarantee categories are present

-- Try new schema first (is_active, sort_order)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'is_active') THEN
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
    ON CONFLICT (slug) DO NOTHING;
  ELSE
    -- Fallback to old schema (status, order_index)
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
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;
