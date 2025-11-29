'use client'

import { TeamAvatar, TeamAvatarTeam } from './team-avatar'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

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
  live: (
    <div className="absolute top-2 right-2 flex items-center gap-1">
      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      <span className="text-xs font-medium text-red-600">LIVE</span>
    </div>
  ),
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
  const isTeam1Winner = winner === 'team1'
  const isTeam2Winner = winner === 'team2'

  const handleTeamClick = (team: SwissMatchCardTeam | null) => {
    if (team) {
      router.push(`/teams/${team.id}`)
    }
  }

  return (
    <div className={cn(
      "relative rounded-lg border-2 p-1 transition-all duration-200 bg-zinc-900",
      statusColors[status],
      status === 'live' && 'shadow-red-500/20 shadow-lg',
      className
    )}>
      {/* Status Indicator */}
      {statusIndicators[status]}

      {/* Match Content */}
      <div className="flex items-center justify-between gap-1">
        {/* Team 1 */}
        <div className={cn(
          "flex flex-col items-center gap-0 flex-1",
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
              size="sm"
              showTooltip={true}
              isWinner={isTeam1Winner}
            />
          </div>
        </div>

        {/* VS Divider */}
        <div className="flex flex-col items-center justify-center">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            VS
          </div>
        </div>

        {/* Team 2 */}
        <div className={cn(
          "flex flex-col items-center gap-0 flex-1",
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
              size="sm"
              showTooltip={true}
              isWinner={isTeam2Winner}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
