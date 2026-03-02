import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    computeWLRecords,
    computeEliminationResults,
    buildOpponentHistory,
    generateSwissProposal,
    determineBestOf,
    SwissMatchInput,
    SwissTeamInput,
    SwissConfig,
} from '@/lib/tournament/swiss-core'
import { transitionTournament } from '@/lib/tournament/lifecycle/lifecycle-service'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper: resolve tournament ID (supports both UUID and tournament_number)
async function resolveTournament(id: string) {
    const isNumber = /^\d+$/.test(id)
    let q = supabase.from('tournaments').select('*')
    if (isNumber) q = q.eq('tournament_number', parseInt(id))
    else q = q.eq('id', id)
    const { data, error } = await q.single()
    if (error || !data) return null
    return data
}

// POST /api/tournaments/[id]/swiss-approve
// Generates Round N matches from the LIVE seeding state and W/L records.
// Does NOT rely on pre-computed drafts — always uses current DB state.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json().catch(() => ({}))

        const tournament = await resolveTournament(id)
        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
        }

        const tournamentId = tournament.id
        const targetRound = body.round_number ?? tournament.current_round

        // 1. Check for existing matches in this round
        const { data: existingBrackets } = await supabase
            .from('tournament_brackets')
            .select('id')
            .eq('tournament_id', tournamentId)
            .eq('round_number', targetRound)

        if (existingBrackets && existingBrackets.length > 0) {
            // Check if any matches in this round are already completed
            const bracketIds = existingBrackets.map(b => b.id)
            const { data: completedInRound } = await supabase
                .from('tournament_matches')
                .select('id')
                .in('bracket_id', bracketIds)
                .eq('status', 'Completed')

            if (completedInRound && completedInRound.length > 0) {
                return NextResponse.json(
                    { error: `Round ${targetRound} has completed matches. Cannot regenerate.` },
                    { status: 400 }
                )
            }

            // Delete stale matches and brackets for this round
            console.log(`[swiss-approve] Deleting stale R${targetRound} data: ${existingBrackets.length} brackets`)
            await supabase
                .from('tournament_matches')
                .delete()
                .in('bracket_id', bracketIds)
            await supabase
                .from('tournament_brackets')
                .delete()
                .in('id', bracketIds)
        }

        // 2. Load participants (live seeding state)
        const { data: rawParticipants } = await supabase
            .from('tournament_participants')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('seed_number', { ascending: true })

        if (!rawParticipants || rawParticipants.length === 0) {
            return NextResponse.json({ error: 'No participants found' }, { status: 400 })
        }

        // 3. Load all matches (separate query, then join brackets manually)
        //    The `!inner` join fails silently due to multiple FK relationships.
        const { data: rawMatches, error: matchErr } = await supabase
            .from('tournament_matches')
            .select('id, team1_id, team2_id, winner_id, result, status, bracket_id')
            .eq('tournament_id', tournamentId)

        if (matchErr) {
            console.error('[swiss-approve] Match query error:', matchErr.message)
        }

        // Load brackets separately to get round_number
        const bracketIds = (rawMatches || []).map((m: any) => m.bracket_id).filter(Boolean)
        let bracketsMap: Record<string, number> = {}
        if (bracketIds.length > 0) {
            const { data: brackets } = await supabase
                .from('tournament_brackets')
                .select('id, round_number')
                .in('id', bracketIds)

            if (brackets) {
                for (const b of brackets) {
                    bracketsMap[b.id] = b.round_number
                }
            }
        }

        const allMatches: SwissMatchInput[] = (rawMatches || []).map((m: any) => ({
            id: m.id,
            team1_id: m.team1_id,
            team2_id: m.team2_id,
            winner_id: m.winner_id,
            result: m.result,
            status: m.status,
            round_number: bracketsMap[m.bracket_id] || 0,
        }))

        // 4. Compute W/L records from actual match results
        const completedMatches = allMatches.filter(m => m.status === 'Completed')
        const teamIds = rawParticipants.map((p: any) => p.team_id)
        const wlRecords = computeWLRecords(teamIds, completedMatches)

        // DEBUG: Log match data to trace the issue
        console.log('[swiss-approve] === DEBUG START ===')
        console.log(`[swiss-approve] Tournament: ${tournamentId}, Target Round: ${targetRound}`)
        console.log(`[swiss-approve] Total matches loaded: ${allMatches.length}`)
        console.log(`[swiss-approve] Completed matches: ${completedMatches.length}`)
        for (const m of allMatches) {
            console.log(`[swiss-approve]   Match R${m.round_number}: ${m.team1_id?.slice(0, 8)} vs ${m.team2_id?.slice(0, 8)} | status=${m.status} result=${m.result} winner=${m.winner_id?.slice(0, 8)}`)
        }
        console.log(`[swiss-approve] W/L Records:`)
        for (const [tid, rec] of Object.entries(wlRecords)) {
            console.log(`[swiss-approve]   ${tid.slice(0, 8)}: W${rec.wins} L${rec.losses} D${rec.draws}`)
        }

        // 5. Build Swiss config
        const config: SwissConfig = {
            points_per_win: tournament.swiss_points_per_win || 3,
            points_per_draw: tournament.swiss_points_per_draw || 1,
            points_per_loss: tournament.swiss_points_per_loss || 0,
            max_wins: 3,
            max_losses: 3,
            total_rounds: tournament.swiss_rounds || tournament.total_rounds || 5,
            current_round: targetRound,
            opening_best_of: tournament.opening_best_of || 1,
            progression_best_of: tournament.progression_best_of || 3,
            elimination_best_of: tournament.elimination_best_of || 3,
        }

        // 6. Build participants with swiss_score COMPUTED from actual match results
        //    Never trust p.swiss_score from DB — it may be stale or 0.
        const swissParticipants: SwissTeamInput[] = rawParticipants.map((p: any) => {
            const wl = wlRecords[p.team_id] || { wins: 0, losses: 0, draws: 0 }
            const computedScore =
                wl.wins * config.points_per_win +
                (wl.draws || 0) * config.points_per_draw +
                wl.losses * config.points_per_loss

            return {
                team_id: p.team_id,
                seed_number: p.seed_number || 0,
                swiss_score: computedScore,
                tiebreaker_points: p.tiebreaker_points || 0,
                buchholz_score: p.buchholz_score || 0,
                is_active: p.is_active !== false,
            }
        })

        // DEBUG: Log computed scores
        console.log(`[swiss-approve] Computed swiss_scores:`)
        for (const p of swissParticipants) {
            console.log(`[swiss-approve]   ${p.team_id.slice(0, 8)}: score=${p.swiss_score} seed=${p.seed_number} active=${p.is_active}`)
        }

        // 7. Compute elimination results
        const eliminationResults = computeEliminationResults(wlRecords, config)

        // 8. Build opponent history
        const opponentHistory = buildOpponentHistory(completedMatches)

        // DEBUG: Log opponent history
        console.log(`[swiss-approve] Opponent history:`)
        for (const [tid, opponents] of opponentHistory) {
            console.log(`[swiss-approve]   ${tid.slice(0, 8)}: played ${[...opponents].map(o => o.slice(0, 8)).join(', ')}`)
        }

        // 9. Generate pairings from LIVE state
        const proposal = generateSwissProposal(
            swissParticipants,
            eliminationResults,
            opponentHistory,
            targetRound,
            config
        )

        // DEBUG: Log generated pairings
        console.log(`[swiss-approve] Generated pairings:`)
        for (const pair of proposal.pairings) {
            const t1wl = wlRecords[pair.team1_id]
            const t2wl = wlRecords[pair.team2_id || '']
            console.log(`[swiss-approve]   ${pair.team1_id.slice(0, 8)}(${t1wl?.wins || 0}:${t1wl?.losses || 0}) vs ${pair.team2_id?.slice(0, 8)}(${t2wl?.wins || 0}:${t2wl?.losses || 0}) bye=${pair.is_bye}`)
        }
        console.log('[swiss-approve] === DEBUG END ===')

        // 10. Create brackets
        const bracketsToInsert = proposal.pairings.map((_, i) => ({
            tournament_id: tournamentId,
            round_number: targetRound,
            bracket_position: i + 1,
        }))

        const { data: insertedBrackets, error: bracketError } = await supabase
            .from('tournament_brackets')
            .insert(bracketsToInsert)
            .select('*')

        if (bracketError || !insertedBrackets) {
            throw new Error(`Failed to create brackets: ${bracketError?.message}`)
        }

        // 11. Create matches with correct best_of per match
        const matchesToInsert = proposal.pairings.map((p, i) => {
            const isBye = p.is_bye || !p.team2_id
            const t1Losses = wlRecords[p.team1_id]?.losses || 0
            const t2Losses = wlRecords[p.team2_id || '']?.losses || 0
            const t1Wins = wlRecords[p.team1_id]?.wins || 0
            const t2Wins = wlRecords[p.team2_id || '']?.wins || 0
            const bestOf = determineBestOf(targetRound, config, t1Losses, t2Losses, t1Wins, t2Wins)

            return {
                bracket_id: insertedBrackets[i].id,
                tournament_id: tournamentId,
                match_number: i + 1,
                team1_id: p.team1_id,
                team2_id: isBye ? null : p.team2_id,
                status: isBye ? 'Completed' : 'Scheduled',
                result: isBye ? 'Team1_Win' : null,
                winner_id: isBye ? p.team1_id : null,
                best_of: bestOf,
            }
        })

        const { data: insertedMatches, error: matchError } = await supabase
            .from('tournament_matches')
            .insert(matchesToInsert)
            .select('id')

        if (matchError) {
            throw new Error(`Failed to create matches: ${matchError.message}`)
        }

        // 12. Ensure tournament state is correct
        await transitionTournament(tournamentId, 'In_Progress')

        // 13. Log
        await supabase.from('tournament_logs').insert({
            tournament_id: tournamentId,
            action: 'SWISS_MATCHES_GENERATED',
            details: JSON.stringify({
                round: targetRound,
                matches_created: matchesToInsert.length,
                byes: proposal.metadata.byes,
                rematches_forced: proposal.metadata.rematches_forced,
            }),
            event_category: 'swiss',
            impact_level: 'high',
            round_number: targetRound,
        })

        return NextResponse.json({
            message: `Round ${targetRound} matches generated. ${matchesToInsert.length} matches created from live seeding.`,
            match_count: matchesToInsert.length,
            match_ids: (insertedMatches || []).map((m: any) => m.id),
        })
    } catch (error: any) {
        console.error('Error generating Swiss matches:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to generate matches' },
            { status: 500 }
        )
    }
}

// GET /api/tournaments/[id]/swiss-approve
// Returns whether the current round needs matches generated
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const tournament = await resolveTournament(id)
        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
        }

        if (tournament.format !== 'Swiss') {
            return NextResponse.json({ needs_generation: false, round_number: 0 })
        }

        const currentRound = tournament.current_round || 0

        // Check if matches exist for the current round
        const { data: brackets } = await supabase
            .from('tournament_brackets')
            .select('id')
            .eq('tournament_id', tournament.id)
            .eq('round_number', currentRound)

        const hasMatches = brackets && brackets.length > 0

        // If matches exist, check if any are completed (can't regenerate if so)
        let canRegenerate = false
        if (hasMatches) {
            const bracketIds = brackets!.map(b => b.id)
            const { data: completedMatches } = await supabase
                .from('tournament_matches')
                .select('id')
                .in('bracket_id', bracketIds)
                .eq('status', 'Completed')
            canRegenerate = !completedMatches || completedMatches.length === 0
        }

        return NextResponse.json({
            needs_generation: !hasMatches && currentRound > 0,
            can_regenerate: canRegenerate,
            round_number: currentRound,
        })
    } catch (error: any) {
        console.error('Error checking Swiss state:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
