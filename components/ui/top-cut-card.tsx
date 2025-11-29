'use client'

import { TeamAvatar } from './team-avatar'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useRouter } from 'next/navigation'

export interface TopCutCardTeam {
  id: string
  name: string
  team_avatar?: number
}

interface TopCutCardProps {
  teams?: TopCutCardTeam[]
  leftTeams?: TopCutCardTeam[]
  rightTeams?: TopCutCardTeam[]
  title?: string
  leftTitle?: string
  rightTitle?: string
  layout?: 'single' | 'versus'
  backgroundColor?: 'green' | 'red' | 'default'
  className?: string
}

export function TopCutCard({ 
  teams,
  leftTeams,
  rightTeams,
  title,
  leftTitle,
  rightTitle,
  layout = 'single',
  backgroundColor = 'default',
  className 
}: TopCutCardProps) {
  const isMobile = useIsMobile()
  const router = useRouter()

  const handleTeamClick = (team: TopCutCardTeam) => {
    router.push(`/teams/${team.id}`)
  }

  const getBackgroundClass = () => {
    switch (backgroundColor) {
      case 'green':
        return 'bg-green-900/30 border-green-700'
      case 'red':
        return 'bg-red-900/30 border-red-700'
      default:
        return 'bg-zinc-900 border-zinc-700'
    }
  }

  const renderTeamAvatar = (team: TopCutCardTeam) => (
    <div 
      key={team.id}
      className="cursor-pointer"
      onClick={() => handleTeamClick(team)}
    >
      <TeamAvatar 
        team={team} 
        size="md"
        showTooltip={true}
      />
    </div>
  )

  // Single layout - horizontal for 2 teams, 2x2 grid for 4+
  if (layout === 'single') {
    const displayTeams = teams || []
    
    return (
      <div className={cn(
        "relative border transition-all duration-200",
        isMobile ? "px-[2px] py-[1px]" : "px-2 py-1",
        getBackgroundClass(),
        className
      )}>
        <div className={cn(
          displayTeams.length <= 2 
            ? "flex flex-row items-center justify-center" 
            : "grid grid-cols-2 place-items-center",
          isMobile ? "gap-1" : "gap-2"
        )}>
          {displayTeams.map(renderTeamAvatar)}
        </div>
      </div>
    )
  }

  // Versus layout - two columns with titles
  const displayLeftTeams = leftTeams || []
  const displayRightTeams = rightTeams || []

  return (
    <div className={cn(
      "relative border transition-all duration-200",
      isMobile ? "px-[2px] py-[1px]" : "px-2 py-1",
      getBackgroundClass(),
      className
    )}>
      <div className={cn(
        "grid grid-cols-2",
        isMobile ? "gap-1" : "gap-2"
      )}>
        {/* Left Column */}
        <div className="flex flex-col items-center">
          {leftTitle && (
            <div className={cn(
              "text-white font-bold mb-1",
              isMobile ? "text-[8px]" : "text-xs"
            )}>
              {leftTitle}
            </div>
          )}
          <div className={cn(
            "flex flex-col items-center",
            isMobile ? "gap-1" : "gap-2"
          )}>
            {displayLeftTeams.map(renderTeamAvatar)}
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col items-center">
          {rightTitle && (
            <div className={cn(
              "text-white font-bold mb-1",
              isMobile ? "text-[8px]" : "text-xs"
            )}>
              {rightTitle}
            </div>
          )}
          <div className={cn(
            "flex flex-col items-center",
            isMobile ? "gap-1" : "gap-2"
          )}>
            {displayRightTeams.map(renderTeamAvatar)}
          </div>
        </div>
      </div>
    </div>
  )
}
