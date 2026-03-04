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

function Podium({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="leaderboard-podium"
            className={cn(
                "relative flex flex-row items-end justify-center gap-3 px-4 max-w-6xl mx-auto mb-20",
                className
            )}
            {...props}
        />
    )
}

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

interface PodiumPlayerProps extends React.ComponentProps<"div"> {
    player: any
    rank: 1 | 2 | 3
    profileIconUrl?: string
}

function PodiumPlayer({
    player,
    rank,
    profileIconUrl,
    className,
    ...props
}: PodiumPlayerProps) {
    const winRate = getWinRate(player.wins, player.losses)

    if (rank === 1) {
        return (
            <div
                data-slot="podium-rank-1"
                className={cn(
                    "relative w-[480px] order-2 z-30 group/p1",
                    className
                )}
                {...props}
            >
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-40">
                    <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-20 opacity-60 -top-10 w-20 h-20">
                        <Image
                            src="/tournament_assets/halo.png"
                            alt=""
                            width={100}
                            height={100}
                            className="object-contain"
                        />
                    </div>
                    <div className="relative w-26 h-26 rounded-full border-[3px] border-[#c9aa71] p-1.5 bg-[#060a13] shadow-[0_0_40px_rgba(201,170,113,0.6)] z-10">
                        {profileIconUrl ? (
                            <Image src={profileIconUrl} alt="" width={100} height={100} className="rounded-full" unoptimized />
                        ) : (
                            <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center">?</div>
                        )}
                    </div>
                </div>

                <div className="relative h-[220px] bg-[#0c121d] border-2 border-[#c9aa71] shadow-[0_0_80px_rgba(201,170,113,0.1)] flex items-center justify-end px-12 pt-6">
                    <div className="absolute inset-0 bg-[#c9aa71]/15 blur-[60px] opacity-0 group-hover/p1:opacity-100 transition-opacity duration-700 -z-10" />
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#c9aa71]/10 to-transparent" />

                    <div className="absolute z-50 opacity-100 pointer-events-none -left-20 -top-[132px] w-[340px]">
                        <FirstPlaceTrophyIcon size={340} className="drop-shadow-[0_40px_60px_rgba(0,0,0,0.9)]" />
                    </div>

                    <div className="flex flex-col z-30 text-right pt-2 pb-6">
                        <p className="text-[14px] font-black uppercase tracking-[0.5em] text-[#c9aa71] mb-2">Rank 1</p>
                        <h3 className="text-4xl font-beaufort font-black text-white uppercase tracking-tight leading-none mb-3 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
                            {player.summoner_name.split("#")[0]}
                        </h3>
                        <div className="flex items-center justify-end gap-2 mb-4">
                            <Image src={getRankImage(player.tier)} alt="" width={24} height={24} className="object-contain" />
                            <p className="text-[12px] font-black text-slate-300 uppercase tracking-widest leading-none">{player.tier}</p>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 -mt-4">
                            <span className="text-xl font-black text-[#c9aa71] group-hover/p1:text-cyan-400 transition-all duration-200">
                                <span className="group-hover/p1:hidden">{winRate}%</span>
                                <span className="hidden group-hover/p1:inline">{player.league_points}</span>
                            </span>
                            <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
                                <span className="group-hover/p1:hidden">WR</span>
                                <span className="hidden group-hover/p1:inline">LP</span>
                            </span>
                        </div>
                    </div>

                    <div className="absolute bottom-4 right-10 z-20">
                        <p className="text-[11px] text-[#c9aa71]/80 uppercase tracking-[0.6em] whitespace-nowrap border-t border-[#c9aa71]/20 pt-2 px-4 shadow-sm bg-[#0c121d]/40">
                            KING OF THE RIFT
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    const isRank2 = rank === 2
    const borderColor = isRank2 ? "border-slate-500" : "border-amber-700"
    const shadowColor = isRank2 ? "rgba(100,116,139,0.3)" : "rgba(180,83,9,0.3)"
    const hoverShadow = isRank2 ? "group-hover:shadow-cyan-500/20" : "group-hover:shadow-orange-500/20"
    const glowBg = isRank2 ? "bg-cyan-500/10" : "bg-orange-500/10"
    const labelColor = isRank2 ? "text-slate-500" : "text-amber-700"
    const hoverTextColor = isRank2 ? "group-hover:text-cyan-400" : "group-hover:text-orange-500"
    const activeTextColor = isRank2 ? "text-cyan-400" : "text-orange-500"

    const MedalIcon = isRank2 ? SecondPlaceMedalIcon : ThirdPlaceMedalIcon
    const accentLine = isRank2 ? "bg-slate-400" : "bg-amber-500/50"

    return (
        <div
            data-slot={`podium-rank-${rank}`}
            className={cn(
                "relative w-[280px] transform transition-all hover:translate-y-[-2px]",
                isRank2 ? "order-1" : "order-3",
                className
            )}
            {...props}
        >
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30">
                <div className={cn(
                    "relative w-14 h-14 rounded-full border-2 p-0.5 bg-[#060a13] shadow-lg transition-all",
                    borderColor,
                    hoverShadow
                )} style={{ boxShadow: `0 0 15px ${shadowColor}` }}>
                    {profileIconUrl ? (
                        <Image src={profileIconUrl} alt="" width={56} height={56} className="rounded-full" unoptimized />
                    ) : (
                        <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-[10px]">?</div>
                    )}
                    <div className={cn("absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 blur-[2px] rounded-full", accentLine)} />
                </div>
            </div>

            <div className={cn(
                "relative h-[110px] bg-[#0c121d]/90 border backdrop-blur-xl flex items-center justify-end px-4 pt-2 shadow-2xl",
                isRank2 ? "border-slate-500/40 skew-x-[-1deg]" : "border-[#b45309]/30 skew-x-[1deg]"
            )}>
                <div className={cn("absolute inset-0 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10", glowBg)} />

                <div className="absolute z-10 opacity-90 pointer-events-none -left-10 -top-10 w-[150px]">
                    <MedalIcon size={150} className="drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]" />
                </div>

                <div className="flex flex-col z-30 text-right pr-2">
                    <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-0.5", labelColor)}>Rank {rank}</p>
                    <h4 className="font-beaufort font-bold text-white uppercase tracking-tight leading-none mb-1 truncate text-base max-w-[140px]">
                        {player.summoner_name.split("#")[0]}
                    </h4>
                    <div className="flex items-center justify-end gap-1.5 mb-1.5 opacity-60">
                        <Image src={getRankImage(player.tier)} alt="" width={14} height={14} className="object-contain" />
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">{player.tier}</p>
                    </div>
                    <p className={cn("text-sm font-black tracking-wider transition-colors", hoverTextColor)}>
                        <span className={cn("text-slate-300", hoverTextColor)}>
                            <span className="group-hover:hidden">{winRate}%</span>
                            <span className="hidden group-hover:inline">{player.league_points}</span>
                        </span>{" "}
                        <span className="text-[10px] text-slate-500 uppercase tracking-normal">
                            <span className="group-hover:hidden">WR</span>
                            <span className="hidden group-hover:inline">LP</span>
                        </span>
                    </p>
                </div>
                <div className={cn("absolute top-0 left-0 w-3 h-3 border-l border-t", isRank2 ? "border-slate-500/50" : "border-amber-700/50")} />
                <div className={cn("absolute bottom-0 right-0 w-3 h-3 border-r border-b", isRank2 ? "border-slate-500/50" : "border-amber-700/50")} />
            </div>
        </div>
    )
}

// --- Main Export ---

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
            <Podium className="group">
                <PodiumPlayer
                    rank={2}
                    player={players[1]}
                    profileIconUrl={profileIconUrls[players[1].id]}
                    className="group"
                />
                <PodiumPlayer
                    rank={1}
                    player={players[0]}
                    profileIconUrl={profileIconUrls[players[0].id]}
                    className="group"
                />
                <PodiumPlayer
                    rank={3}
                    player={players[2]}
                    profileIconUrl={profileIconUrls[players[2].id]}
                    className="group"
                />
            </Podium>
        </>
    )
}

export {
    Podium,
    PodiumGlow,
    PodiumSeparator,
    PodiumPlayer
}
