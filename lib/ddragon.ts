// DDragon (Data Dragon) CDN utilities
// Version is controlled via NEXT_PUBLIC_DDRAGON_VERSION in .env

/** Current DDragon patch version – single source of truth */
export const DDRAGON_VERSION = process.env.NEXT_PUBLIC_DDRAGON_VERSION || '16.5.1';

export function getProfileIconUrl(profileIconId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${profileIconId}.png`;
}

export function getChampionIconUrl(championId: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${championId}.png`;
}
