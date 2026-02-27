/**
 * double-elim-core.ts — Double Elimination Engine (Stub)
 *
 * Implements the TournamentEngine interface for Double Elimination format.
 * Currently stubbed — ready for implementation when needed.
 *
 * Double Elimination requires:
 *   - Winners bracket (same as Single Elimination)
 *   - Losers bracket (losers from winners bracket drop here)
 *   - Grand Finals (winners bracket champion vs losers bracket champion)
 *   - Optional reset (if losers bracket champion wins grand finals)
 */

import type {
    TournamentEngine,
    TeamSeed,
    FormatConfig,
    BracketProposal,
    BracketSlot,
    AdvancementResult,
    CompletedMatch,
} from '../engine'

export const DoubleEliminationEngine: TournamentEngine = {
    format: 'Double_Elimination',

    generateBracket(
        teams: TeamSeed[],
        config: FormatConfig
    ): BracketProposal {
        // TODO: Implement double elimination bracket generation
        // Structure:
        //   1. Winners bracket (standard single-elim tree)
        //   2. Losers bracket (receives losers from each winners round)
        //   3. Grand Finals match
        //
        // Losers bracket pairing:
        //   - Round 1 losers → Losers Round 1
        //   - Round 2 losers → Losers Round 3 (staggered)
        //   - etc.

        throw new Error('Double Elimination is not yet implemented')
    },

    computeAdvancements(
        current_round: number,
        total_rounds: number,
        completed_matches: CompletedMatch[],
        all_brackets: BracketSlot[]
    ): AdvancementResult {
        // TODO: Implement advancement logic
        // Must handle both winners and losers brackets
        // Losers from winners bracket → drop to losers bracket
        // Winners from losers bracket → advance within losers bracket
        // Losers bracket champion → grand finals

        throw new Error('Double Elimination advancement is not yet implemented')
    },

    validate(proposal: BracketProposal): { valid: boolean; errors: string[] } {
        return { valid: false, errors: ['Double Elimination validation not yet implemented'] }
    },
}
