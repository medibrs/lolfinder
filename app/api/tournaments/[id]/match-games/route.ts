import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function resolveTournamentId(id: string): Promise<string | null> {
  const isNumber = /^\d+$/.test(id)
  let query = supabase.from('tournaments').select('id')
  if (isNumber) {
    query = query.eq('tournament_number', parseInt(id))
  } else {
    query = query.eq('id', id)
  }
  const { data, error } = await query.single()
  if (error || !data) return null
  return data.id
}

// GET /api/tournaments/[id]/match-games?match_id=xxx
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

    const matchId = request.nextUrl.searchParams.get('match_id')
    if (!matchId) {
      return NextResponse.json({ error: 'match_id is required' }, { status: 400 })
    }

    const { data: games, error } = await supabase
      .from('tournament_match_games')
      .select('id, match_id, game_number, winner_id, duration, riot_match_id, game_data')
      .eq('match_id', matchId)
      .order('game_number', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ games: games || [] })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tournaments/[id]/match-games
// Body: { match_id, games: [{ game_number, riot_match_id, winner_id?, duration? }] }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tournamentUuid = await resolveTournamentId(id)
    if (!tournamentUuid) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const body = await request.json()
    const { match_id, games } = body

    if (!match_id || !Array.isArray(games)) {
      return NextResponse.json({ error: 'match_id and games array are required' }, { status: 400 })
    }

    // Verify match belongs to this tournament
    const { data: match } = await supabase
      .from('tournament_matches')
      .select('id')
      .eq('id', match_id)
      .eq('tournament_id', tournamentUuid)
      .single()

    if (!match) {
      return NextResponse.json({ error: 'Match not found in this tournament' }, { status: 404 })
    }

    // Get existing games for this match
    const { data: existing } = await supabase
      .from('tournament_match_games')
      .select('id, game_number')
      .eq('match_id', match_id)

    const existingMap: Record<number, string> = {}
    for (const g of existing || []) {
      existingMap[g.game_number] = g.id
    }

    const errors: string[] = []
    for (const g of games) {
      if (!g.game_number) continue

      if (existingMap[g.game_number]) {
        // Update existing row
        const updateRow: any = {}
        if (g.riot_match_id !== undefined) updateRow.riot_match_id = g.riot_match_id || null
        if (g.winner_id !== undefined) updateRow.winner_id = g.winner_id || null
        if (g.duration !== undefined) updateRow.duration = g.duration || null

        const { error } = await supabase
          .from('tournament_match_games')
          .update(updateRow)
          .eq('id', existingMap[g.game_number])
        if (error) errors.push(`Game ${g.game_number} update: ${error.message}`)
      } else {
        // Insert new row
        const insertRow: any = {
          match_id,
          game_number: g.game_number,
        }
        if (g.riot_match_id !== undefined) insertRow.riot_match_id = g.riot_match_id || null
        if (g.winner_id !== undefined) insertRow.winner_id = g.winner_id || null
        if (g.duration !== undefined) insertRow.duration = g.duration || null

        const { error } = await supabase
          .from('tournament_match_games')
          .insert(insertRow)
        if (error) errors.push(`Game ${g.game_number} insert: ${error.message}`)
      }
    }

    if (errors.length > 0) {
      console.error('Match games errors:', errors)
    }

    // Return updated games
    const { data: updatedGames } = await supabase
      .from('tournament_match_games')
      .select('id, match_id, game_number, winner_id, duration, riot_match_id, game_data')
      .eq('match_id', match_id)
      .order('game_number', { ascending: true })

    return NextResponse.json({ games: updatedGames || [] })
  } catch (error) {
    console.error('Error in POST match-games:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
