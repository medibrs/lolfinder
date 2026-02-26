import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// POST /api/teams/leave - Leave current team
export async function POST(request: NextRequest) {
  try {
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

    // Check if player is in a team
    if (!currentPlayer.team_id) {
      return NextResponse.json({ error: 'You are not in a team' }, { status: 400 });
    }

    // Get team details
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, captain_id')
      .eq('id', currentPlayer.team_id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Don't allow captain to leave team (they must delete it instead)
    if (team.captain_id === currentPlayer.id) {
      return NextResponse.json({ error: 'Team captains cannot leave their team. Please delete the team instead.' }, { status: 400 });
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
        message: `${currentPlayer.summoner_name} has left ${team.name}.`,
        data: {
          player_id: currentPlayer.id,
          team_id: team.id
        }
      }]);

    return NextResponse.json({
      message: 'You have left the team successfully',
      team: team
    }, { status: 200 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
