'use client'

import { TeamAvatar } from './team-avatar'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'

export interface SingleElimMatchCardTeam {
    id: string
    name: string
    team_avatar?: number
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
            "relative transition-all duration-200 flex items-center justify-center rounded-md w-full bg-zinc-900 border border-zinc-800/80 mx-auto",
            "max-w-[120px] md:max-w-[160px]", // Wide enough for single elim, but constrained enough for nice columns
            isMobile ? "gap-2 px-1.5 py-1.5" : "gap-4 px-3 py-2",
            status === 'live' && "border border-red-500/70 shadow-[0_0_10px_rgba(239,68,68,0.4)] animate-pulse",
            className
        )}>
            {/* Team 1 */}
            <div className={cn(
                "rounded-sm",
                !isTeam1Winner && status === 'done' && winner && "opacity-40"
            )}>
                <div
                    className={cn(
                        "cursor-pointer transition-transform hover:scale-105 flex items-center",
                        (!team1 || team1.id.startsWith('tbd') || team1.id.startsWith('ph')) && "cursor-default"
                    )}
                    onClick={() => handleTeamClick(team1)}
                >
                    <TeamAvatar
                        team={team1}
                        size={isMobile ? "md" : "lg"}
                        showTooltip={true}
                        isWinner={isTeam1Winner}
                    />
                </div>
            </div>

            {/* VS Divider */}
            <div className={cn("flex justify-center items-center shrink-0")}>
                <div className="font-light text-zinc-500 uppercase tracking-wider text-[9px] sm:text-[11px]">
                    vs
                </div>
            </div>

            {/* Team 2 */}
            <div className={cn(
                "rounded-sm",
                !isTeam2Winner && status === 'done' && winner && "opacity-40"
            )}>
                <div
                    className={cn(
                        "cursor-pointer transition-transform hover:scale-105 flex items-center",
                        (!team2 || team2.id.startsWith('tbd') || team2.id.startsWith('ph')) && "cursor-default"
                    )}
                    onClick={() => handleTeamClick(team2)}
                >
                    <TeamAvatar
                        team={team2}
                        size={isMobile ? "md" : "lg"}
                        showTooltip={true}
                        isWinner={isTeam2Winner}
                    />
                </div>
            </div>
        </div>
    )
}
