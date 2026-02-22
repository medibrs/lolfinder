import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId, role } = await request.json()

    if (!userId || !role || !['admin', 'user'].includes(role)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    // Check if current user is admin
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if current user has admin role
    if (currentUser.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Create service role client to update user metadata
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Service role key not configured.' }, { status: 500 })
    }

    const adminClient = await import('@supabase/supabase-js').then(mod => mod.createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    ))

    // Update the target user's role
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { role }
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `User role updated to ${role}` })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
