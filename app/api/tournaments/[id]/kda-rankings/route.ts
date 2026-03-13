import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function resolveTournamentId(id: string): Promise<string | null> {
  const isNumber = /^\d+$/.test(id)
  let query = supabase.from('tournaments').select('id')
  if (isNumber) query = query.eq('tournament_number', parseInt(id))
  else query = query.eq('id', id)
  const { data, error } = await query.single()
  if (error || !data) return null
  return data.id
}

interface PlayerAgg {
  puuid: string
  summonerName: string
  riotIdTagline: string
  kills: number
  deaths: number
  assists: number
  cs: number
  goldEarned: number
  damageDealt: number
  visionScore: number
  gamesPlayed: number
  wins: number
  champions: string[]
}

// GET /api/tournaments/[id]/kda-rankings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tournamentUuid = await resolveTournamentId(id)
    if (!tournamentUuid) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Get all matches for this tournament
    const { data: tournamentMatches } = await supabase
      .from('tournament_matches')
      .select('id')
      .eq('tournament_id', tournamentUuid)

    const matchIds = (tournamentMatches || []).map(m => m.id)
    if (matchIds.length === 0) {
      return NextResponse.json({ rankings: [] })
    }

    // Get all games with stored stats
    const { data: games } = await supabase
      .from('tournament_match_games')
      .select('id, match_id, game_number, game_data, riot_match_id')
      .in('match_id', matchIds)
      .not('game_data', 'is', null)

    if (!games || games.length === 0) {
      return NextResponse.json({ rankings: [], message: 'No game stats fetched yet' })
    }

    // Aggregate player stats
    const playerMap: Record<string, PlayerAgg> = {}

    for (const game of games) {
      let parsed: any
      try {
        parsed = typeof game.game_data === 'string' ? JSON.parse(game.game_data) : game.game_data
      } catch {
        continue
      }

      const playerStats = parsed?.playerStats
      if (!Array.isArray(playerStats)) continue

      for (const p of playerStats) {
        const key = p.puuid || p.summonerName
        if (!key) continue

        if (!playerMap[key]) {
          playerMap[key] = {
            puuid: p.puuid || '',
            summonerName: p.summonerName || '',
            riotIdTagline: p.riotIdTagline || '',
            kills: 0,
            deaths: 0,
            assists: 0,
            cs: 0,
            goldEarned: 0,
            damageDealt: 0,
            visionScore: 0,
            gamesPlayed: 0,
            wins: 0,
            champions: [],
          }
        }

        const agg = playerMap[key]
        agg.kills += p.kills || 0
        agg.deaths += p.deaths || 0
        agg.assists += p.assists || 0
        agg.cs += p.cs || 0
        agg.goldEarned += p.goldEarned || 0
        agg.damageDealt += p.damageDealt || 0
        agg.visionScore += p.visionScore || 0
        agg.gamesPlayed += 1
        if (p.win) agg.wins += 1
        if (p.championName && !agg.champions.includes(p.championName)) {
          agg.champions.push(p.championName)
        }
        // Update name to latest
        if (p.summonerName) agg.summonerName = p.summonerName
        if (p.riotIdTagline) agg.riotIdTagline = p.riotIdTagline
      }
    }

    // Build rankings sorted by KDA ratio
    const rankings = Object.values(playerMap).map(p => {
      const kda = (p.kills + p.assists) / Math.max(1, p.deaths)
      const avgKills = p.kills / Math.max(1, p.gamesPlayed)
      const avgDeaths = p.deaths / Math.max(1, p.gamesPlayed)
      const avgAssists = p.assists / Math.max(1, p.gamesPlayed)
      const avgCs = p.cs / Math.max(1, p.gamesPlayed)
      const avgGold = p.goldEarned / Math.max(1, p.gamesPlayed)
      const avgDamage = p.damageDealt / Math.max(1, p.gamesPlayed)
      const winRate = (p.wins / Math.max(1, p.gamesPlayed)) * 100

      return {
        ...p,
        kda: Number(kda.toFixed(2)),
        avgKills: Number(avgKills.toFixed(1)),
        avgDeaths: Number(avgDeaths.toFixed(1)),
        avgAssists: Number(avgAssists.toFixed(1)),
        avgCs: Number(avgCs.toFixed(0)),
        avgGold: Number(avgGold.toFixed(0)),
        avgDamage: Number(avgDamage.toFixed(0)),
        winRate: Number(winRate.toFixed(0)),
      }
    }).sort((a, b) => b.kda - a.kda)

    return NextResponse.json({
      rankings,
      gamesAnalyzed: games.length,
      playersFound: rankings.length,
    })
  } catch (error: any) {
    console.error('Error in kda-rankings:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
