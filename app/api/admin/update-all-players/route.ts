import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateAndFetchRiotData } from '@/lib/riot';

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

    console.log('Starting bulk update of all players...');

    // Get all players
    const { data: players, error: fetchError } = await supabase
      .from('players')
      .select('*');

    if (fetchError) {
      console.error('Error fetching players:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
    }

    if (!players || players.length === 0) {
      return NextResponse.json({ message: 'No players found to update' });
    }

    console.log(`Found ${players.length} players to update`);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      updatedPlayers: [] as any[]
    };

    // Update each player
    for (const player of players) {
      try {
        console.log(`Updating ${player.summoner_name}...`);

        // Re-fetch data from Riot API (log as admin user)
        const riotData = await validateAndFetchRiotData(player.summoner_name, user.id);

        // Update player with new data
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
            puuid: riotData.puuid,
            opgg_url: riotData.opggUrl,
          })
          .eq('id', player.id);

        if (updateError) {
          console.error(`Error updating ${player.summoner_name}:`, updateError);
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
            losses: riotData.losses
          });
          console.log(`✓ Updated ${player.summoner_name}: ${riotData.tier} ${riotData.rank || ''} (${riotData.wins}W/${riotData.losses}L)`);
        }

        // Rate limiting - wait 1.2 seconds between API calls to respect Riot's limits
        await new Promise(resolve => setTimeout(resolve, 1200));

      } catch (riotError: any) {
        console.error(`Error fetching Riot data for ${player.summoner_name}:`, riotError.message);
        results.failed++;
        results.errors.push(`Riot API error for ${player.summoner_name}: ${riotError.message}`);
      }
    }

    console.log(`Update complete! Success: ${results.success}, Failed: ${results.failed}`);

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
