import { NextRequest, NextResponse } from 'next/server'
import { computeRoundRobinStandings } from '@/lib/tournament/rr-service'
import { computeRRDEStandings } from '@/lib/tournament/rr-de-service'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper: resolve tournament ID (supports both UUID and tournament_number)
async function resolveTournament(id: string): Promise<{ id: string; format: string } | null> {
    const isNumber = /^\d+$/.test(id)
    let q = supabase.from('tournaments').select('id, format')
    if (isNumber) q = q.eq('tournament_number', parseInt(id))
    else q = q.eq('id', id)
    const { data } = await q.single()
    return data ? { id: data.id, format: data.format } : null
}

// GET /api/tournaments/[id]/rr-standings
// Returns group standings + per-team match history
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const tournament = await resolveTournament(id)
        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
        }
        const tournamentId = tournament.id

        // Get computed standings — use correct service based on format
        const result = tournament.format === 'RR_Double_Elim'
            ? await computeRRDEStandings(tournamentId)
            : await computeRoundRobinStandings(tournamentId)

        // Enrich with per-team match data for the expandable UI
        // Load all matches + team info
        const { data: rawMatches } = await supabase
            .from('tournament_matches')
            .select('id, team1_id, team2_id, winner_id, result, status, bracket_id, team1_score, team2_score, best_of')
            .eq('tournament_id', tournamentId)

        // Load brackets for round numbers
        const { data: brackets } = await supabase
            .from('tournament_brackets')
            .select('id, round_number, bracket_position')
            .eq('tournament_id', tournamentId)

        const bracketMap: Record<string, { round_number: number; bracket_position: number }> = {}
        for (const b of brackets || []) {
            bracketMap[b.id] = { round_number: b.round_number, bracket_position: b.bracket_position }
        }

        // Playoff bracket positions to exclude from group standings
        const PLAYOFF_POSITIONS = new Set([101, 102, 103, 111, 112, 113, 114, 121])

        // Load team info
        const { data: participants } = await supabase
            .from('tournament_participants')
            .select('team_id, group_id, team:teams(id, name, team_avatar)')
            .eq('tournament_id', tournamentId)

        const teamInfo: Record<string, { name: string; team_avatar?: string | number }> = {}
        for (const p of participants || []) {
            const team = (p as any).team
            if (team) {
                teamInfo[p.team_id] = { name: team.name, team_avatar: team.team_avatar }
            }
        }

        // Build per-team match history
        const teamMatches: Record<string, any[]> = {}
        for (const m of rawMatches || []) {
            if (!m.team1_id || !m.team2_id) continue // skip byes
            const bracketInfo = bracketMap[m.bracket_id]
            const roundNumber = bracketInfo?.round_number || 0
            // Skip playoff matches for RR_Double_Elim
            if (tournament.format === 'RR_Double_Elim' && bracketInfo && PLAYOFF_POSITIONS.has(bracketInfo.bracket_position)) continue

            const matchEntry = (teamId: string, opponentId: string, isTeam1: boolean) => {
                if (!teamMatches[teamId]) teamMatches[teamId] = []
                const myScore = isTeam1 ? m.team1_score : m.team2_score
                const oppScore = isTeam1 ? m.team2_score : m.team1_score
                const won = m.winner_id === teamId
                const lost = m.winner_id && m.winner_id !== teamId
                teamMatches[teamId].push({
                    match_id: m.id,
                    round_number: roundNumber,
                    opponent_id: opponentId,
                    opponent_name: teamInfo[opponentId]?.name || 'Unknown',
                    opponent_avatar: teamInfo[opponentId]?.team_avatar,
                    my_score: myScore ?? 0,
                    opp_score: oppScore ?? 0,
                    result: won ? 'win' : lost ? 'loss' : m.result === 'Draw' ? 'draw' : 'pending',
                    status: m.status,
                    best_of: m.best_of || 1,
                })
            }

            matchEntry(m.team1_id, m.team2_id, true)
            matchEntry(m.team2_id, m.team1_id, false)
        }

        // Enrich standings with team info and match history
        for (const group of result.groups) {
            for (const standing of group.standings) {
                const info = teamInfo[standing.team_id]
                    ; (standing as any).team_name = info?.name || 'Unknown'
                    ; (standing as any).team_avatar = info?.team_avatar
                    ; (standing as any).matches = (teamMatches[standing.team_id] || [])
                        .sort((a: any, b: any) => a.round_number - b.round_number)
            }
        }

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Error computing RR standings:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to compute standings' },
            { status: 500 }
        )
    }
}
