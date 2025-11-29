'use client'

import { TeamAvatar, TeamAvatarTeam } from './team-avatar'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'

export interface SwissMatchCardTeam {
  id: string
  name: string
  team_avatar?: number
}

type MatchStatus = 'live' | 'scheduled' | 'done'

interface SwissMatchCardProps {
  team1: SwissMatchCardTeam | null
  team2: SwissMatchCardTeam | null
  status: MatchStatus
  winner?: 'team1' | 'team2' | null
  className?: string
}

const statusColors = {
  live: 'border-red-500',
  scheduled: 'border-zinc-700',
  done: 'border-zinc-700'
}

const statusIndicators = {
  live: null,
  scheduled: null,
  done: null
}

export function SwissMatchCard({ 
  team1, 
  team2, 
  status, 
  winner = null,
  className 
}: SwissMatchCardProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const isTeam1Winner = winner === 'team1'
  const isTeam2Winner = winner === 'team2'

  const handleTeamClick = (team: SwissMatchCardTeam | null) => {
    if (team) {
      router.push(`/teams/${team.id}`)
    }
  }

  return (
    <div className={cn(
      "relative border-1 transition-all duration-200 bg-zinc-900 grid items-center",
      isMobile ? "grid-cols-[1fr_8px_1fr] gap-[1px] px-[2px] py-[1px]" : "grid-cols-[1fr_12px_1fr] gap-[2px] px-2 py-1",
      status === 'live' 
        ? "border-red-500 shadow-red-500/20 shadow-lg animate-pulse" 
        : statusColors[status],
      className
    )}>
      {/* Team 1 */}
      <div className={cn(
        "flex justify-center",
        isTeam1Winner && "opacity-100",
        !isTeam1Winner && status === 'done' && winner && "opacity-60"
      )}>
        <div 
          className={cn(
            "cursor-pointer transition-transform hover:scale-105",
            !team1 && "cursor-default"
          )}
          onClick={() => handleTeamClick(team1)}
        >
          <TeamAvatar 
            team={team1} 
            size="md"
            showTooltip={true}
            isWinner={isTeam1Winner}
          />
        </div>
      </div>

      {/* VS Divider */}
      <div className="flex justify-center">
        <div className={cn(
          "font-bold text-zinc-400 uppercase tracking-wider",
          isMobile ? "text-[4px] tracking-tight" : "text-xs"
        )}>
          VS
        </div>
      </div>

      {/* Team 2 */}
      <div className={cn(
        "flex justify-center",
        isTeam2Winner && "opacity-100",
        !isTeam2Winner && status === 'done' && winner && "opacity-60"
      )}>
        <div 
          className={cn(
            "cursor-pointer transition-transform hover:scale-105",
            !team2 && "cursor-default"
          )}
          onClick={() => handleTeamClick(team2)}
        >
          <TeamAvatar 
            team={team2} 
            size="md"
            showTooltip={true}
            isWinner={isTeam2Winner}
          />
        </div>
      </div>
    </div>
  )
}
