-- Key Management System Migration
-- This migration creates tables for the comprehensive key management system

-- Main keys table
CREATE TABLE IF NOT EXISTS keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  key_value TEXT NOT NULL UNIQUE, -- Encrypted key
  key_hash TEXT NOT NULL UNIQUE, -- Hashed version for verification
  type TEXT NOT NULL CHECK (type IN ('api', 'feature', 'license')),
  key_size TEXT CHECK (key_size IN ('nano', 'micro', 'standard')) DEFAULT 'standard',
  prefix TEXT DEFAULT 'VALA',
  checksum TEXT NOT NULL,
  
  -- Usage control
  usage_limit INTEGER DEFAULT 1, -- Number of device/activations allowed
  used_count INTEGER DEFAULT 0,
  device_bindings JSONB DEFAULT '[]', -- Array of device IDs bound to this key
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired', 'revoked')),
  expiry_date TIMESTAMPTZ,
  grace_period_days INTEGER DEFAULT 0,
  
  -- Owner info
  owner_name TEXT,
  owner_email TEXT,
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  
  -- Security
  last_verified_at TIMESTAMPTZ,
  last_device_id TEXT,
  ip_restrictions TEXT[] DEFAULT '{}',
  geo_restrictions TEXT[] DEFAULT '{}',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  notes TEXT,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Key activations table (track activation history)
CREATE TABLE IF NOT EXISTS key_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  device_id TEXT NOT NULL,
  device_fingerprint JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  location JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated', 'blocked')),
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Key usage logs table
CREATE TABLE IF NOT EXISTS key_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  activation_id UUID REFERENCES key_activations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  device_id TEXT,
  action TEXT NOT NULL, -- verify, activate, deactivate, use, etc.
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'blocked')),
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device fingerprints table
CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  fingerprint JSONB NOT NULL, -- CPU, OS, Disk, MAC hash
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  seen_count INTEGER DEFAULT 1,
  is_blocked BOOLEAN DEFAULT FALSE,
  block_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Key validation attempts (for security - brute force protection)
CREATE TABLE IF NOT EXISTS key_validation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_value TEXT NOT NULL,
  device_id TEXT,
  ip_address TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_keys_product_id ON keys(product_id);
CREATE INDEX IF NOT EXISTS idx_keys_type ON keys(type);
CREATE INDEX IF NOT EXISTS idx_keys_status ON keys(status);
CREATE INDEX IF NOT EXISTS idx_keys_assigned_user_id ON keys(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_keys_key_hash ON keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_keys_expiry_date ON keys(expiry_date);
CREATE INDEX IF NOT EXISTS idx_keys_deleted_at ON keys(deleted_at);

CREATE INDEX IF NOT EXISTS idx_key_activations_key_id ON key_activations(key_id);
CREATE INDEX IF NOT EXISTS idx_key_activations_user_id ON key_activations(user_id);
CREATE INDEX IF NOT EXISTS idx_key_activations_device_id ON key_activations(device_id);
CREATE INDEX IF NOT EXISTS idx_key_activations_status ON key_activations(status);

CREATE INDEX IF NOT EXISTS idx_key_usage_logs_key_id ON key_usage_logs(key_id);
CREATE INDEX IF NOT EXISTS idx_key_usage_logs_user_id ON key_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_key_usage_logs_action ON key_usage_logs(action);
CREATE INDEX IF NOT EXISTS idx_key_usage_logs_created_at ON key_usage_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_device_fingerprints_device_id ON device_fingerprints(device_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_is_blocked ON device_fingerprints(is_blocked);

CREATE INDEX IF NOT EXISTS idx_key_validation_attempts_key_value ON key_validation_attempts(key_value);
CREATE INDEX IF NOT EXISTS idx_key_validation_attempts_ip_address ON key_validation_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_key_validation_attempts_attempted_at ON key_validation_attempts(attempted_at);

-- Updated at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_keys_updated_at BEFORE UPDATE ON keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_fingerprints_updated_at BEFORE UPDATE ON device_fingerprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check if key is valid
CREATE OR REPLACE FUNCTION is_key_valid(p_key_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_key keys%ROWTYPE;
  v_current_time TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_key FROM keys WHERE id = p_key_id AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check status
  IF v_key.status NOT IN ('active') THEN
    RETURN FALSE;
  END IF;
  
  -- Check expiry (with grace period)
  IF v_key.expiry_date IS NOT NULL THEN
    IF v_key.expiry_date + (v_key.grace_period_days || ' days')::INTERVAL < v_current_time THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Check usage limit
  IF v_key.usage_limit IS NOT NULL AND v_key.used_count >= v_key.usage_limit THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to increment key usage
CREATE OR REPLACE FUNCTION increment_key_usage(p_key_id UUID, p_device_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_key keys%ROWTYPE;
  v_device_count INTEGER;
BEGIN
  -- Get key info
  SELECT * INTO v_key FROM keys WHERE id = p_key_id AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if device is already bound
  SELECT COUNT(*) INTO v_device_count 
  FROM jsonb_array_elements(v_key.device_bindings) AS elem
  WHERE elem::TEXT = p_device_id;
  
  -- If device not bound and limit reached
  IF v_device_count = 0 AND v_key.usage_limit IS NOT NULL AND v_key.used_count >= v_key.usage_limit THEN
    RETURN FALSE;
  END IF;
  
  -- If device not bound, add it
  IF v_device_count = 0 THEN
    UPDATE keys 
    SET 
      device_bindings = device_bindings || to_jsonb(p_device_id),
      used_count = used_count + 1,
      last_device_id = p_device_id,
      last_verified_at = NOW()
    WHERE id = p_key_id;
  ELSE
    UPDATE keys 
    SET 
      last_device_id = p_device_id,
      last_verified_at = NOW()
    WHERE id = p_key_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to expire keys (for cron)
CREATE OR REPLACE FUNCTION expire_keys()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER := 0;
BEGIN
  UPDATE keys
  SET status = 'expired'
  WHERE 
    status = 'active'
    AND expiry_date IS NOT NULL
    AND expiry_date < NOW()
    AND deleted_at IS NULL;
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to log validation attempt (for brute force protection)
CREATE OR REPLACE FUNCTION log_validation_attempt(
  p_key_value TEXT,
  p_device_id TEXT,
  p_ip_address TEXT,
  p_status TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO key_validation_attempts (key_value, device_id, ip_address, status, metadata)
  VALUES (p_key_value, p_device_id, p_ip_address, p_status, p_metadata);
  
  -- Clean up old attempts (older than 1 hour)
  DELETE FROM key_validation_attempts 
  WHERE attempted_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to check for brute force attempts
CREATE OR REPLACE FUNCTION is_brute_force_detected(p_ip_address TEXT, p_key_value TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_attempt_count INTEGER;
BEGIN
  -- Check IP-based attempts
  SELECT COUNT(*) INTO v_attempt_count
  FROM key_validation_attempts
  WHERE 
    ip_address = p_ip_address
    AND status = 'failed'
    AND attempted_at > NOW() - INTERVAL '15 minutes';
  
  IF v_attempt_count >= 10 THEN
    RETURN TRUE;
  END IF;
  
  -- Check key-based attempts
  SELECT COUNT(*) INTO v_attempt_count
  FROM key_validation_attempts
  WHERE 
    key_value = p_key_value
    AND status = 'failed'
    AND attempted_at > NOW() - INTERVAL '15 minutes';
  
  IF v_attempt_count >= 5 THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to assign key to user (atomic operation)
CREATE OR REPLACE FUNCTION assign_key_to_user(p_key_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_key keys%ROWTYPE;
BEGIN
  -- Lock the key row
  SELECT * INTO v_key FROM keys WHERE id = p_key_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if key is already assigned
  IF v_key.assigned_user_id IS NOT NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if key is valid
  IF NOT is_key_valid(p_key_id) THEN
    RETURN FALSE;
  END IF;
  
  -- Assign key
  UPDATE keys
  SET 
    assigned_user_id = p_user_id,
    assigned_at = NOW(),
    status = 'active'
  WHERE id = p_key_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;

-- RLS for keys
CREATE POLICY "Admins can view all keys" ON keys
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

CREATE POLICY "Admins can insert keys" ON keys
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

CREATE POLICY "Admins can update keys" ON keys
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

CREATE POLICY "Admins can delete keys (soft)" ON keys
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

CREATE POLICY "Users can view their assigned keys" ON keys
  FOR SELECT TO authenticated
  USING (assigned_user_id = auth.uid());

-- RLS for key_activations
CREATE POLICY "Admins can view all key activations" ON key_activations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

CREATE POLICY "Users can view their key activations" ON key_activations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert key activations" ON key_activations
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- RLS for key_usage_logs
CREATE POLICY "Admins can view all key usage logs" ON key_usage_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

CREATE POLICY "Users can view their key usage logs" ON key_usage_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert key usage logs" ON key_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- RLS for device_fingerprints
CREATE POLICY "Admins can view all device fingerprints" ON device_fingerprints
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  ));

CREATE POLICY "System can insert device fingerprints" ON device_fingerprints
  FOR INSERT TO authenticated
  WITH CHECK (true);
