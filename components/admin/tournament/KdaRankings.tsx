'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Loader2, RefreshCw, Download, Trophy, Swords, Target, Eye } from 'lucide-react'
import { DDRAGON_VERSION } from '@/lib/ddragon'

interface KdaRankingsProps {
    tournamentId: string
}

interface PlayerRanking {
    puuid: string
    summonerName: string
    riotIdTagline: string
    kills: number
    deaths: number
    assists: number
    cs: number
    goldEarned: number
    damageDealt: number
    visionScore: number
    gamesPlayed: number
    wins: number
    champions: string[]
    kda: number
    avgKills: number
    avgDeaths: number
    avgAssists: number
    avgCs: number
    avgGold: number
    avgDamage: number
    winRate: number
}

function getChampionImg(name: string) {
    if (!name) return ''
    return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${name}.png`
}

function formatNumber(n: number) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
    return n.toString()
}

export default function KdaRankings({ tournamentId }: KdaRankingsProps) {
    const { toast } = useToast()
    const [rankings, setRankings] = useState<PlayerRanking[]>([])
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(false)
    const [gamesAnalyzed, setGamesAnalyzed] = useState(0)
    const [sortBy, setSortBy] = useState<'kda' | 'avgKills' | 'avgDamage' | 'avgCs' | 'winRate'>('kda')

    const fetchRankings = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/kda-rankings`)
            if (res.ok) {
                const data = await res.json()
                setRankings(data.rankings || [])
                setGamesAnalyzed(data.gamesAnalyzed || 0)
            } else {
                const err = await res.json().catch(() => ({}))
                toast({ title: 'Error', description: err.error || 'Failed to fetch rankings', variant: 'destructive' })
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to fetch rankings', variant: 'destructive' })
        }
        setLoading(false)
    }, [tournamentId, toast])

    const handleFetchStats = async (force = false) => {
        setFetching(true)
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/fetch-game-stats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' })
            } else {
                const failedResults = (data.results || []).filter((r: any) => r.status === 'error')
                const errorDetail = failedResults.length > 0
                    ? `\nErrors: ${failedResults.map((r: any) => `${r.riotMatchId}: ${r.error}`).join(', ')}`
                    : ''
                toast({
                    title: data.fetched > 0 ? 'Stats Fetched' : 'Fetch Failed',
                    description: `${data.fetched}/${data.total || 0} games fetched from Riot API.${errorDetail}`,
                    variant: data.fetched === 0 && data.total > 0 ? 'destructive' : 'default',
                })
                if (data.fetched > 0) await fetchRankings()
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to fetch stats', variant: 'destructive' })
        }
        setFetching(false)
    }

    const sorted = [...rankings].sort((a, b) => {
        if (sortBy === 'kda') return b.kda - a.kda
        if (sortBy === 'avgKills') return b.avgKills - a.avgKills
        if (sortBy === 'avgDamage') return b.avgDamage - a.avgDamage
        if (sortBy === 'avgCs') return b.avgCs - a.avgCs
        if (sortBy === 'winRate') return b.winRate - a.winRate
        return 0
    })

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5" />
                            KDA Rankings
                        </CardTitle>
                        <CardDescription>
                            Player performance stats aggregated from Riot match data.
                            {gamesAnalyzed > 0 && ` ${gamesAnalyzed} games analyzed.`}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchRankings}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            <span className="ml-1.5">Load Rankings</span>
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => handleFetchStats(false)}
                            disabled={fetching}
                        >
                            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            <span className="ml-1.5">Fetch from Riot API</span>
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {rankings.length === 0 && !loading ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No KDA data yet.</p>
                        <p className="text-xs mt-1">Add Riot match IDs to games in the Matches tab, then click "Fetch from Riot API".</p>
                    </div>
                ) : loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Sort controls */}
                        <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-muted-foreground">Sort by:</span>
                            {([
                                ['kda', 'KDA'],
                                ['avgKills', 'Kills'],
                                ['avgDamage', 'Damage'],
                                ['avgCs', 'CS'],
                                ['winRate', 'Win Rate'],
                            ] as const).map(([key, label]) => (
                                <Button
                                    key={key}
                                    variant={sortBy === key ? 'default' : 'ghost'}
                                    size="sm"
                                    className="h-6 text-[11px] px-2"
                                    onClick={() => setSortBy(key)}
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>

                        {/* Table */}
                        <div className="rounded-lg border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 text-xs text-muted-foreground">
                                        <th className="text-left px-3 py-2 w-8">#</th>
                                        <th className="text-left px-3 py-2">Player</th>
                                        <th className="text-left px-3 py-2 w-20">Champions</th>
                                        <th className="text-center px-3 py-2">GP</th>
                                        <th className="text-center px-3 py-2">WR</th>
                                        <th className="text-center px-3 py-2">KDA</th>
                                        <th className="text-center px-3 py-2">Avg K/D/A</th>
                                        <th className="text-center px-3 py-2">CS/g</th>
                                        <th className="text-center px-3 py-2">Gold/g</th>
                                        <th className="text-center px-3 py-2">Dmg/g</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((p, idx) => (
                                        <tr key={p.puuid || p.summonerName} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                                            <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                                                {idx + 1}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="font-medium">{p.summonerName}</div>
                                                {p.riotIdTagline && (
                                                    <span className="text-[10px] text-muted-foreground">#{p.riotIdTagline}</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex -space-x-1">
                                                    {p.champions.slice(0, 4).map(c => (
                                                        <img
                                                            key={c}
                                                            src={getChampionImg(c)}
                                                            alt={c}
                                                            title={c}
                                                            className="w-5 h-5 rounded-full border border-background"
                                                        />
                                                    ))}
                                                    {p.champions.length > 4 && (
                                                        <span className="w-5 h-5 rounded-full bg-muted border border-background flex items-center justify-center text-[8px] font-bold">
                                                            +{p.champions.length - 4}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="text-center px-3 py-2 text-xs">{p.gamesPlayed}</td>
                                            <td className="text-center px-3 py-2">
                                                <Badge variant={p.winRate >= 60 ? 'default' : p.winRate >= 50 ? 'secondary' : 'outline'} className="text-[10px] h-5 px-1.5">
                                                    {p.winRate}%
                                                </Badge>
                                            </td>
                                            <td className="text-center px-3 py-2">
                                                <span className={`font-bold text-xs ${p.kda >= 5 ? 'text-yellow-500' : p.kda >= 3 ? 'text-green-500' : p.kda >= 2 ? 'text-blue-400' : 'text-muted-foreground'}`}>
                                                    {p.kda.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="text-center px-3 py-2 text-xs">
                                                <span className="text-green-400">{p.avgKills}</span>
                                                <span className="text-muted-foreground">/</span>
                                                <span className="text-red-400">{p.avgDeaths}</span>
                                                <span className="text-muted-foreground">/</span>
                                                <span className="text-yellow-300">{p.avgAssists}</span>
                                            </td>
                                            <td className="text-center px-3 py-2 text-xs font-mono">{p.avgCs}</td>
                                            <td className="text-center px-3 py-2 text-xs font-mono text-yellow-500">{formatNumber(p.avgGold)}</td>
                                            <td className="text-center px-3 py-2 text-xs font-mono text-red-400">{formatNumber(p.avgDamage)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
