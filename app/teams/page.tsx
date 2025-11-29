'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { cache, CacheConfig } from '@/lib/cache'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Shield, Users, Trophy, Search } from 'lucide-react'
import { TeamAvatar } from '@/components/ui/team-avatar'

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
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [pendingRequests, setPendingRequests] = useState<Record<string, string>>({})
  const [sendingRequest, setSendingRequest] = useState<string | null>(null)
  const [cancellingRequest, setCancellingRequest] = useState<string | null>(null)
  const [hasPlayerProfile, setHasPlayerProfile] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndFetchTeams()
    
    // Refetch data when page becomes visible
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // Invalidate cache to force fresh data when page becomes visible
        await cache.invalidate('all_teams', 'teams')
        fetchTeams()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also refetch every 30 seconds to keep data fresh, but invalidate cache first
    const interval = setInterval(async () => {
      await cache.invalidate('all_teams', 'teams')
      fetchTeams()
    }, 30000)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
  }, [])

  const checkAuthAndFetchTeams = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser) {
      router.push('/auth')
      return
    }
    
    fetchTeams()
  }

  const fetchTeams = async () => {
    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      // Check if user is in a team (either as captain or member)
      if (authUser) {
        // First check if user is a player and get their team
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('team_id')
          .eq('id', authUser.id)
          .single()
        
        
        if (playerError) {
          setHasPlayerProfile(false)
          setProfileChecked(true)
        } else {
          setHasPlayerProfile(true)
          setProfileChecked(true)
          
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
            .select('id, team_id')
            .eq('player_id', authUser.id)
            .eq('status', 'pending')
          
          const pendingMap: Record<string, string> = {}
          requests?.forEach(r => {
            pendingMap[r.team_id] = r.id
          })
          setPendingRequests(pendingMap)
        }
      } else {
        // No authenticated user
        setProfileChecked(true)
      }

      // Use cache for teams data
      const cacheKey = 'all_teams'
      const cacheOptions = {
        ttl: 3 * 60 * 1000, // 3 minutes cache for team data
        namespace: 'teams'
      }

      // Try to get from cache first
      const cachedTeams = await cache.get<any[]>(cacheKey, cacheOptions)
      if (cachedTeams) {
        setTeams(cachedTeams)
        setLoading(false) // Hide loading immediately when cache is available
      } else {
      }

      // Always fetch fresh data in background
      const { data, error } = await supabase
        .from('teams')
        .select('*, captain:players!captain_id(summoner_name)')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching teams:', error)
        return
      }

      // Fetch member details for each team
      const teamsWithMembers = await Promise.all(
        (data || []).map(async (team) => {
          const { data: members } = await supabase
            .from('players')
            .select('summoner_name, main_role, tier')
            .eq('team_id', team.id)
          
          // Calculate average rank
          const rankOrder = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger']
          const memberRanks = members?.map(m => {
            const tierBase = m.tier?.split(' ')[0]
            return rankOrder.indexOf(tierBase)
          }).filter(r => r >= 0) || []
          
          const avgRankIndex = memberRanks.length > 0 
            ? Math.round(memberRanks.reduce((a, b) => a + b, 0) / memberRanks.length)
            : -1
          const averageRank = avgRankIndex >= 0 ? rankOrder[avgRankIndex] : null
          
          return {
            ...team,
            current_members: members?.length || 0,
            members: members || [],
            average_rank: averageRank
          }
        })
      )

      setTeams(teamsWithMembers)
      
      // Update cache with fresh data
      await cache.set(cacheKey, teamsWithMembers, cacheOptions)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setInitialLoad(false) // Mark initial load as complete
    }
  }

  const sortedTeams = [...teams].sort((a, b) => {
    // Put user's team first
    if (userTeam && a.id === userTeam.id) return -1
    if (userTeam && b.id === userTeam.id) return 1
    return 0
  })

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
        const data = await response.json()
        // Add to pending requests to update UI
        setPendingRequests(prev => ({ ...prev, [teamId]: data.id }))
        
        // Invalidate teams cache to refresh data
        await cache.invalidate('all_teams', 'teams')
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

  const handleCancelRequest = async (teamId: string) => {
    const requestId = pendingRequests[teamId]
    if (!requestId || cancellingRequest) return

    try {
      setCancellingRequest(teamId)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(`/api/team-join-requests/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        // Remove from pending requests
        setPendingRequests(prev => {
          const updated = { ...prev }
          delete updated[teamId]
          return updated
        })
        
        // Invalidate teams cache to refresh data
        await cache.invalidate('all_teams', 'teams')
      } else {
        const error = await response.json()
        console.error('Error cancelling request:', error.error)
      }
    } catch (error) {
      console.error('Error cancelling request:', error)
    } finally {
      setCancellingRequest(null)
    }
  }

  const filteredTeams = sortedTeams.filter(team => {
    const matchesRole = !selectedRole || team.open_positions.includes(selectedRole)
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesRole && matchesSearch
  })

  return (
    <main className="min-h-screen pt-24 pb-12 bg-gradient-to-b from-background to-secondary/20">
      <div className="max-w-6xl mx-auto px-4">
        {/* Profile Setup Banner */}
        {user && !hasPlayerProfile && profileChecked && (
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
                <a href="/setup-profile">Set Up Profile</a>
              </Button>
            </div>
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Teams</h1>
              <p className="text-muted-foreground">Find your perfect team and climb the ranks together</p>
            </div>
          </div>
          {userTeam ? (
            userTeam.captain_id === user?.id ? (
              <Button asChild className="bg-yellow-600 hover:bg-yellow-700">
                <a href="/manage-team">Manage Team</a>
              </Button>
            ) : (
              <Button asChild className="bg-primary hover:bg-primary/90">
                <a href={`/teams/${userTeam.id}`}>View Team</a>
              </Button>
            )
          ) : (
            <Button asChild className="bg-primary hover:bg-primary/90">
              <a href="/create-team">Create Team</a>
            </Button>
          )}
        </div>

        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teams by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input border-border"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
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

        {initialLoad ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Skeleton loaders */}
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-card border-border p-6">
                <div className="flex items-start gap-4 mb-4">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.length > 0 ? (
              filteredTeams.map((team) => (
                <Card key={team.id} className="bg-card border-border p-6 hover:border-primary transition cursor-pointer" onClick={() => router.push(`/teams/${team.id}`)}>
                  <div className="flex items-start gap-4 mb-4">
                    {/* Team Avatar */}
                    <div className="relative">
                      <TeamAvatar 
                        team={team} 
                        size="lg"
                        showTooltip={true}
                      />
                      {/* Team Size Badge */}
                      <div className="absolute -bottom-1 -right-1 bg-background border border-border rounded-full w-6 h-6 flex items-center justify-center">
                        <span className="text-xs font-bold">{team.current_members}</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold mb-1 truncate" title={team.name}>
                        {team.name}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Captain: {team.captain?.summoner_name || 'Unknown'}
                        </span>
                      </div>
                      
                      {/* Team Size and Status */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-muted-foreground">Size:</span>
                        <span className="text-sm font-semibold">
                          {team.current_members}/{team.team_size}
                        </span>
                        <Badge className={team.recruiting_status === 'Open' ? 'bg-green-500' : 'bg-gray-500'}>
                          {team.recruiting_status === 'Open' ? 'Recruiting' : team.recruiting_status}
                        </Badge>
                      </div>
                      
                      {/* Average Rank */}
                      {team.average_rank && (
                        <div className="flex items-center gap-2">
                          <div className="group relative">
                            <div className="flex items-center gap-1 cursor-help">
                              <span className="text-sm font-medium text-muted-foreground">Avg Rank:</span>
                              <span className="text-xs text-muted-foreground">ⓘ</span>
                            </div>
                            {/* Desktop tooltip */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="absolute inset-0 cursor-pointer" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs max-w-xs">Based on ranked players only. Unranked players are excluded from this calculation.</p>
                              </TooltipContent>
                            </Tooltip>
                            {/* Mobile text display */}
                            <div className="absolute bottom-full left-0 mb-2 hidden group-active:block bg-popover text-popover-foreground text-xs rounded-md px-3 py-1.5 shadow-md border z-50 w-48">
                              Based on ranked players only. Unranked players are excluded from this calculation.
                            </div>
                          </div>
                          <span className="text-sm font-semibold">{team.average_rank}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Team Description */}
                  {team.description && (
                    <p className="text-muted-foreground mb-4 text-sm line-clamp-2">
                      {team.description}
                    </p>
                  )}
                  
                  {/* Team Members Display */}
                  {team.members && team.members.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-2">Team Roster ({team.members.length}):</p>
                      <div className="space-y-1">
                        {team.members.slice(0, 3).map((member: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1">
                            <span className="font-medium truncate">
                              {member.summoner_name?.split('#')[0] || 'Unknown'}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-muted-foreground">{member.main_role}</span>
                              <span className="font-semibold text-xs">{member.tier?.split(' ')[0]}</span>
                            </div>
                          </div>
                        ))}
                        {team.members.length > 3 && (
                          <p className="text-xs text-muted-foreground text-center pt-1">
                            +{team.members.length - 3} more members
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Open Positions */}
                  {team.open_positions.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-2">Looking for:</p>
                      <div className="flex flex-wrap gap-1">
                        {team.open_positions.map((role: string) => (
                          <span key={role} className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div>
                      {user && team.captain_id === user.id ? (
                        <Button asChild className="w-full bg-yellow-600 hover:bg-yellow-700" onClick={(e) => e.stopPropagation()}>
                          <a href="/manage-team">Manage Team</a>
                        </Button>
                      ) : user && userTeam?.id === team.id ? (
                        <Button asChild className="w-full bg-green-600 hover:bg-green-700" onClick={(e) => e.stopPropagation()}>
                          <a href="/view-team">View Team</a>
                        </Button>
                      ) : user && userTeam ? (
                        <Button disabled className="w-full" onClick={(e) => e.stopPropagation()}>
                          Already in a team
                        </Button>
                      ) : user && !hasPlayerProfile && profileChecked ? (
                        null
                      ) : team.current_members >= parseInt(team.team_size) ? (
                        <Button disabled className="w-full" onClick={(e) => e.stopPropagation()}>
                          Team is Full
                        </Button>
                      ) : user && pendingRequests[team.id] ? (
                        <Button 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancelRequest(team.id)
                          }}
                          disabled={cancellingRequest === team.id}
                          className="w-full bg-orange-600 hover:bg-orange-700"
                        >
                          {cancellingRequest === team.id ? 'Cancelling...' : 'Cancel Request'}
                        </Button>
                      ) : (
                        <Button 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRequestToJoin(team.id, team.name)
                          }}
                          disabled={sendingRequest === team.id}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                          {sendingRequest === team.id ? 'Sending...' : 'Request to Join'}
                        </Button>
                      )}
                  </div>
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
