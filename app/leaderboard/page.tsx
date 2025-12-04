'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { getRankImage } from '@/lib/rank-utils'
import { getProfileIconUrl } from '@/lib/ddragon'
import RoleIcon from '@/components/RoleIcon'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react'

// Rank order for sorting (higher index = higher rank)
const RANK_ORDER = [
  'Unranked',
  'Iron',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Emerald',
  'Diamond',
  'Master',
  'Grandmaster',
  'Challenger'
]

const DIVISION_ORDER = ['IV', 'III', 'II', 'I']

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

function getRankScore(tier: string, division: string | null | undefined, lp: number = 0): number {
  const tierIndex = RANK_ORDER.indexOf(tier) || 0
  const divisionIndex = division ? DIVISION_ORDER.indexOf(division) : 0
  // Score = tier * 10000 + division * 1000 + LP
  return tierIndex * 10000 + (divisionIndex >= 0 ? divisionIndex : 0) * 1000 + lp
}

export default function LeaderboardPage() {
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [profileIconUrls, setProfileIconUrls] = useState<Record<string, string>>({})
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndFetchPlayers()
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
    const newUrls: Record<string, string> = {}
    
    for (const player of players) {
      if (player.profile_icon_id) {
        try {
          const url = await getProfileIconUrl(player.profile_icon_id)
          newUrls[player.id] = url
        } catch (error) {
          console.error(`Failed to fetch profile icon for ${player.summoner_name}:`, error)
        }
      }
    }
    
    // Merge with existing URLs instead of replacing
    setProfileIconUrls(prev => ({ ...prev, ...newUrls }))
  }

  const fetchPlayers = async () => {
    try {
      // Fetch all players
      const response = await fetch('/api/players?limit=100')
      const result = await response.json()

      if (!response.ok) {
        console.error('Error fetching players:', result.error)
        return
      }

      const allPlayers = result.data || []
      
      // Filter out test profiles and sort by rank
      const sortedPlayers = allPlayers
        .filter((p: Player) => !p.summoner_name.toLowerCase().includes('test'))
        .sort((a: Player, b: Player) => {
          const scoreA = getRankScore(a.tier, a.rank, a.league_points || 0)
          const scoreB = getRankScore(b.tier, b.rank, b.league_points || 0)
          return scoreB - scoreA // Higher score first
        })

      setPlayers(sortedPlayers)
      
      // Fetch profile icons
      if (sortedPlayers.length > 0) {
        await fetchProfileIconUrls(sortedPlayers)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg">
          <Trophy className="w-5 h-5 text-white" />
        </div>
      )
    }
    if (index === 1) {
      return (
        <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center shadow-lg">
          <Medal className="w-5 h-5 text-white" />
        </div>
      )
    }
    if (index === 2) {
      return (
        <div className="w-8 h-8 bg-amber-700 rounded-full flex items-center justify-center shadow-lg">
          <Award className="w-5 h-5 text-white" />
        </div>
      )
    }
    return (
      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-sm font-bold">
        {index + 1}
      </div>
    )
  }

  const getRowStyle = (index: number) => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/50'
    if (index === 1) return 'bg-gradient-to-r from-gray-400/10 to-transparent border-gray-400/50'
    if (index === 2) return 'bg-gradient-to-r from-amber-700/10 to-transparent border-amber-700/50'
    return ''
  }

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold">Leaderboard</h1>
        </div>
        <p className="text-muted-foreground mb-8">Top players ranked by competitive standing</p>

        {loading ? (
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {players.length > 0 ? (
              players.map((player, index) => (
                <Card 
                  key={player.id} 
                  className={`relative p-4 hover:border-primary transition ${getRowStyle(index)}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Position Badge */}
                    <div className="w-8 flex-shrink-0 flex items-center justify-center">
                      {getRankBadge(index)}
                    </div>
                    
                    {/* Profile Icon */}
                    <div className="relative flex-shrink-0">
                      {player.profile_icon_id && profileIconUrls[player.id] ? (
                        <Image 
                          src={profileIconUrls[player.id]}
                          alt="Profile Icon"
                          width={48}
                          height={48}
                          className="rounded-full border-2 border-border"
                          unoptimized
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const parent = target.parentElement
                            if (parent) {
                              const fallback = parent.querySelector('.fallback-icon')
                              if (fallback) {
                                (fallback as HTMLElement).style.display = 'flex'
                              }
                            }
                          }}
                        />
                      ) : null}
                      {/* Fallback icon - shown when no profile icon or on error */}
                      <div 
                        className="fallback-icon w-12 h-12 bg-muted rounded-full flex items-center justify-center"
                        style={{ display: player.profile_icon_id && profileIconUrls[player.id] ? 'none' : 'flex' }}
                      >
                        <span className="text-lg">?</span>
                      </div>
                      {/* Rank Badge */}
                      <div className="absolute -bottom-1 -right-1">
                        <Image 
                          src={getRankImage(player.tier)} 
                          alt={player.tier}
                          width={20}
                          height={20}
                          className="object-contain"
                        />
                      </div>
                    </div>
                    
                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">
                        {player.summoner_name.split('#')[0]}
                        <span className="text-muted-foreground font-normal ml-1">
                          #{player.summoner_name.split('#')[1]}
                        </span>
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TooltipProvider>
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <RoleIcon role={player.main_role} size={14} />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{player.main_role}</p>
                              </TooltipContent>
                            </Tooltip>
                            {player.secondary_role && (
                              <>
                                <span>/</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <RoleIcon role={player.secondary_role} size={14} />
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
                        {player.wins !== undefined && player.losses !== undefined && (
                          <span className="hidden sm:inline">
                            • {player.wins}W {player.losses}L
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Rank Display */}
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-sm sm:text-base">
                        {player.tier}
                        {player.rank && player.tier !== 'Unranked' && (
                          <span className="ml-1">{player.rank}</span>
                        )}
                      </div>
                      {player.league_points !== undefined && player.league_points > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {player.league_points} LP
                        </div>
                      )}
                    </div>
                    
                    {/* OP.GG Link */}
                    <div className="hidden sm:block flex-shrink-0">
                      {player.opgg_url && player.opgg_url.trim() !== '' ? (
                        <Button asChild variant="outline" size="sm">
                          <a href={player.opgg_url} target="_blank" rel="noopener noreferrer">
                            OP.GG
                          </a>
                        </Button>
                      ) : (
                        <Button disabled variant="outline" size="sm">
                          OP.GG
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No players found.</p>
              </div>
            )}
          </div>
        )}
        
        {/* Stats summary */}
        {!loading && players.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-muted-foreground text-sm">
              Showing {players.length} ranked players
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
