'use client'

import { cn } from '@/lib/utils'
import { TeamAvatar, TeamAvatarTeam } from './team-avatar'

interface BracketZoneProps {
  variant: 'qualified' | 'eliminated'
  title?: string
  labels?: string[]
  teams?: (TeamAvatarTeam | null)[]
  className?: string
}

export function BracketZone({ 
  variant, 
  title,
  labels = [],
  teams = [],
  className 
}: BracketZoneProps) {
  const isQualified = variant === 'qualified'
  
  const defaultTitle = isQualified ? 'Qualified' : 'Eliminated'
  const displayTitle = title || defaultTitle

  return (
    <div className={cn(
      "rounded-xl p-4",
      isQualified 
        ? "bg-green-950/30 border border-green-500/20" 
        : "bg-red-950/20 border border-red-500/20",
      className
    )}>
      {/* Header with labels */}
      <div className={cn(
        "flex justify-between font-bold text-xs mb-4 px-2",
        isQualified ? "text-green-500" : "text-red-500"
      )}>
        {labels.length > 0 ? (
          labels.map((label, idx) => (
            <span key={idx}>{label}</span>
          ))
        ) : (
          <span>{displayTitle}</span>
        )}
      </div>
      
      {/* Teams grid */}
      <div className="flex flex-wrap gap-2">
        {teams.length > 0 ? (
          teams.map((team, idx) => (
            <TeamAvatar key={team?.id || idx} team={team} />
          ))
        ) : (
          // Placeholder when no teams
          <TeamAvatar team={null} />
        )}
      </div>
    </div>
  )
}
