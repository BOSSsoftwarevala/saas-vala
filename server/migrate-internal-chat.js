const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const supabaseUrl = 'https://astmdnelnuqwpdbyzecr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzdG1kbmVsbnVxd3BkYnl6ZWNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImFudSI6ImFudTEiLCJpYXQiOjE3MzY3MjMwMDcsImV4cCI6MjA1MjI5OTAwN30.MgQUKiGR5J2qhQpS2XqDwXAKOq1rJd4x3YH8m9jHqQY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('Starting internal chat migration...');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'database/migrations/create_internal_chat_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Migration error:', error);
      process.exit(1);
    }
    
    console.log('Internal chat migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
