import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// DELETE /api/team-join-requests/[id] - Cancel own join request (for players)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
      .select('id')
      .eq('id', user.id)
      .single();

    if (playerError || !currentPlayer) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    // Get the join request and verify it belongs to the current user
    const { data: request, error: requestError } = await supabase
      .from('team_join_requests')
      .select('*')
      .eq('id', id)
      .eq('player_id', currentPlayer.id)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) {
      return NextResponse.json({ error: 'Join request not found or already processed' }, { status: 404 });
    }

    // Delete the join request
    const { error: deleteError } = await supabase
      .from('team_join_requests')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    // Delete the notification sent to the team captain
    await supabase
      .from('notifications')
      .delete()
      .eq('type', 'team_join_request')
      .filter('data->>request_id', 'eq', id);

    return NextResponse.json({ message: 'Join request cancelled' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

      // Check if team is already full
      const { data: teamData } = await supabase
        .from('teams')
        .select('team_size')
        .eq('id', request.team.id)
        .single();

      const maxTeamSize = teamData?.team_size || 6;

      const { count: currentMemberCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', request.team.id);

      if (currentMemberCount && currentMemberCount >= maxTeamSize) {
        return NextResponse.json({ 
          error: `This team is already full (${maxTeamSize}/${maxTeamSize} members)` 
        }, { status: 400 });
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

      // Delete the captain's notification about this request
      await supabase
        .from('notifications')
        .delete()
        .eq('type', 'team_join_request')
        .filter('data->>request_id', 'eq', id);

      // Create notification for the player who was accepted
      console.log('Creating acceptance notification for player:', request.player_id)
      const { error: notificationError } = await supabase
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

      if (notificationError) {
        console.error('Error creating acceptance notification:', notificationError);
      } else {
        console.log('Acceptance notification created successfully');
      }

      return NextResponse.json({ message: 'Join request accepted successfully' });

    } else if (validatedData.action === 'reject') {
      // Delete the request instead of marking as rejected (allows player to request again)
      const { error: deleteError } = await supabase
        .from('team_join_requests')
        .delete()
        .eq('id', id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 400 });
      }

      // Delete the captain's notification about this request
      await supabase
        .from('notifications')
        .delete()
        .eq('type', 'team_join_request')
        .filter('data->>request_id', 'eq', id);

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
