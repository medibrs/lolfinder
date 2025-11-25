const RIOT_API_KEY = process.env.RIOT_API_KEY;
const REGION_ROUTING = 'europe';
const PLATFORM_ROUTING = 'euw1';

if (!RIOT_API_KEY) {
  console.warn('RIOT_API_KEY is not set in environment variables');
}

interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

interface SummonerInfo {
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

interface LeagueEntry {
  leagueId: string;
  queueType: string;
  tier: string;
  rank: string;
  puuid: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  veteran: boolean;
  inactive: boolean;
  freshBlood: boolean;
  hotStreak: boolean;
}

export async function getRiotAccount(gameName: string, tagLine: string): Promise<RiotAccount | null> {
  try {
    const url = `https://${REGION_ROUTING}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${RIOT_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) return null;
      console.error(`Riot API Error (Account): ${response.status} ${response.statusText}`);
      throw new Error(`Riot API Error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching Riot Account:', error);
    throw error;
  }
}

export async function getSummonerByPuuid(puuid: string): Promise<SummonerInfo | null> {
  try {
    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Riot API Error (Summoner): ${response.status} ${response.statusText}`);
      throw new Error(`Riot API Error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching Summoner:', error);
    throw error;
  }
}

export async function getLeagueEntries(puuid: string): Promise<LeagueEntry[]> {
  try {
    const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Riot API Error (League): ${response.status} ${response.statusText}`);
      throw new Error(`Riot API Error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching League Entries:', error);
    throw error;
  }
}

export async function validateAndFetchRiotData(summonerName: string) {
  if (!RIOT_API_KEY) {
    throw new Error('Riot API Key is not configured');
  }

  // Parse summoner name
  if (!summonerName.includes('#')) {
    throw new Error('Invalid format. Please use GameName#TagLine format (e.g., Player#EUW)');
  }

  const [gameName, tagLine] = summonerName.split('#');
  if (!gameName || !tagLine) {
    throw new Error('Invalid format. Please use GameName#TagLine format');
  }

  // 1. Get Account (PUUID)
  const account = await getRiotAccount(gameName, tagLine);
  if (!account) {
    throw new Error('Summoner not found. Please check the GameName and TagLine.');
  }

  // 2. Get Summoner Info (Level)
  const summoner = await getSummonerByPuuid(account.puuid);
  if (!summoner) {
    // Should unlikely happen if account exists, but possible if they haven't played LOL
    throw new Error('League of Legends profile not found for this Riot ID.');
  }

  // 3. Get Ranked Info
  const entries = await getLeagueEntries(account.puuid);
  const soloQueue = entries.find(e => e.queueType === 'RANKED_SOLO_5x5');
  
  let tier = 'Unranked';
  if (soloQueue && soloQueue.tier) {
    // Normalize to Title Case (e.g. "EMERALD" -> "Emerald") to match app conventions
    tier = soloQueue.tier.charAt(0) + soloQueue.tier.slice(1).toLowerCase();
  }

  // 4. Construct Data
  const formattedSummonerName = `${account.gameName}#${account.tagLine}`;
  const opggUrl = `https://op.gg/lol/summoners/euw/${encodeURIComponent(account.gameName)}-${encodeURIComponent(account.tagLine)}`;

  return {
    summonerName: formattedSummonerName,
    puuid: account.puuid,
    summonerLevel: summoner.summonerLevel,
    tier: tier, // Title Case e.g. "Emerald" or "Unranked"
    opggUrl: opggUrl
  };
}
