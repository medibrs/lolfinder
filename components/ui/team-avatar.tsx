'use client'

import Image from 'next/image'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getProfileIconUrl } from '@/lib/ddragon'
import { useState, useEffect } from 'react'

export interface TeamAvatarTeam {
  id: string
  name: string
  team_avatar?: number
}

interface TeamAvatarProps {
  team: TeamAvatarTeam | null
  isWinner?: boolean
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-12 h-12'
}

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5'
}

export async function getTeamAvatarUrl(avatarId?: number) {
  if (!avatarId) return null
  return await getProfileIconUrl(avatarId)
}

export function TeamAvatar({ 
  team, 
  isWinner, 
  size = 'md',
  showTooltip = true,
  className 
}: TeamAvatarProps) {
  const sizeClass = sizeClasses[size]
  const iconSize = iconSizes[size]
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (team?.team_avatar) {
      getTeamAvatarUrl(team.team_avatar).then(setAvatarUrl)
    }
  }, [team?.team_avatar])

  if (!team) {
    return (
      <div className={cn(
        "rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-lg shrink-0",
        sizeClass,
        className
      )}>
        <Shield className={cn("text-zinc-600", iconSize)} />
      </div>
    )
  }

  return (
    <div className="group relative shrink-0">
      <div className={cn(
        "rounded-full overflow-hidden border-2 shadow-lg transition-all duration-200",
        sizeClass,
        isWinner 
          ? "border-green-700 shadow-green-700/20" 
          : "border-zinc-700 hover:border-zinc-500",
        className
      )}>
        {team.team_avatar && avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={team.name}
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <Shield className={cn("text-zinc-400", iconSize)} />
          </div>
        )}
      </div>
      
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none border border-zinc-800">
          {team?.name || 'TBD'}
        </div>
      )}
    </div>
  )
}
