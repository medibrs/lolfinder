/**
 * rr-core.ts — Pure Logic for Round Robin Tournament Format
 *
 * RULES:
 *   ❌ NO database imports
 *   ❌ NO side effects
 *   ❌ NO API calls
 *   ✅ Pure functions only
 *   ✅ Receives data, returns structured output
 *
 * Teams are split into groups (snake draft by seed).
 * Within each group, every team plays every other team once (Bo1).
 * Standings are computed by points (W=3, D=1, L=0).
 */

// ─── Input Types ────────────────────────────────────────────────────

export interface RRConfig {
    group_count: number
    points_per_win: number
    points_per_draw: number
    points_per_loss: number
}

export interface RRTeamInput {
    team_id: string
    seed_number: number
    team_name?: string
}

// ─── Output Types ───────────────────────────────────────────────────

export interface RRGroupAssignment {
    team_id: string
    seed_number: number
    group_id: number       // 0-indexed
    group_name: string     // "Group A", "Group B", etc.
}

export interface RRMatchPairing {
    team1_id: string
    team2_id: string | null  // null = bye
    round_number: number
    group_id: number
    is_bye: boolean
}

export interface RRStanding {
    team_id: string
    group_id: number
    group_name: string
    wins: number
    losses: number
    draws: number
    points: number
    matches_played: number
    point_differential: number   // total score_for - score_against
    rank: number                 // 1-indexed within group
    seed_number: number
}

export interface RRMatchInput {
    id: string
    team1_id: string | null
    team2_id: string | null
    winner_id: string | null
    result: string | null    // 'Team1_Win' | 'Team2_Win' | 'Draw' | null
    status: string           // 'Scheduled' | 'In_Progress' | 'Completed'
    round_number: number
    group_id: number
    team1_score?: number
    team2_score?: number
}

export interface RRScheduleProposal {
    group_count: number
    total_rounds: number
    groups: {
        group_id: number
        group_name: string
        team_ids: string[]
    }[]
    pairings: RRMatchPairing[]
    metadata: {
        generated_at: string
        team_count: number
        bye_count: number
        total_matches: number
    }
}

// ─── Constants ──────────────────────────────────────────────────────

const GROUP_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function groupName(groupId: number): string {
    return `Group ${GROUP_LABELS[groupId] || groupId}`
}

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Assign teams to groups using snake-draft by seed.
 *
 * Example with 8 teams, 2 groups:
 *   Seed 1 → A, Seed 2 → B, Seed 3 → B, Seed 4 → A,
 *   Seed 5 → A, Seed 6 → B, Seed 7 → B, Seed 8 → A
 *
 * This ensures each group has balanced strength.
 */
export function assignGroups(
    teams: RRTeamInput[],
    groupCount: number
): RRGroupAssignment[] {
    const sorted = [...teams].sort((a, b) => a.seed_number - b.seed_number)
    const assignments: RRGroupAssignment[] = []

    for (let i = 0; i < sorted.length; i++) {
        // Snake draft: forward on even passes, backward on odd
        const pass = Math.floor(i / groupCount)
        const posInPass = i % groupCount
        const gid = pass % 2 === 0 ? posInPass : groupCount - 1 - posInPass

        assignments.push({
            team_id: sorted[i].team_id,
            seed_number: sorted[i].seed_number,
            group_id: gid,
            group_name: groupName(gid),
        })
    }

    return assignments
}

/**
 * Generate a round robin schedule for a single group using the circle method.
 *
 * For N teams (N even):
 *   - Fix team[0], rotate the rest
 *   - N-1 rounds, each team plays once per round
 *
 * For N teams (N odd):
 *   - Add a dummy "BYE" slot, making it N+1
 *   - Any team paired with BYE gets a bye that round
 */
export function generateGroupSchedule(
    teamIds: string[],
    groupId: number
): RRMatchPairing[] {
    if (teamIds.length < 2) return []

    const pairings: RRMatchPairing[] = []
    const teams = [...teamIds]

    // If odd number of teams, add a BYE placeholder
    const hasBye = teams.length % 2 !== 0
    if (hasBye) {
        teams.push('__BYE__')
    }

    const n = teams.length
    const rounds = n - 1

    // Circle method: fix first team, rotate the rest
    for (let round = 0; round < rounds; round++) {
        const roundNumber = round + 1

        for (let i = 0; i < n / 2; i++) {
            const home = teams[i]
            const away = teams[n - 1 - i]

            if (home === '__BYE__' || away === '__BYE__') {
                // The real team gets a bye
                const realTeam = home === '__BYE__' ? away : home
                pairings.push({
                    team1_id: realTeam,
                    team2_id: null,
                    round_number: roundNumber,
                    group_id: groupId,
                    is_bye: true,
                })
            } else {
                pairings.push({
                    team1_id: home,
                    team2_id: away,
                    round_number: roundNumber,
                    group_id: groupId,
                    is_bye: false,
                })
            }
        }

        // Rotate: keep teams[0] fixed, rotate the rest clockwise
        const last = teams.pop()!
        teams.splice(1, 0, last)
    }

    return pairings
}

/**
 * Generate full schedule across all groups.
 */
export function generateAllGroupSchedules(
    assignments: RRGroupAssignment[],
    config: RRConfig
): RRScheduleProposal {
    // Group assignments by group_id
    const groupMap = new Map<number, RRGroupAssignment[]>()
    for (const a of assignments) {
        if (!groupMap.has(a.group_id)) groupMap.set(a.group_id, [])
        groupMap.get(a.group_id)!.push(a)
    }

    const allPairings: RRMatchPairing[] = []
    const groups: RRScheduleProposal['groups'] = []
    let totalByes = 0
    let maxRounds = 0

    // Sort groups by ID for consistency
    const sortedGroupIds = [...groupMap.keys()].sort((a, b) => a - b)

    for (const gid of sortedGroupIds) {
        const groupTeams = groupMap.get(gid)!
        const teamIds = groupTeams
            .sort((a, b) => a.seed_number - b.seed_number)
            .map(t => t.team_id)

        groups.push({
            group_id: gid,
            group_name: groupName(gid),
            team_ids: teamIds,
        })

        const groupPairings = generateGroupSchedule(teamIds, gid)
        allPairings.push(...groupPairings)

        const groupByes = groupPairings.filter(p => p.is_bye).length
        totalByes += groupByes

        const groupRounds = teamIds.length % 2 === 0
            ? teamIds.length - 1
            : teamIds.length  // odd: N teams → N rounds (with bye placeholder making it N+1, so N rounds)
        maxRounds = Math.max(maxRounds, groupRounds)
    }

    // Sort to interleave matches chronologically across groups
    allPairings.sort((a, b) => {
        if (a.round_number !== b.round_number) {
            return a.round_number - b.round_number
        }
        return a.group_id - b.group_id
    })

    return {
        group_count: config.group_count,
        total_rounds: maxRounds,
        groups,
        pairings: allPairings,
        metadata: {
            generated_at: new Date().toISOString(),
            team_count: assignments.length,
            bye_count: totalByes,
            total_matches: allPairings.filter(p => !p.is_bye).length,
        },
    }
}

/**
 * Compute the total number of rounds needed.
 * For a group of N teams: N-1 rounds (N even) or N rounds (N odd, with byes).
 */
export function computeTotalRounds(groupSizes: number[]): number {
    let maxRounds = 0
    for (const size of groupSizes) {
        const rounds = size % 2 === 0 ? size - 1 : size
        maxRounds = Math.max(maxRounds, rounds)
    }
    return maxRounds
}

/**
 * Compute standings for all groups from completed matches.
 *
 * Tiebreaker order:
 *   1. Points (descending)
 *   2. Head-to-head result
 *   3. Seed number (ascending = higher seed wins)
 */
export function computeStandings(
    assignments: RRGroupAssignment[],
    matches: RRMatchInput[],
    config: RRConfig
): RRStanding[] {
    // Initialize standings
    const standingsMap = new Map<string, RRStanding>()
    for (const a of assignments) {
        standingsMap.set(a.team_id, {
            team_id: a.team_id,
            group_id: a.group_id,
            group_name: a.group_name,
            wins: 0,
            losses: 0,
            draws: 0,
            points: 0,
            matches_played: 0,
            point_differential: 0,
            rank: 0,
            seed_number: a.seed_number,
        })
    }

    // Process completed matches
    const completedMatches = matches.filter(m => m.status === 'Completed' && m.result)

    for (const m of completedMatches) {
        if (!m.team1_id || !m.team2_id) continue  // skip byes

        const t1 = standingsMap.get(m.team1_id)
        const t2 = standingsMap.get(m.team2_id)
        if (!t1 || !t2) continue

        t1.matches_played++
        t2.matches_played++

        if (m.result === 'Team1_Win') {
            t1.wins++
            t1.points += config.points_per_win
            t2.losses++
            t2.points += config.points_per_loss
        } else if (m.result === 'Team2_Win') {
            t2.wins++
            t2.points += config.points_per_win
            t1.losses++
            t1.points += config.points_per_loss
        } else if (m.result === 'Draw') {
            t1.draws++
            t1.points += config.points_per_draw
            t2.draws++
            t2.points += config.points_per_draw
        }
    }

    // Build head-to-head lookup for tiebreaking
    const h2h = new Map<string, number>()  // key: "teamA|teamB" → +1 if A beat B, -1 if B beat A, 0 draw
    for (const m of completedMatches) {
        if (!m.team1_id || !m.team2_id) continue
        const key1 = `${m.team1_id}|${m.team2_id}`
        const key2 = `${m.team2_id}|${m.team1_id}`
        if (m.result === 'Team1_Win') {
            h2h.set(key1, 1)
            h2h.set(key2, -1)
        } else if (m.result === 'Team2_Win') {
            h2h.set(key1, -1)
            h2h.set(key2, 1)
        } else {
            h2h.set(key1, 0)
            h2h.set(key2, 0)
        }
    }

    // Group standings by group_id and rank
    const allStandings = [...standingsMap.values()]
    const byGroup = new Map<number, RRStanding[]>()
    for (const s of allStandings) {
        if (!byGroup.has(s.group_id)) byGroup.set(s.group_id, [])
        byGroup.get(s.group_id)!.push(s)
    }

    const result: RRStanding[] = []
    for (const [, groupStandings] of byGroup) {
        // Sort by: points DESC → h2h → seed ASC
        groupStandings.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points

            // Head-to-head
            const h2hResult = h2h.get(`${a.team_id}|${b.team_id}`)
            if (h2hResult !== undefined && h2hResult !== 0) return -h2hResult  // positive = a won

            // Seed (lower = better)
            return a.seed_number - b.seed_number
        })

        // Assign ranks
        for (let i = 0; i < groupStandings.length; i++) {
            groupStandings[i].rank = i + 1
        }
        result.push(...groupStandings)
    }

    return result
}

/**
 * Validate a Round Robin schedule.
 */
export function validateSchedule(
    proposal: RRScheduleProposal,
    teamCount: number
): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (proposal.groups.length === 0) {
        errors.push('No groups generated')
    }

    // Check all teams appear in exactly one group
    const allTeamIds = new Set<string>()
    for (const g of proposal.groups) {
        for (const tid of g.team_ids) {
            if (allTeamIds.has(tid)) {
                errors.push(`Team ${tid} appears in multiple groups`)
            }
            allTeamIds.add(tid)
        }
    }

    if (allTeamIds.size !== teamCount) {
        errors.push(`Expected ${teamCount} teams in groups, found ${allTeamIds.size}`)
    }

    // Check no team plays itself
    for (const p of proposal.pairings) {
        if (!p.is_bye && p.team1_id === p.team2_id) {
            errors.push(`Team ${p.team1_id} paired against itself`)
        }
    }

    return { valid: errors.length === 0, errors }
}
