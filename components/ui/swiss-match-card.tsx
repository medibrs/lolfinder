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

  // Remove VS text vertically when we're on mobile and it hasn't been explicitly requested
  const shouldHideVs = isMobile || hideVs

  return (
    <div className={cn(
      "relative transition-all duration-300 flex items-center justify-center rounded-lg mx-auto w-full",
      // Glassmorphic Hextech treatment
      "bg-slate-900/60 backdrop-blur-md border border-slate-700/50 shadow-xl",
      // Flex constraints: start small on iPads, grow gradually matching grid column availability
      isMobile ? "max-w-[52px]" : "max-w-[124px] xl:max-w-[164px] 2xl:max-w-[184px]",
      // States
      status === 'done' && winner && "border-emerald-500/40 shadow-[inset_0_0_12px_rgba(16,185,129,0.05),0_0_15px_rgba(16,185,129,0.1)]",
      status === 'live' && "border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse",
      // Shrink outer margin/padding on intermediate resolutions
      shouldHideVs
        ? (isMobile ? "gap-[2px] px-[0.5] py-[1px]" : "gap-2 px-1 py-1 xl:gap-2 xl:px-2")
        : "gap-2 px-1 py-1 xl:gap-4 xl:px-2 xl:py-2",
      className
    )}>
      {/* Team 1 */}
      <div className={cn(
        "rounded-sm transition-opacity duration-300",
        !isTeam1Winner && status === 'done' && winner && "opacity-30 grayscale-[0.5]"
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
            size={isMobile ? "md" : "lg"}
            showTooltip={true}
            isWinner={isTeam1Winner}
          />
        </div>
      </div>

      {/* VS Divider - Hidden on tablets/smaller desktops because grid columns are constrained */}
      {!shouldHideVs && (
        <div className="hidden xl:flex justify-center items-center">
          <div className="font-light text-zinc-500 uppercase tracking-wider text-[10px]">
            vs
          </div>
        </div>
      )}

      {/* Team 2 */}
      <div className={cn(
        "rounded-sm transition-opacity duration-300",
        !isTeam2Winner && status === 'done' && winner && "opacity-30 grayscale-[0.5]"
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
            size={isMobile ? "md" : "lg"}
            showTooltip={true}
            isWinner={isTeam2Winner}
          />
        </div>
      </div>
    </div>
  )
}
