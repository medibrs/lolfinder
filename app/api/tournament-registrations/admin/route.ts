import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Validation schema
const createRegistrationSchema = z.object({
  tournament_id: z.string().uuid(),
  team_id: z.string().uuid(),
});

// POST /api/tournament-registrations/admin - Admin adds a team to a tournament
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validatedData = createRegistrationSchema.parse(body);

    // Get current user
    const authHeader = request.headers.get('authorization');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user is admin
    const isAdmin = user.app_metadata?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check if tournament exists
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', validatedData.tournament_id)
      .single();

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if team exists
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', validatedData.team_id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if team is already registered
    const { data: existingRegistration } = await supabase
      .from('tournament_registrations')
      .select('*')
      .eq('tournament_id', validatedData.tournament_id)
      .eq('team_id', validatedData.team_id)
      .single();

    if (existingRegistration) {
      return NextResponse.json({ error: 'Team is already registered for this tournament' }, { status: 400 });
    }

    // Check if tournament is full
    const { count } = await supabase
      .from('tournament_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', validatedData.tournament_id);

    if (count && count >= tournament.max_teams) {
      return NextResponse.json({ error: 'Tournament is full' }, { status: 400 });
    }

    // Create registration (admin can bypass date checks, auto-approved)
    const { data: registration, error: registrationError } = await supabase
      .from('tournament_registrations')
      .insert([{
        tournament_id: validatedData.tournament_id,
        team_id: validatedData.team_id,
        status: 'approved',
      }])
      .select()
      .single();

    if (registrationError) {
      return NextResponse.json({ error: registrationError.message }, { status: 400 });
    }

    return NextResponse.json(registration, { status: 201 });
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
