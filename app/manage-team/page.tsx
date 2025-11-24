'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Shield, Trophy, Users, Zap, Settings, UserPlus, UserMinus, Crown, Trash2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getRankImage } from '@/lib/rank-utils'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']

export default function ManageTeamPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [joinRequests, setJoinRequests] = useState<any[]>([])
  const [tournaments, setTournaments] = useState<any[]>([])
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    open_positions: [] as string[],
    recruiting_status: 'Open' as 'Open' | 'Closed' | 'Full'
  })

  useEffect(() => {
    loadTeamData()
  }, [])

  const loadTeamData = async () => {
    try {
      const supabase = createClient()
      
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/auth')
        return
      }
      
      setUser(authUser)

      // Get team where user is captain using the view
      const { data: teamData, error: teamError } = await supabase
        .from('team_with_players')
        .select('*')
        .eq('captain_id', authUser.id)
        .single()

      if (teamError || !teamData) {
        console.log('Team error:', teamError)
        router.push('/create-team')
        return
      }

      console.log('Team data with players:', teamData)

      setTeam(teamData)
      setFormData({
        name: teamData.name,
        description: teamData.description || '',
        open_positions: teamData.open_positions || [],
        recruiting_status: teamData.recruiting_status
      })

      // Get team members from the view's players array or query directly
      if (teamData.players && Array.isArray(teamData.players)) {
        console.log('Players from view:', teamData.players)
        setTeamMembers(teamData.players)
      } else {
        // Fallback: query players directly
        console.log('Querying players directly for team:', teamData.id)
        const { data: membersData, error: membersError } = await supabase
          .from('players')
          .select('*')
          .eq('team_id', teamData.id)

        console.log('Direct query result:', { membersData, membersError })
        setTeamMembers(membersData || [])
      }

      // Fetch pending join requests
      const { data: requestsData } = await supabase
        .from('team_join_requests')
        .select(`
          *,
          player:players(summoner_name, main_role, tier, discord)
        `)
        .eq('team_id', teamData.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false})

      setJoinRequests(requestsData || [])

      // Fetch tournament registrations
      const { data: tournamentsData } = await supabase
        .from('tournament_registrations')
        .select(`
          *,
          tournament:tournaments(*)
        `)
        .eq('team_id', teamData.id)
        .order('registered_at', { ascending: false })

      setTournaments(tournamentsData || [])
    } catch (error) {
      console.error('Error loading team data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTeam = async () => {
    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from('teams')
        .update({
          name: formData.name,
          description: formData.description,
          open_positions: formData.open_positions,
          recruiting_status: formData.recruiting_status
        })
        .eq('id', team.id)

      if (error) {
        console.error('Error updating team:', error)
        return
      }

      setEditing(false)
      loadTeamData() // Refresh data
    } catch (error) {
      console.error('Error updating team:', error)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      const supabase = createClient()
      
      // Get the player's name before removing
      const { data: playerData } = await supabase
        .from('players')
        .select('summoner_name')
        .eq('id', memberId)
        .single()
      
      // Remove member from team
      const { error } = await supabase
        .from('players')
        .update({ team_id: null, looking_for_team: true })
        .eq('id', memberId)

      if (error) {
        console.error('Error removing member:', error)
        return
      }

      // Delete any pending invitations for this player from this team
      await supabase
        .from('team_invitations')
        .delete()
        .eq('team_id', team.id)
        .eq('invited_player_id', memberId)
        .eq('status', 'pending')

      // Delete any pending join requests from this player to this team
      await supabase
        .from('team_join_requests')
        .delete()
        .eq('team_id', team.id)
        .eq('player_id', memberId)
        .eq('status', 'pending')

      // Send notification to the removed player
      console.log('Creating removal notification for player:', memberId)
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([{
          user_id: memberId,
          type: 'team_member_removed',
          title: `Removed from ${team.name}`,
          message: `You have been removed from ${team.name} by the team captain.`,
          data: {
            team_id: team.id,
            team_name: team.name
          }
        }])

      if (notificationError) {
        console.error('Error creating removal notification:', notificationError)
      } else {
        console.log('Removal notification created successfully')
      }

      loadTeamData() // Refresh data
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  const handleJoinRequestAction = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(`/api/team-join-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action }),
      })

      if (response.ok) {
        loadTeamData() // Refresh data
      } else {
        const error = await response.json()
        // Only log if it's not the "already processed" error
        if (error.error !== 'Join request not found or already processed') {
          console.error(`Error ${action}ing join request:`, error.error)
        } else {
          // Request was already processed, just refresh
          loadTeamData()
        }
      }
    } catch (error) {
      console.error(`Error ${action}ing join request:`, error)
    }
  }

  const handleRoleToggle = (role: string) => {
    setFormData(prev => ({
      ...prev,
      open_positions: prev.open_positions.includes(role)
        ? prev.open_positions.filter(r => r !== role)
        : [...prev.open_positions, role]
    }))
  }

  const handleDeleteTeam = async () => {
    if (!confirm('Are you sure you want to delete your team? This action cannot be undone and will remove all team members.')) {
      return
    }

    try {
      const supabase = createClient()
      
      // Get all team members (excluding captain) to notify them
      const { data: members } = await supabase
        .from('players')
        .select('id, summoner_name')
        .eq('team_id', team.id)
        .neq('id', user.id)  // Exclude captain
      
      // Send notifications to all team members
      if (members && members.length > 0) {
        const notifications = members.map(member => ({
          user_id: member.id,
          type: 'team_member_removed',
          title: `${team.name} has been disbanded`,
          message: `The team captain has disbanded ${team.name}. You are now a free agent.`,
          data: {
            team_id: team.id,
            team_name: team.name
          }
        }))

        await supabase
          .from('notifications')
          .insert(notifications)
      }

      // Remove all team members (set team_id to null)
      const { error: memberError } = await supabase
        .from('players')
        .update({ team_id: null, looking_for_team: true })
        .eq('team_id', team.id)

      if (memberError) {
        console.error('Error removing team members:', memberError)
        return
      }

      // Delete the team
      const { error: teamError } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id)

      if (teamError) {
        console.error('Error deleting team:', teamError)
        return
      }

      // Redirect to home after successful deletion
      router.push('/')
    } catch (error) {
      console.error('Error deleting team:', error)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold mb-4">Loading Team Data</h2>
          </div>
        </div>
      </main>
    )
  }

  if (!team) {
    return (
      <main className="min-h-screen pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          <Card className="bg-card border-border p-8">
            <div className="text-center">
              <Crown className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-3xl font-bold mb-4">No Team Found</h2>
              <p className="text-muted-foreground mb-8">
                You don't have a team to manage. Create one first!
              </p>
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link href="/create-team">Create Team</Link>
              </Button>
            </div>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Crown className="w-8 h-8 text-yellow-500" />
              Manage Team
            </h1>
            <Button asChild variant="outline">
              <Link href="/teams">Back to Teams</Link>
            </Button>
          </div>
          <p className="text-muted-foreground">
            As team captain, you can manage your team settings and members
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Team Settings */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Team Settings
                  </CardTitle>
                  <Button
                    onClick={() => setEditing(!editing)}
                    variant={editing ? "outline" : "default"}
                  >
                    {editing ? 'Cancel' : 'Edit'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editing ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Team Name</label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter team name"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Description</label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe your team"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Looking For</label>
                      <div className="flex flex-wrap gap-2">
                        {ROLES.map(role => (
                          <Button
                            key={role}
                            type="button"
                            variant={formData.open_positions.includes(role) ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleRoleToggle(role)}
                          >
                            {role}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Recruiting Status</label>
                      <select
                        value={formData.recruiting_status}
                        onChange={(e) => setFormData(prev => ({ ...prev, recruiting_status: e.target.value as any }))}
                        className="w-full p-2 border rounded-md bg-background"
                      >
                        <option value="Open">Open</option>
                        <option value="Closed">Closed</option>
                        <option value="Full">Full</option>
                      </select>
                    </div>

                    <Button onClick={handleSaveTeam} className="w-full">
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-semibold">{team.name}</h3>
                      <p className="text-muted-foreground">{team.description || 'No description'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium mb-2">Looking For:</p>
                      <div className="flex flex-wrap gap-2">
                        {team.open_positions?.length > 0 ? (
                          team.open_positions.map((role: string) => (
                            <Badge key={role} variant="secondary">{role}</Badge>
                          ))
                        ) : (
                          <Badge variant="outline">Not recruiting</Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Status:</p>
                      <Badge 
                        variant={team.recruiting_status === 'Open' ? 'default' : 
                                team.recruiting_status === 'Closed' ? 'secondary' : 'outline'}
                      >
                        {team.recruiting_status}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Members */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Members ({teamMembers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teamMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Image 
                          src={getRankImage(member.tier)} 
                          alt={member.tier}
                          width={40}
                          height={40}
                          className="object-contain"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{member.summoner_name}</p>
                            {member.id === team.captain_id && (
                              <Badge className="bg-yellow-600">
                                <Crown className="w-3 h-3 mr-1" />
                                Captain
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {member.main_role} • {member.tier}
                          </p>
                        </div>
                      </div>  
                      <div className="flex items-center gap-2">
                        {member.id === team.captain_id && (
                          <Badge variant="default" className="flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            Captain
                          </Badge>
                        )}
                        {member.id !== team.captain_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {teamMembers.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No team members yet. Invite players to join your team!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Join Requests */}
            {joinRequests.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Join Requests ({joinRequests.length})
                  </CardTitle>
                  <CardDescription>Players requesting to join your team</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {joinRequests.map((request: any) => (
                      <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{request.player?.summoner_name || 'Unknown Player'}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{request.player?.main_role || 'No role'}</span>
                            <span>•</span>
                            <span>{request.player?.tier || 'Unranked'}</span>
                          </div>
                          {request.message && (
                            <p className="text-sm text-muted-foreground mt-1">{request.message}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleJoinRequestAction(request.id, 'accept')}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Accept
                          </Button>
                          <Button
                            onClick={() => handleJoinRequestAction(request.id, 'reject')}
                            size="sm"
                            variant="outline"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild className="w-full">
                  <Link href="/players">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Find Players
                  </Link>
                </Button>
                
                <Button asChild variant="outline" className="w-full">
                  <Link href="/search">
                    <Users className="w-4 h-4 mr-2" />
                    Browse Teams
                  </Link>
                </Button>
                
                <Button 
                  onClick={handleDeleteTeam}
                  variant="destructive" 
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Team
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Team Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team Size</span>
                  <span className="font-medium">{teamMembers.length}/5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Open Slots</span>
                  <span className="font-medium">{5 - teamMembers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">
                    {new Date(team.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Tournament Registrations */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Tournaments ({tournaments.length})
                </CardTitle>
                <CardDescription>Your team's tournament registrations</CardDescription>
              </CardHeader>
              <CardContent>
                {tournaments.length > 0 ? (
                  <div className="space-y-3">
                    {tournaments.map((reg: any) => (
                      <div key={reg.id} className="p-3 border rounded-lg">
                        <div className="font-medium">{reg.tournament?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(reg.tournament?.start_date).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Registered: {new Date(reg.registered_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground mb-3">No tournament registrations yet</p>
                    <Button asChild size="sm">
                      <Link href="/tournaments">
                        <Trophy className="w-4 h-4 mr-2" />
                        Browse Tournaments
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
