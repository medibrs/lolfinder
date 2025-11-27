'use client'

import { useState, useEffect, use } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import RoleIcon from '@/components/RoleIcon'
import { Shield, Trophy, Users, Calendar, UserPlus, Edit, Gamepad2, Crown } from 'lucide-react'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']
const TIERS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger', 'Unranked']

const getTierColor = (tier: string) => {
  const colors: { [key: string]: string } = {
    'Iron': 'bg-gray-500',
    'Bronze': 'bg-orange-700',
    'Silver': 'bg-gray-400',
    'Gold': 'bg-yellow-500',
    'Platinum': 'bg-green-500',
    'Emerald': 'bg-emerald-500',
    'Diamond': 'bg-blue-500',
    'Master': 'bg-purple-500',
    'Grandmaster': 'bg-red-500',
    'Challenger': 'bg-cyan-400',
    'Unranked': 'bg-gray-600'
  }
  return colors[tier] || 'bg-gray-500'
}

const getTierGradient = (tier: string) => {
  const gradients: { [key: string]: string } = {
    'Iron': 'from-gray-600 to-gray-800',
    'Bronze': 'from-orange-600 to-orange-800',
    'Silver': 'from-gray-400 to-gray-600',
    'Gold': 'from-yellow-400 to-yellow-600',
    'Platinum': 'from-green-400 to-green-600',
    'Emerald': 'from-emerald-400 to-emerald-600',
    'Diamond': 'from-blue-400 to-blue-600',
    'Master': 'from-purple-400 to-purple-600',
    'Grandmaster': 'from-red-400 to-red-600',
    'Challenger': 'from-cyan-300 to-cyan-500',
    'Unranked': 'from-gray-500 to-gray-700'
  }
  return gradients[tier] || 'from-gray-500 to-gray-700'
}

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberRole, setNewMemberRole] = useState('')
  const [team, setTeam] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUserId(user?.id || null)

        // Fetch team data
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .eq('id', id)
          .single()

        if (teamError) {
          console.error('Error fetching team:', teamError)
          return
        }

        setTeam(teamData)

        // Fetch team members
        const { data: membersData, error: membersError } = await supabase
          .from('players')
          .select('*')
          .eq('team_id', id)

        if (!membersError && membersData) {
          setMembers(membersData)
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTeamData()
  }, [id, supabase])

  if (loading) {
    return (
      <main className="min-h-screen pt-24 pb-12 bg-gradient-to-b from-background to-secondary/20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-32 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-96 bg-gray-700 rounded-xl"></div>
              <div className="h-96 bg-gray-700 rounded-xl"></div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!team) {
    return (
      <main className="min-h-screen pt-24 pb-12 bg-gradient-to-b from-background to-secondary/20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Team not found</h1>
          <Button asChild>
            <Link href="/teams">Back to Teams</Link>
          </Button>
        </div>
      </main>
    )
  }

  const isCaptain = currentUserId === team.captain_id
  const captain = members.find(m => m.id === team.captain_id)
  const neededRoles = team.open_positions || []
  const teamSize = team.team_size || 5
  const averageTier = members.length > 0 
    ? members.reduce((acc, m) => {
        const tierIndex = TIERS.indexOf(m.tier || 'Unranked')
        return acc + tierIndex
      }, 0) / members.length
    : 0

  return (
    <main className="min-h-screen pt-24 pb-12 bg-gradient-to-b from-background to-secondary/20">
      <div className="max-w-7xl mx-auto px-4">
        <Button asChild variant="ghost" className="mb-6 hover:bg-transparent hover:text-primary">
          <Link href="/teams" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Back to Teams
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Team Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Team Header Card */}
            <Card className="bg-gradient-to-br from-card to-secondary/30 border-border overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-primary to-accent"></div>
              <div className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-4xl font-bold">{team.name}</h1>
                      {isCaptain && (
                        <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                          <Crown className="h-3 w-3 mr-1" />
                          Your Team
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Captain: {captain?.summoner_name || captain?.riot_games_name || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground mb-1">Team Founded</div>
                    <div className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {team.created_at ? new Date(team.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown'}
                    </div>
                  </div>
                </div>

                <p className="text-foreground mb-6 leading-relaxed text-lg">
                  {team.description || 'No description provided.'}
                </p>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">Team Size</span>
                    <Badge variant="secondary">{members.length}/{teamSize}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">Status</span>
                    <Badge className={team.recruiting_status === 'Open' ? 'bg-green-500' : 'bg-gray-500'}>
                      {team.recruiting_status === 'Open' ? 'Recruiting' : team.recruiting_status}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>

            {/* Needed Roles */}
            {neededRoles.length > 0 && (
              <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <UserPlus className="h-5 w-5 text-primary" />
                    <h3 className="text-xl font-bold">Looking For</h3>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {neededRoles.map((role: string) => (
                      <div key={role} className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-4 py-2">
                        <RoleIcon role={role} size={20} />
                        <span className="font-semibold text-primary">{role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Team Members */}
            <Card className="bg-gradient-to-br from-card to-secondary/30 border-border">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <h3 className="text-xl font-bold">Team Roster</h3>
                  </div>
                  <Badge variant="outline">{members.length}/{teamSize} Members</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {members.map(member => (
                    <div key={member.id} className="bg-gradient-to-r from-secondary/20 to-background rounded-lg p-4 border border-border hover:border-primary/50 transition-all">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 border-2 border-primary/20">
                          <AvatarImage src={member.avatar_url} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-bold">
                            {(member.summoner_name || member.riot_games_name || 'Player').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-foreground truncate">
                              {member.summoner_name || member.riot_games_name || 'Unknown'}
                            </h4>
                            {member.id === team.captain_id && (
                              <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs">
                                <Crown className="h-3 w-3 mr-1" />
                                Captain
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                            <div className="flex items-center gap-1">
                              <RoleIcon role={member.main_role} size={16} />
                              <span>{member.main_role}</span>
                            </div>
                            {member.secondary_role && (
                              <>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                  <RoleIcon role={member.secondary_role} size={16} />
                                  <span>{member.secondary_role}</span>
                                </div>
                              </>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`${getTierColor(member.tier || 'Unranked')} text-white text-xs`}>
                              {member.tier || 'Unranked'}
                            </Badge>
                            {member.looking_for_team && (
                              <Badge variant="outline" className="text-xs">
                                LFT
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            {member.discord && (
                              <div className="flex items-center gap-1">
                                <span>Discord: {member.discord}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {members.length < teamSize && (
                  <div className="mt-4 p-4 border-2 border-dashed border-border rounded-lg text-center text-muted-foreground">
                    <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{teamSize - members.length} slots available</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Team Actions */}
            {isCaptain && (
              <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Edit className="h-5 w-5 text-primary" />
                    <h3 className="font-bold">Team Actions</h3>
                  </div>
                  <div className="space-y-3">
                    <Button 
                      onClick={() => setShowAddMember(!showAddMember)} 
                      className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite Player
                    </Button>
                    <Button variant="outline" className="w-full">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Team
                    </Button>
                    <Button variant="outline" className="w-full">
                      <Trophy className="h-4 w-4 mr-2" />
                      Register for Tournament
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Invite Player Form */}
            {showAddMember && isCaptain && (
              <Card className="bg-gradient-to-br from-secondary/30 to-background border-border">
                <div className="p-6">
                  <h3 className="font-bold mb-4">Invite Player</h3>
                  <div className="space-y-3">
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground"
                    >
                      <option value="">Select Role</option>
                      {ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <Button className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Search Players
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Team Stats */}
            <Card className="bg-gradient-to-br from-secondary/30 to-background border-border">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">Team Stats</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Members</span>
                    <span className="font-semibold">{members.length}/{teamSize}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge className={team.recruiting_status === 'Open' ? 'bg-green-500' : 'bg-gray-500'}>
                      {team.recruiting_status === 'Open' ? 'Looking for Players' : team.recruiting_status}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Average Rank</span>
                    <Badge className={`${getTierColor(TIERS[Math.round(averageTier)] || 'Unranked')} text-white text-xs`}>
                      {TIERS[Math.round(averageTier)] || 'Unranked'}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Open Slots</span>
                    <span className="font-semibold text-primary">{teamSize - members.length}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
