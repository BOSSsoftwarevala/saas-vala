-- Create remote_clients table for UltraViewer clone system
CREATE TABLE IF NOT EXISTS remote_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT UNIQUE NOT NULL, -- 8-10 digit auto-generated ID
    password TEXT NOT NULL, -- Auto-generated password
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create remote_sessions table for connection tracking
CREATE TABLE IF NOT EXISTS remote_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    client_id TEXT REFERENCES remote_clients(client_id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'disconnected')),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    webrtc_offer JSONB,
    webrtc_answer JSONB,
    ice_candidates JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_remote_clients_user_id ON remote_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_remote_clients_client_id ON remote_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_remote_clients_status ON remote_clients(status);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_client_id ON remote_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_admin_id ON remote_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_status ON remote_sessions(status);

-- RLS (Row Level Security) for remote_clients
ALTER TABLE remote_clients ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own remote client records
CREATE POLICY "Users can view own remote clients" ON remote_clients
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own remote clients" ON remote_clients
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own remote clients" ON remote_clients
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own remote clients" ON remote_clients
    FOR DELETE USING (auth.uid() = user_id);

-- RLS (Row Level Security) for remote_sessions
ALTER TABLE remote_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view sessions where they are client or admin
CREATE POLICY "Users can view own sessions" ON remote_sessions
    FOR SELECT USING (auth.uid() = admin_id OR auth.uid() = (SELECT user_id FROM remote_clients WHERE client_id = remote_sessions.client_id));

CREATE POLICY "Admins can insert sessions" ON remote_sessions
    FOR INSERT WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Admins can update sessions" ON remote_sessions
    FOR UPDATE USING (auth.uid() = admin_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_remote_clients_updated_at BEFORE UPDATE ON remote_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_remote_sessions_updated_at BEFORE UPDATE ON remote_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
