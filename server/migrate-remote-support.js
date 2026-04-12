import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://astmdnelnuqwpdbyzecr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzdG1kbmVsbnVxd3BkYnl6ZWNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE4ODcyNCwiZXhwIjoyMDg1NzY0NzI0fQ.pBfkSsN_x5-t9y2GlOVKKbG8GjvlHNfKjvvXNPZvyUo'

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  console.log('Starting remote support tables migration...')

  try {
    // Create remote_clients table
    const { error: clientsError } = await supabase
      .from('remote_clients')
      .select('id')
      .limit(1)

    if (clientsError && clientsError.code === 'PGRST116') {
      // Table doesn't exist, create it
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE remote_clients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            client_id TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
            last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX idx_remote_clients_user_id ON remote_clients(user_id);
          CREATE INDEX idx_remote_clients_client_id ON remote_clients(client_id);
          CREATE INDEX idx_remote_clients_status ON remote_clients(status);
        `
      })

      if (createError) {
        console.error('Error creating remote_clients table:', createError)
      } else {
        console.log('✅ remote_clients table created successfully')
      }
    } else {
      console.log('✅ remote_clients table already exists')
    }

    // Create remote_sessions table
    const { error: sessionsError } = await supabase
      .from('remote_sessions')
      .select('id')
      .limit(1)

    if (sessionsError && sessionsError.code === 'PGRST116') {
      // Table doesn't exist, create it
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE remote_sessions (
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
          
          CREATE INDEX idx_remote_sessions_client_id ON remote_sessions(client_id);
          CREATE INDEX idx_remote_sessions_admin_id ON remote_sessions(admin_id);
          CREATE INDEX idx_remote_sessions_status ON remote_sessions(status);
        `
      })

      if (createError) {
        console.error('Error creating remote_sessions table:', createError)
      } else {
        console.log('✅ remote_sessions table created successfully')
      }
    } else {
      console.log('✅ remote_sessions table already exists')
    }

    console.log('✅ Migration completed successfully!')

  } catch (error) {
    console.error('Migration failed:', error)
  }
}

runMigration()
