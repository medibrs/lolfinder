'use client'

import { useState, useEffect } from 'react'
import { SwissMatchContainer } from '@/components/ui/swiss-match-container'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RotateCcw, FastForward } from 'lucide-react'

interface Team {
  id: string
  name: string
  team_avatar?: number
}

interface SwissMatchCardTeam {
  id: string
  name: string
  team_avatar?: number
}

interface SwissRound {
  title: string
  type?: 'matches' | 'topcut'
  isLastRound?: boolean
  teamPairs?: Array<{
    team1: SwissMatchCardTeam | null
    team2: SwissMatchCardTeam | null
    status: 'live' | 'scheduled' | 'done'
    winner?: 'team1' | 'team2' | null
  }>
  topCut?: {
    title?: string
    teams?: SwissMatchCardTeam[]
    leftTeams?: SwissMatchCardTeam[]
    rightTeams?: SwissMatchCardTeam[]
    leftTitle?: string
    rightTitle?: string
    backgroundColor?: 'green' | 'red' | 'default'
  }
}

interface SwissFormatData {
  columns: Array<{
    rounds: SwissRound[]
  }>
}

const mockTeams: Team[] = [
  { id: '1', name: 'Alpha Squad', team_avatar: 1 },
  { id: '2', name: 'Beta Force', team_avatar: 2 },
  { id: '3', name: 'Gamma Unit', team_avatar: 3 },
  { id: '4', name: 'Delta Team', team_avatar: 4 },
  { id: '5', name: 'Epsilon Crew', team_avatar: 5 },
  { id: '6', name: 'Zeta Group', team_avatar: 6 },
  { id: '7', name: 'Eta Division', team_avatar: 7 },
  { id: '8', name: 'Theta Battalion', team_avatar: 8 }
]

export default function TournamentSimulator() {
  const [tournamentData, setTournamentData] = useState<SwissFormatData | null>(null)
  const [teamCount, setTeamCount] = useState(8) // number of teams

  // Generate mock teams based on count
  const generateTeams = (count: number): Team[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: (i + 1).toString(),
      name: `Team ${String.fromCharCode(65 + i)}`, // A, B, C, etc.
      team_avatar: (i % 8) + 1 // Cycle through 8 avatars
    }))
  }

  // Initialize tournament with dynamic team count
  const initializeTournament = () => {
    const teams = generateTeams(teamCount)
    const matchCount = Math.floor(teamCount / 2)
    
    const initialData: SwissFormatData = {
      columns: [
        {
          rounds: [
            {
              title: "0:0",
              teamPairs: Array.from({ length: matchCount }, (_, i) => ({
                team1: teams[i * 2] || null,
                team2: teams[i * 2 + 1] || null,
                status: 'scheduled' as const,
                winner: null
              }))
            }
          ]
        },
        {
          rounds: [
            {
              title: "1:0",
              teamPairs: Array.from({ length: Math.floor(matchCount / 2) }, () => ({
                team1: null, team2: null, status: 'scheduled' as const, winner: null
              }))
            },
            {
              title: "0:1",
              teamPairs: Array.from({ length: Math.floor(matchCount / 2) }, () => ({
                team1: null, team2: null, status: 'scheduled' as const, winner: null
              }))
            }
          ]
        },
        {
          rounds: [
            {
              title: "2:0",
              teamPairs: Array.from({ length: Math.floor(matchCount / 4) }, () => ({
                team1: null, team2: null, status: 'scheduled' as const, winner: null
              }))
            },
            {
              title: "1:1",
              teamPairs: Array.from({ length: Math.floor(matchCount / 2) }, () => ({
                team1: null, team2: null, status: 'scheduled' as const, winner: null
              }))
            },
            {
              title: "0:2",
              teamPairs: Array.from({ length: Math.floor(matchCount / 4) }, () => ({
                team1: null, team2: null, status: 'scheduled' as const, winner: null
              }))
            }
          ]
        },
        {
          rounds: [
            {
              type: 'topcut',
              title: "3:0",
              topCut: {
                teams: Array.from({ length: Math.min(2, Math.floor(matchCount / 4)) }, (_, i) => ({
                  id: `placeholder-3-0-${i + 1}`, 
                  name: `TBD 3:0-${i + 1}`, 
                  team_avatar: undefined
                })),
                backgroundColor: 'green'
              }
            },
            {
              title: "2:1",
              teamPairs: Array.from({ length: Math.floor(matchCount / 2) }, () => ({
                team1: null, team2: null, status: 'scheduled' as const, winner: null
              }))
            },
            {
              title: "1:2",
              teamPairs: Array.from({ length: Math.floor(matchCount / 2) }, () => ({
                team1: null, team2: null, status: 'scheduled' as const, winner: null
              }))
            },
            {
              type: 'topcut',
              title: "0:3",
              topCut: {
                teams: Array.from({ length: Math.min(2, Math.floor(matchCount / 4)) }, (_, i) => ({
                  id: `placeholder-0-3-${i + 1}`, 
                  name: `TBD 0:3-${i + 1}`, 
                  team_avatar: undefined
                })),
                backgroundColor: 'red'
              }
            }
          ]
        },
        {
          rounds: [
            {
              type: 'topcut',
              title: "",
              topCut: {
                leftTeams: Array.from({ length: Math.min(3, Math.floor(matchCount / 2)) }, (_, i) => ({
                  id: `placeholder-3-1-${i + 1}`, 
                  name: `TBD 3:1-${i + 1}`, 
                  team_avatar: undefined
                })),
                rightTeams: Array.from({ length: Math.min(3, Math.floor(matchCount / 2)) }, (_, i) => ({
                  id: `placeholder-3-2-${i + 1}`, 
                  name: `TBD 3:2-${i + 1}`, 
                  team_avatar: undefined
                })),
                leftTitle: "3:1",
                rightTitle: "3:2",
                backgroundColor: 'green'
              }
            },
            {
              title: "2:2",
              isLastRound: true,
              teamPairs: Array.from({ length: Math.floor(matchCount / 2) }, () => ({
                team1: null, team2: null, status: 'scheduled' as const, winner: null
              }))
            },
            {
              type: 'topcut',
              title: "",
              topCut: {
                leftTeams: Array.from({ length: Math.min(3, Math.floor(matchCount / 2)) }, (_, i) => ({
                  id: `placeholder-1-3-${i + 1}`, 
                  name: `TBD 1:3-${i + 1}`, 
                  team_avatar: undefined
                })),
                rightTeams: Array.from({ length: Math.min(3, Math.floor(matchCount / 2)) }, (_, i) => ({
                  id: `placeholder-2-3-${i + 1}`, 
                  name: `TBD 2:3-${i + 1}`, 
                  team_avatar: undefined
                })),
                leftTitle: "1:3",
                rightTitle: "2:3",
                backgroundColor: 'red'
              }
            }
          ]
        }
      ]
    }
    
    setTournamentData(initialData)
  }

  // Simulate match result
  const simulateMatch = (team1: SwissMatchCardTeam | null, team2: SwissMatchCardTeam | null): 'team1' | 'team2' | null => {
    if (!team1 || !team2) return null
    return Math.random() > 0.5 ? 'team1' : 'team2'
  }

  // Get all scheduled matches in order
  const getAllMatches = () => {
    if (!tournamentData) return []
    
    const matches: Array<{
      columnIndex: number
      roundIndex: number
      matchIndex: number
      round: SwissRound
      teamPair: any
    }> = []
    
    tournamentData.columns.forEach((column, colIndex) => {
      column.rounds.forEach((round, roundIndex) => {
        if (round.teamPairs) {
          round.teamPairs.forEach((teamPair, matchIndex) => {
            if (teamPair.status === 'scheduled') {
              matches.push({ columnIndex: colIndex, roundIndex, matchIndex, round, teamPair })
            }
          })
        }
      })
    })
    
    return matches
  }

  // Play next match
  const playNextMatch = () => {
    if (!tournamentData) return
    
    const matches = getAllMatches()
    if (matches.length === 0) {
      return
    }
    
    const nextMatch = matches[0]
    const winner = simulateMatch(nextMatch.teamPair.team1, nextMatch.teamPair.team2)
    
    // Update match status
    const newData = { ...tournamentData }
    newData.columns[nextMatch.columnIndex].rounds[nextMatch.roundIndex].teamPairs![nextMatch.matchIndex] = {
      ...nextMatch.teamPair,
      status: 'done',
      winner
    }
    
    setTournamentData(newData)
    
    // Check if we need to progress to next round
    setTimeout(() => {
      checkAndProgressRounds(newData)
    }, 100)
  }

  // Check and progress through all rounds as needed
  const checkAndProgressRounds = (data: SwissFormatData) => {
    let currentData = { ...data }
    let hasProgressed = true
    
    // Keep progressing while we can
    while (hasProgressed) {
      hasProgressed = false
      
      // Check if column 0 (0:0) is complete and progress to column 1
      if (canProgressColumn(currentData, 0)) {
        currentData = progressFromColumn0(currentData)
        hasProgressed = true
      }
      
      // Check if column 1 (1:0/0:1) is complete and progress to column 2
      if (canProgressColumn(currentData, 1)) {
        currentData = progressFromColumn1(currentData)
        hasProgressed = true
      }
      
      // Check if column 2 (2:0/1:1/0:2) is complete and progress to column 3
      if (canProgressColumn(currentData, 2)) {
        currentData = progressFromColumn2(currentData)
        hasProgressed = true
      }
    }
    
    if (JSON.stringify(currentData) !== JSON.stringify(data)) {
      setTournamentData(currentData)
    }
  }

  // Check if a column has all matches completed
  const canProgressColumn = (data: SwissFormatData, columnIndex: number): boolean => {
    const column = data.columns[columnIndex]
    if (!column) return false
    
    return column.rounds.every(round => {
      if (!round.teamPairs) return true // Skip topcut rounds
      return round.teamPairs.every(pair => pair.status === 'done')
    })
  }

  // Progress from column 0 (0:0) to column 1 (1:0/0:1)
  const progressFromColumn0 = (data: SwissFormatData): SwissFormatData => {
    const newData = { ...data }
    const round0Matches = newData.columns[0].rounds[0].teamPairs
    
    if (!round0Matches || !round0Matches.every(m => m.status === 'done')) {
      return data
    }
    
    const winners = round0Matches.map(m => m.winner === 'team1' ? m.team1 : m.winner === 'team2' ? m.team2 : null).filter(Boolean)
    const losers = round0Matches.map(m => m.winner === 'team1' ? m.team2 : m.winner === 'team2' ? m.team1 : null).filter(Boolean)
    
    // Pair winners for 1:0 bracket
    const winnerPairs = []
    for (let i = 0; i < winners.length; i += 2) {
      winnerPairs.push({
        team1: winners[i] || null,
        team2: winners[i + 1] || null,
        status: 'scheduled' as const,
        winner: null
      })
    }
    newData.columns[1].rounds[0].teamPairs = winnerPairs
    
    // Pair losers for 0:1 bracket
    const loserPairs = []
    for (let i = 0; i < losers.length; i += 2) {
      loserPairs.push({
        team1: losers[i] || null,
        team2: losers[i + 1] || null,
        status: 'scheduled' as const,
        winner: null
      })
    }
    newData.columns[1].rounds[1].teamPairs = loserPairs
    
    return newData
  }

  // Progress from column 1 (1:0/0:1) to column 2 (2:0/1:1/0:2)
  const progressFromColumn1 = (data: SwissFormatData): SwissFormatData => {
    const newData = { ...data }
    const round1Winners = newData.columns[1].rounds[0].teamPairs
    const round1Losers = newData.columns[1].rounds[1].teamPairs
    
    if (!round1Winners || !round1Losers || 
        !round1Winners.every(m => m.status === 'done') || 
        !round1Losers.every(m => m.status === 'done')) {
      return data
    }
    
    const winners = round1Winners.map(m => m.winner === 'team1' ? m.team1 : m.winner === 'team2' ? m.team2 : null).filter(Boolean)
    const middle1 = round1Winners.map(m => m.winner === 'team1' ? m.team2 : m.winner === 'team2' ? m.team1 : null).filter(Boolean)
    const middle2 = round1Losers.map(m => m.winner === 'team1' ? m.team1 : m.winner === 'team2' ? m.team2 : null).filter(Boolean)
    const losers = round1Losers.map(m => m.winner === 'team1' ? m.team2 : m.winner === 'team2' ? m.team1 : null).filter(Boolean)
    
    // 2:0 bracket - winners vs winners
    const twoZeroPairs = []
    for (let i = 0; i < winners.length; i += 2) {
      twoZeroPairs.push({
        team1: winners[i] || null,
        team2: winners[i + 1] || null,
        status: 'scheduled' as const,
        winner: null
      })
    }
    newData.columns[2].rounds[0].teamPairs = twoZeroPairs
    
    // 1:1 bracket - middle teams
    const oneOnePairs = []
    const middleTeams = [...middle1, ...middle2]
    for (let i = 0; i < middleTeams.length; i += 2) {
      oneOnePairs.push({
        team1: middleTeams[i] || null,
        team2: middleTeams[i + 1] || null,
        status: 'scheduled' as const,
        winner: null
      })
    }
    newData.columns[2].rounds[1].teamPairs = oneOnePairs
    
    // 0:2 bracket - losers vs losers
    const zeroTwoPairs = []
    for (let i = 0; i < losers.length; i += 2) {
      zeroTwoPairs.push({
        team1: losers[i] || null,
        team2: losers[i + 1] || null,
        status: 'scheduled' as const,
        winner: null
      })
    }
    newData.columns[2].rounds[2].teamPairs = zeroTwoPairs
    
    return newData
  }

  // Progress from column 2 to column 3 (topcuts)
  const progressFromColumn2 = (data: SwissFormatData): SwissFormatData => {
    const newData = { ...data }
    
    // Check if all matches in column 2 are done
    const column2Rounds = newData.columns[2].rounds.filter(r => r.teamPairs)
    if (!column2Rounds.every(round => round.teamPairs!.every(pair => pair.status === 'done'))) {
      return data
    }
    
    // For now, just update topcuts with placeholder logic
    // In a real tournament, you'd track team records and place them accordingly
    const teams = generateTeams(teamCount)
    
    // Update 3:0 topcut with some teams
    newData.columns[3].rounds[0].topCut!.teams = [
      teams[0] || { id: 'tbd-1', name: 'TBD 1', team_avatar: undefined },
      teams[1] || { id: 'tbd-2', name: 'TBD 2', team_avatar: undefined }
    ]
    
    // Update 0:3 topcut with some teams
    newData.columns[3].rounds[3].topCut!.teams = [
      teams[6] || { id: 'tbd-7', name: 'TBD 7', team_avatar: undefined },
      teams[7] || { id: 'tbd-8', name: 'TBD 8', team_avatar: undefined }
    ]
    
    return newData
  }

  // Initialize on mount
  useEffect(() => {
    initializeTournament()
  }, [])

  const exportJSON = () => {
    if (!tournamentData) return
    
    const blob = new Blob([JSON.stringify(tournamentData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tournament-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Swiss Tournament Simulator</h1>
        <div className="flex items-center gap-4">
          <Badge variant="outline">
            {getAllMatches().length} matches remaining
          </Badge>
          <Button onClick={exportJSON} variant="outline">
            Export JSON
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tournament Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Teams:</label>
              <select 
                value={teamCount} 
                onChange={(e) => setTeamCount(Number(e.target.value))}
                className="px-3 py-2 border rounded"
              >
                {Array.from({ length: 31 }, (_, i) => i + 2).map(num => (
                  <option key={num} value={num}>{num} Teams</option>
                ))}
              </select>
            </div>
            
            <Button onClick={initializeTournament} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Generate Tournament
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulation Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={playNextMatch} variant="outline">
              <FastForward className="w-4 h-4 mr-2" />
              Next Match
            </Button>
            
            <Button onClick={initializeTournament} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Tournament
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tournament Bracket</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {tournamentData && (
              <SwissMatchContainer columns={tournamentData.columns} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current JSON Data</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
            {tournamentData ? JSON.stringify(tournamentData, null, 2) : 'Loading...'}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
