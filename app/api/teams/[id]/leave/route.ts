import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cache } from '@/lib/cache';

// POST /api/teams/[id]/leave - Leave a team
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get current user
    const authHeader = request.headers.get('authorization');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get player record for current user
    const { data: currentPlayer, error: playerError } = await supabase
      .from('players')
      .select('id, team_id, summoner_name')
      .eq('id', user.id)
      .single();

    if (playerError || !currentPlayer) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    if (!currentPlayer.team_id) {
      return NextResponse.json({ error: 'You are not in a team' }, { status: 400 });
    }

    if (currentPlayer.team_id !== id) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 400 });
    }

    // Get team details
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, captain_id')
      .eq('id', id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user is the captain
    if (team.captain_id === currentPlayer.id) {
      return NextResponse.json({ 
        error: 'Team captains cannot leave their own team. Transfer captainship or delete the team first.' 
      }, { status: 400 });
    }

    // Remove player from team
    const { error: leaveError } = await supabase
      .from('players')
      .update({ 
        team_id: null,
        looking_for_team: true 
      })
      .eq('id', currentPlayer.id);

    if (leaveError) {
      return NextResponse.json({ error: leaveError.message }, { status: 400 });
    }

    // Create notification for team captain
    await supabase
      .from('notifications')
      .insert([{
        user_id: team.captain_id,
        type: 'team_member_left',
        title: `${currentPlayer.summoner_name} left your team`,
        message: `${currentPlayer.summoner_name} has left ${team.name}`,
        data: {
          team_id: team.id,
          player_id: currentPlayer.id,
        }
      }]);

    // Invalidate teams cache to trigger recalculation of average rank
    await cache.invalidate('all_teams', 'teams');
    await cache.invalidate('search_teams', 'search');

    return NextResponse.json({ message: 'Left team successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
