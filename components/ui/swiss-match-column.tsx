'use client'

import { SwissMatchCardWrapper } from './swiss-match-card-wrapper'
import { SwissMatchCardTeam } from './swiss-match-card'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

interface SwissMatchColumnProps {
  rounds: Array<{
    title: string
    teamPairs: Array<{
      team1: SwissMatchCardTeam | null
      team2: SwissMatchCardTeam | null
      status: 'live' | 'scheduled' | 'done'
      winner?: 'team1' | 'team2' | null
    }>
  }>
  className?: string
}

export function SwissMatchColumn({ 
  rounds,
  className 
}: SwissMatchColumnProps) {
  const isMobile = useIsMobile()
  
  return (
    <div className={cn(
      "w-full flex flex-col justify-evenly",
      isMobile ? "gap-[8px]" : "gap-[16px]",
      className
    )}>
      {rounds.map((round, index) => (
        <SwissMatchCardWrapper
          key={index}
          title={round.title}
          teamPairs={round.teamPairs}
        />
      ))}
      
      {/* Empty State */}
      {rounds.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-400">No rounds to display</p>
        </div>
      )}
    </div>
  )
}
