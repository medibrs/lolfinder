'use client'

import { SwissMatchCard, SwissMatchCardTeam } from './swiss-match-card'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

interface SwissMatchCardWrapperProps {
  title: string
  teamPairs: Array<{
    team1: SwissMatchCardTeam | null
    team2: SwissMatchCardTeam | null
    status: 'live' | 'scheduled' | 'done'
    winner?: 'team1' | 'team2' | null
  }>
  className?: string
}

export function SwissMatchCardWrapper({ 
  title, 
  teamPairs,
  className 
}: SwissMatchCardWrapperProps) {
  const isMobile = useIsMobile()
  
  return (
    <div className={cn("w-full flex flex-col", className)}>
      {/* Title */}
      <div className={cn("mb-1", isMobile ? "mb-0" : "")}>
        <h2 className={cn(
          "text-left text-white uppercase",
          isMobile ? "text-[8px] font-[600]" : "text-[12px] font-[700]"
        )}>{title}</h2>
      </div>

      {/* Matches - Single Column */}
      <div className={cn(
        "flex flex-col",
        isMobile ? "gap-[1px]" : "gap-2"
      )}>
        {teamPairs.map((pair, index) => (
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

      {/* Empty State */}
      {teamPairs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-400">No matches to display</p>
        </div>
      )}
    </div>
  )
}
