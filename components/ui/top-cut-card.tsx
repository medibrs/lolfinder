'use client'

import { TeamAvatar } from './team-avatar'
import { SwissMatchCard, SwissMatchCardTeam } from './swiss-match-card'
import { TitleCard } from './title-card'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useRouter } from 'next/navigation'

interface TopCutCardProps {
  teams?: SwissMatchCardTeam[]
  leftTeams?: SwissMatchCardTeam[]
  rightTeams?: SwissMatchCardTeam[]
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

  const handleTeamClick = (team: SwissMatchCardTeam) => {
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

  const renderTeamAvatar = (team: SwissMatchCardTeam) => (
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

  // Single layout - use SwissMatchCard for consistency
  if (layout === 'single') {
    const displayTeams = teams || []
    
    // Create pairs for SwissMatchCard (2 teams per card)
    const teamPairs: Array<{
      team1: SwissMatchCardTeam | null
      team2: SwissMatchCardTeam | null
      status: 'live' | 'scheduled' | 'done'
      winner?: 'team1' | 'team2' | null
    }> = []
    
    // Group teams into pairs
    for (let i = 0; i < displayTeams.length; i += 2) {
      teamPairs.push({
        team1: displayTeams[i] || null,
        team2: displayTeams[i + 1] || null,
        status: 'scheduled',
        winner: null
      })
    }
    
    return (
      <div className={cn(
        "relative transition-all duration-200 rounded-md",
        isMobile ? "px-[2px] py-[1px]" : "px-2 py-1",
        getBackgroundClass(),
        className
      )}>
        {title && <TitleCard title={title} />}
        <div className={cn(
          "flex flex-col",
          isMobile ? "gap-[4px]" : "gap-3"
        )}>
          {teamPairs.map((pair, index) => (
            <SwissMatchCard
              key={index}
              team1={pair.team1}
              team2={pair.team2}
              status={pair.status}
              winner={pair.winner}
              hideVs={true}
              backgroundColor={backgroundColor}
            />
          ))}
        </div>
      </div>
    )
  }

  // Versus layout - two columns with SwissMatchCard
  const displayLeftTeams = leftTeams || []
  const displayRightTeams = rightTeams || []
  
  // Create pairs for left and right columns
  const leftPairs: Array<{
    team1: SwissMatchCardTeam | null
    team2: SwissMatchCardTeam | null
    status: 'live' | 'scheduled' | 'done'
    winner?: 'team1' | 'team2' | null
  }> = []
  
  const rightPairs: Array<{
    team1: SwissMatchCardTeam | null
    team2: SwissMatchCardTeam | null
    status: 'live' | 'scheduled' | 'done'
    winner?: 'team1' | 'team2' | null
  }> = []
  
  // Group left teams into pairs
  for (let i = 0; i < displayLeftTeams.length; i += 2) {
    leftPairs.push({
      team1: displayLeftTeams[i] || null,
      team2: displayLeftTeams[i + 1] || null,
      status: 'scheduled',
      winner: null
    })
  }
  
  // Group right teams into pairs
  for (let i = 0; i < displayRightTeams.length; i += 2) {
    rightPairs.push({
      team1: displayRightTeams[i] || null,
      team2: displayRightTeams[i + 1] || null,
      status: 'scheduled',
      winner: null
    })
  }

  return (
    <div className={cn(
      "relative transition-all duration-200 rounded-md",
      isMobile ? "px-[2px] py-[1px]" : "px-2 py-1",
      getBackgroundClass(),
      className
    )}>
      <div className={cn(
        isMobile ? "flex flex-col" : "grid grid-cols-2",
        isMobile ? "gap-1" : "gap-2"
      )}>
        {/* Left Column */}
        <div className="flex flex-col">
          {leftTitle && <TitleCard title={leftTitle} />}
          <div className={cn(
            "flex flex-col",
            isMobile ? "gap-[4px]" : "gap-3"
          )}>
            {leftPairs.map((pair, index) => (
              <SwissMatchCard
                key={index}
                team1={pair.team1}
                team2={pair.team2}
                status={pair.status}
                winner={pair.winner}
                hideVs={true}
                backgroundColor={backgroundColor}
              />
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col">
          {rightTitle && <TitleCard title={rightTitle} />}
          <div className={cn(
            "flex flex-col",
            isMobile ? "gap-[4px]" : "gap-3"
          )}>
            {rightPairs.map((pair, index) => (
              <SwissMatchCard
                key={index}
                team1={pair.team1}
                team2={pair.team2}
                status={pair.status}
                winner={pair.winner}
                hideVs={true}
                backgroundColor={backgroundColor}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
