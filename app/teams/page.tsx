'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Shield, Users, Trophy, Search, Crown, Target, User } from 'lucide-react'
import { TeamAvatar } from '@/components/ui/team-avatar'
import Image from 'next/image'
import Link from 'next/link'
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
        if (!session?.user) return { data: null, error: null } as any;
        return supabase.from('players').select('team_id').eq('id', session.user.id).single() as any;
      });

      const [response, { data: { user: authUser } }, profileResult] = await Promise.all([
        apiPromise,
        userPromise,
        playerProfilePromise,
      ]);

      setUser(authUser)

      if (authUser) {
        if (!profileResult || profileResult.error || !profileResult.data) {
          setHasPlayerProfile(false)
          setProfileChecked(true)
        } else {
          setHasPlayerProfile(true)
          setProfileChecked(true)

          const playerData = profileResult.data as any;
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
      <div className="max-w-6xl mx-auto px-4 mt-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-5xl font-bold mb-3 font-beaufort tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              Team Directory
            </h1>
            <p className="text-gray-400 uppercase tracking-[0.3em] font-beaufort text-sm">
              Find your perfect squad and dominate the Rift
            </p>
          </div>
          <div className="flex gap-4">
            {userTeam ? (
              <Button asChild className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold px-8 py-6 rounded-lg shadow-[0_0_15px_rgba(202,138,4,0.3)] transition-all font-beaufort tracking-widest uppercase">
                <Link href={userTeam.captain_id === user?.id ? "/manage-team" : `/teams/${userTeam.id}`}>
                  {userTeam.captain_id === user?.id ? "Manage Team" : "View My Team"}
                </Link>
              </Button>
            ) : (
              <Button asChild className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-8 py-6 rounded-lg shadow-[0_0_15px_rgba(8,145,178,0.3)] transition-all font-beaufort tracking-widest uppercase text-sm">
                <Link href="/create-team">Form New Squad</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Profile Setup Banner */}
        {user && !hasPlayerProfile && profileChecked && (
          <div className="mb-8 p-6 bg-slate-900/60 backdrop-blur-md border border-cyan-500/30 rounded-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none"></div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-full flex items-center justify-center border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-all">
                  <User className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-beaufort tracking-wide">Complete Your Profile</h3>
                  <p className="text-slate-400 text-sm">Unlock invitations and team recruitment tools.</p>
                </div>
              </div>
              <Button asChild className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-8 py-6 rounded-lg shadow-[0_0_15px_rgba(8,145,178,0.3)] transition-all">
                <Link href="/setup-profile">Set Up Profile Now</Link>
              </Button>
            </div>
          </div>
        )}

        <div className="mb-12 space-y-6">
          <div className="relative group">
            <Input
              placeholder="Search teams by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900/50 border-slate-800 focus:border-yellow-500/50 h-14 pl-6 text-lg rounded-xl backdrop-blur-sm transition-all text-white placeholder:text-slate-500"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-yellow-500 transition-colors">
              <Target className="w-6 h-6" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-400 uppercase tracking-widest text-xs font-bold mr-2">Filter Roles:</span>
              <TooltipProvider>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedRole(null)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border ${selectedRole === null
                          ? 'bg-yellow-500/20 border-yellow-500 shadow-[0_0_15_rgba(234,179,8,0.3)]'
                          : 'bg-slate-900/50 border-slate-800 hover:border-slate-600'
                          }`}
                      >
                        <span className={`text-xs font-bold ${selectedRole === null ? 'text-yellow-500' : 'text-slate-400'}`}>ALL</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>All Roles</TooltipContent>
                  </Tooltip>
                  {ROLES.map(role => (
                    <Tooltip key={role}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setSelectedRole(role)}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border ${selectedRole === role
                            ? 'bg-cyan-500/20 border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-600'
                            }`}
                        >
                          <RoleIcon
                            role={role}
                            size={24}
                            className={selectedRole === role ? 'brightness-0 invert-[1] sepia-[1] saturate-[10] hue-rotate-[160deg]' : 'opacity-40 grayscale group-hover:opacity-100'}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{role}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>
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
              filteredTeams.map((team) => {
                const rankColor = (tier: string) => {
                  if (!tier) return 'text-slate-300';
                  const t = tier.toLowerCase();
                  if (t.includes('iron')) return 'text-zinc-500';
                  if (t.includes('bronze')) return 'text-amber-800';
                  if (t.includes('silver')) return 'text-slate-400';
                  if (t.includes('gold')) return 'text-yellow-500';
                  if (t.includes('platinum')) return 'text-cyan-400';
                  if (t.includes('emerald')) return 'text-emerald-500';
                  if (t.includes('diamond')) return 'text-blue-400';
                  if (t.includes('master')) return 'text-purple-500';
                  if (t.includes('grandmaster')) return 'text-red-500';
                  if (t.includes('challenger')) return 'text-cyan-300';
                  return 'text-slate-300';
                };

                return (
                  <Card
                    key={team.id}
                    className="relative bg-slate-900/40 backdrop-blur-md border border-slate-800 hover:border-yellow-500/50 transition-all duration-500 overflow-hidden group shadow-xl flex flex-col"
                    onClick={() => router.push(`/teams/${team.id}`)}
                  >
                    {/* Identity Header */}
                    <div className="relative p-6 pb-2">
                      {/* Rank Watermark */}
                      <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none translate-x-10 -translate-y-10 group-hover:translate-x-8 group-hover:-translate-y-8 transition-all duration-700">
                        {team.average_rank && (
                          <Image
                            src={getRankImage(team.average_rank)}
                            alt=""
                            width={128}
                            height={128}
                            className="object-contain"
                          />
                        )}
                      </div>

                      <div className="relative z-10 flex items-center gap-4">
                        <div className="relative">
                          <TeamAvatar team={team} size="lg" showTooltip={false} className="border-none group-hover:scale-105 transition-transform" />
                          <div className="absolute -bottom-1 -right-1">
                            <div className={cn(
                              "h-4 w-4 rounded-full border-2 border-slate-950",
                              team.recruiting_status === 'Open' ? 'bg-green-500' : 'bg-slate-500'
                            )} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-2xl font-bold font-beaufort tracking-tight text-white mb-0.5 truncate uppercase">
                            {team.name}
                          </h3>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Crown className="h-3 w-3 text-yellow-500" />
                              <span className="text-[10px] font-bold font-beaufort tracking-widest uppercase">
                                {team.captain?.summoner_name || 'Captain Unknown'}
                              </span>
                            </div>
                            {/* Minimized Skill Tier beside Captain */}
                            <div className="w-px h-3 bg-slate-800" />
                            <div className="flex items-center gap-1.5 min-w-fit">
                              {team.average_rank ? (
                                <>
                                  <Image
                                    src={getRankImage(team.average_rank)}
                                    alt=""
                                    width={16}
                                    height={16}
                                    className="object-contain opacity-80"
                                  />
                                  <span className={`text-[10px] font-bold font-beaufort uppercase tracking-widest ${rankColor(team.average_rank)}`}>
                                    {team.average_rank.split(' ')[0]}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-600 font-beaufort uppercase tracking-widest">Unranked</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <CardContent className="px-5 py-4 flex-1 flex flex-col space-y-6 relative z-10">
                      {/* Integrated Roster & Recruiting Slots (5 Boxes) */}
                      <div className="flex items-center justify-center gap-2.5 scale-110 py-2">
                        <TooltipProvider>
                          {(() => {
                            // Logic: Members first, then Open Positions, then Empty Slots - Cap at 5 total.
                            const members = team.members || [];
                            const openPos = team.open_positions || [];
                            const slots = [];

                            // 1. Fill with active members
                            for (let i = 0; i < members.length && slots.length < 5; i++) {
                              slots.push({ type: 'member', data: members[i] });
                            }

                            // 2. Fill with recruiting roles
                            for (let i = 0; i < openPos.length && slots.length < 5; i++) {
                              slots.push({ type: 'recruiting', role: openPos[i] });
                            }

                            // 3. Fill remaining with empty
                            while (slots.length < 5) {
                              slots.push({ type: 'empty' });
                            }

                            return slots.map((slot, i) => {
                              if (slot.type === 'member') {
                                const member = slot.data;
                                return (
                                  <Tooltip key={`member-${member.id}`}>
                                    <TooltipTrigger asChild>
                                      <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-slate-900 shadow-xl transition-all cursor-default flex-shrink-0 group/avatar">
                                        <Image
                                          src={member.profileIconUrl || `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/0.png`}
                                          alt={member.summoner_name}
                                          fill
                                          className="object-cover group-hover/avatar:scale-110 transition-transform"
                                        />
                                        <div className="absolute bottom-0 right-0 p-0.5 bg-slate-950/80 rounded-tl-md border-tl border-slate-800">
                                          <RoleIcon role={member.main_role} size={8} className="brightness-200" />
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 border-slate-800 text-white p-3 shadow-2xl backdrop-blur-md">
                                      <div className="flex items-center gap-3">
                                        <div className="relative w-8 h-8 rounded border border-slate-700 overflow-hidden">
                                          <Image src={member.profileIconUrl || ""} alt="" fill className="object-cover" />
                                        </div>
                                        <div>
                                          <p className="font-bold font-beaufort tracking-wide">{member.summoner_name}</p>
                                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{member.main_role} • {member.tier}</p>
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              } else if (slot.type === 'recruiting') {
                                return (
                                  <Tooltip key={`recruiting-${i}`}>
                                    <TooltipTrigger asChild>
                                      <div className="w-11 h-11 rounded-lg border-2 border-dashed border-cyan-500/20 bg-cyan-500/5 flex items-center justify-center flex-shrink-0 group/role relative overflow-hidden transition-all hover:bg-cyan-500/10 hover:border-cyan-500/40">
                                        <RoleIcon role={slot.role!} size={18} className="opacity-40 brightness-0 invert group-hover/role:opacity-100 group-hover/role:scale-110 transition-all duration-300" />
                                        <div className="absolute inset-0 bg-cyan-400/5 animate-pulse pointer-events-none" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 border-slate-800 text-white font-bold font-beaufort tracking-widest uppercase text-xs">
                                      RECRUITING: {slot.role}
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              } else {
                                return (
                                  <div key={`empty-${i}`} className="w-11 h-11 rounded-lg border-2 border-dashed border-slate-800 bg-slate-900/10 flex items-center justify-center flex-shrink-0">
                                    <Users className="h-4 w-4 text-slate-800" />
                                  </div>
                                );
                              }
                            });
                          })()}
                        </TooltipProvider>
                      </div>

                      {/* Compact Action Button */}
                      <div className="pt-2">
                        <Button
                          className="w-full bg-slate-800/40 hover:bg-gradient-to-r hover:from-yellow-600 hover:to-amber-700 text-slate-400 hover:text-white border border-slate-700/30 hover:border-yellow-500/50 transition-all duration-300 rounded-lg h-11 font-beaufort tracking-[0.2em] uppercase font-bold text-[10px]"
                          onClick={(e) => { e.stopPropagation(); router.push(`/teams/${team.id}`) }}
                        >
                          View Squad Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
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
