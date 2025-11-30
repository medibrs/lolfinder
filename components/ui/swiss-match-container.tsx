'use client'

import { SwissMatchColumn } from './swiss-match-column'
import { SwissMatchCardTeam } from './swiss-match-card'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

interface SwissRound {
  title: string
  type?: 'matches' | 'topcut'
  isLastRound?: boolean
  teamPairs?: Array<{
    team1: SwissMatchCardTeam | null
    team2: SwissMatchCardTeam | null
    status: 'live' | 'scheduled' | 'done'
    winner?: 'team1' | 'team2' | null
  }>
  matches?: Array<{
    team1: SwissMatchCardTeam | null
    team2: SwissMatchCardTeam | null
    status: 'live' | 'scheduled' | 'done'
    winner?: 'team1' | 'team2' | null
  }>
  topCut?: {
    title?: string
    teams?: SwissMatchCardTeam[]
    leftTeams?: SwissMatchCardTeam[]
    rightTeams?: SwissMatchCardTeam[]
    leftTitle?: string
    rightTitle?: string
    backgroundColor?: 'green' | 'red' | 'default'
  }
}

interface SwissMatchContainerProps {
  columns: Array<{
    rounds: SwissRound[]
  }>
  className?: string
}

export function SwissMatchContainer({ 
  columns,
  className 
}: SwissMatchContainerProps) {
  const isMobile = useIsMobile()
  
  return (
    <div className={cn(
      "w-full overflow-hidden",
      className
    )}>
      <div className={cn(
        "flex items-stretch",
        isMobile ? "gap-0.5 p-1" : "gap-1 p-4"
      )}>
        {columns.map((column, index) => (
          <SwissMatchColumn
            key={index}
            rounds={column.rounds}
            isLastColumn={index === columns.length - 1}
          />
        ))}
        
        {/* Empty State */}
        {columns.length === 0 && (
          <div className="text-center py-12 w-full">
            <p className="text-zinc-400">No columns to display</p>
          </div>
        )}
      </div>
    </div>
  )
}
