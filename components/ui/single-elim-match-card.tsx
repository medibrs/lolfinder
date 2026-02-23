'use client'

import { TeamAvatar } from './team-avatar'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'

export interface SingleElimMatchCardTeam {
    id: string
    name: string
    team_avatar?: number
    score?: number
}

type MatchStatus = 'live' | 'scheduled' | 'done'

interface SingleElimMatchCardProps {
    team1: SingleElimMatchCardTeam | null
    team2: SingleElimMatchCardTeam | null
    status: MatchStatus
    winner?: 'team1' | 'team2' | null
    className?: string
}

export function SingleElimMatchCard({
    team1,
    team2,
    status,
    winner = null,
    className
}: SingleElimMatchCardProps) {
    const router = useRouter()
    const isMobile = useIsMobile()
    const isTeam1Winner = winner === 'team1'
    const isTeam2Winner = winner === 'team2'

    const handleTeamClick = (team: SingleElimMatchCardTeam | null) => {
        if (team && !team.id.startsWith('tbd') && !team.id.startsWith('ph')) {
            router.push(`/teams/${team.id}`)
        }
    }

    return (
        <div className={cn(
            "relative transition-all duration-200 flex flex-col rounded-md w-full bg-zinc-900 border mx-auto",
            "w-[160px] md:w-[200px]", // Wide enough for single elim vertical list
            status === 'live' ? "border-red-500/70 shadow-[0_0_10px_rgba(239,68,68,0.4)]" : "border-zinc-800/80",
            className
        )}>
            {/* Live Indicator Pulse Background */}
            {status === 'live' && (
                <div className="absolute inset-0 rounded-md bg-red-500/5 animate-pulse pointer-events-none z-0" />
            )}

            <div className="relative z-10 w-full flex flex-col overflow-hidden rounded-md">
                {/* Team 1 Row */}
                <div
                    className={cn(
                        "flex items-center h-10 border-b border-zinc-800/80 transition-colors",
                        !isTeam1Winner && status === 'done' && winner && "opacity-40",
                        (!team1 || team1?.id.startsWith('tbd') || team1?.id.startsWith('ph')) ? "cursor-default" : "cursor-pointer hover:bg-zinc-800/50"
                    )}
                    onClick={() => handleTeamClick(team1)}
                >
                    {/* Status Indicator Bar */}
                    <div className={cn(
                        "w-1 h-full shrink-0",
                        status === 'done' && isTeam1Winner ? "bg-green-500" :
                            status === 'done' && winner ? "bg-red-500" : "bg-transparent"
                    )} />

                    <div className="mx-2 shrink-0">
                        <TeamAvatar
                            team={team1}
                            size="xs"
                            showTooltip={false}
                            className={cn(
                                "w-5 h-5 !ring-0 !shadow-none",
                                (!team1 || team1?.id.startsWith('tbd') || team1?.id.startsWith('ph')) && "opacity-50"
                            )}
                            isWinner={false} // Disable inner border glow for this layout
                        />
                    </div>

                    <div className="flex-1 truncate text-xs font-semibold pr-2">
                        {team1?.name || 'TBD'}
                    </div>

                    {status === 'done' && winner && (
                        <div className="w-8 h-full flex items-center justify-center bg-zinc-950/40 text-xs font-mono font-bold shrink-0 border-l border-zinc-800/80">
                            {team1?.score !== undefined ? team1.score : (isTeam1Winner ? '1' : '0')}
                        </div>
                    )}
                </div>

                {/* Team 2 Row */}
                <div
                    className={cn(
                        "flex items-center h-10 transition-colors bg-zinc-900",
                        !isTeam2Winner && status === 'done' && winner && "opacity-40",
                        (!team2 || team2?.id.startsWith('tbd') || team2?.id.startsWith('ph')) ? "cursor-default" : "cursor-pointer hover:bg-zinc-800/50"
                    )}
                    onClick={() => handleTeamClick(team2)}
                >
                    {/* Status Indicator Bar */}
                    <div className={cn(
                        "w-1 h-full shrink-0",
                        status === 'done' && isTeam2Winner ? "bg-green-500" :
                            status === 'done' && winner ? "bg-red-500" : "bg-transparent"
                    )} />

                    <div className="mx-2 shrink-0">
                        <TeamAvatar
                            team={team2}
                            size="xs"
                            showTooltip={false}
                            className={cn(
                                "w-5 h-5 !ring-0 !shadow-none",
                                (!team2 || team2?.id.startsWith('tbd') || team2?.id.startsWith('ph')) && "opacity-50"
                            )}
                            isWinner={false} // Disable inner border glow for this layout
                        />
                    </div>

                    <div className="flex-1 truncate text-xs font-semibold pr-2">
                        {team2?.name || 'TBD'}
                    </div>

                    {status === 'done' && winner && (
                        <div className="w-8 h-full flex items-center justify-center bg-zinc-950/40 text-xs font-mono font-bold shrink-0 border-l border-zinc-800/80">
                            {team2?.score !== undefined ? team2.score : (isTeam2Winner ? '1' : '0')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
