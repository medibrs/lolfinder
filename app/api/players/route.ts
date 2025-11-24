import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Validation schema
const createPlayerSchema = z.object({
  summoner_name: z.string().min(1).max(255),
  discord: z.string().min(1).max(255),
  main_role: z.enum(['Top', 'Jungle', 'Mid', 'ADC', 'Support']),
  secondary_role: z.enum(['Top', 'Jungle', 'Mid', 'ADC', 'Support']).optional(),
  opgg_link: z.string().url().optional().or(z.literal('')),
  tier: z.enum(['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Challenger']),
  looking_for_team: z.boolean().default(false),
});

// GET /api/players - List all players with optional filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role');
    const tier = searchParams.get('tier');
    const lookingForTeam = searchParams.get('lookingForTeam');

    let query = supabase.from('players').select('*');

    // Apply filters
    if (role) {
      query = query.or(`main_role.eq.${role},secondary_role.eq.${role}`);
    }
    if (tier) {
      query = query.eq('tier', tier);
    }
    if (lookingForTeam === 'true') {
      query = query.eq('looking_for_team', true);
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

// POST /api/players - Create a new player
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validatedData = createPlayerSchema.parse(body);

    const { data, error } = await supabase
      .from('players')
      .insert([validatedData])
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
