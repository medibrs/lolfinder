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

    // Check if tournament exists
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if team exists
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', team_id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
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
