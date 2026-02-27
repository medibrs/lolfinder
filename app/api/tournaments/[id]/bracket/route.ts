import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TournamentOrchestrator } from '@/lib/tournament/orchestrator'
import { transitionTournament } from '@/lib/tournament/lifecycle/lifecycle-service'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Helpers ────────────────────────────────────────────────────────

async function resolveTournamentId(id: string): Promise<string | null> {
  const isNumber = /^\d+$/.test(id)
  let query = supabase.from('tournaments').select('id')
  if (isNumber) query = query.eq('tournament_number', parseInt(id))
  else query = query.eq('id', id)
  const { data, error } = await query.single()
  if (error || !data) return null
  return data.id
}

// ─── GET — Read bracket (unchanged) ─────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('*, team:teams(id, name, team_avatar)')
      .eq('tournament_id', id)
      .order('seed_number', { ascending: true })

    const { data: brackets } = await supabase
      .from('tournament_brackets')
      .select('*')
      .eq('tournament_id', id)
      .order('round_number', { ascending: true })
      .order('bracket_position', { ascending: true })

    const { data: matches } = await supabase
      .from('tournament_matches')
      .select(`
        *,
        team1:teams!tournament_matches_team1_id_fkey(id, name, team_avatar),
        team2:teams!tournament_matches_team2_id_fkey(id, name, team_avatar),
        winner:teams!tournament_matches_winner_id_fkey(id, name)
      `)
      .eq('tournament_id', id)
      .order('match_number', { ascending: true })

    return NextResponse.json({
      tournament,
      participants: participants || [],
      brackets: brackets || [],
      matches: matches || [],
    })
  } catch (error) {
    console.error('Error fetching bracket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST — Bracket actions (delegated to orchestrator) ─────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action } = body

    const tournamentUuid = await resolveTournamentId(id)
    if (!tournamentUuid) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    switch (action) {
      case 'generate_seeding':
        return await generateSeeding(tournamentUuid, body)

      case 'generate_bracket': {
        const result = await TournamentOrchestrator.generateBracket(tournamentUuid)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({
          message: 'Bracket generated successfully',
          ...result.data,
        })
      }

      case 'reset_bracket': {
        const result = await TournamentOrchestrator.resetBracket(tournamentUuid)
        return NextResponse.json({ message: 'Bracket reset successfully' })
      }

      case 'regenerate_round': {
        // For Swiss: discard and regenerate draft
        const { data: tournament } = await supabase
          .from('tournaments')
          .select('format, current_round')
          .eq('id', tournamentUuid)
          .single()

        if (tournament?.format === 'Swiss') {
          const round = tournament.current_round || 1
          const { proposal } = await TournamentOrchestrator.regenerateSwissDraft(tournamentUuid, round)
          const { matchIds } = await TournamentOrchestrator.approveSwissDraft(tournamentUuid, round)
          return NextResponse.json({ success: true, matches: matchIds.length })
        }

        // For elimination: reset bracket and regenerate
        await TournamentOrchestrator.resetBracket(tournamentUuid)
        const result = await TournamentOrchestrator.generateBracket(tournamentUuid)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json(result.data)
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error in bracket action:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// ─── PUT — Seeding operations ───────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action } = body

    const tournamentUuid = await resolveTournamentId(id)
    if (!tournamentUuid) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    switch (action) {
      case 'swap_seeds':
        return await swapSeeds(tournamentUuid, body.team1_id, body.team2_id)
      case 'set_seed':
        return await setSeed(tournamentUuid, body.team_id, body.seed_number)
      case 'randomize_seeds':
        return await randomizeSeeds(tournamentUuid)
      case 'seed_by_rank':
        return await seedByRank(tournamentUuid)
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error updating seeding:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Seeding Functions (self-contained, no bracket-mgmt import) ─────

async function generateSeeding(tournamentId: string, options: any) {
  const { seeding_method = 'random' } = options

  const { data: registrations, error: regError } = await supabase
    .from('tournament_registrations')
    .select('team_id, status, team:teams(id, name)')
    .eq('tournament_id', tournamentId)
    .eq('status', 'approved')

  if (regError || !registrations || registrations.length === 0) {
    return NextResponse.json({ error: 'No approved teams found' }, { status: 400 })
  }

  await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId)

  let teams = registrations.map(r => r.team)

  if (seeding_method === 'rank') {
    teams = await calculateAndSortByRank(teams)
  } else {
    teams = shuffleArray(teams)
  }

  const participants = teams.map((team: any, index: number) => ({
    tournament_id: tournamentId,
    team_id: team.id,
    seed_number: index + 1,
    initial_bracket_position: index + 1,
    is_active: true,
  }))

  const { data: insertedParticipants, error: insertError } = await supabase
    .from('tournament_participants')
    .insert(participants)
    .select('*, team:teams(id, name, team_avatar)')

  if (insertError) {
    return NextResponse.json({ error: 'Failed to create seeding' }, { status: 500 })
  }

  await transitionTournament(tournamentId, 'Seeding')
  await logAction(tournamentId, 'seeding_generated', { method: seeding_method, team_count: teams.length })

  return NextResponse.json({ message: 'Seeding generated successfully', participants: insertedParticipants })
}

async function swapSeeds(tournamentId: string, team1Id: string, team2Id: string) {
  const { data: participants, error } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('tournament_id', tournamentId)
    .in('team_id', [team1Id, team2Id])

  if (error || !participants || participants.length !== 2) {
    return NextResponse.json({ error: 'Teams not found' }, { status: 404 })
  }

  const [p1, p2] = participants
  await supabase.from('tournament_participants').update({ seed_number: p2.seed_number, initial_bracket_position: p2.seed_number }).eq('id', p1.id)
  await supabase.from('tournament_participants').update({ seed_number: p1.seed_number, initial_bracket_position: p1.seed_number }).eq('id', p2.id)
  await logAction(tournamentId, 'seeds_swapped', { team1_id: team1Id, team2_id: team2Id })
  return NextResponse.json({ message: 'Seeds swapped successfully' })
}

async function setSeed(tournamentId: string, teamId: string, newSeedNumber: number) {
  const { data: participant } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId).eq('team_id', teamId).single()
  if (!participant) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const { data: targetParticipant } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId).eq('seed_number', newSeedNumber).single()

  if (targetParticipant) {
    await supabase.from('tournament_participants').update({ seed_number: participant.seed_number, initial_bracket_position: participant.seed_number }).eq('id', targetParticipant.id)
  }

  await supabase.from('tournament_participants').update({ seed_number: newSeedNumber, initial_bracket_position: newSeedNumber }).eq('id', participant.id)
  await logAction(tournamentId, 'seed_set', { team_id: teamId, new_seed: newSeedNumber })
  return NextResponse.json({ message: 'Seed updated' })
}

async function randomizeSeeds(tournamentId: string) {
  const { data: participants } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId)
  if (!participants) return NextResponse.json({ error: 'No participants' }, { status: 404 })

  const shuffled = shuffleArray([...participants])
  for (let i = 0; i < shuffled.length; i++) {
    await supabase.from('tournament_participants').update({ seed_number: i + 1, initial_bracket_position: i + 1 }).eq('id', shuffled[i].id)
  }

  await logAction(tournamentId, 'seeds_randomized', { count: participants.length })
  return NextResponse.json({ message: 'Seeds randomized' })
}

async function seedByRank(tournamentId: string) {
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('*, team:teams(id, name, average_rank)')
    .eq('tournament_id', tournamentId)

  if (!participants || participants.length === 0) {
    return NextResponse.json({ error: 'No participants' }, { status: 404 })
  }

  const sorted = participants
    .map((p: any) => ({ id: p.id, value: rankToValue(p.team?.average_rank) }))
    .sort((a, b) => b.value - a.value)

  for (let i = 0; i < sorted.length; i++) {
    await supabase.from('tournament_participants').update({ seed_number: i + 1, initial_bracket_position: i + 1 }).eq('id', sorted[i].id)
  }

  await logAction(tournamentId, 'seeds_by_rank', { count: participants.length })
  return NextResponse.json({ message: 'Seeded by rank' })
}

// ─── Utility ────────────────────────────────────────────────────────

const RANK_TIERS = ['Challenger', 'Grandmaster', 'Master', 'Diamond', 'Emerald', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Iron', 'Unranked']

function rankToValue(rank: string | null): number {
  if (!rank) return 0
  const index = RANK_TIERS.indexOf(rank)
  return index === -1 ? 0 : RANK_TIERS.length - index
}

function shuffleArray<T>(array: T[]): T[] {
  const s = [...array]
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]]
  }
  return s
}

async function calculateAndSortByRank(teams: any[]): Promise<any[]> {
  const teamsWithRank = await Promise.all(
    teams.map(async (team: any) => {
      const { data: members } = await supabase.from('players').select('tier').eq('team_id', team.id)
      const values = (members || []).map((m: any) => rankToValue(m.tier)).filter((v: number) => v > 0)
      const avgValue = values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0
      return { ...team, rank_value: avgValue }
    })
  )
  return teamsWithRank.sort((a, b) => b.rank_value - a.rank_value)
}

async function logAction(tournamentId: string, action: string, details: any) {
  await supabase.from('tournament_logs').insert({ tournament_id: tournamentId, action, details: JSON.stringify(details) })
}
