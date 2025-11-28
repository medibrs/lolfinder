import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';
import { cache } from '@/lib/cache';

const addMemberSchema = z.object({
  player_id: z.string().uuid(),
});

// POST /api/teams/[id]/members - Add a player to a team
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const body = await request.json();
    
    // Validate input
    const { player_id } = addMemberSchema.parse(body);

    // Check if team exists
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if player exists
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', player_id)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check if player is already in a team
    if (player.team_id) {
      return NextResponse.json(
        { error: 'Player is already in a team' },
        { status: 400 }
      );
    }

    // Add player to team
    const { data, error } = await supabase
      .from('players')
      .update({ team_id: teamId })
      .eq('id', player_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Invalidate teams cache to trigger recalculation of average rank
    await cache.invalidate('all_teams', 'teams');
    await cache.invalidate('search_teams', 'search');

    return NextResponse.json(data);
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
