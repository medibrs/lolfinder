'use client'

import { TeamAvatar, TeamAvatarTeam } from './team-avatar'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import { getMatchPath } from '@/lib/slugs'

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
  matchId?: string
  matchContextName?: string
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
  matchId,
  matchContextName,
  hideVs = false,
  backgroundColor = 'default',
  className
}: SwissMatchCardProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const isTeam1Winner = winner === 'team1'
  const isTeam2Winner = winner === 'team2'

  const isTbd = (t: SwissMatchCardTeam | null) =>
    !t || t.name === 'TBD' || t.id.startsWith('tbd') || t.id.startsWith('ph')

  const bothTbd = isTbd(team1) && isTbd(team2)

  const handleTeamClick = (team: SwissMatchCardTeam | null) => {
    if (bothTbd) return

    if (matchId) {
      router.push(getMatchPath({
        id: matchId,
        team1Name: team1?.name,
        team2Name: team2?.name,
        contextName: matchContextName,
      }))
      return
    }

    if (team && !isTbd(team)) {
      router.push(`/teams/${team.id}`)
    }
  }

  const handleCardClick = () => {
    if (!matchId || bothTbd) return
    router.push(getMatchPath({
      id: matchId,
      team1Name: team1?.name,
      team2Name: team2?.name,
      contextName: matchContextName,
    }))
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

  // Only hide VS when explicitly requested via prop
  const shouldHideVs = hideVs

  return (
    <div className={cn(
      "relative transition-all duration-300 flex items-center justify-center rounded-lg mx-auto w-full",
      // Glassmorphic Hextech treatment
      "bg-slate-900/60 backdrop-blur-md border border-slate-700/50 shadow-xl",
      // Flex constraints: fill available space, scale up with screen
      isMobile ? "max-w-[72px]" : "max-w-[160px] xl:max-w-[180px] 2xl:max-w-[200px]",
      // States
      status === 'done' && winner && "border-emerald-500/40 shadow-[inset_0_0_12px_rgba(16,185,129,0.05),0_0_15px_rgba(16,185,129,0.1)]",
      status === 'live' && "border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse",
      // Shrink outer margin/padding on intermediate resolutions
      isMobile
        ? "gap-[2px] px-1.5 py-1"
        : "gap-2 px-2 py-1.5 xl:gap-3 xl:px-3 xl:py-2",
      matchId && !bothTbd && "cursor-pointer hover:border-cyan-400/50",
      className
    )}
      onClick={handleCardClick}
    >
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
            size={isMobile ? "sm" : "lg"}
            showTooltip={true}
            isWinner={isTeam1Winner}
          />
        </div>
      </div>

      {/* VS Divider */}
      {!shouldHideVs && (
        <div className="flex justify-center items-center">
          <div className={cn(
            "font-light text-zinc-500 uppercase tracking-wider",
            isMobile ? "text-[7px]" : "text-[10px]"
          )}>
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
            size={isMobile ? "sm" : "lg"}
            showTooltip={true}
            isWinner={isTeam2Winner}
          />
        </div>
      </div>
    </div>
  )
}
