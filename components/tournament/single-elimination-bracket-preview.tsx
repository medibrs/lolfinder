'use client'

import { useState, useEffect } from 'react'
import { SwissMatchCard, SwissMatchCardTeam } from '@/components/ui/swiss-match-card'
import { cn } from '@/lib/utils'
import { TitleCard } from '@/components/ui/title-card'
import { useIsMobile } from '@/hooks/use-mobile'

interface Team {
    id: string
    name: string
    team_avatar?: number
}

interface SingleElimMatch {
    id: string
    team1: SwissMatchCardTeam | null
    team2: SwissMatchCardTeam | null
    status: 'live' | 'scheduled' | 'done'
    winner?: 'team1' | 'team2' | null
}

interface SingleElimRound {
    title: string
    matches: SingleElimMatch[]
}

interface SingleElimFormatData {
    rounds: SingleElimRound[]
}

// Raw match data from the API
interface RawMatch {
    id: string
    match_number: number
    team1_id: string | null
    team2_id: string | null
    team1?: { id: string; name: string; team_avatar?: number } | null
    team2?: { id: string; name: string; team_avatar?: number } | null
    winner_id?: string | null
    status: string
    bracket?: {
        round_number: number
        bracket_position: number
        is_final?: boolean
    } | null
}

interface SingleEliminationBracketPreviewProps {
    teams: Team[]
    teamCount?: number
    /** Real match data from the tournament engine. When provided, overrides mock generation. */
    matchData?: RawMatch[]
}

function getRoundTitle(roundNum: number, totalRounds: number): string {
    const roundsFromEnd = totalRounds - roundNum
    if (roundsFromEnd === 0) return 'Grand Finals'
    if (roundsFromEnd === 1) return 'Semifinals'
    if (roundsFromEnd === 2) return 'Quarterfinals'
    return `Round ${roundNum}`
}

function buildBracketFromMatches(matches: RawMatch[], totalRounds: number): SingleElimFormatData {
    const rounds: SingleElimRound[] = []

    for (let round = 1; round <= totalRounds; round++) {
        const roundMatches = matches
            .filter(m => m.bracket?.round_number === round)
            .sort((a, b) => (a.bracket?.bracket_position || 0) - (b.bracket?.bracket_position || 0))

        const title = getRoundTitle(round, totalRounds)

        const mappedMatches: SingleElimMatch[] = roundMatches.map(m => {
            const team1: SwissMatchCardTeam | null = m.team1
                ? { id: m.team1.id, name: m.team1.name, team_avatar: m.team1.team_avatar }
                : m.team1_id
                    ? { id: m.team1_id, name: 'Unknown', team_avatar: undefined }
                    : null

            const team2: SwissMatchCardTeam | null = m.team2
                ? { id: m.team2.id, name: m.team2.name, team_avatar: m.team2.team_avatar }
                : m.team2_id
                    ? { id: m.team2_id, name: 'Unknown', team_avatar: undefined }
                    : null

            let status: 'live' | 'scheduled' | 'done' = 'scheduled'
            if (m.status === 'Completed') status = 'done'
            else if (m.status === 'In_Progress') status = 'live'

            let winner: 'team1' | 'team2' | null = null
            if (m.winner_id && m.team1_id && m.winner_id === m.team1_id) winner = 'team1'
            else if (m.winner_id && m.team2_id && m.winner_id === m.team2_id) winner = 'team2'

            // Show TBD for empty slots
            const displayTeam1 = team1 || { id: `tbd-${m.id}-1`, name: 'TBD', team_avatar: undefined }
            const displayTeam2 = team2 || { id: `tbd-${m.id}-2`, name: 'TBD', team_avatar: undefined }

            return {
                id: m.id,
                team1: displayTeam1,
                team2: displayTeam2,
                status,
                winner
            }
        })

        rounds.push({ title, matches: mappedMatches })
    }

    return { rounds }
}

function generateSingleElimBracket(teams: Team[], forceCount?: number): SingleElimFormatData {
    // Find the next power of 2 for bracket size
    const targetTeamCount = forceCount || Math.pow(2, Math.ceil(Math.log2(Math.max(2, teams.length))))

    // Create padded teams array
    const paddedTeams: (Team | null)[] = [...teams]
    while (paddedTeams.length < targetTeamCount) {
        paddedTeams.push(null)
    }

    // Shuffle or seed teams (just randomizing for preview)
    const seededTeams = [...paddedTeams].sort(() => Math.random() - 0.5)

    const rounds: SingleElimRound[] = []
    let matchesInRound = targetTeamCount / 2
    let roundNum = 1
    const totalRounds = Math.ceil(Math.log2(targetTeamCount))

    while (matchesInRound >= 1) {
        const title = getRoundTitle(roundNum, totalRounds)
        const matches: SingleElimMatch[] = []

        for (let i = 0; i < matchesInRound; i++) {
            if (roundNum === 1) {
                // First round, populate with seeds
                const t1 = seededTeams[i * 2]
                const t2 = seededTeams[i * 2 + 1]
                matches.push({
                    id: `r${roundNum}-m${i}`,
                    team1: t1 ? { ...t1 } : { id: `ph1-${i}`, name: 'BYE', team_avatar: undefined },
                    team2: t2 ? { ...t2 } : { id: `ph2-${i}`, name: 'BYE', team_avatar: undefined },
                    status: 'scheduled',
                    winner: null
                })
            } else {
                // Subsequent rounds, empty placeholders
                matches.push({
                    id: `r${roundNum}-m${i}`,
                    team1: { id: `tbd1-r${roundNum}-m${i}`, name: 'TBD', team_avatar: undefined },
                    team2: { id: `tbd2-r${roundNum}-m${i}`, name: 'TBD', team_avatar: undefined },
                    status: 'scheduled',
                    winner: null
                })
            }
        }

        rounds.push({ title, matches })
        matchesInRound = matchesInRound / 2
        roundNum++
    }

    return { rounds }
}

function BracketConnector({ isLastColumn, isMobile }: { isLastColumn: boolean, isMobile: boolean }) {
    if (isLastColumn) return null;
    return (
        <div className={cn("relative w-6 md:w-10 h-full")}>
            <div
                className={cn(
                    "absolute right-0 top-1/2 w-1/2 h-[calc(100%+0.5rem)] md:h-[calc(100%+1.5rem)] border-zinc-700",
                    "border-r-2 border-t-2 rounded-tr-lg"
                )}
                style={{ transform: 'translateY(-50%)' }}
            />
            <div
                className={cn(
                    "absolute left-0 top-1/4 w-1/2 h-0 border-zinc-700 border-t-2"
                )}
            />
            <div
                className={cn(
                    "absolute left-0 bottom-1/4 w-1/2 h-0 border-zinc-700 border-b-2"
                )}
            />
        </div>
    )
}

export function SingleEliminationBracketPreview({ teams, teamCount, matchData }: SingleEliminationBracketPreviewProps) {
    const [bracketData, setBracketData] = useState<SingleElimFormatData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const isMobile = useIsMobile()

    useEffect(() => {
        try {
            if (matchData && matchData.length > 0) {
                // Derive total rounds from the match data
                const maxRound = matchData.reduce((max, m) => {
                    const r = m.bracket?.round_number || 0
                    return r > max ? r : max
                }, 0)
                if (maxRound === 0) {
                    // No bracket data attached, fall back to mock
                    const data = generateSingleElimBracket(teams, teamCount)
                    setBracketData(data)
                } else {
                    const data = buildBracketFromMatches(matchData, maxRound)
                    setBracketData(data)
                }
            } else {
                // Fallback to mock generation for preview
                const data = generateSingleElimBracket(teams, teamCount)
                setBracketData(data)
            }
        } catch (err: any) {

            setError(err.message || 'Failed to generate bracket')
            // Fallback to mock
            try {
                const data = generateSingleElimBracket(teams, teamCount)
                setBracketData(data)
            } catch (e) {
                // total failure
            }
        }
    }, [teams, teamCount, matchData])

    if (error) {
        return <div className="text-red-400 p-4 border border-red-500/20 rounded-lg text-sm">Bracket Error: {error}</div>
    }

    if (!bracketData) {
        return <div className="text-zinc-500">Loading bracket...</div>
    }

    return (
        <div className="w-full pb-0 mb-4">
            <div className={cn(
                "flex items-stretch w-full",
                isMobile ? "p-1" : "p-4 gap-1"
            )}>
                {bracketData.rounds.map((round, colIndex) => {
                    const isLastColumn = colIndex === bracketData.rounds.length - 1

                    return (
                        <div key={colIndex} className={cn(
                            "flex",
                            isLastColumn ? "flex-[2]" : "flex-[2.5]"
                        )}>
                            {/* Column Content */}
                            <div className="flex flex-col flex-1 min-w-0">
                                {round.title && (
                                    <div className="mb-4 text-center h-10 flex flex-col justify-center shrink-0">
                                        <TitleCard title={round.title} className="inline-block" />
                                    </div>
                                )}

                                <div className="flex flex-col flex-1 relative min-h-[400px]">
                                    {round.matches.map((match, matchIndex) => {
                                        return (
                                            <div
                                                key={match.id}
                                                className="flex-1 flex flex-col justify-center relative py-2"
                                            >
                                                <div className="w-full relative z-10">
                                                    <SwissMatchCard
                                                        team1={match.team1}
                                                        team2={match.team2}
                                                        status={match.status}
                                                        winner={match.winner}
                                                        className="bg-zinc-900 border border-zinc-800/80 w-full"
                                                    />
                                                </div>

                                                {/* Connecting Lines Outward */}
                                                {!isLastColumn && (
                                                    <div className="w-[5px] md:w-[10px] h-[2px] bg-zinc-700 absolute right-[-5px] md:right-[-10px] top-1/2" />
                                                )}
                                                {/* Connecting Line Inward (except first column) */}
                                                {colIndex !== 0 && (
                                                    <div className="w-[5px] md:w-[10px] h-[2px] bg-zinc-700 absolute left-[-5px] md:left-[-10px] top-1/2" />
                                                )}

                                                {/* Vertical Connectors (rendered by the top match of each pair pointing to the next match) */}
                                                {!isLastColumn && matchIndex % 2 === 0 && (
                                                    <div
                                                        className="absolute bg-zinc-700 w-[2px] right-[-5px] md:right-[-10px]"
                                                        style={{
                                                            top: '50%',
                                                            height: '100%',
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Gap between columns */}
                            {!isLastColumn && (
                                <div className="w-[10px] md:w-[20px] shrink-0" />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
