export function getRankImage(tier: string): string {
  const tierLower = tier.toLowerCase()
  
  // Map tier names to image files
  const rankMap: Record<string, string> = {
    'iron': '/iron.webp',
    'bronze': '/bronze.webp',
    'silver': '/silver.webp',
    'gold': '/gold.webp',
    'platinum': '/platinum.webp',
    'emerald': '/emerald.webp',
    'diamond': '/diamond.webp',
    'master': '/master.webp',
    'grandmaster': '/grandmaster.webp',
    'challenger': '/challenger.webp',
    'unranked': '/unranked.png',
  }
  
  // Extract base rank (e.g., "Gold II" -> "gold")
  const baseRank = tierLower.split(' ')[0]
  
  return rankMap[baseRank] || '/iron.webp' // Default to iron if not found
}
