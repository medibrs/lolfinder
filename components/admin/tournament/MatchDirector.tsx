'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Trophy, ArrowRight, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'
import { getTeamAvatarUrl } from '@/components/ui/team-avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface MatchDirectorProps {
    tournamentId: string
    onStateChanged?: () => void  // callback to let parent know something changed
}

export default function MatchDirector({ tournamentId, onStateChanged }: MatchDirectorProps) {
    const { toast } = useToast()
    const [matches, setMatches] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [advancing, setAdvancing] = useState(false)
    const [currentRound, setCurrentRound] = useState(1)
    const [totalRounds, setTotalRounds] = useState(1)
    const [selectedRound, setSelectedRound] = useState(1)
    const [tournamentStatus, setTournamentStatus] = useState('')

    // Fetch everything the director needs
    const fetchState = useCallback(async () => {
        try {
            setLoading(true)

            // Fetch tournament state
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

            // Fetch matches
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
                // Refresh matches in-place
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
            const res = await fetch(`/api/tournaments/${tournamentId}/advance`, {
                method: 'POST'
            })
            if (res.ok) {
                toast({ title: 'Round Advanced!', description: `Successfully advanced past round ${currentRound}.` })
                // Re-fetch everything — this updates currentRound, selectedRound, matches
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

    if (loading) {
        return (
            <div className="mt-6 p-8 text-center text-muted-foreground border rounded-lg bg-muted/10">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading Match Director...
            </div>
        )
    }

    // Filter matches for the selected round
    const displayedMatches = matches.filter(m => m.bracket?.round_number === selectedRound)
    const activeRoundMatches = matches.filter(m => m.bracket?.round_number === currentRound)
    const allActiveCompleted = activeRoundMatches.length > 0 && activeRoundMatches.every(m => m.status === 'Completed')
    const isViewingActiveRound = selectedRound === currentRound

    // Tournament completed state
    if (tournamentStatus === 'Completed' || currentRound > totalRounds) {
        // Find the champion (winner of final match)
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

                {/* Show historical matches */}
                {displayedMatches.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {displayedMatches.map((match) => renderMatchCard(match, true))}
                    </div>
                )}
            </div>
        )
    }

    function renderMatchCard(match: any, readOnly = false) {
        const isCompleted = match.status === 'Completed'
        return (
            <Card key={match.id} className={`transition-all ${isCompleted ? 'border-green-500/30 bg-green-500/5' : 'border-border hover:border-primary/30'}`}>
                <CardHeader className="py-3 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">Match {match.match_number}</CardTitle>
                    <div className="flex items-center gap-2">
                        {match.best_of > 1 && <Badge variant="outline" className="text-xs">BO{match.best_of}</Badge>}
                        <Badge
                            variant={isCompleted ? 'default' : 'secondary'}
                            className={isCompleted ? 'bg-green-500/15 text-green-400 border-green-500/30' : ''}
                        >
                            {isCompleted ? '✓ Done' : match.team1_id && match.team2_id ? 'Ready' : 'Waiting'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                    {/* Team Row Renderer */}
                    {renderTeamRow(match, 'team1', readOnly)}
                    <div className="border-t border-dashed" />
                    {renderTeamRow(match, 'team2', readOnly)}

                    {/* Controls Footer */}
                    {!readOnly && (
                        <div className="pt-3 border-t flex items-center justify-between">
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
                                    <span className="text-xs text-muted-foreground">Set a winner or declare a draw</span>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="text-xs border border-yellow-500/20 hover:bg-yellow-500/10 hover:text-yellow-400"
                                        onClick={() => handleUpdateMatch(match.id, { status: 'Completed', result: 'Draw', winner_id: null })}
                                        disabled={!match.team1_id || !match.team2_id}
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
        const isCompleted = match.status === 'Completed'
        const scoreKey = `${slot}_score`
        const otherSlotId = slot === 'team1' ? match.team2_id : match.team1_id

        return (
            <div className="flex items-center justify-between">
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
                            Round {currentRound} of {totalRounds} active
                            {allActiveCompleted && isViewingActiveRound && ' — All matches resolved ✓'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* Round Navigator */}
                    <div className="flex items-center border rounded-lg overflow-hidden">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 rounded-none"
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
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 rounded-none"
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
                                'Resolve All Matches First'
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

            {/* Match Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedMatches.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                        <Trophy className="h-8 w-8 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No matches in Round {selectedRound}</p>
                        <p className="text-sm mt-1">Matches for this round haven't been generated yet.</p>
                        {selectedRound !== currentRound && (
                            <Button variant="link" className="mt-2" onClick={() => setSelectedRound(currentRound)}>
                                Go to active round →
                            </Button>
                        )}
                    </div>
                ) : displayedMatches.map((match) => renderMatchCard(match, !isViewingActiveRound && match.status === 'Completed'))}
            </div>
        </div>
    )
}
