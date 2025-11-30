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
  /** Hide the VS divider text */
  hideVs?: boolean
  /** Background color variant */
  backgroundColor?: 'green' | 'red' | 'default'
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
  hideVs = false,
  backgroundColor = 'default',
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

  const getBackgroundClass = () => {
    switch (backgroundColor) {
      case 'green':
        return 'bg-green-900/30'
      case 'red':
        return 'bg-red-900/30'
      default:
        return 'bg-zinc-900'
    }
  }

  return (
    <div className={cn(
      "relative transition-all duration-200 grid items-center rounded-md",
      getBackgroundClass(),
      isMobile || hideVs ? "grid-cols-[auto_auto] gap-[2px] px-[2px] py-[2px] justify-center" : "grid-cols-[1fr_12px_1fr] gap-[2px] px-2 py-2",
      status === 'live' && "border border-red-500/70 shadow-[0_0_10px_rgba(239,68,68,0.4)] animate-pulse",
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
            size="lg"
            showTooltip={true}
            isWinner={isTeam1Winner}
          />
        </div>
      </div>

      {/* VS Divider */}
      {!isMobile && !hideVs && (
        <div className="flex justify-center">
          <div className="font-light text-zinc-500 uppercase tracking-wider text-[10px]">
            vs
          </div>
        </div>
      )}

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
            size="lg"
            showTooltip={true}
            isWinner={isTeam2Winner}
          />
        </div>
      </div>
    </div>
  )
}
