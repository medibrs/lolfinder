'use client'

import { cn } from '@/lib/utils'
import { TeamAvatar, TeamAvatarTeam } from './team-avatar'

export interface MatchData {
  id: string
  team1?: TeamAvatarTeam | null
  team2?: TeamAvatarTeam | null
  team1_score?: number
  team2_score?: number
  winner_id?: string
  status?: 'Scheduled' | 'In_Progress' | 'Completed'
}

interface MatchCardProps {
  match: MatchData
  variant?: 'default' | 'compact' | 'wide'
  showScore?: boolean
  className?: string
}

const variantClasses = {
  default: 'w-[160px] h-[60px] p-2',
  compact: 'w-[140px] h-[50px] p-1.5',
  wide: 'w-[200px] h-[70px] p-3'
}

export function MatchCard({ 
  match, 
  variant = 'default',
  showScore = true,
  className 
}: MatchCardProps) {
  const isCompleted = match.status === 'Completed'
  const team1Winner = isCompleted && match.winner_id === match.team1?.id
  const team2Winner = isCompleted && match.winner_id === match.team2?.id

  return (
    <div className={cn(
      "flex items-center justify-between gap-2 bg-[#22252a] rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition-colors",
      variantClasses[variant],
      className
    )}>
      <TeamAvatar 
        team={match.team1 || null} 
        isWinner={team1Winner}
        size={variant === 'compact' ? 'sm' : 'md'}
      />
      
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <span className="text-[10px] font-bold text-zinc-600">VS</span>
        {showScore && isCompleted && (
          <span className="text-xs font-mono font-bold text-zinc-300 bg-black/20 px-1.5 rounded">
            {match.team1_score ?? 0}:{match.team2_score ?? 0}
          </span>
        )}
      </div>

      <TeamAvatar 
        team={match.team2 || null} 
        isWinner={team2Winner}
        size={variant === 'compact' ? 'sm' : 'md'}
      />
    </div>
  )
}
