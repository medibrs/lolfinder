import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TournamentOrchestrator } from '@/lib/tournament/orchestrator'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Rank tiers in order from highest to lowest
const RANK_TIERS = [
  'Challenger', 'Grandmaster', 'Master',
  'Diamond', 'Emerald', 'Platinum',
  'Gold', 'Silver', 'Bronze', 'Iron', 'Unranked'
]

function rankToValue(rank: string | null): number {
  if (!rank) return 0
  const index = RANK_TIERS.indexOf(rank)
  return index === -1 ? 0 : RANK_TIERS.length - index
}

// GET /api/tournaments/[id]/seeding - Get current seeding
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const isNumber = /^\d+$/.test(id)
    let tournamentQuery = supabase.from('tournaments').select('id, status, format, max_teams, current_round, total_rounds, swiss_rounds')
    if (isNumber) tournamentQuery = tournamentQuery.eq('tournament_number', parseInt(id))
    else tournamentQuery = tournamentQuery.eq('id', id)

    const { data: tournament, error: tournamentError } = await tournamentQuery.single()
    if (tournamentError || !tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

    const { data: participants, error } = await supabase
      .from('tournament_participants')
      .select('*, team:teams(id, name, team_avatar, captain_id, average_rank)')
      .eq('tournament_id', tournament.id)
      .order('seed_number', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { count: approvedCount } = await supabase.from('tournament_registrations').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament.id).eq('status', 'approved')
    const { count: bracketCount } = await supabase.from('tournament_brackets').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament.id)

    return NextResponse.json({
      participants: participants || [],
      tournament,
      approved_count: approvedCount || 0,
      bracket_generated: (bracketCount || 0) > 0,
      can_edit_seeding: tournament?.status !== 'Cancelled' && tournament?.status !== 'Completed'
    })
  } catch (error) {
    console.error('Error fetching seeding:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tournaments/[id]/seeding - Bulk seeding operations
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, seedings } = body

    const isNumber = /^\d+$/.test(id)
    let tournamentQuery = supabase.from('tournaments').select('*')
    if (isNumber) tournamentQuery = tournamentQuery.eq('tournament_number', parseInt(id))
    else tournamentQuery = tournamentQuery.eq('id', id)

    const { data: tournament, error: tournamentError } = await tournamentQuery.single()
    if (!tournament || tournamentError) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

    const tournamentId = tournament.id
    let result: any

    switch (action) {
      case 'bulk_update':
        result = await bulkUpdateSeeding(tournamentId, seedings)
        break
      case 'move_up':
        result = await moveSeed(tournamentId, body.team_id, 'up')
        break
      case 'move_down':
        result = await moveSeed(tournamentId, body.team_id, 'down')
        break
      case 'move_to_position':
        result = await moveToPosition(tournamentId, body.team_id, body.position)
        break
      case 'swap_seeds':
        result = await swapSeeds(tournamentId, body.team1_id, body.team2_id)
        break
      case 'set_seed':
        result = await setSeed(tournamentId, body.team_id, body.seed_number)
        break
      case 'randomize_seeds':
        result = await randomizeSeeds(tournamentId)
        break
      case 'seed_by_rank':
        result = await seedByRank(tournamentId)
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // After seeding changes, regenerate bracket ONLY if tournament hasn't started
    if (result.success || result.status === 200 || !result.status) {
      if (tournament.status === 'Registration' || tournament.status === 'Seeding') {
        try {
          const { count: bracketCount } = await supabase.from('tournament_brackets').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId)
          if (bracketCount && bracketCount > 0) {
            await TournamentOrchestrator.resetBracket(tournamentId)
            await TournamentOrchestrator.generateBracket(tournamentId)
          }
        } catch (regenErr) {
          console.warn('Bracket regeneration after seeding change failed:', regenErr)
        }
      }
    }

    return result instanceof NextResponse ? result : NextResponse.json(result)
  } catch (error) {
    console.error('Error updating seeding:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Seeding Operations ─────────────────────────────────────────────

async function bulkUpdateSeeding(tournamentId: string, seedings: { team_id: string; seed_number: number }[]) {
  if (!seedings || !Array.isArray(seedings)) return NextResponse.json({ error: 'Invalid seedings data' }, { status: 400 })

  const { data: participants, error: pErr } = await supabase.from('tournament_participants').select('id, team_id').eq('tournament_id', tournamentId).in('team_id', seedings.map(s => s.team_id))
  if (pErr || !participants) return { error: 'Participants not found', status: 404 }

  for (const s of seedings) {
    const p = participants.find(p => p.team_id === s.team_id)
    if (!p) continue
    const { error } = await supabase.from('tournament_participants')
      .update({ seed_number: s.seed_number, initial_bracket_position: s.seed_number })
      .eq('id', p.id)
    if (error) return { error: 'Failed to update seeding: ' + error.message, status: 500 }
  }
  await logAction(tournamentId, 'bulk_seeding_update', { count: seedings.length })
  return { success: true, message: 'Seeding updated successfully' }
}

async function moveSeed(tournamentId: string, teamId: string, direction: 'up' | 'down') {
  const { data: participants } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId).order('seed_number', { ascending: true })
  if (!participants) return { error: 'Failed', status: 500 }
  const idx = participants.findIndex(p => p.team_id === teamId)
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= participants.length) return { error: 'Limit reached', status: 400 }

  const p1 = participants[idx]
  const p2 = participants[targetIdx]
  const { error: e1 } = await supabase.from('tournament_participants')
    .update({ seed_number: p2.seed_number, initial_bracket_position: p2.seed_number })
    .eq('id', p1.id)
  const { error: e2 } = await supabase.from('tournament_participants')
    .update({ seed_number: p1.seed_number, initial_bracket_position: p1.seed_number })
    .eq('id', p2.id)
  if (e1 || e2) return { error: 'Failed to move seed: ' + (e1?.message || e2?.message), status: 500 }
  await logAction(tournamentId, 'seed_moved', { team_id: teamId, direction })
  return { success: true, message: 'Moved' }
}

async function moveToPosition(tournamentId: string, teamId: string, targetPosition: number) {
  const { data: participants } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId).order('seed_number', { ascending: true })
  if (!participants) return { error: 'Failed', status: 500 }
  const idx = participants.findIndex(p => p.team_id === teamId)
  if (idx === -1) return { error: 'Team not found in participants', status: 404 }
  const [moved] = participants.splice(idx, 1)
  participants.splice(targetPosition - 1, 0, moved)

  for (let i = 0; i < participants.length; i++) {
    const { error } = await supabase.from('tournament_participants')
      .update({ seed_number: i + 1, initial_bracket_position: i + 1 })
      .eq('id', participants[i].id)
    if (error) return { error: 'Failed to update position: ' + error.message, status: 500 }
  }
  await logAction(tournamentId, 'seed_moved_to_position', { team_id: teamId, to: targetPosition })
  return { success: true, message: 'Updated' }
}

async function swapSeeds(tournamentId: string, team1Id: string, team2Id: string) {
  const { data: participants, error } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId).in('team_id', [team1Id, team2Id])
  if (error || !participants || participants.length !== 2) return { error: 'Teams not found', status: 404 }

  const [p1, p2] = participants
  await supabase.from('tournament_participants').update({ seed_number: p2.seed_number, initial_bracket_position: p2.seed_number }).eq('id', p1.id)
  await supabase.from('tournament_participants').update({ seed_number: p1.seed_number, initial_bracket_position: p1.seed_number }).eq('id', p2.id)
  await logAction(tournamentId, 'seeds_swapped', { team1_id: team1Id, team2_id: team2Id })
  return { success: true, message: 'Seeds swapped' }
}

async function setSeed(tournamentId: string, teamId: string, newSeedNumber: number) {
  const { data: participant } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId).eq('team_id', teamId).single()
  if (!participant) return { error: 'Team not found', status: 404 }

  const { data: targetParticipant } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId).eq('seed_number', newSeedNumber).single()
  if (targetParticipant) {
    await supabase.from('tournament_participants').update({ seed_number: participant.seed_number, initial_bracket_position: participant.seed_number }).eq('id', targetParticipant.id)
  }

  await supabase.from('tournament_participants').update({ seed_number: newSeedNumber, initial_bracket_position: newSeedNumber }).eq('id', participant.id)
  await logAction(tournamentId, 'seed_set', { team_id: teamId, new_seed: newSeedNumber })
  return { success: true, message: 'Seed updated' }
}

async function randomizeSeeds(tournamentId: string) {
  const { data: participants } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId)
  if (!participants) return { error: 'No participants', status: 404 }

  const shuffled = shuffleArray([...participants])
  for (let i = 0; i < shuffled.length; i++) {
    await supabase.from('tournament_participants').update({ seed_number: i + 1, initial_bracket_position: i + 1 }).eq('id', shuffled[i].id)
  }

  await logAction(tournamentId, 'seeds_randomized', { count: participants.length })
  return { success: true, message: 'Seeds randomized' }
}

async function seedByRank(tournamentId: string) {
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('*, team:teams(id, name, average_rank)')
    .eq('tournament_id', tournamentId)

  if (!participants || participants.length === 0) return { error: 'No participants', status: 404 }

  const sorted = participants
    .map((p: any) => ({ id: p.id, value: rankToValue(p.team?.average_rank) }))
    .sort((a, b) => b.value - a.value)

  for (let i = 0; i < sorted.length; i++) {
    await supabase.from('tournament_participants').update({ seed_number: i + 1, initial_bracket_position: i + 1 }).eq('id', sorted[i].id)
  }

  await logAction(tournamentId, 'seeds_by_rank', { count: participants.length })
  return { success: true, message: 'Seeded by rank' }
}

// ─── Util ───────────────────────────────────────────────────────────

function shuffleArray<T>(array: T[]): T[] {
  const s = [...array]
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]]
  }
  return s
}

async function logAction(tournamentId: string, action: string, details: any) {
  await supabase.from('tournament_logs').insert({ tournament_id: tournamentId, action, details: JSON.stringify(details) })
}
