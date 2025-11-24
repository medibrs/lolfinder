import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// GET /api/team-invitations - Get invitations for current user
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // 'sent' or 'received'
    const status = searchParams.get('status'); // 'pending', 'accepted', 'rejected'

    // Get current user
    const authHeader = request.headers.get('authorization');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get player record for current user
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('id', user.id)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    let query = supabase
      .from('team_invitations')
      .select(`
        *,
        team:teams(id, name),
        invited_player:players!invited_player_id(summoner_name),
        invited_by:players!invited_by(summoner_name)
      `)
      .order('created_at', { ascending: false });

    if (type === 'received') {
      query = query.eq('invited_player_id', player.id);
    } else if (type === 'sent') {
      query = query.eq('invited_by', player.id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/team-invitations - Send team invitation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const createInvitationSchema = z.object({
      team_id: z.string().uuid(),
      invited_player_id: z.string().uuid(),
      message: z.string().optional(),
    });

    const validatedData = createInvitationSchema.parse(body);

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
      return NextResponse.json({ error: 'You must create a player profile before sending invitations. Please complete your profile first.' }, { status: 404 });
    }

    // Check if player profile is complete
    if (!currentPlayer.summoner_name || !currentPlayer.discord || !currentPlayer.main_role || !currentPlayer.tier) {
      return NextResponse.json({ error: 'Please complete your player profile before sending team invitations.' }, { status: 400 });
    }

    // Verify user is the captain of the team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, captain_id')
      .eq('id', validatedData.team_id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (team.captain_id !== currentPlayer.id) {
      return NextResponse.json({ error: 'Only team captains can send invitations' }, { status: 403 });
    }

    // Check if invited player exists and is not already in a team
    const { data: invitedPlayer, error: invitedPlayerError } = await supabase
      .from('players')
      .select('id, team_id, summoner_name')
      .eq('id', validatedData.invited_player_id)
      .single();

    if (invitedPlayerError || !invitedPlayer) {
      return NextResponse.json({ error: 'Invited player not found' }, { status: 404 });
    }

    if (invitedPlayer.team_id) {
      return NextResponse.json({ error: 'Player is already in a team' }, { status: 400 });
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabase
      .from('team_invitations')
      .select('id')
      .eq('team_id', validatedData.team_id)
      .eq('invited_player_id', validatedData.invited_player_id)
      .eq('status', 'pending')
      .single();

    if (existingInvitation) {
      return NextResponse.json({ error: 'Invitation already sent' }, { status: 400 });
    }

    // Create invitation
    const { data, error } = await supabase
      .from('team_invitations')
      .insert([{
        ...validatedData,
        invited_by: currentPlayer.id,
      }])
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Create notification for invited player
    await supabase
      .from('notifications')
      .insert([{
        user_id: validatedData.invited_player_id,
        type: 'team_invitation',
        title: `Team Invitation from ${team.name}`,
        message: validatedData.message || `You've been invited to join ${team.name}`,
        data: {
          invitation_id: data.id,
          team_id: team.id,
          team_name: team.name,
        }
      }]);

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
