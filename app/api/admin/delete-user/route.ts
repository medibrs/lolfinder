import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
  try {
    // 1. Verify the requester is an admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const isAdmin = user.app_metadata?.role === 'admin'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // 2. Get the userId to delete from the request body
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // 3. Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json({ 
        error: 'Service role key not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.' 
      }, { status: 500 })
    }

    // 4. Initialize Admin Client (Service Role) to delete from auth.users
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

    // 5. Perform Cascade Deletion of Public Data
    // Note: We do this manually to ensure order, even though SQL cascades exist
    
    // A. Delete notifications
    console.log('Deleting notifications for user:', userId)
    await adminClient.from('notifications').delete().eq('user_id', userId)
    
    // B. Delete team invitations
    console.log('Deleting team invitations for user:', userId)
    await adminClient.from('team_invitations').delete().eq('invited_player_id', userId)
    await adminClient.from('team_invitations').delete().eq('invited_by', userId)
    
    // C. Delete join requests
    console.log('Deleting join requests for user:', userId)
    await adminClient.from('team_join_requests').delete().eq('player_id', userId)
    
    // D. Handle Captain Status: Delete Team & Tournament Registrations
    console.log('Checking if user is team captain:', userId)
    const { data: userTeam } = await adminClient
      .from('teams')
      .select('id')
      .eq('captain_id', userId)
      .single()
    
    if (userTeam) {
      console.log('User is captain, deleting team:', userTeam.id)
      // Delete tournament registrations
      await adminClient.from('tournament_registrations').delete().eq('team_id', userTeam.id)
      
      // Release other members
      await adminClient.from('players').update({ team_id: null }).eq('team_id', userTeam.id)
      
      // Delete team
      await adminClient.from('teams').delete().eq('id', userTeam.id)
    }

    // E. Delete Player Profile
    console.log('Deleting player profile:', userId)
    const { error: deleteProfileError } = await adminClient
      .from('players')
      .delete()
      .eq('id', userId)
      
    if (deleteProfileError) {
      console.error('Error deleting profile:', deleteProfileError)
      return NextResponse.json({ error: 'Failed to delete user profile: ' + deleteProfileError.message }, { status: 500 })
    }

    // 6. Delete from Auth.Users (The critical missing step)
    console.log('Deleting auth user:', userId)
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId)
    
    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError)
      return NextResponse.json({ error: 'Failed to delete auth user: ' + deleteAuthError.message }, { status: 500 })
    }

    console.log('Successfully deleted user:', userId)
    return NextResponse.json({ message: 'User and all related data deleted successfully' })
    
  } catch (error) {
    console.error('Error in admin delete user route:', error)
    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 })
  }
}
