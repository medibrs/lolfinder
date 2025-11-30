'use client'

import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

interface TitleCardProps {
  title: string
  className?: string
}

export function TitleCard({ title, className }: TitleCardProps) {
  const isMobile = useIsMobile()
  
  return (
    <div className={cn("mb-1", isMobile ? "mb-0" : "", className)}>
      <h2 className={cn(
        "text-left text-zinc-500 uppercase",
        isMobile ? "text-[8px] font-[500]" : "text-[12px] font-[600]"
      )}>{title}</h2>
    </div>
  )
}
