'use client'

import { SwissMatchCard, SwissMatchCardTeam } from './swiss-match-card'
import { cn } from '@/lib/utils'

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
  return (
    <div className={cn("w-full", className)}>
      {/* Title */}
      <div className="mb-1">
        <h2 className="text-[12px] font-[700] text-left text-white uppercase mb-2">{title}</h2>
      </div>

      {/* Matches - Single Column */}
      <div className="space-y-4">
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
