-- Cloud Deployments and Backup System Migration
-- This migration adds tables for cloud deployments, backups, and enhances existing tables

-- Create cloud_deployments table
CREATE TABLE IF NOT EXISTS cloud_deployments (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    region TEXT NOT NULL CHECK (region IN ('India', 'US', 'EU', 'Unknown')),
    status TEXT NOT NULL CHECK (status IN ('deploying', 'live', 'failed', 'stopped', 'suspended')),
    load_balancer_url TEXT,
    backup_server_id TEXT REFERENCES servers(id) ON DELETE SET NULL,
    failover_enabled BOOLEAN DEFAULT FALSE,
    auto_scaling BOOLEAN DEFAULT TRUE,
    health_status TEXT DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'warning', 'critical')),
    last_health_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create backups table
CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'server', 'key', 'reseller', 'lead')),
    entity_id TEXT NOT NULL,
    backup_type TEXT NOT NULL CHECK (backup_type IN ('auto', 'manual')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    file_path TEXT,
    size_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    restored_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cloud_deployments_product_id ON cloud_deployments(product_id);
CREATE INDEX IF NOT EXISTS idx_cloud_deployments_server_id ON cloud_deployments(server_id);
CREATE INDEX IF NOT EXISTS idx_cloud_deployments_region ON cloud_deployments(region);
CREATE INDEX IF NOT EXISTS idx_cloud_deployments_status ON cloud_deployments(status);

CREATE INDEX IF NOT EXISTS idx_backups_entity_type ON backups(entity_type);
CREATE INDEX IF NOT EXISTS idx_backups_entity_id ON backups(entity_id);
CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at);

-- Add load column to servers table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servers' AND column_name = 'load') THEN
        ALTER TABLE servers ADD COLUMN load INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add updated_at trigger for cloud_deployments
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cloud_deployments_updated_at
    BEFORE UPDATE ON cloud_deployments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO cloud_deployments (id, product_id, server_id, region, status, failover_enabled, auto_scaling, health_status, last_health_check)
SELECT
    'deploy-' || gen_random_uuid()::text,
    p.id,
    s.id,
    CASE WHEN random() < 0.33 THEN 'US' WHEN random() < 0.66 THEN 'EU' ELSE 'India' END,
    CASE WHEN random() < 0.8 THEN 'live' ELSE 'deploying' END,
    random() < 0.7,
    random() < 0.8,
    CASE WHEN random() < 0.9 THEN 'healthy' ELSE 'warning' END,
    NOW() - (random() * interval '1 hour')
FROM products p
CROSS JOIN servers s
WHERE p.status = 'active' AND s.status = 'live'
LIMIT 5;

-- Insert sample backup data
INSERT INTO backups (id, entity_type, entity_id, backup_type, status, size_bytes, created_at)
SELECT
    'backup-' || gen_random_uuid()::text,
    CASE WHEN random() < 0.2 THEN 'product'
         WHEN random() < 0.4 THEN 'server'
         WHEN random() < 0.6 THEN 'key'
         WHEN random() < 0.8 THEN 'reseller'
         ELSE 'lead' END,
    CASE WHEN random() < 0.2 THEN (SELECT id FROM products LIMIT 1 OFFSET (random() * (SELECT count(*) FROM products))::int)
         WHEN random() < 0.4 THEN (SELECT id FROM servers LIMIT 1 OFFSET (random() * (SELECT count(*) FROM servers))::int)
         WHEN random() < 0.6 THEN (SELECT id FROM license_keys LIMIT 1 OFFSET (random() * (SELECT count(*) FROM license_keys))::int)
         WHEN random() < 0.8 THEN (SELECT id FROM resellers LIMIT 1 OFFSET (random() * (SELECT count(*) FROM resellers))::int)
         ELSE (SELECT id FROM leads LIMIT 1 OFFSET (random() * (SELECT count(*) FROM leads))::int) END,
    CASE WHEN random() < 0.7 THEN 'auto' ELSE 'manual' END,
    CASE WHEN random() < 0.95 THEN 'completed' ELSE 'pending' END,
    (random() * 100000000)::bigint,
    NOW() - (random() * interval '7 days')
FROM generate_series(1, 10);