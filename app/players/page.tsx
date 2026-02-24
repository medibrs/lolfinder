'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { getRankImage } from '@/lib/rank-utils'
import RoleIcon from '@/components/RoleIcon'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { User, Target } from 'lucide-react'
import { getCached, setCache } from '@/lib/cache'

// DDragon version is stable - avoid async fetch
const DDRAGON_VERSION = '15.23.1'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']

interface Player {
  id: string
  summoner_name: string
  main_role: string
  secondary_role?: string
  opgg_url?: string
  tier: string
  discord?: string
  team_id?: string
  looking_for_team: boolean
  puuid?: string
  summoner_level?: number
  profile_icon_id?: number
  rank?: string | null
  league_points?: number
  wins?: number
  losses?: number
  is_bot?: boolean
}

export default function PlayersPage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showLFTOnly, setShowLFTOnly] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [user, setUser] = useState<any>(null)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [sentInvites, setSentInvites] = useState<Record<string, string>>({})
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null)
  const [hasPlayerProfile, setHasPlayerProfile] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Check cache first — instant render on return visits
    const { data: cached, isFresh } = getCached<Player[]>('players_page_1')
    if (cached) {
      setPlayers(cached)
      setInitialLoad(false)
      setLoading(false)
    }
    if (!isFresh) fetchPlayers(1)

    const handleVisibilityChange = () => {
      if (!document.hidden) refreshInvitations()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Silently refresh invitation status using local session (3ms, no network auth call)
  const refreshInvitations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: teamData } = await supabase
        .from('teams')
        .select('id')
        .eq('captain_id', session.user.id)
        .single()

      if (teamData) {
        const { data: invitations } = await supabase
          .from('team_invitations')
          .select('id, invited_player_id')
          .eq('team_id', teamData.id)
          .eq('status', 'pending')

        const inviteMap: Record<string, string> = {}
        invitations?.forEach(inv => { inviteMap[inv.invited_player_id] = inv.id })
        setSentInvites(inviteMap)
      }
    } catch (error) { }
  }

  const fetchPlayers = async (page: number = 1, reset: boolean = false) => {
    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })
      if (selectedRole) params.append('role', selectedRole)
      if (showLFTOnly) params.append('lookingForTeam', 'true')

      // Fire ALL heavy fetches in parallel — getUser + player API + player profile + team captain check
      const apiPromise = fetch(`/api/players?${params}`)
      const userPromise = supabase.auth.getUser()
      const profilePromise = supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return { data: null, error: 'no session' } as any;
        return supabase.from('players').select('team_id').eq('id', session.user.id).single();
      })
      const teamCaptainPromise = supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return { data: null } as any;
        return supabase.from('teams').select('id, name').eq('captain_id', session.user.id).single();
      })

      const [response, { data: { user: authUser } }, profileResult, teamResult] = await Promise.all([
        apiPromise, userPromise, profilePromise, teamCaptainPromise
      ])

      setUser(authUser)

      if (authUser) {
        if (profileResult?.error || !profileResult?.data) {
          setHasPlayerProfile(false)
        } else {
          setHasPlayerProfile(true)
        }
        setProfileChecked(true)

        const teamData = teamResult?.data
        setUserTeam(teamData)

        // Fetch pending invitations if user is a captain
        if (teamData) {
          const { data: invitations } = await supabase
            .from('team_invitations')
            .select('id, invited_player_id')
            .eq('team_id', teamData.id)
            .eq('status', 'pending')

          const inviteMap: Record<string, string> = {}
          invitations?.forEach(inv => { inviteMap[inv.invited_player_id] = inv.id })
          setSentInvites(inviteMap)
        }
      } else {
        setProfileChecked(true)
      }

      const result = await response.json()
      if (!response.ok) return

      const newPlayers = result.data || []
      const pagination = result.pagination || {}

      // Update state
      if (reset || page === 1) {
        setPlayers(newPlayers)
        setCache('players_page_1', newPlayers)
      } else {
        setPlayers(prev => [...prev, ...newPlayers])
      }

      setHasMore(pagination.hasMore || false)
      setCurrentPage(page)
    } catch (error) {

    } finally {
      setLoading(false)
      setLoadingMore(false)
      setInitialLoad(false)
    }
  }

  // Add infinite scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore || !hasMore) return

      const scrollHeight = document.documentElement.scrollHeight
      const scrollTop = document.documentElement.scrollTop
      const clientHeight = document.documentElement.clientHeight

      // Load more when user is within 500px of bottom
      if (scrollTop + clientHeight >= scrollHeight - 500) {
        loadMorePlayers()
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loadingMore, hasMore, currentPage, selectedRole, showLFTOnly])

  const loadMorePlayers = () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    fetchPlayers(currentPage + 1, false)
  }

  // Reset pagination when filters change (skip initial mount)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    setCurrentPage(1)
    setPlayers([])
    setHasMore(true)
    fetchPlayers(1, true)
  }, [selectedRole, showLFTOnly])

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
        // Add to sent invites immediately
        setSentInvites(prev => ({ ...prev, [playerId]: data.id }))

        // Refresh players data after invite
        fetchPlayers(1, true)
      } else {
        const error = await response.json()

      }
    } catch (error) {

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

        // Refresh players data after invite
        fetchPlayers(1, true)
      } else {
        const error = await response.json()

      }
    } catch (error) {

    } finally {
      setCancellingInvite(null)
    }
  }

  const filteredPlayers = players.filter(player => {
    // TODO: REMOVE THIS FILTER WHEN GOING PUBLIC
    // This filter hides test profiles that were added via SQL for testing purposes
    // Test profiles have "test" in their summoner names
    // Once we launch publicly, delete test profiles from DB and remove this entire filter block
    const isTestProfile = player.summoner_name.toLowerCase().includes('test');

    const matchesRole = !selectedRole || player.main_role === selectedRole || player.secondary_role === selectedRole
    const matchesSearch = player.summoner_name.toLowerCase().includes(searchQuery.toLowerCase())
    const notCurrentUser = player.id !== user?.id
    const matchesLFT = !showLFTOnly || (player.looking_for_team && !player.team_id)

    // END OF TEMPORARY TEST PROFILE FILTER - REMOVE ABOVE LOGIC WHEN GOING PUBLIC
    const isRealProfile = !isTestProfile;

    return matchesRole && matchesSearch && notCurrentUser && matchesLFT && isRealProfile
  })

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4 mt-8">
        <h1 className="text-5xl font-bold mb-3 font-beaufort tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          Player Directory
        </h1>
        <p className="text-gray-400 mb-10 uppercase tracking-[0.3em] font-beaufort text-sm">
          Recruit the best talent for your squad
        </p>

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
                  <p className="text-slate-400">Unlock invitations and team recruitment tools.</p>
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
              placeholder="Search by summoner name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900/50 border-slate-800 focus:border-yellow-500/50 h-14 pl-6 text-lg rounded-xl backdrop-blur-sm transition-all text-white placeholder:text-slate-500"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-yellow-500 transition-colors">
              <Target className="w-6 h-6" />
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-400 uppercase tracking-widest text-xs font-bold mr-2">Filter Roles:</span>
              <TooltipProvider>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedRole(null)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border ${selectedRole === null
                          ? 'bg-yellow-500/20 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]'
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

            <Button
              variant={showLFTOnly ? 'default' : 'outline'}
              onClick={() => setShowLFTOnly(!showLFTOnly)}
              className={`h-12 px-6 rounded-xl font-bold tracking-widest uppercase text-xs transition-all ${showLFTOnly
                ? 'bg-green-500 border-green-400 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-600'
                }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${showLFTOnly ? 'bg-white animate-pulse' : 'bg-slate-600'}`}></div>
                {showLFTOnly ? 'Recruiting Only' : 'Show Recruiting Only'}
              </div>
            </Button>
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
            {filteredPlayers.length > 0 ? (
              filteredPlayers.map(player => {
                const winRate = player.wins !== undefined && player.losses !== undefined && (player.wins + player.losses) > 0
                  ? Math.round((player.wins / (player.wins + player.losses)) * 100)
                  : 0;

                const rankColor = (tier: string) => {
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
                  <Card key={player.id} className="bg-slate-900/40 backdrop-blur-md border-slate-800 hover:border-yellow-500/50 transition-all duration-500 overflow-hidden group shadow-xl">
                    {/* Identity Header with subtle background blur/gradient */}
                    <div className="relative p-6 pb-4">
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-transparent opacity-50"></div>
                      <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none translate-x-10 -translate-y-10 group-hover:translate-x-8 group-hover:-translate-y-8 transition-all duration-700">
                        <Image
                          src={getRankImage(player.tier)}
                          alt=""
                          width={128}
                          height={128}
                          className="object-contain"
                        />
                      </div>

                      <div className="relative z-10 flex items-center gap-4">
                        {/* Profile Icon with Glow */}
                        <div className="relative">
                          <div className="absolute inset-0 bg-yellow-500/20 blur-[15px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                          {player.profile_icon_id ? (
                            <Image
                              src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${player.profile_icon_id}.png`}
                              alt="Profile Icon"
                              width={72}
                              height={72}
                              className="rounded-full border-2 border-slate-700 relative z-10 group-hover:border-yellow-500/50 transition-colors"
                            />
                          ) : (
                            <div className="w-[72px] h-[72px] bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-700 relative z-10">
                              <span className="text-3xl font-beaufort text-slate-500">?</span>
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 bg-slate-950 p-1 rounded-full border border-slate-800 z-20">
                            <Image
                              src={getRankImage(player.tier)}
                              alt={player.tier}
                              width={24}
                              height={24}
                              className="object-contain"
                            />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-2xl font-bold font-beaufort tracking-tight text-white truncate mb-0.5">
                            {player.summoner_name.split('#')[0]}
                            <span className="text-slate-500 font-normal text-sm ml-1 self-end mb-1 inline-block">#{player.summoner_name.split('#')[1]}</span>
                          </h3>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-bold font-beaufort uppercase tracking-widest ${rankColor(player.tier)}`}>
                              {player.tier} {player.rank || ''}
                            </span>
                            {player.summoner_level && (
                              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-400 font-bold">LVL {player.summoner_level}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <CardContent className="px-6 py-4 space-y-6">
                      {/* Roles */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
                          <RoleIcon role={player.main_role} size={16} className="opacity-80" />
                          <span className="text-xs font-bold text-slate-300 uppercase tracking-tighter">{player.main_role}</span>
                        </div>
                        {player.secondary_role && (
                          <div className="flex items-center gap-1.5 bg-slate-800/30 px-3 py-1.5 rounded-lg border border-slate-700/30">
                            <RoleIcon role={player.secondary_role} size={16} className="opacity-60" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{player.secondary_role}</span>
                          </div>
                        )}
                      </div>

                      {/* WinRate Bar Redesign */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-end mb-1">
                          <div className="flex gap-3 text-[10px] font-bold tracking-widest uppercase">
                            <span className="text-green-500">{player.wins || 0}W</span>
                            <span className="text-red-500">{player.losses || 0}L</span>
                          </div>
                          <span className={`text-lg font-bold font-beaufort ${winRate >= 60 ? 'text-cyan-400' : winRate >= 50 ? 'text-yellow-500' : 'text-slate-400'}`}>
                            {winRate}% <span className="text-[10px] uppercase font-sans tracking-normal opacity-60">WR</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex border border-slate-700/30">
                          <div
                            className={`h-full transition-all duration-1000 ${winRate >= 60 ? 'bg-cyan-500' : winRate >= 50 ? 'bg-yellow-500' : 'bg-slate-500'}`}
                            style={{ width: `${winRate}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="space-y-3 pt-2">
                        {user && userTeam && player.id !== user.id ? (
                          <>
                            {player.team_id ? (
                              <Button disabled className="w-full bg-slate-800/50 text-slate-500 border-none cursor-not-allowed opacity-50">
                                Already in a Team
                              </Button>
                            ) : sentInvites[player.id] ? (
                              <Button
                                onClick={() => handleCancelInvite(player.id)}
                                disabled={cancellingInvite === player.id}
                                className="w-full bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-500/30 transition-all font-bold font-beaufort tracking-widest uppercase"
                              >
                                {cancellingInvite === player.id ? 'Cancelling...' : 'Cancel Invite'}
                              </Button>
                            ) : (
                              <Button
                                onClick={() => handleInvitePlayer(player.id)}
                                disabled={sendingInvite === player.id}
                                className="w-full bg-gradient-to-r from-yellow-600 to-amber-700 hover:from-yellow-500 hover:to-amber-600 text-white font-bold font-beaufort tracking-[0.15em] uppercase shadow-[0_4px_15px_rgba(180,120,0,0.2)] hover:shadow-[0_4px_20px_rgba(180,120,0,0.4)] hover:-translate-y-0.5 transition-all"
                              >
                                {sendingInvite === player.id ? 'Sending...' : 'Invite to Team'}
                              </Button>
                            )}
                          </>
                        ) : null}

                        {player.opgg_url && player.opgg_url.trim() !== '' ? (
                          <Button asChild variant="outline" className="w-full border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-all font-bold uppercase text-[10px] tracking-widest bg-transparent">
                            <a href={player.opgg_url} target="_blank" rel="noopener noreferrer">
                              View OP.GG
                            </a>
                          </Button>
                        ) : (
                          <div className="w-full py-2 text-center border border-slate-800/50 rounded-md">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 italic">No OP.GG History</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground">No players found matching your criteria.</p>
              </div>
            )}
          </div>
        )}

        {/* Loading more indicator */}
        {loadingMore && (
          <div className="flex justify-center items-center py-8 gap-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-muted-foreground">Loading more players...</span>
          </div>
        )}

        {/* End of list indicator */}
        {!initialLoad && !hasMore && filteredPlayers.length > 0 && !loadingMore && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">You've reached the end • {filteredPlayers.length} players shown</p>
          </div>
        )}
      </div>
    </main>
  )
}
