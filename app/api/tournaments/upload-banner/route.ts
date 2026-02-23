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
        // Enforce strict rate limit using Upstash Redis
        const ip = request.headers.get("x-forwarded-for") || "anonymous_ip";
        const { success, limit, remaining } = await ratelimit.limit(ip);

        // Fail early if rate limited
        if (!success) {
            await logApiMetric(request, { endpoint: '/api/tournaments/upload-banner', method: 'POST', statusCode: 429, responseTimeMs: Date.now() - startTime });
            return NextResponse.json({ error: 'Too many uploads. Please wait a minute.' }, { status: 429 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            await logApiMetric(request, { endpoint: '/api/tournaments/upload-banner', method: 'POST', statusCode: 401, responseTimeMs: Date.now() - startTime });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const tournamentId = formData.get('tournamentId') as string;

        if (!file) {
            await logApiMetric(request, { endpoint: '/api/tournaments/upload-banner', method: 'POST', statusCode: 400, responseTimeMs: Date.now() - startTime });
            return NextResponse.json({ error: 'Missing file' }, { status: 400 });
        }

        // 5MB limit for banners (5 * 1024 * 1024)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
        }

        // Upload data
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

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

            // B: Contextual Accuracy for Banners
            const visionResult = await analyzeImageVision(buffer);
            // Allow gaming, esports, abstract backgrounds, landscapes, computer/hardware, graphics
            const validBannerTags = ['esports', 'video game', 'event', 'graphic', 'poster', 'banner', 'computer', 'landscape', 'abstract', 'design', 'tournament', 'text', 'game', 'play', 'competition'];
            const tagCheck = validateImageTags(visionResult, validBannerTags, 0.4);

            if (!tagCheck.isValid) {
                return NextResponse.json({
                    error: `Banner rejected. Please upload an esports or gaming related graphic.`
                }, { status: 400 });
            }
        } catch (error) {
            console.error('Failed to analyze banner content safety:', error);
            return NextResponse.json({ error: 'Failed to verify image safety' }, { status: 500 });
        }
        // --- End Azure Content Safety & Vision Check ---

        // Resize/compress banner for better performance
        const processedBuffer = await sharp(buffer)
            .resize(2000, 800, {
                fit: 'cover',
                position: 'center',
                withoutEnlargement: true
            })
            .webp({ quality: 85 })
            .toBuffer();

        const timestamp = Date.now();
        const fileName = tournamentId ? `${tournamentId}-${timestamp}.webp` : `new-${timestamp}.webp`;

        const fileUrl = await uploadToBlob('banners', fileName, processedBuffer, 'image/webp');

        // If tournamentId is provided, update the database directly
        if (tournamentId) {
            const { error: updateError } = await supabase
                .from('tournaments')
                .update({ banner_image: fileUrl })
                .eq('id', tournamentId);

            if (updateError) {
                console.error('Error updating tournament banner:', updateError);
                await logApiMetric(request, { endpoint: '/api/tournaments/upload-banner', method: 'POST', statusCode: 500, responseTimeMs: Date.now() - startTime });
                return NextResponse.json({ error: 'Failed to update banner in database' }, { status: 500 });
            }
        }

        await logApiMetric(request, { endpoint: '/api/tournaments/upload-banner', method: 'POST', statusCode: 200, responseTimeMs: Date.now() - startTime });
        return NextResponse.json({ success: true, url: fileUrl });
    } catch (error) {
        console.error('Error uploading banner:', error);
        await logApiMetric(request, { endpoint: '/api/tournaments/upload-banner', method: 'POST', statusCode: 500, responseTimeMs: Date.now() - startTime });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
