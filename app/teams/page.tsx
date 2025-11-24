'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

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

export default function TeamsPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [pendingRequests, setPendingRequests] = useState<string[]>([])
  const [sendingRequest, setSendingRequest] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      // Check if user is in a team (either as captain or member)
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

      const { data, error } = await supabase
        .from('teams')
        .select('*, captain:players!captain_id(summoner_name)')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching teams:', error)
        return
      }

      // Fetch member counts for each team
      const teamsWithCounts = await Promise.all(
        (data || []).map(async (team) => {
          const { count } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id)
          
          return {
            ...team,
            current_members: count || 0
          }
        })
      )

      setTeams(teamsWithCounts)
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
        // Add to pending requests to update UI
        setPendingRequests(prev => [...prev, teamId])
      } else {
        const error = await response.json()
        console.error('Error sending join request:', error.error)
      }
    } catch (error) {
      console.error('Error sending join request:', error)
    } finally {
      setSendingRequest(null)
    }
  }

  const filteredTeams = teams.filter(team => {
    const matchesRole = !selectedRole || team.open_positions.includes(selectedRole)
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesRole && matchesSearch
  })

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Teams</h1>
            <p className="text-muted-foreground">Find teams looking for your role</p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <a href="/create-team">Create Team</a>
          </Button>
        </div>

        <div className="mb-8 space-y-4">
          <Input
            placeholder="Search by team name..."
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
            {filteredTeams.length > 0 ? (
              filteredTeams.map(team => (
                <Card key={team.id} className="bg-card border-border p-6 hover:border-primary transition">
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold">{team.name}</h3>
                    {team.description && (
                      <p className="text-muted-foreground">{team.description}</p>
                    )}
                  </div>
                  
                  {/* Team Info */}
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">Members:</span>
                      <span className="font-medium">{team.current_members}/{team.team_size}</span>
                      {team.current_members >= parseInt(team.team_size) && (
                        <span className="text-xs text-red-500 font-semibold">FULL</span>
                      )}
                    </div>
                    {team.captain && (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">Captain:</span>
                        <span className="font-medium">{team.captain.summoner_name}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Open Positions */}
                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2">
                      {team.open_positions.length > 0 ? (
                        team.open_positions.map(role => (
                          <span key={role} className="bg-accent/20 text-accent px-2 py-1 rounded text-sm font-medium">
                            Need {role}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Team is full</span>
                      )}
                    </div>
                  </div>
                  
                  {user && team.captain_id === user.id ? (
                    <Button asChild className="w-full bg-yellow-600 hover:bg-yellow-700">
                      <a href="/manage-team">Manage Team</a>
                    </Button>
                  ) : user && userTeam?.id === team.id ? (
                    <Button asChild className="w-full bg-green-600 hover:bg-green-700">
                      <a href="/view-team">View Team</a>
                    </Button>
                  ) : user && userTeam ? (
                    <Button disabled className="w-full">
                      Already in a team
                    </Button>
                  ) : team.current_members >= parseInt(team.team_size) ? (
                    <Button disabled className="w-full">
                      Team is Full
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
            )}
          </div>
        )}
      </div>
    </main>
  )
}
