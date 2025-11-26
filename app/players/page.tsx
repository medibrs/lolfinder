'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { getRankImage } from '@/lib/rank-utils'

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
  const [user, setUser] = useState<any>(null)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [sentInvites, setSentInvites] = useState<Record<string, string>>({})
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndFetchPlayers()
    
    // Refetch invitations when page becomes visible (to catch rejected/accepted invites)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchPlayers()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also refetch every 30 seconds to keep data fresh
    const interval = setInterval(() => {
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

  const fetchPlayers = async () => {
    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      // Check if user is a team captain
      if (authUser) {
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
      }

      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching players:', error)
        return
      }

      setPlayers(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
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
    console.log('Cancelling invite for player:', playerId, 'inviteId:', inviteId)
    if (!inviteId || cancellingInvite) {
      console.log('Cannot cancel - missing inviteId or already cancelling')
      return
    }

    try {
      setCancellingInvite(playerId)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      console.log('Sending DELETE request to:', `/api/team-invitations/${inviteId}`)
      console.log('Session present:', !!session?.access_token)
      
      const response = await fetch(`/api/team-invitations/${inviteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)

      if (response.ok) {
        console.log('Invite cancelled successfully, removing from local state')
        setSentInvites(prev => {
          const updated = { ...prev }
          delete updated[playerId]
          console.log('Updated sentInvites:', updated)
          return updated
        })
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
    const matchesRole = !selectedRole || player.main_role === selectedRole || player.secondary_role === selectedRole
    const matchesSearch = player.summoner_name.toLowerCase().includes(searchQuery.toLowerCase())
    const notCurrentUser = player.id !== user?.id
    const matchesLFT = !showLFTOnly || (player.looking_for_team && !player.team_id)
    return matchesRole && matchesSearch && notCurrentUser && matchesLFT
  })

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-2">Player Directory</h1>
        <p className="text-muted-foreground mb-8">Browse all registered players looking for teams</p>

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

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
                          src={`https://ddragon.leagueoflegends.com/cdn/15.23.1/img/profileicon/${player.profile_icon_id}.png`}
                          alt="Profile Icon"
                          width={64}
                          height={64}
                          className="rounded-full border-2 border-border"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                          <span className="text-2xl">?</span>
                        </div>
                      )}
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
                        <span className="text-primary font-semibold">{player.main_role}</span>
                        {player.secondary_role && (
                          <>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-muted-foreground">{player.secondary_role}</span>
                          </>
                        )}
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
                  
                  {player.discord && (
                    <p className="text-muted-foreground mb-4 text-sm">Discord: {player.discord}</p>
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
