import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';
import { validateAndFetchRiotData, getExpectedIconId } from '@/lib/riot';

// Validation schema for updates - tier and opgg_url are now auto-fetched from Riot API
const updatePlayerSchema = z.object({
  summoner_name: z.string().min(1).max(255),
  discord: z.string().max(255).optional(),
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

    // Get current user for logging and ownership checking
    const authHeader = request.headers.get('authorization');
    const { data: { user: authUser } } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '')
    );

    if (!authUser || authUser.id !== id) {
      return NextResponse.json({ error: 'Unauthorized to edit this profile' }, { status: 401 });
    }

    // Get the player's old PUUID to see if they are changing their Riot Account
    const { data: currentDbProfile } = await supabase
      .from('players')
      .select('puuid')
      .eq('id', id)
      .maybeSingle();

    // Validate summoner name via Riot API and fetch tier/opgg
    let riotData;
    try {
      riotData = await validateAndFetchRiotData(validatedData.summoner_name, authUser.id);
    } catch (riotError: any) {
      return NextResponse.json(
        { error: riotError.message || 'Failed to validate summoner name' },
        { status: 400 }
      );
    }

    // If their new Riot profile PUUID is different from what was currently stored in the DB, they are changing accounts!
    if (!currentDbProfile || currentDbProfile.puuid !== riotData.puuid) {

      // 1. Check if the newly requested Riot Account is claimed by someone else
      const { data: existingClaim, error: claimSearchError } = await supabase
        .from('players')
        .select('id, summoner_name')
        .eq('puuid', riotData.puuid)
        .maybeSingle();

      if (existingClaim && existingClaim.id !== authUser.id) {
        console.log(`[Riot Verification - PUT] User ${authUser.email} (${authUser.id}) tried to steal ${riotData.summonerName} which belongs to ${existingClaim.id}`);
        return NextResponse.json({
          error: `This Riot account (${riotData.summonerName}) is already claimed by another user on this platform.`
        }, { status: 400 });
      }

      // 2. Perform Ownership Verification using the Profile Icon challenge
      const expectedIconId = getExpectedIconId(authUser.id);
      console.log(`[Riot Verification - PUT] User ${authUser.email} (${authUser.id}) attempting to change linked Riot account to ${riotData.summonerName}. Current Icon: ${riotData.profileIconId} | Expected Icon: ${expectedIconId}`);

      if (riotData.profileIconId !== expectedIconId) {
        console.log(`   -> Failed: Icon Mismatch.`);
        return NextResponse.json({
          error: `Ownership Verification Required.`,
          requiresVerification: true,
          expectedIconId,
          currentIconId: riotData.profileIconId,
          summonerName: riotData.summonerName
        }, { status: 400 });
      }
      console.log(`   -> SUCCESS! User successfully proved ownership of the new account ${riotData.summonerName}.`);
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

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
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

    return NextResponse.json({ message: 'Player deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
