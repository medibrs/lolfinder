/**
 * SwissBracketData — the single source of truth for Swiss bracket rendering.
 *
 * Built server-side or in BracketManager from real DB data (participants,
 * matches, tournament settings).  The preview component consumes this
 * object and never fetches anything itself.
 */

// ─── Team Info ──────────────────────────────────────────────────────
export interface SwissTeam {
    id: string
    name: string
    team_avatar?: number
    seed: number
    wins: number
    losses: number
    draws: number
    swissScore: number
    buchholzScore: number
    opponentsPlayed: string[]
    status: 'active' | 'qualified' | 'eliminated'
}

// ─── Match Info ─────────────────────────────────────────────────────
export interface SwissMatch {
    id: string
    matchNumber: number
    roundNumber: number
    team1Id: string | null
    team2Id: string | null
    winnerId: string | null
    team1Score: number
    team2Score: number
    status: 'Scheduled' | 'In_Progress' | 'Completed'
    result: string | null
    bestOf: number
}

// ─── Round Info ─────────────────────────────────────────────────────
export interface SwissRound {
    roundNumber: number
    status: 'completed' | 'in_progress' | 'upcoming'
    matches: SwissMatch[]
}

// ─── Bucket — teams grouped by W-L after a round ───────────────────
export interface SwissBucket {
    record: string        // e.g. "2-1"
    wins: number
    losses: number
    type: 'match' | 'qualified' | 'eliminated'
    teamIds: string[]
}

// ─── Settings ───────────────────────────────────────────────────────
export interface SwissSettings {
    tournamentId: string
    totalRounds: number
    maxWins: number
    maxLosses: number
    currentRound: number
    enableTopCut: boolean
    topCutSize: number
    pointsPerWin: number
    pointsPerDraw: number
    pointsPerLoss: number
}

// ─── The One Object ─────────────────────────────────────────────────
export interface SwissBracketData {
    settings: SwissSettings
    teams: Record<string, SwissTeam>
    rounds: SwissRound[]
    standings: SwissTeam[]
}

// ────────────────────────────────────────────────────────────────────
// Builder: turns raw DB data into SwissBracketData
// ────────────────────────────────────────────────────────────────────

interface RawParticipant {
    id: string
    team_id: string
    seed_number: number
    is_active: boolean
    swiss_score?: number
    tiebreaker_points?: number
    buchholz_score?: number
    opponents_played?: string[]
    team?: {
        id: string
        name: string
        team_avatar?: number
        average_rank?: string
    }
}

interface RawMatch {
    id: string
    match_number: number
    team1_id: string | null
    team2_id: string | null
    winner_id: string | null
    team1_score: number
    team2_score: number
    status: string
    result: string | null
    best_of: number
    bracket?: {
        round_number: number
        bracket_position: number
        is_final: boolean
    }
}

interface RawTournament {
    id: string
    swiss_rounds?: number
    current_round?: number
    total_rounds?: number
    enable_top_cut?: boolean
    top_cut_size?: number
    swiss_points_per_win?: number
    swiss_points_per_draw?: number
    swiss_points_per_loss?: number
}

export function buildSwissBracketData(
    tournament: RawTournament,
    participants: RawParticipant[],
    matches: RawMatch[]
): SwissBracketData {
    const totalRounds = tournament.swiss_rounds || tournament.total_rounds || 5
    const currentRound = tournament.current_round || 1
    const maxWins = 3
    const maxLosses = 3

    const settings: SwissSettings = {
        tournamentId: tournament.id,
        totalRounds,
        maxWins,
        maxLosses,
        currentRound,
        enableTopCut: tournament.enable_top_cut || false,
        topCutSize: tournament.top_cut_size || 8,
        pointsPerWin: tournament.swiss_points_per_win || 3,
        pointsPerDraw: tournament.swiss_points_per_draw || 1,
        pointsPerLoss: tournament.swiss_points_per_loss || 0,
    }

    // ── Build team lookup ───────────────────────────────────────────
    const teamsMap: Record<string, SwissTeam> = {}

    for (const p of participants) {
        teamsMap[p.team_id] = {
            id: p.team_id,
            name: p.team?.name || 'Unknown',
            team_avatar: p.team?.team_avatar,
            seed: p.seed_number,
            wins: 0,
            losses: 0,
            draws: 0,
            swissScore: p.swiss_score || 0,
            buchholzScore: p.buchholz_score || 0,
            opponentsPlayed: p.opponents_played || [],
            status: p.is_active ? 'active' : 'eliminated',
        }
    }

    // ── Group matches by round ──────────────────────────────────────
    const matchesByRound: Record<number, RawMatch[]> = {}
    for (const m of matches) {
        const rn = m.bracket?.round_number || 1
        if (!matchesByRound[rn]) matchesByRound[rn] = []
        matchesByRound[rn].push(m)
    }

    // ── Calculate W/L per team from match results ───────────────────
    for (const m of matches) {
        if (m.status !== 'Completed' || !m.result) continue

        if (m.result === 'Team1_Win' && m.team1_id && teamsMap[m.team1_id]) {
            teamsMap[m.team1_id].wins++
            if (m.team2_id && teamsMap[m.team2_id]) teamsMap[m.team2_id].losses++
        } else if (m.result === 'Team2_Win' && m.team2_id && teamsMap[m.team2_id]) {
            teamsMap[m.team2_id].wins++
            if (m.team1_id && teamsMap[m.team1_id]) teamsMap[m.team1_id].losses++
        } else if (m.result === 'Draw') {
            if (m.team1_id && teamsMap[m.team1_id]) teamsMap[m.team1_id].draws++
            if (m.team2_id && teamsMap[m.team2_id]) teamsMap[m.team2_id].draws++
        }
    }

    // ── Mark qualified / eliminated ─────────────────────────────────
    for (const team of Object.values(teamsMap)) {
        if (team.wins >= maxWins) team.status = 'qualified'
        else if (team.losses >= maxLosses) team.status = 'eliminated'
        else team.status = 'active'
    }

    // ── Build rounds array ──────────────────────────────────────────
    const rounds: SwissRound[] = []

    for (let r = 1; r <= totalRounds; r++) {
        const roundMatches = matchesByRound[r] || []

        let status: 'completed' | 'in_progress' | 'upcoming'
        if (r < currentRound) {
            status = 'completed'
        } else if (r === currentRound) {
            const allCompleted = roundMatches.length > 0 && roundMatches.every(m => m.status === 'Completed')
            status = allCompleted ? 'completed' : (roundMatches.length > 0 ? 'in_progress' : 'upcoming')
        } else {
            status = 'upcoming'
        }

        rounds.push({
            roundNumber: r,
            status,
            matches: roundMatches.map(m => ({
                id: m.id,
                matchNumber: m.match_number,
                roundNumber: r,
                team1Id: m.team1_id,
                team2Id: m.team2_id,
                winnerId: m.winner_id,
                team1Score: m.team1_score || 0,
                team2Score: m.team2_score || 0,
                status: m.status as 'Scheduled' | 'In_Progress' | 'Completed',
                result: m.result,
                bestOf: m.best_of || 1,
            }))
        })
    }

    // ── Build standings ─────────────────────────────────────────────
    const standings = Object.values(teamsMap).sort((a, b) => {
        // Sort by: wins desc, then losses asc, then swiss score desc, then seed asc
        if (b.wins !== a.wins) return b.wins - a.wins
        if (a.losses !== b.losses) return a.losses - b.losses
        if (b.swissScore !== a.swissScore) return b.swissScore - a.swissScore
        return a.seed - b.seed
    })

    return { settings, teams: teamsMap, rounds, standings }
}
