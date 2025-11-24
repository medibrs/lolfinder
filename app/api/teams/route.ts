import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Validation schema
const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  captain_id: z.string().uuid(),
  open_positions: z.array(z.enum(['Top', 'Jungle', 'Mid', 'ADC', 'Support'])).default([]),
  team_size: z.enum(['5', '6']).default('5'),
  recruiting_status: z.enum(['Open', 'Closed', 'Full']).default('Open'),
});

// GET /api/teams - List all teams with optional filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamSize = searchParams.get('teamSize');
    const recruiting = searchParams.get('recruiting');

    let query = supabase.from('teams').select('*, captain:players!captain_id(*)');

    // Apply filters
    if (teamSize) {
      query = query.eq('team_size', teamSize);
    }
    if (recruiting) {
      query = query.eq('recruiting_status', recruiting);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/teams - Create a new team
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validatedData = createTeamSchema.parse(body);

    // Check if captain exists, if not create a basic player profile automatically
    const { data: existingCaptain, error: existingCaptainError } = await supabase
      .from('players')
      .select('id')
      .eq('id', validatedData.captain_id)
      .single();

    if (existingCaptainError || !existingCaptain) {
      // Create a basic player profile for the captain
      const { data: newCaptain, error: createCaptainError } = await supabase
        .from('players')
        .insert([{
          id: validatedData.captain_id,
          summoner_name: 'Team Captain',
          discord: 'captain#' + Math.random().toString(36).substring(7),
          main_role: 'Top',
          tier: 'Gold',
          region: 'NA', // Temporary - remove this after running the SQL migration
          looking_for_team: false
        }])
        .select('id')
        .single();

      if (createCaptainError || !newCaptain) {
        return NextResponse.json(
          { error: 'Failed to create captain profile: ' + createCaptainError.message },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('teams')
      .insert([validatedData])
      .select('*, captain:players!captain_id(*)')
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
