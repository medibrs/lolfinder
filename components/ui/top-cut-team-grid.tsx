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

  // Split teams into two vertical columns
  const splitIntoColumns = (teamList: SwissMatchCardTeam[]) => {
    const midpoint = Math.ceil(teamList.length / 2)
    return {
      col1: teamList.slice(0, midpoint),
      col2: teamList.slice(midpoint)
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
        size={isMobile ? "sm" : "md"}
        showTooltip={true}
      />
    </div>
  )

  const renderTeamColumn = (teamList: SwissMatchCardTeam[], columnTitle?: string) => {
    const { col1, col2 } = splitIntoColumns(teamList)
    
    return (
      <div className="flex flex-col">
        {columnTitle && <TitleCard title={columnTitle} />}
        <div className={cn(
          "flex flex-row justify-center",
          isMobile ? "gap-1 p-1" : "gap-2 p-2"
        )}>
          {/* Left vertical column */}
          <div className={cn(
            "flex flex-col items-center",
            isMobile ? "gap-1" : "gap-2"
          )}>
            {col1.map((team, idx) => renderTeamAvatar(team, idx))}
          </div>
          {/* Right vertical column */}
          {col2.length > 0 && (
            <div className={cn(
              "flex flex-col items-center",
              isMobile ? "gap-1" : "gap-2"
            )}>
              {col2.map((team, idx) => renderTeamAvatar(team, idx + col1.length))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Single section layout
  if (teams && !leftTeams && !rightTeams) {
    return (
      <div className={cn(
        "relative transition-all duration-200 rounded-md border",
        getBackgroundClass(),
        className
      )}>
        {title && <TitleCard title={title} />}
        {renderTeamColumn(teams).props.children[1]}
      </div>
    )
  }

  // Dual section layout (left and right teams)
  const displayLeftTeams = leftTeams || []
  const displayRightTeams = rightTeams || []

  return (
    <div className={cn(
      "relative transition-all duration-200 rounded-md border w-full",
      getBackgroundClass(),
      className
    )}>
      <div className={cn(
        isMobile ? "flex flex-col" : "flex flex-row",
        isMobile ? "gap-0" : "gap-0"
      )}>
        {/* Left Section */}
        <div className={cn(
          "flex-1",
          !isMobile && "border-r border-inherit"
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
