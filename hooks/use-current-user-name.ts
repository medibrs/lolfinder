import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export const useCurrentUserName = () => {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfileName = async () => {
      try {
        const supabase = createClient()
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setName('?')
          return
        }

        // Get summoner name from player profile (never expose real names)
        const { data: playerData } = await supabase
          .from('players')
          .select('summoner_name')
          .eq('id', user.id)
          .single()

        setName(playerData?.summoner_name ?? 'Player')
      } catch (error) {
        console.error('Error fetching user name:', error)
        setName('?')
      }
    }

    fetchProfileName()
  }, [])

  return name || '?'
}
