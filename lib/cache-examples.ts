/**
 * Examples of using the Universal Cache System
 * 
 * This file demonstrates how to use the cache system throughout the app
 * for various use cases like API calls, user data, and more.
 */

import { cache, withCache, CacheConfig, invalidateCache } from '@/lib/cache'
import { createClient } from '@/lib/supabase/client'

// Example 1: Caching API responses
export async function fetchPlayers(useCache = true) {
  if (useCache) {
    return withCache(
      'all_players',
      async () => {
        const supabase = createClient()
        const { data } = await supabase
          .from('players')
          .select('*')
          .order('created_at', { ascending: false })
        return data || []
      },
      { ...CacheConfig.API_RESPONSE, ttl: 2 * 60 * 1000 } // 2 minutes
    )
  }
  
  // Direct fetch without cache
  const supabase = createClient()
  const { data } = await supabase
    .from('players')
    .select('*')
    .order('created_at', { ascending: false })
  return data || []
}

// Example 2: Caching user profile data
export async function fetchUserProfile(userId: string) {
  return withCache(
    `user_profile_${userId}`,
    async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', userId)
        .single()
      return data
    },
    CacheConfig.USER_DATA
  )
}

// Example 3: Caching team data with custom TTL
export async function fetchTeamData(teamId: string) {
  return withCache(
    `team_data_${teamId}`,
    async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single()
      return data
    },
    { ttl: 10 * 60 * 1000, namespace: 'teams' } // 10 minutes, teams namespace
  )
}

// Example 4: Manual cache control
export class PlayerService {
  static async getPlayer(id: string) {
    // Try to get from cache first
    const cached = await cache.get(`player_${id}`, CacheConfig.USER_DATA)
    if (cached) return cached
    
    // Fetch fresh data
    const supabase = createClient()
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single()
    
    // Cache the result
    if (data) {
      await cache.set(`player_${id}`, data, CacheConfig.USER_DATA)
    }
    
    return data
  }
  
  static async updatePlayer(id: string, updates: any) {
    const supabase = createClient()
    const { data } = await supabase
      .from('players')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    // Update cache with fresh data
    if (data) {
      await cache.set(`player_${id}`, data, CacheConfig.USER_DATA)
    }
    
    return data
  }
  
  static async invalidatePlayerCache(id: string) {
    await cache.remove(`player_${id}`, CacheConfig.USER_DATA)
  }
}

// Example 5: Cache invalidation patterns
export const CacheInvalidation = {
  // Invalidate all user-related cache when user updates profile
  invalidateUserData: (userId: string) => {
    invalidateCache(`user_profile_${userId}`, 'user')
    invalidateCache(`user_notifications_.*`, 'notifications')
  },
  
  // Invalidate all team-related cache when team changes
  invalidateTeamData: (teamId: string) => {
    invalidateCache(`team_data_${teamId}`, 'teams')
    invalidateCache(`team_members_${teamId}`, 'teams')
  },
  
  // Clear all cache (useful for logout)
  clearAllCache: () => {
    cache.clear()
  },
  
  // Clear specific namespace
  clearApiCache: () => {
    cache.clear('api')
  }
}

// Example 6: React Hook for cached data
import { useState, useEffect } from 'react'

export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: Parameters<typeof withCache>[2]
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const result = await withCache(key, fetcher, options)
        setData(result)
        setError(null)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [key])
  
  const refetch = async () => {
    try {
      setLoading(true)
      await cache.remove(key, options)
      const result = await withCache(key, fetcher, options)
      setData(result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }
  
  return { data, loading, error, refetch }
}

// Example 7: Usage in components
/*
import { useCachedData } from '@/lib/cache-examples'

function PlayerList() {
  const { data: players, loading, error, refetch } = useCachedData(
    'all_players',
    fetchPlayers,
    CacheConfig.API_RESPONSE
  )
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  
  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      {players?.map(player => (
        <div key={player.id}>{player.summoner_name}</div>
      ))}
    </div>
  )
}
*/

// Example 8: Cache statistics and monitoring
export const CacheMonitor = {
  getStats: () => cache.getStats(),
  
  logStats: () => {
    const stats = cache.getStats()
    console.log('📊 Cache Statistics:', {
      totalItems: stats.totalItems,
      hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
      memoryUsage: `${(stats.memoryUsage / 1024).toFixed(1)} KB`,
      namespaces: stats.namespaces
    })
  },
  
  cleanup: async () => {
    const cleaned = await cache.cleanup()
    console.log(`🧹 Cleaned up ${cleaned} expired cache items`)
    return cleaned
  }
}
