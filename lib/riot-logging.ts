import { supabase } from '@/lib/supabase';

interface RiotLogData {
  userId?: string;
  endpoint: string;
  statusCode: number;
  responseTimeMs: number;
  riotApiEndpoint: string;
  summonerName?: string;
  ipAddress?: string;
  userAgent?: string;
}

// Rate limits from Riot API
export const RIOT_RATE_LIMITS = {
  account: { requests: 1000, window: 60 }, // 1000 requests per 1 minute
  summoner: { requests: 1600, window: 60 }, // 1600 requests per 1 minute  
  league: { requests: 20000, window: 10 }, // 20000 requests per 10 seconds
  league_burst: { requests: 1200000, window: 600 } // 1.2M requests per 10 minutes
};

export async function logRiotRequest(data: RiotLogData) {
  try {
    const { error } = await supabase
      .from('riot_request_logs')
      .insert({
        user_id: data.userId || null,
        endpoint: data.endpoint,
        method: 'GET',
        status_code: data.statusCode,
        response_time_ms: data.responseTimeMs,
        riot_api_endpoint: data.riotApiEndpoint,
        summoner_name: data.summonerName,
        ip_address: data.ipAddress,
        user_agent: data.userAgent,
      });

    if (error) {
      console.error('Failed to log Riot request:', error);
    }
  } catch (error) {
    console.error('Error logging Riot request:', error);
  }
}

export async function getRiotApiUsageStats(timeWindow: string = '1h') {
  try {
    const { data, error } = await supabase
      .from('riot_request_logs')
      .select('*')
      .gte('created_at', new Date(Date.now() - parseTimeWindow(timeWindow)).toISOString());

    if (error) throw error;

    // Group by endpoint and calculate usage
    const stats = {
      total: data?.length || 0,
      account: 0,
      summoner: 0,
      league: 0,
      errorRate: 0,
      avgResponseTime: 0,
      rateLimitStatus: {} as Record<string, { used: number; limit: number; percentage: number }>
    };

    if (!data || data.length === 0) return stats;

    // Calculate endpoint-specific stats
    data.forEach(log => {
      if (log.riot_api_endpoint.includes('account/v1')) {
        stats.account++;
      } else if (log.riot_api_endpoint.includes('summoner/v4')) {
        stats.summoner++;
      } else if (log.riot_api_endpoint.includes('league/v4')) {
        stats.league++;
      }

      if (log.status_code >= 400) {
        stats.errorRate++;
      }
      stats.avgResponseTime += log.response_time_ms || 0;
    });

    stats.errorRate = Math.round((stats.errorRate / stats.total) * 100);
    stats.avgResponseTime = Math.round(stats.avgResponseTime / stats.total);

    // Calculate rate limit status
    const timeMultiplier = timeWindow === '1m' ? 1 : timeWindow === '10s' ? 0.167 : 1;
    
    stats.rateLimitStatus = {
      account: {
        used: stats.account,
        limit: Math.round(RIOT_RATE_LIMITS.account.requests * timeMultiplier),
        percentage: Math.round((stats.account / (RIOT_RATE_LIMITS.account.requests * timeMultiplier)) * 100)
      },
      summoner: {
        used: stats.summoner,
        limit: Math.round(RIOT_RATE_LIMITS.summoner.requests * timeMultiplier),
        percentage: Math.round((stats.summoner / (RIOT_RATE_LIMITS.summoner.requests * timeMultiplier)) * 100)
      },
      league: {
        used: stats.league,
        limit: Math.round(RIOT_RATE_LIMITS.league.requests * timeMultiplier),
        percentage: Math.round((stats.league / (RIOT_RATE_LIMITS.league.requests * timeMultiplier)) * 100)
      }
    } as {
      account: { used: number; limit: number; percentage: number };
      summoner: { used: number; limit: number; percentage: number };
      league: { used: number; limit: number; percentage: number };
    };

    return stats;
  } catch (error) {
    console.error('Error fetching Riot API stats:', error);
    return {
      total: 0,
      account: 0,
      summoner: 0,
      league: 0,
      errorRate: 0,
      avgResponseTime: 0,
      rateLimitStatus: {
        account: { used: 0, limit: 0, percentage: 0 },
        summoner: { used: 0, limit: 0, percentage: 0 },
        league: { used: 0, limit: 0, percentage: 0 }
      }
    };
  }
}

function parseTimeWindow(window: string): number {
  const multipliers: Record<string, number> = {
    '10s': 10 * 1000,
    '1m': 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000
  };
  return multipliers[window] || 60 * 60 * 1000; // Default to 1 hour
}
