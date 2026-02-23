import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { teamId, avatarId } = await request.json()

    if (!teamId || !avatarId) {
      return NextResponse.json({ error: 'Missing teamId or avatarId' }, { status: 400 })
    }

    // Validate avatar ID is in the allowed range
    if (avatarId < 3905 || avatarId > 4016) {
      return NextResponse.json({ error: 'Invalid avatar ID' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is the team captain
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('captain_id')
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    if (team.captain_id !== user.id) {
      return NextResponse.json({ error: 'Only team captains can update avatar' }, { status: 403 })
    }

    // Check if avatar is already taken by another team
    const { data: existingTeam, error: avatarCheckError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('team_avatar', avatarId)
      .neq('id', teamId) // Exclude current team
      .single()

    if (avatarCheckError && avatarCheckError.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Error checking avatar availability:', avatarCheckError)
      return NextResponse.json({ error: 'Failed to check avatar availability' }, { status: 500 })
    }

    if (existingTeam) {
      return NextResponse.json({
        error: 'Avatar already taken',
        message: `This avatar is already being used by ${existingTeam.name}`
      }, { status: 409 })
    }

    // Update team avatar
    const { data: updatedTeam, error: updateError } = await supabase
      .from('teams')
      .update({ team_avatar: avatarId })
      .eq('id', teamId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating team avatar:', updateError)
      return NextResponse.json({ error: 'Failed to update avatar' }, { status: 500 })
    }

    return NextResponse.json({ success: true, team: updatedTeam })
  } catch (error) {
    console.error('Error in update-avatar route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
