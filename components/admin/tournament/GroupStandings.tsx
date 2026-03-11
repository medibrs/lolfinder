'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ChevronDown, ChevronUp, Trophy } from 'lucide-react'
import { TeamAvatar } from '@/components/ui/team-avatar'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────

interface MatchResult {
    match_id: string
    round_number: number
    opponent_id: string
    opponent_name: string
    opponent_avatar?: string | number
    my_score: number
    opp_score: number
    result: 'win' | 'loss' | 'draw' | 'pending'
    status: string
    best_of: number
}

interface Standing {
    team_id: string
    group_id: number
    group_name: string
    wins: number
    losses: number
    draws: number
    points: number
    matches_played: number
    point_differential: number
    rank: number
    seed_number: number
    team_name: string
    team_avatar?: string | number
    matches: MatchResult[]
}

interface GroupData {
    group_id: number
    group_name: string
    standings: Standing[]
}

interface GroupStandingsProps {
    tournamentId: string
    matchData?: any[]  // Trigger refresh when matches change
}

// ─── Helpers ────────────────────────────────────────────────────────

function resultColor(result: string) {
    switch (result) {
        case 'win': return 'text-emerald-400'
        case 'loss': return 'text-red-400'
        case 'draw': return 'text-amber-400'
        default: return 'text-muted-foreground'
    }
}

function resultBg(result: string) {
    switch (result) {
        case 'win': return 'bg-emerald-500/10'
        case 'loss': return 'bg-red-500/10'
        case 'draw': return 'bg-amber-500/10'
        default: return ''
    }
}

function pointsColor(pts: number) {
    if (pts >= 9) return 'text-emerald-400'
    if (pts >= 6) return 'text-amber-400'
    if (pts >= 3) return 'text-orange-400'
    return 'text-red-400'
}


// ─── Component ──────────────────────────────────────────────────────

const EMPTY_MATCH_DATA: any[] = []

export default function GroupStandings({ tournamentId, matchData = EMPTY_MATCH_DATA }: GroupStandingsProps) {
    const [groups, setGroups] = useState<GroupData[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())

    const fetchStandings = useCallback(async () => {
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/rr-standings`)
            if (res.ok) {
                const data = await res.json()
                setGroups(data.groups || [])
            }
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }, [tournamentId])

    useEffect(() => {
        fetchStandings()
    }, [fetchStandings, matchData])

    const toggleExpand = (teamId: string) => {
        setExpandedTeams(prev => {
            const next = new Set(prev)
            if (next.has(teamId)) next.delete(teamId)
            else next.add(teamId)
            return next
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (groups.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                    No group standings available. Generate the bracket first.
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {groups.map(group => (
                <div key={group.group_id} className="rounded-lg border border-border/50 overflow-hidden bg-card/50">
                    {/* ─── Group Header ─── */}
                    <div className="bg-muted/30 border-b border-border/50 px-4 py-2.5 flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-400" />
                        <span className="font-semibold text-sm tracking-wide">{group.group_name}</span>
                        <Badge variant="outline" className="ml-auto text-[10px]">
                            {group.standings.length} teams
                        </Badge>
                    </div>

                    {/* ─── Rankings Table ─── */}
                    <table className="w-full text-[11px] sm:text-[13px]">
                        <thead>
                            <tr className="text-muted-foreground text-[9px] sm:text-[11px] uppercase tracking-wider border-b border-border/30">
                                <th className="text-center py-2 w-8">#</th>
                                <th className="text-left py-2 pl-3">{group.group_name}</th>
                                <th className="text-center py-2 w-8">M</th>
                                <th className="text-center py-2 w-8">W</th>
                                <th className="text-center py-2 w-8">D</th>
                                <th className="text-center py-2 w-8">L</th>
                                <th className="text-center py-2 w-10 font-bold">P</th>
                                <th className="w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {group.standings.map((s) => {
                                const isExpanded = expandedTeams.has(s.team_id)
                                const hasMatches = s.matches && s.matches.length > 0
                                const hasLiveMatch = s.matches?.some(m => m.status === 'In_Progress')

                                return (
                                    <React.Fragment key={s.team_id}>
                                        {/* ─── Team Row ─── */}
                                        <tr
                                            className={cn(
                                                "border-b border-border/20 transition-colors cursor-pointer hover:bg-muted/20",
                                                s.rank === 1 && "bg-emerald-500/5",
                                                isExpanded && "bg-muted/15"
                                            )}
                                            onClick={() => hasMatches && toggleExpand(s.team_id)}
                                        >
                                            {/* Rank */}
                                            <td className="text-center py-2.5">
                                                <span className={cn(
                                                    "font-bold text-xs",
                                                    s.rank === 1 ? "text-amber-400" :
                                                        s.rank === 2 ? "text-slate-400" :
                                                            s.rank === 3 ? "text-orange-600" :
                                                                "text-muted-foreground"
                                                )}>
                                                    {s.rank}
                                                </span>
                                            </td>

                                            {/* Team */}
                                            <td className="py-2.5 pl-3">
                                                <div className="flex items-center gap-2">
                                                    <TeamAvatar
                                                        team={{
                                                            id: s.team_id,
                                                            name: s.team_name,
                                                            team_avatar: s.team_avatar,
                                                        }}
                                                        size="xs"
                                                        showTooltip={false}
                                                    />
                                                    <div className="flex items-center gap-1.5 truncate max-w-[160px]">
                                                        <span className="font-medium truncate">
                                                            {s.team_name}
                                                        </span>
                                                        {hasLiveMatch && (
                                                            <div title="Currently Playing" className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* M (Matches Played) */}
                                            <td className="text-center py-2.5 text-muted-foreground">{s.matches_played}</td>

                                            {/* W */}
                                            <td className="text-center py-2.5">
                                                <span className="text-emerald-400 font-medium">{s.wins}</span>
                                            </td>

                                            {/* D (Draws) */}
                                            <td className="text-center py-2.5">
                                                <span className="text-amber-400">{s.draws}</span>
                                            </td>

                                            {/* L */}
                                            <td className="text-center py-2.5">
                                                <span className="text-red-400 font-medium">{s.losses}</span>
                                            </td>

                                            {/* Points */}
                                            <td className="text-center py-2.5">
                                                <span className={cn("font-bold", pointsColor(s.points))}>
                                                    {s.points}
                                                </span>
                                            </td>

                                            {/* Expand Toggle */}
                                            <td className="text-center py-2.5 pr-2">
                                                {hasMatches && (
                                                    <div className={cn(
                                                        "inline-flex items-center justify-center w-5 h-5 rounded-sm transition-colors",
                                                        isExpanded ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                                                    )}>
                                                        {isExpanded
                                                            ? <ChevronUp className="h-3.5 w-3.5" />
                                                            : <ChevronDown className="h-3.5 w-3.5" />
                                                        }
                                                    </div>
                                                )}
                                            </td>
                                        </tr>

                                        {/* ─── Expanded Match List ─── */}
                                        {isExpanded && hasMatches && (
                                            <tr key={`${s.team_id}-matches`}>
                                                <td colSpan={9} className="p-0">
                                                    <div className="bg-muted/10 border-b border-border/30 overflow-hidden">
                                                        {s.matches.map((m, i) => (
                                                            <div
                                                                key={m.match_id}
                                                                className={cn(
                                                                    "flex items-center gap-2 px-3 py-2 text-[10px] sm:text-[12px] overflow-hidden",
                                                                    i < s.matches.length - 1 && "border-b border-border/10",
                                                                    resultBg(m.result)
                                                                )}
                                                            >
                                                                {/* This Team (right-aligned) */}
                                                                <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0 overflow-hidden">
                                                                    <span className="truncate text-muted-foreground text-right">
                                                                        {s.team_name}
                                                                    </span>
                                                                    <TeamAvatar
                                                                        team={{
                                                                            id: s.team_id,
                                                                            name: s.team_name,
                                                                            team_avatar: s.team_avatar,
                                                                        }}
                                                                        size="xxs"
                                                                        showTooltip={false}
                                                                    />
                                                                </div>

                                                                {/* Score (centered) */}
                                                                <div className="flex items-center gap-1 font-mono font-bold tabular-nums shrink-0 px-1 sm:px-2">
                                                                    <span className={resultColor(m.result)}>
                                                                        {m.status === 'Completed' ? m.my_score : '-'}
                                                                    </span>
                                                                    <span className="text-muted-foreground/40">-</span>
                                                                    <span className={cn(
                                                                        m.result === 'win' ? 'text-red-400/70' :
                                                                            m.result === 'loss' ? 'text-emerald-400/70' :
                                                                                'text-muted-foreground'
                                                                    )}>
                                                                        {m.status === 'Completed' ? m.opp_score : '-'}
                                                                    </span>
                                                                </div>

                                                                {/* Opponent (left-aligned) */}
                                                                <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                                                                    <TeamAvatar
                                                                        team={{
                                                                            id: m.opponent_id,
                                                                            name: m.opponent_name,
                                                                            team_avatar: m.opponent_avatar,
                                                                        }}
                                                                        size="xxs"
                                                                        showTooltip={false}
                                                                    />
                                                                    <span className="font-medium truncate">
                                                                        {m.opponent_name}
                                                                    </span>
                                                                </div>

                                                                {/* Best Of */}
                                                                <span className="text-muted-foreground/50 text-[9px] sm:text-[10px] shrink-0">
                                                                    bo{m.best_of}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    )
}
