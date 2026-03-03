'use client'

import Link from 'next/link'
import { User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'

interface ProfileSetupBannerProps {
  description?: string
  className?: string
}

export default function ProfileSetupBanner({
  description = 'Unlock invitations and team recruitment tools.',
  className = '',
}: ProfileSetupBannerProps) {
  const isMobile = useIsMobile()

  return (
    <div className={`${isMobile ? 'p-2' : 'p-6'} bg-slate-900/60 backdrop-blur-md border border-cyan-500/30 rounded-xl relative overflow-hidden group ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none"></div>
      <div className={`flex flex-row items-center justify-between ${isMobile ? 'gap-2' : 'gap-6'} relative z-10`}>
        <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-4'} min-w-0`}>
          <div className={`${isMobile ? 'w-7 h-7' : 'w-12 h-12'} bg-cyan-500/10 rounded-full flex items-center justify-center border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-all flex-shrink-0`}>
            <User className={`${isMobile ? 'w-3 h-3' : 'w-6 h-6'} text-cyan-400`} />
          </div>
          <div className="min-w-0">
            <h3 className={`${isMobile ? 'text-xs font-bold' : 'text-xl font-bold'} text-white font-beaufort tracking-wide leading-tight`}>
              Complete Your Profile
            </h3>
            <p className={`text-slate-400 ${isMobile ? 'text-[10px] leading-tight' : 'text-sm'} truncate`}>{description}</p>
          </div>
        </div>
        <Button
          asChild
          className={`bg-cyan-600 hover:bg-cyan-500 text-white font-bold ${isMobile ? 'px-2.5 py-1.5 text-[10px] h-auto' : 'px-8 py-6'} rounded-lg shadow-[0_0_15px_rgba(8,145,178,0.3)] transition-all whitespace-nowrap flex-shrink-0`}
        >
          <Link href="/setup-profile">{isMobile ? 'Setup' : 'Set Up Profile Now'}</Link>
        </Button>
      </div>
    </div>
  )
}
