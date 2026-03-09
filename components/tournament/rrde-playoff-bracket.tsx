'use client'

import React, { useMemo } from 'react'
import { SingleElimMatchCard, type SingleElimMatchCardTeam } from '@/components/ui/single-elim-match-card'
import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

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

// ─── Types ──────────────────────────────────────────────────────────

interface MatchData {
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
    team1: { id: string; name: string; team_avatar?: string | number } | null
    team2: { id: string; name: string; team_avatar?: string | number } | null
    winner: { id: string; name: string } | null
    bracket: { bracket_position: number; round_number: number } | null
}

interface RRDEPlayoffBracketProps {
    matchData: MatchData[]
    bracketSettings?: string | null
    tournamentName?: string
}

// ─── Helpers ────────────────────────────────────────────────────────

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

function getAccentColor(pos: number | undefined): string {
    if (!pos) return 'text-zinc-500'
    if (pos >= 101 && pos <= 110) return 'text-blue-400'
    if (pos >= 111 && pos <= 120) return 'text-red-400'
    if (pos === 121) return 'text-amber-400'
    return 'text-zinc-500'
}

function toCardTeam(
    team: { id: string; name: string; team_avatar?: string | number } | null,
    score: number | undefined,
): SingleElimMatchCardTeam | null {
    if (!team) return null
    return { id: team.id, name: team.name, team_avatar: team.team_avatar as number | undefined, score }
}

function toStatus(s: string): 'live' | 'scheduled' | 'done' {
    if (s === 'Completed') return 'done'
    if (s === 'In_Progress') return 'live'
    return 'scheduled'
}

function toWinner(m: MatchData): 'team1' | 'team2' | null {
    if (!m.winner_id) return null
    if (m.winner_id === m.team1_id) return 'team1'
    if (m.winner_id === m.team2_id) return 'team2'
    return null
}

function getByPos(matches: MatchData[], pos: number): MatchData | undefined {
    return matches.find(m => m.bracket?.bracket_position === pos)
}

// ─── Slot type ──────────────────────────────────────────────────────

type BracketSlot =
    | { type: 'match'; match: MatchData | undefined }
    | { type: 'passthrough' }

interface BracketCol {
    slots: BracketSlot[]
    mergeRight: boolean
}

// ─── MatchCell ──────────────────────────────────────────────────────

function MatchCell({
    match,
    tournamentName,
}: {
    match: MatchData | undefined
    tournamentName?: string
}) {
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

    const pos = match.bracket!.bracket_position
    const label = getMatchLabel(pos)
    const accent = getAccentColor(pos)
    const status = toStatus(match.status)
    const team1 = toCardTeam(match.team1, match.team1_score) ||
        { id: `tbd-${match.id}-1`, name: 'TBD', team_avatar: undefined }
    const team2 = toCardTeam(match.team2, match.team2_score) ||
        { id: `tbd-${match.id}-2`, name: 'TBD', team_avatar: undefined }

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
                winner={toWinner(match)}
                matchId={String(match.match_number || match.id)}
                matchContextName={tournamentName}
                className="w-full"
            />
        </div>
    )
}

// ─── Main Component ─────────────────────────────────────────────────

export function RRDEPlayoffBracket({ matchData, bracketSettings, tournamentName }: RRDEPlayoffBracketProps) {
    const settings = useMemo(() => {
        if (!bracketSettings) return null
        try {
            return typeof bracketSettings === 'object' ? bracketSettings : JSON.parse(bracketSettings)
        } catch { return null }
    }, [bracketSettings])

    const isPlayoffs = settings?.phase === 'playoffs'

    const playoffMatches = useMemo(() => {
        if (!isPlayoffs || !matchData) return []
        return matchData.filter(m =>
            m.bracket && PLAYOFF_POSITIONS.has(m.bracket.bracket_position)
        )
    }, [isPlayoffs, matchData])

    if (!isPlayoffs || playoffMatches.length === 0) return null

    const wbSemi1 = getByPos(playoffMatches, POS.WB_SEMI_1)
    const wbSemi2 = getByPos(playoffMatches, POS.WB_SEMI_2)
    const wbFinal = getByPos(playoffMatches, POS.WB_FINAL)
    const lbR1 = getByPos(playoffMatches, POS.LB_R1_1)
    const lbR2 = getByPos(playoffMatches, POS.LB_R1_2)
    const lbSemi = getByPos(playoffMatches, POS.LB_SEMI)
    const lbFinal = getByPos(playoffMatches, POS.LB_FINAL)
    const gfMatch = getByPos(playoffMatches, POS.GRAND_FINAL)

    const tournamentWinner = gfMatch?.winner

    /*
     * Unified bracket tree layout:
     *
     * Col 0 (4 slots):  WB Semi 1 ─┐                           ← merge pairs
     *                    WB Semi 2 ─┘
     *                    LB R1     ─┐                           ← merge pairs
     *                    LB R2     ─┘
     *
     * Col 1 (2 slots):  WB Final     ──────  (pass through)    ← NO merge, 1:1
     *                    LB Semi      ──────  LB Final
     *
     * Col 2 (2 slots):  (passthrough) ─┐                       ← merge pairs
     *                    LB Final      ─┘
     *
     * Col 3 (1 slot):   Grand Final
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
        <div className="mt-8 space-y-6">
            {/* Tournament Winner Banner */}
            {tournamentWinner && (
                <div className="text-center py-5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border border-amber-500/20">
                    <Crown className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                    <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/80 mb-1">Tournament Champion</p>
                    <p className="text-xl font-black text-white">{tournamentWinner.name}</p>
                </div>
            )}

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
                                                    {/* Render match card (skip for passthrough) */}
                                                    {hasContent && (
                                                        <div className="w-full relative z-10 px-1">
                                                            <MatchCell
                                                                match={match}
                                                                tournamentName={tournamentName}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Horizontal line RIGHT */}
                                                    {!isLastCol && (
                                                        <div
                                                            className="h-[2px] bg-zinc-700 absolute z-0"
                                                            style={{
                                                                top: '50%',
                                                                left: isPassthrough ? '0' : '50%',
                                                                right: '-16px',
                                                            }}
                                                        />
                                                    )}

                                                    {/* Horizontal line LEFT */}
                                                    {colIndex > 0 && (
                                                        <div
                                                            className="h-[2px] bg-zinc-700 absolute z-0"
                                                            style={{
                                                                top: '50%',
                                                                left: '-16px',
                                                                right: isPassthrough ? '0' : '50%',
                                                            }}
                                                        />
                                                    )}

                                                    {/* Vertical merge connector (top of each pair draws down) */}
                                                    {col.mergeRight && !isLastCol && col.slots.length > 1 && slotIndex % 2 === 0 && (
                                                        <div
                                                            className="absolute bg-zinc-700 w-[2px] z-0"
                                                            style={{
                                                                top: '50%',
                                                                right: '-16px',
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
                                {!isLastCol && (
                                    <div className="w-[32px] md:w-[40px] shrink-0" />
                                )}
                            </React.Fragment>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
