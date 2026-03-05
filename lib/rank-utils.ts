import { cdnUrl } from '@/lib/cdn';

export function getRankImage(tier: string): string {
  const tierLower = tier.toLowerCase()

  // Map tier names to image files
  const rankMap: Record<string, string> = {
    'iron': cdnUrl('/iron.webp'),
    'bronze': cdnUrl('/bronze.webp'),
    'silver': cdnUrl('/silver.webp'),
    'gold': cdnUrl('/gold.webp'),
    'platinum': cdnUrl('/platinum.webp'),
    'emerald': cdnUrl('/emerald.webp'),
    'diamond': cdnUrl('/diamond.webp'),
    'master': cdnUrl('/master.webp'),
    'grandmaster': cdnUrl('/grandmaster.webp'),
    'challenger': cdnUrl('/challenger.webp'),
    'unranked': cdnUrl('/unranked.png'),
  }

  // Extract base rank (e.g., "Gold II" -> "gold")
  const baseRank = tierLower.split(' ')[0]

  return rankMap[baseRank] || cdnUrl('/iron.webp') // Default to iron if not found
}
