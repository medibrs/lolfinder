'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { getRankImage } from '@/lib/rank-utils'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']

interface Team {
  id: string
  name: string
  description?: string
  captain_id: string
  open_positions: string[]
  team_size: string
  recruiting_status: string
  created_at: string
  captain?: {
    summoner_name: string
  }
}

interface Player {
  id: string
  summoner_name: string
  main_role: string
  secondary_role?: string
  discord?: string
  looking_for_team: boolean
}

export default function SearchPage() {
  const [searchType, setSearchType] = useState<'players' | 'teams'>('teams')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [teams, setTeams] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [pendingRequests, setPendingRequests] = useState<string[]>([])
  const [sendingRequest, setSendingRequest] = useState<string | null>(null)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      // Check if user is in a team
      if (authUser) {
        // First check if user is a player and get their team
        const { data: playerData } = await supabase
          .from('players')
          .select('team_id')
          .eq('id', authUser.id)
          .single()
        
        // If player has a team, fetch the team data
        if (playerData?.team_id) {
          const { data: teamData } = await supabase
            .from('teams')
            .select('*')
            .eq('id', playerData.team_id)
            .single()
          
          setUserTeam(teamData)
        }

        // Fetch user's pending join requests
        const { data: requests } = await supabase
          .from('team_join_requests')
          .select('team_id')
          .eq('player_id', authUser.id)
          .eq('status', 'pending')
        
        const pendingTeamIds = requests?.map(r => r.team_id) || []
        setPendingRequests(pendingTeamIds)
      }

      const [teamsResult, playersResult] = await Promise.all([
        supabase
          .from('teams')
          .select('*, captain:players!captain_id(summoner_name)')
          .eq('recruiting_status', 'Open')
          .order('created_at', { ascending: false }),
        supabase
          .from('players')
          .select('*')
          .order('created_at', { ascending: false })
      ])

      if (teamsResult.error) console.error('Error fetching teams:', teamsResult.error)
      if (playersResult.error) console.error('Error fetching players:', playersResult.error)

      setTeams(teamsResult.data || [])
      setPlayers(playersResult.data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestToJoin = async (teamId: string, teamName: string) => {
    if (!user || sendingRequest) return

    try {
      setSendingRequest(teamId)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch('/api/team-join-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          team_id: teamId,
          message: `I'd like to join ${teamName}!`
        }),
      })

      if (response.ok) {
        alert('Join request sent successfully!')
        // Add to pending requests to update UI
        setPendingRequests(prev => [...prev, teamId])
      } else {
        const error = await response.json()
        alert(`Error sending join request: ${error.error}`)
      }
    } catch (error) {
      console.error('Error sending join request:', error)
      alert('Error sending join request')
    } finally {
      setSendingRequest(null)
    }
  }

  const handleInvitePlayer = async (playerId: string) => {
    if (!userTeam || sendingInvite) return

    try {
      setSendingInvite(playerId)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch('/api/team-invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          team_id: userTeam.id,
          invited_player_id: playerId,
          message: `You've been invited to join ${userTeam.name}!`
        }),
      })

      if (response.ok) {
        alert('Invitation sent successfully!')
        // Refresh data to update UI
        fetchData()
      } else {
        const error = await response.json()
        console.error('Error sending invitation:', error.error)
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
    } finally {
      setSendingInvite(null)
    }
  }

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-8">Find Your Match</h1>

        <div className="flex gap-4 mb-8">
          <Button
            onClick={() => setSearchType('teams')}
            className={searchType === 'teams' ? 'bg-primary hover:bg-primary/90' : 'bg-secondary hover:bg-secondary/90'}
          >
            Teams Looking for Players
          </Button>
          <Button
            onClick={() => setSearchType('players')}
            className={searchType === 'players' ? 'bg-primary hover:bg-primary/90' : 'bg-secondary hover:bg-secondary/90'}
          >
            Players Looking for Teams
          </Button>
        </div>

        <div className="mb-8 space-y-4">
          <Input
            placeholder={searchType === 'teams' ? 'Search teams...' : 'Search players...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-input border-border"
          />
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedRole === null ? 'default' : 'outline'}
              onClick={() => setSelectedRole(null)}
              className={selectedRole === null ? 'bg-primary' : ''}
            >
              All Roles
            </Button>
            {ROLES.map(role => (
              <Button
                key={role}
                variant={selectedRole === role ? 'default' : 'outline'}
                onClick={() => setSelectedRole(role)}
                className={selectedRole === role ? 'bg-primary' : ''}
              >
                {role}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {searchType === 'teams' ? (
              teams.length > 0 ? (
                teams.filter(team => {
                  const matchesRole = !selectedRole || team.open_positions.includes(selectedRole)
                  const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase())
                  return matchesRole && matchesSearch
                }).map(team => (
                  <Card key={team.id} className="bg-card border-border p-6 hover:border-primary transition">
                    <h3 className="text-2xl font-bold mb-2">{team.name}</h3>
                    {team.description && (
                      <p className="text-muted-foreground mb-4">{team.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {team.open_positions.length > 0 ? (
                        team.open_positions.map(role => (
                          <span key={role} className="bg-accent/20 text-accent px-2 py-1 rounded text-sm font-medium">
                            {role}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Team is full</span>
                      )}
                    </div>
                    {team.captain && (
                      <p className="text-sm text-muted-foreground mb-4">
                        Captain: {team.captain.summoner_name}
                      </p>
                    )}
                    {user && userTeam?.id === team.id ? (
                    <Button asChild className="w-full bg-green-600 hover:bg-green-700">
                      <a href="/view-team">View Team</a>
                    </Button>
                  ) : user && userTeam ? (
                    <Button disabled className="w-full">
                      Already in a team
                    </Button>
                  ) : user && pendingRequests.includes(team.id) ? (
                    <Button disabled className="w-full bg-orange-600">
                      Request Sent
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleRequestToJoin(team.id, team.name)}
                      disabled={sendingRequest === team.id}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {sendingRequest === team.id ? 'Sending...' : 'Request to Join'}
                    </Button>
                  )}
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground">No teams found looking for players.</p>
                </div>
              )
            ) : (
              players.length > 0 ? (
                players.filter(player => {
                  const matchesRole = !selectedRole || player.main_role === selectedRole || player.secondary_role === selectedRole
                  const matchesSearch = player.summoner_name.toLowerCase().includes(searchQuery.toLowerCase())
                  const notCurrentUser = player.id !== user?.id
                  return matchesRole && matchesSearch && notCurrentUser
                }).map(player => (
                  <Card key={player.id} className="bg-card border-border p-6 hover:border-primary transition">
                    <div className="flex items-start gap-4 mb-4">
                      <Image 
                        src={getRankImage(player.tier)} 
                        alt={player.tier}
                        width={64}
                        height={64}
                        className="object-contain"
                      />
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold mb-2">{player.summoner_name}</h3>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-primary font-semibold">{player.main_role}</span>
                          {player.secondary_role && (
                            <>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-muted-foreground">{player.secondary_role}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">Rank:</span>
                          <span className="text-sm font-semibold">{player.tier}</span>
                        </div>
                      </div>
                    </div>
                    {player.discord && (
                      <p className="text-muted-foreground mb-4">Discord: {player.discord}</p>
                    )}
                    
                    {user && userTeam && player.id !== user.id ? (
                      player.team_id ? (
                        <Button disabled className="w-full">
                          Already in a Team
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => handleInvitePlayer(player.id)}
                          disabled={sendingInvite === player.id}
                          className="w-full bg-yellow-600 hover:bg-yellow-700"
                        >
                          {sendingInvite === player.id ? 'Sending...' : 'Invite to Team'}
                        </Button>
                      )
                    ) : player.opgg_url ? (
                      <Button asChild className="w-full bg-primary hover:bg-primary/90">
                        <a href={player.opgg_url} target="_blank" rel="noopener noreferrer">
                          View OP.GG
                        </a>
                      </Button>
                    ) : (
                      <Button disabled className="w-full">
                        No OP.GG Linked
                      </Button>
                    )}
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground">No players found looking for teams.</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </main>
  )
}
