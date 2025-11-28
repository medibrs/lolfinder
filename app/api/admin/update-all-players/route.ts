import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateAndFetchRiotData, updateExistingPlayerData } from '@/lib/riot';
import { cache } from '@/lib/cache';

// Admin-only route to update all existing players with fresh Riot API data
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication (you should implement proper admin checks)
    const authHeader = request.headers.get('authorization');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // TODO: Add proper admin role check here
    // For now, we'll just check if user exists (you should implement admin verification)


    // Fetch all players that have a PUUID (players created through Riot API integration)
    const { data: players, error: fetchError } = await supabase
      .from('players')
      .select('id, summoner_name, puuid')
      .not('puuid', 'is', null);

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
    }

    if (!players || players.length === 0) {
      return NextResponse.json({ message: 'No players found to update' });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      updatedPlayers: [] as any[]
    };

    // Update each player
    for (const player of players) {
      try {

        // Use optimized update function that only makes 2 API calls instead of 3
        const riotData = await updateExistingPlayerData(player.puuid, user.id);

        // Update player with new data (excluding opggUrl since it doesn't change for existing players)
        const { error: updateError } = await supabase
          .from('players')
          .update({
            profile_icon_id: riotData.profileIconId,
            rank: riotData.rank,
            league_points: riotData.leaguePoints,
            wins: riotData.wins,
            losses: riotData.losses,
            // Also update existing fields in case they changed
            tier: riotData.tier,
            summoner_level: riotData.summonerLevel,
            // Keep existing opgg_url since it doesn't change for existing players
          })
          .eq('id', player.id);

        if (updateError) {
          results.failed++;
          results.errors.push(`Failed to update ${player.summoner_name}: ${updateError.message}`);
        } else {
          results.success++;
          results.updatedPlayers.push({
            summoner_name: player.summoner_name,
            tier: riotData.tier,
            rank: riotData.rank,
            league_points: riotData.leaguePoints,
            wins: riotData.wins,
            losses: riotData.losses,
            updated_at: new Date().toISOString()
          });
        }

        // Rate limiting - wait 1.2 seconds between API calls to respect Riot's limits
        await new Promise(resolve => setTimeout(resolve, 1200));

      } catch (riotError: any) {
        results.failed++;
        // Provide detailed error messages for PUUID lookup failures
        if (riotError.message.includes('PUUID') || riotError.message.includes('banned') || riotError.message.includes('manual verification')) {
          results.errors.push(`PUUID lookup failed for ${player.summoner_name}: ${riotError.message}. This player may need manual attention.`);
        } else {
          results.errors.push(`Riot API error for ${player.summoner_name}: ${riotError.message}`);
        }
      }
    }


    // Invalidate teams cache to trigger recalculation of average rank for all teams
    // since this operation updates player ranks across all teams
    await cache.invalidate('all_teams', 'teams');
    await cache.invalidate('search_teams', 'search');

    return NextResponse.json({
      message: 'Player update completed',
      summary: {
        total: players.length,
        success: results.success,
        failed: results.failed
      },
      updatedPlayers: results.updatedPlayers,
      errors: results.errors
    });

  } catch (error) {
    console.error('Error in update-all-players route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
