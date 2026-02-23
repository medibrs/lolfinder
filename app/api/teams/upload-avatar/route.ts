import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BlobServiceClient } from '@azure/storage-blob';
import sharp from 'sharp';

export async function POST(request: Request) {
    try {
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

        // 2MB limit (2 * 1024 * 1024)
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

        // Connect to Azure Blob Storage
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            return NextResponse.json({ error: 'Storage configuration error' }, { status: 500 });
        }

        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient('logos');
        // Use team ID for blob folder path to ensure uniqueness and avoid unsafe user input
        const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
        const originalBlobName = `${teamId}/original.${extension}`;
        const compressedBlobName = `${teamId}/compressed-${Date.now()}.webp`;

        const originalBlobClient = containerClient.getBlockBlobClient(originalBlobName);
        const compressedBlobClient = containerClient.getBlockBlobClient(compressedBlobName);

        // Upload data to the blob
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 1. Upload original uncompressed image first
        await originalBlobClient.uploadData(buffer, {
            blobHTTPHeaders: { blobContentType: file.type }
        });

        // 2. Resize image using sharp for UI caching
        const resizedBuffer = await sharp(buffer)
            .resize(256, 256, {
                fit: 'cover',
                withoutEnlargement: true
            })
            .webp({ quality: 80 })
            .toBuffer();

        // 3. Upload the newly compressed WebP file
        await compressedBlobClient.uploadData(resizedBuffer, {
            blobHTTPHeaders: { blobContentType: 'image/webp' }
        });

        const fileUrl = compressedBlobClient.url;

        // Update team avatar in Supabase
        const { data: updatedTeam, error: updateError } = await supabase
            .from('teams')
            .update({ team_avatar: fileUrl })
            .eq('id', teamId)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating team avatar:', updateError);
            return NextResponse.json({ error: 'Failed to update avatar in database' }, { status: 500 });
        }

        return NextResponse.json({ success: true, url: fileUrl, team: updatedTeam });
    } catch (error) {
        console.error('Error uploading avatar:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
