'use client'

import { useState, useEffect } from 'react'
import { 
  SwissBracket, 
  SingleEliminationBracket, 
  DoubleEliminationBracket, 
  RoundRobinBracket 
} from './brackets'
import { createClient } from '@/lib/supabase/client'
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
  average_rank?: string
}

interface Match {
  id: string
  team1_id?: string
  team2_id?: string
  team1_score: number
  team2_score: number
  winner_id?: string
  status: string
  round_number: number
  team1?: Team
  team2?: Team
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
      const supabase = createClient()
      
      // Fetch tournament matches with team data
      const { data: matchesData, error: matchesError } = await supabase
        .from('tournament_matches')
        .select(`
          *,
          team1:teams(id, name, team_avatar, average_rank),
          team2:teams(id, name, team_avatar, average_rank)
        `)
        .eq('tournament_id', tournamentId)
        .order('round_number', { ascending: true })
        .order('match_number', { ascending: true })

      if (matchesError) throw matchesError

      // Fetch tournament participants for teams list
      const { data: participantsData, error: participantsError } = await supabase
        .from('tournament_participants')
        .select(`
          team:teams(id, name, team_avatar, average_rank)
        `)
        .eq('tournament_id', tournamentId)
        .eq('is_active', true)

      if (participantsError) throw participantsError

      // Extract unique teams
      const uniqueTeams = participantsData?.map(p => p.team).filter(Boolean) || []
      
      // Get current round info
      const maxRound = matchesData?.reduce((max, match) => 
        Math.max(max, match.round_number), 0) || 1

      setMatches(matchesData || [])
      setTeams(uniqueTeams)
      setCurrentRound(maxRound)
    } catch (error) {
      console.error('Error fetching tournament data:', error)
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
            matches={matches}
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
