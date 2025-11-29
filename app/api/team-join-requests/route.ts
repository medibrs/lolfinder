import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// POST /api/team-join-requests - Request to join a team
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const requestSchema = z.object({
      team_id: z.string().uuid(),
      message: z.string().optional(),
    });

    const validatedData = requestSchema.parse(body);

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
      .select('id, team_id, summoner_name, discord, main_role, secondary_role, tier, opgg_link')
      .eq('id', user.id)
      .single();

    if (playerError || !currentPlayer) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    // Check if player profile is complete
    if (!currentPlayer.summoner_name || !currentPlayer.main_role || !currentPlayer.tier) {
      return NextResponse.json({ error: 'Please complete your player profile before requesting to join a team.' }, { status: 400 });
    }

    // Check if player is already in a team
    if (currentPlayer.team_id) {
      return NextResponse.json({ error: 'You are already in a team' }, { status: 400 });
    }

    // Get team details
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, captain_id')
      .eq('id', validatedData.team_id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user is requesting to join their own team
    if (team.captain_id === currentPlayer.id) {
      return NextResponse.json({ error: 'You cannot request to join your own team' }, { status: 400 });
    }

    // Check if there's already a pending request
    const { data: existingRequest } = await supabase
      .from('team_join_requests')
      .select('*')
      .eq('team_id', validatedData.team_id)
      .eq('player_id', currentPlayer.id)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return NextResponse.json({ error: 'You already have a pending request to join this team' }, { status: 400 });
    }

    // Create join request
    const { data, error } = await supabase
      .from('team_join_requests')
      .insert([{
        team_id: validatedData.team_id,
        player_id: currentPlayer.id,
        message: validatedData.message || `I'd like to join your team!`,
        status: 'pending'
      }])
      .select(`
        *,
        team:teams(id, name)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Create notification for team captain with detailed player info
    await supabase
      .from('notifications')
      .insert([{
        user_id: team.captain_id,
        type: 'team_join_request',
        title: `Join Request from ${currentPlayer.summoner_name}`,
        message: `${currentPlayer.summoner_name} (${currentPlayer.tier} ${currentPlayer.main_role}) wants to join your team`,
        data: {
          request_id: data.id,
          team_id: team.id,
          team_name: team.name,
          player: {
            id: currentPlayer.id,
            summoner_name: currentPlayer.summoner_name,
            tier: currentPlayer.tier,
            main_role: currentPlayer.main_role,
            secondary_role: currentPlayer.secondary_role,
            opgg_link: currentPlayer.opgg_link
          }
        }
      }]);

    return NextResponse.json(data, { status: 201 });

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

// GET /api/team-join-requests - Get join requests for your team
export async function GET(request: NextRequest) {
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
      .select('id')
      .eq('id', user.id)
      .single();

    if (playerError || !currentPlayer) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    // Get team where user is captain
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('captain_id', currentPlayer.id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'You are not a team captain' }, { status: 404 });
    }

    // Get join requests for the team
    const { data: requests, error } = await supabase
      .from('team_join_requests')
      .select('*')
      .eq('team_id', team.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(requests || []);

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
