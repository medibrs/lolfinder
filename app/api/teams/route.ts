import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';
import sharp from 'sharp';
import { analyzeTextSafety, analyzeImageSafety, getFlaggedCategories, analyzeImageVision, validateImageTags } from '@/lib/azure/content-safety';
import { uploadToBlob } from '@/lib/azure/storage';

// Validation schema
const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  captain_id: z.string().uuid(),
  open_positions: z.array(z.enum(['Top', 'Jungle', 'Mid', 'ADC', 'Support'])).default([]),
  recruiting_status: z.enum(['Open', 'Closed', 'Full']).default('Open'),
  team_size: z.number().default(5),
  team_avatar: z.union([z.number(), z.string()]).optional(),
});


// GET /api/teams - List all teams with optional filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recruiting = searchParams.get('recruiting');
    const role = searchParams.get('role');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Parallelize the data query and count query
    let countQuery = supabase.from('teams')
      .select('*', { count: 'exact', head: true })
      .or('is_bot.is.null,is_bot.eq.false');
    if (recruiting) countQuery = countQuery.eq('recruiting_status', recruiting);
    if (role) countQuery = countQuery.contains('open_positions', [role]);

    let dataQuery = supabase.from('teams')
      .select('id, name, captain_id, open_positions, team_size, recruiting_status, team_avatar, created_at, is_bot, captain:players!captain_id(summoner_name)')
      .or('is_bot.is.null,is_bot.eq.false');
    if (recruiting) dataQuery = dataQuery.eq('recruiting_status', recruiting);
    if (role) dataQuery = dataQuery.contains('open_positions', [role]);
    dataQuery = dataQuery.order('created_at', { ascending: false });

    const offset = (page - 1) * limit;
    dataQuery = dataQuery.range(offset, offset + limit - 1);

    // Fire BOTH in parallel — saves one full round-trip
    const [{ count: totalCount }, { data, error }] = await Promise.all([countQuery, dataQuery]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get member counts in ONE query using .in() instead of N separate queries
    const teamIds = (data || []).map(t => t.id);
    let memberCounts: Record<string, number> = {};

    if (teamIds.length > 0) {
      const { data: members } = await supabase
        .from('players')
        .select('team_id')
        .in('team_id', teamIds);

      // Count in JS (instant, no extra DB calls)
      members?.forEach(m => {
        memberCounts[m.team_id] = (memberCounts[m.team_id] || 0) + 1;
      });
    }

    const teamsWithCounts = (data || []).map(team => ({
      ...team,
      member_count: memberCounts[team.id] || 0,
    }));

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
    const contentType = request.headers.get('content-type') || '';
    let body: any = {};
    let file: File | null = null;
    let base64Image: string | null = null;
    let fileType: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      file = formData.get('file') as File | null;

      const openPositions = formData.getAll('open_positions');

      body = {
        name: formData.get('name') as string,
        description: formData.get('description') ? formData.get('description') as string : undefined,
        captain_id: formData.get('captain_id') as string,
        open_positions: openPositions.length > 0 ? openPositions : [],
        recruiting_status: formData.get('recruiting_status') ? formData.get('recruiting_status') as string : 'Open',
        team_size: formData.get('team_size') ? parseInt(formData.get('team_size') as string) : 5,
      };
    } else {
      body = await request.json();
    }

    // Validate input
    const validatedData = createTeamSchema.parse(body);

    // --- Content Safety Validation ---
    try {
      // 1. Validate Text (Name)
      const textResult = await analyzeTextSafety(validatedData.name);

      let flaggedCats = getFlaggedCategories(textResult);
      if (flaggedCats.length > 0) {
        return NextResponse.json({
          error: `Team name rejected. Flagged for: ${flaggedCats.join(', ')}`
        }, { status: 400 });
      }

      // 2. Validate Image (if provided)
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        base64Image = buffer.toString('base64');
        fileType = file.type;

        // A: Content Safety Verification (Hate/Sexual/etc)
        const imageResult = await analyzeImageSafety(base64Image);
        let imgFlaggedCats = getFlaggedCategories(imageResult);

        if (imgFlaggedCats.length > 0) {
          return NextResponse.json({
            error: `Upload rejected. Image flagged for: ${imgFlaggedCats.join(', ')}`
          }, { status: 400 });
        }

        // B: Ensure it is actually a logo/graphic
        const visionResult = await analyzeImageVision(buffer);
        const validLogoTags = ['logo', 'icon', 'graphic', 'design', 'clipart', 'illustration', 'symbol', 'text', 'font', 'drawing', 'sports', 'esports', 'badge'];
        const tagCheck = validateImageTags(visionResult, validLogoTags, 0.4);

        if (!tagCheck.isValid) {
          return NextResponse.json({
            error: `Image rejected. Please upload a valid logo or graphic icon.`
          }, { status: 400 });
        }
      }
    } catch (safetyError) {
      console.error('Content Safety API error:', safetyError);
      return NextResponse.json({ error: 'Failed to verify content safety' }, { status: 500 });
    }
    // --- End Content Safety Validation ---

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

    if (!existingCaptain.summoner_name || !existingCaptain.main_role || !existingCaptain.secondary_role) {
      return NextResponse.json(
        { error: 'Please complete your player profile before creating a team.' },
        { status: 400 }
      );
    }

    if (existingCaptain.team_id) {
      return NextResponse.json(
        { error: 'You are already in a team and cannot create a new team' },
        { status: 403 }
      );
    }

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

    // Note: Avatar checks for pre-existing are skipped here because file uploads are processed directly after.
    const dbPayload = { ...validatedData };

    // Create the team
    const { data, error } = await supabase
      .from('teams')
      .insert([dbPayload])
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

    // --- Upload Avatar strictly after DB creation ---
    if (file && base64Image) {
      try {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
        const teamId = data.id;
        const originalBlobName = `${teamId}/original.${extension}`;
        const compressedBlobName = `${teamId}/compressed-${Date.now()}.webp`;

        const buffer = Buffer.from(base64Image, 'base64');

        await uploadToBlob('logos', originalBlobName, buffer, fileType || 'image/png');

        const resizedBuffer = await sharp(buffer)
          .resize(256, 256, {
            fit: 'cover',
            withoutEnlargement: true
          })
          .webp({ quality: 80 })
          .toBuffer();

        const fileUrl = await uploadToBlob('logos', compressedBlobName, resizedBuffer, 'image/webp');

        await supabase
          .from('teams')
          .update({ team_avatar: fileUrl })
          .eq('id', teamId);

        data.team_avatar = fileUrl;
      } catch (uploadError) {
        console.error('Failed to upload blob:', uploadError);
        // Note: The team was successfully created but avatar failed. They can fix it in 'Manage Team'.
      }
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
