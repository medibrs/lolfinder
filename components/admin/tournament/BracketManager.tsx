'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Play, RotateCcw, Loader2, GitBranch, Shuffle, Trophy, CheckCircle2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SingleEliminationBracketPreview } from '@/components/tournament/single-elimination-bracket-preview'
import { SwissBracketPreview } from '@/components/tournament/swiss-bracket-preview'
import { buildSwissBracketData } from '@/lib/swiss-bracket-data'

// ─── Types ──────────────────────────────────────────────────────────

interface BracketManagerProps {
  tournamentId: string
  tournamentFormat?: string
  maxTeams: number
  participants?: any[]
  matchData?: any[]
  bracketGenerated?: boolean
  canGenerate?: boolean
  onBracketChanged?: () => void
}

// ─── Component ──────────────────────────────────────────────────────

export default function BracketManager({
  tournamentId,
  tournamentFormat,
  maxTeams,
  participants = [],
  matchData = [],
  bracketGenerated = false,
  canGenerate = true,
  onBracketChanged,
}: BracketManagerProps) {
  const { toast } = useToast()
  const [isGenerated, setIsGenerated] = useState(bracketGenerated)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [localMatchData, setLocalMatchData] = useState<any[]>(matchData)
  const [tournamentData, setTournamentData] = useState<any>(null)

  useEffect(() => { setIsGenerated(bracketGenerated) }, [bracketGenerated])
  useEffect(() => { setLocalMatchData(matchData) }, [matchData])

  // Fetch tournament data for Swiss bracket display
  useEffect(() => {
    async function fetchTournament() {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}`)
        if (res.ok) {
          const data = await res.json()
          setTournamentData(data)
        }
      } catch { }
    }
    fetchTournament()
  }, [tournamentId])

  const handleGenerate = async () => {
    setActionLoading('generate')
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_bracket' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')

      setIsGenerated(true)
      onBracketChanged?.()
      toast({ title: 'Bracket Generated', description: 'Tournament bracket has been created.' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleReset = async () => {
    setShowResetDialog(false)
    setActionLoading('reset')
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_bracket' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')

      setIsGenerated(false)
      setLocalMatchData([])
      onBracketChanged?.()
      toast({ title: 'Bracket Reset', description: 'All matches cleared. You can edit seeding and regenerate.' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Bracket
                {isGenerated ? (
                  <Badge className="ml-1 text-xs bg-green-500/10 text-green-400 border-green-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Generated
                  </Badge>
                ) : (
                  <Badge variant="outline" className="ml-1 text-xs font-normal">
                    Not Generated
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {tournamentFormat?.replace('_', ' ')} · {participants.length} teams
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {!isGenerated ? (
                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate || participants.length < 2 || !!actionLoading}
                  size="sm"
                  className="text-xs h-8"
                >
                  {actionLoading === 'generate' ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3 mr-1.5" />
                  )}
                  Generate Bracket
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => setShowResetDialog(true)}
                  disabled={!!actionLoading}
                  size="sm"
                  className="text-xs h-8"
                >
                  {actionLoading === 'reset' ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3 mr-1.5" />
                  )}
                  Reset Bracket
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {isGenerated && localMatchData.length > 0 && (
          <CardContent className="overflow-x-auto pb-6">
            <div className="min-w-max">
              {tournamentFormat === 'Swiss' ? (
                <SwissBracketPreview
                  data={buildSwissBracketData(
                    tournamentData || { id: tournamentId },
                    participants,
                    localMatchData
                  )}
                />
              ) : (
                <SingleEliminationBracketPreview
                  teams={participants.map((p: any) => p.team).filter(Boolean)}
                  teamCount={maxTeams}
                  matchData={localMatchData}
                />
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Reset Confirmation */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Bracket?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all matches, brackets, and Swiss pairings. Seeding will be preserved.
              You'll need to regenerate the bracket to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
