#!/usr/bin/env node

/**
 * Upload public image assets to Azure Blob Storage CDN.
 *
 * Usage:
 *   node scripts/upload-to-cdn.js            # upload all images
 *   node scripts/upload-to-cdn.js --dry-run   # list what would be uploaded
 *
 * Requires AZURE_STORAGE_CONNECTION_STRING in .env
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const CONTAINER_NAME = 'public-assets';
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

// Extensions to upload
const IMAGE_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico',
]);

// Files/dirs to skip (stay in /public for special purposes)
const SKIP_FILES = new Set([
    'site.webmanifest',
    'sw.js',
    'riot.txt',
]);

const SKIP_DIRS = new Set([
    'fonts',
]);

const MIME_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
};

function getAllImageFiles(dir, baseDir = dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) {
                continue;
            }
            results.push(...getAllImageFiles(fullPath, baseDir));
        } else if (entry.isFile()) {
            if (SKIP_FILES.has(entry.name)) {
                continue;
            }
            const ext = path.extname(entry.name).toLowerCase();
            if (IMAGE_EXTENSIONS.has(ext)) {
                results.push({ fullPath, relativePath, ext });
            }
        }
    }

    return results;
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (!connectionString) {
        console.error('❌ AZURE_STORAGE_CONNECTION_STRING not found in .env');
        process.exit(1);
    }

    const files = getAllImageFiles(PUBLIC_DIR);
    console.log(`\n📦 Found ${files.length} image files to upload\n`);

    if (dryRun) {
        console.log('🔍 DRY RUN — no files will be uploaded:\n');
        for (const file of files) {
            console.log(`  ${file.relativePath}`);
        }
        console.log(`\n✅ ${files.length} files would be uploaded to container "${CONTAINER_NAME}"`);
        return;
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

    // Create container with public blob access if it doesn't exist
    try {
        await containerClient.createIfNotExists({ access: 'blob' });
        console.log(`✅ Container "${CONTAINER_NAME}" ready\n`);
    } catch (err) {
        console.error(`❌ Failed to create container: ${err.message}`);
        process.exit(1);
    }

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of files) {
        const blobName = file.relativePath.replace(/\\/g, '/'); // normalize Windows paths
        const contentType = MIME_TYPES[file.ext] || 'application/octet-stream';

        try {
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            const data = fs.readFileSync(file.fullPath);

            await blockBlobClient.uploadData(data, {
                blobHTTPHeaders: {
                    blobContentType: contentType,
                    blobCacheControl: 'public, max-age=31536000, immutable', // 1 year cache
                },
                overwriteExisting: true,
            });

            console.log(`  ✅ ${blobName} (${(data.length / 1024).toFixed(1)} KB)`);
            uploaded++;
        } catch (err) {
            console.error(`  ❌ ${blobName}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n📊 Results:`);
    console.log(`  Uploaded: ${uploaded}`);
    if (skipped > 0) console.log(`  Skipped:  ${skipped}`);
    if (failed > 0) console.log(`  Failed:   ${failed}`);
    console.log(`\n🌐 CDN Base URL: https://lolfinderassets.blob.core.windows.net/${CONTAINER_NAME}`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
