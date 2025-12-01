'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Activity, Database, Zap, BarChart3, RefreshCw } from 'lucide-react'

interface LatencyResult {
  operation: string
  latency: number
  timestamp: Date
  success: boolean
  error?: string
}

interface Stats {
  min: number
  max: number
  avg: number
  p50: number
  p95: number
  count: number
}

function calculateStats(results: LatencyResult[]): Stats | null {
  const successful = results.filter(r => r.success)
  if (successful.length === 0) return null
  
  const latencies = successful.map(r => r.latency).sort((a, b) => a - b)
  const sum = latencies.reduce((a, b) => a + b, 0)
  
  return {
    min: latencies[0],
    max: latencies[latencies.length - 1],
    avg: Math.round(sum / latencies.length),
    p50: latencies[Math.floor(latencies.length * 0.5)],
    p95: latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1],
    count: latencies.length
  }
}

function getLatencyColor(ms: number): string {
  if (ms < 50) return 'text-green-500'
  if (ms < 100) return 'text-yellow-500'
  if (ms < 200) return 'text-orange-500'
  return 'text-red-500'
}

function getLatencyBadge(ms: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (ms < 50) return 'default'
  if (ms < 100) return 'secondary'
  if (ms < 200) return 'outline'
  return 'destructive'
}

export default function LatencyTestPage() {
  const [results, setResults] = useState<LatencyResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [currentTest, setCurrentTest] = useState<string | null>(null)
  const supabase = createClient()

  const runTest = useCallback(async (operation: string, testFn: () => Promise<void>) => {
    const start = performance.now()
    let success = true
    let error: string | undefined

    try {
      await testFn()
    } catch (e) {
      success = false
      error = e instanceof Error ? e.message : 'Unknown error'
    }

    const latency = Math.round(performance.now() - start)
    
    setResults(prev => [...prev, {
      operation,
      latency,
      timestamp: new Date(),
      success,
      error
    }])

    return latency
  }, [])

  const runSimpleSelect = useCallback(async () => {
    setCurrentTest('Simple SELECT')
    await runTest('Simple SELECT (teams LIMIT 1)', async () => {
      const { error } = await supabase.from('teams').select('id').limit(1)
      if (error) throw error
    })
  }, [supabase, runTest])

  const runSelectWithJoin = useCallback(async () => {
    setCurrentTest('SELECT with Join')
    await runTest('SELECT with Join (players + teams)', async () => {
      const { error } = await supabase
        .from('players')
        .select('id, summoner_name, teams(id, name)')
        .limit(5)
      if (error) throw error
    })
  }, [supabase, runTest])

  const runCountQuery = useCallback(async () => {
    setCurrentTest('COUNT Query')
    await runTest('COUNT Query (teams)', async () => {
      const { error } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
      if (error) throw error
    })
  }, [supabase, runTest])

  const runFullTableScan = useCallback(async () => {
    setCurrentTest('Full Table Scan')
    await runTest('Full Table Scan (teams LIMIT 100)', async () => {
      const { error } = await supabase.from('teams').select('*').limit(100)
      if (error) throw error
    })
  }, [supabase, runTest])

  const runAuthCheck = useCallback(async () => {
    setCurrentTest('Auth Check')
    await runTest('Auth Check (getUser)', async () => {
      const { error } = await supabase.auth.getUser()
      if (error) throw error
    })
  }, [supabase, runTest])

  const runPingTest = useCallback(async () => {
    setCurrentTest('Ping (RPC)')
    await runTest('Ping (health check RPC)', async () => {
      // Simple query that should be very fast
      const { error } = await supabase.from('teams').select('id').limit(1).single()
      if (error && error.code !== 'PGRST116') throw error // Ignore "no rows" error
    })
  }, [supabase, runTest])

  const runAllTests = useCallback(async (iterations: number = 1) => {
    setIsRunning(true)
    
    for (let i = 0; i < iterations; i++) {
      await runPingTest()
      await new Promise(r => setTimeout(r, 100))
      
      await runSimpleSelect()
      await new Promise(r => setTimeout(r, 100))
      
      await runSelectWithJoin()
      await new Promise(r => setTimeout(r, 100))
      
      await runCountQuery()
      await new Promise(r => setTimeout(r, 100))
      
      await runFullTableScan()
      await new Promise(r => setTimeout(r, 100))
      
      await runAuthCheck()
      await new Promise(r => setTimeout(r, 100))
    }
    
    setCurrentTest(null)
    setIsRunning(false)
  }, [runPingTest, runSimpleSelect, runSelectWithJoin, runCountQuery, runFullTableScan, runAuthCheck])

  const clearResults = useCallback(() => {
    setResults([])
  }, [])

  // Group results by operation
  const groupedResults = results.reduce((acc, result) => {
    const key = result.operation
    if (!acc[key]) acc[key] = []
    acc[key].push(result)
    return acc
  }, {} as Record<string, LatencyResult[]>)

  const overallStats = calculateStats(results)

  return (
    <main className="min-h-screen pt-24 pb-12 bg-gradient-to-b from-background to-secondary/20">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Activity className="h-8 w-8" />
            Database Latency Test
          </h1>
          <p className="text-muted-foreground">
            Compare latency between self-hosted Supabase and supabase.com
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Current endpoint: <code className="bg-muted px-2 py-0.5 rounded">{process.env.NEXT_PUBLIC_SUPABASE_URL}</code>
          </p>
        </div>

        {/* Controls */}
        <Card className="p-6 mb-6">
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={() => runAllTests(1)} 
              disabled={isRunning}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              Run All Tests (1x)
            </Button>
            <Button 
              onClick={() => runAllTests(5)} 
              disabled={isRunning}
              variant="secondary"
              className="gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Run All Tests (5x)
            </Button>
            <Button 
              onClick={() => runAllTests(10)} 
              disabled={isRunning}
              variant="secondary"
              className="gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Run All Tests (10x)
            </Button>
            <Button 
              onClick={clearResults} 
              disabled={isRunning}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Clear Results
            </Button>
          </div>
          
          {isRunning && currentTest && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              Running: {currentTest}
            </div>
          )}
        </Card>

        {/* Individual Test Buttons */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Database className="h-5 w-5" />
            Individual Tests
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={runPingTest} disabled={isRunning}>
              Ping
            </Button>
            <Button size="sm" variant="outline" onClick={runSimpleSelect} disabled={isRunning}>
              Simple SELECT
            </Button>
            <Button size="sm" variant="outline" onClick={runSelectWithJoin} disabled={isRunning}>
              SELECT + Join
            </Button>
            <Button size="sm" variant="outline" onClick={runCountQuery} disabled={isRunning}>
              COUNT
            </Button>
            <Button size="sm" variant="outline" onClick={runFullTableScan} disabled={isRunning}>
              Full Scan (100 rows)
            </Button>
            <Button size="sm" variant="outline" onClick={runAuthCheck} disabled={isRunning}>
              Auth Check
            </Button>
          </div>
        </Card>

        {/* Overall Stats */}
        {overallStats && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Overall Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{overallStats.min}ms</div>
                <div className="text-xs text-muted-foreground">Min</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getLatencyColor(overallStats.avg)}`}>{overallStats.avg}ms</div>
                <div className="text-xs text-muted-foreground">Average</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getLatencyColor(overallStats.p50)}`}>{overallStats.p50}ms</div>
                <div className="text-xs text-muted-foreground">P50</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getLatencyColor(overallStats.p95)}`}>{overallStats.p95}ms</div>
                <div className="text-xs text-muted-foreground">P95</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{overallStats.max}ms</div>
                <div className="text-xs text-muted-foreground">Max</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{overallStats.count}</div>
                <div className="text-xs text-muted-foreground">Requests</div>
              </div>
            </div>
          </Card>
        )}

        {/* Per-Operation Stats */}
        {Object.keys(groupedResults).length > 0 && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Per-Operation Statistics</h2>
            <div className="space-y-4">
              {Object.entries(groupedResults).map(([operation, opResults]) => {
                const stats = calculateStats(opResults)
                if (!stats) return null
                
                return (
                  <div key={operation} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="font-medium text-sm">{operation}</div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">n={stats.count}</span>
                      <span className="text-green-500">{stats.min}ms</span>
                      <span className={getLatencyColor(stats.avg)}>avg: {stats.avg}ms</span>
                      <span className={getLatencyColor(stats.p95)}>p95: {stats.p95}ms</span>
                      <span className="text-red-500">{stats.max}ms</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Recent Results */}
        {results.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Results ({results.length})</h2>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {[...results].reverse().slice(0, 50).map((result, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-2 bg-muted/20 rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                    )}
                    <span className="text-muted-foreground">{result.operation}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.error && (
                      <span className="text-red-500 text-xs">{result.error}</span>
                    )}
                    <Badge variant={getLatencyBadge(result.latency)}>
                      {result.latency}ms
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Empty State */}
        {results.length === 0 && (
          <Card className="p-12 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No results yet</h3>
            <p className="text-muted-foreground mb-4">
              Click "Run All Tests" to start measuring database latency
            </p>
          </Card>
        )}
      </div>
    </main>
  )
}
