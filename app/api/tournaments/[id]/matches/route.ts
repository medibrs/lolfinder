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

// GET /api/tournaments/[id]/matches
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const tournamentUuid = await resolveTournamentId(id);

        if (!tournamentUuid) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        // Get all matches with bracket info and team info
        const { data: matches, error } = await supabase
            .from('tournament_matches')
            .select(`
                *,
                team1:teams!tournament_matches_team1_id_fkey(id, name, team_avatar),
                team2:teams!tournament_matches_team2_id_fkey(id, name, team_avatar),
                winner:teams!tournament_matches_winner_id_fkey(id, name)
            `)
            .eq('tournament_id', tournamentUuid)
            .order('match_number', { ascending: true });

        if (error) {
            console.error('Error fetching matches:', error);
            return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
        }

        // Now fetch bracket info separately for each match
        const matchIds = (matches || []).map(m => m.bracket_id).filter(Boolean);

        let bracketsMap: Record<string, any> = {};
        if (matchIds.length > 0) {
            const { data: brackets } = await supabase
                .from('tournament_brackets')
                .select('id, round_number, is_final, bracket_position')
                .in('id', matchIds);

            if (brackets) {
                for (const b of brackets) {
                    bracketsMap[b.id] = b;
                }
            }
        }

        // Attach bracket info to each match
        const enrichedMatches = (matches || []).map(m => ({
            ...m,
            bracket: bracketsMap[m.bracket_id] || null
        }));

        return NextResponse.json({ matches: enrichedMatches });
    } catch (error) {
        console.error('Error in GET matches:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT /api/tournaments/[id]/matches
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const tournamentUuid = await resolveTournamentId(id);

        if (!tournamentUuid) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        const body = await request.json();
        const { match_id, team1_id, team2_id, team1_score, team2_score, winner_id, status, result: bodyResult } = body;

        // Validate
        if (!match_id) {
            return NextResponse.json({ error: 'match_id is required' }, { status: 400 });
        }

        // Build update object - only include fields that are explicitly provided
        const updateData: Record<string, any> = {};

        if (team1_id !== undefined) updateData.team1_id = team1_id;
        if (team2_id !== undefined) updateData.team2_id = team2_id;
        if (team1_score !== undefined) updateData.team1_score = team1_score;
        if (team2_score !== undefined) updateData.team2_score = team2_score;
        if (status !== undefined) updateData.status = status;

        // Handle winner_id (can be explicitly set to null for re-open)
        if ('winner_id' in body) updateData.winner_id = winner_id;

        // Determine result
        if (bodyResult !== undefined) {
            // Explicit result passed (e.g. 'Draw')
            updateData.result = bodyResult;
        } else if (status === 'Completed' && winner_id) {
            // Auto-determine result from winner
            const { data: existingMatch } = await supabase
                .from('tournament_matches')
                .select('team1_id, team2_id')
                .eq('id', match_id)
                .single();

            if (existingMatch) {
                if (winner_id === existingMatch.team1_id) updateData.result = 'Team1_Win';
                else if (winner_id === existingMatch.team2_id) updateData.result = 'Team2_Win';
            }
        } else if (status === 'In_Progress') {
            // Re-opening match, clear result
            updateData.result = null;
        }

        const { data: updatedMatch, error } = await supabase
            .from('tournament_matches')
            .update(updateData)
            .eq('id', match_id)
            .eq('tournament_id', tournamentUuid)
            .select()
            .single();

        if (error) {
            console.error('Error updating match:', error);
            return NextResponse.json({ error: 'Failed to update match' }, { status: 500 });
        }

        // Log the action
        await supabase.from('tournament_logs').insert({
            tournament_id: tournamentUuid,
            action: 'match_updated',
            match_id: match_id,
            details: JSON.stringify({
                status: updateData.status,
                winner_id: updateData.winner_id,
                result: updateData.result,
                team1_score: updateData.team1_score,
                team2_score: updateData.team2_score,
            })
        });

        return NextResponse.json({ message: 'Match updated successfully', match: updatedMatch });
    } catch (error) {
        console.error('Error updating match:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
