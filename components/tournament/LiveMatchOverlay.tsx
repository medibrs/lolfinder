'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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

type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'no-game'

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

      <div className="flex flex-col gap-0.5 shrink-0">
        {spell1Img && <img src={spell1Img} alt="" className="w-4 h-4 rounded-sm" />}
        {spell2Img && <img src={spell2Img} alt="" className="w-4 h-4 rounded-sm" />}
      </div>

      <div className={`flex-1 min-w-0 ${isBlue ? '' : 'text-right'}`}>
        <div className={`font-medium text-sm truncate ${isBlue ? 'text-blue-100' : 'text-red-100'}`}>
          {player.champion}
        </div>
        <div className="text-[10px] text-zinc-500 truncate">{player.summonerName}</div>
      </div>

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

      <div className={`text-center min-w-[40px] shrink-0 ${isBlue ? '' : 'order-first'}`}>
        <div className="text-sm font-medium text-zinc-300">{player.cs}</div>
        <div className="text-[10px] text-zinc-600">CS</div>
      </div>

      <div className={`text-center min-w-[50px] shrink-0 ${isBlue ? '' : 'order-first'}`}>
        <div className="text-sm font-medium text-yellow-400">{formatGold(player.itemGold || 0)}</div>
        <div className="text-[10px] text-zinc-600">Gold</div>
      </div>

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

// ─── Main Component ─────────────────────────────────────────────────

interface LiveMatchOverlayProps {
  host: string
}

export default function LiveMatchOverlay({ host }: LiveMatchOverlayProps) {
  const [data, setData] = useState<LivePayload | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [errorMsg, setErrorMsg] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLive = useCallback(async () => {
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
  }, [host])

  useEffect(() => {
    fetchLive()
    intervalRef.current = setInterval(fetchLive, 1500)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchLive])

  // ─── Loading / Error states ─────────────────────────────────────

  if (!data) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-center">
        {status === 'connecting' && (
          <>
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">Connecting to live game...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-red-400 font-medium text-sm">{errorMsg}</p>
            <p className="text-zinc-600 text-xs mt-1">Retrying automatically...</p>
          </>
        )}
        {status === 'no-game' && (
          <>
            <div className="text-3xl mb-3">🎮</div>
            <p className="text-yellow-400 font-medium text-sm">Waiting for Game</p>
            <p className="text-zinc-600 text-xs mt-1">{errorMsg || 'No active game detected'}</p>
          </>
        )}
      </div>
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      {/* Live indicator */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border-b border-zinc-800 text-xs">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-red-400 font-semibold uppercase tracking-wider">Live</span>
      </div>

      {/* Top Scoreboard */}
      <div className="bg-zinc-900 border-b border-zinc-800">
        <div className="h-1 flex">
          <div className="bg-blue-500 transition-all duration-300" style={{ width: `${blueGoldPercent}%` }} />
          <div className="bg-red-500 transition-all duration-300" style={{ width: `${100 - blueGoldPercent}%` }} />
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-blue-400 font-bold">BLUE</div>
              <div className="flex items-center gap-3">
                <div className="text-xl font-bold">{teams.ORDER.kills}</div>
                <div className="text-zinc-500 text-xs">
                  <div>{teams.ORDER.kills}/{teams.ORDER.deaths}/{teams.ORDER.assists}</div>
                  <div className="text-yellow-500">{formatGold(blueGold)}g</div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-xl font-mono font-bold">{formatTime(gameTimeSeconds)}</div>
              <div className={`text-xs font-medium ${
                goldDiff === 0 ? 'text-zinc-500' : goldDiff > 0 ? 'text-blue-400' : 'text-red-400'
              }`}>
                {goldDiff === 0 ? 'Even' : `${goldDiff > 0 ? '+' : ''}${formatGold(goldDiff)}g`}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="text-zinc-500 text-xs text-right">
                  <div>{teams.CHAOS.kills}/{teams.CHAOS.deaths}/{teams.CHAOS.assists}</div>
                  <div className="text-yellow-500">{formatGold(redGold)}g</div>
                </div>
                <div className="text-xl font-bold">{teams.CHAOS.kills}</div>
              </div>
              <div className="text-red-400 font-bold">RED</div>
            </div>
          </div>
        </div>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
        <div>
          <div className="bg-blue-500/10 border-b border-zinc-800 px-4 py-1.5 flex items-center justify-between">
            <span className="text-blue-400 font-semibold text-sm">Blue Team</span>
            <span className="text-zinc-400 text-xs">{formatGold(blueGold)}g</span>
          </div>
          {blue.map((p) => (
            <PlayerRow key={p.summonerName} player={p} isBlue={true} />
          ))}
        </div>

        <div>
          <div className="bg-red-500/10 border-b border-zinc-800 px-4 py-1.5 flex items-center justify-between">
            <span className="text-red-400 font-semibold text-sm">Red Team</span>
            <span className="text-zinc-400 text-xs">{formatGold(redGold)}g</span>
          </div>
          {red.map((p) => (
            <PlayerRow key={p.summonerName} player={p} isBlue={false} />
          ))}
        </div>
      </div>
    </div>
  )
}
