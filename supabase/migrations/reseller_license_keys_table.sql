-- Create reseller_license_keys table for reseller product purchases
CREATE TABLE IF NOT EXISTS reseller_license_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    license_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_reseller_license_keys_user_id ON reseller_license_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_reseller_license_keys_product_id ON reseller_license_keys(product_id);
CREATE INDEX IF NOT EXISTS idx_reseller_license_keys_license_key ON reseller_license_keys(license_key);
CREATE INDEX IF NOT EXISTS idx_reseller_license_keys_status ON reseller_license_keys(status);
CREATE INDEX IF NOT EXISTS idx_reseller_license_keys_expires_at ON reseller_license_keys(expires_at);

-- Enable RLS
ALTER TABLE reseller_license_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own license keys" ON reseller_license_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super admin full access license keys" ON reseller_license_keys
    FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- Update trigger
CREATE OR REPLACE FUNCTION update_reseller_license_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reseller_license_keys_updated_at
    BEFORE UPDATE ON reseller_license_keys
    FOR EACH ROW EXECUTE FUNCTION update_reseller_license_keys_updated_at();