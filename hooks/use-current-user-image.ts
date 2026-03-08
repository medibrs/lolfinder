import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DDRAGON_VERSION } from '@/lib/ddragon'

/**
 * Returns the current user's profile icon URL from the players table (Riot DDragon).
 * Does NOT read from user_metadata to avoid storing/displaying 42 OAuth PII.
 */
export const useCurrentUserImage = () => {
  const [image, setImage] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const fetchProfileIcon = async (userId: string) => {
      const { data: playerData } = await supabase
        .from('players')
        .select('profile_icon_id')
        .eq('id', userId)
        .single()

      if (playerData?.profile_icon_id) {
        setImage(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${playerData.profile_icon_id}.png`)
      } else {
        setImage(null)
      }
    }

    // Initial fetch
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        fetchProfileIcon(user.id)
      }
    }
    init()

    // Listen to live auth changes (login/logout/delete)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          setImage(null)
        } else {
          fetchProfileIcon(session.user.id)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return image
}
