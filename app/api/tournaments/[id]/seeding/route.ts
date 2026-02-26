import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { regenerateCurrentRoundInternal, swapSeedsInternal, setSeedInternal, randomizeSeedsInternal } from '@/lib/bracket-mgmt';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rank tiers in order from highest to lowest
const RANK_TIERS = [
  'Challenger', 'Grandmaster', 'Master',
  'Diamond', 'Emerald', 'Platinum',
  'Gold', 'Silver', 'Bronze', 'Iron', 'Unranked'
];


// Convert rank tier to numeric value (higher = better)
function rankToValue(rank: string | null): number {
  if (!rank) return 0;
  const index = RANK_TIERS.indexOf(rank);
  return index === -1 ? 0 : RANK_TIERS.length - index;
}

// Convert numeric value back to rank tier
function valueToRank(value: number): string {
  const index = RANK_TIERS.length - Math.round(value);
  return RANK_TIERS[Math.max(0, Math.min(index, RANK_TIERS.length - 1))];
}


// GET /api/tournaments/[id]/seeding - Get current seeding
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const isNumber = /^\d+$/.test(id);
    let tournamentQuery = supabase.from('tournaments').select('id, status, format, max_teams, current_round, total_rounds, swiss_rounds');
    if (isNumber) tournamentQuery = tournamentQuery.eq('tournament_number', parseInt(id));
    else tournamentQuery = tournamentQuery.eq('id', id);

    const { data: tournament, error: tournamentError } = await tournamentQuery.single();
    if (tournamentError || !tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    const { data: participants, error } = await supabase
      .from('tournament_participants')
      .select('*, team:teams(id, name, team_avatar, captain_id, average_rank)')
      .eq('tournament_id', tournament.id)
      .order('seed_number', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const participantsWithRank = participants || [];

    const { count: approvedCount } = await supabase.from('tournament_registrations').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament.id).eq('status', 'approved');
    const { count: bracketCount } = await supabase.from('tournament_brackets').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament.id);

    return NextResponse.json({
      participants: participantsWithRank,
      tournament,
      approved_count: approvedCount || 0,
      bracket_generated: (bracketCount || 0) > 0,
      can_edit_seeding: tournament?.status !== 'Cancelled' && tournament?.status !== 'Completed'
    });
  } catch (error) {
    console.error('Error fetching seeding:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tournaments/[id]/seeding - Bulk seeding operations
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, seedings } = body;

    const isNumber = /^\d+$/.test(id);
    let tournamentQuery = supabase.from('tournaments').select('*');
    if (isNumber) tournamentQuery = tournamentQuery.eq('tournament_number', parseInt(id));
    else tournamentQuery = tournamentQuery.eq('id', id);

    const { data: tournament, error: tournamentError } = await tournamentQuery.single();
    if (!tournament || tournamentError) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    const tournamentId = tournament.id;
    let result: any;

    switch (action) {
      case 'bulk_update':
        result = await bulkUpdateSeeding(tournamentId, seedings);
        break;
      case 'move_up':
        result = await moveSeed(tournamentId, body.team_id, 'up');
        break;
      case 'move_down':
        result = await moveSeed(tournamentId, body.team_id, 'down');
        break;
      case 'move_to_position':
        result = await moveToPosition(tournamentId, body.team_id, body.position);
        break;
      case 'swap_seeds':
        result = await swapSeedsInternal(tournamentId, body.team1_id, body.team2_id);
        break;
      case 'set_seed':
        result = await setSeedInternal(tournamentId, body.team_id, body.seed_number);
        break;
      case 'randomize_seeds':
        result = await randomizeSeedsInternal(tournamentId);
        break;
      case 'seed_by_rank':
        result = await seedByRank(tournamentId);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (result.success || result.status === 200 || !result.status) {
      await regenerateCurrentRoundInternal(tournamentId, tournament);
    }
    return result instanceof NextResponse ? result : NextResponse.json(result);
  } catch (error) {
    console.error('Error updating seeding:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function bulkUpdateSeeding(tournamentId: string, seedings: { team_id: string; seed_number: number }[]) {
  if (!seedings || !Array.isArray(seedings)) return NextResponse.json({ error: 'Invalid seedings data' }, { status: 400 });

  const { data: participants, error: pErr } = await supabase.from('tournament_participants').select('id, team_id').eq('tournament_id', tournamentId).in('team_id', seedings.map(s => s.team_id));
  if (pErr || !participants) return { error: 'Participants not found', status: 404 };

  const updates = seedings.map(s => {
    const p = participants.find(p => p.team_id === s.team_id);
    return {
      id: p?.id,
      seed_number: s.seed_number,
      initial_bracket_position: s.seed_number
    };
  }).filter(u => u.id);

  const { error: uErr } = await supabase.from('tournament_participants').upsert(updates);
  if (uErr) return { error: 'Failed to update seeding: ' + uErr.message, status: 500 };
  await logAction(tournamentId, 'bulk_seeding_update', { count: seedings.length });
  return { success: true, message: 'Seeding updated successfully' };
}

async function moveSeed(tournamentId: string, teamId: string, direction: 'up' | 'down') {
  const { data: participants } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId).order('seed_number', { ascending: true });
  if (!participants) return { error: 'Failed', status: 500 };
  const idx = participants.findIndex(p => p.team_id === teamId);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= participants.length) return { error: 'Limit reached', status: 400 };

  const p1 = participants[idx];
  const p2 = participants[targetIdx];
  const { error: upsertErr } = await supabase.from('tournament_participants').upsert([
    { id: p1.id, seed_number: p2.seed_number, initial_bracket_position: p2.seed_number },
    { id: p2.id, seed_number: p1.seed_number, initial_bracket_position: p1.seed_number }
  ]);
  if (upsertErr) return { error: 'Failed to move seed: ' + upsertErr.message, status: 500 };
  await logAction(tournamentId, 'seed_moved', { team_id: teamId, direction });
  return { success: true, message: 'Moved' };
}

async function moveToPosition(tournamentId: string, teamId: string, targetPosition: number) {
  const { data: participants } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId).order('seed_number', { ascending: true });
  if (!participants) return { error: 'Failed', status: 500 };
  const idx = participants.findIndex(p => p.team_id === teamId);
  const [moved] = participants.splice(idx, 1);
  participants.splice(targetPosition - 1, 0, moved);

  const updates = participants.map((p, i) => ({
    id: p.id,
    seed_number: i + 1,
    initial_bracket_position: i + 1
  }));

  const { error: upsertErr } = await supabase.from('tournament_participants').upsert(updates);
  if (upsertErr) return { error: 'Failed to update position: ' + upsertErr.message, status: 500 };
  await logAction(tournamentId, 'seed_moved_to_position', { team_id: teamId, to: targetPosition });
  return { success: true, message: 'Updated' };
}

async function seedByRank(tournamentId: string) {
  const { data: participants, error: pErr } = await supabase
    .from('tournament_participants')
    .select(`*, team:teams(id, name, average_rank)`)
    .eq('tournament_id', tournamentId);

  if (pErr || !participants || participants.length === 0) return { error: 'No participants', status: 404 };

  const teamsWithRank = participants.map((p: any) => ({
    participant_id: p.id,
    rank_value: rankToValue(p.team?.average_rank)
  }));

  const sorted = teamsWithRank.sort((a, b) => b.rank_value - a.rank_value);

  const updates = sorted.map((s, i) => ({
    id: s.participant_id,
    seed_number: i + 1,
    initial_bracket_position: i + 1
  }));

  const { error: upsertErr } = await supabase.from('tournament_participants').upsert(updates);
  if (upsertErr) return { error: 'Failed to seed by rank: ' + upsertErr.message, status: 500 };

  await logAction(tournamentId, 'seeds_by_rank', { count: participants.length });
  return { success: true, message: 'Seeded by rank' };
}

async function logAction(tournamentId: string, action: string, details: any) {
  await supabase.from('tournament_logs').insert({ tournament_id: tournamentId, action, details: JSON.stringify(details) });
}
