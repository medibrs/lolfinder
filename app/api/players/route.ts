import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';
import { validateAndFetchRiotData } from '@/lib/riot';

// Validation schema - tier and opgg_url are now auto-fetched from Riot API
const createPlayerSchema = z.object({
  summoner_name: z.string().min(1).max(255),
  discord: z.string().min(1).max(255),
  main_role: z.enum(['Top', 'Jungle', 'Mid', 'ADC', 'Support']),
  secondary_role: z.enum(['Top', 'Jungle', 'Mid', 'ADC', 'Support']).optional(),
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
    // Get current user
    const authHeader = request.headers.get('authorization');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate input
    const validatedData = createPlayerSchema.parse(body);

    // Validate summoner name via Riot API and fetch tier/opgg
    let riotData;
    try {
      riotData = await validateAndFetchRiotData(validatedData.summoner_name);
    } catch (riotError: any) {
      return NextResponse.json(
        { error: riotError.message || 'Failed to validate summoner name' },
        { status: 400 }
      );
    }

    // Use the authenticated user's ID as the player ID
    const playerData = {
      id: user.id,
      summoner_name: riotData.summonerName,
      discord: validatedData.discord,
      main_role: validatedData.main_role,
      secondary_role: validatedData.secondary_role,
      looking_for_team: validatedData.looking_for_team,
      tier: riotData.tier,
      opgg_url: riotData.opggUrl,
      puuid: riotData.puuid,
      summoner_level: riotData.summonerLevel,
    };

    const { data, error } = await supabase
      .from('players')
      .insert([playerData])
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
    console.error('Error creating player:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
