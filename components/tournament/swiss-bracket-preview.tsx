'use client'

import { SwissMatchContainer } from '@/components/ui/swiss-match-container'

interface Team {
  id: string
  name: string
  team_avatar?: number
}

interface SwissBracketPreviewProps {
  teams: Team[]
}

export function SwissBracketPreview({ teams }: SwissBracketPreviewProps) {
  // Ensure we have at least 16 teams for the mockup
  const realTeams = teams.length >= 16 ? teams : [
    ...teams,
    ...Array(16 - teams.length).fill(null).map((_, i) => ({
      id: `placeholder-${i}`,
      name: `Team ${teams.length + i + 1}`,
      team_avatar: undefined
    }))
  ]

  return (
    <SwissMatchContainer 
      columns={[
        // Column 1: 0:0 round only
        {
          rounds: [
            {
              title: "0:0",
              teamPairs: [
                { team1: realTeams[0], team2: realTeams[1], status: 'done', winner: 'team1' },
                { team1: realTeams[2], team2: realTeams[3], status: 'done', winner: 'team2' },
                { team1: realTeams[4], team2: realTeams[5], status: 'done', winner: 'team1' },
                { team1: realTeams[6], team2: realTeams[7], status: 'done', winner: 'team2' },
                { team1: realTeams[8], team2: realTeams[9], status: 'done', winner: 'team1' },
                { team1: realTeams[10], team2: realTeams[11], status: 'done', winner: 'team2' },
                { team1: realTeams[12], team2: realTeams[13], status: 'done', winner: 'team1' },
                { team1: realTeams[14], team2: realTeams[15], status: 'done', winner: 'team2' }
              ]
            }
          ]
        },
        // Column 2: 1:0 and 0:1
        {
          rounds: [
            {
              title: "1:0",
              teamPairs: [
                { team1: realTeams[0], team2: realTeams[4], status: 'done', winner: 'team1' },
                { team1: realTeams[8], team2: realTeams[12], status: 'done', winner: 'team1' },
                { team1: realTeams[2], team2: realTeams[6], status: 'done', winner: 'team2' },
                { team1: realTeams[10], team2: realTeams[14], status: 'done', winner: 'team2' }
              ]
            },
            {
              title: "0:1",
              teamPairs: [
                { team1: realTeams[1], team2: realTeams[5], status: 'done', winner: 'team1' },
                { team1: realTeams[9], team2: realTeams[13], status: 'done', winner: 'team2' },
                { team1: realTeams[3], team2: realTeams[7], status: 'done', winner: 'team1' },
                { team1: realTeams[11], team2: realTeams[15], status: 'done', winner: 'team2' }
              ]
            }
          ]
        },
        // Column 3: 2:0, 1:1, 0:2
        {
          rounds: [
            {
              title: "2:0",
              teamPairs: [
                { team1: realTeams[0], team2: realTeams[8], status: 'done', winner: 'team1' },
                { team1: realTeams[2], team2: realTeams[10], status: 'done', winner: 'team2' }
              ]
            },
            {
              title: "1:1",
              teamPairs: [
                { team1: realTeams[4], team2: realTeams[12], status: 'done', winner: 'team1' },
                { team1: realTeams[6], team2: realTeams[14], status: 'done', winner: 'team2' },
                { team1: realTeams[1], team2: realTeams[9], status: 'done', winner: 'team1' },
                { team1: realTeams[3], team2: realTeams[11], status: 'done', winner: 'team2' }
              ]
            },
            {
              title: "0:2",
              teamPairs: [
                { team1: realTeams[5], team2: realTeams[13], status: 'done', winner: 'team1' },
                { team1: realTeams[7], team2: realTeams[15], status: 'done', winner: 'team2' }
              ]
            }
          ]
        },
        // Column 4: 3:0 topcut (top), 2:1, 1:2, 0:3 topcut (bottom)
        {
          rounds: [
            {
              type: 'topcut',
              title: "3:0",
              topCut: {
                teams: [realTeams[0], realTeams[2]],
                backgroundColor: 'green'
              }
            },
            {
              title: "2:1",
              teamPairs: [
                { team1: realTeams[0], team2: realTeams[4], status: 'done', winner: 'team1' },
                { team1: realTeams[6], team2: realTeams[2], status: 'done', winner: 'team2' },
                { team1: realTeams[1], team2: realTeams[3], status: 'done', winner: 'team1' }
              ]
            },
            {
              title: "1:2",
              teamPairs: [
                { team1: realTeams[8], team2: realTeams[12], status: 'done', winner: 'team1' },
                { team1: realTeams[10], team2: realTeams[14], status: 'done', winner: 'team2' },
                { team1: realTeams[5], team2: realTeams[7], status: 'done', winner: 'team1' }
              ]
            },
            {
              type: 'topcut',
              title: "0:3",
              topCut: {
                teams: [realTeams[13], realTeams[15]],
                backgroundColor: 'red'
              }
            }
          ]
        },
        // Column 5: 3:1|3:2 topcut (top), 2:2 (last round), 1:3|2:3 topcut (bottom)
        {
          rounds: [
            {
              type: 'topcut',
              title: "",
              topCut: {
                leftTeams: [realTeams[0], realTeams[2], realTeams[1]],
                rightTeams: [realTeams[4], realTeams[3], realTeams[10]],
                leftTitle: "3:1",
                rightTitle: "3:2",
                backgroundColor: 'green'
              }
            },
            {
              title: "2:2",
              isLastRound: true,
              teamPairs: [
                { team1: realTeams[4], team2: realTeams[6], status: 'live' },
                { team1: realTeams[3], team2: realTeams[8], status: 'scheduled' },
                { team1: realTeams[10], team2: realTeams[5], status: 'scheduled' }
              ]
            },
            {
              type: 'topcut',
              title: "",
              topCut: {
                leftTeams: [realTeams[12], realTeams[14], realTeams[7]],
                rightTeams: [realTeams[6], realTeams[8], realTeams[5]],
                leftTitle: "1:3",
                rightTitle: "2:3",
                backgroundColor: 'red'
              }
            }
          ]
        }
      ]}
    />
  )
}
