'use client'

import { TeamAvatar } from './team-avatar'
import { SwissMatchCardTeam } from './swiss-match-card'
import { TitleCard } from './title-card'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useRouter } from 'next/navigation'

export type { SwissMatchCardTeam as TopCutTeamGridTeam }

interface TopCutTeamGridProps {
  /** Teams for single-section layout */
  teams?: SwissMatchCardTeam[]
  /** Teams for left column in dual-section layout */
  leftTeams?: SwissMatchCardTeam[]
  /** Teams for right column in dual-section layout */
  rightTeams?: SwissMatchCardTeam[]
  /** Title for single-section layout */
  title?: string
  /** Title for left column */
  leftTitle?: string
  /** Title for right column */
  rightTitle?: string
  /** Background color variant */
  backgroundColor?: 'green' | 'red' | 'default'
  className?: string
}

export function TopCutTeamGrid({
  teams,
  leftTeams,
  rightTeams,
  title,
  leftTitle,
  rightTitle,
  backgroundColor = 'default',
  className
}: TopCutTeamGridProps) {
  const isMobile = useIsMobile()
  const router = useRouter()

  const handleTeamClick = (team: SwissMatchCardTeam) => {
    if (!team.id.startsWith('ph-')) {
      router.push(`/teams/${team.id}`)
    }
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

  const renderTeamAvatar = (team: SwissMatchCardTeam, index: number) => (
    <div
      key={`${team.id}-${index}`}
      className={cn(
        "cursor-pointer transition-transform hover:scale-105",
        team.id.startsWith('ph-') && "cursor-default"
      )}
      onClick={() => handleTeamClick(team)}
    >
      <TeamAvatar
        team={team}
        size={isMobile ? "md" : "lg"}
        showTooltip={true}
      />
    </div>
  )

  const renderTeamColumn = (teamList: SwissMatchCardTeam[], columnTitle?: string, forceHorizontal?: boolean) => {
    // Use horizontal layout for small team counts (2 or less) or when forced
    const useHorizontal = forceHorizontal || teamList.length <= 2

    return (
      <div className="flex flex-col">
        {columnTitle && <TitleCard title={columnTitle} />}
        <div className={cn(
          "relative transition-all duration-200 rounded-md border",
          getBackgroundClass(),
          isMobile ? "px-[2px] py-[2px]" : "px-2 py-2"
        )}>
          <div className={cn(
            "flex items-center",
            useHorizontal ? "flex-row justify-around" : "flex-col justify-center",
            isMobile ? "gap-[2px]" : "gap-2"
          )}>
            {teamList.map((team, idx) => (
              <div key={`${team.id}-${idx}`} className={cn(
                "flex justify-center rounded-sm border-2 border-transparent",
                "cursor-pointer transition-transform hover:scale-105",
                team.id.startsWith('ph-') && "cursor-default"
              )}>
                <div onClick={() => handleTeamClick(team)}>
                  <TeamAvatar
                    team={team}
                    size={isMobile ? "md" : "lg"}
                    showTooltip={true}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Single section layout
  if (teams && !leftTeams && !rightTeams) {
    return (
      <div className={cn(className)}>
        {renderTeamColumn(teams, title)}
      </div>
    )
  }

  // Dual section layout (left and right teams)
  const displayLeftTeams = leftTeams || []
  const displayRightTeams = rightTeams || []

  return (
    <div className={cn(
      "w-full",
      className
    )}>
      <div className={cn(
        "flex flex-row",
        isMobile ? "gap-0" : "gap-0"
      )}>
        {/* Left Section */}
        <div className={cn(
          "flex-1 border-r border-inherit"
        )}>
          {renderTeamColumn(displayLeftTeams, leftTitle)}
        </div>

        {/* Right Section */}
        <div className="flex-1">
          {renderTeamColumn(displayRightTeams, rightTitle)}
        </div>
      </div>
    </div>
  )
}
