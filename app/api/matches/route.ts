import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '120', 10), 300)

    const { data: matches, error } = await supabase
      .from('tournament_matches')
      .select(`
        id,
        tournament_id,
        bracket_id,
        team1_id,
        team2_id,
        winner_id,
        status,
        result,
        scheduled_at,
        started_at,
        completed_at,
        match_number,
        best_of,
        team1_score,
        team2_score,
        stream_url,
        created_at,
        team1:teams!tournament_matches_team1_id_fkey(id, name, team_avatar),
        team2:teams!tournament_matches_team2_id_fkey(id, name, team_avatar),
        winner:teams!tournament_matches_winner_id_fkey(id, name),
        tournament:tournaments(id, name, format, tournament_number, banner_image, start_date, end_date)
      `)
      .order('started_at', { ascending: false })
      .order('scheduled_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ matches: [] })
    }

    const bracketIds = [...new Set(matches.map(m => m.bracket_id).filter(Boolean))] as string[]
    const matchIds = matches.map(m => m.id)

    const [bracketsRes, detailsRes, gamesRes] = await Promise.all([
      bracketIds.length > 0
        ? supabase
          .from('tournament_brackets')
          .select('id, round_number, bracket_position, is_final')
          .in('id', bracketIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('tournament_match_details')
        .select('id, match_id, game_number, game_duration, game_data')
        .in('match_id', matchIds),
      supabase
        .from('tournament_match_games')
        .select('id, match_id, game_number, winner_id, duration, game_data')
        .in('match_id', matchIds),
    ])

    const bracketMap: Record<string, any> = {}
    for (const bracket of bracketsRes.data || []) {
      bracketMap[bracket.id] = bracket
    }

    const detailsByMatch: Record<string, any[]> = {}
    for (const detail of detailsRes.data || []) {
      if (!detailsByMatch[detail.match_id]) detailsByMatch[detail.match_id] = []
      detailsByMatch[detail.match_id].push(detail)
    }

    const gamesByMatch: Record<string, any[]> = {}
    for (const game of gamesRes.data || []) {
      if (!gamesByMatch[game.match_id]) gamesByMatch[game.match_id] = []
      gamesByMatch[game.match_id].push(game)
    }

    const enriched = matches.map(match => ({
      ...match,
      bracket: match.bracket_id ? bracketMap[match.bracket_id] || null : null,
      details: detailsByMatch[match.id] || [],
      games: gamesByMatch[match.id] || [],
    }))

    return NextResponse.json({ matches: enriched })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
