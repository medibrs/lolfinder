import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Validation schema
const updateStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

// PUT /api/tournament-registrations/[id]/status - Update registration status (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Validate input
    const validatedData = updateStatusSchema.parse(body);

    // Get current user
    const authHeader = request.headers.get('authorization');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user is admin
    const isAdmin = user.app_metadata?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get registration with team and tournament details
    const { data: registration, error: regError } = await supabase
      .from('tournament_registrations')
      .select(`
        *,
        team:teams(id, name, captain_id),
        tournament:tournaments(id, name)
      `)
      .eq('id', id)
      .single();

    if (regError || !registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // Update status
    const { error: updateError } = await supabase
      .from('tournament_registrations')
      .update({ status: validatedData.status })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Create notification for team captain based on status
    if (validatedData.status === 'approved') {
      await supabase
        .from('notifications')
        .insert([{
          user_id: registration.team.captain_id,
          type: 'tournament_approved',
          title: `Tournament Registration Approved!`,
          message: `Your team "${registration.team.name}" has been approved for ${registration.tournament.name}!`,
          data: {
            tournament_id: registration.tournament.id,
            tournament_name: registration.tournament.name,
            team_id: registration.team.id,
            registration_id: id,
          }
        }]);
    } else if (validatedData.status === 'rejected') {
      await supabase
        .from('notifications')
        .insert([{
          user_id: registration.team.captain_id,
          type: 'tournament_rejected',
          title: `Tournament Registration Declined`,
          message: `Your team's registration for ${registration.tournament.name} was not approved.`,
          data: {
            tournament_id: registration.tournament.id,
            tournament_name: registration.tournament.name,
            team_id: registration.team.id,
            registration_id: id,
          }
        }]);
    }

    return NextResponse.json({ message: 'Status updated successfully', status: validatedData.status });
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
