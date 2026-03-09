'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Trophy, Swords, Crown } from 'lucide-react'
import { SingleElimMatchCard, type SingleElimMatchCardTeam } from '@/components/ui/single-elim-match-card'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────────────

interface PlayoffMatch {
    id: string
    match_number: number
    team1_id: string | null
    team2_id: string | null
    winner_id: string | null
    status: string
    team1_score: number
    team2_score: number
    best_of: number
    notes: string | null
    bracket_position: number
    round_number: number
}

interface TeamInfo {
    id: string
    name: string
    team_avatar?: string | number
}

interface RRDEPlayoffSectionProps {
    tournamentId: string
    bracketSettings?: string
    matchData?: any[]
    onPlayoffsGenerated: () => void
}

// ─── Constants ──────────────────────────────────────────────────────

const POS = {
    WB_SEMI_1: 101,
    WB_SEMI_2: 102,
    WB_FINAL: 103,
    LB_R1_1: 111,
    LB_R1_2: 112,
    LB_SEMI: 113,
    LB_FINAL: 114,
    GRAND_FINAL: 121,
}

const PLAYOFF_POSITIONS = new Set(Object.values(POS))

function getMatchLabel(pos: number): string {
    switch (pos) {
        case POS.WB_SEMI_1: return 'WB Semi 1'
        case POS.WB_SEMI_2: return 'WB Semi 2'
        case POS.WB_FINAL: return 'WB Final'
        case POS.LB_R1_1: return 'LB Round 1'
        case POS.LB_R1_2: return 'LB Round 2'
        case POS.LB_SEMI: return 'LB Semi'
        case POS.LB_FINAL: return 'LB Final'
        case POS.GRAND_FINAL: return 'Grand Final'
        default: return 'Match'
    }
}

// ─── Component ──────────────────────────────────────────────────────

export default function RRDEPlayoffSection({
    tournamentId,
    bracketSettings,
    matchData = [],
    onPlayoffsGenerated,
}: RRDEPlayoffSectionProps) {
    const { toast } = useToast()
    const [generating, setGenerating] = useState(false)
    const [teams, setTeams] = useState<Record<string, TeamInfo>>({})

    // Parse bracket settings
    const settings = useMemo(() => {
        if (!bracketSettings) return null
        try {
            return typeof bracketSettings === 'object' ? bracketSettings : JSON.parse(bracketSettings)
        } catch { return null }
    }, [bracketSettings])

    const phase = settings?.phase || 'group'
    const isPlayoffs = phase === 'playoffs'

    // Load team info
    useEffect(() => {
        const loadTeams = async () => {
            try {
                const res = await fetch(`/api/tournaments/${tournamentId}/seeding`)
                if (res.ok) {
                    const data = await res.json()
                    const map: Record<string, TeamInfo> = {}
                    for (const p of data.participants || []) {
                        if (p.team) {
                            map[p.team_id] = {
                                id: p.team_id,
                                name: p.team.name,
                                team_avatar: p.team.team_avatar,
                            }
                        }
                    }
                    setTeams(map)
                }
            } catch { /* ignore */ }
        }
        loadTeams()
    }, [tournamentId, matchData])

    // Extract playoff matches from matchData
    const playoffMatches = useMemo(() => {
        if (!isPlayoffs || !matchData) return []

        return matchData
            .filter((m: any) => {
                const pos = m.bracket?.bracket_position
                return pos && PLAYOFF_POSITIONS.has(pos)
            })
            .map((m: any) => ({
                id: m.id,
                match_number: m.match_number,
                team1_id: m.team1_id,
                team2_id: m.team2_id,
                winner_id: m.winner_id,
                status: m.status,
                team1_score: m.team1_score ?? 0,
                team2_score: m.team2_score ?? 0,
                best_of: m.best_of || 3,
                notes: m.notes,
                bracket_position: m.bracket?.bracket_position || 0,
                round_number: m.bracket?.round_number || 0,
            }))
    }, [isPlayoffs, matchData])

    // Check if group stage is complete
    const groupStageComplete = useMemo(() => {
        if (isPlayoffs) return true
        if (!matchData || matchData.length === 0) return false

        const groupMatches = matchData.filter((m: any) => {
            const pos = m.bracket?.bracket_position ?? 0
            return !PLAYOFF_POSITIONS.has(pos)
        })

        return groupMatches.length > 0 && groupMatches.every((m: any) => m.status === 'Completed')
    }, [isPlayoffs, matchData])

    const handleGeneratePlayoffs = async () => {
        if (!confirm('Generate playoff brackets? Top 4 → Winners Bracket, 5th-6th → Losers Bracket, rest eliminated.')) return

        setGenerating(true)
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/generate-playoffs`, {
                method: 'POST',
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to generate playoffs')

            toast({
                title: 'Playoffs Generated',
                description: `${data.matchIds?.length || 8} playoff matches created. ${data.eliminated?.length || 0} teams eliminated.`,
            })
            onPlayoffsGenerated()
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            })
        } finally {
            setGenerating(false)
        }
    }

    // ─── Render: Group stage not yet done ────────────────────────────

    if (!isPlayoffs && !groupStageComplete) {
        return (
            <Card className="mt-6">
                <CardContent className="py-8 text-center text-muted-foreground">
                    <Swords className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="font-medium">Playoffs</p>
                    <p className="text-sm mt-1">Complete all group stage matches to unlock playoff generation.</p>
                </CardContent>
            </Card>
        )
    }

    // ─── Render: Group complete, generate playoffs button ────────────

    if (!isPlayoffs && groupStageComplete) {
        return (
            <Card className="mt-6 border-amber-500/20">
                <CardContent className="py-8 text-center">
                    <Crown className="h-10 w-10 mx-auto mb-3 text-amber-400" />
                    <h3 className="text-lg font-bold mb-2">Group Stage Complete!</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                        Ready to generate the playoff bracket. Top 4 teams advance to the Winners Bracket,
                        5th–6th place start in the Losers Bracket, and the remaining teams are eliminated.
                    </p>
                    <Button
                        onClick={handleGeneratePlayoffs}
                        disabled={generating}
                        className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
                        size="lg"
                    >
                        {generating ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                        ) : (
                            <><Trophy className="h-4 w-4 mr-2" />Generate Playoffs</>
                        )}
                    </Button>
                </CardContent>
            </Card>
        )
    }

    // ─── Render: Unified bracket tree ─────────────────────────────────

    const getByPos = (pos: number) => playoffMatches.find(m => m.bracket_position === pos)

    const wbSemi1 = getByPos(POS.WB_SEMI_1)
    const wbSemi2 = getByPos(POS.WB_SEMI_2)
    const wbFinal = getByPos(POS.WB_FINAL)
    const lbR1 = getByPos(POS.LB_R1_1)
    const lbR2 = getByPos(POS.LB_R1_2)
    const lbSemi = getByPos(POS.LB_SEMI)
    const lbFinal = getByPos(POS.LB_FINAL)
    const gfMatch = getByPos(POS.GRAND_FINAL)

    const toCardTeam = (teamId: string | null): SingleElimMatchCardTeam | null => {
        if (!teamId) return null
        const t = teams[teamId]
        if (!t) return { id: teamId, name: 'Unknown', team_avatar: undefined }
        return { id: t.id, name: t.name, team_avatar: t.team_avatar as number | undefined }
    }

    function getAccentColor(pos: number): string {
        if (pos >= 101 && pos <= 110) return 'text-blue-400'
        if (pos >= 111 && pos <= 120) return 'text-red-400'
        if (pos === 121) return 'text-amber-400'
        return 'text-zinc-500'
    }

    const renderMatchCell = (match: PlayoffMatch | undefined) => {
        if (!match) {
            return (
                <div className="w-full opacity-30">
                    <SingleElimMatchCard
                        team1={{ id: 'tbd-1', name: 'TBD', team_avatar: undefined }}
                        team2={{ id: 'tbd-2', name: 'TBD', team_avatar: undefined }}
                        status="scheduled"
                        className="w-full"
                    />
                </div>
            )
        }

        const label = getMatchLabel(match.bracket_position)
        const accent = getAccentColor(match.bracket_position)
        const status: 'live' | 'scheduled' | 'done' =
            match.status === 'Completed' ? 'done' : match.status === 'In_Progress' ? 'live' : 'scheduled'
        const winner: 'team1' | 'team2' | null =
            match.winner_id === match.team1_id ? 'team1' :
            match.winner_id === match.team2_id ? 'team2' : null

        const team1: SingleElimMatchCardTeam = toCardTeam(match.team1_id) ||
            { id: `tbd-${match.id}-1`, name: 'TBD', team_avatar: undefined }
        const team2: SingleElimMatchCardTeam = toCardTeam(match.team2_id) ||
            { id: `tbd-${match.id}-2`, name: 'TBD', team_avatar: undefined }

        if (status === 'done') {
            team1.score = match.team1_score
            team2.score = match.team2_score
        }

        return (
            <div className="w-full">
                <div className="flex items-center justify-between px-0.5 mb-1">
                    <span className={cn("text-[9px] md:text-[10px] font-bold uppercase tracking-wider", accent)}>
                        {label}
                    </span>
                    {status === 'done' && (
                        <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1 py-0.5">
                            Final
                        </span>
                    )}
                    {status === 'live' && (
                        <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 rounded px-1 py-0.5 animate-pulse">
                            Live
                        </span>
                    )}
                </div>
                <SingleElimMatchCard
                    team1={team1}
                    team2={team2}
                    status={status}
                    winner={winner}
                    matchId={String(match.match_number || match.id)}
                    className="w-full"
                />
            </div>
        )
    }

    type BracketSlot =
        | { type: 'match'; match: PlayoffMatch | undefined }
        | { type: 'passthrough' }

    interface BracketCol {
        slots: BracketSlot[]
        mergeRight: boolean
    }

    /*
     * Col 0: [WB S1, WB S2, LB R1, LB R2]  mergeRight
     * Col 1: [WB Final, LB Semi]             no merge (1:1)
     * Col 2: [passthrough, LB Final]         mergeRight
     * Col 3: [Grand Final]
     */
    const columns: BracketCol[] = [
        { slots: [
            { type: 'match', match: wbSemi1 },
            { type: 'match', match: wbSemi2 },
            { type: 'match', match: lbR1 },
            { type: 'match', match: lbR2 },
        ], mergeRight: true },
        { slots: [
            { type: 'match', match: wbFinal },
            { type: 'match', match: lbSemi },
        ], mergeRight: false },
        { slots: [
            { type: 'passthrough' },
            { type: 'match', match: lbFinal },
        ], mergeRight: true },
        { slots: [
            { type: 'match', match: gfMatch },
        ], mergeRight: false },
    ]

    const totalCols = columns.length

    return (
        <div className="mt-6 space-y-6">
            <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-amber-400" />
                <h3 className="text-lg font-bold">Playoffs — Double Elimination</h3>
            </div>

            {/* Unified Bracket Tree */}
            <div className="overflow-x-auto pb-2">
                <div
                    className="flex items-stretch"
                    style={{ minWidth: `${totalCols * 200 + (totalCols - 1) * 40}px`, minHeight: '520px' }}
                >
                    {columns.map((col, colIndex) => {
                        const isLastCol = colIndex === totalCols - 1

                        return (
                            <React.Fragment key={colIndex}>
                                <div className="flex flex-col flex-1 min-w-[160px] md:min-w-[200px]">
                                    <div className="flex flex-col flex-1 relative">
                                        {col.slots.map((slot, slotIndex) => {
                                            const isPassthrough = slot.type === 'passthrough'
                                            const match = slot.type === 'match' ? slot.match : undefined
                                            const hasContent = !isPassthrough

                                            return (
                                                <div
                                                    key={
                                                        isPassthrough
                                                            ? `pt-${colIndex}-${slotIndex}`
                                                            : match?.id || `empty-${colIndex}-${slotIndex}`
                                                    }
                                                    className="flex-1 flex flex-col justify-center relative py-2 md:py-3"
                                                >
                                                    {hasContent && (
                                                        <div className="w-full relative z-10 px-1">
                                                            {renderMatchCell(match)}
                                                        </div>
                                                    )}

                                                    {/* Horizontal line RIGHT */}
                                                    {!isLastCol && (
                                                        <div className="h-[2px] bg-zinc-700 absolute z-0"
                                                            style={{ top: '50%', left: isPassthrough ? '0' : '50%', right: '-16px' }} />
                                                    )}

                                                    {/* Horizontal line LEFT */}
                                                    {colIndex > 0 && (
                                                        <div className="h-[2px] bg-zinc-700 absolute z-0"
                                                            style={{ top: '50%', left: '-16px', right: isPassthrough ? '0' : '50%' }} />
                                                    )}

                                                    {/* Vertical merge connector */}
                                                    {col.mergeRight && !isLastCol && col.slots.length > 1 && slotIndex % 2 === 0 && (
                                                        <div className="absolute bg-zinc-700 w-[2px] z-0"
                                                            style={{ top: '50%', right: '-16px', height: '100%' }} />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {!isLastCol && <div className="w-[32px] md:w-[40px] shrink-0" />}
                            </React.Fragment>
                        )
                    })}
                </div>
            </div>

            {playoffMatches.length === 0 && (
                <Card>
                    <CardContent className="py-6 text-center text-muted-foreground text-sm">
                        No playoff matches found. Try refreshing.
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
