
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id: tournamentId } = await params

  try {
    // 1. Get tournament and participants
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    if (tournament.format !== 'Swiss') {
      return NextResponse.json({ error: 'Not a Swiss tournament' }, { status: 400 })
    }

    // 2. Get active participants sorted by score
    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('is_active', true)
      .order('swiss_score', { ascending: false })
      .order('tiebreaker_points', { ascending: false })

    if (!participants || participants.length < 2) {
      return NextResponse.json({ error: 'Not enough participants' }, { status: 400 })
    }

    // 3. Determine next round number
    const currentRound = tournament.current_round || 0
    const nextRound = currentRound + 1

    // 4. Simple pairing logic (Top vs Next Top)
    // In a real system, we'd use a graph matching algorithm (Edmonds' Blossom)
    // and check history to avoid rematches.
    const pairings = []
    const teams = [...participants]

    while (teams.length >= 2) {
      const team1 = teams.shift()
      const team2 = teams.shift() // Just take the next best seed for now

      pairings.push({ team1, team2 })
    }

    // Handle bye if odd number of teams
    let byeTeam = null
    if (teams.length === 1) {
      byeTeam = teams[0]
    }

    // 5. Create Matches
    const matchesToInsert = pairings.map((pair, index) => ({
      tournament_id: tournamentId,
      round_number: nextRound,
      match_number: index + 1,
      team1_id: pair.team1.team_id,
      team2_id: pair.team2.team_id,
      status: 'Scheduled',
      bracket_id: null // Swiss doesn't strictly need bracket_id linked to a pre-structure
    }))

    if (byeTeam) {
      // Auto-win for bye
      matchesToInsert.push({
        tournament_id: tournamentId,
        round_number: nextRound,
        match_number: pairings.length + 1,
        team1_id: byeTeam.team_id,
        team2_id: null, // No opponent
        status: 'Completed',
        winner_id: byeTeam.team_id,
        bracket_id: null
      } as any)
    }

    const { error: matchError } = await supabase
      .from('tournament_matches')
      .insert(matchesToInsert)

    if (matchError) throw matchError

    // 6. Update tournament round
    await supabase
      .from('tournaments')
      .update({ current_round: nextRound })
      .eq('id', tournamentId)

    // 7. Log it
    await supabase.from('tournament_logs').insert({
      tournament_id: tournamentId,
      action: 'PAIRINGS_GENERATED',
      details: `Round ${nextRound} pairings generated for ${matchesToInsert.length} matches`,
      round_number: nextRound,
      event_category: 'system',
      impact_level: 'medium'
    })

    return NextResponse.json({ success: true, matches: matchesToInsert.length })
  } catch (error) {
    console.error('Pairing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
