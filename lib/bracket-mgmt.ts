import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Shared logic to regenerate the current round of a tournament.
 */
export async function regenerateCurrentRoundInternal(tournamentId: string, tournament: any) {
    const format = tournament.format || 'Single_Elimination';
    const currentRound = tournament.current_round;

    if (currentRound < 1) {
        return { error: 'Bracket has not been generated yet', status: 400 };
    }

    // 1. Check if ANY matches in the current round have started/completed.
    const { data: currentMatches } = await supabase
        .from('tournament_matches')
        .select('id, status, bracket_id, bracket:tournament_brackets!inner(round_number)')
        .eq('tournament_id', tournamentId)
        .eq('bracket.round_number', currentRound);

    if (currentMatches && currentMatches.some(m => m.status !== 'Scheduled')) {
        return { error: 'Cannot regenerate round when matches have already started', status: 400 };
    }

    // 2. Wipe the current round from the database
    const bracketIds = currentMatches?.map(m => m.bracket_id) || [];
    if (currentMatches && currentMatches.length > 0) {
        await supabase.from('tournament_matches').delete().in('id', currentMatches.map(m => m.id));
    }
    if (bracketIds.length > 0) {
        await supabase.from('tournament_brackets').delete().in('id', bracketIds);
    }

    // 3. Re-pair based on format
    if (format === 'Single_Elimination') {
        if (currentRound !== 1) {
            return { error: 'Single elimination seeding can only be regenerated for Round 1', status: 400 };
        }

        await resetBracketInternal(tournamentId);

        const { data: participants, error: pError } = await supabase
            .from('tournament_participants')
            .select('*, team:teams(id, name, team_avatar)')
            .eq('tournament_id', tournamentId)
            .eq('is_active', true)
            .order('seed_number', { ascending: true });

        if (pError || !participants) return { error: 'Failed to fetch participants', status: 500 };
        return await generateSingleEliminationBracketInternal(tournamentId, tournament, participants);
    }

    if (format === 'Swiss') {
        const { data: participants, error: pError } = await supabase
            .from('tournament_participants')
            .select('*')
            .eq('tournament_id', tournamentId)
            .eq('is_active', true);

        if (pError || !participants) return { error: 'Failed to fetch participants', status: 500 };

        if (currentRound === 1) {
            const sorted = participants.sort((a, b) => a.seed_number - b.seed_number);
            return await generateSwissRoundInternal(tournamentId, tournament, sorted, 1);
        } else {
            return await pairSwissRoundInternal(tournamentId, tournament, participants, currentRound);
        }
    }

    return { error: 'Unsupported format configuration for regeneration', status: 400 };
}

export async function resetBracketInternal(tournamentId: string) {
    await supabase.from('tournament_matches').delete().eq('tournament_id', tournamentId);
    await supabase.from('tournament_brackets').delete().eq('tournament_id', tournamentId);
    await supabase.from('tournament_participants').update({ swiss_score: 0, opponents_played: [] }).eq('tournament_id', tournamentId);
    return await supabase.from('tournaments').update({ status: 'Seeding', current_round: 0 }).eq('id', tournamentId);
}

async function generateSingleEliminationBracketInternal(tournamentId: string, tournament: any, participants: any[]) {
    const teamCount = participants.length;
    const totalRounds = Math.ceil(Math.log2(teamCount));
    const bracketSize = Math.pow(2, totalRounds);
    const seedOrder = generateBracketSeedOrder(bracketSize);

    const brackets: any[] = [];
    for (let round = 1; round <= totalRounds; round++) {
        const matchesInRound = bracketSize / Math.pow(2, round);
        for (let position = 1; position <= matchesInRound; position++) {
            brackets.push({
                tournament_id: tournamentId,
                round_number: round,
                bracket_position: position,
                is_final: round === totalRounds,
                is_third_place: false
            });
        }
    }

    const { data: insertedBrackets, error: bracketError } = await supabase.from('tournament_brackets').insert(brackets).select();
    if (bracketError) return { error: 'Failed to create brackets', status: 500 };

    const matches: any[] = [];
    let matchNumber = 1;
    const firstRoundBrackets = insertedBrackets.filter(b => b.round_number === 1);

    for (let i = 0; i < firstRoundBrackets.length; i++) {
        const bracket = firstRoundBrackets[i];
        const team1 = participants[seedOrder[i * 2]] || null;
        const team2 = participants[seedOrder[i * 2 + 1]] || null;

        const match: any = {
            bracket_id: bracket.id,
            tournament_id: tournamentId,
            match_number: matchNumber++,
            team1_id: team1?.team_id || null,
            team2_id: team2?.team_id || null,
            status: 'Scheduled',
            best_of: tournament.opening_best_of || 1
        };

        if (team1 && !team2) { match.winner_id = team1.team_id; match.status = 'Completed'; match.result = 'Team1_Win'; }
        else if (team2 && !team1) { match.winner_id = team2.team_id; match.status = 'Completed'; match.result = 'Team2_Win'; }
        matches.push(match);
    }

    for (let round = 2; round <= totalRounds; round++) {
        const roundBrackets = insertedBrackets.filter(b => b.round_number === round);
        for (const bracket of roundBrackets) {
            matches.push({
                bracket_id: bracket.id,
                tournament_id: tournamentId,
                match_number: matchNumber++,
                team1_id: null,
                team2_id: null,
                status: 'Scheduled',
                best_of: round === totalRounds ? (tournament.finals_best_of || 3) : (tournament.elimination_best_of || 3)
            });
        }
    }

    const { data: insertedMatches, error: matchError } = await supabase.from('tournament_matches').insert(matches).select();
    if (matchError) return { error: 'Failed to create matches', status: 500 };

    await supabase.from('tournaments').update({ status: 'In_Progress', total_rounds: totalRounds, current_round: 1 }).eq('id', tournamentId);
    await advanceByeWinnersInternal(tournamentId, insertedBrackets, insertedMatches);

    return { success: true, brackets: insertedBrackets, matches: insertedMatches };
}

async function generateSwissRoundInternal(tournamentId: string, tournament: any, participants: any[], roundNumber: number) {
    const totalRounds = tournament.swiss_rounds || 5;
    const newBrackets: any[] = [];
    for (let i = 0; i < participants.length; i += 2) {
        newBrackets.push({ tournament_id: tournamentId, round_number: roundNumber, bracket_position: Math.floor(i / 2) + 1 });
    }

    const { data: insertedBrackets, error: bracketError } = await supabase.from('tournament_brackets').insert(newBrackets).select('*');
    if (bracketError || !insertedBrackets) return { error: 'Failed to create brackets', status: 500 };

    const matches: any[] = [];
    for (let i = 0; i < participants.length; i += 2) {
        const p1 = participants[i];
        const p2 = participants[i + 1] || null;
        const bracket = insertedBrackets[Math.floor(i / 2)];

        matches.push({
            bracket_id: bracket.id,
            tournament_id: tournamentId,
            match_number: Math.floor(i / 2) + 1,
            team1_id: p1?.team_id || null,
            team2_id: p2?.team_id || null,
            status: p2 ? 'Scheduled' : 'Completed',
            result: !p2 ? 'Team1_Win' : null,
            winner_id: !p2 ? p1?.team_id : null,
            best_of: tournament.opening_best_of || 1
        });
    }

    const { data: insertedMatches, error: matchError } = await supabase.from('tournament_matches').insert(matches).select('*');
    if (matchError) return { error: 'Failed to create matches', status: 500 };

    await supabase.from('tournaments').update({ status: 'In_Progress', current_round: 1, total_rounds: totalRounds }).eq('id', tournamentId);
    return { success: true, brackets: insertedBrackets, matches: insertedMatches };
}

async function pairSwissRoundInternal(tournamentId: string, tournament: any, participants: any[], currentRound: number) {
    const sorted = [...participants].sort((a, b) => (b.swiss_score || 0) - (a.swiss_score || 0) || (a.seed_number || 0) - (b.seed_number || 0));
    const paired = new Set();
    const newMatches: any[] = [];

    const { data: newBrackets, error: bErr } = await supabase.from('tournament_brackets').insert(
        Array.from({ length: Math.ceil(sorted.length / 2) }).map((_, i) => ({
            tournament_id: tournamentId, round_number: currentRound, bracket_position: i + 1,
        }))
    ).select('*');

    if (bErr || !newBrackets) return { error: 'Failed to create brackets', status: 500 };

    let matchCount = 1;
    for (let i = 0; i < sorted.length; i++) {
        const p1 = sorted[i];
        if (paired.has(p1.team_id)) continue;
        paired.add(p1.team_id);

        let pairedWith = null;
        for (let j = i + 1; j < sorted.length; j++) {
            const p2 = sorted[j];
            if (paired.has(p2.team_id)) continue;
            if (!(p1.opponents_played?.includes(p2.team_id))) {
                pairedWith = p2; paired.add(p2.team_id); break;
            }
        }

        if (!pairedWith) {
            for (let j = i + 1; j < sorted.length; j++) {
                const p2 = sorted[j];
                if (paired.has(p2.team_id)) { continue; }
                pairedWith = p2; paired.add(p2.team_id); break;
            }
        }

        const bestOf = currentRound >= tournament.total_rounds ? (tournament.finals_best_of || 3) : (tournament.progression_best_of || 3);
        newMatches.push({
            tournament_id: tournamentId, bracket_id: newBrackets[matchCount - 1].id, match_number: matchCount++,
            team1_id: p1?.team_id || null, team2_id: pairedWith?.team_id || null,
            status: pairedWith ? 'Scheduled' : 'Completed', result: !pairedWith ? 'Team1_Win' : null,
            winner_id: !pairedWith ? p1?.team_id : null, best_of: bestOf
        });
    }
    await supabase.from('tournament_matches').insert(newMatches);
    return { success: true, message: `Round ${currentRound} regenerated` };
}


export async function swapSeedsInternal(tournamentId: string, team1Id: string, team2Id: string) {
    const { data: participants, error } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId).in('team_id', [team1Id, team2Id]);
    if (error || !participants || participants.length !== 2) return { error: 'Teams not found', status: 404 };
    const [p1, p2] = participants;
    await supabase.from('tournament_participants').update({ seed_number: p2.seed_number, initial_bracket_position: p2.seed_number }).eq('id', p1.id);
    await supabase.from('tournament_participants').update({ seed_number: p1.seed_number, initial_bracket_position: p1.seed_number }).eq('id', p2.id);
    return { success: true };
}

export async function setSeedInternal(tournamentId: string, teamId: string, newSeedNumber: number) {
    const { data: p } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId).eq('team_id', teamId).single();
    if (!p) return { error: 'Team not found', status: 404 };
    const { data: target } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId).eq('seed_number', newSeedNumber).single();
    if (target) await supabase.from('tournament_participants').update({ seed_number: p.seed_number, initial_bracket_position: p.seed_number }).eq('id', target.id);
    await supabase.from('tournament_participants').update({ seed_number: newSeedNumber, initial_bracket_position: newSeedNumber }).eq('id', p.id);
    return { success: true };
}

export async function randomizeSeedsInternal(tournamentId: string) {
    const { data: participants } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId);
    if (!participants) return { error: 'No participants', status: 404 };
    const shuffled = participants.sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
        await supabase.from('tournament_participants').update({ seed_number: i + 1, initial_bracket_position: i + 1 }).eq('id', shuffled[i].id);
    }
    return { success: true };
}

function generateBracketSeedOrder(bracketSize: number): number[] {
    if (bracketSize === 2) return [0, 1];
    const order: number[] = [];
    const subOrder = generateBracketSeedOrder(bracketSize / 2);
    for (const seed of subOrder) { order.push(seed); order.push(bracketSize - 1 - seed); }
    return order;
}

async function advanceByeWinnersInternal(tournamentId: string, brackets: any[], matches: any[]) {
    const byeMatches = matches.filter(m => m.status === 'Completed' && brackets.find(b => b.id === m.bracket_id)?.round_number === 1);
    for (const byeMatch of byeMatches) {
        const bracket = brackets.find(b => b.id === byeMatch.bracket_id);
        if (!bracket || !byeMatch.winner_id) continue;
        const nextBracket = brackets.find(b => b.round_number === 2 && b.bracket_position === Math.ceil(bracket.bracket_position / 2));
        if (!nextBracket) continue;
        const nextMatch = matches.find(m => m.bracket_id === nextBracket.id);
        if (!nextMatch) continue;
        const updateField = bracket.bracket_position % 2 === 1 ? 'team1_id' : 'team2_id';
        await supabase.from('tournament_matches').update({ [updateField]: byeMatch.winner_id }).eq('id', nextMatch.id);
    }
}
