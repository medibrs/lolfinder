import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // the line above, as it could accidentally interfere with the refresh process

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes that require authentication
  const protectedRoutes = ['/setup-profile', '/admin']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // If accessing protected route without user, redirect to auth
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    url.searchParams.set('redirectedFrom', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Special handling for auth routes when user is already authenticated
  const authRoutes = ['/auth']
  const isAuthRoute = authRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  ) && !request.nextUrl.pathname.startsWith('/auth/signout') && !request.nextUrl.pathname.startsWith('/auth/callback')

  if (isAuthRoute && user) {
    // Check if user has a profile
    const { data: playerProfile } = await supabase
      .from('players')
      .select('*')
      .eq('id', user.id)
      .single()

    const url = request.nextUrl.clone()
    
    // Redirect based on profile existence
    if (playerProfile) {
      // User has established profile, check if they have a team
      const { data: playerWithTeam } = await supabase
        .from('players')
        .select('teams(*)')
        .eq('id', user.id)
        .single()
      
      if (playerWithTeam?.teams && Array.isArray(playerWithTeam.teams) && playerWithTeam.teams.length > 0) {
        const team = playerWithTeam.teams[0]
        // Check if user is captain or member to determine correct page
        if (team.captain_id === user.id) {
          url.pathname = '/manage-team'
        } else {
          url.pathname = '/view-team'
        }
      } else {
        // User has profile but no team, go to home
        url.pathname = '/'
      }
    } else {
      // User needs to set up profile
      url.pathname = '/setup-profile'
    }
    
    return NextResponse.redirect(url)
  }

  // Handle legacy create-player route
  if (request.nextUrl.pathname.startsWith('/create-player')) {
    const url = request.nextUrl.clone()
    url.pathname = '/setup-profile'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
