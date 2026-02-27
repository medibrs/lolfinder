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
    Swords, Trophy, AlertTriangle
} from 'lucide-react'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─── Types ──────────────────────────────────────────────────────────

interface MatchDirectorProps {
    tournamentId: string
    tournamentFormat?: string
    matchData?: any[]
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
        if (externalMatchData && externalMatchData.length > 0) {
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
        if (rounds.length > 0 && selectedRound === 0) {
            setSelectedRound(rounds[rounds.length - 1])
        }
    }, [rounds, selectedRound])

    const currentRoundMatches = useMemo(() => {
        return matches.filter(m => {
            const r = m.bracket?.round_number || m.round_number || 0
            return r === selectedRound
        })
    }, [matches, selectedRound])

    const completedCount = currentRoundMatches.filter(m => m.status === 'Completed').length
    const totalCount = currentRoundMatches.length
    const allComplete = completedCount === totalCount && totalCount > 0
    const isCurrentRound = selectedRound === (rounds.length > 0 ? rounds[rounds.length - 1] : 0)

    // ─── Match Actions ────────────────────────────────────────────

    const handleUpdateMatch = async (matchId: string, updates: any) => {
        setActionLoading(matchId)
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/matches`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ match_id: matchId, ...updates }),
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
        const score = match[`${slot}_score`] ?? ''
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
                            const otherSlot = slot === 'team1' ? 'team2' : 'team1'
                            const otherScore = match[`${otherSlot}_score`] ?? 0

                            // Determine winner based on best_of
                            const bestOf = match.best_of || 1
                            const winsNeeded = Math.ceil(bestOf / 2)
                            let updates: any = { [`${slot}_score`]: newScore }

                            if (newScore >= winsNeeded && newScore > otherScore) {
                                updates.winner_id = teamId
                                updates.result = slot === 'team1' ? 'Team1_Win' : 'Team2_Win'
                                updates.status = 'Completed'
                            }

                            handleUpdateMatch(match.id, updates)
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
                    <p className="text-muted-foreground text-sm">Generate a bracket to create matches.</p>
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

                        {/* Advance button */}
                        {isCurrentRound && canAdvance && (
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
                                    <AlertTriangle className="h-3 w-3 mr-1.5" />
                                )}
                                {allComplete ? 'Advance Round' : `${totalCount - completedCount} remaining`}
                            </Button>
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
        </>
    )
}
