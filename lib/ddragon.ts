// DDragon (Data Dragon) API utilities for dynamic version management

let cachedVersion: string | null = null;
let versionCacheTime: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // Cache for 1 hour

export async function getLatestDDragonVersion(): Promise<string> {
  // Return cached version if still valid
  if (cachedVersion && Date.now() - versionCacheTime < CACHE_DURATION) {
    return cachedVersion;
  }

  try {
    const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');

    if (!response.ok) {
      throw new Error(`Failed to fetch DDragon versions: ${response.statusText}`);
    }

    const versions: string[] = await response.json();

    if (!versions || versions.length === 0) {
      throw new Error('No versions found in DDragon API response');
    }

    // The first version in the array is always the latest
    const latestVersion = versions[0];

    // Cache the result
    cachedVersion = latestVersion;
    versionCacheTime = Date.now();


    return latestVersion;

  } catch (error) {


    // Fallback to a known recent version if caching fails
    if (cachedVersion) {

      return cachedVersion;
    }

    // Final fallback to a hardcoded recent version

    return '15.23.1';
  }
}

export async function getProfileIconUrl(profileIconId: number): Promise<string> {
  const version = await getLatestDDragonVersion();
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${profileIconId}.png`;
}

export async function getChampionIconUrl(championId: string): Promise<string> {
  const version = await getLatestDDragonVersion();
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championId}.png`;
}

// Utility to pre-warm the version cache (call this during app startup)
export async function preloadDDragonVersion(): Promise<void> {
  await getLatestDDragonVersion();
}
