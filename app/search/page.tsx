'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { cache, CacheConfig } from '@/lib/cache'
import { getRankImage } from '@/lib/rank-utils'
import { Skeleton } from '@/components/ui/skeleton'
import RoleIcon from '@/components/RoleIcon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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
  const router = useRouter()
  const [searchType, setSearchType] = useState<'players' | 'teams'>('teams')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [teams, setTeams] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [pendingRequests, setPendingRequests] = useState<Record<string, string>>({})
  const [sendingRequest, setSendingRequest] = useState<string | null>(null)
  const [cancellingRequest, setCancellingRequest] = useState<string | null>(null)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [sentInvites, setSentInvites] = useState<Record<string, string>>({})
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndFetchData()
    
    // Refetch data when page becomes visible
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // Invalidate cache to force fresh data when page becomes visible
        await cache.invalidate('search_teams', 'search')
        await cache.invalidate('search_players', 'search')
        fetchData()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also refetch every 30 seconds to keep data fresh
    const interval = setInterval(async () => {
      await cache.invalidate('search_teams', 'search')
      await cache.invalidate('search_players', 'search')
      fetchData()
    }, 30000)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
  }, [])

  const checkAuthAndFetchData = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser) {
      router.push('/auth')
      return
    }
    
    fetchData()
  }

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
          .select('id, team_id')
          .eq('player_id', authUser.id)
          .eq('status', 'pending')
        
        const pendingMap: Record<string, string> = {}
        requests?.forEach(r => {
          pendingMap[r.team_id] = r.id
        })
        setPendingRequests(pendingMap)

        // Fetch pending invitations sent by this team
        if (playerData?.team_id) {
          const { data: teamData } = await supabase
            .from('teams')
            .select('*')
            .eq('id', playerData.team_id)
            .single()
          
          if (teamData && teamData.captain_id === authUser.id) {
            const { data: invitations } = await supabase
              .from('team_invitations')
              .select('id, invited_player_id')
              .eq('team_id', teamData.id)
              .eq('status', 'pending')
            
            const inviteMap: Record<string, string> = {}
            invitations?.forEach(inv => {
              inviteMap[inv.invited_player_id] = inv.id
            })
            setSentInvites(inviteMap)
          }
        }
      }

      // Use cache for search data
      const teamsCacheKey = 'search_teams'
      const playersCacheKey = 'search_players'
      const cacheOptions = {
        ttl: 3 * 60 * 1000, // 3 minutes cache for search data
        namespace: 'search'
      }

      // Try to get from cache first
      const [cachedTeams, cachedPlayers] = await Promise.all([
        cache.get<any[]>(teamsCacheKey, cacheOptions),
        cache.get<any[]>(playersCacheKey, cacheOptions)
      ])

      if (cachedTeams || cachedPlayers) {
        console.log('🎯 Search Cache HIT - Loading from cache')
        if (cachedTeams) setTeams(cachedTeams)
        if (cachedPlayers) setPlayers(cachedPlayers)
        setLoading(false) // Hide loading immediately when cache is available
      } else {
        console.log('❌ Search Cache MISS - Loading from database')
      }

      // Always fetch fresh data in background
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

      // Fetch member details for each team
      const teamsWithMembers = await Promise.all(
        (teamsResult.data || []).map(async (team) => {
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
      setPlayers(playersResult.data || [])
      
      // Update cache with fresh data
      await Promise.all([
        cache.set(teamsCacheKey, teamsWithMembers, cacheOptions),
        cache.set(playersCacheKey, playersResult.data || [], cacheOptions)
      ])
      console.log('💾 Search Cache SET - Stored fresh search data in cache')
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setInitialLoad(false) // Mark initial load as complete
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
        const data = await response.json()
        // Add to pending requests to update UI
        setPendingRequests(prev => ({ ...prev, [teamId]: data.id }))
        
        // Invalidate search cache to refresh data
        await cache.invalidate('search_teams', 'search')
        await cache.invalidate('search_players', 'search')
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
        setPendingRequests(prev => {
          const updated = { ...prev }
          delete updated[teamId]
          return updated
        })
        
        // Invalidate search cache to refresh data
        await cache.invalidate('search_teams', 'search')
        await cache.invalidate('search_players', 'search')
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
        const data = await response.json()
        setSentInvites(prev => ({ ...prev, [playerId]: data.id }))
        
        // Invalidate search cache to refresh data
        await cache.invalidate('search_teams', 'search')
        await cache.invalidate('search_players', 'search')
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

  const handleCancelInvite = async (playerId: string) => {
    const inviteId = sentInvites[playerId]
    if (!inviteId || cancellingInvite) {
      return
    }

    try {
      setCancellingInvite(playerId)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      
      const response = await fetch(`/api/team-invitations/${inviteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })


      if (response.ok) {
        setSentInvites(prev => {
          const updated = { ...prev }
          delete updated[playerId]
          return updated
        })
        
        // Invalidate search cache to refresh data
        await cache.invalidate('search_teams', 'search')
        await cache.invalidate('search_players', 'search')
      } else {
        const error = await response.json()
        console.error('Error cancelling invite:', error.error)
      }
    } catch (error) {
      console.error('Error cancelling invite:', error)
    } finally {
      setCancellingInvite(null)
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

        {initialLoad ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Skeleton loaders for teams/players */}
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-card border-border p-6">
                {searchType === 'teams' ? (
                  // Team skeleton
                  <>
                    <div className="mb-4">
                      <Skeleton className="h-8 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    
                    {/* Team Info Skeleton */}
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                    
                    {/* Team Roster Skeleton */}
                    <div className="mb-4">
                      <Skeleton className="h-3 w-16 mb-2" />
                      <div className="flex flex-wrap gap-1.5">
                        {[...Array(5)].map((_, j) => (
                          <Skeleton key={j} className="h-6 w-16 rounded" />
                        ))}
                      </div>
                    </div>
                    
                    {/* Open Positions Skeleton */}
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2">
                        {[...Array(3)].map((_, j) => (
                          <Skeleton key={j} className="h-8 w-20 rounded" />
                        ))}
                      </div>
                    </div>
                    
                    {/* Action Button Skeleton */}
                    <Skeleton className="h-10 w-full rounded" />
                  </>
                ) : (
                  // Player skeleton
                  <>
                    <div className="flex items-start gap-4 mb-4">
                      <Skeleton className="w-16 h-16 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-1/3" />
                      </div>
                    </div>
                    
                    {/* Player Details Skeleton */}
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {searchType === 'teams' ? (
              teams.length > 0 ? (
                (() => {
                  const filteredTeams = teams.filter(team => {
                    const matchesRole = !selectedRole || team.open_positions.includes(selectedRole)
                    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase())
                    return matchesRole && matchesSearch
                  })
                  
                  // Sort to put user's team first
                  const sortedTeams = [...filteredTeams].sort((a, b) => {
                    // Put user's team first
                    if (userTeam && a.id === userTeam.id) return -1
                    if (userTeam && b.id === userTeam.id) return 1
                    return 0
                  })
                  
                  return sortedTeams.map(team => (
                  <div key={team.id} onClick={() => router.push(`/teams/${team.id}`)}>
                    <Card className="bg-card border-border p-6 hover:border-primary transition cursor-pointer group">
                      <h3 className="text-2xl font-bold mb-2 group-hover:text-primary transition">{team.name}</h3>
                      {team.description && (
                        <p className="text-muted-foreground mb-4">{team.description}</p>
                      )}
                      <div className="mb-4 space-y-1">
                        <p className="text-sm">
                          <span className="text-muted-foreground">Members: </span>
                          <span className="font-medium">{team.current_members}/{team.team_size}</span>
                          {team.current_members >= parseInt(team.team_size) && (
                            <span className="text-xs text-red-500 font-semibold ml-2">FULL</span>
                          )}
                        </p>
                        {team.captain && (
                          <p className="text-sm text-muted-foreground">
                            Captain: {team.captain.summoner_name}
                          </p>
                        )}
                        {team.average_rank && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Avg Rank: </span>
                            <span className="font-medium">{team.average_rank}</span>
                          </p>
                        )}
                      </div>
                      
                      {/* Team Roster */}
                      {team.members && team.members.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-muted-foreground mb-2">Roster:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {team.members.map((member: any, idx: number) => (
                              <span 
                                key={idx} 
                                className="bg-muted/50 text-xs px-2 py-1 rounded"
                              >
                                {member.tier?.split(' ')[0]} {member.main_role}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Open Positions */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {team.open_positions.length > 0 ? (
                          team.open_positions.map((role: string) => (
                            <span key={role} className="bg-accent/20 text-accent px-2 py-1 rounded text-sm font-medium">
                              Need {role}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Not recruiting</span>
                        )}
                      </div>
                      
                      <div onClick={(e) => e.stopPropagation()}>
                        {user && userTeam?.id === team.id ? (
                        <Button asChild className="w-full bg-green-600 hover:bg-green-700" onClick={(e) => e.stopPropagation()}>
                          <a href="/view-team">View Team</a>
                        </Button>
                      ) : user && userTeam ? (
                        <Button disabled className="w-full" onClick={(e) => e.stopPropagation()}>
                          Already in a team
                        </Button>
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
                  </div>
                ))
                })()
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground">No teams found looking for players.</p>
                </div>
              )
            ) : (
              players.length > 0 ? (
                players.filter(player => {
                  // TODO: REMOVE THIS FILTER WHEN GOING PUBLIC
                  // This filter hides test profiles that were added via SQL for testing purposes
                  // Test profiles have "test" in their summoner names
                  // Once we launch publicly, delete test profiles from DB and remove this entire filter block
                  const isTestProfile = player.summoner_name.toLowerCase().includes('test');
                  
                  const matchesSearch = player.summoner_name.toLowerCase().includes(searchQuery.toLowerCase())
                  const matchesRole = !selectedRole || player.main_role === selectedRole || player.secondary_role === selectedRole
                  
                  // Filter out players who are already in any team
                  const isNotInTeam = !player.team_id
                  
                  // Filter out the current user
                  const isNotCurrentUser = player.id !== user?.id
                  
                  // END OF TEMPORARY TEST PROFILE FILTER - REMOVE ABOVE LOGIC WHEN GOING PUBLIC
                  const isRealProfile = !isTestProfile;
                  
                  return matchesSearch && matchesRole && isRealProfile && isNotInTeam && isNotCurrentUser
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
                          <TooltipProvider>
                            <div className="flex items-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <RoleIcon role={player.main_role} size={16} />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{player.main_role}</p>
                                </TooltipContent>
                              </Tooltip>
                              {player.secondary_role && (
                                <>
                                  <span className="text-muted-foreground">/</span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <RoleIcon role={player.secondary_role} size={16} />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{player.secondary_role}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </>
                              )}
                            </div>
                          </TooltipProvider>
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
                      sentInvites[player.id] ? (
                        <Button 
                          onClick={() => handleCancelInvite(player.id)}
                          disabled={cancellingInvite === player.id}
                          className="w-full bg-orange-600 hover:bg-orange-700"
                        >
                          {cancellingInvite === player.id ? 'Cancelling...' : 'Cancel Invite'}
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
                    ) : player.opgg_url && player.opgg_url.trim() !== '' ? (
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
