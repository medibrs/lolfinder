/**
 * Universal Client-Side Cache System
 * 
 * Features:
 * - TTL (Time To Live) support
 * - Type safety with TypeScript generics
 * - Cache invalidation strategies
 * - Storage quota management
 * - Event-driven updates
 * - Debug logging
 */

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds (default: 5 minutes)
  namespace?: string // Cache namespace for isolation
  maxSize?: number // Maximum number of items per namespace
  persist?: boolean // Use localStorage or memory only
}

export interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
  namespace: string
  key: string
}

export interface CacheStats {
  totalItems: number
  namespaces: { [key: string]: number }
  memoryUsage: number
  hitRate: number
}

class CacheManager {
  private memoryCache = new Map<string, CacheItem<any>>()
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  }

  /**
   * Get cached data
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const { namespace = 'default', persist = true } = options
    const fullKey = this.buildKey(key, namespace)
    
    try {
      // Try localStorage first if persistence is enabled
      if (persist && typeof window !== 'undefined') {
        const stored = localStorage.getItem(fullKey)
        if (stored) {
          const item: CacheItem<T> = JSON.parse(stored)
          
          // Check if expired
          if (this.isExpired(item)) {
            this.remove(key, { namespace })
            this.stats.misses++
            return null
          }
          
          // Update memory cache
          this.memoryCache.set(fullKey, item)
          this.stats.hits++
          return item.data
        }
      }
      
      // Fallback to memory cache
      const memoryItem = this.memoryCache.get(fullKey)
      if (memoryItem) {
        if (this.isExpired(memoryItem)) {
          this.memoryCache.delete(fullKey)
          this.stats.misses++
          return null
        }
        this.stats.hits++
        return memoryItem.data
      }
      
      this.stats.misses++
      return null
    } catch (error) {
      console.error('Cache get error:', error)
      this.stats.misses++
      return null
    }
  }

  /**
   * Set cached data
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const { 
      ttl = 5 * 60 * 1000, // 5 minutes default
      namespace = 'default',
      maxSize = 100,
      persist = true
    } = options
    
    const fullKey = this.buildKey(key, namespace)
    
    try {
      const item: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        namespace,
        key
      }
      
      // Check size limit and evict oldest if needed
      await this.enforceSizeLimit(namespace, maxSize)
      
      // Store in memory
      this.memoryCache.set(fullKey, item)
      
      // Store in localStorage if persistence is enabled
      if (persist && typeof window !== 'undefined') {
        localStorage.setItem(fullKey, JSON.stringify(item))
      }
      
      this.stats.sets++
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  /**
   * Remove cached data
   */
  async remove(key: string, options: CacheOptions = {}): Promise<boolean> {
    const { namespace = 'default', persist = true } = options
    const fullKey = this.buildKey(key, namespace)
    
    try {
      // Remove from memory
      const memoryDeleted = this.memoryCache.delete(fullKey)
      
      // Remove from localStorage
      let storageDeleted = false
      if (persist && typeof window !== 'undefined') {
        localStorage.removeItem(fullKey)
        storageDeleted = true
      }
      
      this.stats.deletes++
      return memoryDeleted || storageDeleted
    } catch (error) {
      console.error('Cache remove error:', error)
      return false
    }
  }

  /**
   * Clear entire namespace or all cache
   */
  async clear(namespace?: string): Promise<void> {
    try {
      if (namespace) {
        // Clear specific namespace
        const keysToDelete: string[] = []
        
        // Clear memory cache
        for (const [key, item] of this.memoryCache.entries()) {
          if (item.namespace === namespace) {
            keysToDelete.push(key)
          }
        }
        keysToDelete.forEach(key => this.memoryCache.delete(key))
        
        // Clear localStorage
        if (typeof window !== 'undefined') {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith(`cache_${namespace}_`)) {
              localStorage.removeItem(key)
            }
          }
        }
      } else {
        // Clear everything
        this.memoryCache.clear()
        if (typeof window !== 'undefined') {
          const keysToRemove: string[] = []
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith('cache_')) {
              keysToRemove.push(key)
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key))
        }
      }
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  /**
   * Check if key exists and is not expired
   */
  async has(key: string, options: CacheOptions = {}): Promise<boolean> {
    const data = await this.get(key, options)
    return data !== null
  }

  /**
   * Get or set pattern - fetch data if not cached
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options)
    if (cached !== null) {
      return cached
    }
    
    // Fetch fresh data
    const data = await fetcher()
    
    // Cache the result
    await this.set(key, data, options)
    
    return data
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidate(pattern: string, namespace = 'default'): Promise<void> {
    try {
      const regex = new RegExp(pattern)
      const keysToDelete: string[] = []
      
      // Check memory cache
      for (const [key, item] of this.memoryCache.entries()) {
        if (item.namespace === namespace && regex.test(item.key)) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => this.memoryCache.delete(key))
      
      // Check localStorage
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith(`cache_${namespace}_`)) {
            const itemKey = key.replace(`cache_${namespace}_`, '')
            if (regex.test(itemKey)) {
              localStorage.removeItem(key)
            }
          }
        }
      }
    } catch (error) {
      console.error('Cache invalidate error:', error)
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const namespaces: { [key: string]: number } = {}
    let memoryUsage = 0
    
    for (const [_, item] of this.memoryCache.entries()) {
      namespaces[item.namespace] = (namespaces[item.namespace] || 0) + 1
      memoryUsage += JSON.stringify(item).length
    }
    
    const totalRequests = this.stats.hits + this.stats.misses
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0
    
    return {
      totalItems: this.memoryCache.size,
      namespaces,
      memoryUsage,
      hitRate
    }
  }

  /**
   * Clean up expired items
   */
  async cleanup(): Promise<number> {
    let cleaned = 0
    
    try {
      const keysToDelete: string[] = []
      
      // Check memory cache
      for (const [key, item] of this.memoryCache.entries()) {
        if (this.isExpired(item)) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => {
        this.memoryCache.delete(key)
        cleaned++
      })
      
      // Check localStorage
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith('cache_')) {
            try {
              const item: CacheItem<any> = JSON.parse(localStorage.getItem(key) || '')
              if (this.isExpired(item)) {
                localStorage.removeItem(key)
                cleaned++
              }
            } catch {
              // Remove corrupted items
              localStorage.removeItem(key)
              cleaned++
            }
          }
        }
      }
    } catch (error) {
      console.error('Cache cleanup error:', error)
    }
    
    return cleaned
  }

  // Private helper methods
  private buildKey(key: string, namespace: string): string {
    return `cache_${namespace}_${key}`
  }

  private isExpired(item: CacheItem<any>): boolean {
    return Date.now() - item.timestamp > item.ttl
  }

  private async enforceSizeLimit(namespace: string, maxSize: number): Promise<void> {
    const namespaceItems: Array<{ key: string; timestamp: number }> = []
    
    // Collect items in namespace
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.namespace === namespace) {
        namespaceItems.push({ key, timestamp: item.timestamp })
      }
    }
    
    // If over limit, remove oldest
    if (namespaceItems.length >= maxSize) {
      const sortedItems = namespaceItems.sort((a, b) => a.timestamp - b.timestamp)
      const toRemove = sortedItems.slice(0, namespaceItems.length - maxSize + 1)
      
      for (const item of toRemove) {
        this.memoryCache.delete(item.key)
        if (typeof window !== 'undefined') {
          localStorage.removeItem(item.key)
        }
      }
    }
  }
}

// Export singleton instance
export const cache = new CacheManager()

// Export convenience functions for common patterns
export const withCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: CacheOptions
) => cache.getOrSet(key, fetcher, options)

export const invalidateCache = (pattern: string, namespace = 'default') => 
  cache.invalidate(pattern, namespace)

// Predefined cache configurations for common use cases
export const CacheConfig = {
  USER_DATA: { ttl: 10 * 60 * 1000, namespace: 'user' }, // 10 minutes
  NOTIFICATIONS: { ttl: 5 * 60 * 1000, namespace: 'notifications' }, // 5 minutes
  API_RESPONSE: { ttl: 2 * 60 * 1000, namespace: 'api' }, // 2 minutes
  STATIC_DATA: { ttl: 60 * 60 * 1000, namespace: 'static' }, // 1 hour
  SESSION_DATA: { ttl: 30 * 60 * 1000, namespace: 'session' }, // 30 minutes
} as const
