'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Shield, Users, Trophy, Search, Crown } from 'lucide-react'
import { TeamAvatar } from '@/components/ui/team-avatar'
import Image from 'next/image'
import { getRankImage } from '@/lib/rank-utils'
import RoleIcon from '@/components/RoleIcon'
import { getCached, setCache } from '@/lib/cache'
// DDragon version is stable - hardcode to avoid network fetch blocking render
const DDRAGON_VERSION = '15.23.1'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']

interface Team {
  id: string
  name: string
  description?: string
  captain_id: string
  open_positions: string[]
  team_size: string
  recruiting_status: string
  team_avatar?: number
  created_at: string
  captain?: {
    summoner_name: string
  }
  is_bot?: boolean
}

export default function TeamsPage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [user, setUser] = useState<any>(null)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [pendingRequests, setPendingRequests] = useState<Record<string, string>>({})
  const [sendingRequest, setSendingRequest] = useState<string | null>(null)
  const [cancellingRequest, setCancellingRequest] = useState<string | null>(null)
  const [hasPlayerProfile, setHasPlayerProfile] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Check cache first — if we have stale data, show it immediately (no skeleton)
    const { data: cached, isFresh } = getCached<any[]>('teams_page_1')
    if (cached) {
      setTeams(cached)
      setInitialLoad(false)
    }
    // Always fetch fresh data (even if we showed cache)
    if (!isFresh) fetchTeams(1)

    const handleVisibilityChange = () => {
      if (!document.hidden) refreshJoinRequests()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Silently refresh join request status without clearing teams
  const refreshJoinRequests = async () => {
    try {
      // getSession() is local (3ms) - fine for non-security-critical UI refreshes
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: requests } = await supabase
        .from('team_join_requests')
        .select('id, team_id')
        .eq('player_id', session.user.id)
        .eq('status', 'pending')

      const pendingMap: Record<string, string> = {}
      requests?.forEach(r => {
        pendingMap[r.team_id] = r.id
      })
      setPendingRequests(pendingMap)
    } catch (error) { }
  }

  const fetchTeams = async (page: number = 1, reset: boolean = false) => {
    try {
      if (page > 1) {
        setLoadingMore(true)
      }

      // Build query parameters for paginated API
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })

      if (selectedRole) {
        params.append('role', selectedRole)
      }

      // Fire all three in parallel: teams list, user auth verification, and player profile
      const apiPromise = fetch(`/api/teams?${params}`);
      const userPromise = supabase.auth.getUser();
      const playerProfilePromise = supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return { data: null, error: null };
        return supabase.from('players').select('team_id').eq('id', session.user.id).single();
      });

      const [response, { data: { user: authUser } }, { data: playerData, error: playerError }] = await Promise.all([
        apiPromise,
        userPromise,
        playerProfilePromise,
      ]);

      setUser(authUser)

      // Process player profile results (already fetched in parallel above)
      if (authUser) {
        if (playerError || !playerData) {
          setHasPlayerProfile(false)
          setProfileChecked(true)
        } else {
          setHasPlayerProfile(true)
          setProfileChecked(true)

          // Fetch team data and join requests in parallel (if player is in a team)
          const teamPromise = playerData?.team_id
            ? supabase.from('teams').select('id, captain_id').eq('id', playerData.team_id).single()
            : Promise.resolve({ data: null });
          const requestsPromise = supabase.from('team_join_requests').select('id, team_id').eq('player_id', authUser.id).eq('status', 'pending');

          const [{ data: teamData }, { data: requests }] = await Promise.all([teamPromise, requestsPromise]);

          if (teamData) setUserTeam(teamData);

          const pendingMap: Record<string, string> = {}
          requests?.forEach(r => { pendingMap[r.team_id] = r.id })
          setPendingRequests(pendingMap)
        }
      } else {
        setProfileChecked(true)
      }

      const result = await response.json()

      if (!response.ok) {
        return
      }

      const newTeams = result.data || []
      const pagination = result.pagination || {}

      // SINGLE query to fetch ALL members for ALL teams at once (eliminates N+1)
      const teamIds = newTeams.map((t: any) => t.id)
      const { data: allMembers } = teamIds.length > 0
        ? await supabase
          .from('players')
          .select('id, summoner_name, main_role, tier, profile_icon_id, is_bot, team_id')
          .in('team_id', teamIds)
          .or('is_bot.is.null,is_bot.eq.false')
        : { data: [] }

      // Group members by team_id (pure JS, zero network cost)
      const membersByTeam: Record<string, any[]> = {}
      allMembers?.forEach(m => {
        if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = []
        membersByTeam[m.team_id].push({
          ...m,
          profileIconUrl: m.profile_icon_id
            ? `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${m.profile_icon_id}.png`
            : null
        })
      })

      const rankOrder = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger']

      const teamsWithMembers = newTeams.map((team: any) => {
        const members = membersByTeam[team.id] || []
        const memberRanks = members.map((m: any) => {
          const tierBase = m.tier?.split(' ')[0]
          return rankOrder.indexOf(tierBase)
        }).filter((r: number) => r >= 0)

        const avgRankIndex = memberRanks.length > 0
          ? Math.round(memberRanks.reduce((a: number, b: number) => a + b, 0) / memberRanks.length)
          : -1

        return {
          ...team,
          current_members: members.length,
          members,
          average_rank: avgRankIndex >= 0 ? rankOrder[avgRankIndex] : null
        }
      })

      // Update state
      if (reset || page === 1) {
        setTeams(teamsWithMembers)
        setCache('teams_page_1', teamsWithMembers)
      } else {
        setTeams(prev => [...prev, ...teamsWithMembers])
      }

      setHasMore(pagination.hasMore || false)
      setCurrentPage(page)
    } catch (error) {

    } finally {
      setInitialLoad(false)
      setLoadingMore(false)
    }
  }

  // Infinite scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore || !hasMore) return

      const scrollHeight = document.documentElement.scrollHeight
      const scrollTop = document.documentElement.scrollTop
      const clientHeight = document.documentElement.clientHeight

      // Load more when user is within 500px of bottom
      if (scrollTop + clientHeight >= scrollHeight - 500) {
        loadMoreTeams()
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loadingMore, hasMore, currentPage, selectedRole])

  const loadMoreTeams = () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    fetchTeams(currentPage + 1, false)
  }

  // Reset pagination when filters change (skip initial mount)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    setCurrentPage(1)
    setTeams([])
    setHasMore(true)
    fetchTeams(1, true)
  }, [selectedRole])

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

      } else {
        const error = await response.json()

      }
    } catch (error) {

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
      } else {
        const error = await response.json()

      }
    } catch (error) {

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
                <Card
                  key={team.id}
                  className="relative h-full bg-zinc-900 border-zinc-800/50 overflow-hidden hover:border-primary/50 transition-all duration-500 group cursor-pointer shadow-2xl flex flex-col"
                  onClick={() => router.push(`/teams/${team.id}`)}
                >
                  {/* Card Background Accent */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl transition-colors group-hover:bg-primary/10" />

                  <div className="p-6 relative z-10 flex flex-col h-full">
                    {/* Header Info */}
                    <div className="flex items-start gap-4 mb-6">
                      <div className="relative">
                        <TeamAvatar
                          team={team}
                          size="lg"
                          showTooltip={false}
                        />
                        {/* Status Badge Over Avatar */}
                        <div className="absolute -bottom-1 -right-1">
                          <Badge className={cn(
                            "h-5 w-5 rounded-full p-0 flex items-center justify-center border-2 border-zinc-900",
                            team.recruiting_status === 'Open' ? 'bg-green-500' : 'bg-zinc-500'
                          )}>
                            <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          </Badge>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-white mb-1 truncate" title={team.name}>
                          {team.name}
                        </h3>
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Crown className="h-3 w-3 text-yellow-500" />
                          <span className="text-xs font-medium truncate">
                            {team.captain?.summoner_name || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stats Strip */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-zinc-800/30 rounded-xl p-3 border border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="h-3 w-3 text-primary" />
                          <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">Size</span>
                        </div>
                        <div className="text-sm font-bold text-zinc-200">
                          {team.current_members} <span className="text-zinc-600">/ {team.team_size}</span>
                        </div>
                      </div>

                      <div className="bg-zinc-800/30 rounded-xl p-3 border border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                          <Trophy className="h-3 w-3 text-orange-400" />
                          <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">Rank</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {team.average_rank ? (
                            <>
                              <Image
                                src={getRankImage(team.average_rank)}
                                alt={team.average_rank}
                                width={14}
                                height={14}
                                className="object-contain"
                              />
                              <span className="text-sm font-bold text-zinc-200">
                                {team.average_rank?.split(' ')[0]}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm font-bold text-zinc-600">N/A</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Open Roles */}
                    <div className="mt-auto">
                      <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                        {team.open_positions?.slice(0, 5).map((role: string) => (
                          <div key={role} className="p-1 rounded bg-zinc-800 border border-white/5">
                            <RoleIcon role={role} size={14} />
                          </div>
                        ))}
                        {team.open_positions?.length > 5 && (
                          <span className="text-[10px] font-bold text-zinc-500 flex items-center px-1">
                            +{team.open_positions.length - 5}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Button (Non-hover state) */}
                    <div className="mt-6">
                      {user && team.captain_id === user.id ? (
                        <Button className="w-full bg-yellow-600/10 border border-yellow-600/20 text-yellow-500 hover:bg-yellow-600 hover:text-white transition-all rounded-xl h-11" onClick={(e) => { e.stopPropagation(); router.push('/manage-team') }}>
                          Manage Team
                        </Button>
                      ) : user && userTeam?.id === team.id ? (
                        <Button className="w-full bg-green-600/10 border border-green-600/20 text-green-500 hover:bg-green-600 hover:text-white transition-all rounded-xl h-11" onClick={(e) => { e.stopPropagation(); router.push(`/teams/${team.id}`) }}>
                          View Team
                        </Button>
                      ) : (
                        <Button variant="secondary" className="w-full bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 rounded-xl h-11" onClick={(e) => e.stopPropagation()}>
                          View Details
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* ──── HOVER ROSTER OVERLAY ──── */}
                  <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col p-6 z-20 pointer-events-none group-hover:pointer-events-auto">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Team Roster
                      </h4>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                        {team.members?.length || 0} Members
                      </Badge>
                    </div>

                    {/* Members Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[160px] pr-1">
                      {team.members?.map((member: any) => (
                        <div key={member.id} className="relative group/member flex flex-col items-center">
                          <div className="relative mb-2">
                            <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-zinc-800 bg-zinc-900">
                              {member.profileIconUrl ? (
                                <Image
                                  src={member.profileIconUrl}
                                  alt={member.summoner_name}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500">
                                  ?
                                </div>
                              )}
                            </div>
                            {/* Role Icon Overlay */}
                            <div className="absolute -bottom-1 -right-1 bg-zinc-900 border border-zinc-800 p-1 rounded-md shadow-lg">
                              <RoleIcon role={member.main_role} size={12} />
                            </div>
                            {/* Rank Overlay */}
                            <div className="absolute -top-1 -left-1">
                              <Image
                                src={getRankImage(member.tier)}
                                alt={member.tier}
                                width={18}
                                height={18}
                                className="object-contain"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Empty slots placeholders */}
                      {[...Array(Math.max(0, parseInt(team.team_size) - (team.members?.length || 0)))].map((_, i) => (
                        <div key={`empty-${i}`} className="flex flex-col items-center opacity-30">
                          <div className="w-14 h-14 rounded-xl border-2 border-dashed border-zinc-700 flex items-center justify-center text-zinc-700">
                            <Shield className="h-6 w-6" />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-auto space-y-2">
                      <div className="w-full h-px bg-zinc-800" />
                      <div className="pt-2">
                        {user && team.captain_id === user.id ? (
                          <Button className="w-full bg-yellow-600 hover:bg-yellow-700 font-bold uppercase tracking-widest text-xs h-12" onClick={(e) => { e.stopPropagation(); router.push('/manage-team') }}>
                            Team Management
                          </Button>
                        ) : user && userTeam?.id === team.id ? (
                          <Button className="w-full bg-green-600 hover:bg-green-700 font-bold uppercase tracking-widest text-xs h-12" onClick={(e) => { e.stopPropagation(); router.push(`/teams/${team.id}`) }}>
                            Our Home
                          </Button>
                        ) : user && userTeam ? (
                          <Button disabled className="w-full h-12 bg-zinc-800 border border-zinc-700 text-zinc-500">
                            Already in a team
                          </Button>
                        ) : team.current_members >= parseInt(team.team_size) ? (
                          <Button disabled className="w-full h-12 bg-zinc-800 border border-zinc-700 text-zinc-500">
                            Roster Full
                          </Button>
                        ) : user && pendingRequests[team.id] ? (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCancelRequest(team.id)
                            }}
                            disabled={cancellingRequest === team.id}
                            className="w-full bg-orange-600 hover:bg-orange-700 font-bold uppercase tracking-widest text-xs h-12 animate-pulse"
                          >
                            {cancellingRequest === team.id ? 'Cancelling...' : 'Revoke Request'}
                          </Button>
                        ) : (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRequestToJoin(team.id, team.name)
                            }}
                            disabled={sendingRequest === team.id}
                            className="w-full bg-primary hover:bg-primary/90 font-black uppercase tracking-widest text-xs h-12 shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all"
                          >
                            {sendingRequest === team.id ? 'Processing...' : 'Request to Join'}
                          </Button>
                        )}
                      </div>
                    </div>
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

        {/* Loading more indicator */}
        {loadingMore && (
          <div className="flex justify-center items-center py-8 gap-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-muted-foreground">Loading more teams...</span>
          </div>
        )}

        {/* End of list indicator */}
        {!initialLoad && !hasMore && filteredTeams.length > 0 && !loadingMore && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">You've reached the end • {filteredTeams.length} teams shown</p>
          </div>
        )}
      </div>
    </main>
  )
}
