import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// PUT /api/team-invitations/[id] - Accept or reject invitation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const responseSchema = z.object({
      action: z.enum(['accept', 'reject']),
    });

    const validatedData = responseSchema.parse(body);

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
      .select('id, team_id, summoner_name, discord, main_role, tier')
      .eq('id', user.id)
      .single();

    if (playerError || !currentPlayer) {
      return NextResponse.json({ error: 'You must create a player profile before joining a team. Please complete your profile first.' }, { status: 404 });
    }

    // Check if player profile is complete
    if (!currentPlayer.summoner_name || !currentPlayer.main_role || !currentPlayer.tier) {
      return NextResponse.json({ error: 'Please complete your player profile before joining a team.' }, { status: 400 });
    }

    // Get the invitation
    console.log('Looking for invitation with ID:', id)
    console.log('Current player ID:', currentPlayer.id)
    
    const { data: invitation, error: invitationError } = await supabase
      .from('team_invitations')
      .select(`
        *,
        team:teams(id, name, captain_id)
      `)
      .eq('id', id)
      .eq('invited_player_id', currentPlayer.id)
      .eq('status', 'pending')
      .single();

    console.log('Invitation query result:', { invitation, invitationError })

    if (invitationError || !invitation) {
      console.error('Invitation not found:', { invitationError, id, playerId: currentPlayer.id })
      return NextResponse.json({ error: 'Invitation not found or already processed' }, { status: 404 });
    }

    if (validatedData.action === 'accept') {
      console.log('Accepting invitation for user:', currentPlayer.id)
      console.log('Team to join:', invitation.team.id)
      
      // Check if player is already in a team
      if (currentPlayer.team_id) {
        console.log('Player already in team:', currentPlayer.team_id)
        return NextResponse.json({ error: 'You are already in a team. Leave your current team first to accept this invitation.' }, { status: 400 });
      }

      // Check if team is already full
      const { data: teamData } = await supabase
        .from('teams')
        .select('team_size')
        .eq('id', invitation.team.id)
        .single();

      const maxTeamSize = teamData?.team_size || 6;

      const { count: currentMemberCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', invitation.team.id);

      if (currentMemberCount && currentMemberCount >= maxTeamSize) {
        console.log('Team is full:', currentMemberCount, '/', maxTeamSize)
        return NextResponse.json({ 
          error: `This team is already full (${maxTeamSize}/${maxTeamSize} members)` 
        }, { status: 400 });
      }

      // Delete any old non-pending invitations to avoid unique constraint violation
      await supabase
        .from('team_invitations')
        .delete()
        .eq('team_id', invitation.team.id)
        .eq('invited_player_id', currentPlayer.id)
        .neq('status', 'pending');

      // Update invitation status
      const { error: updateError } = await supabase
        .from('team_invitations')
        .update({ status: 'accepted' })
        .eq('id', id);

      if (updateError) {
        console.error('Error updating invitation:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      console.log('Invitation updated, adding player to team...')

      // Add player to team
      const { error: joinError } = await supabase
        .from('players')
        .update({ 
          team_id: invitation.team.id,
          looking_for_team: false 
        })
        .eq('id', currentPlayer.id);

      if (joinError) {
        console.error('Error adding player to team:', joinError)
        return NextResponse.json({ error: joinError.message }, { status: 400 });
      }

      console.log('Player successfully added to team!')

      // Delete the player's notification about this invitation
      await supabase
        .from('notifications')
        .delete()
        .eq('type', 'team_invitation')
        .filter('data->>invitation_id', 'eq', id);

      // Create notification for team captain
      console.log('Creating notification for captain:', invitation.team.captain_id)
      const { error: captainNotificationError } = await supabase
        .from('notifications')
        .insert([{
          user_id: invitation.team.captain_id,
          type: 'team_member_joined',
          title: `${currentPlayer.summoner_name} joined your team`,
          message: `${currentPlayer.summoner_name} has accepted your invitation and joined ${invitation.team.name}`,
          data: {
            team_id: invitation.team.id,
            player_id: currentPlayer.id,
          }
        }]);

      if (captainNotificationError) {
        console.error('Error creating captain notification:', captainNotificationError);
      } else {
        console.log('Captain notification created successfully');
      }

      return NextResponse.json({ message: 'Invitation accepted successfully' });

    } else if (validatedData.action === 'reject') {
      // Delete the invitation instead of marking as rejected (allows captain to re-invite)
      const { error: deleteError } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 400 });
      }

      // Delete the player's notification about this invitation
      await supabase
        .from('notifications')
        .delete()
        .eq('type', 'team_invitation')
        .filter('data->>invitation_id', 'eq', id);

      // Create notification for team captain
      await supabase
        .from('notifications')
        .insert([{
          user_id: invitation.team.captain_id,
          type: 'team_member_left',
          title: `${currentPlayer.summoner_name} declined your invitation`,
          message: `${currentPlayer.summoner_name} has declined the invitation to join ${invitation.team.name}`,
          data: {
            team_id: invitation.team.id,
            player_id: currentPlayer.id,
          }
        }]);

      return NextResponse.json({ message: 'Invitation rejected' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/team-invitations/[id] - Cancel invitation (for team captain)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('DELETE /api/team-invitations/[id] - Cancelling invitation:', id)

    // Get current user
    const authHeader = request.headers.get('authorization');
    console.log('Auth header:', authHeader ? 'Present' : 'Missing')
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '')
    );

    console.log('Auth result:', { user: user?.id, authError })

    if (authError || !user) {
      console.log('Authentication failed')
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get player record for current user
    const { data: currentPlayer, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('id', user.id)
      .single();

    console.log('Player result:', { currentPlayer: currentPlayer?.id, playerError })

    if (playerError || !currentPlayer) {
      console.log('Player profile not found')
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    // Get the invitation and verify user is team captain
    console.log('Looking up invitation:', id)
    const { data: invitation, error: invitationError } = await supabase
      .from('team_invitations')
      .select(`
        *,
        team:teams(id, name, captain_id)
      `)
      .eq('id', id)
      .eq('status', 'pending')
      .single();

    console.log('Invitation result:', { invitation, invitationError })

    if (invitationError || !invitation) {
      console.log('Invitation not found')
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    console.log('Checking captain rights:', { 
      invitationCaptain: invitation.team.captain_id, 
      currentPlayer: currentPlayer.id,
      isCaptain: invitation.team.captain_id === currentPlayer.id
    })

    if (invitation.team.captain_id !== currentPlayer.id) {
      console.log('User is not team captain')
      return NextResponse.json({ error: 'Only team captains can cancel invitations' }, { status: 403 });
    }

    // Update invitation status to cancelled instead of delete
    console.log('Updating invitation status to cancelled...')
    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);

    console.log('Update result:', { updateError })

    if (updateError) {
      console.log('Failed to update invitation')
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Update the notification to show it's been cancelled
    console.log('Updating notification...')
    const { error: notificationError } = await supabase
      .from('notifications')
      .update({
        type: 'team_invitation_cancelled',
        title: `Invitation Cancelled`,
        message: `The invitation to join ${invitation.team.name} has been withdrawn by the team captain.`,
      })
      .eq('type', 'team_invitation')
      .filter('data->>invitation_id', 'eq', id);

    console.log('Notification update result:', { notificationError })

    console.log('Invitation cancelled successfully')
    return NextResponse.json({ message: 'Invitation cancelled' });
  } catch (error) {
    console.error('DELETE invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
