const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.log('Make sure you have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Running migration: create_team_with_players_view.sql');
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/create_team_with_players_view.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing SQL...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Migration failed:', error);
      
      // Try direct SQL execution
      console.log('Trying direct SQL execution...');
      const { data: directData, error: directError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (directError) {
        console.error('Direct execution also failed:', directError);
      } else {
        console.log('Connected successfully. Please run the SQL manually in your Supabase dashboard:');
        console.log('\n' + sql);
      }
    } else {
      console.log('Migration completed successfully!');
      console.log('Views created: team_with_players, team_with_basic_players');
    }
  } catch (error) {
    console.error('Error running migration:', error);
  }
}

runMigration();
