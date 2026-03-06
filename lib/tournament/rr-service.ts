/**
 * rr-service.ts — Round Robin Database Service Layer
 *
 * Bridges rr-core.ts (pure logic) with Supabase (persistence).
 * Called by the orchestrator — never by API routes directly.
 */

import { createClient } from '@supabase/supabase-js'
import {
    assignGroups,
    generateAllGroupSchedules,
    computeStandings,
    groupName,
    type RRConfig,
    type RRTeamInput,
    type RRGroupAssignment,
    type RRMatchInput,
    type RRStanding,
    type RRScheduleProposal,
} from './rr-core'

function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ─── Bracket Generation ─────────────────────────────────────────────

/**
 * Generate the full Round Robin bracket for a tournament.
 *
 * Steps:
 *   1. Load participants (seeded)
 *   2. Assign to groups via snake draft
 *   3. Generate all group schedules
 *   4. Persist: update participants with group_id, create brackets & matches
 */
export async function generateRoundRobinBracket(
    tournamentId: string
): Promise<{ proposal: RRScheduleProposal; matchIds: string[] }> {
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

    const groupCount = tournament.rr_group_count || 4
    const config: RRConfig = {
        group_count: groupCount,
        points_per_win: tournament.swiss_points_per_win || 3,
        points_per_draw: tournament.swiss_points_per_draw || 1,
        points_per_loss: tournament.swiss_points_per_loss || 0,
    }

    // 1. Assign groups
    const teams: RRTeamInput[] = participants.map((p: any) => ({
        team_id: p.team_id,
        seed_number: p.seed_number || 0,
        team_name: p.team?.name,
    }))

    const assignments = assignGroups(teams, groupCount)

    // 2. Generate schedule
    const proposal = generateAllGroupSchedules(assignments, config)

    // 3. Persist group assignments on participants
    for (const a of assignments) {
        await supabase
            .from('tournament_participants')
            .update({ group_id: a.group_id, group_name: a.group_name })
            .eq('tournament_id', tournamentId)
            .eq('team_id', a.team_id)
    }

    // 4. Create brackets (one per match slot, grouped by round + group)
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

    // 5. Create matches
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
            best_of: 1,  // Round Robin is always Bo1
        }
    })

    const { data: insertedMatches, error: mErr } = await supabase
        .from('tournament_matches')
        .insert(matchesToInsert)
        .select('id')

    if (mErr) {
        throw new Error(`Failed to create matches: ${mErr.message}`)
    }

    // 6. Update tournament state
    await supabase.from('tournaments').update({
        total_rounds: proposal.total_rounds,
        current_round: 1,
    }).eq('id', tournamentId)

    // 7. Log
    await supabase.from('tournament_logs').insert({
        tournament_id: tournamentId,
        action: 'RR_BRACKET_GENERATED',
        details: JSON.stringify({
            group_count: groupCount,
            teams_per_group: proposal.groups.map(g => g.team_ids.length),
            total_matches: proposal.metadata.total_matches,
            total_rounds: proposal.total_rounds,
            byes: proposal.metadata.bye_count,
        }),
        event_category: 'bracket',
        impact_level: 'high',
    })

    return {
        proposal,
        matchIds: (insertedMatches || []).map((m: any) => m.id),
    }
}

// ─── Standings ──────────────────────────────────────────────────────

/**
 * Compute live standings from the database.
 */
export async function computeRoundRobinStandings(
    tournamentId: string
): Promise<{
    groups: { group_id: number; group_name: string; standings: RRStanding[] }[]
}> {
    const supabase = getServiceClient()

    // Load tournament
    const { data: tournament } = await supabase
        .from('tournaments')
        .select('rr_group_count, swiss_points_per_win, swiss_points_per_draw, swiss_points_per_loss')
        .eq('id', tournamentId)
        .single()

    // Load participants with group info
    const { data: participants } = await supabase
        .from('tournament_participants')
        .select('team_id, seed_number, group_id, group_name, is_active')
        .eq('tournament_id', tournamentId)
        .order('seed_number', { ascending: true })

    if (!participants || participants.length === 0) {
        return { groups: [] }
    }

    // Build assignments
    const assignments: RRGroupAssignment[] = participants.map((p: any) => ({
        team_id: p.team_id,
        seed_number: p.seed_number || 0,
        group_id: p.group_id ?? 0,
        group_name: p.group_name || groupName(p.group_id ?? 0),
    }))

    // Load matches with bracket info for round_number
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

    // Map matches to RRMatchInput with group_id derived from participants
    const teamGroupMap = new Map<string, number>()
    for (const a of assignments) {
        teamGroupMap.set(a.team_id, a.group_id)
    }

    const matches: RRMatchInput[] = (rawMatches || []).map((m: any) => ({
        id: m.id,
        team1_id: m.team1_id,
        team2_id: m.team2_id,
        winner_id: m.winner_id,
        result: m.result,
        status: m.status,
        round_number: bracketsMap[m.bracket_id]?.round_number || 0,
        group_id: teamGroupMap.get(m.team1_id) ?? 0,
        team1_score: m.team1_score ?? 0,
        team2_score: m.team2_score ?? 0,
    }))

    const config: RRConfig = {
        group_count: tournament?.rr_group_count || 4,
        points_per_win: tournament?.swiss_points_per_win || 3,
        points_per_draw: tournament?.swiss_points_per_draw || 1,
        points_per_loss: tournament?.swiss_points_per_loss || 0,
    }

    const standings = computeStandings(assignments, matches, config)

    // Group standings by group_id
    const groupedStandings = new Map<number, RRStanding[]>()
    for (const s of standings) {
        if (!groupedStandings.has(s.group_id)) groupedStandings.set(s.group_id, [])
        groupedStandings.get(s.group_id)!.push(s)
    }

    const groups = [...groupedStandings.entries()]
        .sort(([a], [b]) => a - b)
        .map(([gid, st]) => ({
            group_id: gid,
            group_name: groupName(gid),
            standings: st.sort((a, b) => a.rank - b.rank),
        }))

    return { groups }
}

// ─── Round Advancement ──────────────────────────────────────────────

/**
 * Validate and advance to the next round.
 * All matches in the current round must be completed.
 */
export async function advanceRoundRobinRound(
    tournamentId: string,
    userId?: string
): Promise<{ next_round: number; tournament_completed: boolean }> {
    const supabase = getServiceClient()

    const { data: tournament } = await supabase
        .from('tournaments')
        .select('current_round, total_rounds')
        .eq('id', tournamentId)
        .single()

    if (!tournament) throw new Error('Tournament not found')

    const currentRound = tournament.current_round || 1
    const totalRounds = tournament.total_rounds || 1

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
    const isCompleted = nextRound > totalRounds

    await supabase.from('tournaments').update({
        current_round: isCompleted ? currentRound : nextRound,
    }).eq('id', tournamentId)

    // Log
    await supabase.from('tournament_logs').insert({
        tournament_id: tournamentId,
        action: isCompleted ? 'TOURNAMENT_COMPLETED' : 'ROUND_ADVANCED',
        details: JSON.stringify({
            format: 'Round_Robin',
            round_completed: currentRound,
            next_round: isCompleted ? null : nextRound,
        }),
        user_id: userId || null,
    })

    return { next_round: nextRound, tournament_completed: isCompleted }
}
