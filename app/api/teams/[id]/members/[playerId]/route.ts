import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cache } from '@/lib/cache';

// DELETE /api/teams/[id]/members/[playerId] - Remove a player from a team
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { id: teamId, playerId } = await params;

    // Check if player is in this team
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    if (player.team_id !== teamId) {
      return NextResponse.json(
        { error: 'Player is not in this team' },
        { status: 400 }
      );
    }

    // Remove player from team
    const { data, error } = await supabase
      .from('players')
      .update({ team_id: null })
      .eq('id', playerId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Invalidate teams cache to trigger recalculation of average rank
    await cache.invalidate('all_teams', 'teams');
    await cache.invalidate('search_teams', 'search');

    return NextResponse.json({ message: 'Player removed from team', player: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
