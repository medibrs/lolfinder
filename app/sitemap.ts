import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lolfinder.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/teams`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/tournaments`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/players`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/auth`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  // Dynamic tournament pages
  let tournamentPages: MetadataRoute.Sitemap = []
  try {
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, slug, updated_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (tournaments) {
      tournamentPages = tournaments.map((tournament) => ({
        url: `${siteUrl}/tournaments/${tournament.id}/${tournament.slug || 'tournament'}`,
        lastModified: tournament.updated_at ? new Date(tournament.updated_at) : new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }))
    }
  } catch (error) {
    console.error('Error fetching tournaments for sitemap:', error)
  }

  // Dynamic team pages
  let teamPages: MetadataRoute.Sitemap = []
  try {
    const { data: teams } = await supabase
      .from('teams')
      .select('id, updated_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (teams) {
      teamPages = teams.map((team) => ({
        url: `${siteUrl}/teams/${team.id}`,
        lastModified: team.updated_at ? new Date(team.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))
    }
  } catch (error) {
    console.error('Error fetching teams for sitemap:', error)
  }

  // Dynamic player pages
  let playerPages: MetadataRoute.Sitemap = []
  try {
    const { data: players } = await supabase
      .from('players')
      .select('id, updated_at')
      .order('created_at', { ascending: false })
      .limit(500)

    if (players) {
      playerPages = players.map((player) => ({
        url: `${siteUrl}/players/${player.id}`,
        lastModified: player.updated_at ? new Date(player.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    }
  } catch (error) {
    console.error('Error fetching players for sitemap:', error)
  }

  return [...staticPages, ...tournamentPages, ...teamPages, ...playerPages]
}
