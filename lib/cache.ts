// Simple client-side SWR (stale-while-revalidate) cache for page data.
// Data persists across Next.js client-side navigations since module scope survives.
// This means switching between /players and /teams is INSTANT on return visits.

interface CacheEntry<T> {
    data: T
    timestamp: number
}

const cache = new Map<string, CacheEntry<any>>()

// How long cached data is considered "fresh" (no refetch needed)
const FRESH_MS = 30_000 // 30 seconds

// How long cached data can be shown while refetching in background
const STALE_MS = 120_000 // 2 minutes

export function getCached<T>(key: string): { data: T | null; isFresh: boolean; isStale: boolean } {
    const entry = cache.get(key)
    if (!entry) return { data: null, isFresh: false, isStale: false }

    const age = Date.now() - entry.timestamp

    if (age < FRESH_MS) {
        return { data: entry.data, isFresh: true, isStale: false }
    }

    if (age < STALE_MS) {
        return { data: entry.data, isFresh: false, isStale: true }
    }

    // Too old, treat as miss
    cache.delete(key)
    return { data: null, isFresh: false, isStale: false }
}

export function setCache<T>(key: string, data: T): void {
    cache.set(key, { data, timestamp: Date.now() })
}

export function invalidateCache(keyPrefix?: string): void {
    if (!keyPrefix) {
        cache.clear()
        return
    }
    for (const key of cache.keys()) {
        if (key.startsWith(keyPrefix)) cache.delete(key)
    }
}
