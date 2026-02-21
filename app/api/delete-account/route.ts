import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json({
        error: 'Service role key not configured. Please contact support to complete account deletion.'
      }, { status: 500 })
    }

    // Initialize Admin Client (Service Role) to delete from auth.users
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

    // Delete user's data in order (respecting foreign key constraints)

    // 1. Delete user's notifications
    await adminClient.from('notifications').delete().eq('user_id', user.id)

    // 2. Delete user's team invitations (both sent and received)
    await adminClient.from('team_invitations').delete().eq('invited_player_id', user.id)

    // 3. Delete user's join requests
    await adminClient.from('team_join_requests').delete().eq('player_id', user.id)

    // 4. If user is a captain, delete the team and all its data
    const { data: userTeam } = await adminClient
      .from('teams')
      .select('id')
      .eq('captain_id', user.id)
      .single()

    if (userTeam) {
      // Delete tournament registrations for this team
      await adminClient.from('tournament_registrations').delete().eq('team_id', userTeam.id)

      // Remove all members from this team
      await adminClient.from('players').update({ team_id: null }).eq('team_id', userTeam.id)

      // Delete the team
      await adminClient.from('teams').delete().eq('id', userTeam.id)
    }

    // 5. Delete user's player profile
    const { error: deleteProfileError } = await adminClient.from('players').delete().eq('id', user.id)

    if (deleteProfileError) {
      console.error('Error deleting profile:', deleteProfileError)
      return NextResponse.json({ error: 'Failed to delete user profile' }, { status: 500 })
    }

    // 6. Delete the auth user (completes the account removal)
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id)

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError)
      return NextResponse.json({ error: 'Failed to delete auth user. Please contact support.' }, { status: 500 })
    }

    // 7. Forcefully wipe the session cookies so the browser doesn't ghost the old logged-in state
    await supabase.auth.signOut()

    return NextResponse.json({
      message: 'Account deleted successfully. You will be redirected to the home page.'
    })

  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json({
      error: 'Failed to delete account. Please contact support.'
    }, { status: 500 })
  }
}
