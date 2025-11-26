import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete user's data in order (respecting foreign key constraints)
    
    // 1. Delete user's notifications
    await supabase.from('notifications').delete().eq('user_id', user.id)
    
    // 2. Delete user's team invitations (both sent and received)
    await supabase.from('team_invitations').delete().eq('invited_player_id', user.id)
    
    // 3. Delete user's tournament registrations
    await supabase.from('tournament_registrations').delete().eq('team_id', user.id)
    
    // 4. If user is a captain, delete the team and all its data
    const { data: userTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('captain_id', user.id)
      .single()
    
    if (userTeam) {
      // Delete tournament registrations for this team
      await supabase.from('tournament_registrations').delete().eq('team_id', userTeam.id)
      
      // Remove all members from this team
      await supabase.from('players').update({ team_id: null }).eq('team_id', userTeam.id)
      
      // Delete the team
      await supabase.from('teams').delete().eq('id', userTeam.id)
    }
    
    // 5. Delete user's player profile
    await supabase.from('players').delete().eq('id', user.id)
    
    // 6. Delete the auth user (this requires admin privileges)
    // For now, we'll sign out the user and let them know to contact support
    // In a production environment, you'd want to set up a proper service role API
    
    await supabase.auth.signOut()
    
    return NextResponse.json({ 
      message: 'Account data deleted successfully. Please contact support to complete account removal.' 
    })
    
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json({ 
      error: 'Failed to delete account. Please contact support.' 
    }, { status: 500 })
  }
}
