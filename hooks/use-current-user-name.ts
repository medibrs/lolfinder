import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export const useCurrentUserName = () => {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const fetchProfileName = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setName('?')
          return
        }

        const { data: playerData } = await supabase
          .from('players')
          .select('summoner_name')
          .eq('id', user.id)
          .single()

        setName(playerData?.summoner_name ?? 'Player')
      } catch (error) {
        setName('?')
      }
    }

    fetchProfileName()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          setName('?')
        } else {
          fetchProfileName()
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return name || '?'
}
