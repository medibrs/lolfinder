import { createClient } from '@/lib/supabase/server'
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

    // Fetch all player profiles with user data
    const { data: profiles, error: profilesError } = await supabase
      .from('players')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
    }

    // Map profiles to user format
    const usersWithProfiles = profiles?.map(profile => ({
      id: profile.user_id || profile.id,
      email: profile.email || `${profile.summoner_name?.replace(/[^a-zA-Z0-9]/g, '')}@player.local`,
      created_at: profile.created_at,
      app_metadata: {},
      user_metadata: {},
      profile: profile
    })) || []

    return NextResponse.json({ users: usersWithProfiles })
  } catch (error) {
    console.error('Error in admin users route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
