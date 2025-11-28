'use client'

import { useState, useEffect } from 'react'
import { MatchCard } from '@/components/ui/match-card'
import { BracketZone } from '@/components/ui/bracket-zone'

interface Team {
  id: string
  name: string
  team_avatar?: number
}

interface SwissMatch {
  id: string
  team1?: Team | null
  team2?: Team | null
  team1_score: number
  team2_score: number
  winner_id?: string
  status: 'Scheduled' | 'In_Progress' | 'Completed'
  round_number: number
}

interface SwissBracketProps {
  tournamentId: string
  matches: SwissMatch[]
  teams: Team[]
  currentRound?: number
  totalRounds?: number
}

export default function SwissBracket({ 
  matches, 
  teams = [],
  totalRounds = 3 
}: SwissBracketProps) {
  const [rounds, setRounds] = useState<SwissMatch[][]>([])
  
  // Calculate matches per round based on team count (default to 8 teams -> 4 matches if not provided)
  const teamCount = teams.length || 8
  const matchesPerRound = Math.floor(teamCount / 2)

  useEffect(() => {
    // Group matches by round
    const groupedMatches = matches.reduce((acc: SwissMatch[][], match) => {
      const roundIndex = match.round_number - 1
      if (!acc[roundIndex]) {
        acc[roundIndex] = []
      }
      acc[roundIndex].push(match)
      return acc
    }, [])
    
    // If no matches exist but we have teams, generate initial pairings for Round 1
    // Swiss format: Best vs Worst (Seed 1 vs Seed 8, Seed 2 vs Seed 7, etc.)
    if (groupedMatches.length === 0 && teams.length >= 2) {
      const initialMatches: SwissMatch[] = []
      const sortedTeams = [...teams] // Already sorted by seed from API
      
      for (let i = 0; i < Math.floor(sortedTeams.length / 2); i++) {
        const team1 = sortedTeams[i] // Top seed
        const team2 = sortedTeams[sortedTeams.length - 1 - i] // Bottom seed
        
        initialMatches.push({
          id: `initial-${i}`,
          team1: team1,
          team2: team2,
          team1_score: 0,
          team2_score: 0,
          status: 'Scheduled',
          round_number: 1
        })
      }
      
      groupedMatches[0] = initialMatches
    }
    
    // Ensure we have empty arrays for rounds that haven't started
    for (let i = 0; i < totalRounds; i++) {
      if (!groupedMatches[i]) groupedMatches[i] = []
    }
    
    setRounds(groupedMatches)
  }, [matches, totalRounds, teams])

  const renderRoundColumn = (roundIndex: number) => {
    const roundNumber = roundIndex + 1
    const roundMatches = rounds[roundIndex] || []
    
    let groups: { title: string, matches: SwissMatch[], style?: 'qualified' | 'eliminated' }[] = []
    
    // Dynamic Layout Logic
    if (roundNumber === 1) {
      // 0:0 - All matches
      const matches = roundMatches.length > 0 ? roundMatches : Array(matchesPerRound).fill({} as SwissMatch)
      groups = [{ title: '0:0', matches }]
    } else if (roundNumber === 2) {
      // Round 2: Split into High (1-0) and Low (0-1)
      // High gets top half, Low gets bottom half
      const halfMatches = Math.ceil(matchesPerRound / 2)
      
      const highMatches = roundMatches.slice(0, halfMatches)
      const lowMatches = roundMatches.slice(halfMatches, matchesPerRound)
      
      while (highMatches.length < halfMatches) highMatches.push({} as SwissMatch)
      while (lowMatches.length < halfMatches) lowMatches.push({} as SwissMatch)
        
      groups = [
        { title: '1:0', matches: highMatches },
        { title: '0:1', matches: lowMatches }
      ]
    } else if (roundNumber === 3 && totalRounds === 3) {
      // Round 3 for 8 teams (3-round Swiss with Top 4 cut)
      // 2-0 teams auto-qualify (green), 0-2 teams auto-eliminated (red)
      // 1-1 teams play decider matches
      groups = [
        { title: '2:0', matches: [], style: 'qualified' as const },
        { title: '1:1', matches: roundMatches.length > 0 ? roundMatches.slice(0, 2) : [{} as SwissMatch, {} as SwissMatch] },
        { title: '0:2', matches: [], style: 'eliminated' as const }
      ]
    } else if (roundNumber === 3) {
      // Round 3 for 16 teams (5-round Swiss)
      // 2-0 vs 2-0, 1-1 vs 1-1, 0-2 vs 0-2
      const highCount = Math.floor(matchesPerRound / 4)
      const midCount = Math.ceil(matchesPerRound / 2)
      const lowCount = Math.floor(matchesPerRound / 4)

      const highMatches = roundMatches.slice(0, highCount)
      const midMatches = roundMatches.slice(highCount, highCount + midCount)
      const lowMatches = roundMatches.slice(highCount + midCount, matchesPerRound)

      while (highMatches.length < highCount) highMatches.push({} as SwissMatch)
      while (midMatches.length < midCount) midMatches.push({} as SwissMatch)
      while (lowMatches.length < lowCount) lowMatches.push({} as SwissMatch)

      groups = [
        { title: '2:0', matches: highMatches },
        { title: '1:1', matches: midMatches },
        { title: '0:2', matches: lowMatches }
      ]
    } else if (roundNumber === 4) {
      // Round 4 (Only for >8 teams)
      // 2:1 (High) and 1:2 (Low)
      // Typically 3 matches High, 3 matches Low for 16 teams
      const bracketSize = 3 // Fixed for 16 team Swiss
      const highMatches = roundMatches.slice(0, bracketSize)
      const lowMatches = roundMatches.slice(bracketSize, bracketSize * 2)

      while (highMatches.length < bracketSize) highMatches.push({} as SwissMatch)
      while (lowMatches.length < bracketSize) lowMatches.push({} as SwissMatch)

      groups = [
        { title: '2:1', matches: highMatches },
        { title: '1:2', matches: lowMatches }
      ]
    } else {
      // Round 5 (Decider)
      const matches = roundMatches.slice(0, 3)
      while (matches.length < 3) matches.push({} as SwissMatch)
      groups = [{ title: '2:2', matches }]
    }

    return (
      <div className="flex flex-col gap-8 h-full justify-center">
        {groups.map((group, idx) => {
          // Determine styling based on group style
          const isQualified = group.style === 'qualified'
          const isEliminated = group.style === 'eliminated'
          const hasStyle = isQualified || isEliminated
          
          // For styled groups without matches, show placeholder teams
          if (hasStyle && group.matches.length === 0) {
            return (
              <div key={idx} className={`flex flex-col gap-2 p-3 rounded-lg border ${
                isQualified 
                  ? 'bg-green-950/20 border-green-500/30' 
                  : 'bg-red-950/20 border-red-500/30'
              }`}>
                <span className={`text-xs font-bold ml-1 ${
                  isQualified ? 'text-green-500' : 'text-red-500'
                }`}>
                  {isQualified ? '→ Playoffs' : '→ Out'}
                </span>
                {/* Two rows of team pairs */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 bg-[#22252a]/50 p-2 rounded-lg w-[160px] h-[50px]">
                    <div className="w-9 h-9 rounded-full bg-zinc-800/50 border border-zinc-700/50" />
                    <span className={`text-[10px] font-bold ${isQualified ? 'text-green-500/70' : 'text-red-500/70'}`}>{group.title}</span>
                    <div className="w-9 h-9 rounded-full bg-zinc-800/50 border border-zinc-700/50" />
                  </div>
                </div>
              </div>
            )
          }
          
          return (
            <div key={idx} className="flex flex-col gap-2">
              <span className="text-xs font-bold text-zinc-500 ml-1 opacity-50">{group.title}</span>
              <div className="flex flex-col gap-2">
                {group.matches.map((match, mIdx) => (
                  <MatchCard key={match.id || `${roundNumber}-${idx}-${mIdx}`} match={match} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // This SVG layer draws the connecting arrows
  const ConnectionsLayer = () => (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" style={{ zIndex: 0 }}>
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#71717a" />
        </marker>
      </defs>
    </svg>
  )

  return (
    <div className="w-full overflow-x-auto bg-[#16191d] rounded-xl border border-zinc-800">
      <div className="p-8 min-w-max relative min-h-[500px]">
        <ConnectionsLayer />
        
        <div className="flex gap-12 absolute inset-0 p-8">
          
          {/* Round Columns */}
          {Array.from({ length: totalRounds }, (_, i) => (
            <div key={i} className="w-[160px] flex flex-col justify-center">
              {renderRoundColumn(i)}
            </div>
          ))}

          {/* Qualified / Eliminated Column */}
          <div className="w-[140px] flex flex-col justify-between ml-auto py-4 gap-4">
            
            {/* Qualified (Green) - Top 4: 2x 2-0 (auto-qualify) + 2x 2-1 (from 1-1 decider) */}
            <BracketZone 
              variant="qualified"
              labels={['2:0', '2:1']}
              teams={[null, null, null, null]} // 4 qualified spots
            />

            {/* Eliminated (Red) - Bottom 4: 2x 0-2 (auto-eliminated) + 2x 1-2 (from 1-1 decider) */}
            <BracketZone 
              variant="eliminated"
              labels={['1:2', '0:2']}
              teams={[null, null, null, null]} // 4 eliminated spots
            />

          </div>

        </div>
      </div>
    </div>
  )
}
