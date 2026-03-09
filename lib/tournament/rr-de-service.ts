/**
 * rr-de-service.ts — Round Robin → Double Elimination Database Service Layer
 *
 * Bridges rr-de-core.ts (pure logic) with Supabase (persistence).
 * Called by the orchestrator — never by API routes directly.
 */

import { createClient } from '@supabase/supabase-js'
import {
    generateRRDEGroupSchedule,
    generatePlayoffBracket,
    computePlayoffAdvancements,
    getPlayoffMatchLabel,
    getBracketType,
    POS,
    WB_ADVANCE,
    LB_ADVANCE,
    type RRDEConfig,
    type PlayoffAdvancement,
} from './rr-de-core'
import {
    computeStandings,
    groupName,
    type RRConfig,
    type RRTeamInput,
    type RRGroupAssignment,
    type RRMatchInput,
    type RRStanding,
} from './rr-core'

function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ─── Helper: parse bracket_settings safely ──────────────────────────

function parseBracketSettings(raw: any): Record<string, any> {
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try { return JSON.parse(raw) } catch { return {} }
}

// ─── Group Stage Generation ─────────────────────────────────────────

/**
 * Generate the Round Robin group stage for an RR_Double_Elim tournament.
 * Creates brackets and matches for every round-robin pairing.
 */
export async function generateRRDEBracket(
    tournamentId: string
): Promise<{ total_rounds: number; matchIds: string[]; totalMatches: number }> {
    const supabase = getServiceClient()

    // Load tournament
    const { data: tournament, error: tErr } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single()

    if (tErr || !tournament) throw new Error('Tournament not found')

    // Load participants
    const { data: participants, error: pErr } = await supabase
        .from('tournament_participants')
        .select('*, team:teams(id, name)')
        .eq('tournament_id', tournamentId)
        .order('seed_number', { ascending: true })

    if (pErr || !participants || participants.length < 2) {
        throw new Error('Need at least 2 seeded teams')
    }

    const teams: RRTeamInput[] = participants.map((p: any) => ({
        team_id: p.team_id,
        seed_number: p.seed_number || 0,
        team_name: p.team?.name,
    }))

    // Generate schedule
    const proposal = generateRRDEGroupSchedule(teams)

    // Set all participants to group 0, "Group A"
    for (const p of participants) {
        await supabase
            .from('tournament_participants')
            .update({ group_id: 0, group_name: groupName(0) })
            .eq('id', p.id)
    }

    // Create brackets (one per match slot)
    const bracketsToInsert = proposal.pairings.map((p, i) => ({
        tournament_id: tournamentId,
        round_number: p.round_number,
        bracket_position: i + 1,
    }))

    const { data: insertedBrackets, error: bErr } = await supabase
        .from('tournament_brackets')
        .insert(bracketsToInsert)
        .select('*')

    if (bErr || !insertedBrackets) {
        throw new Error(`Failed to create brackets: ${bErr?.message}`)
    }

    // Create matches
    const matchesToInsert = proposal.pairings.map((p, i) => {
        const isBye = p.is_bye || !p.team2_id
        return {
            bracket_id: insertedBrackets[i].id,
            tournament_id: tournamentId,
            match_number: i + 1,
            team1_id: p.team1_id,
            team2_id: isBye ? null : p.team2_id,
            status: isBye ? 'Completed' : 'Scheduled',
            result: isBye ? 'Team1_Win' : null,
            winner_id: isBye ? p.team1_id : null,
            best_of: tournament.opening_best_of || 1,
        }
    })

    const { data: insertedMatches, error: mErr } = await supabase
        .from('tournament_matches')
        .insert(matchesToInsert)
        .select('id')

    if (mErr) throw new Error(`Failed to create matches: ${mErr.message}`)

    // Store phase info in bracket_settings
    const settings = {
        phase: 'group',
        rr_total_rounds: proposal.total_rounds,
        playoff_rounds: 5,
        wb_advance: WB_ADVANCE,
        lb_advance: LB_ADVANCE,
    }

    await supabase.from('tournaments').update({
        total_rounds: proposal.total_rounds,
        current_round: 1,
        bracket_settings: JSON.stringify(settings),
    }).eq('id', tournamentId)

    // Log
    await supabase.from('tournament_logs').insert({
        tournament_id: tournamentId,
        action: 'RRDE_GROUP_GENERATED',
        details: JSON.stringify({
            team_count: teams.length,
            total_matches: proposal.metadata.total_matches,
            total_rounds: proposal.total_rounds,
            byes: proposal.metadata.bye_count,
        }),
        event_category: 'bracket',
        impact_level: 'high',
    })

    return {
        total_rounds: proposal.total_rounds,
        matchIds: (insertedMatches || []).map((m: any) => m.id),
        totalMatches: proposal.metadata.total_matches,
    }
}

// ─── Standings ──────────────────────────────────────────────────────

/**
 * Compute live standings for the RR group stage.
 * Returns a single group with all teams ranked.
 */
export async function computeRRDEStandings(
    tournamentId: string
): Promise<{
    groups: { group_id: number; group_name: string; standings: RRStanding[] }[]
}> {
    const supabase = getServiceClient()

    const { data: tournament } = await supabase
        .from('tournaments')
        .select('swiss_points_per_win, swiss_points_per_draw, swiss_points_per_loss')
        .eq('id', tournamentId)
        .single()

    const { data: participants } = await supabase
        .from('tournament_participants')
        .select('team_id, seed_number, group_id, group_name, is_active')
        .eq('tournament_id', tournamentId)
        .order('seed_number', { ascending: true })

    if (!participants || participants.length === 0) {
        return { groups: [] }
    }

    const assignments: RRGroupAssignment[] = participants.map((p: any) => ({
        team_id: p.team_id,
        seed_number: p.seed_number || 0,
        group_id: p.group_id ?? 0,
        group_name: p.group_name || groupName(p.group_id ?? 0),
    }))

    // Load matches with bracket info
    const { data: rawMatches } = await supabase
        .from('tournament_matches')
        .select('id, team1_id, team2_id, winner_id, result, status, bracket_id, team1_score, team2_score')
        .eq('tournament_id', tournamentId)

    const bracketIds = (rawMatches || []).map((m: any) => m.bracket_id).filter(Boolean)
    let bracketsMap: Record<string, { round_number: number; bracket_position: number }> = {}
    if (bracketIds.length > 0) {
        const { data: brackets } = await supabase
            .from('tournament_brackets')
            .select('id, round_number, bracket_position')
            .in('id', bracketIds)
        if (brackets) {
            for (const b of brackets) {
                bracketsMap[b.id] = { round_number: b.round_number, bracket_position: b.bracket_position }
            }
        }
    }

    // Filter to only group stage matches (exclude playoff positions)
    const groupMatches: RRMatchInput[] = (rawMatches || [])
        .filter((m: any) => {
            const pos = bracketsMap[m.bracket_id]?.bracket_position ?? 0
            return pos < POS.WB_SEMI_1 || pos > POS.GRAND_FINAL
        })
        .map((m: any) => ({
            id: m.id,
            team1_id: m.team1_id,
            team2_id: m.team2_id,
            winner_id: m.winner_id,
            result: m.result,
            status: m.status,
            round_number: bracketsMap[m.bracket_id]?.round_number || 0,
            group_id: 0,
            team1_score: m.team1_score ?? 0,
            team2_score: m.team2_score ?? 0,
        }))

    const config: RRConfig = {
        group_count: 1,
        points_per_win: tournament?.swiss_points_per_win || 3,
        points_per_draw: tournament?.swiss_points_per_draw || 1,
        points_per_loss: tournament?.swiss_points_per_loss || 0,
    }

    const standings = computeStandings(assignments, groupMatches, config)

    return {
        groups: [{
            group_id: 0,
            group_name: 'Group Stage',
            standings: standings.sort((a, b) => a.rank - b.rank),
        }],
    }
}

// ─── Round Advancement (Group Stage) ────────────────────────────────

/**
 * Advance the group stage to the next round.
 * All matches in the current round must be completed.
 */
export async function advanceRRDERound(
    tournamentId: string,
    userId?: string
): Promise<{ next_round: number; group_complete: boolean; tournament_completed: boolean }> {
    const supabase = getServiceClient()

    const { data: tournament } = await supabase
        .from('tournaments')
        .select('current_round, total_rounds, bracket_settings')
        .eq('id', tournamentId)
        .single()

    if (!tournament) throw new Error('Tournament not found')

    const settings = parseBracketSettings(tournament.bracket_settings)
    const phase = settings.phase || 'group'
    const currentRound = tournament.current_round || 1

    // ── If in playoffs, delegate to playoff advancement ──
    if (phase === 'playoffs') {
        return advancePlayoffRound(tournamentId, userId)
    }

    // ── Group stage round advancement ──
    const rrTotalRounds = settings.rr_total_rounds || tournament.total_rounds || 1

    // Check all current round matches are completed
    const { data: brackets } = await supabase
        .from('tournament_brackets')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('round_number', currentRound)

    if (brackets && brackets.length > 0) {
        const bracketIds = brackets.map(b => b.id)
        const { data: incomplete } = await supabase
            .from('tournament_matches')
            .select('id')
            .in('bracket_id', bracketIds)
            .neq('status', 'Completed')

        if (incomplete && incomplete.length > 0) {
            throw new Error(`${incomplete.length} matches still incomplete in round ${currentRound}`)
        }
    }

    const nextRound = currentRound + 1
    const groupComplete = nextRound > rrTotalRounds

    await supabase.from('tournaments').update({
        current_round: groupComplete ? currentRound : nextRound,
    }).eq('id', tournamentId)

    await supabase.from('tournament_logs').insert({
        tournament_id: tournamentId,
        action: groupComplete ? 'RRDE_GROUP_COMPLETE' : 'ROUND_ADVANCED',
        details: JSON.stringify({
            format: 'RR_Double_Elim',
            phase: 'group',
            round_completed: currentRound,
            next_round: groupComplete ? null : nextRound,
        }),
        user_id: userId || null,
    })

    return {
        next_round: nextRound,
        group_complete: groupComplete,
        tournament_completed: false,
    }
}

// ─── Playoff Generation ─────────────────────────────────────────────

/**
 * Generate the playoff bracket after the group stage is complete.
 * Takes standings, creates WB/LB/GF bracket entries and matches.
 */
export async function generateRRDEPlayoffs(
    tournamentId: string,
    userId?: string
): Promise<{ success: boolean; matchIds: string[]; eliminated: string[] }> {
    const supabase = getServiceClient()

    const { data: tournament } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single()

    if (!tournament) throw new Error('Tournament not found')

    const settings = parseBracketSettings(tournament.bracket_settings)
    if (settings.phase === 'playoffs') {
        throw new Error('Playoffs already generated')
    }

    // Compute standings
    const { groups } = await computeRRDEStandings(tournamentId)
    if (groups.length === 0 || groups[0].standings.length < 6) {
        throw new Error('Not enough teams for playoffs')
    }

    const standings = groups[0].standings
    const rankedTeams = standings.map(s => ({
        team_id: s.team_id,
        rank: s.rank,
    }))

    // Load team names for logging
    const { data: teamData } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', rankedTeams.map(t => t.team_id))
    const teamNames: Record<string, string> = {}
    for (const t of (teamData || [])) teamNames[t.id] = t.name

    const config: RRDEConfig = {
        points_per_win: tournament.swiss_points_per_win || 3,
        points_per_draw: tournament.swiss_points_per_draw || 1,
        points_per_loss: tournament.swiss_points_per_loss || 0,
        group_best_of: tournament.opening_best_of || 1,
        wb_best_of: tournament.progression_best_of || 3,
        lb_best_of: tournament.elimination_best_of || 3,
        finals_best_of: tournament.finals_best_of || 5,
    }

    const proposal = generatePlayoffBracket(rankedTeams, config)

    // Current max match_number
    const { data: maxMatchRow } = await supabase
        .from('tournament_matches')
        .select('match_number')
        .eq('tournament_id', tournamentId)
        .order('match_number', { ascending: false })
        .limit(1)

    let matchNumber = (maxMatchRow?.[0]?.match_number || 0) + 1

    const rrTotalRounds = settings.rr_total_rounds || tournament.total_rounds

    // Create brackets for playoff matches
    const bracketsToInsert = proposal.matches.map(m => ({
        tournament_id: tournamentId,
        round_number: rrTotalRounds + m.round_offset,
        bracket_position: m.bracket_position,
        is_final: m.bracket_position === POS.GRAND_FINAL,
    }))

    const { data: insertedBrackets, error: bErr } = await supabase
        .from('tournament_brackets')
        .insert(bracketsToInsert)
        .select('*')

    if (bErr || !insertedBrackets) {
        throw new Error(`Failed to create playoff brackets: ${bErr?.message}`)
    }

    // Create matches
    const matchesToInsert = proposal.matches.map((m, i) => ({
        bracket_id: insertedBrackets[i].id,
        tournament_id: tournamentId,
        match_number: matchNumber++,
        team1_id: m.team1_id,
        team2_id: m.team2_id,
        status: 'Scheduled',
        best_of: m.best_of,
        notes: m.label,
    }))

    const { data: insertedMatches, error: mErr } = await supabase
        .from('tournament_matches')
        .insert(matchesToInsert)
        .select('id')

    if (mErr) throw new Error(`Failed to create playoff matches: ${mErr.message}`)

    // Update tournament state
    const newSettings = {
        ...settings,
        phase: 'playoffs',
        playoff_start_round: rrTotalRounds + 1,
    }

    await supabase.from('tournaments').update({
        current_round: rrTotalRounds + 1,
        total_rounds: rrTotalRounds + proposal.total_playoff_rounds,
        bracket_settings: JSON.stringify(newSettings),
    }).eq('id', tournamentId)

    // Mark eliminated teams
    const eliminated = rankedTeams
        .filter(t => t.rank > WB_ADVANCE + LB_ADVANCE)
        .map(t => t.team_id)

    if (eliminated.length > 0) {
        await supabase
            .from('tournament_participants')
            .update({ is_active: false, dropped_out_at: new Date().toISOString() })
            .eq('tournament_id', tournamentId)
            .in('team_id', eliminated)
    }

    // Log
    await supabase.from('tournament_logs').insert({
        tournament_id: tournamentId,
        action: 'RRDE_PLAYOFFS_GENERATED',
        details: JSON.stringify({
            wb_teams: rankedTeams.slice(0, WB_ADVANCE).map(t => ({
                team: teamNames[t.team_id] || t.team_id,
                rank: t.rank,
            })),
            lb_teams: rankedTeams.slice(WB_ADVANCE, WB_ADVANCE + LB_ADVANCE).map(t => ({
                team: teamNames[t.team_id] || t.team_id,
                rank: t.rank,
            })),
            eliminated: eliminated.map(id => teamNames[id] || id),
            total_playoff_matches: proposal.matches.length,
        }),
        user_id: userId || null,
        event_category: 'bracket',
        impact_level: 'critical',
    })

    return {
        success: true,
        matchIds: (insertedMatches || []).map((m: any) => m.id),
        eliminated,
    }
}

// ─── Playoff Round Advancement ──────────────────────────────────────

/**
 * Advance within the playoff phase.
 * Computes advancements (winners/losers) and populates future match slots.
 */
async function advancePlayoffRound(
    tournamentId: string,
    userId?: string
): Promise<{ next_round: number; group_complete: boolean; tournament_completed: boolean }> {
    const supabase = getServiceClient()

    const { data: tournament } = await supabase
        .from('tournaments')
        .select('current_round, total_rounds, bracket_settings')
        .eq('id', tournamentId)
        .single()

    if (!tournament) throw new Error('Tournament not found')

    const currentRound = tournament.current_round || 1
    const totalRounds = tournament.total_rounds || 1

    // Get current round brackets + matches
    const { data: currentBrackets } = await supabase
        .from('tournament_brackets')
        .select('id, round_number, bracket_position')
        .eq('tournament_id', tournamentId)
        .eq('round_number', currentRound)

    if (!currentBrackets || currentBrackets.length === 0) {
        throw new Error(`No brackets found for round ${currentRound}`)
    }

    const bracketIds = currentBrackets.map(b => b.id)
    const { data: currentMatches } = await supabase
        .from('tournament_matches')
        .select('id, bracket_id, team1_id, team2_id, winner_id, status')
        .in('bracket_id', bracketIds)

    if (!currentMatches) throw new Error('No matches found')

    // Check all are completed
    const incomplete = currentMatches.filter(m => m.status !== 'Completed')
    if (incomplete.length > 0) {
        throw new Error(`${incomplete.length} matches still incomplete in round ${currentRound}`)
    }

    // Build completed match data with bracket positions
    const bracketPosMap = new Map<string, number>()
    for (const b of currentBrackets) bracketPosMap.set(b.id, b.bracket_position)

    const completedForAdvancement = currentMatches.map(m => ({
        bracket_position: bracketPosMap.get(m.bracket_id) || 0,
        team1_id: m.team1_id,
        team2_id: m.team2_id,
        winner_id: m.winner_id,
        status: m.status,
    }))

    // Compute advancements
    const result = computePlayoffAdvancements(completedForAdvancement, currentRound)

    // Apply advancements — update future matches
    if (result.advancements.length > 0) {
        // Load ALL playoff brackets for this tournament
        const { data: allBrackets } = await supabase
            .from('tournament_brackets')
            .select('id, round_number, bracket_position')
            .eq('tournament_id', tournamentId)

        const allBracketsMap = new Map<string, string>() // "round:pos" → bracket_id
        for (const b of (allBrackets || [])) {
            allBracketsMap.set(`${b.round_number}:${b.bracket_position}`, b.id)
        }

        const settings = parseBracketSettings(tournament.bracket_settings)
        const playoffStartRound = settings.playoff_start_round || 1

        for (const adv of result.advancements) {
            const targetRound = playoffStartRound + adv.target_round_offset - 1
            const targetKey = `${targetRound}:${adv.target_bracket_position}`
            const targetBracketId = allBracketsMap.get(targetKey)

            if (!targetBracketId) continue

            // Find the match for this bracket
            const { data: targetMatches } = await supabase
                .from('tournament_matches')
                .select('id')
                .eq('bracket_id', targetBracketId)
                .limit(1)

            if (targetMatches && targetMatches.length > 0) {
                await supabase
                    .from('tournament_matches')
                    .update({ [adv.slot]: adv.team_id })
                    .eq('id', targetMatches[0].id)
            }
        }
    }

    // Update tournament round
    const nextRound = currentRound + 1
    const isCompleted = result.tournament_completed || nextRound > totalRounds

    await supabase.from('tournaments').update({
        current_round: isCompleted ? currentRound : nextRound,
    }).eq('id', tournamentId)

    if (isCompleted) {
        const { transitionTournament } = await import('./lifecycle/lifecycle-service')
        await transitionTournament(tournamentId, 'Completed')
    }

    // Log
    await supabase.from('tournament_logs').insert({
        tournament_id: tournamentId,
        action: isCompleted ? 'TOURNAMENT_COMPLETED' : 'PLAYOFF_ROUND_ADVANCED',
        details: JSON.stringify({
            format: 'RR_Double_Elim',
            phase: 'playoffs',
            round_completed: currentRound,
            next_round: isCompleted ? null : nextRound,
            advancements: result.advancements.length,
        }),
        user_id: userId || null,
    })

    return {
        next_round: nextRound,
        group_complete: true,
        tournament_completed: isCompleted,
    }
}
