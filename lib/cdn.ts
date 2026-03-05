/**
 * CDN URL helper — resolves local /public paths to Azure Blob Storage CDN URLs.
 *
 * Set NEXT_PUBLIC_CDN_URL in .env to enable CDN serving.
 * Falls back to local paths when the env var is not set (e.g. local dev).
 */

const CDN_BASE = process.env.NEXT_PUBLIC_CDN_URL;

/**
 * Convert a local public asset path (e.g. "/logo.png") to its CDN URL.
 * If CDN is not configured, returns the original path unchanged.
 */
export function cdnUrl(path: string): string {
    if (!CDN_BASE) return path;
    return `${CDN_BASE}/${path.replace(/^\//, '')}`;
}
