'use client'

import { useState, useEffect } from 'react'
import { TeamAvatar, getTeamAvatarUrl } from '@/components/ui/team-avatar'
import { SwissMatchCard } from '@/components/ui/swiss-match-card'
import { SwissMatchCardWrapper } from '@/components/ui/swiss-match-card-wrapper'
import { SwissMatchColumn } from '@/components/ui/swiss-match-column'
import { SwissMatchContainer } from '@/components/ui/swiss-match-container'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'

interface TestTeam {
  id: string
  name: string
  team_avatar?: number
}

export default function UITestPage() {
  const [teams, setTeams] = useState<TestTeam[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .limit(10)

      if (error) {
        console.error('Error fetching teams:', error)
        return
      }

      setTeams(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get first few teams for testing, or use fallback if no teams exist
  const testTeams = teams.length > 0 ? teams.slice(0, 6) : [
    { id: '1', name: 'Team Phoenix', team_avatar: 29 },
    { id: '2', name: 'Team Thunder', team_avatar: 42 },
    { id: '3', name: 'Team Shadow', team_avatar: 1 },
    { id: '4', name: 'Team Frost', team_avatar: 33 },
    { id: '5', name: 'Team Mystic' },
    { id: '6', name: 'Team Victory', team_avatar: 45 },
  ]

  // Real teams for SwissMatchCard testing
  const realTeams = teams.length >= 16 ? teams.slice(0, 16) : [
    // Use available teams from database, then add fallback teams
    ...teams.slice(0, Math.min(teams.length, 16)),
    // Add fallback teams to reach 16 total
    { id: '1', name: 'Team Alpha', team_avatar: 29 },
    { id: '2', name: 'Team Beta', team_avatar: 42 },
    { id: '3', name: 'Team Gamma', team_avatar: 1 },
    { id: '4', name: 'Team Delta', team_avatar: 33 },
    { id: '5', name: 'Team Epsilon', team_avatar: 45 },
    { id: '6', name: 'Team Zeta', team_avatar: 12 },
    { id: '7', name: 'Team Eta', team_avatar: 8 },
    { id: '8', name: 'Team Theta', team_avatar: 22 },
    { id: '9', name: 'Team Iota', team_avatar: 18 },
    { id: '10', name: 'Team Kappa', team_avatar: 36 },
    { id: '11', name: 'Team Lambda', team_avatar: 54 },
    { id: '12', name: 'Team Mu', team_avatar: 67 },
    { id: '13', name: 'Team Nu', team_avatar: 73 },
    { id: '14', name: 'Team Xi', team_avatar: 91 },
    { id: '15', name: 'Team Omicron', team_avatar: 104 },
    { id: '16', name: 'Team Pi', team_avatar: 119 }
  ].slice(0, 16)

  return (
    <main className="min-h-screen pt-24 pb-12 bg-gradient-to-b from-background to-secondary/20">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">UI Components Test</h1>
          <p className="text-muted-foreground">Testing various UI components and configurations</p>
        </div>

        {/* Team Avatar Tests */}
        <Card className="p-2 mb-2">
          <h2 className="text-xl font-bold mb-6">Team Avatar Component</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading teams from database...</p>
            </div>
          ) : (
            <>
              {/* Size Variants */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Size Variants</h3>
                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="text-center">
                    <TeamAvatar team={testTeams[0]} size="sm" />
                    <p className="text-xs mt-2">Small</p>
                  </div>
                  <div className="text-center">
                    <TeamAvatar team={testTeams[0]} size="md" />
                    <p className="text-xs mt-2">Medium</p>
                  </div>
                  <div className="text-center">
                    <TeamAvatar team={testTeams[0]} size="lg" />
                    <p className="text-xs mt-2">Large</p>
                  </div>
                </div>
              </div>

              {/* Real Teams from Database */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Real Teams from Database</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                  {testTeams.map((team) => (
                    <div key={team.id} className="text-center">
                      <TeamAvatar 
                        team={team} 
                        size="md" 
                        showTooltip={true}
                      />
                      <p className="text-xs mt-2 truncate">{team.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Swiss Match Card Tests */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Swiss Match Card Component</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading teams from database...</p>
            </div>
          ) : (
            <>
              {/* Real Teams Live Match */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Live Match: {realTeams[0]?.name || 'Team 1'} vs {realTeams[1]?.name || 'Team 2'}</h3>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <SwissMatchCard 
                    team1={realTeams[0]} 
                    team2={realTeams[1]} 
                    status="live"
                  />
                </div>
              </div>

              {/* Real Teams Scheduled Match */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Scheduled Match: {realTeams[2]?.name || 'Team 3'} vs {realTeams[3]?.name || 'Team 4'}</h3>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <SwissMatchCard 
                    team1={realTeams[2]} 
                    team2={realTeams[3]} 
                    status="scheduled"
                  />
                </div>
              </div>

              {/* Real Teams Completed Matches */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Completed Matches - Real Teams</h3>
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">{realTeams[0]?.name || 'Team 1'} defeated {realTeams[1]?.name || 'Team 2'}:</p>
                    <SwissMatchCard 
                      team1={realTeams[0]} 
                      team2={realTeams[1]} 
                      status="done"
                      winner="team1"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">{realTeams[3]?.name || 'Team 4'} defeated {realTeams[2]?.name || 'Team 3'}:</p>
                    <SwissMatchCard 
                      team1={realTeams[2]} 
                      team2={realTeams[3]} 
                      status="done"
                      winner="team2"
                    />
                  </div>
                </div>
              </div>

              {/* Tournament Bracket Simulation */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Tournament Bracket Simulation</h3>
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <div className="text-center text-sm text-muted-foreground mb-4">Quarter Finals</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SwissMatchCard 
                      team1={realTeams[0]} 
                      team2={realTeams[2]} 
                      status="done"
                      winner="team1"
                    />
                    <SwissMatchCard 
                      team1={realTeams[1]} 
                      team2={realTeams[3]} 
                      status="done"
                      winner="team1"
                    />
                  </div>
                  
                  <div className="text-center text-sm text-muted-foreground mb-4 mt-6">Semi Finals</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SwissMatchCard 
                      team1={realTeams[0]} 
                      team2={realTeams[1]} 
                      status="live"
                    />
                    <SwissMatchCard 
                      team1={null} 
                      team2={null} 
                      status="scheduled"
                    />
                  </div>
                </div>
              </div>

              {/* Edge Cases */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Edge Cases</h3>
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Both Teams TBD:</p>
                    <SwissMatchCard 
                      team1={null} 
                      team2={null} 
                      status="scheduled"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">{realTeams[0]?.name || 'Team 1'} vs TBD:</p>
                    <SwissMatchCard 
                      team1={realTeams[0]} 
                      team2={null} 
                      status="scheduled"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">No Winner (Draw):</p>
                    <SwissMatchCard 
                      team1={realTeams[1]} 
                      team2={realTeams[2]} 
                      status="done"
                      winner={null}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Swiss Match Card Wrapper Tests */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-6">Swiss Match Card Wrapper Component</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading teams from database...</p>
            </div>
          ) : (
            <>
              {/* 2 Teams */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">2 Teams</h3>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <SwissMatchCardWrapper 
                    title="Round 1"
                    teamPairs={[
                      {
                        team1: realTeams[0],
                        team2: realTeams[1],
                        status: 'live'
                      }
                    ]}
                  />
                </div>
              </div>

              {/* 4 Teams */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">4 Teams</h3>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <SwissMatchCardWrapper 
                    title="Quarter Finals"
                    teamPairs={[
                      {
                        team1: realTeams[0],
                        team2: realTeams[1],
                        status: 'done',
                        winner: 'team1'
                      },
                      {
                        team1: realTeams[2],
                        team2: realTeams[3],
                        status: 'live'
                      }
                    ]}
                  />
                </div>
              </div>

              {/* 6 Teams */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">6 Teams</h3>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <SwissMatchCardWrapper 
                    title="Group Stage"
                    teamPairs={[
                      {
                        team1: realTeams[0],
                        team2: realTeams[1],
                        status: 'done',
                        winner: 'team1'
                      },
                      {
                        team1: realTeams[2],
                        team2: realTeams[3],
                        status: 'done',
                        winner: 'team2'
                      },
                      {
                        team1: realTeams[0],
                        team2: null,
                        status: 'scheduled'
                      }
                    ]}
                  />
                </div>
              </div>

              {/* 8 Teams */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">8 Teams</h3>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <SwissMatchCardWrapper 
                    title="Tournament Bracket"
                    teamPairs={[
                      {
                        team1: realTeams[0],
                        team2: realTeams[1],
                        status: 'done',
                        winner: 'team1'
                      },
                      {
                        team1: realTeams[2],
                        team2: realTeams[3],
                        status: 'done',
                        winner: 'team1'
                      },
                      {
                        team1: realTeams[0],
                        team2: realTeams[2],
                        status: 'live'
                      },
                      {
                        team1: null,
                        team2: null,
                        status: 'scheduled'
                      }
                    ]}
                  />
                </div>
              </div>

              {/* Mixed Status */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Mixed Status Example</h3>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <SwissMatchCardWrapper 
                    title="Swiss Round 3"
                    teamPairs={[
                      {
                        team1: realTeams[0],
                        team2: realTeams[1],
                        status: 'done',
                        winner: 'team1'
                      },
                      {
                        team1: realTeams[2],
                        team2: realTeams[3],
                        status: 'live'
                      },
                      {
                        team1: realTeams[0],
                        team2: realTeams[2],
                        status: 'scheduled'
                      }
                    ]}
                  />
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Swiss Match Column Tests */}
        <Card className="p-2 mb-8">
          <h2 className="text-xl font-bold mb-6">Swiss Match Column Component</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading teams from database...</p>
            </div>
          ) : (
            <>
              {/* Swiss Tournament Progression - 5 Columns */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Swiss Tournament Progression (16 Teams)</h3>
                <div className="p-2 bg-muted/30 rounded-lg">
                  <SwissMatchContainer 
                    columns={[
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
                      {
                        rounds: [
                          {
                            title: "1-0",
                            teamPairs: [
                              { team1: realTeams[0], team2: realTeams[4], status: 'done', winner: 'team1' },
                              { team1: realTeams[8], team2: realTeams[12], status: 'done', winner: 'team1' },
                              { team1: realTeams[2], team2: realTeams[6], status: 'done', winner: 'team2' },
                              { team1: realTeams[10], team2: realTeams[14], status: 'done', winner: 'team2' }
                            ]
                          },
                          {
                            title: "0-1",
                            teamPairs: [
                              { team1: realTeams[1], team2: realTeams[5], status: 'live' },
                              { team1: realTeams[9], team2: realTeams[13], status: 'live' },
                              { team1: realTeams[3], team2: realTeams[7], status: 'scheduled' },
                              { team1: realTeams[11], team2: realTeams[15], status: 'scheduled' }
                            ]
                          }
                        ]
                      },
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
                              { team1: realTeams[6], team2: realTeams[14], status: 'live' },
                              { team1: realTeams[1], team2: realTeams[9], status: 'live' },
                              { team1: realTeams[3], team2: realTeams[11], status: 'scheduled' }
                            ]
                          },
                          {
                            title: "0:2",
                            teamPairs: [
                              { team1: realTeams[5], team2: realTeams[13], status: 'scheduled' },
                              { team1: realTeams[7], team2: realTeams[15], status: 'scheduled' }
                            ]
                          }
                        ]
                      },
                      {
                        rounds: [
                          {
                            title: "2:1",
                            teamPairs: [
                              { team1: realTeams[0], team2: realTeams[4], status: 'done', winner: 'team1' },
                              { team1: realTeams[6], team2: realTeams[2], status: 'live' },
                              { team1: realTeams[1], team2: realTeams[3], status: 'live' }
                            ]
                          },
                          {
                            title: "1:2",
                            teamPairs: [
                              { team1: realTeams[8], team2: realTeams[12], status: 'scheduled' },
                              { team1: realTeams[10], team2: realTeams[14], status: 'scheduled' },
                              { team1: realTeams[5], team2: realTeams[7], status: 'scheduled' }
                            ]
                          }
                        ]
                      },
                      {
                        rounds: [
                          {
                            title: "2:2",
                            teamPairs: [
                              { team1: realTeams[0], team2: realTeams[6], status: 'live' },
                              { team1: realTeams[2], team2: realTeams[1], status: 'scheduled' },
                              { team1: realTeams[4], team2: realTeams[8], status: 'scheduled' }
                            ]
                          }
                        ]
                      }
                    ]}
                  />
                </div>
              </div>

              {/* Single Round */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Single Round</h3>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <SwissMatchColumn 
                    rounds={[
                      {
                        title: "Finals",
                        teamPairs: [
                          {
                            team1: realTeams[0],
                            team2: realTeams[1],
                            status: 'live'
                          }
                        ]
                      }
                    ]}
                  />
                </div>
              </div>

              {/* Empty State */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Empty State</h3>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <SwissMatchColumn 
                    rounds={[]}
                  />
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </main>
  )
}
