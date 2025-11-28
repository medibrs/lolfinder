import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Validation schema for updates
const updateTournamentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  prize_pool: z.string().optional(),
  max_teams: z.number().int().positive().optional(),
  rules: z.string().optional(),
  format: z.enum(['Single_Elimination', 'Double_Elimination', 'Round_Robin', 'Swiss']).optional(),
  registration_deadline: z.string().optional().nullable(),
  status: z.enum(['Registration', 'Registration_Closed', 'Seeding', 'In_Progress', 'Completed', 'Cancelled']).optional(),
  current_round: z.number().int().min(0).optional(),
  total_rounds: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  swiss_rounds: z.number().int().min(1).optional(),
  swiss_points_per_win: z.number().int().min(0).optional(),
  swiss_points_per_draw: z.number().int().min(0).optional(),
  swiss_points_per_loss: z.number().int().min(0).optional(),
  enable_top_cut: z.boolean().optional(),
  top_cut_size: z.number().int().min(2).optional(),
  prize_distribution: z.string().optional().nullable(),
  bracket_settings: z.string().optional().nullable(),
  opening_best_of: z.number().int().min(1).max(5).optional(),
  progression_best_of: z.number().int().min(1).max(5).optional(),
  elimination_best_of: z.number().int().min(1).max(5).optional(),
  finals_best_of: z.number().int().min(1).max(5).optional(),
});

// GET /api/tournaments/[id] - Get a single tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get registration count
    const { count } = await supabase
      .from('tournament_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', id);

    return NextResponse.json({ ...data, registered_teams_count: count || 0 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/tournaments/[id] - Update a tournament
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Validate input
    const validatedData = updateTournamentSchema.parse(body);

    // Validate dates if both are provided
    if (validatedData.start_date && validatedData.end_date) {
      if (new Date(validatedData.end_date) <= new Date(validatedData.start_date)) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('tournaments')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
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

// DELETE /api/tournaments/[id] - Delete a tournament
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const { error } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Tournament deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
