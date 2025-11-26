const { createClient } = require('@supabase/supabase-js');
const { validateAndFetchRiotData } = require('../lib/riot');

require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function updateExistingPlayers() {
  try {
    console.log('Fetching existing players...');
    
    // Get all players
    const { data: players, error: fetchError } = await supabase
      .from('players')
      .select('*');
    
    if (fetchError) {
      console.error('Error fetching players:', fetchError);
      return;
    }
    
    console.log(`Found ${players.length} players to update`);
    
    for (const player of players) {
      try {
        console.log(`Updating ${player.summoner_name}...`);
        
        // Re-fetch data from Riot API
        const riotData = await validateAndFetchRiotData(player.summoner_name);
        
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
            puuid: riotData.puuid,
            opgg_url: riotData.opggUrl,
          })
          .eq('id', player.id);
        
        if (updateError) {
          console.error(`Error updating ${player.summoner_name}:`, updateError);
        } else {
          console.log(`✓ Updated ${player.summoner_name}: ${riotData.tier} ${riotData.rank || ''} (${riotData.wins}W/${riotData.losses}L)`);
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
