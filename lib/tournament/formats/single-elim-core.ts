/**
 * single-elim-core.ts — Pure Single Elimination Engine
 *
 * RULES:
 *   ❌ NO database imports
 *   ❌ NO side effects
 *   ✅ Pure functions only
 *
 * Extracts and consolidates bracket logic from:
 *   - lib/bracket-mgmt.ts (generateSingleEliminationBracketInternal)
 *   - app/api/tournaments/[id]/bracket/route.ts (generateSingleEliminationBracket, advanceByeWinners)
 *   - app/api/tournaments/[id]/advance/route.ts (advanceSingleElimination)
 */

import type {
    TournamentEngine,
    TeamSeed,
    FormatConfig,
    BracketProposal,
    BracketSlot,
    MatchSlot,
    AdvancementResult,
    Advancement,
    CompletedMatch,
} from '../engine'

// ─── Pure Helpers ───────────────────────────────────────────────────

/**
 * Generate the classic bracket seed ordering.
 * For 8 teams: [0,7, 3,4, 1,6, 2,5] → 1v8, 4v5, 2v7, 3v6
 *
 * This is the ONLY implementation. Delete the copies in
 * bracket-mgmt.ts and bracket/route.ts.
 */
export function generateBracketSeedOrder(bracketSize: number): number[] {
    if (bracketSize === 2) return [0, 1]

    const order: number[] = []
    const subOrder = generateBracketSeedOrder(bracketSize / 2)

    for (const seed of subOrder) {
        order.push(seed)
        order.push(bracketSize - 1 - seed)
    }

    return order
}

/**
 * Determine which slot a winner goes into in the next round.
 * Odd bracket_position → team1_id, even → team2_id.
 */
export function getNextSlot(bracketPosition: number): 'team1_id' | 'team2_id' {
    return bracketPosition % 2 === 1 ? 'team1_id' : 'team2_id'
}

/**
 * Compute the next bracket position from the current one.
 */
export function getNextBracketPosition(bracketPosition: number): number {
    return Math.ceil(bracketPosition / 2)
}

// ─── Engine Implementation ──────────────────────────────────────────

export const SingleEliminationEngine: TournamentEngine = {
    format: 'Single_Elimination',

    /**
     * Generate the full bracket tree from seeded teams.
     *
     * Consolidates:
     *   - generateSingleEliminationBracket() from bracket/route.ts
     *   - generateSingleEliminationBracketInternal() from bracket-mgmt.ts
     */
    generateBracket(
        teams: TeamSeed[],
        config: FormatConfig
    ): BracketProposal {
        const teamCount = teams.length
        const totalRounds = Math.ceil(Math.log2(teamCount))
        const bracketSize = Math.pow(2, totalRounds)
        const byeCount = bracketSize - teamCount
        const seedOrder = generateBracketSeedOrder(bracketSize)

        // Sort teams by seed
        const sorted = [...teams].sort((a, b) => a.seed_number - b.seed_number)

        // ── Build bracket slots ─────────────────────────────────────────
        const brackets: BracketSlot[] = []
        for (let round = 1; round <= totalRounds; round++) {
            const matchesInRound = bracketSize / Math.pow(2, round)
            for (let pos = 1; pos <= matchesInRound; pos++) {
                brackets.push({
                    round_number: round,
                    bracket_position: pos,
                    is_final: round === totalRounds,
                })
            }
        }

        // ── Build first-round matches with seeded teams ─────────────────
        const matches: MatchSlot[] = []
        const firstRoundCount = bracketSize / 2

        for (let i = 0; i < firstRoundCount; i++) {
            const seed1Index = seedOrder[i * 2]
            const seed2Index = seedOrder[i * 2 + 1]

            const team1 = sorted[seed1Index] || null
            const team2 = sorted[seed2Index] || null

            const match: MatchSlot = {
                bracket_position: i + 1,
                round_number: 1,
                team1_id: team1?.team_id || null,
                team2_id: team2?.team_id || null,
                is_bye: (team1 !== null) !== (team2 !== null),  // exactly one null
                winner_id: null,
                status: 'Scheduled',
                result: null,
                best_of: config.opening_best_of,
            }

            // Auto-complete byes
            if (team1 && !team2) {
                match.winner_id = team1.team_id
                match.status = 'Completed'
                match.result = 'Team1_Win'
            } else if (team2 && !team1) {
                match.winner_id = team2.team_id
                match.status = 'Completed'
                match.result = 'Team2_Win'
            }

            matches.push(match)
        }

        // ── Build empty matches for subsequent rounds ───────────────────
        for (let round = 2; round <= totalRounds; round++) {
            const matchesInRound = bracketSize / Math.pow(2, round)
            const bestOf = round === totalRounds
                ? config.finals_best_of
                : config.elimination_best_of

            for (let pos = 1; pos <= matchesInRound; pos++) {
                matches.push({
                    bracket_position: pos,
                    round_number: round,
                    team1_id: null,
                    team2_id: null,
                    is_bye: false,
                    winner_id: null,
                    status: 'Scheduled',
                    result: null,
                    best_of: bestOf,
                })
            }
        }

        // ── Compute bye advancements into round 2 ───────────────────────
        const byeMatches = matches.filter(m => m.round_number === 1 && m.status === 'Completed' && m.winner_id)
        for (const byeMatch of byeMatches) {
            const nextPos = getNextBracketPosition(byeMatch.bracket_position)
            const slot = getNextSlot(byeMatch.bracket_position)
            const nextMatch = matches.find(m => m.round_number === 2 && m.bracket_position === nextPos)
            if (nextMatch) {
                if (slot === 'team1_id') nextMatch.team1_id = byeMatch.winner_id
                else nextMatch.team2_id = byeMatch.winner_id
            }
        }

        return {
            format: 'Single_Elimination',
            total_rounds: totalRounds,
            brackets,
            matches,
            metadata: {
                generated_at: new Date().toISOString(),
                team_count: teamCount,
                bye_count: byeCount,
            },
        }
    },

    /**
     * Compute which winners advance to which slots in the next round.
     *
     * Consolidates:
     *   - advanceSingleElimination() from advance/route.ts
     *   - advanceByeWinners() from bracket/route.ts
     */
    computeAdvancements(
        current_round: number,
        total_rounds: number,
        completed_matches: CompletedMatch[],
        all_brackets: BracketSlot[]
    ): AdvancementResult {
        const advancements: Advancement[] = []
        const nextRound = current_round + 1
        const tournament_completed = nextRound > total_rounds

        if (tournament_completed) {
            return { advancements: [], tournament_completed: true }
        }

        // Get round matches with their bracket positions
        const roundMatches = completed_matches.filter(m => m.round_number === current_round)
        const nextRoundBrackets = all_brackets.filter(b => b.round_number === nextRound)

        for (const match of roundMatches) {
            if (!match.winner_id) continue

            const nextBracketPos = getNextBracketPosition(match.bracket_position)
            const slot = getNextSlot(match.bracket_position)

            // Verify next bracket exists
            const nextBracket = nextRoundBrackets.find(b => b.bracket_position === nextBracketPos)
            if (!nextBracket) continue

            advancements.push({
                winner_id: match.winner_id,
                next_round: nextRound,
                next_bracket_position: nextBracketPos,
                slot,
            })
        }

        return { advancements, tournament_completed: false }
    },

    /**
     * Validate a bracket proposal.
     */
    validate(proposal: BracketProposal): { valid: boolean; errors: string[] } {
        const errors: string[] = []

        // Check we have correct number of rounds
        const expectedRounds = Math.ceil(Math.log2(proposal.metadata.team_count))
        if (proposal.total_rounds !== expectedRounds) {
            errors.push(`Expected ${expectedRounds} rounds for ${proposal.metadata.team_count} teams, got ${proposal.total_rounds}`)
        }

        // Check first round matches have correct count
        const r1Matches = proposal.matches.filter(m => m.round_number === 1)
        const bracketSize = Math.pow(2, proposal.total_rounds)
        if (r1Matches.length !== bracketSize / 2) {
            errors.push(`Expected ${bracketSize / 2} first-round matches, got ${r1Matches.length}`)
        }

        // Check for self-play
        for (const m of proposal.matches) {
            if (m.team1_id && m.team2_id && m.team1_id === m.team2_id) {
                errors.push(`Match at round ${m.round_number} position ${m.bracket_position}: team plays itself`)
            }
        }

        // Check no team appears in multiple first-round matches
        const seen = new Set<string>()
        for (const m of r1Matches) {
            for (const id of [m.team1_id, m.team2_id].filter(Boolean) as string[]) {
                if (seen.has(id)) {
                    errors.push(`Team ${id} appears in multiple first-round matches`)
                }
                seen.add(id)
            }
        }

        return { valid: errors.length === 0, errors }
    },
}
