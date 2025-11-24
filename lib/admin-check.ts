import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createAdminClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
}

export async function isAdmin(user: any): Promise<boolean> {
  return user?.app_metadata?.role === 'admin' || user?.raw_app_meta_data?.role === 'admin'
}

export async function getCurrentAdminUser() {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }
  
  // Temporary bypass - remove this after setting up proper admin role
  if (user.email === 'tiznit.sos@gmail.com') {
    return user
  }
  
  if (!(await isAdmin(user))) {
    return null
  }
  
  return user
}
