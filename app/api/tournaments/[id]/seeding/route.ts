import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

// Calculate average rank for a team from its members
async function calculateTeamAverageRank(teamId: string): Promise<string> {
  // Players are linked to teams via players.team_id, rank is stored in 'tier' column
  const { data: members } = await supabase
    .from('players')
    .select('tier')
    .eq('team_id', teamId);

  if (!members || members.length === 0) {
    return 'Unranked';
  }

  const values = members
    .map((m: any) => rankToValue(m.tier))
    .filter((v: number) => v > 0);

  if (values.length === 0) {
    return 'Unranked';
  }

  const avgValue = values.reduce((a: number, b: number) => a + b, 0) / values.length;
  return valueToRank(avgValue);
}

// GET /api/tournaments/[id]/seeding - Get current seeding
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Resolve Tournament ID (Number vs UUID)
    const isNumber = /^\d+$/.test(id);
    let tournamentQuery = supabase.from('tournaments').select('id, status, format, max_teams, current_round, total_rounds, swiss_rounds');

    if (isNumber) {
      tournamentQuery = tournamentQuery.eq('tournament_number', parseInt(id));
    } else {
      tournamentQuery = tournamentQuery.eq('id', id);
    }

    const { data: tournament, error: tournamentError } = await tournamentQuery.single();

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const tournamentId = tournament.id;

    // Get participants with team info, ordered by seed
    const { data: participants, error } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        team:teams(
          id, 
          name, 
          team_avatar,
          captain_id
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('seed_number', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate average rank for each participant's team
    const participantsWithRank = await Promise.all(
      (participants || []).map(async (p: any) => {
        const averageRank = await calculateTeamAverageRank(p.team?.id);
        return {
          ...p,
          team: {
            ...p.team,
            average_rank: averageRank
          }
        };
      })
    );

    // Get approved registrations count
    const { count: approvedCount } = await supabase
      .from('tournament_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('status', 'approved');

    // Check if bracket has been generated
    const { count: bracketCount } = await supabase
      .from('tournament_brackets')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    return NextResponse.json({
      participants: participantsWithRank,
      tournament,
      approved_count: approvedCount || 0,
      bracket_generated: (bracketCount || 0) > 0,
      can_edit_seeding: tournament?.status === 'Registration' || tournament?.status === 'Seeding' || tournament?.status === 'Registration_Closed'
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

    // Verify tournament is in correct state
    const isNumber = /^\d+$/.test(id);
    let tournamentQuery = supabase.from('tournaments').select('id, status');

    if (isNumber) {
      tournamentQuery = tournamentQuery.eq('tournament_number', parseInt(id));
    } else {
      tournamentQuery = tournamentQuery.eq('id', id);
    }

    const { data: tournament, error: tournamentError } = await tournamentQuery.single();

    if (!tournament || tournamentError) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const tournamentId = tournament.id;

    // Note: Seeding can be modified at any time — admins may want to adjust
    // for future round pairings even after bracket generation.

    switch (action) {
      case 'bulk_update':
        return await bulkUpdateSeeding(tournamentId, seedings);
      case 'move_up':
        return await moveSeed(tournamentId, body.team_id, 'up');
      case 'move_down':
        return await moveSeed(tournamentId, body.team_id, 'down');
      case 'move_to_position':
        return await moveToPosition(tournamentId, body.team_id, body.position);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating seeding:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Bulk update all seedings at once (for drag-and-drop reordering)
async function bulkUpdateSeeding(tournamentId: string, seedings: { team_id: string; seed_number: number }[]) {
  if (!seedings || !Array.isArray(seedings)) {
    return NextResponse.json({ error: 'Invalid seedings data' }, { status: 400 });
  }

  // Update each participant
  for (const seeding of seedings) {
    const { error } = await supabase
      .from('tournament_participants')
      .update({
        seed_number: seeding.seed_number,
        initial_bracket_position: seeding.seed_number
      })
      .eq('tournament_id', tournamentId)
      .eq('team_id', seeding.team_id);

    if (error) {
      console.error('Error updating seeding:', error);
      return NextResponse.json({ error: 'Failed to update seeding' }, { status: 500 });
    }
  }

  await logAction(tournamentId, 'bulk_seeding_update', { count: seedings.length });

  return NextResponse.json({ message: 'Seeding updated successfully' });
}

// Move a team up or down one position
async function moveSeed(tournamentId: string, teamId: string, direction: 'up' | 'down') {
  // Get current participant
  const { data: participant, error: pError } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('team_id', teamId)
    .single();

  if (pError || !participant) {
    return NextResponse.json({ error: 'Team not found in tournament' }, { status: 404 });
  }

  const currentSeed = participant.seed_number;
  const newSeed = direction === 'up' ? currentSeed - 1 : currentSeed + 1;

  if (newSeed < 1) {
    return NextResponse.json({ error: 'Already at top seed' }, { status: 400 });
  }

  // Get participant at target position
  const { data: targetParticipant } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('seed_number', newSeed)
    .single();

  if (!targetParticipant && direction === 'down') {
    return NextResponse.json({ error: 'Already at bottom seed' }, { status: 400 });
  }

  // Swap positions
  if (targetParticipant) {
    await supabase
      .from('tournament_participants')
      .update({ seed_number: currentSeed, initial_bracket_position: currentSeed })
      .eq('id', targetParticipant.id);
  }

  await supabase
    .from('tournament_participants')
    .update({ seed_number: newSeed, initial_bracket_position: newSeed })
    .eq('id', participant.id);

  await logAction(tournamentId, 'seed_moved', {
    team_id: teamId,
    direction,
    from: currentSeed,
    to: newSeed
  });

  return NextResponse.json({ message: `Seed moved ${direction}` });
}

// Move a team to a specific position
async function moveToPosition(tournamentId: string, teamId: string, targetPosition: number) {
  // Get all participants
  const { data: participants, error } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('seed_number', { ascending: true });

  if (error || !participants) {
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
  }

  const currentIndex = participants.findIndex(p => p.team_id === teamId);
  if (currentIndex === -1) {
    return NextResponse.json({ error: 'Team not found in tournament' }, { status: 404 });
  }

  if (targetPosition < 1 || targetPosition > participants.length) {
    return NextResponse.json({ error: 'Invalid target position' }, { status: 400 });
  }

  // Remove team from current position and insert at new position
  const [movedParticipant] = participants.splice(currentIndex, 1);
  participants.splice(targetPosition - 1, 0, movedParticipant);

  // Update all seed numbers
  for (let i = 0; i < participants.length; i++) {
    await supabase
      .from('tournament_participants')
      .update({ seed_number: i + 1, initial_bracket_position: i + 1 })
      .eq('id', participants[i].id);
  }

  await logAction(tournamentId, 'seed_moved_to_position', {
    team_id: teamId,
    from: currentIndex + 1,
    to: targetPosition
  });

  return NextResponse.json({ message: 'Seed position updated' });
}

async function logAction(tournamentId: string, action: string, details: any) {
  await supabase
    .from('tournament_logs')
    .insert({
      tournament_id: tournamentId,
      action,
      details: JSON.stringify(details)
    });
}
