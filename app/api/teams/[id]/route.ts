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
      .eq('team_id', id);

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
