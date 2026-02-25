'use client'

import Image from 'next/image'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'

// Use a stable DDragon version - this rarely changes and avoids async fetch delays
const DDRAGON_VERSION = '15.23.1'

export interface TeamAvatarTeam {
  id: string
  name: string
  team_avatar?: number | string
}

interface TeamAvatarProps {
  team: TeamAvatarTeam | null
  isWinner?: boolean
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  className?: string
}

const sizeClasses = {
  xxs: 'w-4 h-4',
  xs: 'w-5 h-5',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10'
}

const iconSizes = {
  xxs: 'h-1 w-1',
  xs: 'h-1.5 w-1.5',
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5'
}

// Synchronous URL generation - no async delay
export function getTeamAvatarUrl(avatarId?: number | string): string | null {
  if (!avatarId) return null
  if (typeof avatarId === 'string' && avatarId.startsWith('http')) return avatarId
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${avatarId}.png`
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

  // Use proportionally smaller sizes on mobile
  const actualSize = isMobile
    ? (size === 'lg' ? 'sm' : size === 'md' ? 'xs' : 'xxs')
    : size

  const sizeClass = sizeClasses[actualSize]
  const iconSize = iconSizes[actualSize]

  // Generate URL synchronously - no async delay
  const avatarUrl = getTeamAvatarUrl(team?.team_avatar)

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
        <Users className={cn("text-zinc-600", iconSize)} />
      </div>
    )
  }

  return (
    <div className="group relative shrink-0">
      <div className={cn(
        "rounded-full overflow-hidden shadow-lg transition-all duration-200 shrink-0",
        sizeClass,
        isWinner
          ? "ring-2 ring-green-500/60 shadow-[0_0_14px_rgba(34,197,94,0.45),0_0_28px_rgba(34,197,94,0.15)]"
          : "border-[1px] border-transparent hover:border-zinc-600",
        className
      )}>
        {avatarUrl && !imageError ? (
          <Image
            src={avatarUrl}
            alt={team.name}
            width={48}
            height={48}
            className="w-full h-full object-cover"
            onError={handleImageError}
            unoptimized={process.env.NODE_ENV === 'development'}
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <Users className={cn("text-zinc-400", iconSize)} />
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
