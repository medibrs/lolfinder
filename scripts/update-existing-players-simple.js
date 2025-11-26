const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Riot API functions (copied from lib/riot.ts)
const RIOT_API_KEY = process.env.RIOT_API_KEY;
const REGION_ROUTING = 'europe';
const PLATFORM_ROUTING = 'euw1';

async function getRiotAccount(gameName, tagLine) {
  const url = `https://${REGION_ROUTING}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${RIOT_API_KEY}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Riot API Error: ${response.statusText}`);
  }
  
  return await response.json();
}

async function getSummonerByPuuid(puuid) {
  const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Riot API Error: ${response.statusText}`);
  }
  
  return await response.json();
}

async function getLeagueEntries(puuid) {
  const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Riot API Error: ${response.statusText}`);
  }
  
  return await response.json();
}

async function validateAndFetchRiotData(summonerName) {
  if (!RIOT_API_KEY) {
    throw new Error('Riot API Key is not configured');
  }

  if (!summonerName.includes('#')) {
    throw new Error('Invalid format. Please use GameName#TagLine format');
  }

  const [gameName, tagLine] = summonerName.split('#');
  if (!gameName || !tagLine) {
    throw new Error('Invalid format. Please use GameName#TagLine format');
  }

  const account = await getRiotAccount(gameName, tagLine);
  if (!account) {
    throw new Error('Summoner not found');
  }

  const summoner = await getSummonerByPuuid(account.puuid);
  if (!summoner) {
    throw new Error('League of Legends profile not found');
  }

  const entries = await getLeagueEntries(account.puuid);
  const soloQueue = entries.find(e => e.queueType === 'RANKED_SOLO_5x5');
  
  let tier = 'Unranked';
  let rank = null;
  let leaguePoints = 0;
  let wins = 0;
  let losses = 0;
  
  if (soloQueue && soloQueue.tier) {
    tier = soloQueue.tier.charAt(0) + soloQueue.tier.slice(1).toLowerCase();
    rank = soloQueue.rank;
    leaguePoints = soloQueue.leaguePoints;
    wins = soloQueue.wins;
    losses = soloQueue.losses;
  }

  const formattedSummonerName = `${account.gameName}#${account.tagLine}`;
  const opggUrl = `https://op.gg/lol/summoners/euw/${encodeURIComponent(account.gameName)}-${encodeURIComponent(account.tagLine)}`;

  return {
    summonerName: formattedSummonerName,
    puuid: account.puuid,
    summonerLevel: summoner.summonerLevel,
    profileIconId: summoner.profileIconId,
    tier: tier,
    rank: rank,
    leaguePoints: leaguePoints,
    wins: wins,
    losses: losses,
    opggUrl: opggUrl
  };
}

async function updateExistingPlayers() {
  try {
    console.log('Fetching existing players...');
    
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
        
        const riotData = await validateAndFetchRiotData(player.summoner_name);
        
        const { error: updateError } = await supabase
          .from('players')
          .update({
            profile_icon_id: riotData.profileIconId,
            rank: riotData.rank,
            league_points: riotData.leaguePoints,
            wins: riotData.wins,
            losses: riotData.losses,
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
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1200));
        
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
