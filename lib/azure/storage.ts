import { BlobServiceClient } from '@azure/storage-blob';

export async function uploadToBlob(
    containerName: string,
    blobName: string,
    buffer: Buffer,
    contentType: string
): Promise<string> {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
        throw new Error('Azure Storage configuration error');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Create container if it doesn't exist
    try {
        await containerClient.createIfNotExists({ access: 'blob' });
    } catch (e) {
        console.error(`Error checking/creating container ${containerName}:`, e);
    }

    const blobClient = containerClient.getBlockBlobClient(blobName);

    await blobClient.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: contentType }
    });

    return blobClient.url;
}
