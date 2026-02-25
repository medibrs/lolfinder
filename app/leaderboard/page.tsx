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
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Trophy, Medal, Award, TrendingUp, ExternalLink, ChevronRight, Target } from 'lucide-react'
import { TrophyIcon, FirstPlaceTrophyIcon, SecondPlaceMedalIcon, ThirdPlaceMedalIcon } from '@/components/TournamentIcons'

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
  is_bot?: boolean
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
  const isMobile = useIsMobile()

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

        return
      }

      const allPlayers = result.data || []

      // Filter out test profiles and sort by rank
      const sortedPlayers = allPlayers
        .filter((p: Player) => !p.summoner_name.toLowerCase().includes('test') && !p.is_bot)
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

    } finally {
      setLoading(false)
    }
  }

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
          <TrophyIcon size={20} />
        </div>
      )
    }
    if (index === 1) {
      return (
        <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
          <SecondPlaceMedalIcon size={24} />
        </div>
      )
    }
    if (index === 2) {
      return (
        <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
          <ThirdPlaceMedalIcon size={24} />
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
    if (index === 0) return 'border-yellow-500/50 bg-yellow-500/5 shadow-[0_0_20px_rgba(234,179,8,0.1)]'
    if (index === 1) return 'border-slate-300/50 bg-slate-300/5 shadow-[0_0_20px_rgba(148,163,184,0.1)]'
    if (index === 2) return 'border-amber-600/50 bg-amber-600/5 shadow-[0_0_20px_rgba(180,83,9,0.1)]'
    return 'border-slate-800 bg-slate-900/40'
  }

  // Calculate winrate
  const getWinRate = (wins: number = 0, losses: number = 0) => {
    const total = wins + losses
    if (total === 0) return 0
    return Math.round((wins / total) * 100)
  }

  return (
    <main className="min-h-screen pt-24 pb-12 bg-background text-white font-sans">
      <div className="max-w-6xl mx-auto px-4">
        {/* League Client Styled Header */}
        <div className="relative mb-20 text-center">
          <div className="flex items-center justify-center gap-4 mb-2">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9aa71]/50 to-transparent"></div>
            <h1 className="text-2xl md:text-3xl font-beaufort font-black uppercase tracking-[0.5em] text-[#c9aa71] drop-shadow-2xl">
              Leaderboard
            </h1>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9aa71]/50 to-transparent"></div>
          </div>
          <div className="flex items-center justify-center gap-1.5 opacity-60">
            <div className="w-1 h-1 rotate-45 bg-[#c9aa71]"></div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-400">Elite Rankings</span>
            <div className="w-1 h-1 rotate-45 bg-[#c9aa71]"></div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-16">
            {/* Podium Skeleton */}
            <div className="flex flex-col md:flex-row items-end justify-center gap-2 lg:gap-3 px-4 max-w-6xl mx-auto">
              {/* Rank 2 Skeleton */}
              <div className="relative w-full md:w-[280px] h-[110px] bg-slate-800/40 rounded-sm skew-x-[-1deg] animate-pulse">
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-slate-700/50" />
              </div>

              {/* Rank 1 Skeleton */}
              <div className="relative w-full md:w-[480px] h-[180px] md:h-[220px] bg-slate-800/60 rounded-sm animate-pulse mb-8 md:mb-0">
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-slate-700/60" />
                <div className="absolute top-1/2 right-8 w-32 h-6 bg-slate-700/40 rounded" />
              </div>

              {/* Rank 3 Skeleton */}
              <div className="relative w-full md:w-[280px] h-[110px] bg-slate-800/40 rounded-sm skew-x-[1deg] animate-pulse">
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-slate-700/50" />
              </div>
            </div>

            {/* List Skeleton */}
            <div className="max-w-6xl mx-auto px-4 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-800/20 border border-slate-700/10 flex items-center px-6 gap-6 animate-pulse">
                  <div className="w-6 h-6 bg-slate-700/30 rounded" />
                  <div className="w-10 h-10 rounded-full bg-slate-700/50" />
                  <div className="flex-1 max-w-[200px] h-4 bg-slate-700/30 rounded" />
                  <div className="hidden md:block flex-1 h-2 bg-slate-700/10 rounded-full max-w-md" />
                  <div className="w-24 h-8 bg-slate-700/40 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Top 3 Podium Section with Cinematic Glow */}
            <div className="relative mb-20">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[150%] bg-cyan-500/[0.03] blur-[120px] rounded-full pointer-events-none"></div>

              <div className="max-w-4xl mx-auto mb-10 px-4 mt-[-20px]">
                <div className="h-[1px] w-full bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent"></div>
              </div>

              {players.length >= 3 && (
                <div className="flex flex-col md:flex-row items-end justify-center gap-1 lg:gap-3 px-4 max-w-6xl mx-auto">

                  {/* RANK 2 HUD */}
                  <div className="relative w-full md:w-[280px] order-2 md:order-1 transform transition-all hover:translate-y-[-2px] group/p2 mb-12 md:mb-0">
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30">
                      <div className="relative w-14 h-14 rounded-full border-2 border-slate-500 p-0.5 bg-[#060a13] shadow-[0_0_15px_rgba(100,116,139,0.3)] group-hover/p2:shadow-cyan-500/20 transition-all">
                        {profileIconUrls[players[1].id] ? (
                          <Image src={profileIconUrls[players[1].id]} alt="" width={56} height={56} className="rounded-full" unoptimized />
                        ) : (
                          <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-[10px]">?</div>
                        )}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-slate-400 blur-[2px] rounded-full"></div>
                      </div>
                    </div>

                    <div className="relative h-[110px] bg-[#0c121d]/90 border border-slate-500/40 backdrop-blur-xl flex items-center justify-end px-4 pt-2 shadow-2xl skew-x-[-1deg]">
                      {/* Under-glow (Hover only) */}
                      <div className="absolute inset-0 bg-cyan-500/10 blur-[40px] opacity-0 group-hover/p2:opacity-100 transition-opacity duration-500 -z-10"></div>

                      {/* Bleeding Medal - Responsive Positioning */}
                      <div className={`absolute ${isMobile ? '-left-4 -top-4 w-[110px]' : '-left-10 -top-10 w-[150px]'} z-10 opacity-90 pointer-events-none`}>
                        <SecondPlaceMedalIcon size={isMobile ? 110 : 150} className="drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]" />
                      </div>

                      <div className={`flex flex-col z-30 text-right pr-2 ${isMobile ? 'pl-20' : 'pl-24 md:pl-0'}`}>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-0.5">Rank 2</p>
                        <h4 className={`font-beaufort font-bold text-white uppercase tracking-tight leading-none mb-1 truncate ${isMobile ? 'text-sm max-w-[120px]' : 'text-base max-w-[140px]'}`}>
                          {players[1].summoner_name.split('#')[0]}
                        </h4>
                        <div className="flex items-center justify-center md:justify-end gap-1.5 mb-1.5 opacity-60">
                          <Image src={getRankImage(players[1].tier)} alt="" width={14} height={14} className="object-contain" />
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">{players[1].tier}</p>
                        </div>
                        <p className="text-sm font-black tracking-wider transition-colors group-hover/p2:text-cyan-400">
                          <span className="text-slate-300 group-hover/p2:text-cyan-400">{players[1].league_points}</span> <span className="text-[10px] text-slate-500 uppercase tracking-normal">LP</span>
                        </p>
                      </div>
                      <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-slate-500/50"></div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-slate-500/50"></div>
                    </div>
                  </div>

                  <div className="relative w-full md:w-[480px] order-1 md:order-2 z-30 group/p1 mb-20 md:mb-0">
                    {/* AVATAR WITH NEW HALO ASSET */}
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-40">
                      {/* Halo Asset */}
                      <div className={`absolute ${isMobile ? '-top-6 w-16 h-16' : '-top-10 w-20 h-20'} left-1/2 -translate-x-1/2 pointer-events-none z-20 opacity-60`}>
                        <Image src="/tournament_assets/halo.png" alt="" width={isMobile ? 80 : 100} height={isMobile ? 80 : 100} className="object-contain" />
                      </div>
                      {/* Avatar Circle */}
                      <div className="relative w-26 h-26 rounded-full border-[3px] border-[#c9aa71] p-1.5 bg-[#060a13] shadow-[0_0_40px_rgba(201,170,113,0.6)] z-10">
                        {profileIconUrls[players[0].id] ? (
                          <Image src={profileIconUrls[players[0].id]} alt="" width={100} height={100} className="rounded-full" unoptimized />
                        ) : (
                          <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center">?</div>
                        )}
                      </div>
                    </div>

                    <div className="relative h-[200px] md:h-[220px] bg-[#0c121d] border-2 border-[#c9aa71] shadow-[0_0_80px_rgba(201,170,113,0.1)] flex items-center justify-end px-4 md:px-12 pt-6">
                      {/* Big Under-glow (Hover only) */}
                      <div className="absolute inset-0 bg-[#c9aa71]/15 blur-[60px] opacity-0 group-hover/p1:opacity-100 transition-opacity duration-700 -z-10"></div>

                      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#c9aa71]/10 to-transparent"></div>

                      {/* Giant Bleeding Trophy - Responsive */}
                      <div className={`absolute ${isMobile ? '-left-8 -top-1 w-[200px]' : '-left-20 -top-[132px] w-[340px]'} z-50 opacity-100 pointer-events-none`}>
                        <FirstPlaceTrophyIcon size={isMobile ? 150 : 340} className="drop-shadow-[0_40px_60px_rgba(0,0,0,0.9)]" />
                      </div>

                      <div className={`flex flex-col z-30 text-right pt-2 pb-6 md:pb-6 ${isMobile ? 'pl-28' : 'pl-32 md:pl-0'}`}>
                        <p className="text-[12px] md:text-[14px] font-black uppercase tracking-[0.5em] text-[#c9aa71] mb-1 md:mb-2">Rank 1</p>
                        <h3 className="text-2xl md:text-4xl font-beaufort font-black text-white uppercase tracking-tight leading-none mb-2 md:mb-3 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
                          {players[0].summoner_name.split('#')[0]}
                        </h3>
                        <div className="flex items-center justify-end gap-2 mb-3 md:mb-4">
                          <Image src={getRankImage(players[0].tier)} alt="" width={24} height={24} className="object-contain" />
                          <p className="text-[10px] md:text-[12px] font-black text-slate-300 uppercase tracking-widest leading-none">{players[0].tier}</p>
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-lg md:text-xl font-black text-[#c9aa71]">{players[0].league_points}</span>
                          <span className="text-[10px] md:text-[12px] font-bold text-slate-500 uppercase tracking-wider">LP</span>
                        </div>

                      </div>

                      <div className="absolute bottom-4 right-10 md:bottom-4 md:right-10 z-20">
                        <p className="text-[8px] md:text-[11px]  text-[#c9aa71]/80 uppercase tracking-[0.6em]  whitespace-nowrap border-t border-[#c9aa71]/20 pt-1 md:pt-2 px-2 md:px-4 shadow-sm bg-[#0c121d]/40">
                          KING OF THE RIFT
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* RANK 3 HUD */}
                  <div className="relative w-full md:w-[280px] order-3 md:order-3 transform transition-all hover:translate-y-[-2px] group/p3 mt-12 md:mt-0">
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30">
                      <div className="relative w-14 h-14 rounded-full border-2 border-amber-700 p-0.5 bg-[#060a13] shadow-[0_0_15px_rgba(180,83,9,0.3)] group-hover/p3:shadow-orange-500/20 transition-all">
                        {profileIconUrls[players[2].id] ? (
                          <Image src={profileIconUrls[players[2].id]} alt="" width={56} height={56} className="rounded-full" unoptimized />
                        ) : (
                          <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-[10px]">?</div>
                        )}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500/50 blur-[2px] rounded-full"></div>
                      </div>
                    </div>

                    <div className="relative h-[110px] bg-[#0c121d]/90 border border-[#b45309]/30 backdrop-blur-xl flex items-center justify-end px-4 pt-2 shadow-2xl skew-x-[1deg]">
                      {/* Under-glow (Hover only) */}
                      <div className="absolute inset-0 bg-orange-500/10 blur-[40px] opacity-0 group-hover/p3:opacity-100 transition-opacity duration-500 -z-10"></div>

                      {/* Bleeding Medal - Responsive Positioning */}
                      <div className={`absolute ${isMobile ? '-left-4 -top-4 w-[110px]' : '-left-10 -top-10 w-[150px]'} z-10 opacity-90 pointer-events-none`}>
                        <ThirdPlaceMedalIcon size={isMobile ? 110 : 150} className="drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]" />
                      </div>

                      <div className={`flex flex-col z-30 text-right pr-2 ${isMobile ? 'pl-20' : 'pl-24 md:pl-0'}`}>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 mb-0.5">Rank 3</p>
                        <h4 className="text-base font-beaufort font-bold text-white uppercase tracking-tight leading-none mb-1 truncate max-w-[140px]">
                          {players[2].summoner_name.split('#')[0]}
                        </h4>
                        <div className="flex items-center justify-center md:justify-end gap-1.5 mb-1.5 opacity-60">
                          <Image src={getRankImage(players[2].tier)} alt="" width={14} height={14} className="object-contain" />
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">{players[2].tier}</p>
                        </div>
                        <p className="text-sm font-black tracking-wider group-hover/p3:text-orange-500 transition-colors">
                          <span className="text-slate-300 group-hover/p3:text-orange-500">{players[2].league_points}</span> <span className="text-[10px] text-slate-500 uppercase tracking-normal">LP</span>
                        </p>
                      </div>
                      <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-amber-700/50"></div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-amber-700/50"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Leaderboard Table Header */}
            <div className="max-w-4xl mx-auto mb-4 px-6 grid grid-cols-[48px_1fr_120px_100px_80px_120px] md:grid-cols-[48px_1fr_160px_120px_96px_128px] items-center text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
              <div className="text-left">#</div>
              <div className="text-left pl-4">Player</div>
              <div className="hidden md:block text-center">Performance</div>
              <div className="text-center">Rank</div>
              <div className="text-center">Standing</div>
              <div className="hidden sm:block text-right">Action</div>
            </div>

            {/* Leaderboard List */}
            <div className="space-y-2 max-w-4xl mx-auto">
              {players.length > 3 ? (
                players.slice(3).map((player, idx) => {
                  const actualRank = idx + 4
                  const winRate = getWinRate(player.wins, player.losses)

                  return (
                    <div
                      key={player.id}
                      className="group relative grid grid-cols-[48px_1fr_120px_100px_80px_120px] md:grid-cols-[48px_1fr_160px_120px_96px_128px] items-center p-3 bg-[#0c121d]/60 border border-slate-800/60 hover:border-cyan-500/50 transition-all duration-300 rounded-lg overflow-hidden group/row shadow-sm hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] hover:translate-x-1"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.02] to-transparent opacity-0 group-hover/row:opacity-100 pointer-events-none" />

                      {/* Rank Number */}
                      <div className="text-center font-beaufort font-black text-slate-500 group-hover/row:text-cyan-400 transition-colors">
                        {actualRank}
                      </div>

                      {/* Avatar & Name */}
                      <div className="flex items-center gap-4 min-w-0 pl-4">
                        <div className="relative">
                          {profileIconUrls[player.id] ? (
                            <Image
                              src={profileIconUrls[player.id]}
                              alt=""
                              width={40}
                              height={40}
                              className="rounded-full border border-slate-700/50 grayscale-[0.2] group-hover/row:grayscale-0 transition-all"
                              unoptimized
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700/50">?</div>
                          )}
                          <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full border border-slate-800 p-0.5">
                            <RoleIcon role={player.main_role} size={10} />
                          </div>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-200 group-hover/row:text-white truncate">
                            {player.summoner_name.split('#')[0]}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            #{player.summoner_name.split('#')[1]}
                          </span>
                        </div>
                      </div>

                      {/* Performance (Winrate Bar) */}
                      <div className="hidden md:flex flex-col gap-1.5 px-4">
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-wider opacity-60">
                          <span className="text-green-500">{player.wins}W</span>
                          <span className="text-slate-400">{winRate}%</span>
                          <span className="text-red-500">{player.losses}L</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                          <div className="h-full bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.3)]" style={{ width: `${winRate}%` }} />
                          <div className="h-full bg-red-500/80" style={{ width: `${100 - winRate}%` }} />
                        </div>
                      </div>

                      {/* Rank Crest */}
                      <div className="flex flex-col items-center justify-center opacity-80 group-hover/row:opacity-100 transition-opacity">
                        <Image
                          src={getRankImage(player.tier)}
                          alt={player.tier}
                          width={28}
                          height={28}
                          className="object-contain mb-0.5"
                        />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {player.tier}
                        </span>
                      </div>

                      {/* LP Standing */}
                      <div className="text-center">
                        <span className="text-sm font-black text-[#c9aa71] group-hover/row:text-[#e5c48b] drop-shadow-[0_0_8px_rgba(201,170,113,0.2)] transition-colors">
                          {player.league_points} <span className="text-[10px] text-slate-500 font-bold uppercase ml-0.5">LP</span>
                        </span>
                      </div>

                      {/* View Button */}
                      <div className="hidden sm:block text-right">
                        <Button
                          asChild
                          variant="ghost"
                          className="w-full text-[10px] font-black uppercase tracking-[0.2em] h-9 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:text-cyan-400 transition-all rounded-md"
                        >
                          <a href={player.opgg_url} target="_blank" rel="noopener noreferrer">
                            View OP.GG
                          </a>
                        </Button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-800 rounded-xl">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-8 h-8 text-slate-600" />
                  </div>
                  <h3 className="text-xl font-beaufort font-bold text-slate-300">Summoners Not Found</h3>
                  <p className="text-slate-500 text-sm mt-1">The Rift is quiet today. Check back later.</p>
                </div>
              )}
            </div>

            {/* Stats Summary Footer */}
            {!loading && players.length > 0 && (
              <div className="mt-12 py-6 border-t border-slate-800/50 text-center">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-4">
                  <span className="w-12 h-[1px] bg-slate-800"></span>
                  Elite Division: {players.length} Verified Contenders
                  <span className="w-12 h-[1px] bg-slate-800"></span>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

