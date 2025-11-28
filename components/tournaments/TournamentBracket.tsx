'use client'

import { useState, useEffect } from 'react'
import { 
  SwissBracket, 
  SingleEliminationBracket, 
  DoubleEliminationBracket, 
  RoundRobinBracket 
} from './brackets'
import { Trophy } from 'lucide-react'

interface TournamentBracketProps {
  tournamentId: string
  tournamentFormat: string
  tournamentStatus: string
}

interface Team {
  id: string
  name: string
  team_avatar?: number
}

interface Bracket {
  id: string
  tournament_id: string
  round_number: number
  bracket_position: number
  is_final: boolean
  is_third_place: boolean
}

interface Match {
  id: string
  bracket_id: string
  team1_id?: string
  team2_id?: string
  team1_score: number
  team2_score: number
  winner_id?: string
  status: 'Scheduled' | 'In_Progress' | 'Completed'
  match_number: number
  team1?: Team | null
  team2?: Team | null
  round_number?: number // Will be populated from bracket
}

interface Participant {
  id: string
  team_id: string
  seed_number: number
  team?: Team
}

export default function TournamentBracket({ 
  tournamentId, 
  tournamentFormat, 
  tournamentStatus 
}: TournamentBracketProps) {
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [currentRound, setCurrentRound] = useState(1)

  useEffect(() => {
    fetchTournamentData()
  }, [tournamentId])

  const fetchTournamentData = async () => {
    try {
      // Use the existing bracket API endpoint
      const response = await fetch(`/api/tournaments/${tournamentId}/bracket`)
      
      if (!response.ok) {
        console.error('Failed to fetch bracket data:', response.status)
        setLoading(false)
        return
      }

      const data = await response.json()
      
      // Extract brackets and matches
      const brackets: Bracket[] = data.brackets || []
      const rawMatches: any[] = data.matches || []
      const participants: Participant[] = data.participants || []

      // Create a map of bracket_id to round_number
      const bracketRoundMap: Record<string, number> = {}
      brackets.forEach(b => {
        bracketRoundMap[b.id] = b.round_number
      })

      // Transform matches to include round_number from their bracket
      const transformedMatches: Match[] = rawMatches.map((m: any) => ({
        id: m.id,
        bracket_id: m.bracket_id,
        team1_id: m.team1_id,
        team2_id: m.team2_id,
        team1_score: m.team1_score || 0,
        team2_score: m.team2_score || 0,
        winner_id: m.winner_id,
        status: m.status || 'Scheduled',
        match_number: m.match_number || 1,
        round_number: bracketRoundMap[m.bracket_id] || 1,
        team1: m.team1 ? {
          id: m.team1.id,
          name: m.team1.name,
          team_avatar: m.team1.team_avatar
        } : null,
        team2: m.team2 ? {
          id: m.team2.id,
          name: m.team2.name,
          team_avatar: m.team2.team_avatar
        } : null
      }))

      // Extract teams from participants, sorted by seed_number
      const sortedParticipants = [...participants].sort((a, b) => 
        (a.seed_number || 0) - (b.seed_number || 0)
      )
      
      const uniqueTeams: Team[] = sortedParticipants
        .filter(p => p.team)
        .map(p => ({
          id: p.team!.id,
          name: p.team!.name,
          team_avatar: p.team!.team_avatar
        }))

      console.log('Bracket data loaded:', {
        matchCount: transformedMatches.length,
        teamCount: uniqueTeams.length,
        teams: uniqueTeams.map(t => t.name),
        participantCount: participants.length
      })

      // Get current round info
      const maxRound = transformedMatches.reduce((max, match) => 
        Math.max(max, match.round_number || 0), 0) || 1

      setMatches(transformedMatches)
      setTeams(uniqueTeams)
      setCurrentRound(maxRound)
    } catch (error: any) {
      console.error('Error fetching tournament data:', error?.message || error)
    } finally {
      setLoading(false)
    }
  }

  const renderBracket = () => {
    // Map format names to component props
    const formatMap: Record<string, string> = {
      'swiss': 'Swiss',
      'Swiss': 'Swiss',
      'single_elimination': 'SingleElimination',
      'Single_Elimination': 'SingleElimination',
      'double_elimination': 'DoubleElimination',
      'Double_Elimination': 'DoubleElimination',
      'round_robin': 'RoundRobin',
      'Round_Robin': 'RoundRobin'
    }

    const normalizedFormat = formatMap[tournamentFormat] || 'Swiss'

    switch (normalizedFormat) {
      case 'Swiss':
        return (
          <SwissBracket
            tournamentId={tournamentId}
            matches={matches as any}
            teams={teams}
            currentRound={currentRound}
            totalRounds={3} // Default to 3 rounds for 8 teams
          />
        )
      case 'SingleElimination':
        return (
          <SingleEliminationBracket
            tournamentId={tournamentId}
            matches={matches}
            teams={teams}
          />
        )
      case 'DoubleElimination':
        return (
          <DoubleEliminationBracket
            tournamentId={tournamentId}
            matches={matches}
            teams={teams}
          />
        )
      case 'RoundRobin':
        return (
          <RoundRobinBracket
            tournamentId={tournamentId}
            matches={matches}
            teams={teams}
          />
        )
      default:
        return (
          <div className="text-center py-12">
            <Trophy className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">Unknown tournament format: {tournamentFormat}</p>
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Only show bracket if tournament is past registration
  if (tournamentStatus === 'Registration') {
    return (
      <div className="text-center py-12">
        <Trophy className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
        <p className="text-zinc-400">Bracket will be available once registration closes</p>
        <p className="text-sm text-zinc-500 mt-2">Tournament is currently in registration phase</p>
      </div>
    )
  }

  return renderBracket()
}
