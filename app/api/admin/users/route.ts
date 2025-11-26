import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // First verify the user is an admin
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user is admin
    const isAdmin = user.app_metadata?.role === 'admin'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Use private key to access auth.users
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Fetch all users from auth.users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      console.error('Error fetching auth users:', authError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Fetch all player profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('players')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
    }

    // Combine auth users with their profiles
    const usersWithProfiles = authUsers.users.map(authUser => {
      const profile = profiles?.find((p: any) => p.user_id === authUser.id || p.id === authUser.id)
      return {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        app_metadata: authUser.app_metadata,
        user_metadata: authUser.user_metadata,
        profile: profile || null
      }
    })

    return NextResponse.json({ users: usersWithProfiles })
  } catch (error) {
    console.error('Error in admin users route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
