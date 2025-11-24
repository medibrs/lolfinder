'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Shield, Trophy, Users, Zap, Settings, UserPlus, UserMinus, Crown, Trash2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']

export default function ManageTeamPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
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

      // Get team where user is captain
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('captain_id', authUser.id)
        .single()

      if (teamError || !teamData) {
        router.push('/create-team')
        return
      }

      setTeam(teamData)
      setFormData({
        name: teamData.name,
        description: teamData.description || '',
        open_positions: teamData.open_positions || [],
        recruiting_status: teamData.recruiting_status
      })

      // Get team members
      const { data: membersData } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamData.id)

      setTeamMembers(membersData || [])
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
      
      // Remove member from team
      const { error } = await supabase
        .from('players')
        .update({ team_id: null, looking_for_team: true })
        .eq('id', memberId)

      if (error) {
        console.error('Error removing member:', error)
        return
      }

      loadTeamData() // Refresh data
    } catch (error) {
      console.error('Error removing member:', error)
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
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{member.summoner_name}</p>
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
          </div>
        </div>
      </div>
    </main>
  )
}
