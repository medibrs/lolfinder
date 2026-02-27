/**
 * swiss-service.ts — Persistence & Orchestration Layer
 *
 * This is the ONLY file that talks to the database for Swiss operations.
 * It calls swiss-core for computation, then persists results.
 *
 * Responsibilities:
 *   ✅ Read DB state
 *   ✅ Call swiss-core pure functions
 *   ✅ Write results to DB
 *   ✅ Create audit entries
 *   ✅ Manage pairing lifecycle (draft → approved → locked)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
    SwissTeamInput,
    SwissMatchInput,
    SwissConfig,
    SwissProposal,
    ProposedPairing,
    RoundAdvanceResult,
    computeRoundAdvance,
    generateSwissProposal,
    generateRound1Proposal,
    computeWLRecords,
    computeEliminationResults,
    buildOpponentHistory,
    determineBestOf,
    detectGhostMatches,
    validatePairings,
} from './swiss-core'
import { transitionTournament } from './lifecycle/lifecycle-service'

// ─── DB Client ──────────────────────────────────────────────────────

function getServiceClient(): SupabaseClient {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ─── Data Loaders ───────────────────────────────────────────────────

export async function loadSwissContext(tournamentId: string) {
    const supabase = getServiceClient()

    const [tournamentRes, participantsRes, matchesRes, bracketsRes] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
        supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId),
        supabase.from('tournament_matches')
            .select('*, bracket:tournament_brackets!inner(round_number)')
            .eq('tournament_id', tournamentId),
        supabase.from('tournament_brackets').select('*').eq('tournament_id', tournamentId),
    ])

    if (tournamentRes.error || !tournamentRes.data) {
        throw new Error('Tournament not found')
    }

    const tournament = tournamentRes.data
    const participants = participantsRes.data || []
    const rawMatches = matchesRes.data || []
    const brackets = bracketsRes.data || []

    const config: SwissConfig = {
        points_per_win: tournament.swiss_points_per_win || 3,
        points_per_draw: tournament.swiss_points_per_draw || 1,
        points_per_loss: tournament.swiss_points_per_loss || 0,
        max_wins: 3,
        max_losses: 3,
        total_rounds: tournament.swiss_rounds || tournament.total_rounds || 5,
        current_round: tournament.current_round || 0,
        opening_best_of: tournament.opening_best_of || 1,
        progression_best_of: tournament.progression_best_of || 3,
        elimination_best_of: tournament.elimination_best_of || 3,
        finals_best_of: tournament.finals_best_of || 5,
    }

    const swissParticipants: SwissTeamInput[] = participants.map((p: any) => ({
        team_id: p.team_id,
        seed_number: p.seed_number || 0,
        swiss_score: p.swiss_score || 0,
        tiebreaker_points: p.tiebreaker_points || 0,
        buchholz_score: p.buchholz_score || 0,
        is_active: p.is_active !== false,
    }))

    const swissMatches: SwissMatchInput[] = rawMatches.map((m: any) => ({
        id: m.id,
        team1_id: m.team1_id,
        team2_id: m.team2_id,
        winner_id: m.winner_id,
        result: m.result,
        status: m.status,
        round_number: m.bracket?.round_number || 0,
    }))

    return { tournament, config, participants: swissParticipants, matches: swissMatches, brackets, rawParticipants: participants }
}

// ─── Draft Creation ─────────────────────────────────────────────────

/**
 * Generate a draft pairing proposal and persist it to swiss_pairings.
 * Does NOT create tournament_matches — that happens on approval.
 */
export async function createSwissDraft(
    tournamentId: string,
    userId?: string
): Promise<{ proposal: SwissProposal; pairingIds: string[] }> {
    const supabase = getServiceClient()
    const { config, participants, matches } = await loadSwissContext(tournamentId)

    const nextRound = config.current_round + 1

    // Generate proposal using pure core logic
    let proposal: SwissProposal

    if (nextRound === 1) {
        proposal = generateRound1Proposal(participants, config)
    } else {
        const team_ids = participants.map(p => p.team_id)
        const wl_records = computeWLRecords(team_ids, matches)
        const elimination_results = computeEliminationResults(wl_records, config)
        const opponent_history = buildOpponentHistory(matches)

        proposal = generateSwissProposal(
            participants,
            elimination_results,
            opponent_history,
            nextRound,
            config
        )
    }

    // Validate
    const activeTeamIds = participants.filter(p => p.is_active).map(p => p.team_id)
    const validation = validatePairings(proposal.pairings, activeTeamIds)
    if (!validation.valid) {
        throw new Error(`Invalid pairings: ${validation.errors.join(', ')}`)
    }

    // Persist as draft
    const pairingsToInsert = proposal.pairings.map(p => ({
        tournament_id: tournamentId,
        round_number: proposal.round,
        team1_id: p.team1_id,
        team2_id: p.team2_id || p.team1_id, // Self-reference for bye (DB requires non-null)
        pairing_status: 'draft',
        is_locked: false,
        generation_source: proposal.metadata.generation_source,
        version: 1,
        modified_by: userId || null,
        override_reason: null,
        cannot_pair_again: true,
    }))

    const { data: insertedPairings, error } = await supabase
        .from('swiss_pairings')
        .insert(pairingsToInsert)
        .select('id')

    if (error) throw new Error(`Failed to save draft pairings: ${error.message}`)

    // Log it
    await supabase.from('tournament_logs').insert({
        tournament_id: tournamentId,
        action: 'SWISS_DRAFT_CREATED',
        details: JSON.stringify({
            round: proposal.round,
            pairings: proposal.pairings.length,
            rematches_forced: proposal.metadata.rematches_forced,
        }),
        user_id: userId || null,
        event_category: 'swiss',
        impact_level: 'medium',
        round_number: proposal.round,
    })

    return {
        proposal,
        pairingIds: (insertedPairings || []).map((p: any) => p.id),
    }
}

// ─── Approval ───────────────────────────────────────────────────────

/**
 * Approve draft pairings → create actual tournament_matches from them.
 * Sets pairing status to 'approved' and is_locked = true.
 */
export async function approveSwissPairings(
    tournamentId: string,
    roundNumber: number,
    userId?: string
): Promise<{ matchIds: string[] }> {
    const supabase = getServiceClient()
    const { tournament, config } = await loadSwissContext(tournamentId)

    // 1. Fetch draft pairings for this round
    const { data: pairings, error: fetchError } = await supabase
        .from('swiss_pairings')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('round_number', roundNumber)
        .in('pairing_status', ['draft', 'modified'])

    if (fetchError || !pairings || pairings.length === 0) {
        throw new Error('No draft pairings found for this round')
    }

    // 2. Lock pairings
    const pairingIds = pairings.map((p: any) => p.id)
    await supabase
        .from('swiss_pairings')
        .update({ pairing_status: 'locked', is_locked: true })
        .in('id', pairingIds)

    // 3. Create brackets for matches
    const bracketsToInsert = pairings.map((_: any, i: number) => ({
        tournament_id: tournamentId,
        round_number: roundNumber,
        bracket_position: i + 1,
    }))

    const { data: insertedBrackets, error: bracketError } = await supabase
        .from('tournament_brackets')
        .insert(bracketsToInsert)
        .select('*')

    if (bracketError || !insertedBrackets) {
        throw new Error(`Failed to create brackets: ${bracketError?.message}`)
    }

    // 4. Build W/L records to determine best_of per match
    const allTeamIds = pairings.flatMap((p: any) => [p.team1_id, p.team2_id].filter(Boolean))
    const { data: allMatchesRaw } = await supabase
        .from('tournament_matches')
        .select('*, bracket:tournament_brackets!inner(round_number)')
        .eq('tournament_id', tournamentId)
        .eq('status', 'Completed')

    const allMatches: SwissMatchInput[] = (allMatchesRaw || []).map((m: any) => ({
        id: m.id, team1_id: m.team1_id, team2_id: m.team2_id,
        winner_id: m.winner_id, result: m.result, status: m.status,
        round_number: m.bracket?.round_number || 0,
    }))
    const wlRecords = computeWLRecords(allTeamIds, allMatches)

    // 5. Create matches linked to bracket + source_pairing
    const matchesToInsert = pairings.map((p: any, i: number) => {
        const isBye = p.team1_id === p.team2_id || !p.team2_id
        const t1Losses = wlRecords[p.team1_id]?.losses || 0
        const t2Losses = wlRecords[p.team2_id]?.losses || 0
        const bestOf = determineBestOf(roundNumber, config, t1Losses, t2Losses)

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
            source_pairing_id: p.id,
        }
    })

    const { data: insertedMatches, error: matchError } = await supabase
        .from('tournament_matches')
        .insert(matchesToInsert)
        .select('id')

    if (matchError) throw new Error(`Failed to create matches: ${matchError.message}`)

    // 6. Update tournament state
    await supabase
        .from('tournaments')
        .update({
            current_round: roundNumber,
            total_rounds: Math.max(tournament.total_rounds || 0, config.total_rounds),
        })
        .eq('id', tournamentId)
    await transitionTournament(tournamentId, 'In_Progress')

    // 7. Log
    await supabase.from('tournament_logs').insert({
        tournament_id: tournamentId,
        action: 'SWISS_PAIRINGS_APPROVED',
        details: JSON.stringify({
            round: roundNumber,
            matches_created: matchesToInsert.length,
            approved_by: userId,
        }),
        user_id: userId || null,
        event_category: 'swiss',
        impact_level: 'high',
        round_number: roundNumber,
    })

    return { matchIds: (insertedMatches || []).map((m: any) => m.id) }
}

// ─── Manual Override ────────────────────────────────────────────────

/**
 * Admin modifies a single pairing. Creates an audit trail entry.
 */
export async function modifySwissPairing(
    pairingId: string,
    changes: { team1_id?: string; team2_id?: string },
    userId: string,
    reason: string
): Promise<void> {
    const supabase = getServiceClient()

    // 1. Load existing pairing
    const { data: existing, error } = await supabase
        .from('swiss_pairings')
        .select('*')
        .eq('id', pairingId)
        .single()

    if (error || !existing) throw new Error('Pairing not found')
    if (existing.is_locked) throw new Error('Cannot modify a locked pairing')

    const oldState = { team1_id: existing.team1_id, team2_id: existing.team2_id }
    const newState = {
        team1_id: changes.team1_id || existing.team1_id,
        team2_id: changes.team2_id || existing.team2_id,
    }

    // 2. Update pairing
    await supabase
        .from('swiss_pairings')
        .update({
            ...newState,
            pairing_status: 'modified',
            generation_source: 'manual',
            modified_by: userId,
            override_reason: reason,
            version: existing.version + 1,
        })
        .eq('id', pairingId)

    // 3. Create audit entry
    await supabase.from('swiss_pairing_audit').insert({
        pairing_id: pairingId,
        changed_by: userId,
        old_state: oldState,
        new_state: newState,
        reason,
    })
}

// ─── Round Advance ──────────────────────────────────────────────────

/**
 * Process a completed round and generate the next round's draft.
 * This replaces the monolithic advanceSwiss() function.
 *
 * Flow:
 *   1. Compute score updates for completed round
 *   2. Persist score updates to tournament_participants
 *   3. Detect and resolve ghost matches
 *   4. Determine eliminations
 *   5. Mark eliminated teams
 *   6. Record opponent history
 *   7. Generate next round draft (if tournament continues)
 *   8. Return structured result
 */
export async function advanceSwissRound(
    tournamentId: string,
    userId?: string
): Promise<RoundAdvanceResult> {
    const supabase = getServiceClient()
    const { config, participants, matches, rawParticipants } = await loadSwissContext(tournamentId)

    const currentRound = config.current_round

    // Get current round matches
    const currentRoundMatches = matches.filter(m => m.round_number === currentRound)

    // Resolve ghost matches first
    const team_ids = participants.map(p => p.team_id)
    const wl_before = computeWLRecords(team_ids, matches)
    const elim_before = computeEliminationResults(wl_before, config)
    const ghostIds = detectGhostMatches(currentRoundMatches, elim_before)

    for (const ghostId of ghostIds) {
        await supabase
            .from('tournament_matches')
            .update({ status: 'Completed', result: 'Draw', winner_id: null })
            .eq('id', ghostId)
    }

    // Check all matches completed
    const { data: verifyMatches } = await supabase
        .from('tournament_matches')
        .select('id, status, bracket:tournament_brackets!inner(round_number)')
        .eq('tournament_id', tournamentId)

    const currentRoundVerify = (verifyMatches || []).filter(
        (m: any) => m.bracket?.round_number === currentRound
    )
    const incomplete = currentRoundVerify.filter((m: any) => m.status !== 'Completed')
    if (incomplete.length > 0) {
        throw new Error(`${incomplete.length} matches still incomplete in round ${currentRound}`)
    }

    // Reload matches after ghost resolution
    const { matches: updatedMatches, participants: updatedParticipants } =
        await loadSwissContext(tournamentId)

    const updatedCurrentRound = updatedMatches.filter(m => m.round_number === currentRound)

    // Run the pure computation
    const result = computeRoundAdvance(
        updatedParticipants,
        updatedCurrentRound,
        updatedMatches,
        config
    )

    // ── Persist Score Updates ─────────────────────────────────────────
    for (const update of result.score_updates) {
        const raw = rawParticipants.find((p: any) => p.team_id === update.team_id)
        if (!raw) continue

        await supabase
            .from('tournament_participants')
            .update({ swiss_score: update.new_swiss_score })
            .eq('id', raw.id)
    }

    // ── Persist Opponent History ──────────────────────────────────────
    const historyInserts = result.score_updates
        .filter(u => u.opponent_id)
        .map(u => ({
            tournament_id: tournamentId,
            team_id: u.team_id,
            opponent_id: u.opponent_id!,
            round_number: currentRound,
        }))

    if (historyInserts.length > 0) {
        await supabase
            .from('tournament_opponents_history')
            .upsert(historyInserts, { onConflict: 'tournament_id,team_id,opponent_id' })
    }

    // ── Persist Eliminations ──────────────────────────────────────────
    for (const elim of result.elimination_results) {
        if (elim.status === 'eliminated') {
            const raw = rawParticipants.find((p: any) => p.team_id === elim.team_id)
            if (raw) {
                await supabase
                    .from('tournament_participants')
                    .update({ is_active: false, dropped_out_at: new Date().toISOString() })
                    .eq('id', raw.id)
            }
        }
    }

    // ── Advance Tournament State ──────────────────────────────────────
    const nextRound = currentRound + 1
    await supabase
        .from('tournaments')
        .update({
            current_round: nextRound,
        })
        .eq('id', tournamentId)
    await transitionTournament(tournamentId, result.tournament_completed ? 'Completed' : 'In_Progress')

    // ── Save Next Round Draft (if applicable) ─────────────────────────
    if (result.next_round_proposal) {
        const pairingsToInsert = result.next_round_proposal.pairings.map(p => ({
            tournament_id: tournamentId,
            round_number: result.next_round_proposal!.round,
            team1_id: p.team1_id,
            team2_id: p.team2_id || p.team1_id,
            pairing_status: 'draft',
            is_locked: false,
            generation_source: 'auto',
            version: 1,
            cannot_pair_again: true,
        }))

        await supabase.from('swiss_pairings').insert(pairingsToInsert)
    }

    // ── Log ───────────────────────────────────────────────────────────
    await supabase.from('tournament_logs').insert({
        tournament_id: tournamentId,
        action: result.tournament_completed ? 'TOURNAMENT_COMPLETED' : 'SWISS_ROUND_ADVANCED',
        details: JSON.stringify({
            round_completed: currentRound,
            next_round: result.tournament_completed ? null : nextRound,
            score_updates: result.score_updates.length,
            eliminated: result.elimination_results.filter(e => e.status === 'eliminated').length,
            qualified: result.elimination_results.filter(e => e.status === 'qualified').length,
            draft_generated: !!result.next_round_proposal,
        }),
        user_id: userId || null,
        event_category: 'swiss',
        impact_level: 'high',
        round_number: currentRound,
    })

    return result
}

// ─── Draft Discard / Regenerate ─────────────────────────────────────

/**
 * Discard existing draft pairings for a round and regenerate.
 */
export async function regenerateSwissDraft(
    tournamentId: string,
    roundNumber: number,
    userId?: string
): Promise<{ proposal: SwissProposal; pairingIds: string[] }> {
    const supabase = getServiceClient()

    // Delete existing unlocked drafts for this round
    await supabase
        .from('swiss_pairings')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('round_number', roundNumber)
        .eq('is_locked', false)

    // Generate fresh
    return createSwissDraft(tournamentId, userId)
}
