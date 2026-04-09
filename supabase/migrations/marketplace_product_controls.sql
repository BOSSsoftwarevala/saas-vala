-- Marketplace Product Control System Migration
-- Ensures all product control columns exist for admin management

-- Add control columns to products if they don't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS demo_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS buy_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS apk_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS download_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS requires_api_key BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS api_documentation_url TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_demo_enabled ON products(demo_enabled);
CREATE INDEX IF NOT EXISTS idx_products_buy_enabled ON products(buy_enabled);
CREATE INDEX IF NOT EXISTS idx_products_apk_enabled ON products(apk_enabled);
CREATE INDEX IF NOT EXISTS idx_products_download_enabled ON products(download_enabled);
CREATE INDEX IF NOT EXISTS idx_products_is_visible ON products(is_visible);

-- Create marketplace_product_controls table for tracking control changes
CREATE TABLE IF NOT EXISTS marketplace_product_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    demo_enabled BOOLEAN NOT NULL DEFAULT false,
    buy_enabled BOOLEAN NOT NULL DEFAULT true,
    apk_enabled BOOLEAN NOT NULL DEFAULT false,
    download_enabled BOOLEAN NOT NULL DEFAULT false,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    controlled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_product_controls_product_id ON marketplace_product_controls(product_id);
CREATE INDEX IF NOT EXISTS idx_product_controls_changed_at ON marketplace_product_controls(changed_at DESC);

-- Enable RLS
ALTER TABLE marketplace_product_controls ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product controls
CREATE POLICY "Super admin full access controls" ON marketplace_product_controls
    FOR ALL USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view controls" ON marketplace_product_controls
    FOR SELECT USING (true);

-- Create function to log control changes
CREATE OR REPLACE FUNCTION log_product_control_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (
        NEW.demo_enabled != OLD.demo_enabled OR
        NEW.buy_enabled != OLD.buy_enabled OR
        NEW.apk_enabled != OLD.apk_enabled OR
        NEW.download_enabled != OLD.download_enabled OR
        NEW.is_visible != OLD.is_visible
    ) THEN
        INSERT INTO marketplace_product_controls (
            product_id,
            demo_enabled,
            buy_enabled,
            apk_enabled,
            download_enabled,
            is_visible,
            controlled_by
        ) VALUES (
            NEW.id,
            NEW.demo_enabled,
            NEW.buy_enabled,
            NEW.apk_enabled,
            NEW.download_enabled,
            NEW.is_visible,
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for control logging
DROP TRIGGER IF EXISTS log_product_controls ON products;
CREATE TRIGGER log_product_controls
    AFTER UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION log_product_control_change();
