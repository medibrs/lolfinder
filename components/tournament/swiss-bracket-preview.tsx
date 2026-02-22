'use client'

import { useState, useEffect } from 'react'
import { SwissMatchContainer } from '@/components/ui/swiss-match-container'
import type { SwissBracketData } from '@/lib/swiss-bracket-data'

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
  /** New data-driven prop — when provided, overlays real results onto the bracket skeleton */
  data?: SwissBracketData
  /** Legacy props — used to generate the skeleton when data is not available */
  teams?: Team[]
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

      for (let w = r; w >= 0; w--) {
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

// ─── Overlay real data onto the generated skeleton ──────────────────

function overlayRealData(skeleton: SwissFormatData, data: SwissBracketData): SwissFormatData {
  const { teams, rounds, settings } = data
  const totalRounds = settings.maxWins + settings.maxLosses - 1

  // Build a lookup: roundNumber → bucketKey (w:l) → matches
  const matchesByRoundBucket: Record<number, Record<string, Array<{
    team1Id: string | null
    team2Id: string | null
    winnerId: string | null
    status: string
  }>>> = {}

  // Compute team records incrementally per round
  const teamRecords: Record<string, { wins: number; losses: number }> = {}
  for (const tid of Object.keys(teams)) {
    teamRecords[tid] = { wins: 0, losses: 0 }
  }

  for (let r = 1; r <= totalRounds; r++) {
    const round = rounds.find(rd => rd.roundNumber === r)
    if (!round || round.matches.length === 0) break

    matchesByRoundBucket[r] = {}

    for (const m of round.matches) {
      // Determine the bucket based on records BEFORE this round
      const tid = m.team1Id
      const rec = tid ? (teamRecords[tid] || { wins: 0, losses: 0 }) : { wins: 0, losses: 0 }
      const bucketKey = `${rec.wins}:${rec.losses}`

      if (!matchesByRoundBucket[r][bucketKey]) {
        matchesByRoundBucket[r][bucketKey] = []
      }
      matchesByRoundBucket[r][bucketKey].push({
        team1Id: m.team1Id,
        team2Id: m.team2Id,
        winnerId: m.winnerId,
        status: m.status,
      })
    }

    // After processing this round's matches for bucket assignment,
    // update records based on results
    for (const m of round.matches) {
      if (m.status !== 'Completed' || !m.result) continue
      if (m.result === 'Team1_Win') {
        if (m.team1Id && teamRecords[m.team1Id]) teamRecords[m.team1Id].wins++
        if (m.team2Id && teamRecords[m.team2Id]) teamRecords[m.team2Id].losses++
      } else if (m.result === 'Team2_Win') {
        if (m.team2Id && teamRecords[m.team2Id]) teamRecords[m.team2Id].wins++
        if (m.team1Id && teamRecords[m.team1Id]) teamRecords[m.team1Id].losses++
      }
    }
  }

  // Also compute qualified/eliminated teams for topCut sections
  const qualifiedTeams: Record<string, string[]> = {} // record → teamIds
  const eliminatedTeams: Record<string, string[]> = {}
  for (const [tid, rec] of Object.entries(teamRecords)) {
    if (rec.wins >= settings.maxWins) {
      const key = `${rec.wins}:${rec.losses}`
      if (!qualifiedTeams[key]) qualifiedTeams[key] = []
      qualifiedTeams[key].push(tid)
    } else if (rec.losses >= settings.maxLosses) {
      const key = `${rec.wins}:${rec.losses}`
      if (!eliminatedTeams[key]) eliminatedTeams[key] = []
      eliminatedTeams[key].push(tid)
    }
  }

  const teamToCard = (tid: string): SwissMatchCardTeam | null => {
    const t = teams[tid]
    if (!t) return null
    return { id: t.id, name: t.name, team_avatar: t.team_avatar }
  }

  // Now overlay onto skeleton
  // Round index in skeleton: column 0 = round 1, etc.
  for (let colIdx = 0; colIdx < skeleton.columns.length; colIdx++) {
    const roundNum = colIdx + 1
    const col = skeleton.columns[colIdx]

    for (const round of col.rounds) {
      // Match sections: try to fill with real data
      if (round.teamPairs && matchesByRoundBucket[roundNum]) {
        const bucketKey = round.title // e.g. "0:0", "1:0", etc.
        const realMatches = matchesByRoundBucket[roundNum][bucketKey]

        if (realMatches) {
          for (let i = 0; i < round.teamPairs.length && i < realMatches.length; i++) {
            const rm = realMatches[i]
            if (rm.team1Id) {
              round.teamPairs[i].team1 = teamToCard(rm.team1Id) || round.teamPairs[i].team1
            }
            if (rm.team2Id) {
              round.teamPairs[i].team2 = teamToCard(rm.team2Id) || round.teamPairs[i].team2
            }
            // Set status
            if (rm.status === 'Completed') {
              round.teamPairs[i].status = 'done'
              if (rm.winnerId === rm.team1Id) round.teamPairs[i].winner = 'team1'
              else if (rm.winnerId === rm.team2Id) round.teamPairs[i].winner = 'team2'
            } else if (rm.status === 'In_Progress') {
              round.teamPairs[i].status = 'live'
            }
          }
        }
      }

      // TopCut sections: fill with real qualified/eliminated teams
      if (round.type === 'topcut' && round.topCut) {
        const tc = round.topCut

        // Single-group topCut (has teams array)
        if (tc.teams && round.title) {
          const qTeams = qualifiedTeams[round.title]
          const eTeams = eliminatedTeams[round.title]
          const realTeams = qTeams || eTeams
          if (realTeams) {
            for (let i = 0; i < tc.teams.length && i < realTeams.length; i++) {
              const card = teamToCard(realTeams[i])
              if (card) tc.teams[i] = card
            }
          }
        }

        // Split topCut (has leftTeams/rightTeams)
        if (tc.leftTeams && tc.leftTitle) {
          const realLeft = qualifiedTeams[tc.leftTitle] || eliminatedTeams[tc.leftTitle]
          if (realLeft) {
            for (let i = 0; i < tc.leftTeams.length && i < realLeft.length; i++) {
              const card = teamToCard(realLeft[i])
              if (card) tc.leftTeams[i] = card
            }
          }
        }
        if (tc.rightTeams && tc.rightTitle) {
          const realRight = qualifiedTeams[tc.rightTitle] || eliminatedTeams[tc.rightTitle]
          if (realRight) {
            for (let i = 0; i < tc.rightTeams.length && i < realRight.length; i++) {
              const card = teamToCard(realRight[i])
              if (card) tc.rightTeams[i] = card
            }
          }
        }
      }
    }
  }

  return skeleton
}

export function SwissBracketPreview({ data, teams, maxWins = 2, maxLosses = 2, teamCount: forcedTeamCount }: SwissBracketPreviewProps) {
  const [bracketData, setBracketData] = useState<SwissFormatData | null>(null)

  useEffect(() => {
    // Determine team count and team list
    let resolvedTeams: Team[]
    let resolvedMaxWins = maxWins
    let resolvedMaxLosses = maxLosses

    if (data) {
      // Data-driven mode: get teams from data
      resolvedTeams = Object.values(data.teams).map(t => ({
        id: t.id,
        name: t.name,
        team_avatar: t.team_avatar,
      }))
      resolvedMaxWins = data.settings.maxWins
      resolvedMaxLosses = data.settings.maxLosses
    } else {
      resolvedTeams = teams || []
    }

    const targetTeamCount = forcedTeamCount || (data ? Object.keys(data.teams).length : 0) || Math.pow(2, Math.ceil(Math.log2(Math.max(8, resolvedTeams.length))))
    const paddedTeams = resolvedTeams.length >= targetTeamCount ? resolvedTeams.slice(0, targetTeamCount) : [
      ...resolvedTeams,
      ...Array(targetTeamCount - resolvedTeams.length).fill(null).map((_, i) => ({
        id: `placeholder-${i}`,
        name: `TBD`,
        team_avatar: undefined
      }))
    ]

    // Generate the visual skeleton using the original combinatorial math
    let result = generateSwissBracket(paddedTeams, resolvedMaxWins, resolvedMaxLosses)

    // If we have real data, overlay it onto the skeleton
    if (data && data.rounds.some(r => r.matches.length > 0)) {
      result = overlayRealData(result, data)
    }

    setBracketData(result)
  }, [data, teams, maxWins, maxLosses, forcedTeamCount])

  if (!bracketData) {
    return <div className="text-zinc-500">Loading bracket...</div>
  }

  return <SwissMatchContainer columns={bracketData.columns} />
}
