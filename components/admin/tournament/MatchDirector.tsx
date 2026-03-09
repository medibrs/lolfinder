'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'
import { getTeamAvatarUrl } from '@/components/ui/team-avatar'
import {
    Play, ChevronRight, Loader2, CheckCircle2, Clock,
    Swords, Trophy, AlertTriangle, Settings2, CalendarIcon, Video, LayoutTemplate,
    Save, Undo, CalendarClock
} from 'lucide-react'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { format } from 'date-fns'

// ─── Types ──────────────────────────────────────────────────────────

interface MatchDirectorProps {
    tournamentId: string
    tournamentFormat?: string
    matchData?: any[]
    currentRound?: number
    canAdvance?: boolean
    onStateChanged?: () => void
    onMatchDataUpdate?: (matches: any[]) => void
}

// ─── Helpers ────────────────────────────────────────────────────────

function computeTeamRecords(allMatches: any[], beforeRound: number): Record<string, { wins: number; losses: number; draws: number }> {
    const records: Record<string, { wins: number; losses: number; draws: number }> = {}
    const ensure = (id: string) => { if (id && !records[id]) records[id] = { wins: 0, losses: 0, draws: 0 } }

    for (const m of allMatches) {
        if (m.status !== 'Completed' || !m.result) continue
        const round = m.bracket?.round_number || m.round_number || 0
        if (round >= beforeRound) continue
        if (m.team1_id) ensure(m.team1_id)
        if (m.team2_id) ensure(m.team2_id)
        if (m.result === 'Team1_Win') {
            if (m.team1_id) records[m.team1_id].wins++
            if (m.team2_id) records[m.team2_id].losses++
        } else if (m.result === 'Team2_Win') {
            if (m.team2_id) records[m.team2_id].wins++
            if (m.team1_id) records[m.team1_id].losses++
        } else if (m.result === 'Draw') {
            if (m.team1_id) records[m.team1_id].draws++
            if (m.team2_id) records[m.team2_id].draws++
        }
    }
    return records
}

function getMatchBucket(match: any, records: Record<string, { wins: number; losses: number }>): string | null {
    const r1 = records[match.team1_id]
    const r2 = records[match.team2_id]
    if (!r1 || !r2) return r1 ? `${r1.wins}:${r1.losses}` : r2 ? `${r2.wins}:${r2.losses}` : null
    return `${r1.wins}:${r1.losses}`
}

// ─── Component ──────────────────────────────────────────────────────

export default function MatchDirector({
    tournamentId,
    tournamentFormat,
    matchData: externalMatchData,
    currentRound: tournamentCurrentRound = 0,
    canAdvance = true,
    onStateChanged,
    onMatchDataUpdate,
}: MatchDirectorProps) {
    const { toast } = useToast()
    const [matches, setMatches] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [selectedRound, setSelectedRound] = useState<number>(0)
    const [showAdvanceDialog, setShowAdvanceDialog] = useState(false)
    const [showRewindDialog, setShowRewindDialog] = useState(false)
    const [editingMatch, setEditingMatch] = useState<any | null>(null)
    const [pendingScores, setPendingScores] = useState<Record<string, { team1_score?: number; team2_score?: number }>>({})
    const [showScheduleDialog, setShowScheduleDialog] = useState(false)
    const [scheduleConfig, setScheduleConfig] = useState({
        start_hour: 10,
        matches_per_slot: 2,
        slots_per_day: 2,
        interval_hours: 1,
    })

    const fetchMatches = useCallback(async () => {
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/matches`)
            if (res.ok) {
                const data = await res.json()
                const m = data.matches || []
                setMatches(m)
                onMatchDataUpdate?.(m)
            }
        } catch (err) {
            console.error('Error fetching matches:', err)
        } finally {
            setLoading(false)
        }
    }, [tournamentId, onMatchDataUpdate])

    useEffect(() => {
        if (externalMatchData !== undefined) {
            setMatches(externalMatchData)
            setLoading(false)
        } else {
            fetchMatches()
        }
    }, [externalMatchData, fetchMatches])

    // Determine rounds
    const rounds = useMemo(() => {
        const roundSet = new Set<number>()
        for (const m of matches) {
            const r = m.bracket?.round_number || m.round_number || 0
            if (r > 0) roundSet.add(r)
        }
        return Array.from(roundSet).sort((a, b) => a - b)
    }, [matches])

    // Auto-select highest round
    useEffect(() => {
        if (selectedRound === 0) {
            if (tournamentCurrentRound > 0) {
                setSelectedRound(tournamentCurrentRound)
            } else if (rounds.length > 0) {
                setSelectedRound(rounds[rounds.length - 1])
            }
        }
    }, [rounds.length, selectedRound, tournamentCurrentRound])

    const currentRoundMatches = useMemo(() => {
        return matches.filter(m => {
            const r = m.bracket?.round_number || m.round_number || 0
            if (r !== selectedRound) return false
            // Hide bye matches (null team) for Round Robin, since they don't require admin input
            if ((tournamentFormat === 'Round_Robin' || tournamentFormat === 'RR_Double_Elim') && (!m.team1_id || !m.team2_id)) return false
            return true
        })
    }, [matches, selectedRound, tournamentFormat])

    const completedCount = currentRoundMatches.filter(m => m.status === 'Completed').length
    const totalCount = currentRoundMatches.length
    const allComplete = completedCount === totalCount && totalCount > 0
    const isCurrentRound = selectedRound === (tournamentCurrentRound || (rounds.length > 0 ? rounds[rounds.length - 1] : 0))

    // ─── Match Actions ────────────────────────────────────────────

    const handleUpdateMatch = async (match_id: string, updates: any) => {
        setActionLoading(match_id)
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/matches`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ match_id, ...updates }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Failed')
            }
            await fetchMatches()
            onStateChanged?.()
            toast({ title: 'Match Updated', description: 'Score saved.' })
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
            setActionLoading(null)
        }
    }

    const handleSaveScores = async (matchId: string) => {
        const pending = pendingScores[matchId]
        if (!pending) return

        const match = matches.find(m => m.id === matchId)
        if (!match) return

        const team1_score = pending.team1_score ?? match.team1_score ?? 0
        const team2_score = pending.team2_score ?? match.team2_score ?? 0

        // Determine winner based on best_of
        const bestOf = match.best_of || 1
        const winsNeeded = Math.ceil(bestOf / 2)
        let updates: any = { team1_score, team2_score }

        if (team1_score >= winsNeeded && team1_score > team2_score) {
            updates.winner_id = match.team1_id
            updates.result = 'Team1_Win'
            updates.status = 'Completed'
        } else if (team2_score >= winsNeeded && team2_score > team1_score) {
            updates.winner_id = match.team2_id
            updates.result = 'Team2_Win'
            updates.status = 'Completed'
        }

        await handleUpdateMatch(matchId, updates)

        // Clear pending scores for this match
        setPendingScores(prev => {
            const next = { ...prev }
            delete next[matchId]
            return next
        })
    }

    const handleResetScores = (matchId: string) => {
        setPendingScores(prev => {
            const next = { ...prev }
            delete next[matchId]
            return next
        })
    }

    const handleAdvanceRound = async () => {
        setShowAdvanceDialog(false)
        setActionLoading('advance')
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/advance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to advance')

            await fetchMatches()
            onStateChanged?.()
            toast({
                title: data.message?.includes('completed') ? 'Tournament Complete!' : 'Round Advanced',
                description: data.message || 'Next round generated.',
            })

            // Auto-select new round
            setSelectedRound(0)
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
            setActionLoading(null)
        }
    }

    const handleAutoSchedule = async () => {
        setShowScheduleDialog(false)
        setActionLoading('auto-schedule')
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/auto-schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scheduleConfig),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to auto-schedule')

            await fetchMatches()
            onStateChanged?.()
            toast({
                title: 'Matches Scheduled',
                description: data.message || `${data.scheduled} matches scheduled across ${data.total_days} days.`,
            })
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
            setActionLoading(null)
        }
    }

    const handleRewindRound = async () => {
        setShowRewindDialog(false)
        setActionLoading('rewind')
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/rewind`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to rewind')

            await fetchMatches()
            onStateChanged?.()
            toast({
                title: 'Round Rewound',
                description: data.message || 'Tournament rolled back successfully.',
            })
            setSelectedRound(0)
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
            setActionLoading(null)
        }
    }

    // ─── Match Card ───────────────────────────────────────────────

    const renderMatchCard = (match: any, readOnly = false) => {
        const isLoading = actionLoading === match.id
        const isCompleted = match.status === 'Completed'
        const isBye = !match.team2_id

        return (
            <div
                key={match.id}
                className={`
          rounded-lg border transition-all overflow-hidden
          ${isCompleted ? 'border-green-500/20 bg-green-500/[0.02]' : 'border-border bg-card/50'}
          ${isLoading ? 'opacity-60 pointer-events-none' : ''}
        `}
            >
                {/* Match Header */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-muted/30">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">Match {match.match_number || '?'}</span>
                        {match.best_of && match.best_of > 1 && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">Bo{match.best_of}</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {/* Save / Reset Buttons */}
                        {(() => {
                            const pending = pendingScores[match.id];
                            if (!pending) return null;
                            const hasChange = (pending.team1_score !== undefined && pending.team1_score !== (match.team1_score ?? 0)) ||
                                (pending.team2_score !== undefined && pending.team2_score !== (match.team2_score ?? 0));
                            if (!hasChange) return null;

                            return (
                                <div className="flex items-center gap-1 mr-1 animate-in fade-in slide-in-from-right-2 duration-200">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 rounded-full hover:bg-green-500/20 hover:text-green-500 text-green-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSaveScores(match.id);
                                        }}
                                    >
                                        <Save className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleResetScores(match.id);
                                        }}
                                    >
                                        <Undo className="h-3.5 w-3.5" />
                                    </Button>
                                    <div className="w-[1px] h-3 bg-border/50 mx-0.5" />
                                </div>
                            );
                        })()}

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full hover:bg-muted"
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditingMatch(match);
                            }}
                        >
                            <Settings2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                        </Button>
                        {isCompleted ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : isBye ? (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">BYE</Badge>
                        ) : (
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                    </div>
                </div>

                {/* Teams */}
                <div className="divide-y divide-border/30">
                    {renderTeamSlot(match, 'team1', readOnly)}
                    {renderTeamSlot(match, 'team2', readOnly)}
                </div>
            </div>
        )
    }

    const renderTeamSlot = (match: any, slot: 'team1' | 'team2', readOnly: boolean) => {
        const teamId = match[`${slot}_id`]
        const team = match[slot]

        // Use pending score if available, otherwise use database score
        const score = pendingScores[match.id]?.[`${slot}_score` as keyof typeof pendingScores[string]] ?? match[`${slot}_score`] ?? ''

        const isWinner = match.winner_id === teamId && match.winner_id
        const isBye = slot === 'team2' && !match.team2_id

        if (isBye) {
            return (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/20">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground">—</span>
                    </div>
                    <span className="text-xs text-muted-foreground italic flex-1">Bye</span>
                </div>
            )
        }

        return (
            <div className={`
        flex items-center gap-3 px-3 py-2.5 transition-colors
        ${isWinner ? 'bg-green-500/5' : ''}
      `}>
                {/* Avatar */}
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {team?.team_avatar ? (
                        <Image
                            src={getTeamAvatarUrl(team.team_avatar)!}
                            alt="" width={28} height={28}
                            className="w-full h-full object-cover"
                            unoptimized={process.env.NODE_ENV === 'development'}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Swords className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                    )}
                </div>

                {/* Name */}
                <span className={`text-sm flex-1 truncate ${isWinner ? 'font-semibold text-green-400' : 'font-medium'}`}>
                    {team?.name || 'TBD'}
                    {isWinner && <Trophy className="h-3 w-3 inline ml-1 text-green-400" />}
                </span>

                {/* Score input */}
                {!readOnly && match.status !== 'Completed' ? (
                    <input
                        type="number"
                        min={0}
                        value={score}
                        onChange={(e) => {
                            const newScore = parseInt(e.target.value) || 0
                            setPendingScores(prev => ({
                                ...prev,
                                [match.id]: {
                                    ...prev[match.id],
                                    [`${slot}_score`]: newScore
                                }
                            }))
                        }}
                        className="w-12 h-7 rounded border bg-background text-center text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                    />
                ) : (
                    <span className={`text-sm font-mono w-8 text-center ${isWinner ? 'text-green-400 font-bold' : 'text-muted-foreground'}`}>
                        {score || (match.status === 'Completed' && isWinner ? 'W' : '—')}
                    </span>
                )}
            </div>
        )
    }

    // ─── Render ───────────────────────────────────────────────────

    if (loading) {
        return (
            <Card>
                <CardContent className="py-12 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    if (matches.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Swords className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Matches</h3>
                    <p className="text-muted-foreground text-sm">
                        {tournamentFormat === 'Swiss'
                            ? 'Go to the Seeding tab to generate matches for this round.'
                            : 'Generate a bracket to create matches.'}
                    </p>
                </CardContent>
            </Card>
        )
    }

    // Swiss bucket grouping for current round
    const isSwiss = tournamentFormat === 'Swiss'
    const records = isSwiss ? computeTeamRecords(matches, selectedRound) : {}
    const matchBuckets: Record<string, any[]> = {}

    if (isSwiss) {
        for (const m of currentRoundMatches) {
            const bucket = getMatchBucket(m, records) || '0:0'
            if (!matchBuckets[bucket]) matchBuckets[bucket] = []
            matchBuckets[bucket].push(m)
        }
    }

    const sortedMatchBuckets = Object.entries(matchBuckets).sort((a, b) => {
        const [aw, al] = a[0].split(':').map(Number)
        const [bw, bl] = b[0].split(':').map(Number)
        return bw !== aw ? bw - aw : al - bl
    })

    // Round Robin grouping for current round
    const isRoundRobin = tournamentFormat === 'Round_Robin' || tournamentFormat === 'RR_Double_Elim'
    const rrGroups: Record<string, any[]> = {}
    if (isRoundRobin) {
        for (const m of currentRoundMatches) {
            const groupName = m.group_name || 'Ungrouped'
            if (!rrGroups[groupName]) rrGroups[groupName] = []
            rrGroups[groupName].push(m)
        }
    }
    const sortedRRGroups = Object.entries(rrGroups).sort((a, b) => a[0].localeCompare(b[0]))

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Swords className="h-5 w-5" />
                                Matches
                            </CardTitle>
                            <CardDescription className="mt-1">
                                {completedCount}/{totalCount} completed in Round {selectedRound}
                            </CardDescription>
                        </div>

                        {/* Action buttons */}
                        {isCurrentRound && canAdvance && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowScheduleDialog(true)}
                                    disabled={!!actionLoading}
                                    className="text-xs h-8 text-cyan-500 hover:text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/10"
                                >
                                    {actionLoading === 'auto-schedule' ? (
                                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                    ) : (
                                        <CalendarClock className="h-3 w-3 mr-1.5" />
                                    )}
                                    Auto Schedule
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setShowRewindDialog(true)}
                                    disabled={!!actionLoading || selectedRound <= 1}
                                    className="text-xs h-8 text-amber-500 hover:text-amber-400 border-amber-500/20 hover:bg-amber-500/10"
                                >
                                    {actionLoading === 'rewind' ? (
                                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                    ) : (
                                        <AlertTriangle className="h-3 w-3 mr-1.5" />
                                    )}
                                    Rewind
                                </Button>
                                <Button
                                    onClick={() => allComplete ? setShowAdvanceDialog(true) : null}
                                    disabled={!allComplete || !!actionLoading}
                                    className="text-xs h-8"
                                    variant={allComplete ? 'default' : 'secondary'}
                                >
                                    {actionLoading === 'advance' ? (
                                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                    ) : allComplete ? (
                                        <ChevronRight className="h-3 w-3 mr-1.5" />
                                    ) : (
                                        <AlertTriangle className="h-3 w-3 mr-1.5 text-muted-foreground" />
                                    )}
                                    {allComplete ? 'Advance Round' : `${totalCount - completedCount} remaining`}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Round selector */}
                    {rounds.length > 1 && (
                        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                            {rounds.map(r => (
                                <Button
                                    key={r}
                                    size="sm"
                                    variant={selectedRound === r ? 'default' : 'outline'}
                                    onClick={() => setSelectedRound(r)}
                                    className="text-xs h-7 px-3"
                                >
                                    R{r}
                                    {r === rounds[rounds.length - 1] && (
                                        <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                    )}
                                </Button>
                            ))}
                        </div>
                    )}

                    {/* Progress bar */}
                    <div className="mt-3">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary to-green-500 rounded-full transition-all duration-500"
                                style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
                            />
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {isSwiss && sortedMatchBuckets.length > 0 ? (
                        <div className="space-y-5">
                            {sortedMatchBuckets.map(([bucket, bucketMatches]) => {
                                const [w, l] = bucket.split(':').map(Number)
                                return (
                                    <div key={bucket}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm font-bold">
                                                <span className="text-green-400">{w}</span>
                                                <span className="text-muted-foreground mx-0.5">:</span>
                                                <span className="text-red-400">{l}</span>
                                            </span>
                                            <span className="text-xs text-muted-foreground">Pool</span>
                                            <div className="flex-1 h-px bg-border" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {bucketMatches.map(m => renderMatchCard(m, !isCurrentRound))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : isRoundRobin && sortedRRGroups.length > 0 ? (
                        <div className="space-y-5">
                            {sortedRRGroups.map(([groupName, groupMatches]: [string, any[]]) => (
                                <div key={groupName}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-bold text-primary">{groupName}</span>
                                        <div className="flex-1 h-px bg-border" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {groupMatches.map((m: any) => renderMatchCard(m, !isCurrentRound))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {currentRoundMatches.map(m => renderMatchCard(m, !isCurrentRound))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Advance Confirmation */}
            <AlertDialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Advance to Next Round?</AlertDialogTitle>
                        <AlertDialogDescription>
                            All {totalCount} matches in Round {selectedRound} are complete.
                            This will calculate standings, determine eliminations, and generate the next round.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleAdvanceRound}>
                            <Play className="h-4 w-4 mr-2" />
                            Advance Round
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit Match Details Modal */}
            <Dialog open={!!editingMatch} onOpenChange={(open) => !open && setEditingMatch(null)}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Match {editingMatch?.match_number}</DialogTitle>
                        <DialogDescription>
                            Configure schedule, location, and reporting locks.
                        </DialogDescription>
                    </DialogHeader>

                    {editingMatch && (
                        <div className="space-y-4 py-4">
                            {/* Scheduling */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5" /> Scheduling</Label>
                                <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="scheduled_at">Scheduled Time</Label>
                                        <Input
                                            type="datetime-local"
                                            id="scheduled_at"
                                            value={editingMatch.scheduled_at?.slice(0, 16) || ''}
                                            onChange={(e) => setEditingMatch({ ...editingMatch, scheduled_at: e.target.value })}
                                            className="h-8"
                                            step="60"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="started_at">Started At</Label>
                                        <Input
                                            type="datetime-local"
                                            id="started_at"
                                            value={editingMatch.started_at?.slice(0, 16) || ''}
                                            onChange={(e) => setEditingMatch({ ...editingMatch, started_at: e.target.value })}
                                            className="h-8"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="completed_at">Completed At</Label>
                                        <Input
                                            type="datetime-local"
                                            id="completed_at"
                                            value={editingMatch.completed_at?.slice(0, 16) || ''}
                                            onChange={(e) => setEditingMatch({ ...editingMatch, completed_at: e.target.value })}
                                            className="h-8"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Location / Stream */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase flex items-center gap-1.5"><Video className="h-3.5 w-3.5" /> Location & Media</Label>
                                <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="match_room">Match Room / Lobby Info</Label>
                                        <Input
                                            id="match_room"
                                            placeholder="e.g. EUW Lobby Name / Password"
                                            value={editingMatch.match_room || ''}
                                            onChange={(e) => setEditingMatch({ ...editingMatch, match_room: e.target.value })}
                                            className="h-8"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="stream_url">Stream URL</Label>
                                        <Input
                                            id="stream_url"
                                            placeholder="https://twitch.tv/..."
                                            value={editingMatch.stream_url || ''}
                                            onChange={(e) => setEditingMatch({ ...editingMatch, stream_url: e.target.value })}
                                            className="h-8"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Rules & Admin */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase flex items-center gap-1.5"><LayoutTemplate className="h-3.5 w-3.5" /> Rules & Admin</Label>
                                <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="best_of">Best Of (Series)</Label>
                                        <Select
                                            value={(editingMatch.best_of || 1).toString()}
                                            onValueChange={(val) => setEditingMatch({ ...editingMatch, best_of: parseInt(val) })}
                                        >
                                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">Bo1</SelectItem>
                                                <SelectItem value="3">Bo3</SelectItem>
                                                <SelectItem value="5">Bo5</SelectItem>
                                                <SelectItem value="7">Bo7</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Lock Match</Label>
                                            <p className="text-xs text-muted-foreground">Prevent players from reporting scores.</p>
                                        </div>
                                        <Switch
                                            checked={!!editingMatch.is_locked}
                                            onCheckedChange={(checked) => setEditingMatch({ ...editingMatch, is_locked: checked })}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="override_reason">Override Reason (if changed by Admin)</Label>
                                        <Input
                                            id="override_reason"
                                            placeholder="e.g. Forfeit, Rule Violation"
                                            value={editingMatch.override_reason || ''}
                                            onChange={(e) => setEditingMatch({ ...editingMatch, override_reason: e.target.value })}
                                            className="h-8"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="notes">Admin Notes (Hidden from public)</Label>
                                        <Textarea
                                            id="notes"
                                            placeholder="Internal remarks..."
                                            value={editingMatch.notes || ''}
                                            onChange={(e) => setEditingMatch({ ...editingMatch, notes: e.target.value })}
                                            rows={2}
                                        />
                                    </div>

                                    <div className="space-y-1.5 pt-2 border-t border-border/50">
                                        <Label>Force Status</Label>
                                        <Select
                                            value={editingMatch.status}
                                            onValueChange={(val) => setEditingMatch({ ...editingMatch, status: val })}
                                        >
                                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Scheduled">Scheduled</SelectItem>
                                                <SelectItem value="In_Progress">In Progress</SelectItem>
                                                <SelectItem value="Completed">Completed</SelectItem>
                                                <SelectItem value="Cancelled">Cancelled</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingMatch(null)}>Cancel</Button>
                        <Button onClick={() => {
                            if (editingMatch) {
                                handleUpdateMatch(editingMatch.id, editingMatch)
                                setEditingMatch(null)
                            }
                        }}>
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Auto Schedule Config Dialog */}
            <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                <DialogContent className="border-cyan-500/20 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-cyan-500">
                            <CalendarClock className="h-5 w-5" />
                            Auto Schedule Configuration
                        </DialogTitle>
                        <DialogDescription>
                            Configure how matches are distributed across days and time slots.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* Start Hour */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">First match starts at</Label>
                            <Select
                                value={String(scheduleConfig.start_hour)}
                                onValueChange={(val) => setScheduleConfig(c => ({ ...c, start_hour: parseInt(val) }))}
                            >
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 18 }, (_, i) => i + 6).map(h => (
                                        <SelectItem key={h} value={String(h)}>
                                            {String(h).padStart(2, '0')}:00
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Matches per slot */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Matches per time slot</Label>
                            <Select
                                value={String(scheduleConfig.matches_per_slot)}
                                onValueChange={(val) => setScheduleConfig(c => ({ ...c, matches_per_slot: parseInt(val) }))}
                            >
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <SelectItem key={n} value={String(n)}>
                                            {n} match{n > 1 ? 'es' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Slots per day */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Time slots per day</Label>
                            <Select
                                value={String(scheduleConfig.slots_per_day)}
                                onValueChange={(val) => setScheduleConfig(c => ({ ...c, slots_per_day: parseInt(val) }))}
                            >
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {[1, 2, 3, 4, 5, 6].map(n => (
                                        <SelectItem key={n} value={String(n)}>
                                            {n} slot{n > 1 ? 's' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Interval between slots */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Hours between slots</Label>
                            <Select
                                value={String(scheduleConfig.interval_hours)}
                                onValueChange={(val) => setScheduleConfig(c => ({ ...c, interval_hours: parseInt(val) }))}
                            >
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <SelectItem key={n} value={String(n)}>
                                            {n} hour{n > 1 ? 's' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Preview */}
                        <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3 space-y-1.5">
                            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Daily Preview</p>
                            {Array.from({ length: scheduleConfig.slots_per_day }, (_, s) => {
                                const hour = scheduleConfig.start_hour + s * scheduleConfig.interval_hours
                                return (
                                    <div key={s} className="flex items-center gap-2 text-sm">
                                        <span className="text-cyan-400 font-mono font-bold w-14">
                                            {String(hour).padStart(2, '0')}:00
                                        </span>
                                        <span className="text-slate-400">
                                            {scheduleConfig.matches_per_slot} match{scheduleConfig.matches_per_slot > 1 ? 'es' : ''}
                                        </span>
                                    </div>
                                )
                            })}
                            <div className="border-t border-slate-700 mt-2 pt-2 text-xs text-slate-500">
                                Total: {scheduleConfig.slots_per_day * scheduleConfig.matches_per_slot} matches/day
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
                        <Button
                            onClick={handleAutoSchedule}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white"
                        >
                            <CalendarClock className="h-4 w-4 mr-1.5" />
                            Schedule All Matches
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showRewindDialog} onOpenChange={setShowRewindDialog}>
                <AlertDialogContent className="border-amber-500/20">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-amber-500 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Rewind to Round {selectedRound - 1}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will <strong className="text-foreground">permanently delete all matches</strong> for Round {selectedRound} and rollback the tournament to Round {selectedRound - 1}.
                            For Swiss tournaments, team scores will be recalculated. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRewindRound}
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                        >
                            Yes, Rewind Round
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
