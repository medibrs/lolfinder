'use client'

import Image from 'next/image'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getProfileIconUrl } from '@/lib/ddragon'
import { useState, useEffect } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'

export interface TeamAvatarTeam {
  id: string
  name: string
  team_avatar?: number
}

interface TeamAvatarProps {
  team: TeamAvatarTeam | null
  isWinner?: boolean
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  className?: string
}

const sizeClasses = {
  xxs: 'w-3 h-3',
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-9 h-9'
}

const iconSizes = {
  xxs: 'h-1 w-1',
  xs: 'h-1.5 w-1.5',
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
  const isMobile = useIsMobile()
  const [imageError, setImageError] = useState(false)
  
  // Use smaller sizes on mobile
  const actualSize = isMobile ? 'xxs' : size
  
  const sizeClass = sizeClasses[actualSize]
  const iconSize = iconSizes[actualSize]
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (team?.team_avatar) {
      getTeamAvatarUrl(team.team_avatar).then(setAvatarUrl)
    }
  }, [team?.team_avatar])

  const handleImageError = () => {
    setImageError(true)
  }

  if (!team) {
    return (
      <div className={cn(
        "rounded-full bg-zinc-800 flex items-center justify-center shadow-lg shrink-0",
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
        "rounded-full overflow-hidden shadow-lg transition-all duration-200 shrink-0",
        sizeClass,
        isWinner 
          ? "border-[1px] border-green-500 shadow-green-500/5" 
          : "border-[1px] border-transparent hover:border-zinc-600",
        className
      )}>
        {team.team_avatar && avatarUrl && !imageError ? (
          <Image
            src={avatarUrl}
            alt={team.name}
            width={48}
            height={48}
            className="w-full h-full object-cover"
            onError={handleImageError}
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
