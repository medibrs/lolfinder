"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getProfileIconUrl } from "@/lib/ddragon"
import { getCached, setCache } from "@/lib/cache"
import StandingsList from "@/components/leaderboard/StandingsList"
import LeaderboardPodium from "@/components/leaderboard/LeaderboardPodium"

// Rank order for sorting (higher index = higher rank)
const RANK_ORDER = [
  "Unranked",
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Emerald",
  "Diamond",
  "Master",
  "Grandmaster",
  "Challenger",
]

const DIVISION_ORDER = ["IV", "III", "II", "I"]

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
  return tierIndex * 10000 + (divisionIndex >= 0 ? divisionIndex : 0) * 1000 + lp
}

export default function LeaderboardPage() {
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [profileIconUrls, setProfileIconUrls] = useState<Record<string, string>>({})
  const supabase = createClient()

  useEffect(() => {
    const checkAuthAndFetchPlayers = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        router.push("/auth")
        return
      }

      fetchPlayers()
    }

    checkAuthAndFetchPlayers()
  }, [router, supabase.auth])

  const fetchProfileIconUrls = async (playersList: Player[]) => {
    const newUrls: Record<string, string> = {}
    for (const player of playersList) {
      if (player.profile_icon_id && !profileIconUrls[player.id]) {
        try {
          const url = getProfileIconUrl(player.profile_icon_id)
          newUrls[player.id] = url
        } catch (error) {
          // Fallback handled by components
        }
      }
    }
    setProfileIconUrls((prev) => ({ ...prev, ...newUrls }))
  }

  const fetchPlayers = async () => {
    const { data: cached, isFresh } = getCached<Player[]>("leaderboard_players")
    if (cached) {
      setPlayers(cached)
      setLoading(false)
      if (cached.length > 0) fetchProfileIconUrls(cached)
      if (isFresh) return
    }

    try {
      const response = await fetch("/api/players?limit=100")
      const result = await response.json()

      if (!response.ok) return

      const allPlayers = result.data || []
      const sortedPlayers = allPlayers
        .filter((p: Player) => !p.summoner_name.toLowerCase().includes("test") && !p.is_bot)
        .sort((a: Player, b: Player) => {
          const scoreA = getRankScore(a.tier, a.rank, a.league_points || 0)
          const scoreB = getRankScore(b.tier, b.rank, b.league_points || 0)
          return scoreB - scoreA
        })

      setPlayers(sortedPlayers)
      setCache("leaderboard_players", sortedPlayers)

      if (sortedPlayers.length > 0) {
        await fetchProfileIconUrls(sortedPlayers)
      }
    } catch (error) {
      // Error handled by state
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen pt-24 pb-12 bg-background text-white font-sans">
      <div className="max-w-6xl mx-auto px-2 sm:px-4">
        {/* League Client Styled Header */}
        <div className="relative mb-12 sm:mb-20 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-4 mb-2">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9aa71]/50 to-transparent" />
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-beaufort font-black uppercase tracking-[0.3em] sm:tracking-[0.5em] text-[#c9aa71] drop-shadow-2xl">
              Leaderboard
            </h1>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9aa71]/50 to-transparent" />
          </div>
          <div className="flex items-center justify-center gap-1.5 opacity-60">
            <div className="w-1 h-1 rotate-45 bg-[#c9aa71]" />
            <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.3em] font-bold text-slate-400">
              Elite Rankings
            </span>
            <div className="w-1 h-1 rotate-45 bg-[#c9aa71]" />
          </div>
        </div>

        {loading ? (
          <div className="space-y-16">
            {/* Podium skeleton — always horizontal */}
            <div className="flex flex-row items-end justify-center gap-1 sm:gap-3 px-1 sm:px-4 max-w-6xl mx-auto">
              <div className="relative flex-1 max-w-[280px] h-[90px] sm:h-[110px] bg-slate-800/40 rounded-sm skew-x-[-1deg] animate-pulse">
                <div className="absolute -top-5 sm:-top-7 left-1/2 -translate-x-1/2 w-10 sm:w-14 h-10 sm:h-14 rounded-full bg-slate-700/50" />
              </div>
              <div className="relative flex-1 max-w-[480px] h-[160px] sm:h-[220px] bg-slate-800/60 rounded-sm animate-pulse">
                <div className="absolute -top-10 sm:-top-16 left-1/2 -translate-x-1/2 w-16 sm:w-24 h-16 sm:h-24 rounded-full bg-slate-700/60" />
                <div className="absolute top-1/2 right-4 sm:right-8 w-20 sm:w-32 h-4 sm:h-6 bg-slate-700/40 rounded" />
              </div>
              <div className="relative flex-1 max-w-[280px] h-[90px] sm:h-[110px] bg-slate-800/40 rounded-sm skew-x-[1deg] animate-pulse">
                <div className="absolute -top-5 sm:-top-7 left-1/2 -translate-x-1/2 w-10 sm:w-14 h-10 sm:h-14 rounded-full bg-slate-700/50" />
              </div>
            </div>

            {/* Standings skeleton */}
            <div className="max-w-4xl mx-auto px-2 sm:px-4 space-y-1 sm:space-y-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 sm:h-16 bg-slate-800/20 border border-slate-700/10 flex items-center px-2 sm:px-6 gap-2 sm:gap-6 animate-pulse"
                >
                  <div className="w-4 sm:w-6 h-4 sm:h-6 bg-slate-700/30 rounded" />
                  <div className="w-6 sm:w-10 h-6 sm:h-10 rounded-full bg-slate-700/50" />
                  <div className="flex-1 max-w-[100px] sm:max-w-[200px] h-3 sm:h-4 bg-slate-700/30 rounded" />
                  <div className="flex-1 h-1.5 sm:h-2 bg-slate-700/10 rounded-full max-w-md" />
                  <div className="w-12 sm:w-24 h-5 sm:h-8 bg-slate-700/40 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <LeaderboardPodium players={players} profileIconUrls={profileIconUrls} />
            <StandingsList players={players} profileIconUrls={profileIconUrls} />

            {!loading && players.length > 0 && (
              <div className="mt-12 py-6 border-t border-slate-800/50 text-center">
                <p className="text-slate-500 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] flex items-center justify-center gap-2 sm:gap-4">
                  <span className="w-6 sm:w-12 h-[1px] bg-slate-800" />
                  Elite Division: {players.length} Verified Contenders
                  <span className="w-6 sm:w-12 h-[1px] bg-slate-800" />
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
