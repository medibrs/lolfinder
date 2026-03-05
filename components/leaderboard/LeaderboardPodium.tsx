"use client"

import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { getRankImage } from "@/lib/rank-utils"
import {
    FirstPlaceTrophyIcon,
    SecondPlaceMedalIcon,
    ThirdPlaceMedalIcon,
} from "@/components/TournamentIcons"

// --- Helper ---
function getWinRate(wins: number = 0, losses: number = 0) {
    const total = wins + losses
    if (total === 0) return 0
    return Math.round((wins / total) * 100)
}

// --- Components ---

function PodiumGlow() {
    return (
        <div
            data-slot="podium-glow"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[150%] bg-cyan-500/[0.03] blur-[120px] rounded-full pointer-events-none -z-10"
        />
    )
}

function PodiumSeparator() {
    return (
        <div
            data-slot="podium-separator"
            className="max-w-4xl mx-auto mb-10 px-4 mt-[-20px]"
        >
            <div className="h-[1px] w-full bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent" />
        </div>
    )
}

// =====================
// RANK 1 — First Place
// =====================
// Mobile: full-width horizontal card, trophy left, avatar + info right
// Desktop: same layout but bigger

interface PodiumPlayerProps {
    player: any
    profileIconUrl?: string
}

function FirstPlace({ player, profileIconUrl }: PodiumPlayerProps) {
    const winRate = getWinRate(player.wins, player.losses)

    return (
        <div data-slot="podium-rank-1" className="relative w-full group/p1 mb-6 md:mb-0">
            {/* Avatar — positioned above the card */}
            <div className="absolute -top-10 sm:-top-14 md:-top-16 left-1/2 -translate-x-1/2 z-40">
                <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-20 opacity-60 -top-5 sm:-top-8 md:-top-10 w-10 sm:w-16 md:w-20 h-10 sm:h-16 md:h-20">
                    <Image
                        src="/tournament_assets/halo.png"
                        alt=""
                        width={100}
                        height={100}
                        className="object-contain w-full h-full"
                    />
                </div>
                <div className="relative w-14 sm:w-20 md:w-26 h-14 sm:h-20 md:h-26 rounded-full border-2 md:border-[3px] border-[#c9aa71] p-1 md:p-1.5 bg-[#060a13] shadow-[0_0_40px_rgba(201,170,113,0.6)] z-10">
                    {profileIconUrl ? (
                        <Image src={profileIconUrl} alt="" width={100} height={100} className="rounded-full w-full h-full" unoptimized />
                    ) : (
                        <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-xs">?</div>
                    )}
                </div>
            </div>

            {/* Card body */}
            <div className="relative h-[150px] sm:h-[180px] md:h-[220px] bg-[#0c121d] border border-[#c9aa71] md:border-2 shadow-[0_0_80px_rgba(201,170,113,0.1)] flex items-center justify-end px-4 sm:px-8 md:px-12 pt-4 overflow-visible">
                <div className="absolute inset-0 bg-[#c9aa71]/15 blur-[60px] opacity-0 group-hover/p1:opacity-100 transition-opacity duration-700 -z-10" />
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#c9aa71]/10 to-transparent" />

                {/* Trophy — left side */}
                <div className="absolute z-60 w-[200px] h-[170px] pointer-events-none -left-10 -top-10 sm:-left-6 md:-left-16 sm:-top-12 md:-top-20 w-[200px] sm:w-[150px] md:w-[280px] h-[170px] sm:h-[200px] md:h-[360px]">
                    <FirstPlaceTrophyIcon size={50} className="!w-full !h-full [&_img]:object-contain drop-shadow-[0_40px_60px_rgba(0,0,0,0.9)]" />
                </div>

                {/* Text content — right side */}
                <div className="flex flex-col z-30 text-right pt-2 pb-3 sm:pb-5 md:pb-6">
                    <p className="text-[9px] sm:text-[12px] md:text-[14px] font-black uppercase tracking-[0.3em] sm:tracking-[0.5em] text-[#c9aa71] mb-1 sm:mb-2">Rank 1</p>
                    <h3 className="text-lg sm:text-2xl md:text-4xl font-beaufort font-black text-white uppercase tracking-tight leading-none mb-1 sm:mb-2 md:mb-3 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
                        {player.summoner_name.split("#")[0]}
                    </h3>
                    <div className="flex items-center justify-end gap-1.5 sm:gap-2 mb-2 sm:mb-3 md:mb-4">
                        <Image src={getRankImage(player.tier)} alt="" width={24} height={24} className="object-contain w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6" />
                        <p className="text-[9px] sm:text-[10px] md:text-[12px] font-black text-slate-300 uppercase tracking-widest leading-none">{player.tier}</p>
                    </div>
                    <div className="flex items-center justify-end gap-1 sm:gap-1.5 -mt-2 sm:-mt-3 md:-mt-4">
                        <span className="text-sm sm:text-lg md:text-xl font-black text-[#c9aa71] group-hover/p1:text-cyan-400 transition-all duration-200">
                            <span className="group-hover/p1:hidden">{winRate}%</span>
                            <span className="hidden group-hover/p1:inline">{player.league_points}</span>
                        </span>
                        <span className="text-[9px] sm:text-[10px] md:text-[12px] font-bold text-slate-500 uppercase tracking-wider">
                            <span className="group-hover/p1:hidden">WR</span>
                            <span className="hidden group-hover/p1:inline">LP</span>
                        </span>
                    </div>
                </div>

                {/* Bottom label */}
                <div className="absolute bottom-2 right-3 sm:bottom-3 sm:right-6 md:bottom-4 md:right-10 z-20">
                    <p className="text-[7px] sm:text-[9px] md:text-[11px] text-[#c9aa71]/80 uppercase tracking-[0.3em] sm:tracking-[0.5em] md:tracking-[0.6em] whitespace-nowrap border-t border-[#c9aa71]/20 pt-1 sm:pt-1.5 md:pt-2 px-2 sm:px-3 md:px-4 shadow-sm bg-[#0c121d]/40">
                        KING OF THE RIFT
                    </p>
                </div>
            </div>
        </div>
    )
}

// =====================
// RANK 2 & 3 — Runner-ups
// =====================
// Mobile: compact card, avatar top-left, medal right, info below
// Desktop: taller card with more detail

function RunnerUp({ player, profileIconUrl, rank }: PodiumPlayerProps & { rank: 2 | 3 }) {
    const winRate = getWinRate(player.wins, player.losses)
    const isRank2 = rank === 2

    const borderColor = isRank2 ? "border-slate-500" : "border-amber-700"
    const shadowColor = isRank2 ? "rgba(100,116,139,0.3)" : "rgba(180,83,9,0.3)"
    const hoverShadow = isRank2 ? "group-hover:shadow-cyan-500/20" : "group-hover:shadow-orange-500/20"
    const glowBg = isRank2 ? "bg-cyan-500/10" : "bg-orange-500/10"
    const labelColor = isRank2 ? "text-slate-500" : "text-amber-700"
    const hoverTextColor = isRank2 ? "group-hover:text-cyan-400" : "group-hover:text-orange-500"

    const MedalIcon = isRank2 ? SecondPlaceMedalIcon : ThirdPlaceMedalIcon
    const accentLine = isRank2 ? "bg-slate-400" : "bg-amber-500/50"

    return (
        <div data-slot={`podium-rank-${rank}`} className="relative flex-1 min-w-0 group transform transition-all hover:translate-y-[-2px]">
            {/* Avatar */}
            <div className="absolute -top-5 sm:-top-6 md:-top-7 left-1/2 -translate-x-1/2 z-30">
                <div className={cn(
                    "relative w-10 sm:w-12 md:w-14 h-10 sm:h-12 md:h-14 rounded-full border-2 p-0.5 bg-[#060a13] shadow-lg transition-all",
                    borderColor,
                    hoverShadow
                )} style={{ boxShadow: `0 0 15px ${shadowColor}` }}>
                    {profileIconUrl ? (
                        <Image src={profileIconUrl} alt="" width={56} height={56} className="rounded-full w-full h-full" unoptimized />
                    ) : (
                        <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-[8px] sm:text-[10px]">?</div>
                    )}
                    <div className={cn("absolute -top-1 left-1/2 -translate-x-1/2 w-6 sm:w-8 h-0.5 blur-[2px] rounded-full", accentLine)} />
                </div>
            </div>

            {/* Card body */}
            <div className={cn(
                "relative h-[100px] sm:h-[105px] md:h-[110px] bg-[#0c121d]/90 border backdrop-blur-xl flex items-center justify-end px-2 sm:px-3 md:px-4 pt-3 shadow-2xl overflow-visible",
                isRank2 ? "border-slate-500/40 skew-x-[-1deg]" : "border-[#b45309]/30 skew-x-[1deg]"
            )}>
                <div className={cn("absolute inset-0 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10", glowBg)} />

                {/* Medal icon */}
                <div className="absolute z-10 pointer-events-none -left-4 sm:-left-6 md:-left-10 -top-4 sm:-top-6 md:-top-10 w-[70px] sm:w-[110px] md:w-[150px] h-[80px] sm:h-[120px] md:h-[170px]">
                    <MedalIcon size={40} className="!w-full !h-full [&_img]:object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]" />
                </div>

                {/* Text content */}
                <div className="flex flex-col z-30 text-right pr-0.5 sm:pr-1 md:pr-2">
                    <p className={cn("text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] mb-0.5", labelColor)}>Rank {rank}</p>
                    <h4 className="font-beaufort font-bold text-white uppercase tracking-tight leading-none mb-0.5 sm:mb-1 text-xs sm:text-sm md:text-base max-w-[70px] sm:max-w-[100px] md:max-w-[140px] truncate">
                        {player.summoner_name.split("#")[0]}
                    </h4>
                    <div className="flex items-center justify-end gap-1 sm:gap-1.5 mb-1 sm:mb-1.5 opacity-60">
                        <Image src={getRankImage(player.tier)} alt="" width={14} height={14} className="object-contain w-2.5 sm:w-3 md:w-3.5 h-2.5 sm:h-3 md:h-3.5" />
                        <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">{player.tier}</p>
                    </div>
                    <p className={cn("text-[10px] sm:text-xs md:text-sm font-black tracking-wider transition-colors", hoverTextColor)}>
                        <span className={cn("text-slate-300", hoverTextColor)}>
                            <span className="group-hover:hidden">{winRate}%</span>
                            <span className="hidden group-hover:inline">{player.league_points}</span>
                        </span>{" "}
                        <span className="text-[8px] sm:text-[9px] md:text-[10px] text-slate-500 uppercase tracking-normal">
                            <span className="group-hover:hidden">WR</span>
                            <span className="hidden group-hover:inline">LP</span>
                        </span>
                    </p>
                </div>

                {/* Corner accents */}
                <div className={cn("absolute top-0 left-0 w-2 sm:w-3 h-2 sm:h-3 border-l border-t", isRank2 ? "border-slate-500/50" : "border-amber-700/50")} />
                <div className={cn("absolute bottom-0 right-0 w-2 sm:w-3 h-2 sm:h-3 border-r border-b", isRank2 ? "border-slate-500/50" : "border-amber-700/50")} />
            </div>
        </div>
    )
}

// =====================
// Main Podium Layout
// =====================
// Mobile: Rank 1 full-width on top, Rank 2 & 3 side-by-side below
// Desktop: All three side-by-side (rank 2, rank 1, rank 3)

interface LeaderboardPodiumProps {
    players: any[]
    profileIconUrls: Record<string, string>
}

export default function LeaderboardPodium({
    players,
    profileIconUrls,
}: LeaderboardPodiumProps) {
    if (players.length < 3) return null

    return (
        <>
            <PodiumGlow />
            <PodiumSeparator />

            {/* Desktop: single row [2, 1, 3] */}
            <div className="hidden md:flex flex-row items-end justify-center gap-3 px-4 max-w-6xl mx-auto mb-20">
                <RunnerUp rank={2} player={players[1]} profileIconUrl={profileIconUrls[players[1].id]} />
                <div className="flex-[1.7] max-w-[480px] min-w-0">
                    <FirstPlace player={players[0]} profileIconUrl={profileIconUrls[players[0].id]} />
                </div>
                <RunnerUp rank={3} player={players[2]} profileIconUrl={profileIconUrls[players[2].id]} />
            </div>

            {/* Mobile: stacked [1 on top, then 2 & 3 side-by-side] */}
            <div className="md:hidden flex flex-col gap-8 px-3 sm:px-4 mb-16 mt-6">
                <FirstPlace player={players[0]} profileIconUrl={profileIconUrls[players[0].id]} />
                <div className="flex flex-row gap-2 sm:gap-3">
                    <RunnerUp rank={2} player={players[1]} profileIconUrl={profileIconUrls[players[1].id]} />
                    <RunnerUp rank={3} player={players[2]} profileIconUrl={profileIconUrls[players[2].id]} />
                </div>
            </div>
        </>
    )
}

export {
    PodiumGlow,
    PodiumSeparator,
    FirstPlace,
    RunnerUp,
}
