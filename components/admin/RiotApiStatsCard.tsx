'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getRiotApiUsageStats } from '@/lib/riot-logging'

interface RateLimitStatus {
  used: number
  limit: number
  percentage: number
}

interface RiotStats {
  total: number
  account: number
  summoner: number
  league: number
  errorRate: number
  avgResponseTime: number
  rateLimitStatus: {
    account: RateLimitStatus
    summoner: RateLimitStatus
    league: RateLimitStatus
  }
}

export default function RiotApiStatsCard() {
  const [stats, setStats] = useState<RiotStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeWindow, setTimeWindow] = useState('1h')

  const fetchStats = async () => {
    setLoading(true)
    try {
      const data = await getRiotApiUsageStats(timeWindow)
      setStats(data)
    } catch (error) {
      console.error('Error fetching Riot API stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [timeWindow])

  const getRateLimitColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-500'
    if (percentage >= 70) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getRateLimitBg = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500/20'
    if (percentage >= 70) return 'bg-yellow-500/20'
    return 'bg-green-500/20'
  }

  if (loading) {
    return (
      <Card className="bg-card border-border p-6">
        <div className="text-4xl mb-4">📊</div>
        <h3 className="text-xl font-bold mb-4">Riot API Statistics</h3>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </div>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card className="bg-card border-border p-6">
        <div className="text-4xl mb-4">📊</div>
        <h3 className="text-xl font-bold mb-4">Riot API Statistics</h3>
        <p className="text-muted-foreground">Unable to load statistics</p>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border p-6">
      <div className="text-4xl mb-4">📊</div>
      <h3 className="text-xl font-bold mb-4">Riot API Statistics</h3>
      
      {/* Time Window Selector */}
      <div className="flex gap-2 mb-4">
        {['10s', '1m', '1h', '24h'].map((window) => (
          <Button
            key={window}
            variant={timeWindow === window ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeWindow(window)}
          >
            {window}
          </Button>
        ))}
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-3 bg-muted/50 rounded">
          <div className="text-2xl font-bold text-primary">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Requests</div>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded">
          <div className="text-2xl font-bold text-blue-500">{stats.avgResponseTime}ms</div>
          <div className="text-xs text-muted-foreground">Avg Response</div>
        </div>
      </div>

      {/* Rate Limit Status */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground">Rate Limit Usage</h4>
        
        {/* Account API */}
        <div className={`p-3 rounded ${getRateLimitBg(stats.rateLimitStatus.account.percentage)}`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Account API</span>
            <span className={`text-sm font-bold ${getRateLimitColor(stats.rateLimitStatus.account.percentage)}`}>
              {stats.rateLimitStatus.account.used}/{stats.rateLimitStatus.account.limit}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                stats.rateLimitStatus.account.percentage >= 90 ? 'bg-red-500' :
                stats.rateLimitStatus.account.percentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(stats.rateLimitStatus.account.percentage, 100)}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.rateLimitStatus.account.percentage}% used (1000/min)
          </div>
        </div>

        {/* Summoner API */}
        <div className={`p-3 rounded ${getRateLimitBg(stats.rateLimitStatus.summoner.percentage)}`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Summoner API</span>
            <span className={`text-sm font-bold ${getRateLimitColor(stats.rateLimitStatus.summoner.percentage)}`}>
              {stats.rateLimitStatus.summoner.used}/{stats.rateLimitStatus.summoner.limit}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                stats.rateLimitStatus.summoner.percentage >= 90 ? 'bg-red-500' :
                stats.rateLimitStatus.summoner.percentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(stats.rateLimitStatus.summoner.percentage, 100)}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.rateLimitStatus.summoner.percentage}% used (1600/min)
          </div>
        </div>

        {/* League API */}
        <div className={`p-3 rounded ${getRateLimitBg(stats.rateLimitStatus.league.percentage)}`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">League API</span>
            <span className={`text-sm font-bold ${getRateLimitColor(stats.rateLimitStatus.league.percentage)}`}>
              {stats.rateLimitStatus.league.used}/{stats.rateLimitStatus.league.limit}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                stats.rateLimitStatus.league.percentage >= 90 ? 'bg-red-500' :
                stats.rateLimitStatus.league.percentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(stats.rateLimitStatus.league.percentage, 100)}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.rateLimitStatus.league.percentage}% used (20k/10s)
          </div>
        </div>
      </div>

      {/* Error Rate */}
      {stats.errorRate > 0 && (
        <div className="mt-4 p-3 bg-red-500/20 rounded">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-red-400">Error Rate</span>
            <span className="text-sm font-bold text-red-400">{stats.errorRate}%</span>
          </div>
        </div>
      )}

      <Button 
        onClick={fetchStats} 
        variant="outline" 
        size="sm" 
        className="w-full mt-4"
      >
        Refresh
      </Button>
    </Card>
  )
}
