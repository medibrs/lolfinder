import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get all teams that have avatars
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, team_avatar')
      .not('team_avatar', 'is', null)

    if (error) {
      console.error('Error fetching taken avatars:', error)
      return NextResponse.json({ error: 'Failed to fetch taken avatars' }, { status: 500 })
    }

    // Extract just the avatar IDs
    const takenAvatars = teams?.map(team => ({
      id: team.team_avatar,
      teamName: team.name,
      teamId: team.id
    })).filter(avatar => avatar.id) || []

    return NextResponse.json({ takenAvatars })
  } catch (error) {
    console.error('Error in taken-avatars route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
