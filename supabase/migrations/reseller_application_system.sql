-- Reseller Application System Migration
-- Adds reseller application workflow with approval process

-- Create reseller_applications table
CREATE TABLE IF NOT EXISTS reseller_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    business_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_reseller_applications_status ON reseller_applications(status);
CREATE INDEX IF NOT EXISTS idx_reseller_applications_email ON reseller_applications(email);
CREATE INDEX IF NOT EXISTS idx_reseller_applications_user_id ON reseller_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_reseller_applications_created_at ON reseller_applications(created_at);

-- Enable RLS
ALTER TABLE reseller_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own applications" ON reseller_applications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create applications" ON reseller_applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admin full access applications" ON reseller_applications
    FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- Add credits column to resellers if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resellers' AND column_name = 'credits') THEN
        ALTER TABLE resellers ADD COLUMN credits DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;

-- Update trigger for reseller_applications
CREATE OR REPLACE FUNCTION update_reseller_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reseller_applications_updated_at
    BEFORE UPDATE ON reseller_applications
    FOR EACH ROW EXECUTE FUNCTION update_reseller_applications_updated_at();

-- Insert sample pending applications for testing
INSERT INTO reseller_applications (name, email, phone, business_name, status)
VALUES
    ('John Smith', 'john.smith@example.com', '+1234567890', 'Smith Enterprises', 'pending'),
    ('Sarah Johnson', 'sarah.j@example.com', '+1987654321', 'Johnson Solutions', 'pending'),
    ('Mike Davis', 'mike.davis@techcorp.com', '+1555123456', 'TechCorp Resellers', 'pending')
ON CONFLICT DO NOTHING;