const { createClient } = require('@supabase/supabase-js');
const { validateAndFetchRiotData, updateExistingPlayerData } = require('../lib/riot');

require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function updateExistingPlayers() {
  try {
    console.log('Fetching existing players...');
    
    // Get all players
    // Fetch all players that have a PUUID (players created through Riot API integration)
    const { data: players, error: fetchError } = await supabase
      .from('players')
      .select('id, summoner_name, puuid')
      .not('puuid', 'is', null);
    
    if (fetchError) {
      console.error('Error fetching players:', fetchError);
      return;
    }
    
    console.log(`Found ${players.length} players to update`);
    
    for (const player of players) {
      try {
        
        // Use optimized update function that only makes 2 API calls instead of 3
        const riotData = await updateExistingPlayerData(player.puuid);
        
        // Update player with new data
        const { error: updateError } = await supabase
          .from('players')
          .update({
            profile_icon_id: riotData.profileIconId,
            rank: riotData.rank,
            league_points: riotData.leaguePoints,
            wins: riotData.wins,
            losses: riotData.losses,
            // Also update existing fields in case they changed
            tier: riotData.tier,
            summoner_level: riotData.summonerLevel,
            // Keep existing puuid and opgg_url since they don't change
          })
          .eq('id', player.id);
        
        if (updateError) {
        } else {
        }
        
        // Rate limiting - wait 1 second between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (riotError) {
        console.error(`Error fetching Riot data for ${player.summoner_name}:`, riotError.message);
      }
    }
    
    console.log('Update complete!');
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

updateExistingPlayers();
