'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CreatePlayerPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to setup-profile since profile creation is now handled there
    router.replace('/setup-profile')
  }, [router])

  return (
    <div className="min-h-screen pt-20 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting to profile setup...</p>
      </div>
    </div>
  )
}
