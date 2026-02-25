import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { regenerateCurrentRoundInternal, resetBracketInternal } from '@/lib/bracket-mgmt';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/tournaments/[id]/bracket - Get bracket and matches
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Get participants with seeding
    const { data: participants, error: participantsError } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        team:teams(id, name, team_avatar)
      `)
      .eq('tournament_id', id)
      .order('seed_number', { ascending: true });

    // Get brackets
    const { data: brackets, error: bracketsError } = await supabase
      .from('tournament_brackets')
      .select('*')
      .eq('tournament_id', id)
      .order('round_number', { ascending: true })
      .order('bracket_position', { ascending: true });

    // Get matches
    const { data: matches, error: matchesError } = await supabase
      .from('tournament_matches')
      .select(`
        *,
        team1:teams!tournament_matches_team1_id_fkey(id, name, team_avatar),
        team2:teams!tournament_matches_team2_id_fkey(id, name, team_avatar),
        winner:teams!tournament_matches_winner_id_fkey(id, name)
      `)
      .eq('tournament_id', id)
      .order('match_number', { ascending: true });

    return NextResponse.json({
      tournament,
      participants: participants || [],
      brackets: brackets || [],
      matches: matches || []
    });
  } catch (error) {
    console.error('Error fetching bracket:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tournaments/[id]/bracket - Generate bracket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    // Get tournament - handle both UUID and tournament_number
    const isNumber = /^\d+$/.test(id);
    let tournamentQuery = supabase.from('tournaments').select('*');

    if (isNumber) {
      tournamentQuery = tournamentQuery.eq('tournament_number', parseInt(id));
    } else {
      tournamentQuery = tournamentQuery.eq('id', id);
    }

    const { data: tournament, error: tournamentError } = await tournamentQuery.single();

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Use the actual UUID for all operations
    const tournamentUuid = tournament.id;

    switch (action) {
      case 'generate_seeding':
        return await generateSeeding(tournamentUuid, tournament, body);
      case 'generate_bracket':
        return await generateBracket(tournamentUuid, tournament);
      case 'reset_bracket':
        const resetRes = await resetBracketInternal(tournamentUuid);
        if (resetRes.error) return NextResponse.json({ error: resetRes.error }, { status: resetRes.status });
        return NextResponse.json({ message: 'Bracket reset successfully' });
      case 'regenerate_round':
        const regenRes = await regenerateCurrentRoundInternal(tournamentUuid, tournament);
        if (regenRes.error) return NextResponse.json({ error: regenRes.error }, { status: regenRes.status });
        return NextResponse.json(regenRes);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // ... (keep other functions for now, but remove the redundant ones later)
  } catch (error) {
    console.error('Error in bracket action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/tournaments/[id]/bracket - Update seeding
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    // Get tournament - handle both UUID and tournament_number
    const isNumber = /^\d+$/.test(id);
    let tournamentQuery = supabase.from('tournaments').select('id');

    if (isNumber) {
      tournamentQuery = tournamentQuery.eq('tournament_number', parseInt(id));
    } else {
      tournamentQuery = tournamentQuery.eq('id', id);
    }

    const { data: tournament, error: tournamentError } = await tournamentQuery.single();

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const tournamentUuid = tournament.id;

    switch (action) {
      case 'swap_seeds':
        return await swapSeeds(tournamentUuid, body.team1_id, body.team2_id);
      case 'set_seed':
        return await setSeed(tournamentUuid, body.team_id, body.seed_number);
      case 'randomize_seeds':
        return await randomizeSeeds(tournamentUuid);
      case 'seed_by_rank':
        return await seedByRank(tournamentUuid);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating seeding:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============ SEEDING FUNCTIONS ============

async function generateSeeding(tournamentId: string, tournament: any, options: any) {
  const { seeding_method = 'random' } = options;

  // Get approved registrations with team info
  const { data: registrations, error: regError } = await supabase
    .from('tournament_registrations')
    .select(`
      team_id,
      status,
      team:teams(id, name)
    `)
    .eq('tournament_id', tournamentId)
    .eq('status', 'approved');

  if (regError || !registrations || registrations.length === 0) {
    return NextResponse.json({ error: 'No approved teams found' }, { status: 400 });
  }

  // Clear existing participants
  await supabase
    .from('tournament_participants')
    .delete()
    .eq('tournament_id', tournamentId);

  let teams = registrations.map(r => r.team);

  // Apply seeding method
  switch (seeding_method) {
    case 'rank':
      // Calculate average rank for each team and sort
      teams = await calculateAndSortByRank(teams);
      break;
    case 'random':
    default:
      // Shuffle randomly
      teams = shuffleArray(teams);
      break;
  }

  // Create participants with seed numbers
  const participants = teams.map((team: any, index: number) => ({
    tournament_id: tournamentId,
    team_id: team.id,
    seed_number: index + 1,
    initial_bracket_position: index + 1,
    is_active: true
  }));

  const { data: insertedParticipants, error: insertError } = await supabase
    .from('tournament_participants')
    .insert(participants)
    .select(`
      *,
      team:teams(id, name, team_avatar)
    `);

  if (insertError) {
    console.error('Error inserting participants:', insertError);
    return NextResponse.json({ error: 'Failed to create seeding' }, { status: 500 });
  }

  // Add calculated rank to response
  const participantsWithRank = await Promise.all(
    (insertedParticipants || []).map(async (p: any) => {
      const { rank } = await calculateTeamAverageRank(p.team?.id);
      return {
        ...p,
        team: {
          ...p.team,
          average_rank: rank
        }
      };
    })
  );

  // Update tournament status to Seeding
  await supabase
    .from('tournaments')
    .update({ status: 'Seeding' })
    .eq('id', tournamentId);

  // Log the action
  await logTournamentAction(tournamentId, 'seeding_generated', {
    method: seeding_method,
    team_count: teams.length
  });

  return NextResponse.json({
    message: 'Seeding generated successfully',
    participants: participantsWithRank
  });
}

async function swapSeeds(tournamentId: string, team1Id: string, team2Id: string) {
  // Get both participants
  const { data: participants, error } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('tournament_id', tournamentId)
    .in('team_id', [team1Id, team2Id]);

  if (error || !participants || participants.length !== 2) {
    return NextResponse.json({ error: 'Teams not found in tournament' }, { status: 404 });
  }

  const [p1, p2] = participants;

  // Swap seed numbers
  await supabase
    .from('tournament_participants')
    .update({ seed_number: p2.seed_number, initial_bracket_position: p2.initial_bracket_position })
    .eq('id', p1.id);

  await supabase
    .from('tournament_participants')
    .update({ seed_number: p1.seed_number, initial_bracket_position: p1.initial_bracket_position })
    .eq('id', p2.id);

  await logTournamentAction(tournamentId, 'seeds_swapped', {
    team1_id: team1Id,
    team2_id: team2Id,
    seed1: p1.seed_number,
    seed2: p2.seed_number
  });

  return NextResponse.json({ message: 'Seeds swapped successfully' });
}

async function setSeed(tournamentId: string, teamId: string, newSeedNumber: number) {
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

  const oldSeed = participant.seed_number;

  // Get participant currently at the target seed
  const { data: targetParticipant } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('seed_number', newSeedNumber)
    .single();

  if (targetParticipant) {
    // Swap with existing
    await supabase
      .from('tournament_participants')
      .update({ seed_number: oldSeed, initial_bracket_position: oldSeed })
      .eq('id', targetParticipant.id);
  }

  // Set new seed
  await supabase
    .from('tournament_participants')
    .update({ seed_number: newSeedNumber, initial_bracket_position: newSeedNumber })
    .eq('id', participant.id);

  await logTournamentAction(tournamentId, 'seed_set', {
    team_id: teamId,
    old_seed: oldSeed,
    new_seed: newSeedNumber
  });

  return NextResponse.json({ message: 'Seed updated successfully' });
}

async function randomizeSeeds(tournamentId: string) {
  // Get all participants
  const { data: participants, error } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('tournament_id', tournamentId);

  if (error || !participants) {
    return NextResponse.json({ error: 'No participants found' }, { status: 404 });
  }

  // Shuffle and reassign
  const shuffled = shuffleArray([...participants]);

  for (let i = 0; i < shuffled.length; i++) {
    await supabase
      .from('tournament_participants')
      .update({ seed_number: i + 1, initial_bracket_position: i + 1 })
      .eq('id', shuffled[i].id);
  }

  await logTournamentAction(tournamentId, 'seeds_randomized', {
    team_count: participants.length
  });

  return NextResponse.json({ message: 'Seeds randomized successfully' });
}

async function seedByRank(tournamentId: string) {
  // Get all participants with team info
  const { data: participants, error } = await supabase
    .from('tournament_participants')
    .select(`
      *,
      team:teams(id, name)
    `)
    .eq('tournament_id', tournamentId);

  if (error || !participants || participants.length === 0) {
    return NextResponse.json({ error: 'No participants found' }, { status: 404 });
  }

  // Calculate average rank for each team and sort
  const teamsWithRank = await Promise.all(
    participants.map(async (p) => {
      const { rank, value } = await calculateTeamAverageRank(p.team.id);
      return {
        ...p.team,
        participant_id: p.id,
        calculated_rank: rank,
        rank_value: value
      };
    })
  );

  // Sort by rank value (higher = better = lower seed number)
  const sorted = teamsWithRank.sort((a, b) => b.rank_value - a.rank_value);

  // Update seed numbers and build response
  const updatedParticipants = [];
  for (let i = 0; i < sorted.length; i++) {
    const newSeedNumber = i + 1;
    await supabase
      .from('tournament_participants')
      .update({ seed_number: newSeedNumber, initial_bracket_position: newSeedNumber })
      .eq('id', sorted[i].participant_id);

    // Find original participant and update with new seed
    const original = participants.find(p => p.id === sorted[i].participant_id);
    updatedParticipants.push({
      ...original,
      seed_number: newSeedNumber,
      initial_bracket_position: newSeedNumber,
      team: {
        ...original?.team,
        average_rank: sorted[i].calculated_rank
      }
    });
  }

  await logTournamentAction(tournamentId, 'seeds_by_rank', {
    team_count: participants.length
  });

  return NextResponse.json({
    message: 'Seeds set by rank successfully',
    participants: updatedParticipants
  });
}

// ============ BRACKET GENERATION ============

async function generateBracket(tournamentId: string, tournament: any) {
  // Check if bracket already exists
  const { data: existingBrackets } = await supabase
    .from('tournament_brackets')
    .select('id')
    .eq('tournament_id', tournamentId)
    .limit(1);

  if (existingBrackets && existingBrackets.length > 0) {
    return NextResponse.json({
      error: 'Bracket already exists. Reset bracket first to regenerate.'
    }, { status: 400 });
  }

  // Get participants
  const { data: participants, error: pError } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('seed_number', { ascending: true });

  if (pError || !participants || participants.length < 2) {
    return NextResponse.json({
      error: 'Need at least 2 seeded teams to generate bracket'
    }, { status: 400 });
  }

  const format = tournament.format || 'Single_Elimination';

  switch (format) {
    case 'Single_Elimination':
      return await generateSingleEliminationBracket(tournamentId, tournament, participants);
    case 'Double_Elimination':
      return await generateDoubleEliminationBracket(tournamentId, tournament, participants);
    case 'Swiss':
      return await generateSwissRound(tournamentId, tournament, participants, 1);
    case 'Round_Robin':
      return await generateRoundRobinSchedule(tournamentId, tournament, participants);
    default:
      return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
  }
}

async function generateSingleEliminationBracket(
  tournamentId: string,
  tournament: any,
  participants: any[]
) {
  const teamCount = participants.length;
  const totalRounds = Math.ceil(Math.log2(teamCount));
  const bracketSize = Math.pow(2, totalRounds); // Next power of 2
  const byeCount = bracketSize - teamCount;

  // Generate seeding order for bracket (1v8, 4v5, 3v6, 2v7 for 8 teams)
  const seedOrder = generateBracketSeedOrder(bracketSize);

  const brackets: any[] = [];
  const matches: any[] = [];
  let matchNumber = 1;

  // Create all rounds
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);

    for (let position = 1; position <= matchesInRound; position++) {
      // Create bracket entry
      const bracket = {
        tournament_id: tournamentId,
        round_number: round,
        bracket_position: position,
        is_final: round === totalRounds,
        is_third_place: false
      };

      brackets.push(bracket);
    }
  }

  // Insert brackets first
  const { data: insertedBrackets, error: bracketError } = await supabase
    .from('tournament_brackets')
    .insert(brackets)
    .select();

  if (bracketError) {
    console.error('Error inserting brackets:', bracketError);
    return NextResponse.json({ error: 'Failed to create brackets' }, { status: 500 });
  }

  // Create matches for first round with seeded teams
  const firstRoundBrackets = insertedBrackets.filter(b => b.round_number === 1);
  const firstRoundMatches = firstRoundBrackets.length;

  for (let i = 0; i < firstRoundMatches; i++) {
    const bracket = firstRoundBrackets[i];
    const seed1Index = seedOrder[i * 2];
    const seed2Index = seedOrder[i * 2 + 1];

    const team1 = participants[seed1Index] || null;
    const team2 = participants[seed2Index] || null;

    const match: any = {
      bracket_id: bracket.id,
      tournament_id: tournamentId,
      match_number: matchNumber++,
      team1_id: team1?.team_id || null,
      team2_id: team2?.team_id || null,
      status: 'Scheduled',
      best_of: tournament.opening_best_of || 1
    };

    // Handle byes - if one team is null, other team auto-advances
    if (team1 && !team2) {
      match.winner_id = team1.team_id;
      match.status = 'Completed';
      match.result = 'Team1_Win';
    } else if (team2 && !team1) {
      match.winner_id = team2.team_id;
      match.status = 'Completed';
      match.result = 'Team2_Win';
    }

    matches.push(match);
  }

  // Create empty matches for subsequent rounds
  for (let round = 2; round <= totalRounds; round++) {
    const roundBrackets = insertedBrackets.filter(b => b.round_number === round);

    for (const bracket of roundBrackets) {
      const bestOf = round === totalRounds
        ? (tournament.finals_best_of || tournament.elimination_best_of || 3)
        : (tournament.elimination_best_of || 3);

      matches.push({
        bracket_id: bracket.id,
        tournament_id: tournamentId,
        match_number: matchNumber++,
        team1_id: null,
        team2_id: null,
        status: 'Scheduled',
        best_of: bestOf
      });
    }
  }

  // Insert matches
  const { data: insertedMatches, error: matchError } = await supabase
    .from('tournament_matches')
    .insert(matches)
    .select();

  if (matchError) {
    console.error('Error inserting matches:', matchError);
    return NextResponse.json({ error: 'Failed to create matches' }, { status: 500 });
  }

  // Update tournament
  await supabase
    .from('tournaments')
    .update({
      status: 'In_Progress',
      total_rounds: totalRounds,
      current_round: 1
    })
    .eq('id', tournamentId);

  // Process any bye winners to advance them
  await advanceByeWinners(tournamentId, insertedBrackets, insertedMatches);

  await logTournamentAction(tournamentId, 'bracket_generated', {
    format: 'Single_Elimination',
    team_count: teamCount,
    total_rounds: totalRounds,
    bye_count: byeCount
  });

  return NextResponse.json({
    message: 'Bracket generated successfully',
    brackets: insertedBrackets,
    matches: insertedMatches,
    total_rounds: totalRounds
  });
}

async function generateDoubleEliminationBracket(
  tournamentId: string,
  tournament: any,
  participants: any[]
) {
  // TODO: Implement double elimination
  return NextResponse.json({
    error: 'Double elimination not yet implemented'
  }, { status: 501 });
}

async function generateSwissRound(
  tournamentId: string,
  tournament: any,
  participants: any[],
  roundNumber: number
) {
  if (roundNumber !== 1) {
    return NextResponse.json({ error: 'Only Round 1 generation is supported here' }, { status: 400 });
  }

  const totalRounds = tournament.swiss_rounds || 5;

  const newBrackets: any[] = [];
  const matches: any[] = [];
  let matchNumber = 1;

  for (let i = 0; i < participants.length; i += 2) {
    newBrackets.push({
      tournament_id: tournamentId,
      round_number: roundNumber,
      bracket_position: Math.floor(i / 2) + 1,
    });
  }

  const { data: insertedBrackets, error: bracketError } = await supabase
    .from('tournament_brackets')
    .insert(newBrackets)
    .select('*');

  if (bracketError || !insertedBrackets) {
    console.error('Error inserting brackets:', bracketError);
    return NextResponse.json({ error: 'Failed to create brackets' }, { status: 500 });
  }

  for (let i = 0; i < participants.length; i += 2) {
    const p1 = participants[i];
    const p2 = participants[i + 1] || null;
    const bracket = insertedBrackets[Math.floor(i / 2)];

    matches.push({
      bracket_id: bracket.id,
      tournament_id: tournamentId,
      match_number: matchNumber++,
      team1_id: p1?.team_id || null,
      team2_id: p2?.team_id || null,
      status: p2 ? 'Scheduled' : 'Completed',
      result: !p2 ? 'Team1_Win' : null,
      winner_id: !p2 ? p1?.team_id : null,
      best_of: tournament.opening_best_of || 1
    });
  }

  const { data: insertedMatches, error: matchError } = await supabase
    .from('tournament_matches')
    .insert(matches)
    .select('*');

  if (matchError) {
    console.error('Error inserting matches:', matchError);
    return NextResponse.json({ error: 'Failed to create matches' }, { status: 500 });
  }

  await supabase
    .from('tournaments')
    .update({
      status: 'In_Progress',
      current_round: 1,
      total_rounds: totalRounds
    })
    .eq('id', tournamentId);

  await logTournamentAction(tournamentId, 'bracket_generated', {
    format: 'Swiss',
    team_count: participants.length,
    total_rounds: totalRounds
  });

  return NextResponse.json({
    message: 'Swiss Round 1 generated successfully',
    brackets: insertedBrackets,
    matches: insertedMatches,
    total_rounds: totalRounds
  });
}

async function generateRoundRobinSchedule(
  tournamentId: string,
  tournament: any,
  participants: any[]
) {
  // TODO: Implement round robin
  return NextResponse.json({
    error: 'Round robin not yet implemented'
  }, { status: 501 });
}


// ============ HELPER FUNCTIONS ============

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Rank tiers in order from highest to lowest
const RANK_TIERS = [
  'Challenger', 'Grandmaster', 'Master',
  'Diamond', 'Emerald', 'Platinum',
  'Gold', 'Silver', 'Bronze', 'Iron', 'Unranked'
];

// Convert rank tier to numeric value (higher = better)
function rankToValue(rank: string | null): number {
  if (!rank) return 0; // Unranked
  const index = RANK_TIERS.indexOf(rank);
  return index === -1 ? 0 : RANK_TIERS.length - index;
}

// Convert numeric value back to rank tier
function valueToRank(value: number): string {
  const index = RANK_TIERS.length - Math.round(value);
  return RANK_TIERS[Math.max(0, Math.min(index, RANK_TIERS.length - 1))];
}

// Calculate average rank for a team from its members
async function calculateTeamAverageRank(teamId: string): Promise<{ rank: string; value: number }> {
  // Players are linked to teams via players.team_id, rank is stored in 'tier' column
  const { data: members } = await supabase
    .from('players')
    .select('tier')
    .eq('team_id', teamId);

  if (!members || members.length === 0) {
    return { rank: 'Unranked', value: 0 };
  }

  const values = members
    .map((m: any) => rankToValue(m.tier))
    .filter((v: number) => v > 0); // Exclude unranked from average

  if (values.length === 0) {
    return { rank: 'Unranked', value: 0 };
  }

  const avgValue = values.reduce((a: number, b: number) => a + b, 0) / values.length;
  return { rank: valueToRank(avgValue), value: avgValue };
}

// Calculate ranks for all teams and sort by rank (highest first)
async function calculateAndSortByRank(teams: any[]): Promise<any[]> {
  // Calculate average rank for each team
  const teamsWithRank = await Promise.all(
    teams.map(async (team) => {
      const { rank, value } = await calculateTeamAverageRank(team.id);
      return { ...team, calculated_rank: rank, rank_value: value };
    })
  );

  // Sort by rank value (higher = better = lower seed number)
  return teamsWithRank.sort((a, b) => b.rank_value - a.rank_value);
}

// Legacy function for synchronous sorting (used in PUT handlers)
function sortTeamsByRank(teams: any[]): any[] {
  // This is used when we already have rank data attached
  // Falls back to name sort if no rank data
  return teams.sort((a, b) => {
    if (a.rank_value !== undefined && b.rank_value !== undefined) {
      return b.rank_value - a.rank_value;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}

// Generate bracket seed order (1v8, 4v5, 3v6, 2v7 pattern)
function generateBracketSeedOrder(bracketSize: number): number[] {
  if (bracketSize === 2) return [0, 1];

  const order: number[] = [];
  const halfSize = bracketSize / 2;
  const subOrder = generateBracketSeedOrder(halfSize);

  for (const seed of subOrder) {
    order.push(seed);
    order.push(bracketSize - 1 - seed);
  }

  return order;
}

async function advanceByeWinners(
  tournamentId: string,
  brackets: any[],
  matches: any[]
) {
  // Find completed matches (byes) in round 1
  const byeMatches = matches.filter(m =>
    m.status === 'Completed' &&
    brackets.find(b => b.id === m.bracket_id)?.round_number === 1
  );

  for (const byeMatch of byeMatches) {
    const bracket = brackets.find(b => b.id === byeMatch.bracket_id);
    if (!bracket || !byeMatch.winner_id) continue;

    // Find next round match
    const nextRoundBrackets = brackets.filter(b => b.round_number === 2);
    const nextPosition = Math.ceil(bracket.bracket_position / 2);
    const nextBracket = nextRoundBrackets.find(b => b.bracket_position === nextPosition);

    if (!nextBracket) continue;

    const nextMatch = matches.find(m => m.bracket_id === nextBracket.id);
    if (!nextMatch) continue;

    // Determine if winner goes to team1 or team2 slot
    const isUpperMatch = bracket.bracket_position % 2 === 1;
    const updateField = isUpperMatch ? 'team1_id' : 'team2_id';

    await supabase
      .from('tournament_matches')
      .update({ [updateField]: byeMatch.winner_id })
      .eq('id', nextMatch.id);
  }
}

async function logTournamentAction(
  tournamentId: string,
  action: string,
  details: any
) {
  await supabase
    .from('tournament_logs')
    .insert({
      tournament_id: tournamentId,
      action,
      details: JSON.stringify(details)
    });
}
