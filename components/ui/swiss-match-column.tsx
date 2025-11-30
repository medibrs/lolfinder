'use client'

import { SwissMatchCardWrapper } from './swiss-match-card-wrapper'
import { SwissMatchCardTeam } from './swiss-match-card'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { SwissMatchCard } from './swiss-match-card'
import { TopCutCard, TopCutCardTeam } from './top-cut-card'

interface SwissRound {
  title: string
  type?: 'matches' | 'topcut'
  /** Flag from data indicating this is the last round before topcut */
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
    teams?: TopCutCardTeam[]
    leftTeams?: TopCutCardTeam[]
    rightTeams?: TopCutCardTeam[]
    leftTitle?: string
    rightTitle?: string
    backgroundColor?: 'green' | 'red' | 'default'
  }
}

interface SwissMatchColumnProps {
  rounds: SwissRound[]
  isLastColumn?: boolean
  className?: string
}

export function SwissMatchColumn({ 
  rounds,
  isLastColumn = false,
  className 
}: SwissMatchColumnProps) {
  const isMobile = useIsMobile()
  
  return (
    <div className={cn(
      "w-full flex flex-col justify-evenly",
      isMobile ? "gap-[16px]" : "gap-[32px]",
      className
    )}>
      {rounds.map((round, index) => {
        // Determine arrow style based on round data
        let arrowStyle: 'curved' | 'straight' | 'none' = 'none'
        
        if (round.type !== 'topcut') {
          if (round.isLastRound) {
            arrowStyle = 'straight'
          } else if (!isLastColumn) {
            arrowStyle = 'curved'
          }
        }
        
        return round.type === 'topcut' ? (
          <SwissMatchCardWrapper
            key={index}
            title={round.title}
            arrowStyle="none"
          >
            <TopCutCard 
              layout={round.topCut?.leftTeams || round.topCut?.rightTeams ? 'versus' : 'single'}
              {...round.topCut}
            />
          </SwissMatchCardWrapper>
        ) : (
          <SwissMatchCardWrapper
            key={index}
            title={round.title}
            teamPairs={round.teamPairs || round.matches || []}
            arrowStyle={arrowStyle}
          />
        )
      })}
      
      {/* Empty State */}
      {rounds.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-400">No rounds to display</p>
        </div>
      )}
    </div>
  )
}
