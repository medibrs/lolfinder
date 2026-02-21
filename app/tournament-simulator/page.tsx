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

interface TeamRecord {
  id: string
  wins: number
  losses: number
}

export default function TournamentSimulator() {
  const [tournamentData, setTournamentData] = useState<SwissFormatData | null>(null)
  const [teamCount, setTeamCount] = useState(8)
  const [maxWins, setMaxWins] = useState(2)
  const [maxLosses, setMaxLosses] = useState(2)

  const [teams, setTeams] = useState<Team[]>([])
  const [teamRecords, setTeamRecords] = useState<Map<string, TeamRecord>>(new Map())

  const generateTeams = (count: number): Team[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: (i + 1).toString(),
      name: `Team ${String.fromCharCode(65 + i)}`,
      team_avatar: (i % 8) + 1
    }))
  }

  // Factorial helper
  const factorial = (n: number): number => {
    if (n <= 1) return 1
    return n * factorial(n - 1)
  }

  // nCr helper
  const combinations = (n: number, k: number): number => {
    if (k < 0 || k > n) return 0
    return factorial(n) / (factorial(k) * factorial(n - k))
  }

  const initializeTournament = () => {
    const newTeams = generateTeams(teamCount)
    setTeams(newTeams)

    // Reset records
    const initialRecords = new Map<string, TeamRecord>()
    newTeams.forEach(t => {
      initialRecords.set(t.id, { id: t.id, wins: 0, losses: 0 })
    })
    setTeamRecords(initialRecords)

    const totalRounds = maxWins + maxLosses - 1
    const columns = []

    const createPlaceholder = (id: string) => ({
      id: `ph-${id}`, name: 'TBD', team_avatar: undefined
    })

    // Helper to create matches with placeholders
    const createMatches = (matchCount: number, prefix: string) =>
      Array.from({ length: Math.max(1, Math.floor(matchCount)) }, (_, i) => ({
        team1: createPlaceholder(`${prefix}-m${i}-1`),
        team2: createPlaceholder(`${prefix}-m${i}-2`),
        status: 'scheduled' as const,
        winner: null
      }))

    // Helper to create topcut placeholders
    const createTopCutTeams = (teamCount: number, prefix: string) =>
      Array.from({ length: Math.max(1, Math.floor(teamCount)) }, (_, i) =>
        createPlaceholder(`${prefix}-t${i}`)
      )

    // Calculate bucket capacity: N * C(r, w) / 2^r
    const getBucketCount = (w: number, l: number) => {
      const r = w + l
      // For buckets that just Qualified/Eliminated, they came from r-1
      // But here we iterate r.
      // Standard bucket capacity at round r (before match) is determined by previous round.
      // But theoretically it follows the distribution.
      const count = (teamCount * combinations(r, w)) / Math.pow(2, r)
      return count
    }

    // Generate Columns
    for (let r = 1; r <= totalRounds; r++) {
      const roundIndex = r - 1
      const roundsInCol: SwissRound[] = []
      const isLastRound = r === totalRounds

      // Special handling for the last round (Double TopCut style)
      if (isLastRound) {
        // Qualified Top Left: (maxWins)-(maxLosses-2) -> e.g. 3-1
        const qLeftW = maxWins
        const qLeftL = maxLosses - 2
        const qLeftCount = getBucketCount(qLeftW - 1, qLeftL) / 2 // Winners from previous round (approx)
        // Actually, for Q/E buckets, the count is the winners of the previous match bucket.
        // Previous bucket was (qLeftW-1, qLeftL). Count P. Winners P/2.
        // Correct.

        // Qualified Top Right: (maxWins)-(maxLosses-1) -> e.g. 3-2
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
              teams: createTopCutTeams(qRightCount, `q-single-${r}`),
              backgroundColor: 'green'
            }
          })
        }

        // Decider Match: (maxWins-1)-(maxLosses-1) -> e.g. 2-2
        const dW = maxWins - 1
        const dL = maxLosses - 1
        const dCount = getBucketCount(dW, dL)
        roundsInCol.push({
          title: `${dW}:${dL}`,
          isLastRound: true,
          teamPairs: createMatches(dCount / 2, `decider-${r}`)
        })

        // Eliminated Bottom Left: (maxWins-2)-(maxLosses) -> e.g. 1-3
        const eLeftW = maxWins - 2
        const eLeftL = maxLosses
        const eLeftCount = getBucketCount(eLeftW, eLeftL - 1) / 2

        // Eliminated Bottom Right: (maxWins-1)-(maxLosses) -> e.g. 2-3
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
              teams: createTopCutTeams(eRightCount, `e-single-${r}`),
              backgroundColor: 'red'
            }
          })
        }

      } else {
        // Standard Round
        const qualifiedBuckets = []
        const matchBuckets = []
        const eliminatedBuckets = []

        for (let w = roundIndex; w >= 0; w--) {
          const l = roundIndex - w
          if (w > maxWins || l > maxLosses) continue

          if (w === maxWins && l < maxLosses) {
            if (l <= roundIndex) {
              const count = getBucketCount(w - 1, l) / 2
              qualifiedBuckets.push({ w, l, count })
            }
          } else if (l === maxLosses && w < maxWins) {
            if (w <= roundIndex) {
              const count = getBucketCount(w, l - 1) / 2
              eliminatedBuckets.push({ w, l, count })
            }
          } else if (w < maxWins && l < maxLosses) {
            const count = getBucketCount(w, l)
            matchBuckets.push({ w, l, count })
          }
        }

        qualifiedBuckets.forEach(({ w, l, count }) => {
          roundsInCol.push({
            type: 'topcut',
            title: `${w}:${l}`,
            topCut: {
              teams: createTopCutTeams(count, `q-${r}-${w}-${l}`),
              backgroundColor: 'green'
            }
          })
        })

        matchBuckets.forEach(({ w, l, count }) => {
          roundsInCol.push({
            title: `${w}:${l}`,
            teamPairs: createMatches(count / 2, `m-${r}-${w}-${l}`)
          })
        })

        eliminatedBuckets.forEach(({ w, l, count }) => {
          roundsInCol.push({
            type: 'topcut',
            title: `${w}:${l}`,
            topCut: {
              teams: createTopCutTeams(count, `e-${r}-${w}-${l}`),
              backgroundColor: 'red'
            }
          })
        })
      }

      columns.push({ rounds: roundsInCol })
    }

    const initialData: SwissFormatData = { columns }

    // Initial Pairing for Round 1 (0-0)
    // We need to populate the first bucket 0:0
    if (columns.length > 0 && columns[0].rounds.length > 0) {
      const r1Matches = []
      const shuffled = [...newTeams].sort(() => Math.random() - 0.5)
      for (let i = 0; i < Math.floor(newTeams.length / 2); i++) {
        r1Matches.push({
          team1: shuffled[i * 2],
          team2: shuffled[i * 2 + 1],
          status: 'scheduled' as const,
          winner: null
        })
      }
      // If odd number, one team sits out (not handled here for simplicity)

      columns[0].rounds[0].teamPairs = r1Matches
      // Update title if needed? It's 0:0 generated by loop
    }

    setTournamentData(initialData)
  }

  // Re-initialize when settings change
  useEffect(() => {
    initializeTournament()
  }, [teamCount, maxWins, maxLosses]) // Dependency on settings

  const getScheduledMatches = () => {
    if (!tournamentData) return []
    const matches: any[] = []
    tournamentData.columns.forEach((col, cIdx) => {
      col.rounds.forEach((round, rIdx) => {
        round.teamPairs?.forEach((pair, mIdx) => {
          if (pair.status === 'scheduled' && pair.team1 && pair.team2) {
            // Check if both teams are real, not placeholders
            const isRealTeam1 = !pair.team1.id.startsWith('ph-')
            const isRealTeam2 = !pair.team2.id.startsWith('ph-')
            if (isRealTeam1 && isRealTeam2) {
              matches.push({ cIdx, rIdx, mIdx, pair })
            }
          }
        })
      })
    })

    return matches
  }

  const playNextMatch = () => {
    const matches = getScheduledMatches()
    if (matches.length === 0) return

    const match = matches[0]
    const winner = Math.random() > 0.5 ? 'team1' : 'team2'

    // Deep clone to ensure React detects changes
    const newData: SwissFormatData = JSON.parse(JSON.stringify(tournamentData!))
    const pair = newData.columns[match.cIdx].rounds[match.rIdx].teamPairs![match.mIdx]
    pair.status = 'done'
    pair.winner = winner

    const winnerId = winner === 'team1' ? pair.team1!.id : pair.team2!.id
    const loserId = winner === 'team1' ? pair.team2!.id : pair.team1!.id

    const newRecords = new Map(teamRecords)
    const winRec = newRecords.get(winnerId)
    const loseRec = newRecords.get(loserId)

    // These should always exist since we filter placeholders in getScheduledMatches
    if (winRec && loseRec) {
      winRec.wins++
      loseRec.losses++
    }
    setTeamRecords(newRecords)

    // Check if we should progress (all matches in current bucket done)
    const currentBucketPairs = newData.columns[match.cIdx].rounds[match.rIdx].teamPairs
    const allDone = currentBucketPairs?.every(p => p.status === 'done')

    if (allDone) {
      // Progress only the completed bucket
      progressSpecificBucket(newData, newRecords, match.cIdx, match.rIdx)
    } else {
      setTournamentData(newData)
    }
  }

  const progressSpecificBucket = (data: SwissFormatData, records: Map<string, TeamRecord>, cIdx: number, rIdx: number) => {

    // Deep clone to ensure React detects changes
    const newData: SwissFormatData = JSON.parse(JSON.stringify(data))

    // Helper to find coordinates of a bucket W-L
    const findBucketCoords = (w: number, l: number) => {
      for (let c = 0; c < newData.columns.length; c++) {
        for (let r = 0; r < newData.columns[c].rounds.length; r++) {
          const round = newData.columns[c].rounds[r]
          // Check simple title match
          if (round.title === `${w}:${l}`) return { c, r, isTopCut: round.type === 'topcut' }

          // Check complex titles (Last round)
          if (round.topCut) {
            if (round.topCut.leftTitle === `${w}:${l}`) return { c, r, isLeft: true, isTopCut: true }
            if (round.topCut.rightTitle === `${w}:${l}`) return { c, r, isRight: true, isTopCut: true }
          }
        }
      }
      return null
    }

    // Helper to check if a source bucket is complete
    const isBucketComplete = (w: number, l: number) => {
      const coords = findBucketCoords(w, l)
      if (!coords || coords.isTopCut) return true // TopCut or non-existent = complete
      const round = newData.columns[coords.c].rounds[coords.r]
      if (!round.teamPairs || round.teamPairs.length === 0) return true
      return round.teamPairs.every(p => p.status === 'done')
    }

    // Helper to get teams from a completed bucket
    const getTeamsFromBucket = (w: number, l: number, type: 'winners' | 'losers') => {
      const coords = findBucketCoords(w, l)
      if (!coords || coords.isTopCut) return []
      const round = newData.columns[coords.c].rounds[coords.r]
      if (!round.teamPairs) return []

      if (type === 'winners') {
        return round.teamPairs.map(p => p.winner === 'team1' ? p.team1 : p.team2).filter(Boolean)
      } else {
        return round.teamPairs.map(p => p.winner === 'team1' ? p.team2 : p.team1).filter(Boolean)
      }
    }

    const round = newData.columns[cIdx].rounds[rIdx]
    const pairs = round.teamPairs
    if (!pairs || pairs.length === 0) return // Skip empty

    // Skip if already processed (has a processed flag)
    if ((round as any).processed) return

      // Mark as processed to avoid re-processing
      ; (round as any).processed = true

    // Distribute teams to next stage
    const [wStr, lStr] = round.title.split(':')
    const w = parseInt(wStr)
    const l = parseInt(lStr)

    // Winners go to (w+1):l - this bucket receives from (w):l winners only
    // Losers go to w:(l+1) - this bucket receives from (w):(l) losers AND (w-1):(l+1) winners

    // Populate Winner Bucket (w+1):l
    const targetWin = findBucketCoords(w + 1, l)

    if (targetWin && !targetWin.isTopCut) {
      // For match buckets, check if all source buckets are complete
      // Target (w+1):l receives winners from (w):l only
      // So we just need current bucket to be done (which it is)
      const targetRound = newData.columns[targetWin.c].rounds[targetWin.r]
      const winners = pairs.map(p => p.winner === 'team1' ? p.team1 : p.team2).filter(Boolean)

      // Store winners in pending pool
      if (!(targetRound as any).pendingTeams) {
        (targetRound as any).pendingTeams = []
      }
      (targetRound as any).pendingTeams.push(...winners)


      // Check if we have enough teams to fill all matches
      const expectedTeams = targetRound.teamPairs!.length * 2
      if ((targetRound as any).pendingTeams.length >= expectedTeams) {
        // Shuffle and create matchups
        const allTeams = [...(targetRound as any).pendingTeams].sort(() => Math.random() - 0.5)


        for (let i = 0; i < targetRound.teamPairs!.length && i * 2 + 1 < allTeams.length; i++) {
          targetRound.teamPairs![i].team1 = allTeams[i * 2] || null
          targetRound.teamPairs![i].team2 = allTeams[i * 2 + 1] || null
          targetRound.teamPairs![i].status = 'scheduled'
        }
        delete (targetRound as any).pendingTeams
      }
    } else if (targetWin && targetWin.isTopCut) {
      const winners = pairs.map(p => p.winner === 'team1' ? p.team1 : p.team2).filter(Boolean)
      const targetRound = newData.columns[targetWin.c].rounds[targetWin.r]
      if (targetWin.isLeft) targetRound.topCut!.leftTeams = winners as SwissMatchCardTeam[]
      else if (targetWin.isRight) targetRound.topCut!.rightTeams = winners as SwissMatchCardTeam[]
      else targetRound.topCut!.teams = winners as SwissMatchCardTeam[]
    }

    // Populate Loser Bucket w:(l+1)
    const targetLose = findBucketCoords(w, l + 1)


    if (targetLose && !targetLose.isTopCut) {
      const targetRound = newData.columns[targetLose.c].rounds[targetLose.r]
      const losers = pairs.map(p => p.winner === 'team1' ? p.team2 : p.team1).filter(Boolean)

      // Store losers in pending pool
      if (!(targetRound as any).pendingTeams) {
        (targetRound as any).pendingTeams = []
      }
      (targetRound as any).pendingTeams.push(...losers)


      // Check if we have enough teams to fill all matches
      const expectedTeams = targetRound.teamPairs!.length * 2
      if ((targetRound as any).pendingTeams.length >= expectedTeams) {
        // Shuffle and create matchups
        const allTeams = [...(targetRound as any).pendingTeams].sort(() => Math.random() - 0.5)


        for (let i = 0; i < targetRound.teamPairs!.length && i * 2 + 1 < allTeams.length; i++) {
          targetRound.teamPairs![i].team1 = allTeams[i * 2] || null
          targetRound.teamPairs![i].team2 = allTeams[i * 2 + 1] || null
          targetRound.teamPairs![i].status = 'scheduled'
        }
        delete (targetRound as any).pendingTeams
      }
    } else if (targetLose && targetLose.isTopCut) {
      const losers = pairs.map(p => p.winner === 'team1' ? p.team2 : p.team1).filter(Boolean)
      const targetRound = newData.columns[targetLose.c].rounds[targetLose.r]
      if (targetLose.isLeft) targetRound.topCut!.leftTeams = losers as SwissMatchCardTeam[]
      else if (targetLose.isRight) targetRound.topCut!.rightTeams = losers as SwissMatchCardTeam[]
      else targetRound.topCut!.teams = losers as SwissMatchCardTeam[]
    }


    setTournamentData(newData)
  }

  const progressTournament = (data: SwissFormatData, records: Map<string, TeamRecord>) => {

    // Deep clone to ensure React detects changes
    const newData: SwissFormatData = JSON.parse(JSON.stringify(data))

    // Helper to find coordinates of a bucket W-L
    const findBucketCoords = (w: number, l: number) => {
      for (let c = 0; c < newData.columns.length; c++) {
        for (let r = 0; r < newData.columns[c].rounds.length; r++) {
          const round = newData.columns[c].rounds[r]
          // Check simple title match
          if (round.title === `${w}:${l}`) return { c, r, isTopCut: round.type === 'topcut' }

          // Check complex titles (Last round)
          if (round.topCut) {
            if (round.topCut.leftTitle === `${w}:${l}`) return { c, r, isLeft: true, isTopCut: true }
            if (round.topCut.rightTitle === `${w}:${l}`) return { c, r, isRight: true, isTopCut: true }
          }
        }
      }
      return null
    }

    // Check if a bucket is complete (all matches done)
    // We iterate over all Match buckets
    const matchBuckets: { c: number, r: number, title: string }[] = []
    newData.columns.forEach((col, c) => {
      col.rounds.forEach((round, r) => {
        if (round.type !== 'topcut' && round.teamPairs) {
          matchBuckets.push({ c, r, title: round.title })
        }
      })
    })

    matchBuckets.forEach(bucket => {
      const round = newData.columns[bucket.c].rounds[bucket.r]
      const pairs = round.teamPairs
      if (!pairs || pairs.length === 0) return // Skip empty

      // Skip if already processed (has a processed flag)
      if ((round as any).processed) return

      // Check if this bucket matches are all done
      const allDone = pairs.every(p => p.status === 'done')
      if (allDone) {
        // Mark as processed to avoid re-processing
        (round as any).processed = true

        // Distribute teams to next stage
        const [wStr, lStr] = bucket.title.split(':')
        const w = parseInt(wStr)
        const l = parseInt(lStr)

        // Winners go to (w+1):l
        // Losers go to w:(l+1)

        // Populate Winner Bucket
        const targetWin = findBucketCoords(w + 1, l)


        if (targetWin) {
          const winners = pairs.map(p => p.winner === 'team1' ? p.team1 : p.team2).filter(Boolean)


          // Shuffle winners for random matchups
          const shuffledWinners = [...winners].sort(() => Math.random() - 0.5)


          if (targetWin.isTopCut) {
            const round = newData.columns[targetWin.c].rounds[targetWin.r]
            if (targetWin.isLeft) round.topCut!.leftTeams = shuffledWinners as SwissMatchCardTeam[]
            else if (targetWin.isRight) round.topCut!.rightTeams = shuffledWinners as SwissMatchCardTeam[]
            else round.topCut!.teams = shuffledWinners as SwissMatchCardTeam[]
          } else {
            // Match bucket - populate scheduled matches
            const round = newData.columns[targetWin.c].rounds[targetWin.r]

            // Find empty slots (with placeholders) and fill them
            let winnerIdx = 0
            for (let i = 0; i < round.teamPairs!.length && winnerIdx < winners.length; i++) {
              const pair = round.teamPairs![i]
              // Check if this slot has placeholders
              const team1IsPlaceholder = !pair.team1 || pair.team1.id.startsWith('ph-')
              const team2IsPlaceholder = !pair.team2 || pair.team2.id.startsWith('ph-')

              if (team1IsPlaceholder && team2IsPlaceholder && winnerIdx + 1 <= shuffledWinners.length) {
                // Both slots empty, fill with a pair
                pair.team1 = shuffledWinners[winnerIdx++] || null
                pair.team2 = shuffledWinners[winnerIdx++] || null
                pair.status = 'scheduled'

              }
            }
          }
        }

        // Populate Loser Bucket
        const targetLose = findBucketCoords(w, l + 1)


        if (targetLose) {
          const losers = pairs.map(p => p.winner === 'team1' ? p.team2 : p.team1).filter(Boolean)


          // Shuffle losers for random matchups
          const shuffledLosers = [...losers].sort(() => Math.random() - 0.5)


          if (targetLose.isTopCut) {
            const round = newData.columns[targetLose.c].rounds[targetLose.r]
            if (targetLose.isLeft) round.topCut!.leftTeams = shuffledLosers as SwissMatchCardTeam[]
            else if (targetLose.isRight) round.topCut!.rightTeams = shuffledLosers as SwissMatchCardTeam[]
            else round.topCut!.teams = shuffledLosers as SwissMatchCardTeam[]
          } else {
            const round = newData.columns[targetLose.c].rounds[targetLose.r]

            // Find empty slots (with placeholders) and fill them
            let loserIdx = 0
            for (let i = 0; i < round.teamPairs!.length && loserIdx < losers.length; i++) {
              const pair = round.teamPairs![i]
              // Check if this slot has placeholders
              const team1IsPlaceholder = !pair.team1 || pair.team1.id.startsWith('ph-')
              const team2IsPlaceholder = !pair.team2 || pair.team2.id.startsWith('ph-')

              if (team1IsPlaceholder && team2IsPlaceholder && loserIdx + 1 <= shuffledLosers.length) {
                // Both slots empty, fill with a pair
                pair.team1 = shuffledLosers[loserIdx++] || null
                pair.team2 = shuffledLosers[loserIdx++] || null
                pair.status = 'scheduled'

              }
            }
          }
        }
      }
    })


    setTournamentData(newData)
  }

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
            {getScheduledMatches().length} matches remaining
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
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Teams:</label>
              <select
                value={teamCount}
                onChange={(e) => {
                  const count = Number(e.target.value)
                  setTeamCount(count)
                  if (count <= 8) {
                    setMaxWins(2)
                    setMaxLosses(2)
                  } else {
                    setMaxWins(3)
                    setMaxLosses(3)
                  }
                }}
                className="px-3 py-2 border rounded w-24"
              >
                {Array.from({ length: 31 }, (_, i) => i + 2).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Advance (Wins):</label>
              <select
                value={maxWins}
                onChange={(e) => setMaxWins(Number(e.target.value))}
                className="px-3 py-2 border rounded w-24"
              >
                {[1, 2, 3, 4, 5].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Eliminate (Losses):</label>
              <select
                value={maxLosses}
                onChange={(e) => setMaxLosses(Number(e.target.value))}
                className="px-3 py-2 border rounded w-24"
              >
                {[1, 2, 3, 4, 5].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button onClick={initializeTournament} variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" />
                Generate
              </Button>

              <Button onClick={playNextMatch} variant="outline" disabled={getScheduledMatches().length === 0}>
                <FastForward className="w-4 h-4 mr-2" />
                Next
              </Button>
            </div>
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
        <CardHeader><CardTitle>Team Records</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {Array.from(teamRecords.values()).map(r => {
              const t = teams.find(team => team.id === r.id)
              return (
                <div key={r.id} className="text-xs border p-2 rounded">
                  <div className="font-bold">{t?.name}</div>
                  <div>{r.wins}W - {r.losses}L</div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
