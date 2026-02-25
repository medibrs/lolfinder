'use client'

import { SwissMatchCard, SwissMatchCardTeam } from './swiss-match-card'
import { MatchGroupArrows, BracketArrow } from './bracket-arrows'
import { TitleCard } from './title-card'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

interface SwissMatchCardWrapperProps {
  title: string
  teamPairs?: Array<{
    team1: SwissMatchCardTeam | null
    team2: SwissMatchCardTeam | null
    status: 'live' | 'scheduled' | 'done'
    winner?: 'team1' | 'team2' | null
  }>
  /** Arrow style: 'curved' for normal progression (right side), 'straight' for last round (top/bottom), 'none' for no arrows */
  arrowStyle?: 'curved' | 'straight' | 'none'
  className?: string
  children?: React.ReactNode
}

export function SwissMatchCardWrapper({
  title,
  teamPairs,
  arrowStyle = 'none',
  children,
  className
}: SwissMatchCardWrapperProps) {
  const isMobile = useIsMobile()

  // For straight arrows (last round), we need a different layout
  // Arrows come from top and bottom, not from the right
  if (arrowStyle === 'straight') {
    return (
      <div className={cn("flex flex-col items-center", className)}>
        {/* Top arrow - pointing up to winners */}
        <div className={cn("flex justify-center", isMobile ? "mb-1" : "mb-2")}>
          <BracketArrow direction={270} color="zinc" size="md" glowIntensity={1} />
        </div>

        {/* Match Group Content */}
        <div className="flex flex-col w-full">
          {/* Title */}
          <TitleCard title={title} />

          {/* Content */}
          {children ? (
            children
          ) : (
            <div className={cn(
              "flex flex-col",
              isMobile ? "gap-[4px]" : "gap-3"
            )}>
              {teamPairs?.map((pair, index) => (
                <div key={index}>
                  <SwissMatchCard
                    team1={pair.team1}
                    team2={pair.team2}
                    status={pair.status}
                    winner={pair.winner}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom arrow - pointing down to losers */}
        <div className={cn("flex justify-center", isMobile ? "mt-1" : "mt-2")}>
          <BracketArrow direction={90} color="zinc" size="md" glowIntensity={1} />
        </div>
      </div>
    )
  }

  // Normal layout - arrows on the right side
  return (
    <div className={cn("flex items-stretch", className)}>
      {/* Match Group Content */}
      <div className="flex flex-col flex-1">
        {/* Title */}
        <TitleCard title={title} />

        {/* Content */}
        {children ? (
          children
        ) : (
          <div className={cn(
            "flex flex-col",
            isMobile ? "gap-[4px]" : "gap-3"
          )}>
            {teamPairs?.map((pair, index) => (
              <div key={index}>
                <SwissMatchCard
                  team1={pair.team1}
                  team2={pair.team2}
                  status={pair.status}
                  winner={pair.winner}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Curved arrows on the right side */}
      {arrowStyle === 'curved' && (
        <MatchGroupArrows />
      )}
    </div>
  )
}
