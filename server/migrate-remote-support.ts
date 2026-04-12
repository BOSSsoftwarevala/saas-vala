import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://astmdnelnuqwpdbyzecr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzdG1kbmVsbnVxd3BkYnl6ZWNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE4ODcyNCwiZXhwIjoyMDg1NzY0NzI0fQ.pBfkSsN_x5-t9y2GlOVKKbG8GjvlHNfKjvvXNPZvyUo'

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  console.log('Starting remote support tables migration...')

  try {
    // Create remote_clients table
    const { error: clientsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS remote_clients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_id TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
          last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_remote_clients_user_id ON remote_clients(user_id);
        CREATE INDEX IF NOT EXISTS idx_remote_clients_client_id ON remote_clients(client_id);
        CREATE INDEX IF NOT EXISTS idx_remote_clients_status ON remote_clients(status);
      `
    })

    if (clientsError) {
      console.error('Error creating remote_clients table:', clientsError)
    } else {
      console.log('✅ remote_clients table created successfully')
    }

    // Create remote_sessions table
    const { error: sessionsError } = await supabase.rpc('exec_sql', {
      sql: `
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
        
        CREATE INDEX IF NOT EXISTS idx_remote_sessions_client_id ON remote_sessions(client_id);
        CREATE INDEX IF NOT EXISTS idx_remote_sessions_admin_id ON remote_sessions(admin_id);
        CREATE INDEX IF NOT EXISTS idx_remote_sessions_status ON remote_sessions(status);
      `
    })

    if (sessionsError) {
      console.error('Error creating remote_sessions table:', sessionsError)
    } else {
      console.log('✅ remote_sessions table created successfully')
    }

    // Enable RLS
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE remote_clients ENABLE ROW LEVEL SECURITY;
        ALTER TABLE remote_sessions ENABLE ROW LEVEL SECURITY;
      `
    })

    // Create RLS policies
    const { error: policiesError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Remote clients policies
        CREATE POLICY IF NOT EXISTS "Users can view own remote clients" ON remote_clients
          FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY IF NOT EXISTS "Users can insert own remote clients" ON remote_clients
          FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY IF NOT EXISTS "Users can update own remote clients" ON remote_clients
          FOR UPDATE USING (auth.uid() = user_id);
        
        CREATE POLICY IF NOT EXISTS "Users can delete own remote clients" ON remote_clients
          FOR DELETE USING (auth.uid() = user_id);
        
        -- Remote sessions policies
        CREATE POLICY IF NOT EXISTS "Users can view own sessions" ON remote_sessions
          FOR SELECT USING (auth.uid() = admin_id OR auth.uid() = (SELECT user_id FROM remote_clients WHERE client_id = remote_sessions.client_id));
        
        CREATE POLICY IF NOT EXISTS "Admins can insert sessions" ON remote_sessions
          FOR INSERT WITH CHECK (auth.uid() = admin_id);
        
        CREATE POLICY IF NOT EXISTS "Admins can update sessions" ON remote_sessions
          FOR UPDATE USING (auth.uid() = admin_id);
      `
    })

    if (policiesError) {
      console.error('Error creating RLS policies:', policiesError)
    } else {
      console.log('✅ RLS policies created successfully')
    }

    // Create update function
    const { error: functionError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';
        
        DROP TRIGGER IF EXISTS update_remote_clients_updated_at ON remote_clients;
        DROP TRIGGER IF EXISTS update_remote_sessions_updated_at ON remote_sessions;
        
        CREATE TRIGGER update_remote_clients_updated_at BEFORE UPDATE ON remote_clients
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
        CREATE TRIGGER update_remote_sessions_updated_at BEFORE UPDATE ON remote_sessions
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `
    })

    if (functionError) {
      console.error('Error creating update function:', functionError)
    } else {
      console.log('✅ Update triggers created successfully')
    }

    console.log('✅ Migration completed successfully!')

  } catch (error) {
    console.error('Migration failed:', error)
  }
}

runMigration()
