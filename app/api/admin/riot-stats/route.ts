import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  console.log('🔍 API Route: Starting riot-stats request')
  
  try {
    console.log('🔍 API Route: Creating Supabase client...')
    const supabase = await createClient()
    console.log('🔍 API Route: Supabase client created successfully')
    
    const { searchParams } = new URL(request.url)
    const timeWindow = searchParams.get('timeWindow') || '1h'
    console.log('🔍 API Route: Time window:', timeWindow)

    // Calculate time window
    const timeMultipliers: Record<string, number> = {
      '10s': 10 * 1000,
      '1m': 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    }
    const timeAgo = new Date(Date.now() - (timeMultipliers[timeWindow] || 60 * 60 * 1000)).toISOString()

    console.log('🔍 API Route: Querying logs since:', timeAgo)

    // Fetch logs from database
    const { data, error } = await supabase
      .from('riot_request_logs')
      .select('*')
      .gte('created_at', timeAgo)

    console.log('🔍 API Route: Query completed')
    console.log('🔍 API Route: Data length:', data?.length)
    console.log('🔍 API Route: Error:', error)

    if (error) {
      console.error('❌ Error fetching Riot API stats:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch stats', 
        details: error.message || 'Unknown error',
        hint: 'Check database connection and table existence'
      }, { status: 500 })
    }

    // Calculate stats
    const stats = {
      total: data?.length || 0,
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
    }

    if (!data || data.length === 0) {
      return NextResponse.json(stats)
    }

    // Calculate endpoint-specific stats
    data.forEach((log: any) => {
      if (log.riot_api_endpoint.includes('account/v1')) {
        stats.account++
      } else if (log.riot_api_endpoint.includes('summoner/v4')) {
        stats.summoner++
      } else if (log.riot_api_endpoint.includes('league/v4')) {
        stats.league++
      }

      if (log.status_code >= 400) {
        stats.errorRate++
      }
      stats.avgResponseTime += log.response_time_ms || 0
    })

    stats.errorRate = Math.round((stats.errorRate / stats.total) * 100)
    stats.avgResponseTime = Math.round(stats.avgResponseTime / stats.total)

    // Calculate rate limit status
    const timeMultiplier = timeWindow === '1m' ? 1 : timeWindow === '10s' ? 0.167 : 1
    
    stats.rateLimitStatus = {
      account: {
        used: stats.account,
        limit: Math.round(1000 * timeMultiplier), // 1000 requests/min
        percentage: Math.round((stats.account / (1000 * timeMultiplier)) * 100)
      },
      summoner: {
        used: stats.summoner,
        limit: Math.round(1600 * timeMultiplier), // 1600 requests/min
        percentage: Math.round((stats.summoner / (1600 * timeMultiplier)) * 100)
      },
      league: {
        used: stats.league,
        limit: Math.round(20000 * timeMultiplier), // 20k requests/10s
        percentage: Math.round((stats.league / (20000 * timeMultiplier)) * 100)
      }
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('❌❌❌ CRITICAL ERROR in riot-stats route:', error)
    console.error('❌ Error type:', typeof error)
    console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown')
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      type: typeof error
    }, { status: 500 })
  }
}
