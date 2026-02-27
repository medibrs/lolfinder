/**
 * engine.ts — Unified Tournament Engine Interface
 *
 * Every tournament format implements this contract.
 * The orchestrator dispatches to the right engine based on format.
 *
 * This is the architectural boundary:
 *   - Engine = pure computation (no DB)
 *   - Service = persistence (calls engine, writes DB)
 *   - Orchestrator = dispatch (picks engine + service by format)
 */

// ─── Generic Types ──────────────────────────────────────────────────

export interface TeamSeed {
    team_id: string
    seed_number: number
    team_name?: string
}

export interface MatchSlot {
    bracket_position: number
    round_number: number
    team1_id: string | null
    team2_id: string | null
    is_bye: boolean
    winner_id: string | null
    status: 'Scheduled' | 'Completed'
    result: string | null
    best_of: number
}

export interface BracketSlot {
    round_number: number
    bracket_position: number
    is_final: boolean
}

export interface BracketProposal {
    format: string
    total_rounds: number
    brackets: BracketSlot[]
    matches: MatchSlot[]
    metadata: {
        generated_at: string
        team_count: number
        bye_count: number
    }
}

export interface AdvancementResult {
    /** Winners to push forward: key = "round:position", value = { team_id, slot } */
    advancements: Advancement[]
    tournament_completed: boolean
}

export interface Advancement {
    winner_id: string
    next_round: number
    next_bracket_position: number
    slot: 'team1_id' | 'team2_id'
}

export interface FormatConfig {
    opening_best_of: number
    progression_best_of: number
    elimination_best_of: number
    finals_best_of: number
}

export interface CompletedMatch {
    id: string
    bracket_id: string
    bracket_position: number
    round_number: number
    team1_id: string | null
    team2_id: string | null
    winner_id: string | null
    result: string | null
    status: string
}

// ─── Engine Interface ───────────────────────────────────────────────

/**
 * Every format engine must implement these methods.
 * All methods are PURE — no database access.
 */
export interface TournamentEngine {
    readonly format: string

    /**
     * Generate the full bracket/pairing structure from seeded teams.
     * For elimination: returns entire bracket tree.
     * For Swiss: returns round 1 pairings (see SwissEngine for rounds 2+).
     */
    generateBracket(
        teams: TeamSeed[],
        config: FormatConfig
    ): BracketProposal

    /**
     * Given completed matches in the current round,
     * compute which teams advance and to which slots.
     */
    computeAdvancements(
        current_round: number,
        total_rounds: number,
        completed_matches: CompletedMatch[],
        all_brackets: BracketSlot[]
    ): AdvancementResult

    /**
     * Validate that a bracket proposal is structurally sound.
     */
    validate(proposal: BracketProposal): { valid: boolean; errors: string[] }
}
