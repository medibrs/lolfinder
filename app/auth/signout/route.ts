import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Signout error:', error)
      // Still redirect even if signout fails to avoid user being stuck
    }

    return NextResponse.redirect(new URL('/auth', request.url))
  } catch (error) {
    console.error('Signout route error:', error)
    // Always redirect to avoid 500 errors
    return NextResponse.redirect(new URL('/auth', request.url))
  }
}
