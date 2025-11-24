import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Validation schema
const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  captain_id: z.string().uuid(),
  open_positions: z.array(z.enum(['Top', 'Jungle', 'Mid', 'ADC', 'Support'])).default([]),
  tier: z.enum(['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Challenger']),
  region: z.enum(['NA', 'EUW', 'EUNE', 'KR', 'BR', 'LAN', 'LAS', 'OCE', 'RU', 'TR', 'JP']),
  recruiting_status: z.enum(['Open', 'Closed', 'Full']).default('Open'),
});

// GET /api/teams - List all teams with optional filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tier = searchParams.get('tier');
    const region = searchParams.get('region');
    const recruiting = searchParams.get('recruiting');

    let query = supabase.from('teams').select('*, captain:players!captain_id(*)');

    // Apply filters
    if (tier) {
      query = query.eq('tier', tier);
    }
    if (region) {
      query = query.eq('region', region);
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

    // Check if captain exists
    const { data: captain, error: captainError } = await supabase
      .from('players')
      .select('id')
      .eq('id', validatedData.captain_id)
      .single();

    if (captainError || !captain) {
      return NextResponse.json(
        { error: 'Captain player not found' },
        { status: 400 }
      );
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
