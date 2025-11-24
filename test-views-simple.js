// Test script to verify the views are working
// Copy your environment variables here temporarily for testing

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

if (supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  console.log('❌ Please update the supabaseUrl and supabaseAnonKey in this file');
  console.log('Get these values from your .env.local file or Supabase dashboard');
  process.exit(1);
}

// Simple Supabase client without external dependencies
class SimpleSupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
  }
  
  async from(table) {
    return {
      select: (columns = '*') => ({
        limit: (limit) => this._query(table, columns, limit)
      })
    };
  }
  
  async _query(table, columns, limit) {
    const response = await fetch(`${this.url}/rest/v1/${table}?select=${columns}&limit=${limit}`, {
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`
      }
    });
    
    if (!response.ok) {
      return { data: null, error: await response.text() };
    }
    
    const data = await response.json();
    return { data, error: null };
  }
}

const supabase = new SimpleSupabaseClient(supabaseUrl, supabaseAnonKey);

async function testViews() {
  try {
    console.log('Testing team_with_basic_players view...');
    
    // Test the basic view
    const { data: basicData, error: basicError } = await supabase
      .from('team_with_basic_players')
      .select('*')
      .limit(5);
    
    if (basicError) {
      console.error('❌ Basic view error:', basicError);
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
      console.error('❌ Full view error:', fullError);
    } else {
      console.log('✅ team_with_players view works!');
      console.log('Sample data:', fullData?.[0] ? 'Found teams' : 'No teams found');
    }
    
    console.log('\n🎉 Views are ready to use in your APIs!');
    console.log('\nYou can now use these views in your Next.js APIs:');
    console.log('supabase.from("team_with_basic_players").select("*")');
    
  } catch (error) {
    console.error('Error testing views:', error);
  }
}

testViews();
