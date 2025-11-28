import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';
import { validateAndFetchRiotData } from '@/lib/riot';
import { cache } from '@/lib/cache';

// Validation schema for updates - tier and opgg_url are now auto-fetched from Riot API
const updatePlayerSchema = z.object({
  summoner_name: z.string().min(1).max(255),
  discord: z.string().min(1).max(255),
  main_role: z.enum(['Top', 'Jungle', 'Mid', 'ADC', 'Support']),
  secondary_role: z.enum(['Top', 'Jungle', 'Mid', 'ADC', 'Support']),
  looking_for_team: z.boolean(),
});

// GET /api/players/[id] - Get a single player
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }
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

// PUT /api/players/[id] - Update a player
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Validate input
    const validatedData = updatePlayerSchema.parse(body);

    // Validate summoner name via Riot API and fetch tier/opgg
    let riotData;
    try {
      // Get current user for logging
      const authHeader = request.headers.get('authorization');
      const { data: { user: authUser } } = await supabase.auth.getUser(
        authHeader?.replace('Bearer ', '')
      );
      
      riotData = await validateAndFetchRiotData(validatedData.summoner_name, authUser?.id);
    } catch (riotError: any) {
      return NextResponse.json(
        { error: riotError.message || 'Failed to validate summoner name' },
        { status: 400 }
      );
    }

    // Build update data with Riot API results
    const updateData = {
      summoner_name: riotData.summonerName,
      discord: validatedData.discord,
      main_role: validatedData.main_role,
      secondary_role: validatedData.secondary_role,
      looking_for_team: validatedData.looking_for_team,
      tier: riotData.tier,
      opgg_url: riotData.opggUrl,
      puuid: riotData.puuid,
      summoner_level: riotData.summonerLevel,
      profile_icon_id: riotData.profileIconId,
      rank: riotData.rank,
      league_points: riotData.leaguePoints,
      wins: riotData.wins,
      losses: riotData.losses,
    };

    const { data, error } = await supabase
      .from('players')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Invalidate teams cache to trigger recalculation of average rank if player is in a team
    if (data.team_id) {
      await cache.invalidate('all_teams', 'teams');
      await cache.invalidate('search_teams', 'search');
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating player:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/players/[id] - Delete a player
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get player data before deletion to check if they were in a team
    const { data: playerData } = await supabase
      .from('players')
      .select('team_id')
      .eq('id', id)
      .single();
    
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Invalidate teams cache to trigger recalculation of average rank if player was in a team
    if (playerData?.team_id) {
      await cache.invalidate('all_teams', 'teams');
      await cache.invalidate('search_teams', 'search');
    }

    return NextResponse.json({ message: 'Player deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
