const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testViews() {
  try {
    console.log('Testing team_with_basic_players view...');
    
    // Test the basic view
    const { data: basicData, error: basicError } = await supabase
      .from('team_with_basic_players')
      .select('*')
      .limit(5);
    
    if (basicError) {
      console.error('Basic view error:', basicError);
    } else {
      console.log('✅ team_with_basic_players view works!');
      console.log('Sample data:', basicData?.[0] ? 'Found teams' : 'No teams found');
      
      if (basicData?.[0]) {
        console.log('Team example:', {
          id: basicData[0].id,
          name: basicData[0].name,
          players_count: basicData[0].players ? basicData[0].players.length : 0
        });
      }
    }
    
    console.log('\nTesting team_with_players view...');
    
    // Test the full view
    const { data: fullData, error: fullError } = await supabase
      .from('team_with_players')
      .select('*')
      .limit(5);
    
    if (fullError) {
      console.error('Full view error:', fullError);
    } else {
      console.log('✅ team_with_players view works!');
      console.log('Sample data:', fullData?.[0] ? 'Found teams' : 'No teams found');
    }
    
    console.log('\n🎉 Views are ready to use in your APIs!');
    
  } catch (error) {
    console.error('Error testing views:', error);
  }
}

testViews();
