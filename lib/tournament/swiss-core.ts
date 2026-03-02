/**
 * swiss-core.ts — The Single Source of Truth for Swiss Tournament Logic
 *
 * RULES:
 *   ❌ NO database imports
 *   ❌ NO side effects
 *   ❌ NO API calls
 *   ✅ Pure functions only
 *   ✅ Receives data, returns structured output
 *
 * Everything downstream (service layer, API routes, admin UI)
 * calls into this module. Nothing else computes Swiss logic.
 */

// ─── Input Types ────────────────────────────────────────────────────

export interface SwissTeamInput {
    team_id: string
    seed_number: number
    swiss_score: number
    tiebreaker_points: number
    buchholz_score: number
    is_active: boolean
}

export interface SwissMatchInput {
    id: string
    team1_id: string | null
    team2_id: string | null
    winner_id: string | null
    result: string | null  // 'Team1_Win' | 'Team2_Win' | 'Draw' | null
    status: string         // 'Scheduled' | 'In_Progress' | 'Completed'
    round_number: number
}

export interface SwissConfig {
    points_per_win: number
    points_per_draw: number
    points_per_loss: number
    max_wins: number       // Typically 3 — wins needed to qualify
    max_losses: number     // Typically 3 — losses to be eliminated
    total_rounds: number
    current_round: number
    opening_best_of: number
    progression_best_of: number
    elimination_best_of: number
}

// ─── Output Types ───────────────────────────────────────────────────

export interface WLRecord {
    team_id: string
    wins: number
    losses: number
    draws: number
}

export interface ScoreUpdate {
    team_id: string
    points_earned: number
    new_swiss_score: number
    opponent_id: string | null
}

export interface ProposedPairing {
    team1_id: string
    team2_id: string | null  // null = bye
    is_bye: boolean
    reason: string           // Human-readable explanation of why this pairing was chosen
}

export interface EliminationResult {
    team_id: string
    status: 'qualified' | 'eliminated' | 'active'
    wins: number
    losses: number
}

export interface SwissProposal {
    round: number
    pairings: ProposedPairing[]
    metadata: {
        generated_at: string
        generation_source: 'auto' | 'manual' | 'ai'
        teams_paired: number
        byes: number
        rematches_forced: number
    }
}

export interface RoundAdvanceResult {
    score_updates: ScoreUpdate[]
    elimination_results: EliminationResult[]
    next_round_proposal: SwissProposal | null  // null if tournament is over
    tournament_completed: boolean
}

export interface ValidationResult {
    valid: boolean
    errors: string[]
}

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Compute win/loss/draw records for all teams from completed matches.
 * This is the ONLY place W/L records are calculated.
 */
export function computeWLRecords(
    team_ids: string[],
    all_matches: SwissMatchInput[]
): Record<string, WLRecord> {
    const records: Record<string, WLRecord> = {}

    for (const id of team_ids) {
        records[id] = { team_id: id, wins: 0, losses: 0, draws: 0 }
    }

    for (const m of all_matches) {
        if (m.status !== 'Completed' || !m.result) continue

        if (m.result === 'Team1_Win') {
            if (m.team1_id && records[m.team1_id]) records[m.team1_id].wins++
            if (m.team2_id && records[m.team2_id]) records[m.team2_id].losses++
        } else if (m.result === 'Team2_Win') {
            if (m.team2_id && records[m.team2_id]) records[m.team2_id].wins++
            if (m.team1_id && records[m.team1_id]) records[m.team1_id].losses++
        } else if (m.result === 'Draw') {
            if (m.team1_id && records[m.team1_id]) records[m.team1_id].draws++
            if (m.team2_id && records[m.team2_id]) records[m.team2_id].draws++
        }
    }

    return records
}

/**
 * Compute score updates for a single completed round.
 * Returns the delta points earned per team and their new total.
 */
export function computeScoreUpdates(
    round_matches: SwissMatchInput[],
    participants: SwissTeamInput[],
    config: SwissConfig
): ScoreUpdate[] {
    const updates: ScoreUpdate[] = []
    const scoreMap = new Map(participants.map(p => [p.team_id, p.swiss_score]))

    for (const match of round_matches) {
        if (match.status !== 'Completed' || !match.result) continue

        // Team 1
        if (match.team1_id) {
            const currentScore = scoreMap.get(match.team1_id) || 0
            let pts = config.points_per_loss
            if (match.result === 'Team1_Win') pts = config.points_per_win
            else if (match.result === 'Draw') pts = config.points_per_draw

            const newScore = currentScore + pts
            scoreMap.set(match.team1_id, newScore)
            updates.push({
                team_id: match.team1_id,
                points_earned: pts,
                new_swiss_score: newScore,
                opponent_id: match.team2_id,
            })
        }

        // Team 2
        if (match.team2_id) {
            const currentScore = scoreMap.get(match.team2_id) || 0
            let pts = config.points_per_loss
            if (match.result === 'Team2_Win') pts = config.points_per_win
            else if (match.result === 'Draw') pts = config.points_per_draw

            const newScore = currentScore + pts
            scoreMap.set(match.team2_id, newScore)
            updates.push({
                team_id: match.team2_id,
                points_earned: pts,
                new_swiss_score: newScore,
                opponent_id: match.team1_id,
            })
        }
    }

    return updates
}

/**
 * Determine elimination/qualification status for every team.
 */
export function computeEliminationResults(
    wl_records: Record<string, WLRecord>,
    config: SwissConfig
): EliminationResult[] {
    return Object.values(wl_records).map(rec => {
        let status: 'qualified' | 'eliminated' | 'active' = 'active'
        if (rec.wins >= config.max_wins) status = 'qualified'
        else if (rec.losses >= config.max_losses) status = 'eliminated'

        return {
            team_id: rec.team_id,
            status,
            wins: rec.wins,
            losses: rec.losses,
        }
    })
}

/**
 * Build the opponent history map from completed matches.
 * Returns: { team_id: Set<opponent_team_id> }
 */
export function buildOpponentHistory(
    all_matches: SwissMatchInput[]
): Map<string, Set<string>> {
    const history = new Map<string, Set<string>>()

    for (const m of all_matches) {
        if (m.status !== 'Completed') continue
        if (!m.team1_id || !m.team2_id) continue

        if (!history.has(m.team1_id)) history.set(m.team1_id, new Set())
        if (!history.has(m.team2_id)) history.set(m.team2_id, new Set())

        history.get(m.team1_id)!.add(m.team2_id)
        history.get(m.team2_id)!.add(m.team1_id)
    }

    return history
}

/**
 * Generate Swiss pairing proposal for the next round.
 *
 * Algorithm:
 *  1. Filter to active-only teams (not qualified, not eliminated)
 *  2. Group teams by swiss_score (W/L pool)
 *  3. Within each pool, sort by tiebreaker DESC → seed ASC
 *  4. Pair within each pool, respecting opponent history
 *  5. If a pool has an odd team, push the leftover down to the next pool
 *  6. Cross-pool pairing only as absolute last resort (forced rematch)
 *
 * Returns a PROPOSAL — not a database mutation.
 */
export function generateSwissProposal(
    participants: SwissTeamInput[],
    elimination_results: EliminationResult[],
    opponent_history: Map<string, Set<string>>,
    round_number: number,
    config: SwissConfig
): SwissProposal {
    // 1. Filter to active teams only
    const eliminationMap = new Map(elimination_results.map(e => [e.team_id, e.status]))
    const activeTeams = participants.filter(p => {
        const status = eliminationMap.get(p.team_id)
        return p.is_active && status === 'active'
    })

    // 2. Group by swiss_score (pool)
    const poolMap = new Map<number, SwissTeamInput[]>()
    for (const team of activeTeams) {
        const score = team.swiss_score
        if (!poolMap.has(score)) poolMap.set(score, [])
        poolMap.get(score)!.push(team)
    }

    // 3. Sort pools by score DESC, and sort teams within each pool
    const sortedScores = [...poolMap.keys()].sort((a, b) => b - a)
    for (const score of sortedScores) {
        poolMap.get(score)!.sort((a, b) => {
            if (b.tiebreaker_points !== a.tiebreaker_points) return b.tiebreaker_points - a.tiebreaker_points
            return a.seed_number - b.seed_number
        })
    }

    // 4. Pair within each pool, pushing leftovers to next pool
    const paired = new Set<string>()
    const pairings: ProposedPairing[] = []
    let rematches_forced = 0
    let carryOver: SwissTeamInput | null = null

    for (let poolIdx = 0; poolIdx < sortedScores.length; poolIdx++) {
        const score = sortedScores[poolIdx]
        const poolTeams = [...poolMap.get(score)!]

        // Add carry-over from previous pool (odd-sized pool leftover)
        if (carryOver) {
            poolTeams.unshift(carryOver)
            carryOver = null
        }

        // Pair within this pool
        const unpaired: SwissTeamInput[] = []
        const poolPaired = new Set<string>()

        for (let i = 0; i < poolTeams.length; i++) {
            const p1 = poolTeams[i]
            if (paired.has(p1.team_id) || poolPaired.has(p1.team_id)) continue

            const p1Opponents = opponent_history.get(p1.team_id) || new Set()

            // Try to find an opponent within THIS pool that hasn't been played
            let found: SwissTeamInput | null = null
            for (let j = i + 1; j < poolTeams.length; j++) {
                const p2 = poolTeams[j]
                if (paired.has(p2.team_id) || poolPaired.has(p2.team_id)) continue
                if (!p1Opponents.has(p2.team_id)) {
                    found = p2
                    break
                }
            }

            if (found) {
                poolPaired.add(p1.team_id)
                poolPaired.add(found.team_id)
                paired.add(p1.team_id)
                paired.add(found.team_id)
                pairings.push({
                    team1_id: p1.team_id,
                    team2_id: found.team_id,
                    is_bye: false,
                    reason: `Pool pairing (score ${score})`,
                })
            } else {
                unpaired.push(p1)
            }
        }

        // Handle unpaired teams from this pool
        if (unpaired.length === 1) {
            // Odd team → carry to next pool
            carryOver = unpaired[0]
        } else if (unpaired.length > 1) {
            // Multiple unpaired (all played each other within pool) → forced rematches within pool
            for (let i = 0; i < unpaired.length; i += 2) {
                if (i + 1 < unpaired.length) {
                    paired.add(unpaired[i].team_id)
                    paired.add(unpaired[i + 1].team_id)
                    pairings.push({
                        team1_id: unpaired[i].team_id,
                        team2_id: unpaired[i + 1].team_id,
                        is_bye: false,
                        reason: `Forced rematch within pool (score ${score})`,
                    })
                    rematches_forced++
                } else {
                    carryOver = unpaired[i]
                }
            }
        }
    }

    // 5. Handle final carry-over (last pool had odd team)
    if (carryOver) {
        // Try to pair with the last unpaired team from any pool, or give a bye
        let found = false
        // Look through all active teams for any unpaired
        for (const team of activeTeams) {
            if (!paired.has(team.team_id) && team.team_id !== carryOver.team_id) {
                paired.add(carryOver.team_id)
                paired.add(team.team_id)
                pairings.push({
                    team1_id: carryOver.team_id,
                    team2_id: team.team_id,
                    is_bye: false,
                    reason: 'Cross-pool pairing (last resort)',
                })
                found = true
                break
            }
        }
        if (!found) {
            paired.add(carryOver.team_id)
            pairings.push({
                team1_id: carryOver.team_id,
                team2_id: null,
                is_bye: true,
                reason: 'Bye — odd number of active teams',
            })
        }
    }

    return {
        round: round_number,
        pairings,
        metadata: {
            generated_at: new Date().toISOString(),
            generation_source: 'auto',
            teams_paired: pairings.filter(p => !p.is_bye).length * 2,
            byes: pairings.filter(p => p.is_bye).length,
            rematches_forced,
        },
    }
}

/**
 * Generate initial Round 1 pairings (seed-based, no history).
 */
export function generateRound1Proposal(
    participants: SwissTeamInput[],
    config: SwissConfig
): SwissProposal {
    const sorted = [...participants].sort((a, b) => a.seed_number - b.seed_number)
    const pairings: ProposedPairing[] = []

    for (let i = 0; i < sorted.length; i += 2) {
        const p1 = sorted[i]
        const p2 = sorted[i + 1] || null

        pairings.push({
            team1_id: p1.team_id,
            team2_id: p2?.team_id ?? null,
            is_bye: !p2,
            reason: p2
                ? `Seed ${p1.seed_number} vs Seed ${p2.seed_number}`
                : 'Bye — odd number of teams',
        })
    }

    return {
        round: 1,
        pairings,
        metadata: {
            generated_at: new Date().toISOString(),
            generation_source: 'auto',
            teams_paired: pairings.filter(p => !p.is_bye).length * 2,
            byes: pairings.filter(p => p.is_bye).length,
            rematches_forced: 0,
        },
    }
}

/**
 * Determine best_of for a match based on context.
 *
 * Match type hierarchy:
 *  - Elimination (either team has max_losses-1) → elimination_best_of
 *  - Progression (either team has max_wins-1) → progression_best_of
 *  - Opening (neither is close to being in or out) → opening_best_of
 */
export function determineBestOf(
    round_number: number,
    config: SwissConfig,
    team1_losses: number,
    team2_losses: number,
    team1_wins: number = 0,
    team2_wins: number = 0
): number {
    // A match is an "Elimination" match if either team is at risk of being eliminated (max_losses - 1)
    if (team1_losses >= config.max_losses - 1 || team2_losses >= config.max_losses - 1) {
        return config.elimination_best_of
    }

    // A match is a "Progression" match if either team is on the verge of qualifying (max_wins - 1)
    if (team1_wins >= config.max_wins - 1 || team2_wins >= config.max_wins - 1) {
        return config.progression_best_of
    }

    // Otherwise, it's an "Opening" match (neither is close to being in or out)
    return config.opening_best_of
}

/**
 * Detect "ghost matches" — matches where both teams are already
 * qualified or eliminated. These should be auto-resolved.
 */
export function detectGhostMatches(
    round_matches: SwissMatchInput[],
    elimination_results: EliminationResult[]
): string[] {
    const statusMap = new Map(elimination_results.map(e => [e.team_id, e.status]))

    const ghostMatchIds: string[] = []

    for (const m of round_matches) {
        if (m.status === 'Completed') continue

        const t1Done = !m.team1_id || statusMap.get(m.team1_id) !== 'active'
        const t2Done = !m.team2_id || statusMap.get(m.team2_id) !== 'active'

        if (t1Done && t2Done) {
            ghostMatchIds.push(m.id)
        }
    }

    return ghostMatchIds
}

/**
 * Validate a set of pairings before they are approved.
 */
export function validatePairings(
    pairings: ProposedPairing[],
    active_team_ids: string[]
): ValidationResult {
    const errors: string[] = []
    const seen = new Set<string>()

    for (const p of pairings) {
        // No self-play
        if (p.team1_id === p.team2_id && p.team2_id !== null) {
            errors.push(`Team ${p.team1_id} is paired against itself`)
        }

        // No duplicate appearances
        if (seen.has(p.team1_id)) {
            errors.push(`Team ${p.team1_id} appears in multiple pairings`)
        }
        seen.add(p.team1_id)

        if (p.team2_id) {
            if (seen.has(p.team2_id)) {
                errors.push(`Team ${p.team2_id} appears in multiple pairings`)
            }
            seen.add(p.team2_id)
        }
    }

    // Every active team must be accounted for
    for (const id of active_team_ids) {
        if (!seen.has(id)) {
            errors.push(`Active team ${id} is missing from pairings`)
        }
    }

    return { valid: errors.length === 0, errors }
}

/**
 * Full round advance computation.
 * Orchestrates score updates, elimination, and next-round proposal.
 *
 * This is the function that replaces the 200-line advanceSwiss().
 * It returns everything needed — the service layer persists it.
 */
export function computeRoundAdvance(
    participants: SwissTeamInput[],
    current_round_matches: SwissMatchInput[],
    all_matches: SwissMatchInput[],
    config: SwissConfig
): RoundAdvanceResult {
    const team_ids = participants.map(p => p.team_id)

    // 1. Score updates for THIS round
    const score_updates = computeScoreUpdates(current_round_matches, participants, config)

    // 2. Apply score updates to get updated participants (for W/L and next pairing)
    const updatedParticipants = participants.map(p => {
        const update = score_updates.find(u => u.team_id === p.team_id)
        return update
            ? { ...p, swiss_score: update.new_swiss_score }
            : p
    })

    // 3. W/L from ALL matches (including this round)
    const all_including_current = [...all_matches, ...current_round_matches.filter(
        m => !all_matches.some(am => am.id === m.id)
    )]
    const wl_records = computeWLRecords(team_ids, all_including_current)

    // 4. Elimination results
    const elimination_results = computeEliminationResults(wl_records, config)

    // 5. Check if tournament is complete
    const active_remaining = elimination_results.filter(e => e.status === 'active')
    const next_round = config.current_round + 1
    const tournament_completed = next_round > config.total_rounds || active_remaining.length < 2

    // 6. Generate next round proposal (if not complete)
    let next_round_proposal: SwissProposal | null = null
    if (!tournament_completed) {
        const opponent_history = buildOpponentHistory(all_including_current)
        next_round_proposal = generateSwissProposal(
            updatedParticipants,
            elimination_results,
            opponent_history,
            next_round,
            { ...config, current_round: next_round }
        )
    }

    return {
        score_updates,
        elimination_results,
        next_round_proposal,
        tournament_completed,
    }
}
