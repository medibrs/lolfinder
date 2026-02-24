import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateAndUploadTeamAvatar } from '@/lib/azure/image-validation';
import { ratelimit } from '@/lib/rate-limit/upstash';
import { logApiMetric } from '@/lib/telemetry/logger';

export async function POST(request: Request) {
    const startTime = Date.now();

    try {
        const ip = request.headers.get("x-forwarded-for") || "anonymous_ip";
        const { success, limit, remaining } = await ratelimit.limit(ip);

        if (!success) {
            await logApiMetric(request, { endpoint: '/api/teams/upload-avatar', method: 'POST', statusCode: 429, responseTimeMs: Date.now() - startTime });
            return NextResponse.json({ error: 'Too many uploads. Please wait a minute.' }, { status: 429 });
        }
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const teamId = formData.get('teamId') as string;

        if (!file || !teamId) {
            return NextResponse.json({ error: 'Missing file or teamId' }, { status: 400 });
        }

        // 2MB limit
        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json({ error: 'File size must be less than 2MB' }, { status: 400 });
        }

        // Check if user is the team captain
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('captain_id, name')
            .eq('id', teamId)
            .single();

        if (teamError || !team || team.captain_id !== user.id) {
            return NextResponse.json({ error: 'Only team captains can update avatar' }, { status: 403 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Use the unified helper for validation and upload
        const imageUrl = await validateAndUploadTeamAvatar(buffer, file.name, 'team-avatars');

        // Update the team's avatar in the database
        const { error: updateError } = await supabase
            .from('teams')
            .update({ team_avatar: imageUrl })
            .eq('id', teamId);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        await logApiMetric(request, { endpoint: '/api/teams/upload-avatar', method: 'POST', statusCode: 200, responseTimeMs: Date.now() - startTime });

        return NextResponse.json({
            imageUrl,
            message: 'Avatar updated successfully'
        });
    } catch (error: any) {
        console.error('Error in upload-avatar API:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: error.message?.includes('rejected') ? 400 : 500 });
    }
}
