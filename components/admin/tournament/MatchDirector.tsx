'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Trophy, ArrowRight, RefreshCw, ChevronLeft, ChevronRight, Radio, Circle, CheckCircle2, Clock, Swords } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'
import { getTeamAvatarUrl } from '@/components/ui/team-avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface MatchDirectorProps {
    tournamentId: string
    tournamentFormat?: string
    onStateChanged?: () => void
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Compute W-L records for all teams at a given point (before a specific round). */
function computeTeamRecords(allMatches: any[], beforeRound: number): Record<string, { wins: number; losses: number; draws: number }> {
    const records: Record<string, { wins: number; losses: number; draws: number }> = {}

    const ensure = (id: string) => {
        if (!records[id]) records[id] = { wins: 0, losses: 0, draws: 0 }
    }

    for (const m of allMatches) {
        const rn = m.bracket?.round_number
        if (!rn || rn >= beforeRound) continue
        if (m.status !== 'Completed') continue

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

/** Get the W-L bucket label for a match based on team records */
function getMatchBucket(match: any, records: Record<string, { wins: number; losses: number }>): string | null {
    const tid = match.team1_id
    if (!tid || !records[tid]) return null
    return `${records[tid].wins}:${records[tid].losses}`
}

// ─── Component ──────────────────────────────────────────────────────

export default function MatchDirector({ tournamentId, tournamentFormat, onStateChanged }: MatchDirectorProps) {
    const { toast } = useToast()
    const [matches, setMatches] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [advancing, setAdvancing] = useState(false)
    const [currentRound, setCurrentRound] = useState(1)
    const [totalRounds, setTotalRounds] = useState(1)
    const [selectedRound, setSelectedRound] = useState(1)
    const [tournamentStatus, setTournamentStatus] = useState('')

    const isSwiss = tournamentFormat === 'Swiss'

    const fetchState = useCallback(async () => {
        try {
            setLoading(true)
            const seedingRes = await fetch(`/api/tournaments/${tournamentId}/seeding`)
            const seedingData = await seedingRes.json()
            if (seedingRes.ok && seedingData.tournament) {
                const t = seedingData.tournament
                const newCurrentRound = t.current_round || 1
                setCurrentRound(newCurrentRound)
                setTotalRounds(t.total_rounds || 1)
                setTournamentStatus(t.status || '')
                setSelectedRound(newCurrentRound)
            }

            const matchesRes = await fetch(`/api/tournaments/${tournamentId}/matches`)
            const matchesData = await matchesRes.json()
            if (matchesRes.ok) {
                setMatches(matchesData.matches || [])
            }
        } catch (error) {
        } finally {
            setLoading(false)
        }
    }, [tournamentId])

    useEffect(() => {
        fetchState()
    }, [fetchState])

    const handleUpdateMatch = async (matchId: string, updates: any) => {
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/matches`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ match_id: matchId, ...updates })
            })

            if (res.ok) {
                toast({ title: 'Match Updated', description: 'Match state saved.' })
                const matchesRes = await fetch(`/api/tournaments/${tournamentId}/matches`)
                const matchesData = await matchesRes.json()
                if (matchesRes.ok) setMatches(matchesData.matches || [])
                onStateChanged?.()
            } else {
                const errorData = await res.json()
                toast({ title: 'Error', description: errorData.error, variant: 'destructive' })
            }
        } catch (e) {
            toast({ title: 'Error', description: 'Failed to update match', variant: 'destructive' })
        }
    }

    const handleAdvanceRound = async () => {
        setAdvancing(true)
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/advance`, { method: 'POST' })
            if (res.ok) {
                toast({ title: 'Round Advanced!', description: `Successfully advanced past round ${currentRound}.` })
                await fetchState()
                onStateChanged?.()
            } else {
                const errorData = await res.json()
                toast({ title: 'Cannot Advance', description: errorData.error, variant: 'destructive' })
            }
        } catch (e) {
            toast({ title: 'Error', description: 'Failed to advance round', variant: 'destructive' })
        } finally {
            setAdvancing(false)
        }
    }

    // ─── Computed data ──────────────────────────────────────────────

    // For Swiss: helper to check if a match is a "ghost" (both teams already finished)
    const isGhostMatch = useCallback((m: any) => {
        if (!isSwiss) return false
        const maxW = 3, maxL = 3
        // Compute records up to the selected round for the current view context
        const allRecords = computeTeamRecords(matches, m.bracket?.round_number || selectedRound)
        const t1 = m.team1_id ? allRecords[m.team1_id] : null
        const t2 = m.team2_id ? allRecords[m.team2_id] : null
        const t1Done = !m.team1_id || (t1 && (t1.wins >= maxW || t1.losses >= maxL))
        const t2Done = !m.team2_id || (t2 && (t2.wins >= maxW || t2.losses >= maxL))
        return t1Done && t2Done
    }, [matches, selectedRound, isSwiss])

    const displayedMatches = matches.filter(m => m.bracket?.round_number === selectedRound)
    const activeRoundMatches = matches.filter(m => m.bracket?.round_number === currentRound)
    // For advance check: exclude ghost matches
    const relevantActiveMatches = activeRoundMatches.filter(m => !isGhostMatch(m))
    const allActiveCompleted = relevantActiveMatches.length > 0 && relevantActiveMatches.every(m => m.status === 'Completed')
    const isViewingActiveRound = selectedRound === currentRound

    // Round stats (exclude ghosts)
    const roundStats = useMemo(() => {
        const relevant = displayedMatches.filter(m => !isGhostMatch(m))
        const completed = relevant.filter(m => m.status === 'Completed').length
        const live = relevant.filter(m => m.status === 'In_Progress').length
        const scheduled = relevant.filter(m => m.status === 'Scheduled').length
        return { completed, live, scheduled, total: relevant.length }
    }, [displayedMatches, isGhostMatch])

    // Swiss bucket grouping
    const teamRecords = useMemo(() => {
        if (!isSwiss) return {}
        return computeTeamRecords(matches, selectedRound)
    }, [matches, selectedRound, isSwiss])

    const matchesByBucket = useMemo(() => {
        if (!isSwiss) return null
        const maxWins = 3
        const maxLosses = 3
        const buckets: Record<string, any[]> = {}
        for (const m of displayedMatches) {
            const bucket = getMatchBucket(m, teamRecords) || '0:0'
            const [w, l] = bucket.split(':').map(Number)
            // Skip qualified (≥maxWins) and eliminated (≥maxLosses) buckets
            if (w >= maxWins || l >= maxLosses) continue
            if (!buckets[bucket]) buckets[bucket] = []
            buckets[bucket].push(m)
        }
        // Sort buckets: higher wins first, then lower losses
        const sorted = Object.entries(buckets).sort((a, b) => {
            const [aw, al] = a[0].split(':').map(Number)
            const [bw, bl] = b[0].split(':').map(Number)
            if (bw !== aw) return bw - aw
            return al - bl
        })
        return sorted
    }, [displayedMatches, teamRecords, isSwiss])

    // ─── Loading ────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="mt-6 p-8 text-center text-muted-foreground border rounded-lg bg-muted/10">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading Match Director...
            </div>
        )
    }

    // ─── Tournament completed ───────────────────────────────────────

    if (tournamentStatus === 'Completed' || currentRound > totalRounds) {
        const finalMatch = matches.find(m => m.bracket?.is_final && m.status === 'Completed')
        return (
            <div className="space-y-6 mt-6">
                <Card className="border-green-500/30 bg-green-500/5">
                    <CardContent className="py-8 text-center flex flex-col items-center justify-center">
                        <Trophy className="h-14 w-14 text-yellow-500 mb-4" />
                        <h3 className="text-2xl font-bold">Tournament Completed!</h3>
                        {finalMatch?.winner && (
                            <p className="text-lg text-primary mt-2 font-semibold">🏆 Champion: {finalMatch.winner.name}</p>
                        )}
                        <p className="text-muted-foreground mt-2">All {totalRounds} rounds have concluded.</p>
                        <div className="mt-4 flex gap-2">
                            <Select value={selectedRound.toString()} onValueChange={(v) => setSelectedRound(parseInt(v))}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: totalRounds }, (_, i) => i + 1).map(round => (
                                        <SelectItem key={round} value={round.toString()}>Round {round}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {renderMatchGrid(true)}
            </div>
        )
    }

    // ─── Render helpers ─────────────────────────────────────────────

    function renderMatchCard(match: any, readOnly = false) {
        const isCompleted = match.status === 'Completed'
        const isLive = match.status === 'In_Progress'
        const isScheduled = match.status === 'Scheduled'
        const bothTeamsReady = match.team1_id && match.team2_id

        // Card border color
        let cardClass = 'border-border hover:border-primary/30'
        if (isCompleted) cardClass = 'border-green-500/30 bg-green-500/5'
        else if (isLive) cardClass = 'border-red-500/40 bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.08)]'

        return (
            <Card key={match.id} className={`transition-all ${cardClass}`}>
                <CardHeader className="py-2.5 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-medium">Match {match.match_number}</CardTitle>
                        {match.best_of > 1 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">BO{match.best_of}</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {isLive && (
                            <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] gap-1 animate-pulse">
                                <Radio className="h-3 w-3" />
                                LIVE
                            </Badge>
                        )}
                        {isCompleted && (
                            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px] gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Done
                            </Badge>
                        )}
                        {isScheduled && (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                                <Clock className="h-3 w-3" />
                                {bothTeamsReady ? 'Ready' : 'Waiting'}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                    {renderTeamRow(match, 'team1', readOnly)}
                    <div className="border-t border-dashed" />
                    {renderTeamRow(match, 'team2', readOnly)}

                    {/* Controls Footer */}
                    {!readOnly && (
                        <div className="pt-3 border-t flex items-center justify-between gap-2">
                            {isCompleted ? (
                                <>
                                    <Badge variant="outline" className={match.result === 'Draw' ? 'border-yellow-500/50 text-yellow-400' : 'border-green-500/30 text-green-400'}>
                                        {match.result === 'Draw' ? '🤝 Draw' : '✓ Resolved'}
                                    </Badge>
                                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleUpdateMatch(match.id, { status: 'In_Progress', winner_id: null, result: null })}>
                                        ↩ Re-open
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {/* Go Live / Set Scheduled */}
                                    {isScheduled && bothTeamsReady && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                            onClick={() => handleUpdateMatch(match.id, { status: 'In_Progress' })}
                                        >
                                            <Radio className="h-3 w-3" />
                                            Go Live
                                        </Button>
                                    )}
                                    {isLive && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-xs text-muted-foreground"
                                            onClick={() => handleUpdateMatch(match.id, { status: 'Scheduled' })}
                                        >
                                            ← Back to Scheduled
                                        </Button>
                                    )}
                                    {!isScheduled && !isLive && (
                                        <span className="text-xs text-muted-foreground">Set a winner or declare a draw</span>
                                    )}
                                    {isScheduled && !bothTeamsReady && (
                                        <span className="text-xs text-muted-foreground">Waiting for teams...</span>
                                    )}

                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="text-xs border border-yellow-500/20 hover:bg-yellow-500/10 hover:text-yellow-400"
                                        onClick={() => handleUpdateMatch(match.id, { status: 'Completed', result: 'Draw', winner_id: null })}
                                        disabled={!bothTeamsReady}
                                    >
                                        🤝 Draw
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        )
    }

    function renderTeamRow(match: any, slot: 'team1' | 'team2', readOnly: boolean) {
        const team = match[slot]
        const teamId = match[`${slot}_id`]
        const isWinner = match.winner_id && match.winner_id === teamId
        const isLoser = match.status === 'Completed' && match.winner_id && match.winner_id !== teamId && teamId
        const isCompleted = match.status === 'Completed'
        const scoreKey = `${slot}_score`
        const otherSlotId = slot === 'team1' ? match.team2_id : match.team1_id

        return (
            <div className={`flex items-center justify-between ${isLoser ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 ${isWinner ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-background' : 'bg-muted'}`}>
                        {team?.team_avatar ? (
                            <Image src={getTeamAvatarUrl(team.team_avatar)!} alt="" width={36} height={36} className="object-cover w-full h-full" />
                        ) : (
                            <span className="text-xs text-muted-foreground font-mono">{slot === 'team1' ? 'T1' : 'T2'}</span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <span className={`font-semibold text-sm truncate block ${isWinner ? 'text-green-400' : ''} ${!teamId ? 'text-muted-foreground italic' : ''}`}>
                            {team?.name || 'TBD'}
                            {isWinner && ' 🏆'}
                        </span>
                        {/* Show W-L record for Swiss */}
                        {isSwiss && teamId && teamRecords[teamId] && (
                            <span className="text-[10px] text-muted-foreground">
                                {teamRecords[teamId].wins}W – {teamRecords[teamId].losses}L
                            </span>
                        )}
                    </div>
                </div>

                {teamId && !readOnly && (
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <Input
                            type="number"
                            className="w-14 h-8 text-center text-sm"
                            defaultValue={match[scoreKey] ?? 0}
                            key={`${match.id}-${scoreKey}-${match[scoreKey]}`}
                            onBlur={(e) => handleUpdateMatch(match.id, { [scoreKey]: parseInt(e.target.value) || 0 })}
                            disabled={isCompleted}
                        />
                        <Button
                            size="sm"
                            className={`h-8 text-xs px-3 ${isWinner ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                            variant={isWinner ? 'default' : 'outline'}
                            onClick={() => handleUpdateMatch(match.id, { winner_id: teamId, status: 'Completed' })}
                            disabled={isCompleted || !otherSlotId}
                        >
                            {isWinner ? '✓ Won' : 'Win'}
                        </Button>
                    </div>
                )}
            </div>
        )
    }

    function renderMatchGrid(readOnly = false) {
        if (displayedMatches.length === 0) {
            return (
                <div className="col-span-full text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                    <Trophy className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No matches in Round {selectedRound}</p>
                    <p className="text-sm mt-1">Matches for this round haven&apos;t been generated yet.</p>
                    {selectedRound !== currentRound && (
                        <Button variant="link" className="mt-2" onClick={() => setSelectedRound(currentRound)}>
                            Go to active round →
                        </Button>
                    )}
                </div>
            )
        }

        // Swiss: group matches by W-L bucket
        if (isSwiss && matchesByBucket && matchesByBucket.length > 0) {
            return (
                <div className="space-y-6">
                    {matchesByBucket.map(([bucket, bucketMatches]) => {
                        const [w, l] = bucket.split(':').map(Number)
                        const bucketCompleted = bucketMatches.filter((m: any) => m.status === 'Completed').length
                        const bucketLive = bucketMatches.filter((m: any) => m.status === 'In_Progress').length

                        return (
                            <div key={bucket}>
                                {/* Bucket Header */}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex items-center gap-2">
                                        <Swords className="h-4 w-4 text-muted-foreground" />
                                        <h4 className="text-sm font-bold">
                                            <span className="text-green-400">{w}</span>
                                            <span className="text-muted-foreground mx-0.5">:</span>
                                            <span className="text-red-400">{l}</span>
                                        </h4>
                                        <span className="text-xs text-muted-foreground">
                                            ({bucketMatches.length} match{bucketMatches.length > 1 ? 'es' : ''})
                                        </span>
                                    </div>
                                    <div className="flex-1 h-px bg-border" />
                                    <div className="flex items-center gap-2 text-[10px]">
                                        {bucketCompleted > 0 && (
                                            <span className="text-green-400 flex items-center gap-0.5">
                                                <CheckCircle2 className="h-3 w-3" /> {bucketCompleted}
                                            </span>
                                        )}
                                        {bucketLive > 0 && (
                                            <span className="text-red-400 flex items-center gap-0.5">
                                                <Radio className="h-3 w-3" /> {bucketLive}
                                            </span>
                                        )}
                                        {bucketMatches.length - bucketCompleted - bucketLive > 0 && (
                                            <span className="text-muted-foreground flex items-center gap-0.5">
                                                <Clock className="h-3 w-3" /> {bucketMatches.length - bucketCompleted - bucketLive}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Bucket Matches */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {bucketMatches.map((match: any) => renderMatchCard(match, readOnly || (!isViewingActiveRound && match.status === 'Completed')))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )
        }

        // Non-Swiss: flat grid
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedMatches.map((match) => renderMatchCard(match, readOnly || (!isViewingActiveRound && match.status === 'Completed')))}
            </div>
        )
    }

    // ─── Main render ────────────────────────────────────────────────

    return (
        <div className="space-y-4 mt-6">
            {/* Header Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-muted/30 p-4 rounded-lg border gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold">Match Director</h3>
                        <p className="text-xs text-muted-foreground">
                            Round {currentRound} of {totalRounds}
                            {allActiveCompleted && isViewingActiveRound && ' — All matches resolved ✓'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* Round Navigator */}
                    <div className="flex items-center border rounded-lg overflow-hidden">
                        <Button
                            size="icon" variant="ghost" className="h-9 w-9 rounded-none"
                            onClick={() => setSelectedRound(Math.max(1, selectedRound - 1))}
                            disabled={selectedRound <= 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="px-3 border-x text-sm font-medium min-w-[100px] text-center">
                            Round {selectedRound}
                            {selectedRound === currentRound && <span className="text-primary ml-1 text-xs">(live)</span>}
                        </div>
                        <Button
                            size="icon" variant="ghost" className="h-9 w-9 rounded-none"
                            onClick={() => setSelectedRound(Math.min(totalRounds, selectedRound + 1))}
                            disabled={selectedRound >= totalRounds}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Advance Button */}
                    {isViewingActiveRound && (
                        <Button
                            onClick={handleAdvanceRound}
                            disabled={!allActiveCompleted || advancing}
                            className={allActiveCompleted ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                        >
                            {advancing ? (
                                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Advancing...</>
                            ) : allActiveCompleted ? (
                                <>Advance Round <ArrowRight className="h-4 w-4 ml-2" /></>
                            ) : (
                                'Resolve All First'
                            )}
                        </Button>
                    )}

                    {!isViewingActiveRound && (
                        <Button variant="outline" onClick={() => setSelectedRound(currentRound)}>
                            Go to Active Round
                        </Button>
                    )}
                </div>
            </div>

            {/* Round Progress Summary */}
            {roundStats.total > 0 && (
                <div className="flex items-center gap-4 px-1">
                    <div className="flex items-center gap-6 text-xs">
                        <span className="flex items-center gap-1.5 text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {roundStats.completed} completed
                        </span>
                        <span className="flex items-center gap-1.5 text-red-400">
                            <Radio className="h-3.5 w-3.5" />
                            {roundStats.live} live
                        </span>
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {roundStats.scheduled} scheduled
                        </span>
                    </div>
                    {/* Progress bar */}
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full flex">
                            <div
                                className="bg-green-500 transition-all duration-500"
                                style={{ width: `${(roundStats.completed / roundStats.total) * 100}%` }}
                            />
                            <div
                                className="bg-red-500 transition-all duration-500"
                                style={{ width: `${(roundStats.live / roundStats.total) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Match Grid */}
            {renderMatchGrid()}
        </div>
    )
}
