import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import sharp from 'sharp';
import { analyzeImageSafety, getFlaggedCategories, analyzeImageVision, validateImageTags } from '@/lib/azure/content-safety';
import { uploadToBlob } from '@/lib/azure/storage';
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
        const base64Image = buffer.toString('base64');
        const extension = file.name.split('.').pop()?.toLowerCase() || 'png';

        // --- Azure Content Safety & Vision Check ---
        try {
            // A: Harmful Content Safety 
            const imageResult = await analyzeImageSafety(base64Image);
            const flaggedCategories = getFlaggedCategories(imageResult);

            if (flaggedCategories.length > 0) {
                return NextResponse.json({
                    error: `Upload rejected. Image flagged for: ${flaggedCategories.join(', ')}`
                }, { status: 400 });
            }

            // B: Contextual Accuracy (Ensure it is a logo/graphic)
            const visionResult = await analyzeImageVision(buffer);
            const validLogoTags = ['logo', 'icon', 'graphic', 'design', 'clipart', 'illustration', 'symbol', 'text', 'font', 'drawing', 'sports', 'esports', 'badge'];
            const tagCheck = validateImageTags(visionResult, validLogoTags, 0.4);

            if (!tagCheck.isValid) {
                return NextResponse.json({
                    error: `Image rejected. Please upload a valid logo or graphic icon.`
                }, { status: 400 });
            }
        } catch (error) {
            console.error('Failed to verify avatar content safety:', error);
            return NextResponse.json({ error: 'Failed to verify image safety' }, { status: 500 });
        }
        // --- End Azure Content Safety Check ---

        const originalBlobName = `${teamId}/original.${extension}`;
        const compressedBlobName = `${teamId}/compressed-${Date.now()}.webp`;

        // 1. Upload original uncompressed image first
        await uploadToBlob('logos', originalBlobName, buffer, file.type || 'image/png');

        // 2. Resize image using sharp for UI caching
        const resizedBuffer = await sharp(buffer)
            .resize(256, 256, {
                fit: 'cover',
                withoutEnlargement: true
            })
            .webp({ quality: 80 })
            .toBuffer();

        // 3. Upload the newly compressed WebP file
        const fileUrl = await uploadToBlob('logos', compressedBlobName, resizedBuffer, 'image/webp');

        // Update team avatar in Supabase
        const { data: updatedTeam, error: updateError } = await supabase
            .from('teams')
            .update({ team_avatar: fileUrl })
            .eq('id', teamId)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating team avatar:', updateError);
            await logApiMetric(request, { endpoint: '/api/teams/upload-avatar', method: 'POST', statusCode: 500, responseTimeMs: Date.now() - startTime });
            return NextResponse.json({ error: 'Failed to update avatar in database' }, { status: 500 });
        }

        await logApiMetric(request, { endpoint: '/api/teams/upload-avatar', method: 'POST', statusCode: 200, responseTimeMs: Date.now() - startTime });
        return NextResponse.json({ success: true, url: fileUrl, team: updatedTeam });
    } catch (error) {
        console.error('Error uploading avatar:', error);
        await logApiMetric(request, { endpoint: '/api/teams/upload-avatar', method: 'POST', statusCode: 500, responseTimeMs: Date.now() - startTime });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
