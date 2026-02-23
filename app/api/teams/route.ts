import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Validation schema
const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  captain_id: z.string().uuid(),
  open_positions: z.array(z.enum(['Top', 'Jungle', 'Mid', 'ADC', 'Support'])).default([]),
  recruiting_status: z.enum(['Open', 'Closed', 'Full']).default('Open'),
  team_avatar: z.number().min(3905).max(4016).optional(),
});

// GET /api/teams - List all teams with optional filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recruiting = searchParams.get('recruiting');
    const role = searchParams.get('role');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase.from('teams')
      .select('*, captain:players!captain_id(*)')
      .or('is_bot.is.null,is_bot.eq.false');

    // Apply filters
    if (recruiting) {
      query = query.eq('recruiting_status', recruiting);
    }
    if (role) {
      query = query.contains('open_positions', [role]);
    }

    query = query.order('created_at', { ascending: false });

    // Get total count for pagination
    let countQuery = supabase.from('teams')
      .select('*', { count: 'exact', head: true })
      .or('is_bot.is.null,is_bot.eq.false');
    if (recruiting) {
      countQuery = countQuery.eq('recruiting_status', recruiting);
    }
    if (role) {
      countQuery = countQuery.contains('open_positions', [role]);
    }
    const { count: totalCount } = await countQuery;

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add member count to each team
    const teamsWithCounts = await Promise.all(
      (data || []).map(async (team) => {
        const { count } = await supabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id);

        return {
          ...team,
          member_count: count || 0,
        };
      })
    );

    return NextResponse.json({
      data: teamsWithCounts,
      pagination: {
        page,
        limit,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasMore: page < Math.ceil((totalCount || 0) / limit)
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/teams - Create a new team
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = createTeamSchema.parse(body);

    // Check if captain exists and has a complete profile
    const { data: existingCaptain, error: existingCaptainError } = await supabase
      .from('players')
      .select('id, team_id, summoner_name, main_role, secondary_role')
      .eq('id', validatedData.captain_id)
      .single();

    if (existingCaptainError || !existingCaptain) {
      return NextResponse.json(
        { error: 'You must create a player profile before creating a team. Please complete your profile first.' },
        { status: 400 }
      );
    }

    // Check if player profile is complete (Riot ID, Main Role, Secondary Role)
    if (!existingCaptain.summoner_name || !existingCaptain.main_role || !existingCaptain.secondary_role) {
      return NextResponse.json(
        { error: 'Please complete your player profile before creating a team.' },
        { status: 400 }
      );
    }

    // Check if player is already in a team
    if (existingCaptain.team_id) {
      return NextResponse.json(
        { error: 'You are already in a team and cannot create a new team' },
        { status: 403 }
      );
    }

    // Check if captain already owns a team
    const { data: existingTeam, error: teamCheckError } = await supabase
      .from('teams')
      .select('id')
      .eq('captain_id', validatedData.captain_id)
      .single();

    if (existingTeam && !teamCheckError) {
      return NextResponse.json(
        { error: 'You have already created a team and cannot create another' },
        { status: 403 }
      );
    }

    // Check if avatar is already taken (if avatar is provided)
    if (validatedData.team_avatar) {
      const { data: existingAvatarTeam, error: avatarCheckError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('team_avatar', validatedData.team_avatar)
        .single();

      if (avatarCheckError && avatarCheckError.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error checking avatar availability:', avatarCheckError);
        return NextResponse.json({ error: 'Failed to check avatar availability' }, { status: 500 });
      }

      if (existingAvatarTeam) {
        return NextResponse.json({
          error: 'Avatar already taken',
          message: `This avatar is already being used by ${existingAvatarTeam.name}`
        }, { status: 409 });
      }
    }

    // Create the team
    const { data, error } = await supabase
      .from('teams')
      .insert([validatedData])
      .select('*, captain:players!captain_id(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Update the captain's player record to link them to the team
    const { error: updateError } = await supabase
      .from('players')
      .update({
        team_id: data.id,
        looking_for_team: false
      })
      .eq('id', validatedData.captain_id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to link captain to team: ' + updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(data, { status: 201 });
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
