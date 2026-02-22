import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // First verify the user is an admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const isAdmin = user.app_metadata?.role === 'admin'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // 3. Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json({
        error: 'Service role key not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.'
      }, { status: 500 })
    }

    // 4. Initialize Admin Client
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Fetch all users from Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers()

    if (authError) {
      console.error('Error fetching auth users:', authError)
      return NextResponse.json({ error: 'Failed to fetch auth users' }, { status: 500 })
    }

    // Fetch all player profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('players')
      .select('*')

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
    }

    // Map profiles to user format
    const usersWithProfiles = authData.users.map(u => {
      const profile = profiles?.find(p => p.user_id === u.id || p.id === u.id)
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        app_metadata: u.app_metadata || {},
        user_metadata: u.user_metadata || {},
        raw_app_meta_data: u.app_metadata || {},
        profile: profile || null
      }
    })

    return NextResponse.json({ users: usersWithProfiles })
  } catch (error) {
    console.error('Error in admin users route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
