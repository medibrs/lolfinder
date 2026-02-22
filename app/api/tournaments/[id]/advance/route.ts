import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Resolve tournament ID (handles both numeric tournament_number and UUID)
async function resolveTournamentId(id: string): Promise<string | null> {
    const isNumber = /^\d+$/.test(id);
    let query = supabase.from('tournaments').select('id');

    if (isNumber) {
        query = query.eq('tournament_number', parseInt(id));
    } else {
        query = query.eq('id', id);
    }

    const { data, error } = await query.single();
    if (error || !data) return null;
    return data.id;
}

// POST /api/tournaments/[id]/advance
// Advances a tournament to its next round based on match statuses.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const tournamentUuid = await resolveTournamentId(id);

        if (!tournamentUuid) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        // Fetch tournament
        const { data: tournament, error: tourError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentUuid)
            .single();

        if (tourError || !tournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        const { format, current_round, total_rounds } = tournament;

        // Check if tournament is finished
        if (current_round >= total_rounds) {
            return NextResponse.json({ error: 'Tournament has already reached its final round' }, { status: 400 });
        }

        // Fetch all brackets
        const { data: brackets } = await supabase
            .from('tournament_brackets')
            .select('*')
            .eq('tournament_id', tournamentUuid);

        // Fetch all matches
        const { data: allMatches } = await supabase
            .from('tournament_matches')
            .select('*')
            .eq('tournament_id', tournamentUuid);

        // Build bracket lookup
        const bracketsMap: Record<string, any> = {};
        for (const b of (brackets || [])) {
            bracketsMap[b.id] = b;
        }

        // Filter matches to the current round using bracket lookup
        const roundMatches = (allMatches || []).filter(m => {
            const bracket = bracketsMap[m.bracket_id];
            return bracket && bracket.round_number === current_round;
        }).map(m => ({
            ...m,
            bracket: bracketsMap[m.bracket_id]
        }));

        if (roundMatches.length === 0) {
            return NextResponse.json({ error: 'No matches found in the current round' }, { status: 400 });
        }

        // For Swiss: auto-resolve matches where both teams are already qualified or eliminated
        if (format === 'Swiss') {
            const maxWins = 3;
            const maxLosses = 3;

            // Compute W-L records from all completed matches across all rounds
            const wlRecords: Record<string, { wins: number; losses: number }> = {};
            for (const m of (allMatches || [])) {
                if (m.status !== 'Completed') continue;
                if (m.team1_id && !wlRecords[m.team1_id]) wlRecords[m.team1_id] = { wins: 0, losses: 0 };
                if (m.team2_id && !wlRecords[m.team2_id]) wlRecords[m.team2_id] = { wins: 0, losses: 0 };
                if (m.result === 'Team1_Win') {
                    if (m.team1_id) wlRecords[m.team1_id].wins++;
                    if (m.team2_id) wlRecords[m.team2_id].losses++;
                } else if (m.result === 'Team2_Win') {
                    if (m.team2_id) wlRecords[m.team2_id].wins++;
                    if (m.team1_id) wlRecords[m.team1_id].losses++;
                }
            }

            const isFinished = (teamId: string | null) => {
                if (!teamId) return true;
                const rec = wlRecords[teamId];
                if (!rec) return false;
                return rec.wins >= maxWins || rec.losses >= maxLosses;
            };

            // Auto-complete ghost matches
            for (const m of roundMatches) {
                if (m.status === 'Completed') continue;
                if (isFinished(m.team1_id) && isFinished(m.team2_id)) {
                    await supabase
                        .from('tournament_matches')
                        .update({ status: 'Completed', result: 'Draw', winner_id: null })
                        .eq('id', m.id);
                    m.status = 'Completed';
                    m.result = 'Draw';
                }
            }
        }

        // Ensure all matches in the current round are 'Completed'
        const incompleteMatches = roundMatches.filter(m => m.status !== 'Completed');
        if (incompleteMatches.length > 0) {
            return NextResponse.json({ error: `You must resolve ${incompleteMatches.length} remaining matches before advancing the round.` }, { status: 400 });
        }

        if (format === 'Single_Elimination') {
            await advanceSingleElimination(tournamentUuid, current_round, roundMatches, brackets || []);
        } else if (format === 'Swiss') {
            await advanceSwiss(tournamentUuid, current_round, roundMatches, tournament);
        } else {
            return NextResponse.json({ error: `Format ${format} advancing logic is not fully implemented` }, { status: 501 });
        }

        // Increment round
        const nextRound = current_round + 1;
        const isCompleted = nextRound > total_rounds;

        await supabase
            .from('tournaments')
            .update({
                current_round: nextRound,
                status: isCompleted ? 'Completed' : 'In_Progress'
            })
            .eq('id', tournamentUuid);

        // Logging
        await supabase.from('tournament_logs').insert({
            tournament_id: tournamentUuid,
            action: isCompleted ? 'tournament_completed' : 'round_advanced',
            details: JSON.stringify({ old_round: current_round, new_round: nextRound, format })
        });

        return NextResponse.json({ message: `Advanced to round ${nextRound}` });

    } catch (error) {
        console.error('Error in advance round:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

async function advanceSingleElimination(
    tournamentId: string,
    currentRound: number,
    roundMatches: any[],
    brackets: any[]
) {
    // Push winners of current matches to their slot in the next round
    const nextRoundBrackets = brackets.filter(b => b.round_number === currentRound + 1);
    if (nextRoundBrackets.length === 0) return; // Grand Finals completed

    // Fetch all matches for tournament to find corresponding next matches
    const { data: allMatches } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId);

    for (const match of roundMatches) {
        const bracketPosition = match.bracket.bracket_position;
        const nextBracketPosition = Math.ceil(bracketPosition / 2);

        // Find next bracket
        const nextBracket = nextRoundBrackets.find(b => b.bracket_position === nextBracketPosition);
        if (!nextBracket) continue;

        // Find next match mapping to this bracket
        const nextMatch = allMatches?.find(m => m.bracket_id === nextBracket.id);
        if (!nextMatch) continue;

        // Is it slot 1 (team1_id) or slot 2 (team2_id)? If odd -> team1, even -> team2
        const updateField = (bracketPosition % 2 === 1) ? 'team1_id' : 'team2_id';

        // Determine winner
        const winnerId = match.winner_id;

        if (winnerId) {
            // Push winner directly to slot
            await supabase
                .from('tournament_matches')
                .update({ [updateField]: winnerId })
                .eq('id', nextMatch.id);
        }
    }
}

async function advanceSwiss(tournamentId: string, currentRound: number, roundMatches: any[], tournament: any) {
    // 1. Calculate and update swiss points for everyone in participants table.
    // Every match gives 1 point for a win. Or based on tournament settings.
    const WIN_POINTS = tournament.swiss_points_per_win || 3;
    const DRAW_POINTS = tournament.swiss_points_per_draw || 1;
    const LOSS_POINTS = tournament.swiss_points_per_loss || 0;

    // Get all participants
    const { data: participants } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('is_active', true);

    if (!participants) return;

    // Process each match
    for (const match of roundMatches) {
        let p1 = participants.find(p => p.team_id === match.team1_id);
        let p2 = participants.find(p => p.team_id === match.team2_id);

        if (p1) {
            let pts = (match.result === 'Team1_Win') ? WIN_POINTS : (match.result === 'Draw' ? DRAW_POINTS : LOSS_POINTS);
            p1.swiss_score = (p1.swiss_score || 0) + pts;
            p1.opponents_played = p1.opponents_played || [];
            if (p2) p1.opponents_played.push(p2.team_id);
        }

        if (p2) {
            let pts = (match.result === 'Team2_Win') ? WIN_POINTS : (match.result === 'Draw' ? DRAW_POINTS : LOSS_POINTS);
            p2.swiss_score = (p2.swiss_score || 0) + pts;
            p2.opponents_played = p2.opponents_played || [];
            if (p1) p2.opponents_played.push(p1.team_id);
        }
    }

    // Update participants points in DB
    for (const p of participants) {
        await supabase
            .from('tournament_participants')
            .update({
                swiss_score: p.swiss_score,
                opponents_played: p.opponents_played
            })
            .eq('id', p.id);
    }

    // 2. Compute actual W-L records from ALL completed matches (not just this round)
    const { data: allMatches } = await supabase
        .from('tournament_matches')
        .select('*, bracket:tournament_brackets!inner(round_number)')
        .eq('tournament_id', tournamentId)
        .eq('status', 'Completed');

    const wlRecords: Record<string, { wins: number; losses: number }> = {};
    for (const p of participants) {
        wlRecords[p.team_id] = { wins: 0, losses: 0 };
    }

    for (const m of (allMatches || [])) {
        if (m.result === 'Team1_Win') {
            if (m.team1_id && wlRecords[m.team1_id]) wlRecords[m.team1_id].wins++;
            if (m.team2_id && wlRecords[m.team2_id]) wlRecords[m.team2_id].losses++;
        } else if (m.result === 'Team2_Win') {
            if (m.team2_id && wlRecords[m.team2_id]) wlRecords[m.team2_id].wins++;
            if (m.team1_id && wlRecords[m.team1_id]) wlRecords[m.team1_id].losses++;
        }
    }

    // Swiss format constants
    const maxWins = 3;
    const maxLosses = 3;

    // 3. Mark eliminated teams as inactive, track qualified teams
    const qualifiedTeamIds = new Set<string>();
    const eliminatedTeamIds = new Set<string>();

    for (const p of participants) {
        const rec = wlRecords[p.team_id];
        if (!rec) continue;

        if (rec.wins >= maxWins) {
            qualifiedTeamIds.add(p.team_id);
        }
        if (rec.losses >= maxLosses) {
            eliminatedTeamIds.add(p.team_id);
            // Mark as eliminated in DB
            await supabase
                .from('tournament_participants')
                .update({ is_active: false })
                .eq('id', p.id);
        }
    }

    // Check if next round exists
    if (currentRound + 1 > tournament.total_rounds) return;

    // 4. Only pair teams that are still active (not qualified, not eliminated)
    const activePlayers = participants.filter(p =>
        !qualifiedTeamIds.has(p.team_id) && !eliminatedTeamIds.has(p.team_id)
    );

    // If no active players left, tournament is effectively done
    if (activePlayers.length < 2) return;

    const sorted = [...activePlayers].sort((a, b) => (b.swiss_score || 0) - (a.swiss_score || 0) || (a.seed_number || 0) - (b.seed_number || 0));

    const paired = new Set();
    const newMatches: any[] = [];

    // Generate bracket IDs for the next round
    const { data: newBrackets, error: bErr } = await supabase
        .from('tournament_brackets')
        .insert(
            Array.from({ length: Math.ceil(sorted.length / 2) }).map((_, i) => ({
                tournament_id: tournamentId,
                round_number: currentRound + 1,
                bracket_position: i + 1,
            }))
        )
        .select('*');

    if (bErr || !newBrackets) {
        console.error('Failed to create new brackets for round', currentRound + 1);
        return;
    }

    let matchCount = 1;
    for (let i = 0; i < sorted.length; i++) {
        const p1 = sorted[i];
        if (paired.has(p1.team_id)) continue;
        paired.add(p1.team_id);

        let pairedWith = null;

        // Find available opponent
        for (let j = i + 1; j < sorted.length; j++) {
            const p2 = sorted[j];
            if (paired.has(p2.team_id)) continue;

            const previouslyPaired = p1.opponents_played?.includes(p2.team_id) || false;

            if (!previouslyPaired) {
                pairedWith = p2;
                paired.add(p2.team_id);
                break; // Found pairing!
            }
        }

        // If you failed to find a unique, just pair with the immediate next fallback
        if (!pairedWith) {
            for (let j = i + 1; j < sorted.length; j++) {
                const p2 = sorted[j];
                if (paired.has(p2.team_id)) continue;
                pairedWith = p2;
                paired.add(p2.team_id);
                break;
            }
        }

        const bracketForMatch = newBrackets[matchCount - 1];

        // Determine best_of based on match context
        const nextRound = currentRound + 1;
        const isLastRound = nextRound >= tournament.total_rounds;
        let bestOf: number;

        if (isLastRound) {
            // Final/decider round
            bestOf = tournament.finals_best_of || tournament.elimination_best_of || 5;
        } else {
            // Check if either team is at risk of elimination or progression
            const p1Losses = (p1.opponents_played?.length || 0) - (p1.swiss_score || 0) / (tournament.swiss_points_per_win || 3);
            const maxLosses = 3; // Swiss standard

            if (pairedWith) {
                const p2Losses = (pairedWith.opponents_played?.length || 0) - (pairedWith.swiss_score || 0) / (tournament.swiss_points_per_win || 3);
                // If either team losing means elimination, use elimination_best_of
                if (p1Losses >= maxLosses - 1 || p2Losses >= maxLosses - 1) {
                    bestOf = tournament.elimination_best_of || tournament.progression_best_of || 3;
                } else {
                    bestOf = tournament.progression_best_of || 3;
                }
            } else {
                bestOf = tournament.progression_best_of || 3;
            }
        }

        // Queue match insert
        newMatches.push({
            tournament_id: tournamentId,
            bracket_id: bracketForMatch.id,
            match_number: matchCount++,
            team1_id: p1?.team_id || null,
            team2_id: pairedWith?.team_id || null,
            status: pairedWith ? 'Scheduled' : 'Completed',
            result: !pairedWith ? 'Team1_Win' : null, // Give a bye to unpaired!
            winner_id: !pairedWith ? p1?.team_id : null,
            best_of: bestOf
        });
    }

    if (newMatches.length > 0) {
        await supabase.from('tournament_matches').insert(newMatches);
    }
}
