import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// PUT /api/team-join-requests/[id] - Accept or reject a join request
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    const responseSchema = z.object({
      action: z.enum(['accept', 'reject']),
    });

    const validatedData = responseSchema.parse(body);

    // Get current user
    const authHeader = req.headers.get('authorization');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get player record for current user
    const { data: currentPlayer, error: playerError } = await supabase
      .from('players')
      .select('id, summoner_name')
      .eq('id', user.id)
      .single();

    if (playerError || !currentPlayer) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    // Get the join request with team details
    const { data: request, error: requestError } = await supabase
      .from('team_join_requests')
      .select(`
        *,
        team:teams(id, name, captain_id)
      `)
      .eq('id', id)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) {
      return NextResponse.json({ error: 'Join request not found or already processed' }, { status: 404 });
    }

    // Verify user is the team captain
    if (request.team.captain_id !== currentPlayer.id) {
      return NextResponse.json({ error: 'Only team captains can accept join requests' }, { status: 403 });
    }

    if (validatedData.action === 'accept') {
      // Get the player who made the request to check their current team status
      const { data: requestingPlayer, error: playerCheckError } = await supabase
        .from('players')
        .select('id, team_id, summoner_name')
        .eq('id', request.player_id)
        .single();

      if (playerCheckError || !requestingPlayer) {
        return NextResponse.json({ error: 'Requesting player not found' }, { status: 404 });
      }

      // Check if player is already in a team
      if (requestingPlayer.team_id) {
        return NextResponse.json({ error: 'Player is already in a team' }, { status: 400 });
      }

      // Update request status
      const { error: updateError } = await supabase
        .from('team_join_requests')
        .update({ status: 'accepted' })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      // Add player to team
      const { error: joinError } = await supabase
        .from('players')
        .update({ 
          team_id: request.team.id,
          looking_for_team: false 
        })
        .eq('id', request.player_id);

      if (joinError) {
        return NextResponse.json({ error: joinError.message }, { status: 400 });
      }

      // Create notification for the player who was accepted
      await supabase
        .from('notifications')
        .insert([{
          user_id: request.player_id,
          type: 'team_join_accepted',
          title: `Welcome to ${request.team.name}!`,
          message: `Your request to join ${request.team.name} has been accepted!`,
          data: {
            team_id: request.team.id,
            team_name: request.team.name
          }
        }]);

      return NextResponse.json({ message: 'Join request accepted successfully' });

    } else if (validatedData.action === 'reject') {
      // Update request status
      const { error: updateError } = await supabase
        .from('team_join_requests')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      // Create notification for the player who was rejected
      await supabase
        .from('notifications')
        .insert([{
          user_id: request.player_id,
          type: 'team_join_rejected',
          title: `Join Request to ${request.team.name}`,
          message: `Your request to join ${request.team.name} was not accepted at this time.`,
          data: {
            team_id: request.team.id,
            team_name: request.team.name
          }
        }]);

      return NextResponse.json({ message: 'Join request rejected' });
    }

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
