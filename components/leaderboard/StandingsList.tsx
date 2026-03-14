"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { TrendingUp, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getRankImage } from "@/lib/rank-utils"
import RoleIcon from "@/components/RoleIcon"

// --- Constants ---
// Same columns at all sizes, just fluid widths
const STANDINGS_GRID_CLASS = "grid grid-cols-[28px_minmax(80px,1fr)_minmax(60px,160px)_minmax(32px,80px)_minmax(32px,64px)_minmax(40px,96px)] gap-x-1 sm:gap-x-2 items-center"

// --- Components ---

function Standings({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="standings"
            className={cn("space-y-1 sm:space-y-2 max-w-4xl mx-auto", className)}
            {...props}
        />
    )
}

function StandingsHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="standings-header"
            className={cn(
                STANDINGS_GRID_CLASS,
                "mb-2 sm:mb-4 px-2 sm:px-6 text-[7px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] sm:tracking-[0.2em]",
                className
            )}
            {...props}
        />
    )
}

function StandingsRow({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="standings-row"
            className={cn(
                "group relative",
                STANDINGS_GRID_CLASS,
                "p-1.5 sm:p-3 bg-[#0c121d]/60 border border-slate-800/60 hover:border-cyan-500/50 transition-all duration-300 rounded-md sm:rounded-lg overflow-hidden shadow-sm hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] hover:translate-x-1",
                className
            )}
        >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 pointer-events-none" />
            {props.children}
        </div>
    )
}

function StandingsCell({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="standings-cell"
            className={cn("flex flex-col", className)}
            {...props}
        />
    )
}

function StandingsEmpty({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="standings-empty"
            className={cn(
                "text-center py-20 bg-slate-900/20 border border-dashed border-slate-800 rounded-xl",
                className
            )}
            {...props}
        >
            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-xl font-beaufort font-bold text-slate-300">Summoners Not Found</h3>
            <p className="text-slate-500 text-sm mt-1">The Rift is quiet today. Check back later.</p>
        </div>
    )
}

// --- Main Export Component (Convenience wrapper) ---

interface Player {
    id: string
    summoner_name: string
    main_role: string
    opgg_url?: string
    tier: string
    league_points?: number
    wins?: number
    losses?: number
}

interface StandingsListProps {
    players: Player[]
    profileIconUrls: Record<string, string>
    currentUserId?: string
}

export default function StandingsList({ players, profileIconUrls, currentUserId }: StandingsListProps) {
    if (players.length <= 3) {
        return <StandingsEmpty />
    }

    return (
        <Standings>
            <StandingsHeader>
                <div className="text-left">#</div>
                <div className="text-left pl-2 sm:pl-4">Player</div>
                <div className="text-center">Performance</div>
                <div className="text-center">Rank</div>
                <div className="text-center">Standing</div>
                <div className="text-right">Action</div>
            </StandingsHeader>

            {players.slice(3).map((player, idx) => {
                const actualRank = idx + 4
                const wins = player.wins ?? 0
                const losses = player.losses ?? 0
                const total = wins + losses
                const winRate = total === 0 ? 0 : Math.round((wins / total) * 100)

                return (
                    <StandingsRow key={player.id}>
                        {/* Rank Number */}
                        <div className="text-center text-xs sm:text-base font-beaufort font-black text-slate-500 group-hover:text-cyan-400 transition-colors">
                            {actualRank}
                        </div>

                        {/* Avatar & Name */}
                        <div className="flex items-center gap-1.5 sm:gap-4 min-w-0 pl-1 sm:pl-4">
                            <div className="relative shrink-0">
                                {profileIconUrls[player.id] ? (
                                    <Image
                                        src={profileIconUrls[player.id]}
                                        alt=""
                                        width={40}
                                        height={40}
                                        className="rounded-full border border-slate-700/50 grayscale-[0.2] group-hover:grayscale-0 transition-all w-6 h-6 sm:w-10 sm:h-10"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700/50 text-[8px] sm:text-base">?</div>
                                )}
                                <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center p-[1px] sm:p-[2px]">
                                    <RoleIcon role={player.main_role} size={8} className="sm:hidden" />
                                    <RoleIcon role={player.main_role} size={10} className="hidden sm:block" />
                                </div>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="font-bold text-slate-200 group-hover:text-white truncate text-[10px] sm:text-base">
                                    {player.summoner_name.split("#")[0]}
                                </span>
                                <span className="text-[7px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">
                                    #{player.summoner_name.split("#")[1]}
                                </span>
                            </div>
                        </div>

                        {/* Performance (Winrate Bar) */}
                        <div className="flex flex-col gap-0.5 sm:gap-1.5 px-1 sm:px-4">
                            <div className="flex justify-between text-[6px] sm:text-[9px] font-black uppercase tracking-wider opacity-60">
                                <span className="text-green-500">{wins}W</span>
                                <span className="text-slate-400">{winRate}%</span>
                                <span className="text-red-500">{losses}L</span>
                            </div>
                            <div className="h-1 sm:h-1.5 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                                <div
                                    className="h-full bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
                                    style={{ width: `${winRate}%` }}
                                />
                                <div className="h-full bg-red-500/80" style={{ width: `${100 - winRate}%` }} />
                            </div>
                        </div>

                        {/* Rank Crest */}
                        <div className="flex flex-col items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                            <Image
                                src={getRankImage(player.tier)}
                                alt={player.tier}
                                width={28}
                                height={28}
                                className="object-contain mb-0.5 w-4 h-4 sm:w-7 sm:h-7"
                            />
                            <span className="text-[7px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                {player.tier}
                            </span>
                        </div>

                        {/* LP Standing */}
                        <div className="text-center">
                            <span className="text-[10px] sm:text-sm font-black text-[#c9aa71] group-hover:text-[#e5c48b] drop-shadow-[0_0_8px_rgba(201,170,113,0.2)] transition-colors">
                                {player.league_points}{" "}
                                <span className="text-[7px] sm:text-[10px] text-slate-500 font-bold uppercase ml-0.5">LP</span>
                            </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1">
                            <Button
                                asChild
                                variant="ghost"
                                className="text-[7px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] h-6 sm:h-9 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:text-cyan-400 transition-all rounded-md px-1 sm:px-3"
                            >
                                <a href={player.opgg_url} target="_blank" rel="noopener noreferrer">
                                    <span className="sm:hidden">OP.GG</span>
                                    <span className="hidden sm:inline">View OP.GG</span>
                                </a>
                            </Button>
                            {currentUserId && currentUserId !== player.id && (
                                <Button
                                    asChild
                                    variant="ghost"
                                    className="h-6 sm:h-9 w-6 sm:w-9 p-0 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:text-cyan-400 transition-all rounded-md"
                                >
                                    <Link href={`/messages?with=${player.id}`}>
                                        <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </StandingsRow>
                )
            })}
        </Standings>
    )
}

export {
    Standings,
    StandingsHeader,
    StandingsRow,
    StandingsCell,
    StandingsEmpty,
}
