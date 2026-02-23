'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowUp, ArrowDown, Shuffle, Trophy, Users,
  Play, RotateCcw, GripVertical, Crown, AlertTriangle,
  ChevronRight, Check, X
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'
import { getRankImage } from '@/lib/rank-utils'
import { getTeamAvatarUrl } from '@/components/ui/team-avatar'
import MatchDirector from './MatchDirector'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SingleEliminationBracketPreview } from '@/components/tournament/single-elimination-bracket-preview'
import { SwissBracketPreview } from '@/components/tournament/swiss-bracket-preview'
import { buildSwissBracketData } from '@/lib/swiss-bracket-data'

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
  team: Team
}

interface BracketManagerProps {
  tournamentId: string
  tournamentStatus?: string
  tournamentFormat?: string
  maxTeams: number
}

export default function BracketManager({
  tournamentId,
  tournamentStatus,
  tournamentFormat,
  maxTeams
}: BracketManagerProps) {
  const { toast } = useToast()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [tournament, setTournament] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [bracketGenerated, setBracketGenerated] = useState(false)
  const [canEditSeeding, setCanEditSeeding] = useState(true)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [draggedItem, setDraggedItem] = useState<number | null>(null)
  const [approvedCount, setApprovedCount] = useState(0)
  const [matchData, setMatchData] = useState<any[]>([])

  useEffect(() => {
    fetchSeeding()
  }, [tournamentId])

  const fetchSeeding = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const response = await fetch(`/api/tournaments/${tournamentId}/seeding`)
      const data = await response.json()

      if (response.ok) {
        setParticipants(data.participants || [])
        setTournament(data.tournament)
        setBracketGenerated(data.bracket_generated)
        setCanEditSeeding(data.can_edit_seeding)
        setApprovedCount(data.approved_count || 0)

        // If bracket is generated, also fetch match data for the live preview
        if (data.bracket_generated) {
          await fetchMatchData()
        }
      }
    } catch (error) {

    } finally {
      if (!silent) setLoading(false)
    }
  }

  const fetchMatchData = async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/matches`)
      const data = await res.json()
      if (res.ok) {
        setMatchData(data.matches || [])
      }
    } catch (error) {

    }
  }

  const handleStateChanged = async () => {
    // Re-fetch in background — no loading spinner flash
    await fetchMatchData()
    await fetchSeeding(true)
  }

  const handleGenerateSeeding = async (method: 'random' | 'rank') => {
    setActionLoading('generate_seeding')
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_seeding', seeding_method: method })
      })

      const data = await response.json()

      if (response.ok) {
        toast({ title: 'Success', description: `Seeding generated (${method})` })
        // Use response data directly instead of re-fetching
        if (data.participants) {
          setParticipants(data.participants)
        }
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate seeding', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleGenerateBracket = async () => {
    setActionLoading('generate_bracket')
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_bracket' })
      })

      const data = await response.json()

      if (response.ok) {
        toast({ title: 'Success', description: 'Bracket generated successfully!' })
        setBracketGenerated(true)
        setCanEditSeeding(false)
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate bracket', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleResetBracket = async () => {
    setActionLoading('reset_bracket')
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_bracket' })
      })

      const data = await response.json()

      if (response.ok) {
        toast({ title: 'Success', description: 'Bracket reset. You can now edit seeding.' })
        setBracketGenerated(false)
        setCanEditSeeding(true)
        setShowResetDialog(false)
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to reset bracket', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  const attemptAutoRegenerateIfSafe = async () => {
    if (!bracketGenerated || !tournament?.current_round || !matchData) return false;
    if (tournamentFormat === 'Single_Elimination' && tournament.current_round !== 1) return false;

    const isSwiss = tournamentFormat === 'Swiss';
    const currentRoundMatches = matchData.filter(m => m.bracket?.round_number === tournament.current_round);
    const matchesToCheck = isSwiss ? currentRoundMatches : matchData;

    if (matchesToCheck.length === 0 || matchesToCheck.some(m => m.status !== 'Scheduled')) return false;

    try {
      const resp = await fetch(`/api/tournaments/${tournamentId}/bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_round' })
      });
      return resp.ok;
    } catch (e) { return false; }
  }

  const handleSwapSeeds = async (team1Id: string, team2Id: string) => {
    // Optimistic update
    const idx1 = participants.findIndex(p => p.team_id === team1Id)
    const idx2 = participants.findIndex(p => p.team_id === team2Id)
    if (idx1 !== -1 && idx2 !== -1) {
      const newParticipants = [...participants]
      const temp = newParticipants[idx1].seed_number
      newParticipants[idx1] = { ...newParticipants[idx1], seed_number: newParticipants[idx2].seed_number }
      newParticipants[idx2] = { ...newParticipants[idx2], seed_number: temp }
      newParticipants.sort((a, b) => a.seed_number - b.seed_number)
      setParticipants(newParticipants)
    }

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/bracket`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'swap_seeds', team1_id: team1Id, team2_id: team2Id })
      })
      if (!response.ok) {
        let errStr = "API error"
        try { const err = await response.json(); errStr = err.error || errStr; } catch (e) { }
        throw new Error(errStr)
      }

      // Try auto regenerating bracket changes (for SE completely, for Swiss current round)
      const regenerated = await attemptAutoRegenerateIfSafe();

      // Refresh local state to ensure active buckets update properly
      await fetchSeeding(true)
      await fetchMatchData()

      if (regenerated) {
        toast({ title: 'Matches Updated', description: 'Bracket dynamically re-paired to match new seeding.' })
      }
    } catch (error: any) {
      console.error("Swap Error:", error)
      toast({ title: 'Error', description: String(error.message || error) || 'Failed to swap seeds', variant: 'destructive' })
      fetchSeeding() // Revert on error
    }
  }

  const handleMoveSeed = async (teamId: string, direction: 'up' | 'down') => {
    // Optimistic update
    const currentIdx = participants.findIndex(p => p.team_id === teamId)
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1

    if (currentIdx !== -1 && targetIdx >= 0 && targetIdx < participants.length) {
      const newParticipants = [...participants]
      const currentSeed = newParticipants[currentIdx].seed_number
      const targetSeed = newParticipants[targetIdx].seed_number
      newParticipants[currentIdx] = { ...newParticipants[currentIdx], seed_number: targetSeed }
      newParticipants[targetIdx] = { ...newParticipants[targetIdx], seed_number: currentSeed }
      newParticipants.sort((a, b) => a.seed_number - b.seed_number)
      setParticipants(newParticipants)
    }

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/seeding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: direction === 'up' ? 'move_up' : 'move_down', team_id: teamId })
      })
      if (!response.ok) {
        let errStr = "API error"
        try { const err = await response.json(); errStr = err.error || errStr; } catch (e) { }
        throw new Error(errStr)
      }

      // Try auto regenerating bracket
      const regenerated = await attemptAutoRegenerateIfSafe();

      // Refresh local state
      await fetchSeeding(true)
      await fetchMatchData()

      if (regenerated) {
        toast({ title: 'Matches Updated', description: 'Bracket dynamically re-paired to match new seeding.' })
      }
    } catch (error: any) {
      console.error("Move Error:", error)
      toast({ title: 'Error', description: String(error.message || error) || 'Failed to move seed', variant: 'destructive' })
      fetchSeeding() // Revert on error
    }
  }

  const handleRandomizeSeeds = async () => {
    setActionLoading('randomize')

    // Optimistic update - shuffle locally
    const shuffled = [...participants].sort(() => Math.random() - 0.5)
    const reseeded = shuffled.map((p, idx) => ({ ...p, seed_number: idx + 1 }))
    setParticipants(reseeded)

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/bracket`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'randomize_seeds' })
      })

      if (response.ok) {
        toast({ title: 'Success', description: 'Seeds randomized' })
      } else {
        // Revert on error by re-fetching
        fetchSeeding()
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to randomize seeds', variant: 'destructive' })
      fetchSeeding() // Revert on error
    } finally {
      setActionLoading(null)
    }
  }

  const handleSeedByRank = async () => {
    setActionLoading('seed_by_rank')

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/bracket`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_by_rank' })
      })

      const data = await response.json()

      if (response.ok) {
        toast({ title: 'Success', description: 'Seeds ordered by tier' })
        // Use response data directly - already sorted by tier
        if (data.participants) {
          setParticipants(data.participants)
        }
      } else {
        toast({ title: 'Error', description: 'Failed to order by tier', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to seed by tier', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  // Drag and drop handlers — use team_id instead of index so it works with filtered lists
  const [draggedTeamId, setDraggedTeamId] = useState<string | null>(null)

  const handleDragStart = (index: number, teamId?: string) => {
    if (teamId) {
      setDraggedTeamId(teamId)
    }
    setDraggedItem(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, targetIndex: number, targetTeamId?: string) => {
    e.preventDefault()

    // New team-id-based swap (works with filtered lists)
    if (draggedTeamId && targetTeamId && draggedTeamId !== targetTeamId) {
      await handleSwapSeeds(draggedTeamId, targetTeamId)
      setDraggedTeamId(null)
      setDraggedItem(null)
      return
    }

    // Legacy index-based swap (for pre-bracket seeding list)
    if (draggedItem === null || draggedItem === targetIndex) return
    if (!canEditSeeding) return

    const draggedParticipant = participants[draggedItem]
    const targetParticipant = participants[targetIndex]

    if (draggedParticipant && targetParticipant) {
      await handleSwapSeeds(draggedParticipant.team_id, targetParticipant.team_id)
    }

    setDraggedItem(null)
    setDraggedTeamId(null)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Card className={bracketGenerated ? 'border-green-500/50 bg-green-500/5' : 'border-yellow-500/50 bg-yellow-500/5'}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {bracketGenerated ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              <div>
                <p className="font-medium">
                  {bracketGenerated ? 'Bracket Generated' : 'Bracket Not Generated'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {bracketGenerated
                    ? 'Tournament is ready to start. Reset bracket to modify seeding.'
                    : participants.length > 0
                      ? 'Review seeding and generate bracket when ready.'
                      : `${approvedCount} teams ready for seeding.`}
                </p>
              </div>
            </div>
            <Badge variant={bracketGenerated ? 'default' : 'secondary'}>
              {bracketGenerated ? participants.length : approvedCount} / {maxTeams} teams
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Bracket Actions
          </CardTitle>
          <CardDescription>
            Generate and manage tournament bracket
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Generate Seeding */}
          <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
              1
            </div>
            <div className="flex-1">
              <h4 className="font-medium mb-1">Generate Seeding</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Create initial seeding from approved team registrations
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleGenerateSeeding('random')}
                  disabled={actionLoading !== null || bracketGenerated}
                >
                  <Shuffle className="h-4 w-4 mr-2" />
                  Random Seeding
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleGenerateSeeding('rank')}
                  disabled={actionLoading !== null || bracketGenerated}
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Seed by Tier
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2: Adjust Seeding */}
          <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
              2
            </div>
            <div className="flex-1">
              <h4 className="font-medium mb-1">Adjust Seeding (Optional)</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Manually reorder teams by dragging or using arrows below
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleRandomizeSeeds}
                  disabled={actionLoading !== null || !canEditSeeding || participants.length === 0}
                >
                  <Shuffle className="h-4 w-4 mr-2" />
                  Shuffle
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSeedByRank}
                  disabled={actionLoading !== null || !canEditSeeding || participants.length === 0}
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Order by Tier
                </Button>
              </div>
            </div>
          </div>

          {/* Step 3: Generate Bracket */}
          <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
              3
            </div>
            <div className="flex-1">
              <h4 className="font-medium mb-1">Generate Bracket</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Create the tournament bracket with current seeding ({tournamentFormat?.replace('_', ' ')})
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleGenerateBracket}
                  disabled={actionLoading !== null || bracketGenerated || participants.length < 2}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Generate Bracket
                </Button>
                {bracketGenerated && (
                  <Button
                    variant="destructive"
                    onClick={() => setShowResetDialog(true)}
                    disabled={actionLoading !== null}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Bracket
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Render Match Director + Seeding + Bracket Preview when generated, otherwise just seeding */}
      {bracketGenerated ? (
        <div className="space-y-6">
          <MatchDirector
            tournamentId={tournamentId}
            tournamentFormat={tournamentFormat}
            onStateChanged={handleStateChanged}
          />

          <Card className="border-zinc-800 bg-zinc-950/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Bracket Preview
              </CardTitle>
              <CardDescription>
                Visual overview of the bracket structure for this tournament.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto pb-6">
              <div className="min-w-max">
                {tournamentFormat === 'Swiss' ? (
                  <SwissBracketPreview
                    data={buildSwissBracketData(
                      { ...tournament, id: tournamentId },
                      participants,
                      matchData
                    )}
                  />
                ) : (
                  <SingleEliminationBracketPreview
                    teams={participants.map(p => p.team).filter(Boolean)}
                    teamCount={maxTeams}
                    matchData={bracketGenerated ? matchData : undefined}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Seeding List — always accessible for admin overrides */}
          {(() => {
            // Compute eliminated/qualified teams from match data
            const eliminatedTeamIds = new Set<string>()
            const qualifiedTeamIds = new Set<string>()

            if (tournamentFormat === 'Swiss') {
              // Swiss: compute W-L records — eliminated at maxLosses, qualified at maxWins
              const maxWins = 3, maxLosses = 3
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
              for (const [tid, rec] of Object.entries(records)) {
                if (rec.losses >= maxLosses) eliminatedTeamIds.add(tid)
                if (rec.wins >= maxWins) qualifiedTeamIds.add(tid)
              }
            } else {
              // Single Elimination: any loss = eliminated
              for (const m of matchData) {
                if (m.status === 'Completed' && m.winner_id) {
                  if (m.team1_id && m.team1_id !== m.winner_id) eliminatedTeamIds.add(m.team1_id)
                  if (m.team2_id && m.team2_id !== m.winner_id) eliminatedTeamIds.add(m.team2_id)
                }
              }
            }
            const activeParticipants = participants.filter(p => !eliminatedTeamIds.has(p.team_id) && !qualifiedTeamIds.has(p.team_id))

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Active Teams ({activeParticipants.length}/{participants.length})
                  </CardTitle>
                  <CardDescription>
                    {(qualifiedTeamIds.size > 0 || eliminatedTeamIds.size > 0)
                      ? `${qualifiedTeamIds.size > 0 ? `${qualifiedTeamIds.size} qualified` : ''}${qualifiedTeamIds.size > 0 && eliminatedTeamIds.size > 0 ? ', ' : ''}${eliminatedTeamIds.size > 0 ? `${eliminatedTeamIds.size} eliminated` : ''}. Drag to reorder remaining seeding.`
                      : 'Drag teams to reorder seeding. Changes here affect future round pairings.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {tournamentFormat === 'Swiss' ? (() => {
                    // Group active teams by W-L record
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

                    // Build buckets
                    const buckets: Record<string, typeof activeParticipants> = {}
                    for (const p of activeParticipants) {
                      const rec = records[p.team_id] || { wins: 0, losses: 0 }
                      const key = `${rec.wins}:${rec.losses}`
                      if (!buckets[key]) buckets[key] = []
                      buckets[key].push(p)
                    }

                    // Sort buckets: higher wins first, then lower losses
                    const sortedBuckets = Object.entries(buckets).sort((a, b) => {
                      const [aw, al] = a[0].split(':').map(Number)
                      const [bw, bl] = b[0].split(':').map(Number)
                      if (bw !== aw) return bw - aw
                      return al - bl
                    })

                    // Qualified teams section
                    const qualifiedParticipants = participants.filter(p => qualifiedTeamIds.has(p.team_id))
                    // Eliminated teams section
                    const eliminatedParticipants = participants.filter(p => eliminatedTeamIds.has(p.team_id))

                    return (
                      <div className="space-y-5">
                        {/* Qualified */}
                        {qualifiedParticipants.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
                                Qualified ({qualifiedParticipants.length})
                              </span>
                              <div className="flex-1 h-px bg-green-500/20" />
                            </div>
                            <div className="space-y-1.5 pl-4 opacity-60">
                              {qualifiedParticipants.map(p => {
                                const rec = records[p.team_id] || { wins: 0, losses: 0 }
                                return (
                                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-md bg-green-500/5 border border-green-500/15">
                                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                      {p.team?.team_avatar ? (
                                        <Image src={getTeamAvatarUrl(p.team.team_avatar)!} alt="" width={32} height={32} className="w-full h-full object-cover" unoptimized={process.env.NODE_ENV === 'development'} />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center"><Users className="h-4 w-4 text-muted-foreground" /></div>
                                      )}
                                    </div>
                                    <span className="text-sm font-medium truncate flex-1">{p.team?.name}</span>
                                    <span className="text-xs text-green-400 font-mono">{rec.wins}:{rec.losses}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Active buckets */}
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
                                <span className="text-xs text-muted-foreground">
                                  ({bucketTeams.length} team{bucketTeams.length > 1 ? 's' : ''})
                                </span>
                                <div className="flex-1 h-px bg-border" />
                              </div>
                              <div className="space-y-1.5">
                                {bucketTeams.map((participant, index) => (
                                  <div
                                    key={participant.id}
                                    draggable
                                    onDragStart={() => handleDragStart(index, participant.team_id)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, index, participant.team_id)}
                                    className={`
                                      flex items-center gap-3 p-3 rounded-lg border transition-all
                                      cursor-grab hover:border-primary/50 hover:bg-muted/50
                                      ${draggedTeamId === participant.team_id ? 'opacity-50 border-primary' : 'border-border'}
                                    `}
                                  >
                                    <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex-shrink-0">
                                      {participant.seed_number}
                                    </div>
                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                      {participant.team?.team_avatar ? (
                                        <Image
                                          src={getTeamAvatarUrl(participant.team.team_avatar)!}
                                          alt=""
                                          width={40}
                                          height={40}
                                          className="w-full h-full object-cover"
                                          placeholder="blur"
                                          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxAPwA/8A8A"
                                          unoptimized={process.env.NODE_ENV === 'development'}
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <Users className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium truncate">{participant.team?.name}</p>
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        {participant.team?.average_rank && (
                                          <div className="flex items-center gap-1">
                                            <Image
                                              src={getRankImage(participant.team.average_rank)}
                                              alt={participant.team.average_rank}
                                              width={16}
                                              height={16}
                                            />
                                            <span>{participant.team.average_rank}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Button
                                        size="icon" variant="ghost" className="h-8 w-8"
                                        onClick={() => handleMoveSeed(participant.team_id, 'up')}
                                        disabled={index === 0}
                                      >
                                        <ArrowUp className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon" variant="ghost" className="h-8 w-8"
                                        onClick={() => handleMoveSeed(participant.team_id, 'down')}
                                        disabled={index === bucketTeams.length - 1}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}

                        {/* Eliminated */}
                        {eliminatedParticipants.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                                Eliminated ({eliminatedParticipants.length})
                              </span>
                              <div className="flex-1 h-px bg-red-500/20" />
                            </div>
                            <div className="space-y-1.5 pl-4 opacity-40">
                              {eliminatedParticipants.map(p => {
                                const rec = records[p.team_id] || { wins: 0, losses: 0 }
                                return (
                                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-md bg-red-500/5 border border-red-500/15">
                                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                      {p.team?.team_avatar ? (
                                        <Image src={getTeamAvatarUrl(p.team.team_avatar)!} alt="" width={32} height={32} className="w-full h-full object-cover" unoptimized={process.env.NODE_ENV === 'development'} />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center"><Users className="h-4 w-4 text-muted-foreground" /></div>
                                      )}
                                    </div>
                                    <span className="text-sm font-medium truncate flex-1 line-through">{p.team?.name}</span>
                                    <span className="text-xs text-red-400 font-mono">{rec.wins}:{rec.losses}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })() : (
                    /* Non-Swiss: flat list */
                    <div className="space-y-2">
                      {activeParticipants.map((participant, index) => (
                        <div
                          key={participant.id}
                          draggable
                          onDragStart={() => handleDragStart(index, participant.team_id)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={(e) => handleDrop(e, index, participant.team_id)}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg border transition-all
                            cursor-grab hover:border-primary/50 hover:bg-muted/50
                            ${draggedTeamId === participant.team_id ? 'opacity-50 border-primary' : 'border-border'}
                          `}
                        >
                          <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex-shrink-0">
                            {participant.seed_number}
                          </div>
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            {participant.team?.team_avatar ? (
                              <Image
                                src={getTeamAvatarUrl(participant.team.team_avatar)!}
                                alt=""
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                                placeholder="blur"
                                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxAPwA/8A8A"
                                unoptimized={process.env.NODE_ENV === 'development'}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Users className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{participant.team?.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {participant.team?.average_rank && (
                                <div className="flex items-center gap-1">
                                  <Image
                                    src={getRankImage(participant.team.average_rank)}
                                    alt={participant.team.average_rank}
                                    width={16}
                                    height={16}
                                  />
                                  <span>{participant.team.average_rank}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="icon" variant="ghost" className="h-8 w-8"
                              onClick={() => handleMoveSeed(participant.team_id, 'up')}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost" className="h-8 w-8"
                              onClick={() => handleMoveSeed(participant.team_id, 'down')}
                              disabled={index === activeParticipants.length - 1}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })()}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Current Seeding
            </CardTitle>
            <CardDescription>
              {canEditSeeding
                ? 'Drag teams to reorder or use arrows to adjust seeding'
                : 'Seeding is locked. Reset bracket to make changes.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No teams seeded yet</p>
                <p className="text-sm">Generate seeding from approved registrations</p>
              </div>
            ) : (
              <div className="space-y-2">
                {participants.map((participant, index) => (
                  <div
                    key={participant.id}
                    draggable={canEditSeeding}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border transition-all
                      ${canEditSeeding ? 'cursor-grab hover:border-primary/50 hover:bg-muted/50' : 'cursor-default'}
                      ${draggedItem === index ? 'opacity-50 border-primary' : 'border-border'}
                    `}
                  >
                    {/* Drag Handle */}
                    {canEditSeeding && (
                      <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}

                    {/* Seed Number */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex-shrink-0">
                      {participant.seed_number}
                    </div>

                    {/* Team Avatar */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {participant.team?.team_avatar ? (
                        <Image
                          src={getTeamAvatarUrl(participant.team.team_avatar)!}
                          alt=""
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                          placeholder="blur"
                          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxAPwA/8A8A"
                          unoptimized={process.env.NODE_ENV === 'development'}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Team Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{participant.team?.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {participant.team?.average_rank && (
                          <div className="flex items-center gap-1">
                            <Image
                              src={getRankImage(participant.team.average_rank)}
                              alt={participant.team.average_rank}
                              width={16}
                              height={16}
                            />
                            <span>{participant.team.average_rank}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Move Buttons */}
                    {canEditSeeding && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleMoveSeed(participant.team_id, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleMoveSeed(participant.team_id, 'down')}
                          disabled={index === participants.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Bracket?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all matches and bracket data. You'll need to regenerate the bracket.
              Any match results will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetBracket}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reset Bracket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
