import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const registerTeamSchema = z.object({
  team_id: z.string().uuid(),
});

// POST /api/tournaments/[id]/register - Register a team for a tournament
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const body = await request.json();
    
    // Validate input
    const { team_id } = registerTeamSchema.parse(body);

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

    // Check if tournament exists
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if team exists and user is the captain
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', team_id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Verify user is the team captain
    if (team.captain_id !== currentPlayer.id) {
      return NextResponse.json({ error: 'Only team captains can register their team for tournaments' }, { status: 403 });
    }

    // Check if team has enough members
    const { count: memberCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team_id);

    if (!memberCount || memberCount < 5) {
      return NextResponse.json({ error: 'Team must have at least 5 members to register for a tournament' }, { status: 400 });
    }

    // Check if tournament is full
    const { count } = await supabase
      .from('tournament_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    if (count && count >= tournament.max_teams) {
      return NextResponse.json(
        { error: 'Tournament is full' },
        { status: 400 }
      );
    }

    // Check if team is already registered
    const { data: existing } = await supabase
      .from('tournament_registrations')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('team_id', team_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Team is already registered for this tournament' },
        { status: 400 }
      );
    }

    // Register team
    const { data, error } = await supabase
      .from('tournament_registrations')
      .insert([{
        tournament_id: tournamentId,
        team_id: team_id,
        status: 'Pending'
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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
