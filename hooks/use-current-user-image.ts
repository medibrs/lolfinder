import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export const useCurrentUserImage = () => {
  const [image, setImage] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Initial fetch
    const fetchUserImage = async () => {
      const { data } = await supabase.auth.getSession()
      setImage(data.session?.user.user_metadata.avatar_url ?? null)
    }
    fetchUserImage()

    // Listen to live auth changes (login/logout/delete)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          setImage(null)
        } else {
          setImage(session.user.user_metadata.avatar_url ?? null)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return image
}
