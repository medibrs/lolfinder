/**
 * rr-de-core.ts — Pure Logic for Round Robin → Double Elimination Format
 *
 * RULES:
 *   ❌ NO database imports
 *   ❌ NO side effects
 *   ✅ Pure functions only
 *
 * Structure:
 *   Phase 1 — Single Round Robin (1 group, every team plays every other once)
 *   Phase 2 — Double Elimination Playoffs
 *     • Top 4 → Winners Bracket
 *     • 5th–6th → Losers Bracket Round 1
 *     • 7th+ → Eliminated
 *
 * Supports 8–12 teams.
 */

import {
    generateGroupSchedule,
    computeStandings,
    type RRConfig,
    type RRTeamInput,
    type RRGroupAssignment,
    type RRMatchPairing,
    type RRMatchInput,
    type RRStanding,
} from './rr-core'

// ─── Constants ──────────────────────────────────────────────────────

export const WB_ADVANCE = 4   // top 4 → winners bracket
export const LB_ADVANCE = 2   // 5th–6th → losers bracket R1
export const MIN_TEAMS = 8
export const MAX_TEAMS = 12

/** Bracket position ranges to distinguish WB / LB / GF.
 *  Starts at 101 to avoid collision with group stage positions (up to ~66 for 12 teams). */
export const POS = {
    WB_SEMI_1: 101,
    WB_SEMI_2: 102,
    WB_FINAL: 103,
    LB_R1_1: 111,
    LB_R1_2: 112,
    LB_SEMI: 113,
    LB_FINAL: 114,
    GRAND_FINAL: 121,
} as const

// ─── Types ──────────────────────────────────────────────────────────

export interface RRDEConfig {
    points_per_win: number
    points_per_draw: number
    points_per_loss: number
    group_best_of: number
    wb_best_of: number
    lb_best_of: number
    finals_best_of: number
}

export interface RRDEGroupProposal {
    total_rounds: number
    pairings: RRMatchPairing[]
    metadata: {
        generated_at: string
        team_count: number
        bye_count: number
        total_matches: number
    }
}

export interface PlayoffMatchSlot {
    bracket_position: number
    round_offset: number      // 1-based offset within playoff phase
    team1_id: string | null
    team2_id: string | null
    best_of: number
    label: string             // e.g. "WB Semi 1", "LB Final", "Grand Final"
    bracket_type: 'WB' | 'LB' | 'GF'
}

export interface PlayoffProposal {
    total_playoff_rounds: number
    matches: PlayoffMatchSlot[]
    metadata: {
        generated_at: string
        wb_teams: number
        lb_teams: number
        eliminated: number
    }
}

export interface PlayoffAdvancement {
    target_bracket_position: number
    target_round_offset: number
    slot: 'team1_id' | 'team2_id'
    team_id: string
}

export interface PlayoffAdvancementResult {
    advancements: PlayoffAdvancement[]
    tournament_completed: boolean
}

// ─── Group Stage ────────────────────────────────────────────────────

/**
 * Generate a single-group round robin schedule.
 * All teams in one group, each plays every other once.
 */
export function generateRRDEGroupSchedule(
    teams: RRTeamInput[]
): RRDEGroupProposal {
    if (teams.length < MIN_TEAMS) {
        throw new Error(`RR+DE requires at least ${MIN_TEAMS} teams, got ${teams.length}`)
    }

    const teamIds = [...teams]
        .sort((a, b) => a.seed_number - b.seed_number)
        .map(t => t.team_id)

    const pairings = generateGroupSchedule(teamIds, 0) // group_id = 0

    const totalRounds = teamIds.length % 2 === 0
        ? teamIds.length - 1
        : teamIds.length

    return {
        total_rounds: totalRounds,
        pairings,
        metadata: {
            generated_at: new Date().toISOString(),
            team_count: teams.length,
            bye_count: pairings.filter(p => p.is_bye).length,
            total_matches: pairings.filter(p => !p.is_bye).length,
        },
    }
}

/**
 * Compute group stage standings (reuse RR core).
 */
export function computeRRDEStandings(
    teams: RRTeamInput[],
    assignments: RRGroupAssignment[],
    matches: RRMatchInput[],
    config: RRDEConfig
): RRStanding[] {
    const rrConfig: RRConfig = {
        group_count: 1,
        points_per_win: config.points_per_win,
        points_per_draw: config.points_per_draw,
        points_per_loss: config.points_per_loss,
    }
    return computeStandings(assignments, matches, rrConfig)
}

// ─── Playoff Bracket Generation ─────────────────────────────────────

/**
 * Generate the double-elimination playoff bracket from final standings.
 *
 * Rankings (1-indexed):
 *   #1 vs #4 → WB Semi 1
 *   #2 vs #3 → WB Semi 2
 *   #5 vs ? (loser WB Semi 1) → LB R1 M1
 *   #6 vs ? (loser WB Semi 2) → LB R1 M2
 *
 * Playoff rounds (offsets):
 *   1: WB Semis (2 matches)
 *   2: LB R1 (2 matches) — seeded teams vs WB losers
 *   3: WB Final + LB Semi
 *   4: LB Final
 *   5: Grand Final
 */
export function generatePlayoffBracket(
    rankedTeams: { team_id: string; rank: number }[],
    config: RRDEConfig
): PlayoffProposal {
    if (rankedTeams.length < 6) {
        throw new Error('Need at least 6 ranked teams for playoffs')
    }

    // Sort by rank ascending
    const sorted = [...rankedTeams].sort((a, b) => a.rank - b.rank)
    const seed1 = sorted[0].team_id
    const seed2 = sorted[1].team_id
    const seed3 = sorted[2].team_id
    const seed4 = sorted[3].team_id
    const seed5 = sorted[4].team_id
    const seed6 = sorted[5].team_id

    const matches: PlayoffMatchSlot[] = [
        // Round 1: WB Semis
        {
            bracket_position: POS.WB_SEMI_1,
            round_offset: 1,
            team1_id: seed1,
            team2_id: seed4,
            best_of: config.wb_best_of,
            label: 'WB Semi 1',
            bracket_type: 'WB',
        },
        {
            bracket_position: POS.WB_SEMI_2,
            round_offset: 1,
            team1_id: seed2,
            team2_id: seed3,
            best_of: config.wb_best_of,
            label: 'WB Semi 2',
            bracket_type: 'WB',
        },
        // Round 2: LB R1 — #5/#6 seeded, losers from WB Semis TBD
        {
            bracket_position: POS.LB_R1_1,
            round_offset: 2,
            team1_id: seed5,
            team2_id: null, // loser of WB Semi 1
            best_of: config.lb_best_of,
            label: 'LB Round 1-1',
            bracket_type: 'LB',
        },
        {
            bracket_position: POS.LB_R1_2,
            round_offset: 2,
            team1_id: seed6,
            team2_id: null, // loser of WB Semi 2
            best_of: config.lb_best_of,
            label: 'LB Round 1-2',
            bracket_type: 'LB',
        },
        // Round 3: WB Final + LB Semi
        {
            bracket_position: POS.WB_FINAL,
            round_offset: 3,
            team1_id: null, // winner of WB Semi 1
            team2_id: null, // winner of WB Semi 2
            best_of: config.wb_best_of,
            label: 'WB Final',
            bracket_type: 'WB',
        },
        {
            bracket_position: POS.LB_SEMI,
            round_offset: 3,
            team1_id: null, // winner of LB R1-1
            team2_id: null, // winner of LB R1-2
            best_of: config.lb_best_of,
            label: 'LB Semi',
            bracket_type: 'LB',
        },
        // Round 4: LB Final
        {
            bracket_position: POS.LB_FINAL,
            round_offset: 4,
            team1_id: null, // loser of WB Final
            team2_id: null, // winner of LB Semi
            best_of: config.lb_best_of,
            label: 'LB Final',
            bracket_type: 'LB',
        },
        // Round 5: Grand Final
        {
            bracket_position: POS.GRAND_FINAL,
            round_offset: 5,
            team1_id: null, // winner of WB Final
            team2_id: null, // winner of LB Final
            best_of: config.finals_best_of,
            label: 'Grand Final',
            bracket_type: 'GF',
        },
    ]

    const eliminatedCount = rankedTeams.length - WB_ADVANCE - LB_ADVANCE

    return {
        total_playoff_rounds: 5,
        matches,
        metadata: {
            generated_at: new Date().toISOString(),
            wb_teams: WB_ADVANCE,
            lb_teams: LB_ADVANCE,
            eliminated: eliminatedCount,
        },
    }
}

// ─── Playoff Advancement ────────────────────────────────────────────

/**
 * Advancement mapping for double elimination playoffs.
 *
 * Each entry: source bracket_position → what happens to winner / loser.
 */
interface AdvancementRule {
    source_position: number
    winner_target_position: number
    winner_target_slot: 'team1_id' | 'team2_id'
    loser_target_position?: number
    loser_target_slot?: 'team1_id' | 'team2_id'
}

const ADVANCEMENT_RULES: AdvancementRule[] = [
    // WB Semi 1 → winner to WB Final team1, loser to LB R1-1 team2
    {
        source_position: POS.WB_SEMI_1,
        winner_target_position: POS.WB_FINAL,
        winner_target_slot: 'team1_id',
        loser_target_position: POS.LB_R1_1,
        loser_target_slot: 'team2_id',
    },
    // WB Semi 2 → winner to WB Final team2, loser to LB R1-2 team2
    {
        source_position: POS.WB_SEMI_2,
        winner_target_position: POS.WB_FINAL,
        winner_target_slot: 'team2_id',
        loser_target_position: POS.LB_R1_2,
        loser_target_slot: 'team2_id',
    },
    // LB R1-1 → winner to LB Semi team1
    {
        source_position: POS.LB_R1_1,
        winner_target_position: POS.LB_SEMI,
        winner_target_slot: 'team1_id',
    },
    // LB R1-2 → winner to LB Semi team2
    {
        source_position: POS.LB_R1_2,
        winner_target_position: POS.LB_SEMI,
        winner_target_slot: 'team2_id',
    },
    // WB Final → winner to Grand Final team1, loser to LB Final team1
    {
        source_position: POS.WB_FINAL,
        winner_target_position: POS.GRAND_FINAL,
        winner_target_slot: 'team1_id',
        loser_target_position: POS.LB_FINAL,
        loser_target_slot: 'team1_id',
    },
    // LB Semi → winner to LB Final team2
    {
        source_position: POS.LB_SEMI,
        winner_target_position: POS.LB_FINAL,
        winner_target_slot: 'team2_id',
    },
    // LB Final → winner to Grand Final team2
    {
        source_position: POS.LB_FINAL,
        winner_target_position: POS.GRAND_FINAL,
        winner_target_slot: 'team2_id',
    },
    // Grand Final → no advancement (tournament over)
]

/**
 * Given newly completed playoff matches, compute which teams should
 * be placed into which future match slots.
 */
export function computePlayoffAdvancements(
    completedMatches: {
        bracket_position: number
        team1_id: string | null
        team2_id: string | null
        winner_id: string | null
        status: string
    }[],
    playoffRoundOffset: number
): PlayoffAdvancementResult {
    const advancements: PlayoffAdvancement[] = []

    const completed = completedMatches.filter(m => m.status === 'Completed' && m.winner_id)

    for (const match of completed) {
        const rules = ADVANCEMENT_RULES.filter(r => r.source_position === match.bracket_position)
        if (rules.length === 0) continue

        for (const rule of rules) {
            const winnerId = match.winner_id!
            const loserId = match.team1_id === winnerId ? match.team2_id : match.team1_id

            // Winner advancement
            advancements.push({
                target_bracket_position: rule.winner_target_position,
                target_round_offset: getPlayoffRoundForPosition(rule.winner_target_position),
                slot: rule.winner_target_slot,
                team_id: winnerId,
            })

            // Loser advancement (if applicable — WB losers drop to LB)
            if (rule.loser_target_position && rule.loser_target_slot && loserId) {
                advancements.push({
                    target_bracket_position: rule.loser_target_position,
                    target_round_offset: getPlayoffRoundForPosition(rule.loser_target_position),
                    slot: rule.loser_target_slot,
                    team_id: loserId,
                })
            }
        }
    }

    // Tournament is complete when Grand Final has a winner
    const grandFinal = completed.find(m => m.bracket_position === POS.GRAND_FINAL)
    const tournament_completed = !!grandFinal?.winner_id

    return { advancements, tournament_completed }
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Map bracket_position to its playoff round offset */
function getPlayoffRoundForPosition(pos: number): number {
    switch (pos) {
        case POS.WB_SEMI_1:
        case POS.WB_SEMI_2:
            return 1
        case POS.LB_R1_1:
        case POS.LB_R1_2:
            return 2
        case POS.WB_FINAL:
        case POS.LB_SEMI:
            return 3
        case POS.LB_FINAL:
            return 4
        case POS.GRAND_FINAL:
            return 5
        default:
            return 0
    }
}

/** Get a human-readable label for a playoff bracket position */
export function getPlayoffMatchLabel(pos: number): string {
    switch (pos) {
        case POS.WB_SEMI_1: return 'WB Semi 1'
        case POS.WB_SEMI_2: return 'WB Semi 2'
        case POS.WB_FINAL: return 'WB Final'
        case POS.LB_R1_1: return 'LB Round 1-1'
        case POS.LB_R1_2: return 'LB Round 1-2'
        case POS.LB_SEMI: return 'LB Semi'
        case POS.LB_FINAL: return 'LB Final'
        case POS.GRAND_FINAL: return 'Grand Final'
        default: return `Match ${pos}`
    }
}

/** Get bracket type from position */
export function getBracketType(pos: number): 'WB' | 'LB' | 'GF' | 'GROUP' {
    if (pos >= 101 && pos <= 110) return 'WB'
    if (pos >= 111 && pos <= 120) return 'LB'
    if (pos === 121) return 'GF'
    return 'GROUP'
}

/** Check if all group stage matches are complete */
export function isGroupStageComplete(
    matches: { status: string; bracket_position?: number }[],
    rrTotalRounds: number
): boolean {
    // Group stage matches have bracket_position in normal range (not playoff positions)
    const groupMatches = matches.filter(m => {
        const pos = m.bracket_position ?? 0
        return pos < POS.WB_SEMI_1 || pos > POS.GRAND_FINAL
    })
    return groupMatches.length > 0 && groupMatches.every(m => m.status === 'Completed')
}
