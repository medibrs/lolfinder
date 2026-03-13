import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RIOT_API_KEY = process.env.RIOT_API_KEY || ''
const RIOT_REGION = process.env.RIOT_REGION || 'europe' // americas | asia | europe | sea
const RIOT_PLATFORM = process.env.RIOT_PLATFORM || 'EUW1' // EUW1, NA1, KR, etc.

async function resolveTournamentId(id: string): Promise<string | null> {
  const isNumber = /^\d+$/.test(id)
  let query = supabase.from('tournaments').select('id')
  if (isNumber) query = query.eq('tournament_number', parseInt(id))
  else query = query.eq('id', id)
  const { data, error } = await query.single()
  if (error || !data) return null
  return data.id
}

function normalizeMatchId(raw: string): string {
  // If user entered just a number (e.g. 7773364699), prepend platform prefix
  if (/^\d+$/.test(raw.trim())) {
    return `${RIOT_PLATFORM}_${raw.trim()}`
  }
  return raw.trim()
}

async function fetchRiotMatch(matchId: string) {
  const normalized = normalizeMatchId(matchId)
  const url = `https://${RIOT_REGION}.api.riotgames.com/lol/match/v5/matches/${normalized}`
  const res = await fetch(url, {
    headers: { 'X-Riot-Token': RIOT_API_KEY },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Riot API ${res.status}: ${text}`)
  }
  return res.json()
}

function extractPlayerStats(riotData: any) {
  const info = riotData?.info
  if (!info?.participants) return []

  const gameDuration = info.gameDuration || 0

  return info.participants.map((p: any) => ({
    puuid: p.puuid,
    summonerName: p.riotIdGameName || p.summonerName || '',
    riotIdTagline: p.riotIdTagline || '',
    championName: p.championName || '',
    teamId: p.teamId, // 100 = blue, 200 = red
    kills: p.kills || 0,
    deaths: p.deaths || 0,
    assists: p.assists || 0,
    cs: (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0),
    goldEarned: p.goldEarned || 0,
    damageDealt: p.totalDamageDealtToChampions || 0,
    visionScore: p.visionScore || 0,
    win: p.win || false,
    gameDuration,
    role: p.teamPosition || p.individualPosition || '',
  }))
}

// POST /api/tournaments/[id]/fetch-game-stats
// Fetches stats from Riot API for all games with riot_match_id in this tournament
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!RIOT_API_KEY) {
      return NextResponse.json({ error: 'RIOT_API_KEY not configured' }, { status: 500 })
    }

    const { id } = await params
    const tournamentUuid = await resolveTournamentId(id)
    if (!tournamentUuid) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Optional: fetch only specific match_id games
    const body = await request.json().catch(() => ({}))
    const filterMatchId = body.match_id || null

    // Get all match games with riot_match_id for this tournament
    let query = supabase
      .from('tournament_match_games')
      .select('id, match_id, game_number, riot_match_id, game_data')
      .not('riot_match_id', 'is', null)

    if (filterMatchId) {
      query = query.eq('match_id', filterMatchId)
    }

    // Filter to only this tournament's matches
    const { data: allMatches } = await supabase
      .from('tournament_matches')
      .select('id')
      .eq('tournament_id', tournamentUuid)

    const matchIds = (allMatches || []).map(m => m.id)
    if (matchIds.length === 0) {
      return NextResponse.json({ fetched: 0, message: 'No matches in tournament' })
    }

    const { data: games, error } = await query.in('match_id', matchIds)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!games || games.length === 0) {
      return NextResponse.json({ fetched: 0, message: 'No games with Riot match IDs found' })
    }

    // Filter games that need fetching (no game_data yet, or force refresh)
    const forceRefresh = body.force === true
    const toFetch = forceRefresh ? games : games.filter(g => !g.game_data)

    if (toFetch.length === 0) {
      return NextResponse.json({ fetched: 0, message: 'All game stats already fetched. Use force=true to refresh.' })
    }

    const results: Array<{ gameId: string; riotMatchId: string; status: string; error?: string }> = []

    // Fetch sequentially to respect rate limits
    for (const game of toFetch) {
      try {
        const riotData = await fetchRiotMatch(game.riot_match_id!)
        const playerStats = extractPlayerStats(riotData)
        const gameDuration = riotData?.info?.gameDuration || 0

        // Store stats in game_data as JSON
        await supabase
          .from('tournament_match_games')
          .update({
            game_data: JSON.stringify({ playerStats, gameDuration, fetchedAt: new Date().toISOString() }),
            duration: gameDuration,
          })
          .eq('id', game.id)

        results.push({ gameId: game.id, riotMatchId: game.riot_match_id!, status: 'ok' })

        // Rate limit: wait 1.2s between requests (Riot dev key = 20 req / sec, 100 req / 2 min)
        await new Promise(resolve => setTimeout(resolve, 1200))
      } catch (err: any) {
        results.push({ gameId: game.id, riotMatchId: game.riot_match_id!, status: 'error', error: err.message })
      }
    }

    const successCount = results.filter(r => r.status === 'ok').length
    return NextResponse.json({
      fetched: successCount,
      total: toFetch.length,
      results,
    })
  } catch (error: any) {
    console.error('Error in fetch-game-stats:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
