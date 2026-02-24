import sharp from 'sharp';
import { analyzeImageSafety, getFlaggedCategories, analyzeImageVision, validateImageTags } from './content-safety';
import { uploadToBlob } from './storage';
import { AVATAR_TAGS, AVATAR_TAG_THRESHOLD } from './tags';

/**
 * Validates an image for safety and contextual accuracy (e.g. logo tags),
 * then resizes and uploads it to Azure Blob Storage.
 * 
 * @param buffer The image buffer
 * @param fileName Original file name to get extension
 * @param folder The folder in blob storage (e.g. 'team-avatars')
 * @returns The URL of the uploaded image
 */
export async function validateAndUploadTeamAvatar(buffer: Buffer, fileName: string, containerName: string = 'logos') {
    // --- Content Safety Check ---
    const base64Image = buffer.toString('base64');
    const imageResult = await analyzeImageSafety(base64Image);
    const flaggedCats = getFlaggedCategories(imageResult);

    if (flaggedCats.length > 0) {
        throw new Error(`Upload rejected. Image flagged for: ${flaggedCats.join(', ')}`);
    }

    // --- Vision / Tag Check ---
    const visionResult = await analyzeImageVision(buffer);
    const tagCheck = validateImageTags(visionResult, AVATAR_TAGS, AVATAR_TAG_THRESHOLD);

    if (!tagCheck.isValid) {
        throw new Error('Image rejected. Please upload a valid logo or graphic icon.');
    }

    // --- Resize & Process ---
    const processedBuffer = await sharp(buffer)
        .resize(400, 400, {
            fit: 'cover',
            position: 'center',
        })
        .png()
        .toBuffer();

    // --- Upload ---
    const blobName = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;

    return await uploadToBlob(containerName, blobName, processedBuffer, 'image/png');
}
