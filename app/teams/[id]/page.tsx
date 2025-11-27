'use client'

import { useState, useEffect, use } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { getRankImage } from '@/lib/rank-utils'
import { getProfileIconUrl } from '@/lib/ddragon'
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
  const [profileIconUrls, setProfileIconUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [pendingRequest, setPendingRequest] = useState<string | null>(null)
  const [sendingRequest, setSendingRequest] = useState(false)
  const [hasPlayerProfile, setHasPlayerProfile] = useState(false)
  const supabase = createClient()

  const handleRequestToJoin = async () => {
    if (!currentUserId || sendingRequest) return

    try {
      setSendingRequest(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch('/api/team-join-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          team_id: id,
          message: `I'd like to join ${team.name}!`
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setPendingRequest(data.id)
      } else {
        const error = await response.json()
        console.error('Error sending join request:', error.error)
      }
    } catch (error) {
      console.error('Error sending join request:', error)
    } finally {
      setSendingRequest(false)
    }
  }

  const fetchProfileIconUrls = async (members: any[]) => {
    const urls: Record<string, string> = {};
    
    for (const member of members) {
      if (member.profile_icon_id) {
        try {
          const url = await getProfileIconUrl(member.profile_icon_id);
          urls[member.id] = url;
        } catch (error) {
          console.error(`Failed to fetch profile icon for ${member.summoner_name}:`, error);
        }
      }
    }
    
    setProfileIconUrls(urls);
  }

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUserId(user?.id || null)

        // Check if user has a team
        if (user) {
          const { data: playerData, error: playerError } = await supabase
            .from('players')
            .select('team_id')
            .eq('id', user.id)
            .single()
          
          console.log('Player data:', playerData)
          console.log('Player error:', playerError)
          
          if (playerError) {
            console.log('User does not have a player profile')
            setHasPlayerProfile(false)
          } else {
            console.log('User has a player profile')
            setHasPlayerProfile(true)
            
            if (playerData?.team_id) {
              const { data: teamData } = await supabase
                .from('teams')
                .select('*')
                .eq('id', playerData.team_id)
                .single()
              
              console.log('User team data:', teamData)
              setUserTeam(teamData)
            }

            // Check if user has a pending request to this team
            const { data: requestData } = await supabase
              .from('team_join_requests')
              .select('id')
              .eq('player_id', user.id)
              .eq('team_id', id)
              .eq('status', 'pending')
              .single()
            
            if (requestData) {
              setPendingRequest(requestData.id)
            }
          }
        }

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
          // Fetch profile icon URLs for members
          await fetchProfileIconUrls(membersData)
          
          // Additional check: if current user is in this team's members, ensure userTeam is set
          if (currentUserId && membersData.some(m => m.id === currentUserId)) {
            console.log('User is a member of this team, setting userTeam')
            setUserTeam(teamData)
          }
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

        {/* Profile Setup Banner */}
        {currentUserId && !hasPlayerProfile && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">Complete Your Player Profile</h3>
                  <p className="text-sm text-blue-700">Create your profile to join teams and participate in tournaments</p>
                </div>
              </div>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link href="/setup-profile">Set Up Profile</Link>
              </Button>
            </div>
          </div>
        )}

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
                        {/* Profile Icon with Rank Badge */}
                        <div className="relative flex-shrink-0">
                          <div className="relative">
                            {member.profile_icon_id ? (
                              <Image 
                                src={profileIconUrls[member.id] || ''}
                                alt="Profile Icon"
                                width={48}
                                height={48}
                                className="rounded-full border-2 border-border"
                                onError={(e) => {
                                  // Fallback to question mark if image fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const fallback = parent.querySelector('.fallback-icon');
                                    if (fallback) {
                                      (fallback as HTMLElement).style.display = 'flex';
                                    }
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                                <span className="text-lg">?</span>
                              </div>
                            )}
                            {/* Fallback icon */}
                            <div className="fallback-icon w-12 h-12 bg-muted rounded-full flex items-center justify-center" style={{ display: 'none' }}>
                              <span className="text-lg">?</span>
                            </div>
                            {/* Rank Badge */}
                            <div className="absolute -bottom-1 -right-1">
                              <Image 
                                src={getRankImage(member.tier)} 
                                alt={member.tier}
                                width={20}
                                height={20}
                                className="object-contain"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-foreground truncate">
                              {member.summoner_name?.split('#')[0] || member.riot_games_name || 'Unknown'}
                              {member.summoner_name?.split('#')[1] && (
                                <span className="text-muted-foreground font-normal ml-1">#{member.summoner_name.split('#')[1]}</span>
                              )}
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
                          
                          {/* Enhanced Rank Display */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-muted-foreground">Rank:</span>
                            <span className="text-sm font-semibold">
                              {member.tier}
                              {member.rank && member.rank !== null && (
                                <span className="ml-1">{member.rank}</span>
                              )}
                            </span>
                            {member.league_points !== undefined && member.league_points > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ({member.league_points} LP)
                              </span>
                            )}
                          </div>
                          
                          {/* Win/Loss Stats */}
                          {(member.wins !== undefined || member.losses !== undefined) && (
                            <div className="flex items-center gap-3 mb-2 p-2 bg-muted/50 rounded text-xs">
                              {member.wins !== undefined && (
                                <div className="text-center">
                                  <span className="text-green-600 font-bold">{member.wins}</span>
                                  <span className="text-muted-foreground ml-1">W</span>
                                </div>
                              )}
                              {(member.wins !== undefined && member.losses !== undefined) && (
                                <span className="text-muted-foreground">/</span>
                              )}
                              {member.losses !== undefined && (
                                <div className="text-center">
                                  <span className="text-red-600 font-bold">{member.losses}</span>
                                  <span className="text-muted-foreground ml-1">L</span>
                                </div>
                              )}
                              {member.wins !== undefined && member.losses !== undefined && member.wins + member.losses > 0 && (
                                <div className="text-center">
                                  <span className="text-blue-600 font-bold">
                                    {Math.round((member.wins / (member.wins + member.losses)) * 100)}%
                                  </span>
                                  <span className="text-muted-foreground ml-1">WR</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Summoner Level */}
                          {member.summoner_level && (
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-muted-foreground">Level:</span>
                              <span className="text-sm font-semibold">{member.summoner_level}</span>
                            </div>
                          )}
                          
                          {member.looking_for_team && (
                            <Badge variant="outline" className="text-xs">
                              LFT
                            </Badge>
                          )}
                          
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
                  <div className="mt-4 p-4 border-2 border-dashed border-border rounded-lg text-center">
                    {(() => {
                      console.log('UI Check - currentUserId:', currentUserId)
                      console.log('UI Check - userTeam:', userTeam)
                      console.log('UI Check - isCaptain:', isCaptain)
                      console.log('UI Check - recruiting_status:', team.recruiting_status)
                      console.log('UI Check - pendingRequest:', pendingRequest)
                      console.log('UI Check - hasPlayerProfile:', hasPlayerProfile)
                      
                      const canRequestToJoin = currentUserId && hasPlayerProfile && !userTeam && !isCaptain && team.recruiting_status === 'Open'
                      console.log('UI Check - canRequestToJoin:', canRequestToJoin)
                      
                      return canRequestToJoin ? (
                        // User has no team and can request to join
                        <div className="space-y-3">
                          <UserPlus className="h-8 w-8 mx-auto mb-2 text-primary" />
                          <p className="text-sm font-medium text-foreground">
                            {teamSize - members.length} slots available
                          </p>
                          {pendingRequest ? (
                            <div className="space-y-2">
                              <Button disabled className="w-full bg-orange-600">
                                Request Sent
                              </Button>
                              <p className="text-xs text-muted-foreground">
                                Waiting for captain to review your request
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Button 
                                onClick={handleRequestToJoin}
                                disabled={sendingRequest || members.length >= teamSize}
                                className="w-full bg-primary hover:bg-primary/90"
                              >
                                {sendingRequest ? 'Sending...' : 'Request to Join This Team'}
                              </Button>
                              <p className="text-xs text-muted-foreground">
                                Click to request joining this team
                              </p>
                            </div>
                          )}
                        </div>
                      ) : currentUserId && userTeam ? (
                        // User already has a team
                        <div className="space-y-3">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm font-medium text-muted-foreground">
                            {teamSize - members.length} slots available
                          </p>
                          <p className="text-xs text-muted-foreground">
                            You're already in a team
                          </p>
                        </div>
                      ) : isCaptain ? (
                        // User is the captain
                        <div className="space-y-3">
                          <Crown className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                          <p className="text-sm font-medium text-foreground">
                            {teamSize - members.length} slots available
                          </p>
                          <p className="text-xs text-muted-foreground">
                            You're the captain of this team
                          </p>
                        </div>
                      ) : team.recruiting_status !== 'Open' ? (
                        // Team is not recruiting
                        <div className="space-y-3">
                          <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm font-medium text-muted-foreground">
                            {teamSize - members.length} slots available
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Team is not currently recruiting
                          </p>
                        </div>
                      ) : (
                        // Default slots available (user not logged in or no profile)
                        <div className="space-y-3">
                          <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm font-medium text-muted-foreground">
                            {teamSize - members.length} slots available
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {currentUserId ? 'Complete your profile to join teams' : 'Sign in to request joining this team'}
                          </p>
                        </div>
                      )
                    })()}
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
