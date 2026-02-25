'use client'

import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

// Preset colors for convenience
export const arrowColors = {
  green: '#22c55e',
  red: '#ef4444',
  blue: '#3b82f6',
  yellow: '#eab308',
  purple: '#a855f7',
  orange: '#f97316',
  cyan: '#06b6d4',
  pink: '#ec4899',
  white: '#ffffff',
  zinc: '#71717a',
} as const

type PresetColor = keyof typeof arrowColors

interface BracketArrowProps {
  /** Direction in degrees (0 = right, 90 = down, 180 = left, 270 = up) */
  direction?: number
  /** Arrow style - straight or curved */
  style?: 'straight' | 'curved'
  /** Color - can be a preset name or any valid CSS color */
  color?: PresetColor | string
  /** Size multiplier */
  size?: 'sm' | 'md' | 'lg'
  /** Glow intensity (0 = none, 1 = subtle, 2 = medium, 3 = strong) */
  glowIntensity?: 0 | 1 | 2 | 3
  className?: string
}

export function BracketArrow({
  direction = 0,
  style = 'straight',
  color = 'white',
  size = 'md',
  glowIntensity = 1,
  className
}: BracketArrowProps) {
  const isMobile = useIsMobile()

  // Resolve color
  const resolvedColor = color in arrowColors
    ? arrowColors[color as PresetColor]
    : color

  // Size classes - smaller on mobile
  const sizeClasses = {
    sm: isMobile ? 'w-3 h-2' : 'w-6 h-4',
    md: isMobile ? 'w-4 h-3' : 'w-10 h-6',
    lg: isMobile ? 'w-5 h-4' : 'w-14 h-8',
  }

  // Glow filter
  const glowFilters = {
    0: 'none',
    1: `drop-shadow(0 0 2px ${resolvedColor}40)`,
    2: `drop-shadow(0 0 4px ${resolvedColor}60)`,
    3: `drop-shadow(0 0 6px ${resolvedColor}80)`,
  }

  // Generate unique ID for gradient
  const gradientId = `arrow-gradient-${Math.random().toString(36).substr(2, 9)}`

  // Path for the arrow line - shorter on mobile
  const linePath = style === 'curved'
    ? (isMobile ? 'M8 12 L 24 12' : 'M4 12 Q 16 12, 20 12 Q 24 12, 32 12')
    : (isMobile ? 'M8 12 L 24 12' : 'M4 12 L 32 12')

  // Arrow head path - adjusted for mobile
  const arrowHeadPath = isMobile ? 'M20 9 L 26 12 L 20 15' : 'M28 8 L 36 12 L 28 16'

  return (
    <svg
      viewBox="0 0 40 24"
      className={cn(
        "transition-all duration-300",
        sizeClasses[size],
        className
      )}
      style={{
        filter: glowFilters[glowIntensity],
        transform: `rotate(${direction}deg)`,
      }}
    >
      <path
        d={linePath}
        fill="none"
        stroke={resolvedColor}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={arrowHeadPath}
        fill="none"
        stroke={resolvedColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Curved arrow with specific curve direction
interface CurvedBracketArrowProps {
  /** Curve direction - up curves upward, down curves downward */
  curve: 'up' | 'down'
  /** Color - can be a preset name or any valid CSS color */
  color?: PresetColor | string
  /** Size multiplier */
  size?: 'sm' | 'md' | 'lg'
  /** Glow intensity (0 = none, 1 = subtle, 2 = medium, 3 = strong) */
  glowIntensity?: 0 | 1 | 2 | 3
  className?: string
}

export function CurvedBracketArrow({
  curve,
  color = 'white',
  size = 'md',
  glowIntensity = 2,
  className
}: CurvedBracketArrowProps) {
  const isMobile = useIsMobile()

  // Resolve color
  const resolvedColor = color in arrowColors
    ? arrowColors[color as PresetColor]
    : color

  // Size classes - smaller on mobile
  const sizeClasses = {
    sm: isMobile ? 'w-3 h-2' : 'w-8 h-4',
    md: isMobile ? 'w-4 h-3' : 'w-10 h-5',
    lg: isMobile ? 'w-5 h-4' : 'w-14 h-7',
  }

  // Glow filter
  const glowFilters = {
    0: 'none',
    1: `drop-shadow(0 0 2px ${resolvedColor}40)`,
    2: `drop-shadow(0 0 4px ${resolvedColor}60)`,
    3: `drop-shadow(0 0 6px ${resolvedColor}80)`,
  }

  // Generate unique ID for gradient
  const gradientId = `curved-arrow-gradient-${Math.random().toString(36).substr(2, 9)}`

  // Curved paths - shorter on mobile
  const curvePath = curve === 'up'
    ? (isMobile ? 'M4 14 Q 12 14, 16 10 Q 20 6, 24 6' : 'M0 16 Q 15 16, 20 10 Q 25 4, 32 4')
    : (isMobile ? 'M4 6 Q 12 6, 16 10 Q 20 14, 24 14' : 'M0 4 Q 15 4, 20 10 Q 25 16, 32 16')

  const arrowY = curve === 'up' ? (isMobile ? 6 : 4) : (isMobile ? 14 : 16)
  const arrowHeadPath = isMobile
    ? `M20 ${arrowY - 3} L 26 ${arrowY} L 20 ${arrowY + 3}`
    : `M28 ${arrowY - 4} L 36 ${arrowY} L 28 ${arrowY + 4}`

  return (
    <svg
      viewBox="0 0 40 20"
      className={cn(
        "transition-all duration-300",
        sizeClasses[size],
        className
      )}
      style={{ filter: glowFilters[glowIntensity] }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={resolvedColor} stopOpacity="0.5" />
          <stop offset="100%" stopColor={resolvedColor} stopOpacity="1" />
        </linearGradient>
      </defs>
      <path
        d={curvePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={arrowHeadPath}
        fill="none"
        stroke={resolvedColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Match group arrows - shows both winner (up) and loser (down) arrows
interface MatchGroupArrowsProps {
  winnerColor?: PresetColor | string
  loserColor?: PresetColor | string
  size?: 'sm' | 'md' | 'lg'
  /** Use straight arrows pointing up/down instead of curved */
  straight?: boolean
  className?: string
}

export function MatchGroupArrows({
  winnerColor = 'zinc',
  loserColor = 'zinc',
  size = 'md',
  straight = false,
  className
}: MatchGroupArrowsProps) {
  const isMobile = useIsMobile()

  return (
    <div className={cn(
      "flex flex-col justify-between items-center h-full",
      isMobile ? "w-2.5 py-0" : "w-10 py-2",
      className
    )}>
      {straight ? (
        <>
          <BracketArrow direction={270} color={winnerColor} size={size} glowIntensity={2} />
          <BracketArrow direction={90} color={loserColor} size={size} glowIntensity={2} />
        </>
      ) : (
        <>
          <CurvedBracketArrow curve="up" color={winnerColor} size={size} />
          <CurvedBracketArrow curve="down" color={loserColor} size={size} />
        </>
      )}
    </div>
  )
}
