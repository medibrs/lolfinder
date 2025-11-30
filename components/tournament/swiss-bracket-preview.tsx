'use client'

import { useState, useEffect } from 'react'
import { SwissMatchContainer } from '@/components/ui/swiss-match-container'

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

interface SwissBracketPreviewProps {
  teams: Team[]
  maxWins?: number
  maxLosses?: number
  teamCount?: number
}

// Helper functions
const factorial = (n: number): number => n <= 1 ? 1 : n * factorial(n - 1)
const combinations = (n: number, r: number): number => {
  if (r > n || r < 0) return 0
  return factorial(n) / (factorial(r) * factorial(n - r))
}

function generateSwissBracket(teams: Team[], maxWins: number, maxLosses: number): SwissFormatData {
  const teamCount = teams.length
  const totalRounds = maxWins + maxLosses - 1
  const columns: SwissFormatData['columns'] = []
  
  const createPlaceholder = (id: string): SwissMatchCardTeam => ({
    id: `ph-${id}`, name: 'TBD', team_avatar: undefined
  })

  const createMatches = (matchCount: number, prefix: string) => 
    Array.from({ length: Math.max(1, Math.floor(matchCount)) }, (_, i) => ({
      team1: createPlaceholder(`${prefix}-m${i}-1`),
      team2: createPlaceholder(`${prefix}-m${i}-2`),
      status: 'scheduled' as const,
      winner: null
    }))
  
  const createTopCutTeams = (teamCount: number, prefix: string) =>
    Array.from({ length: Math.max(1, Math.floor(teamCount)) }, (_, i) => 
      createPlaceholder(`${prefix}-t${i}`)
    )

  const getBucketCount = (w: number, l: number) => {
    const r = w + l
    return (teamCount * combinations(r, w)) / Math.pow(2, r)
  }

  for (let r = 0; r < totalRounds; r++) {
    const roundsInCol: SwissRound[] = []
    const isLastRound = r === totalRounds - 1
    
    // First round is special - only 0:0
    if (r === 0) {
      roundsInCol.push({
        title: '0:0',
        teamPairs: createMatches(teamCount / 2, 'm-0-0-0')
      })
      columns.push({ rounds: roundsInCol })
      continue
    }

    if (isLastRound) {
      const qLeftW = maxWins
      const qLeftL = maxLosses - 2
      const qLeftCount = getBucketCount(qLeftW - 1, qLeftL) / 2
      const qRightW = maxWins
      const qRightL = maxLosses - 1
      const qRightCount = getBucketCount(qRightW - 1, qRightL) / 2

      if (qLeftL >= 0) {
        roundsInCol.push({
          type: 'topcut',
          title: "",
          topCut: {
            leftTitle: `${qLeftW}:${qLeftL}`,
            rightTitle: `${qRightW}:${qRightL}`,
            leftTeams: createTopCutTeams(qLeftCount, `q-left-${r}`),
            rightTeams: createTopCutTeams(qRightCount, `q-right-${r}`),
            backgroundColor: 'green'
          }
        })
      } else {
        roundsInCol.push({
          type: 'topcut',
          title: `${qRightW}:${qRightL}`,
          topCut: {
            teams: createTopCutTeams(qRightCount, `q-${r}`),
            backgroundColor: 'green'
          }
        })
      }

      const deciderW = maxWins - 1
      const deciderL = maxLosses - 1
      const deciderMatchCount = getBucketCount(deciderW, deciderL) / 2
      roundsInCol.push({
        title: `${deciderW}:${deciderL}`,
        isLastRound: true,
        teamPairs: createMatches(deciderMatchCount, `m-${r}-decider`)
      })

      const eLeftW = maxWins - 2
      const eLeftL = maxLosses
      const eLeftCount = getBucketCount(eLeftW, eLeftL - 1) / 2
      const eRightW = maxWins - 1
      const eRightL = maxLosses
      const eRightCount = getBucketCount(eRightW, eRightL - 1) / 2

      if (eLeftW >= 0) {
        roundsInCol.push({
          type: 'topcut',
          title: "",
          topCut: {
            leftTitle: `${eLeftW}:${eLeftL}`,
            rightTitle: `${eRightW}:${eRightL}`,
            leftTeams: createTopCutTeams(eLeftCount, `e-left-${r}`),
            rightTeams: createTopCutTeams(eRightCount, `e-right-${r}`),
            backgroundColor: 'red'
          }
        })
      } else {
        roundsInCol.push({
          type: 'topcut',
          title: `${eRightW}:${eRightL}`,
          topCut: {
            teams: createTopCutTeams(eRightCount, `e-${r}`),
            backgroundColor: 'red'
          }
        })
      }
    } else {
      const qualifiedBuckets: { w: number, l: number, count: number }[] = []
      const matchBuckets: { w: number, l: number, count: number }[] = []
      const eliminatedBuckets: { w: number, l: number, count: number }[] = []

      for (let w = 0; w <= r; w++) {
        const l = r - w
        if (l < 0 || l > r) continue
        const count = getBucketCount(w, l)
        if (count < 1) continue

        if (w >= maxWins) {
          qualifiedBuckets.push({ w, l, count })
        } else if (l >= maxLosses) {
          eliminatedBuckets.push({ w, l, count })
        } else {
          matchBuckets.push({ w, l, count })
        }
      }

      qualifiedBuckets.forEach(b => {
        roundsInCol.push({
          type: 'topcut',
          title: `${b.w}:${b.l}`,
          topCut: {
            teams: createTopCutTeams(b.count, `q-${r}-${b.w}-${b.l}`),
            backgroundColor: 'green'
          }
        })
      })

      matchBuckets.forEach(b => {
        roundsInCol.push({
          title: `${b.w}:${b.l}`,
          teamPairs: createMatches(b.count / 2, `m-${r}-${b.w}-${b.l}`)
        })
      })

      eliminatedBuckets.forEach(b => {
        roundsInCol.push({
          type: 'topcut',
          title: `${b.w}:${b.l}`,
          topCut: {
            teams: createTopCutTeams(b.count, `e-${r}-${b.w}-${b.l}`),
            backgroundColor: 'red'
          }
        })
      })
    }

    columns.push({ rounds: roundsInCol })
  }

  // Pair initial teams in 0:0 round
  if (columns.length > 0 && columns[0].rounds.length > 0) {
    const firstRound = columns[0].rounds.find(r => r.title === '0:0')
    if (firstRound && firstRound.teamPairs) {
      const shuffledTeams = [...teams].sort(() => Math.random() - 0.5)
      for (let i = 0; i < firstRound.teamPairs.length; i++) {
        firstRound.teamPairs[i].team1 = shuffledTeams[i * 2] || null
        firstRound.teamPairs[i].team2 = shuffledTeams[i * 2 + 1] || null
      }
    }
  }

  return { columns }
}

export function SwissBracketPreview({ teams, maxWins = 2, maxLosses = 2, teamCount: forcedTeamCount }: SwissBracketPreviewProps) {
  const [bracketData, setBracketData] = useState<SwissFormatData | null>(null)

  useEffect(() => {
    // Use forced team count or calculate from teams
    const targetTeamCount = forcedTeamCount || Math.pow(2, Math.ceil(Math.log2(Math.max(8, teams.length))))
    const paddedTeams = teams.length >= targetTeamCount ? teams.slice(0, targetTeamCount) : [
      ...teams,
      ...Array(targetTeamCount - teams.length).fill(null).map((_, i) => ({
        id: `placeholder-${i}`,
        name: `TBD`,
        team_avatar: undefined
      }))
    ]
    
    const data = generateSwissBracket(paddedTeams, maxWins, maxLosses)
    setBracketData(data)
  }, [teams, maxWins, maxLosses, forcedTeamCount])

  if (!bracketData) {
    return <div className="text-zinc-500">Loading bracket...</div>
  }

  return <SwissMatchContainer columns={bracketData.columns} />
}
