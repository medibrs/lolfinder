import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Validation schema for updates
const updateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  open_positions: z.array(z.enum(['Top', 'Jungle', 'Mid', 'ADC', 'Support'])).optional(),
  team_size: z.enum(['5', '6']).optional(),
  recruiting_status: z.enum(['Open', 'Closed', 'Full']).optional(),
  captain_id: z.string().uuid().optional(),
});

// GET /api/teams/[id] - Get a single team with members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get team with captain info
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*, captain:players!captain_id(*)')
      .eq('id', id)
      .or('is_bot.is.null,is_bot.eq.false')
      .single();

    if (teamError) {
      if (teamError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }
      return NextResponse.json({ error: teamError.message }, { status: 500 });
    }

    // Get team members
    const { data: members, error: membersError } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', id)
      .or('is_bot.is.null,is_bot.eq.false');

    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    return NextResponse.json({ ...team, members });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/teams/[id] - Update a team
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validatedData = updateTeamSchema.parse(body);

    // If captain_id is being updated, validate the transfer
    if (validatedData.captain_id) {
      // Get current team to verify current captain and get team name
      const { data: currentTeam, error: teamError } = await supabase
        .from('teams')
        .select('captain_id, name')
        .eq('id', id)
        .single();

      if (teamError) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      // Verify the new captain is a member of the team
      const { data: newCaptain, error: memberError } = await supabase
        .from('players')
        .select('*')
        .eq('id', validatedData.captain_id)
        .eq('team_id', id)
        .single();

      if (memberError) {
        return NextResponse.json({ error: 'New captain must be a team member' }, { status: 400 });
      }

      // Create notification for captain transfer
      await supabase
        .from('notifications')
        .insert({
          player_id: validatedData.captain_id,
          type: 'team_update',
          message: `You have been promoted to captain of ${currentTeam.name || 'the team'}!`,
          metadata: { team_id: id, action: 'captain_promotion' }
        });

      // Create notification for old captain
      await supabase
        .from('notifications')
        .insert({
          player_id: currentTeam.captain_id,
          type: 'team_update',
          message: `You have transferred captaincy of ${currentTeam.name || 'the team'}.`,
          metadata: { team_id: id, action: 'captain_transfer' }
        });
    }

    const { data, error } = await supabase
      .from('teams')
      .update(validatedData)
      .eq('id', id)
      .select('*, captain:players!captain_id(*)')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[id] - Delete a team
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Remove team_id from all players in this team
    await supabase
      .from('players')
      .update({ team_id: null })
      .eq('team_id', id);

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Team deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
