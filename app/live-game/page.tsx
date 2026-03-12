'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, Gamepad2, Loader2, MonitorPlay, X } from 'lucide-react'
import { DDRAGON_VERSION } from '@/lib/ddragon'

// ─── Types ──────────────────────────────────────────────────────────

type TeamStats = {
  name: string
  kills: number
  deaths: number
  assists: number
  kdaRatio: number
  gold: number
}

type ItemInfo = {
  id: number
  name: string
}

type Player = {
  summonerName: string
  champion: string
  team: 'ORDER' | 'CHAOS' | string
  level: number
  kills: number
  deaths: number
  assists: number
  kdaRatio: number
  cs: number
  gold: number
  itemGold?: number
  items: ItemInfo[]
  spell1: string
  spell2: string
  spell1Key?: string | null
  spell2Key?: string | null
}

type LivePayload = {
  gameTimeSeconds: number
  gameTimeMinutes: number
  teams: { ORDER: TeamStats; CHAOS: TeamStats }
  players: Player[]
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'no-game'

// ─── Helpers ────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatGold(gold: number) {
  if (!gold) return '0'
  if (gold >= 1000) return (gold / 1000).toFixed(1) + 'k'
  return gold.toString()
}

function getChampionImg(championName: string) {
  if (!championName) return ''
  const cleaned = championName.replace(/[^A-Za-z ]/g, ' ')
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''

  const base = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')

  const specialMap: Record<string, string> = {
    kogmaw: 'KogMaw',
    belveth: 'Belveth',
    reksai: 'RekSai',
    khazix: 'Khazix',
    velkoz: 'Velkoz',
    kaisa: 'Kaisa',
    chogath: 'Chogath',
    renataglasc: 'RenataGlasc',
    drmundo: 'DrMundo',
    missfortune: 'MissFortune',
    nunuwillump: 'Nunu',
    wukong: 'MonkeyKing',
  }

  const key = base.toLowerCase()
  const finalName = specialMap[key] ?? base
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${finalName}.png`
}

function getItemImg(id: number) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png`
}

function getSpellImg(key?: string | null) {
  if (!key) return null
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${key}.png`
}

// ─── Player Row ─────────────────────────────────────────────────────

function PlayerRow({ player, isBlue }: { player: Player; isBlue: boolean }) {
  const spell1Img = getSpellImg(player.spell1Key)
  const spell2Img = getSpellImg(player.spell2Key)

  return (
    <div className={`flex items-center gap-2 py-2 px-3 border-b border-zinc-800/50 last:border-0 hover:bg-white/5 transition-colors ${
      isBlue ? '' : 'flex-row-reverse'
    }`}>
      {/* Champion + Level */}
      <div className="relative shrink-0">
        <img
          src={getChampionImg(player.champion)}
          alt={player.champion}
          className={`w-10 h-10 rounded border-2 ${
            isBlue ? 'border-blue-500' : 'border-red-500'
          }`}
        />
        <span className={`absolute -bottom-1 ${isBlue ? '-right-1' : '-left-1'} text-[9px] font-bold px-1 rounded ${
          isBlue ? 'bg-blue-600' : 'bg-red-600'
        }`}>
          {player.level}
        </span>
      </div>

      {/* Spells */}
      <div className="flex flex-col gap-0.5 shrink-0">
        {spell1Img && <img src={spell1Img} alt="" className="w-4 h-4 rounded-sm" />}
        {spell2Img && <img src={spell2Img} alt="" className="w-4 h-4 rounded-sm" />}
      </div>

      {/* Name */}
      <div className={`flex-1 min-w-0 ${isBlue ? '' : 'text-right'}`}>
        <div className={`font-medium text-sm truncate ${isBlue ? 'text-blue-100' : 'text-red-100'}`}>
          {player.champion}
        </div>
        <div className="text-[10px] text-zinc-500 truncate">{player.summonerName}</div>
      </div>

      {/* KDA */}
      <div className={`text-center min-w-[60px] shrink-0 ${isBlue ? '' : 'order-first ml-0 mr-2'}`}>
        <div className="text-sm font-semibold">
          <span className="text-green-400">{player.kills}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-red-400">{player.deaths}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-yellow-300">{player.assists}</span>
        </div>
        <div className="text-[10px] text-zinc-500">{player.kdaRatio} KDA</div>
      </div>

      {/* CS */}
      <div className={`text-center min-w-[40px] shrink-0 ${isBlue ? '' : 'order-first'}`}>
        <div className="text-sm font-medium text-zinc-300">{player.cs}</div>
        <div className="text-[10px] text-zinc-600">CS</div>
      </div>

      {/* Gold */}
      <div className={`text-center min-w-[50px] shrink-0 ${isBlue ? '' : 'order-first'}`}>
        <div className="text-sm font-medium text-yellow-400">{formatGold(player.itemGold || 0)}</div>
        <div className="text-[10px] text-zinc-600">Gold</div>
      </div>

      {/* Items */}
      <div className={`flex gap-0.5 shrink-0 ${isBlue ? '' : 'order-first mr-2'}`}>
        {player.items.slice(0, 6).map((item, idx) => (
          <img
            key={`${item.id}-${idx}`}
            src={getItemImg(item.id)}
            alt={item.name}
            title={item.name}
            className="w-5 h-5 rounded-sm bg-zinc-900"
          />
        ))}
        {Array.from({ length: Math.max(0, 6 - player.items.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="w-5 h-5 rounded-sm bg-zinc-800/50" />
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function LiveGamePage() {
  const [hostInput, setHostInput] = useState('')
  const [activeHost, setActiveHost] = useState<string | null>(null)
  const [data, setData] = useState<LivePayload | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const fetchLive = useCallback(async (host: string) => {
    try {
      const res = await fetch(`/api/live-proxy?host=${encodeURIComponent(host)}`)
      const json = await res.json()

      if (!res.ok) {
        setStatus('error')
        setErrorMsg(json.error || `Server returned ${res.status}`)
        return
      }

      if (json.error) {
        setStatus('no-game')
        setErrorMsg(json.error)
        setData(null)
        return
      }

      if (!json.players || json.players.length === 0) {
        setStatus('no-game')
        setErrorMsg('No game data available')
        setData(null)
        return
      }

      setStatus('connected')
      setErrorMsg('')
      setData(json as LivePayload)
    } catch {
      setStatus('error')
      setErrorMsg('Cannot connect to relay')
      setData(null)
    }
  }, [])

  const startPolling = useCallback((host: string) => {
    stopPolling()
    setActiveHost(host)
    setStatus('connecting')
    setData(null)

    fetchLive(host)
    intervalRef.current = setInterval(() => fetchLive(host), 1500)
  }, [fetchLive, stopPolling])

  const disconnect = useCallback(() => {
    stopPolling()
    setActiveHost(null)
    setStatus('idle')
    setData(null)
    setErrorMsg('')
  }, [stopPolling])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const handleConnect = () => {
    const host = hostInput.trim()
    if (!host) return
    startPolling(host)
  }

  // ─── Idle / Connection Form ─────────────────────────────────────

  if (status === 'idle' || !activeHost) {
    return (
      <main className="pt-20 min-h-screen bg-zinc-950">
        <div className="max-w-xl mx-auto px-4 py-16">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                  <MonitorPlay className="h-10 w-10 text-purple-400" />
                </div>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white mb-2">Live Game Overlay</h1>
                <p className="text-zinc-400 text-sm">
                  Connect to a PC running the LoL Live Proxy to display real-time game data.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-sm text-zinc-400 block text-left">
                  Proxy Server Address (IP or IP:PORT)
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 192.168.1.50 or 192.168.1.50:4000"
                    value={hostInput}
                    onChange={(e) => setHostInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
                  />
                  <Button onClick={handleConnect} disabled={!hostInput.trim()}>
                    <Wifi className="h-4 w-4 mr-1.5" />
                    Connect
                  </Button>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Default port is 4000. Run the <code className="text-zinc-400">lol-live-proxy</code> executable on the spectator PC.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  // ─── Connecting / Error / No Game states ────────────────────────

  if (!data) {
    return (
      <main className="pt-20 min-h-screen bg-zinc-950">
        <div className="max-w-xl mx-auto px-4 py-16">
          {/* Disconnect bar */}
          <div className="flex items-center justify-between mb-6 px-1">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span>Connected to:</span>
              <Badge variant="outline" className="border-zinc-700 text-zinc-300 font-mono">
                {activeHost}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={disconnect} className="text-zinc-500 hover:text-red-400">
              <X className="h-4 w-4 mr-1" />
              Disconnect
            </Button>
          </div>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-12 text-center">
              {status === 'connecting' && (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-blue-400 mx-auto mb-4" />
                  <p className="text-zinc-400">Connecting to proxy...</p>
                </>
              )}
              {status === 'error' && (
                <>
                  <WifiOff className="h-10 w-10 text-red-400 mx-auto mb-4" />
                  <p className="text-red-400 font-medium">{errorMsg}</p>
                  <p className="text-zinc-600 text-sm mt-2">Check that the proxy is running and the IP is correct</p>
                </>
              )}
              {status === 'no-game' && (
                <>
                  <Gamepad2 className="h-10 w-10 text-yellow-400 mx-auto mb-4" />
                  <p className="text-yellow-400 font-medium">Waiting for Game</p>
                  <p className="text-zinc-600 text-sm mt-2">{errorMsg || 'No active game detected on the proxy'}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  // ─── Live Overlay ───────────────────────────────────────────────

  const { gameTimeSeconds, teams, players } = data
  const blue = players.filter((p) => p.team === 'ORDER')
  const red = players.filter((p) => p.team === 'CHAOS')

  const blueGold = blue.reduce((sum, p) => sum + (p.itemGold || 0), 0)
  const redGold = red.reduce((sum, p) => sum + (p.itemGold || 0), 0)
  const totalGold = blueGold + redGold || 1
  const blueGoldPercent = (blueGold / totalGold) * 100
  const goldDiff = blueGold - redGold

  return (
    <main className="pt-20 min-h-screen bg-zinc-950 text-white">
      {/* Connection bar */}
      <div className="bg-zinc-900/80 border-b border-zinc-800 px-4 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-zinc-400">
            Live from <span className="font-mono text-zinc-300">{activeHost}</span>
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect} className="text-zinc-500 hover:text-red-400 h-6 text-xs px-2">
          <X className="h-3 w-3 mr-1" />
          Disconnect
        </Button>
      </div>

      {/* Top Scoreboard */}
      <div className="bg-zinc-900 border-b border-zinc-800">
        {/* Gold Bar */}
        <div className="h-1 flex">
          <div className="bg-blue-500 transition-all duration-300" style={{ width: `${blueGoldPercent}%` }} />
          <div className="bg-red-500 transition-all duration-300" style={{ width: `${100 - blueGoldPercent}%` }} />
        </div>

        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Blue Side */}
            <div className="flex items-center gap-6">
              <div className="text-blue-400 font-bold text-lg">BLUE</div>
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold">{teams.ORDER.kills}</div>
                <div className="text-zinc-500 text-sm">
                  <div>{teams.ORDER.kills}/{teams.ORDER.deaths}/{teams.ORDER.assists}</div>
                  <div className="text-yellow-500">{formatGold(blueGold)}g</div>
                </div>
              </div>
            </div>

            {/* Center */}
            <div className="text-center">
              <div className="text-2xl font-mono font-bold">{formatTime(gameTimeSeconds)}</div>
              <div className={`text-sm font-medium ${
                goldDiff === 0 ? 'text-zinc-500' : goldDiff > 0 ? 'text-blue-400' : 'text-red-400'
              }`}>
                {goldDiff === 0 ? 'Even' : `${goldDiff > 0 ? '+' : ''}${formatGold(goldDiff)}g`}
              </div>
            </div>

            {/* Red Side */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="text-zinc-500 text-sm text-right">
                  <div>{teams.CHAOS.kills}/{teams.CHAOS.deaths}/{teams.CHAOS.assists}</div>
                  <div className="text-yellow-500">{formatGold(redGold)}g</div>
                </div>
                <div className="text-2xl font-bold">{teams.CHAOS.kills}</div>
              </div>
              <div className="text-red-400 font-bold text-lg">RED</div>
            </div>
          </div>
        </div>
      </div>

      {/* Teams */}
      <div className="max-w-6xl mx-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Blue Team */}
          <div className="bg-zinc-900/80 rounded-lg border border-zinc-800 overflow-hidden">
            <div className="bg-blue-500/10 border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
              <span className="text-blue-400 font-semibold">Blue Team</span>
              <span className="text-zinc-400 text-sm">{formatGold(blueGold)}g</span>
            </div>
            <div>
              {blue.map((p) => (
                <PlayerRow key={p.summonerName} player={p} isBlue={true} />
              ))}
            </div>
          </div>

          {/* Red Team */}
          <div className="bg-zinc-900/80 rounded-lg border border-zinc-800 overflow-hidden">
            <div className="bg-red-500/10 border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
              <span className="text-red-400 font-semibold">Red Team</span>
              <span className="text-zinc-400 text-sm">{formatGold(redGold)}g</span>
            </div>
            <div>
              {red.map((p) => (
                <PlayerRow key={p.summonerName} player={p} isBlue={false} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
