'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    GripVertical, Shuffle, Trophy, Users, ArrowUp, ArrowDown,
    Loader2, BarChart3, ListChecks, AlertTriangle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'
import { getRankImage } from '@/lib/rank-utils'
import { getTeamAvatarUrl } from '@/components/ui/team-avatar'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─── Types ──────────────────────────────────────────────────────────

interface Team {
    id: string
    name: string
    team_avatar?: number
    average_rank?: string
}

interface Participant {
    id: string
    tournament_id: string
    team_id: string
    seed_number: number
    initial_bracket_position: number
    is_active: boolean
    swiss_score?: number
    team: Team
}

interface SeedingManagerProps {
    tournamentId: string
    tournamentFormat?: string
    tournamentStatus?: string
    currentRound?: number
    isLocked?: boolean
    matchData?: any[]
    onSeedingUpdate?: () => void
    onMatchesGenerated?: () => void
}

// ─── Component ──────────────────────────────────────────────────────

export default function SeedingManager({
    tournamentId,
    tournamentFormat,
    tournamentStatus,
    currentRound = 0,
    isLocked = false,
    matchData = [],
    onSeedingUpdate,
    onMatchesGenerated,
}: SeedingManagerProps) {
    const { toast } = useToast()
    const [participants, setParticipants] = useState<Participant[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [editingSeed, setEditingSeed] = useState<string | null>(null)
    const [newSeedValue, setNewSeedValue] = useState('')
    const [draggedTeamId, setDraggedTeamId] = useState<string | null>(null)
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
    const [needsGeneration, setNeedsGeneration] = useState(false)
    const [canRegenerate, setCanRegenerate] = useState(false)
    const [showRewindDialog, setShowRewindDialog] = useState(false)

    const fetchSeeding = useCallback(async (silent = false) => {
        if (!silent) setLoading(true)
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/seeding`)
            if (res.ok) {
                const data = await res.json()
                setParticipants(data.participants || [])
            }
        } catch (err) {
            console.error('Error fetching seeding:', err)
        } finally {
            if (!silent) setLoading(false)
        }
    }, [tournamentId])

    useEffect(() => { fetchSeeding() }, [fetchSeeding])

    // Check if current round needs match generation
    const checkNeedsGeneration = useCallback(async () => {
        if (tournamentFormat !== 'Swiss' || !tournamentStatus || tournamentStatus === 'Registration' || tournamentStatus === 'Seeding') {
            setNeedsGeneration(false)
            setCanRegenerate(false)
            return
        }
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/swiss-approve`)
            if (res.ok) {
                const data = await res.json()
                setNeedsGeneration(data.needs_generation)
                setCanRegenerate(data.can_regenerate || false)
            }
        } catch { /* ignore */ }
    }, [tournamentId, tournamentFormat, tournamentStatus])

    useEffect(() => { checkNeedsGeneration() }, [checkNeedsGeneration, matchData, currentRound])

    const handleGenerateMatches = async () => {
        setActionLoading('generate-matches')
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/swiss-approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ round_number: currentRound }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed')
            setNeedsGeneration(false)
            onMatchesGenerated?.()
            onSeedingUpdate?.()
            toast({ title: 'Matches Generated', description: data.message })
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
            setActionLoading(null)
        }
    }

    const handleRewindRound = async () => {
        setActionLoading('rewind')
        setShowRewindDialog(false)
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/rewind`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to rewind')

            // Update local state and notify parent
            onMatchesGenerated?.() // This usually triggers a tournament fetch in the parent
            onSeedingUpdate?.()
            toast({
                title: 'Round Rewound',
                description: data.message || `Tournament rolled back to Round ${currentRound - 1}.`,
            })
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
            setActionLoading(null)
        }
    }

    // ─── Actions ────────────────────────────────────────────────────

    const doSeedingAction = async (action: string, payload: Record<string, any> = {}, label: string) => {
        setActionLoading(action)
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/seeding`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...payload }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Failed')
            }
            await fetchSeeding(true)
            onSeedingUpdate?.()
            toast({ title: 'Updated', description: label })
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
            fetchSeeding(true)
        } finally {
            setActionLoading(null)
        }
    }

    const handleMoveToPosition = (teamId: string, position: number) => {
        if (position < 1 || position > participants.length) return
        // Optimistic update
        const idx = participants.findIndex(p => p.team_id === teamId)
        if (idx !== -1) {
            const next = [...participants]
            const [moved] = next.splice(idx, 1)
            next.splice(position - 1, 0, moved)
            setParticipants(next.map((p, i) => ({ ...p, seed_number: i + 1 })))
        }
        doSeedingAction('move_to_position', { team_id: teamId, position }, 'Seed position updated')
    }

    const handleRandomize = () => {
        const shuffled = [...participants].sort(() => Math.random() - 0.5)
        setParticipants(shuffled.map((p, i) => ({ ...p, seed_number: i + 1 })))
        doSeedingAction('randomize_seeds', {}, 'Seeds randomized')
    }

    const handleSeedByRank = () => {
        doSeedingAction('seed_by_rank', {}, 'Seeded by rank')
    }

    // ─── Drag & Drop ───────────────────────────────────────────────

    const handleDragStart = (e: React.DragEvent, teamId: string) => {
        if (isLocked) return
        e.dataTransfer.setData('text/plain', teamId)
        e.dataTransfer.effectAllowed = 'move'
        setDraggedTeamId(teamId)
    }

    const handleDragOver = (e: React.DragEvent, seedNumber: number) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOverIndex(seedNumber)
    }

    const handleDrop = (e: React.DragEvent, targetSeedNumber: number, targetTeamId?: string) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOverIndex(null)
        const draggedId = draggedTeamId || e.dataTransfer.getData('text/plain')
        if (!draggedId || draggedId === targetTeamId || isLocked) {
            setDraggedTeamId(null)
            return
        }
        handleMoveToPosition(draggedId, targetSeedNumber)
        setDraggedTeamId(null)
    }

    const handleDragEnd = () => {
        setDraggedTeamId(null)
        setDragOverIndex(null)
    }

    // ─── W-L Records ──────────────────────────────────────────────

    const computeRecords = useCallback((): Record<string, { wins: number; losses: number }> => {
        const records: Record<string, { wins: number; losses: number }> = {}
        for (const m of matchData) {
            if (m.status !== 'Completed' || !m.result) continue
            if (m.team1_id && !records[m.team1_id]) records[m.team1_id] = { wins: 0, losses: 0 }
            if (m.team2_id && !records[m.team2_id]) records[m.team2_id] = { wins: 0, losses: 0 }
            if (m.result === 'Team1_Win') {
                if (m.team1_id) records[m.team1_id].wins++
                if (m.team2_id) records[m.team2_id].losses++
            } else if (m.result === 'Team2_Win') {
                if (m.team2_id) records[m.team2_id].wins++
                if (m.team1_id) records[m.team1_id].losses++
            }
        }
        return records
    }, [matchData])

    // ─── Rendering ────────────────────────────────────────────────

    if (loading) {
        return (
            <Card>
                <CardContent className="py-12 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    if (participants.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Seeding Yet</h3>
                    <p className="text-muted-foreground text-sm mb-4">Generate seeding from approved registrations to begin.</p>
                </CardContent>
            </Card>
        )
    }

    const records = computeRecords()
    const maxWins = 3, maxLosses = 3

    // Categorize teams
    const eliminatedTeamIds = new Set<string>()
    const qualifiedTeamIds = new Set<string>()

    if (tournamentFormat === 'Swiss') {
        for (const [tid, rec] of Object.entries(records)) {
            if (rec.losses >= maxLosses) eliminatedTeamIds.add(tid)
            if (rec.wins >= maxWins) qualifiedTeamIds.add(tid)
        }
    } else {
        for (const m of matchData) {
            if (m.status === 'Completed' && m.winner_id) {
                if (m.team1_id && m.team1_id !== m.winner_id) eliminatedTeamIds.add(m.team1_id)
                if (m.team2_id && m.team2_id !== m.winner_id) eliminatedTeamIds.add(m.team2_id)
            }
        }
    }

    const activeParticipants = participants.filter(p => !eliminatedTeamIds.has(p.team_id) && !qualifiedTeamIds.has(p.team_id))
    const qualifiedParticipants = participants.filter(p => qualifiedTeamIds.has(p.team_id))
    const eliminatedParticipants = participants.filter(p => eliminatedTeamIds.has(p.team_id))

    // Swiss buckets
    const buckets: Record<string, Participant[]> = {}
    if (tournamentFormat === 'Swiss') {
        for (const p of activeParticipants) {
            const rec = records[p.team_id] || { wins: 0, losses: 0 }
            const key = `${rec.wins}:${rec.losses}`
            if (!buckets[key]) buckets[key] = []
            buckets[key].push(p)
        }
    }
    const sortedBuckets = Object.entries(buckets).sort((a, b) => {
        const [aw, al] = a[0].split(':').map(Number)
        const [bw, bl] = b[0].split(':').map(Number)
        return bw !== aw ? bw - aw : al - bl
    })

    const renderTeamRow = (participant: Participant, idx: number, isGrouped = false) => {
        const rec = records[participant.team_id]
        const isDragged = draggedTeamId === participant.team_id
        const isDragOver = dragOverIndex === participant.seed_number

        return (
            <div
                key={participant.id}
                draggable={!isLocked}
                onDragStart={(e) => handleDragStart(e, participant.team_id)}
                onDragOver={(e) => handleDragOver(e, participant.seed_number)}
                onDrop={(e) => handleDrop(e, participant.seed_number, participant.team_id)}
                onDragEnd={handleDragEnd}
                className={`
          flex items-center gap-3 p-3 rounded-lg border transition-all group
          ${!isLocked ? 'cursor-grab hover:border-primary/40 hover:bg-muted/30' : 'cursor-default'}
          ${isDragged ? 'opacity-40 scale-[0.98] border-primary' : 'border-border'}
          ${isDragOver && !isDragged ? 'border-primary/60 bg-primary/5' : ''}
        `}
            >
                {!isLocked && (
                    <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
                )}

                {/* Seed Number */}
                <div className="relative">
                    {editingSeed === participant.id ? (
                        <input
                            autoFocus
                            type="number"
                            className="w-10 h-8 rounded border bg-background px-1.5 text-sm font-bold focus:ring-1 focus:ring-primary outline-none text-center"
                            value={newSeedValue}
                            onChange={(e) => setNewSeedValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleMoveToPosition(participant.team_id, parseInt(newSeedValue))
                                    setEditingSeed(null)
                                } else if (e.key === 'Escape') {
                                    setEditingSeed(null)
                                }
                            }}
                            onBlur={() => setEditingSeed(null)}
                        />
                    ) : (
                        <div
                            onClick={() => {
                                if (!isLocked) {
                                    setEditingSeed(participant.id)
                                    setNewSeedValue(participant.seed_number.toString())
                                }
                            }}
                            className={`
                flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs flex-shrink-0 transition-all
                ${!isLocked ? 'cursor-pointer hover:bg-primary hover:text-primary-foreground' : ''}
                bg-primary/10 text-primary
              `}
                            title={!isLocked ? 'Click to edit seed' : ''}
                        >
                            {participant.seed_number}
                        </div>
                    )}
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {participant.team?.team_avatar ? (
                        <Image
                            src={getTeamAvatarUrl(participant.team.team_avatar)!}
                            alt="" width={36} height={36}
                            className="w-full h-full object-cover"
                            unoptimized={process.env.NODE_ENV === 'development'}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{participant.team?.name}</p>
                    {participant.team?.average_rank && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <Image src={getRankImage(participant.team.average_rank)} alt="" width={14} height={14} />
                            <span className="text-xs text-muted-foreground">{participant.team.average_rank}</span>
                        </div>
                    )}
                </div>

                {/* W-L badge */}
                {rec && isGrouped && (
                    <span className="text-xs font-mono text-muted-foreground">
                        <span className="text-green-400">{rec.wins}</span>
                        <span className="mx-0.5">:</span>
                        <span className="text-red-400">{rec.losses}</span>
                    </span>
                )}

                {/* Up/Down buttons */}
                {!isLocked && (
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => handleMoveToPosition(participant.team_id, participant.seed_number - 1)}
                            disabled={participant.seed_number <= 1 || !!actionLoading}
                        >
                            <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => handleMoveToPosition(participant.team_id, participant.seed_number + 1)}
                            disabled={participant.seed_number >= participants.length || !!actionLoading}
                        >
                            <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}
            </div>
        )
    }

    const renderStatusSection = (
        title: string,
        teams: Participant[],
        dotColor: string,
        textColor: string,
        bgColor: string,
        borderColor: string,
        opacity: string,
    ) => {
        if (teams.length === 0) return null
        return (
            <div>
                <div className="flex items-center gap-2 mb-2 mt-4">
                    <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider ${textColor}`}>
                        {title} ({teams.length})
                    </span>
                    <div className={`flex-1 h-px ${borderColor}`} />
                </div>
                <div className={`space-y-1.5 pl-3 ${opacity}`}>
                    {teams.map(p => {
                        const rec = records[p.team_id] || { wins: 0, losses: 0 }
                        return (
                            <div key={p.id} className={`flex items-center gap-3 p-2 rounded-md ${bgColor} border ${borderColor}`}>
                                <div className="w-7 h-7 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                    {p.team?.team_avatar ? (
                                        <Image src={getTeamAvatarUrl(p.team.team_avatar)!} alt="" width={28} height={28} className="w-full h-full object-cover" unoptimized={process.env.NODE_ENV === 'development'} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center"><Users className="h-3.5 w-3.5 text-muted-foreground" /></div>
                                    )}
                                </div>
                                <span className={`text-sm font-medium truncate flex-1 ${title === 'Eliminated' ? 'line-through' : ''}`}>{p.team?.name}</span>
                                <span className={`text-xs font-mono ${textColor}`}>{rec.wins}:{rec.losses}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-primary" />
                            {tournamentFormat === 'Swiss' && currentRound > 0 ? `Round ${currentRound} Seeding` : 'Seeding'}
                            <Badge variant="outline" className="ml-1 text-xs font-normal">
                                {activeParticipants.length} active / {participants.length} total
                            </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                            {isLocked
                                ? 'Seeding is locked while tournament is running.'
                                : 'Drag teams to reorder. Click seed numbers to edit directly.'}
                        </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                        {currentRound > 1 && !isLocked && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowRewindDialog(true)}
                                disabled={!!actionLoading}
                                className="text-amber-500 hover:text-amber-400 border-amber-500/20 hover:bg-amber-500/10 h-8 text-xs"
                            >
                                {actionLoading === 'rewind' ? (
                                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                ) : (
                                    <AlertTriangle className="h-3 w-3 mr-1.5" />
                                )}
                                Rewind Round
                            </Button>
                        )}
                        {!isLocked && (
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm" variant="outline"
                                    onClick={handleRandomize}
                                    disabled={!!actionLoading}
                                    className="text-xs h-8"
                                >
                                    {actionLoading === 'randomize_seeds' ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Shuffle className="h-3 w-3 mr-1.5" />}
                                    Shuffle
                                </Button>
                                <Button
                                    size="sm" variant="outline"
                                    onClick={handleSeedByRank}
                                    disabled={!!actionLoading}
                                    className="text-xs h-8"
                                >
                                    {actionLoading === 'seed_by_rank' ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <BarChart3 className="h-3 w-3 mr-1.5" />}
                                    By Rank
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>

            {/* Generate Matches Banner */}
            {needsGeneration && (
                <div className="mx-6 mb-4 p-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <ListChecks className="h-5 w-5 text-amber-400 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-amber-300">Ready to Generate Round {currentRound} Matches</p>
                            <p className="text-xs text-muted-foreground">Review the seeding above, then generate matches based on this order.</p>
                        </div>
                    </div>
                    <Button
                        onClick={handleGenerateMatches}
                        disabled={actionLoading === 'generate-matches'}
                        className="gap-1.5 shrink-0"
                    >
                        {actionLoading === 'generate-matches'
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <ListChecks className="h-4 w-4" />
                        }
                        Generate Matches
                    </Button>
                </div>
            )}

            {/* Regenerate Matches Banner */}
            {!needsGeneration && canRegenerate && (
                <div className="mx-6 mb-4 p-3 rounded-lg border border-muted-foreground/20 bg-muted/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <ListChecks className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <p className="text-xs text-muted-foreground">Round {currentRound} matches generated. Adjust seeding and regenerate if needed.</p>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGenerateMatches}
                        disabled={actionLoading === 'generate-matches'}
                        className="gap-1.5 shrink-0 text-xs h-8"
                    >
                        {actionLoading === 'generate-matches'
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <ListChecks className="h-3.5 w-3.5" />
                        }
                        Regenerate
                    </Button>
                </div>
            )}

            <CardContent>
                {/* Loading overlay */}
                <div className="relative">
                    {actionLoading && (
                        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/40 rounded-lg backdrop-blur-[1px]">
                            <div className="flex items-center gap-2 px-4 py-2 bg-card border rounded-xl shadow-xl">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground">Updating...</span>
                            </div>
                        </div>
                    )}

                    {/* Qualified */}
                    {renderStatusSection('Qualified', qualifiedParticipants, 'bg-green-500', 'text-green-400', 'bg-green-500/5', 'border-green-500/15', 'opacity-60')}

                    {/* Active teams */}
                    {tournamentFormat === 'Swiss' && sortedBuckets.length > 0 ? (
                        <div className="space-y-4 mt-2">
                            {sortedBuckets.map(([bucket, bucketTeams]) => {
                                const [w, l] = bucket.split(':').map(Number)
                                return (
                                    <div key={bucket}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm font-bold">
                                                <span className="text-green-400">{w}</span>
                                                <span className="text-muted-foreground mx-0.5">:</span>
                                                <span className="text-red-400">{l}</span>
                                            </span>
                                            <span className="text-xs text-muted-foreground">({bucketTeams.length})</span>
                                            <div className="flex-1 h-px bg-border" />
                                        </div>
                                        <div className="space-y-1.5">
                                            {bucketTeams.map((p, i) => renderTeamRow(p, i, true))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="space-y-1.5 mt-2">
                            {activeParticipants.map((p, i) => renderTeamRow(p, i))}
                        </div>
                    )}

                    {/* Eliminated */}
                    {renderStatusSection('Eliminated', eliminatedParticipants, 'bg-red-500', 'text-red-400', 'bg-red-500/5', 'border-red-500/15', 'opacity-40')}
                </div>
            </CardContent>

            {/* Rewind Confirmation */}
            <AlertDialog open={showRewindDialog} onOpenChange={setShowRewindDialog}>
                <AlertDialogContent className="border-amber-500/20">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-amber-500 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Rewind to Round {currentRound - 1}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will <strong className="text-foreground">permanently delete all matches</strong> that were generated for Round {currentRound} and rollback the tournament to its state in Round {currentRound - 1}.
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
        </Card>
    )
}
