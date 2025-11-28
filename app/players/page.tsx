'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { getRankImage } from '@/lib/rank-utils'
import { getProfileIconUrl } from '@/lib/ddragon'
import { cache, CacheConfig } from '@/lib/cache'
import RoleIcon from '@/components/RoleIcon'
import { Skeleton } from '@/components/ui/skeleton'
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
}

export default function PlayersPage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showLFTOnly, setShowLFTOnly] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [sentInvites, setSentInvites] = useState<Record<string, string>>({})
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null)
  const [profileIconUrls, setProfileIconUrls] = useState<Record<string, string>>({})
  const [hasPlayerProfile, setHasPlayerProfile] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndFetchPlayers()
    
    // Refetch invitations when page becomes visible (to catch rejected/accepted invites)
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // Invalidate cache to force fresh data when page becomes visible
        await cache.invalidate('all_players', 'players')
        fetchPlayers()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also refetch every 30 seconds to keep data fresh, but invalidate cache first
    const interval = setInterval(async () => {
      await cache.invalidate('all_players', 'players')
      fetchPlayers()
    }, 30000)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
  }, [])

  const checkAuthAndFetchPlayers = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser) {
      router.push('/auth')
      return
    }
    
    fetchPlayers()
  }

  const fetchProfileIconUrls = async (players: Player[]) => {
  const urls: Record<string, string> = {};
  
  for (const player of players) {
    if (player.profile_icon_id) {
      try {
        const url = await getProfileIconUrl(player.profile_icon_id);
        urls[player.id] = url;
      } catch (error) {
        console.error(`Failed to fetch profile icon for ${player.summoner_name}:`, error);
      }
    }
  }
  
  setProfileIconUrls(urls);
};

const fetchPlayers = async () => {
    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      // Check if user is a team captain
      if (authUser) {
        // First check if user has a player profile
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('team_id')
          .eq('id', authUser.id)
          .single()
        
        console.log('Players page - Player data:', playerData)
        console.log('Players page - Player error:', playerError)
        
        if (playerError) {
          console.log('Players page - User does not have a player profile')
          setHasPlayerProfile(false)
          setProfileChecked(true)
        } else {
          console.log('Players page - User has a player profile')
          setHasPlayerProfile(true)
          setProfileChecked(true)
        }

        const { data: teamData } = await supabase
          .from('teams')
          .select('*')
          .eq('captain_id', authUser.id)
          .single()
        
        setUserTeam(teamData)

        // Fetch pending invitations sent by this team
        if (teamData) {
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
      } else {
        // No authenticated user
        setProfileChecked(true)
      }

      // Use cache for players data
      const cacheKey = 'all_players'
      const cacheOptions = {
        ttl: 3 * 60 * 1000, // 3 minutes cache for player data
        namespace: 'players'
      }

      // Try to get from cache first
      const cachedPlayers = await cache.get<Player[]>(cacheKey, cacheOptions)
      if (cachedPlayers) {
        console.log('🎯 Cache HIT - Loading players from cache')
        setPlayers(cachedPlayers)
        setLoading(false) // Hide loading immediately when cache is available
        
        // Fetch profile icon URLs for cached players
        if (cachedPlayers.length > 0) {
          await fetchProfileIconUrls(cachedPlayers)
        }
      } else {
        console.log('❌ Cache MISS - Loading players from database')
      }

      // Always fetch fresh data in background
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching players:', error)
        if (!cachedPlayers) {
          // If no cached data and error occurred, set empty array
          setPlayers([])
        }
        return
      }

      const freshPlayers = data || []
      
      // Update cache with fresh data
      await cache.set(cacheKey, freshPlayers, cacheOptions)
      console.log('💾 Cache SET - Stored fresh player data in cache')
      
      // Update state with fresh data
      setPlayers(freshPlayers)
      
      // Fetch profile icon URLs for fresh players
      if (freshPlayers.length > 0) {
        await fetchProfileIconUrls(freshPlayers)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setInitialLoad(false) // Mark initial load as complete
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
        // Add to sent invites immediately
        setSentInvites(prev => ({ ...prev, [playerId]: data.id }))
        
        // Invalidate players cache to refresh data
        await cache.invalidate('all_players', 'players')
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
        
        // Invalidate players cache to refresh data
        await cache.invalidate('all_players', 'players')
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
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-2">Player Directory</h1>
        <p className="text-muted-foreground mb-8">Browse all registered players looking for teams</p>

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

        <div className="mb-8 space-y-4">
          <Input
            placeholder="Search by summoner name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-input border-border"
          />
          
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                onClick={() => setSelectedRole(null)}
                className={selectedRole === null ? 'bg-primary' : ''}
              >
                All
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
            
            <Button
              variant={showLFTOnly ? 'default' : 'outline'}
              onClick={() => setShowLFTOnly(!showLFTOnly)}
              className={showLFTOnly ? 'bg-green-600 hover:bg-green-700 w-full sm:w-auto' : 'w-full sm:w-auto'}
            >
              {showLFTOnly ? '✓ LFT Only' : 'LFT Only'}
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
              filteredPlayers.map(player => (
                <Card key={player.id} className="bg-card border-border p-6 hover:border-primary transition">
                  <div className="flex items-start gap-4 mb-4">
                    {/* Profile Icon */}
                    <div className="relative">
                      {player.profile_icon_id ? (
                        <Image 
                          src={profileIconUrls[player.id] || ''}
                          alt="Profile Icon"
                          width={64}
                          height={64}
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
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                          <span className="text-2xl">?</span>
                        </div>
                      )}
                      {/* Fallback icon */}
                      <div className="fallback-icon w-16 h-16 bg-muted rounded-full flex items-center justify-center" style={{ display: 'none' }}>
                        <span className="text-2xl">?</span>
                      </div>
                      {/* Rank Badge */}
                      <div className="absolute -bottom-1 -right-1">
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
                      <h3 className="text-xl font-bold mb-1 truncate" title={player.summoner_name}>
                        {player.summoner_name.split('#')[0]}
                        <span className="text-muted-foreground font-normal ml-1">#{player.summoner_name.split('#')[1]}</span>
                      </h3>
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
                      
                      {/* Enhanced Rank Display */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-muted-foreground">Rank:</span>
                        <span className="text-sm font-semibold">
                          {player.tier}
                          {player.rank && player.rank !== null && (
                            <span className="ml-1">{player.rank}</span>
                          )}
                        </span>
                        {player.league_points !== undefined && player.league_points > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({player.league_points} LP)
                          </span>
                        )}
                      </div>
                      
                      {/* Summoner Level */}
                      {player.summoner_level && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">Level:</span>
                          <span className="text-sm font-semibold">{player.summoner_level}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Win/Loss Stats */}
                  {(player.wins !== undefined || player.losses !== undefined) && (
                    <div className="flex items-center justify-center gap-4 mb-4 p-2 bg-muted/50 rounded">
                      {player.wins !== undefined && (
                        <div className="text-center">
                          <span className="text-green-600 font-bold text-sm">{player.wins}</span>
                          <span className="text-xs text-muted-foreground block">W</span>
                        </div>
                      )}
                      {(player.wins !== undefined && player.losses !== undefined) && (
                        <span className="text-muted-foreground">/</span>
                      )}
                      {player.losses !== undefined && (
                        <div className="text-center">
                          <span className="text-red-600 font-bold text-sm">{player.losses}</span>
                          <span className="text-xs text-muted-foreground block">L</span>
                        </div>
                      )}
                      {player.wins !== undefined && player.losses !== undefined && player.wins + player.losses > 0 && (
                        <div className="text-center">
                          <span className="text-blue-600 font-bold text-sm">
                            {Math.round((player.wins / (player.wins + player.losses)) * 100)}%
                          </span>
                          <span className="text-xs text-muted-foreground block">WR</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {user && userTeam && player.id !== user.id ? (
                    <div className="space-y-2">
                      {player.team_id ? (
                        <Button disabled className="w-full">
                          Already in a Team
                        </Button>
                      ) : sentInvites[player.id] ? (
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
                      )}
                      {player.opgg_url && player.opgg_url.trim() !== '' ? (
                        <Button asChild variant="outline" className="w-full">
                          <a href={player.opgg_url} target="_blank" rel="noopener noreferrer">
                            View OP.GG
                          </a>
                        </Button>
                      ) : (
                        <Button disabled variant="outline" className="w-full">
                          No OP.GG Linked
                        </Button>
                      )}
                    </div>
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
                <p className="text-muted-foreground">No players found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
